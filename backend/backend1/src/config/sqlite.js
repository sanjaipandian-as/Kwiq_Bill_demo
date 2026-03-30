const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const keytar = require("keytar");
const crypto = require("crypto");

const SERVICE = "BillingSoftware";

async function openUserDatabase(googleUserId) {
  const baseDir = path.join(
    require("os").homedir(),
    "Documents",
    "BillingSoftware",
    `google-${googleUserId}`
  );

  const dbDir = path.join(baseDir, "db");
  fs.mkdirSync(dbDir, { recursive: true });

  const dbPath = path.join(dbDir, "billing.db");

  let key = await keytar.getPassword(SERVICE, googleUserId);
  if (!key) {
    key = crypto.randomBytes(32).toString("hex");
    await keytar.setPassword(SERVICE, googleUserId, key);
  }

  const db = new Database(dbPath);
  db.pragma(`key = '${key}'`);
  db.pragma("journal_mode = WAL");

  return db;
}

module.exports = { openUserDatabase };
