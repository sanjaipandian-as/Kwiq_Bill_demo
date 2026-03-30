const Database = require("better-sqlite3");
const crypto = require("crypto");

const SERVICE = "BillingSoftware";
const googleSub = "116609331518824508785";
const dbPath = "C:\\Users\\john\\Documents\\BillingSoftware\\google-116609331518824508785\\db\\billing.db";

async function check() {
    const key = crypto.createHash("sha256").update(`${SERVICE}-${googleSub}`).digest("hex");
    const db = new Database(dbPath);
    try {
        db.pragma(`key = '${key}'`);

        console.log("Querying SQLite for today (2026-02-11)...");
        const invoices = db.prepare(`
            SELECT id, bill_number, date, status, total, created_at
            FROM invoices 
            WHERE date(date, 'localtime') = '2026-02-11'
            ORDER BY date ASC
        `).all();

        console.log(`Found ${invoices.length} invoices in SQLite.`);
        invoices.forEach((inv, i) => {
            console.log(`${i + 1}. ID: ${inv.id}, Bill #: ${inv.bill_number}, Status: ${inv.status}, Date: ${inv.date}`);
        });

        // Check for ANY invoices with bill_number 1 today
        const ones = db.prepare(`
            SELECT id, bill_number, date, status
            FROM invoices 
            WHERE bill_number = 1 AND date(date, 'localtime') = '2026-02-11'
        `).all();
        console.log("\nInvoices with Bill #1 today:");
        ones.forEach(inv => console.log(`- ID: ${inv.id}, Date: ${inv.date}, Status: ${inv.status}`));

    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        db.close();
    }
}

check();
