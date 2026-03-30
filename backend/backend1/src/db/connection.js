const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
let keytar;
try {
  keytar = require("keytar");
} catch (err) {
  console.warn("⚠️ Keytar not available:", err.message);
  keytar = null;
}

const SERVICE = "BillingSoftware";

async function openUserDatabase(rawGoogleSub) {
  const googleSub = String(rawGoogleSub); // 🔑 Ensure string
  const baseDir = path.join(
    require("os").homedir(),
    "Documents",
    "BillingSoftware",
    `google-${googleSub}`
  );

  fs.mkdirSync(path.join(baseDir, "db"), { recursive: true });
  fs.mkdirSync(path.join(baseDir, "uploads"), { recursive: true });

  const dbPath = path.join(baseDir, "db", "billing.db");

  let key;
  try {
    key = await keytar.getPassword(SERVICE, googleSub);
    if (!key) {
      key = require("crypto").randomBytes(32).toString("hex");
      await keytar.setPassword(SERVICE, googleSub, key);
    }
    console.log(`🔐 Database key loaded for ${googleSub}`);
  } catch (err) {
    console.warn("⚠️ Keytar failed (native module issue), using fallback key derivation:", err.message);
    // Fallback: Derive a deterministic key from googleSub and Service Name
    // This is less secure than system keychain but functional for local app
    const output = require("crypto").createHash("sha256").update(`${SERVICE}-${googleSub}`).digest("hex");
    key = output;
  }

  const db = new Database(dbPath);
  db.pragma(`key = '${key}'`);
  db.pragma("journal_mode = WAL");

  return db;
}

module.exports = { openUserDatabase };
