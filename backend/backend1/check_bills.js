const Database = require("better-sqlite3");
const path = require("path");
const crypto = require("crypto");

const SERVICE = "BillingSoftware";
const googleSub = "116609331518824508785";
const dbPath = "C:\\Users\\john\\Documents\\BillingSoftware\\google-116609331518824508785\\db\\billing.db";

async function check() {
    let key;
    // Fallback key derivation (as seen in connection.js)
    key = crypto.createHash("sha256").update(`${SERVICE}-${googleSub}`).digest("hex");

    console.log("Using key:", key);

    const db = new Database(dbPath);
    try {
        db.pragma(`key = '${key}'`);

        const invoices = db.prepare(`
            SELECT id, bill_number, date, status, total, total_cost
            FROM invoices 
            WHERE date(date, 'localtime') = '2026-02-11'
            ORDER BY bill_number ASC
        `).all();

        console.log(`Found ${invoices.length} invoices for today (2026-02-11).`);
        console.log(JSON.stringify(invoices, null, 2));

        // Check for gaps or duplicates
        const billNumbers = invoices.map(inv => inv.bill_number).filter(n => n !== null);
        console.log("Bill numbers sequence:", billNumbers);

        const gaps = [];
        for (let i = 1; i < billNumbers.length; i++) {
            if (billNumbers[i] !== billNumbers[i - 1] + 1) {
                gaps.push({ from: billNumbers[i - 1], to: billNumbers[i] });
            }
        }

        if (gaps.length > 0) {
            console.log("Gaps detected in bill numbering:", gaps);
        } else {
            console.log("No gaps detected in bill numbering.");
        }

    } catch (err) {
        console.error("Error querying database:", err.message);
        console.log("Attempting without PRAGMA key (in case it is not encrypted)...");
        try {
            const db2 = new Database(dbPath);
            const invoices = db2.prepare(`
                SELECT id, bill_number, date, status, total
                FROM invoices 
                WHERE date(date, 'localtime') = '2026-02-11'
                ORDER BY bill_number ASC
            `).all();
            console.log(`Found ${invoices.length} invoices for today (2026-02-11) without encryption.`);
            console.log(JSON.stringify(invoices, null, 2));
        } catch (err2) {
            console.error("Second attempt failed:", err2.message);
        }
    } finally {
        db.close();
    }
}

check();
