const fs = require("fs");
const path = require("path");

/**
 * Sync any SQLite table to a JSON file
 *
 * @param {Object} options
 * @param {Object} options.db       - better-sqlite3 instance
 * @param {string} options.table    - table name
 * @param {string} options.userBaseDir  - base user directory
 * @param {Function} [options.map]  - optional row transformer
 */
const { performBackup } = require("../services/backupService");

// Debounce Map: userId -> timeoutId
const debounceMap = new Map();

function syncTableToJson({ db, table, userBaseDir, map, userId }) {
  setImmediate(async () => {
    try {
      const dataDir = path.join(userBaseDir, "data", table);
      await fs.promises.mkdir(dataDir, { recursive: true });

      const rows = db.prepare(`SELECT * FROM ${table}`).all();
      const output = map ? rows.map(map) : rows;
      const filePath = path.join(dataDir, `${table}.json`);

      // ⚡ Write asynchronously to avoid blocking the event loop
      await fs.promises.writeFile(
        filePath,
        JSON.stringify(output, null, 2),
        "utf-8"
      );

      console.log(`🔄 Synced ${table} → ${filePath}`);

      // ☁️ Trigger Drive Backup (Debounced 30s)
      if (userId) {
        if (debounceMap.has(userId)) {
          clearTimeout(debounceMap.get(userId));
        }

        const timeoutId = setTimeout(() => {
          // 🛡️ Check Settings before Backup
          try {
            const settingsRow = db.prepare(`SELECT data FROM settings WHERE id = 'singleton'`).get();
            const settings = settingsRow ? JSON.parse(settingsRow.data) : {};

            if (!settings.backup?.enabled) {
              return; // Silent skip if disabled
            }

            performBackup(userId, userBaseDir).then(res => {
              if (res.success) {
                // Silent success to prevent log spam
              }
            });
          } catch (err) {
            console.error("Backup trigger check failed:", err);
          }
          debounceMap.delete(userId);
        }, 30000); // 30 seconds debounce

        debounceMap.set(userId, timeoutId);
      }
    } catch (err) {
      console.error(`Background JSON sync failed for ${table}:`, err);
    }
  });
}

module.exports = { syncTableToJson };
