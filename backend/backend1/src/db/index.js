const { openUserDatabase } = require("./connection");
const path = require("path");
const fs = require("fs");

const schema = fs.readFileSync(
  path.join(__dirname, "schema.sql"),
  "utf8"
);

// Helper to fix items and calculate cost
function fixInvoiceData(items, productMap) {
  let totalCost = 0;
  let wasModified = false;
  let enrichedItems = [];

  if (!Array.isArray(items)) return { newItems: [], totalCost: 0, wasModified: false };

  for (const item of items) {
    let newItem = { ...item };
    let cost = 0;
    const qty = parseFloat(item.quantity) || 0;

    // 1. Snapshot cost exists? Use it.
    if (newItem.costPrice !== undefined && newItem.costPrice !== null) {
      cost = parseFloat(newItem.costPrice);
    }
    // 2. Fallback to lookup
    else if (newItem.productId || newItem.id) {
      const pId = newItem.productId || newItem.id;
      const product = productMap[pId];

      if (product) {
        let pCost = parseFloat(product.cost_price) || 0;

        // Handle Variants
        let variants = [];
        try { variants = JSON.parse(product.variants || "[]"); } catch (e) { }

        if (variants.length > 0) {
          let vIndex = -1;
          if (item.variantId) {
            vIndex = variants.findIndex(v => (v._id || v.id) === item.variantId);
          }
          if (vIndex === -1 && item.variantIndex !== undefined && item.variantIndex !== null) {
            vIndex = parseInt(item.variantIndex);
          }

          if (vIndex >= 0 && variants[vIndex]) {
            if (variants[vIndex].costPrice !== undefined && variants[vIndex].costPrice !== null) {
              pCost = parseFloat(variants[vIndex].costPrice);
            }
          }
        }

        cost = pCost;

        // BACKFILL: Update snapshot in item
        newItem.costPrice = cost;
        wasModified = true;
      }
    }

    totalCost += (cost * qty);
    enrichedItems.push(newItem);
  }

  return { newItems: enrichedItems, totalCost, wasModified };
}

async function initDB(googleSub) {
  const db = await openUserDatabase(googleSub);
  db.exec(schema);

  // 1. Auto-migration: Check for new columns in invoices
  try {
    const tableInfo = db.prepare("PRAGMA table_info(invoices)").all();
    const hasRoundOff = tableInfo.some(c => c.name === 'round_off');
    const hasTotalCost = tableInfo.some(c => c.name === 'total_cost');
    const hasBillNumber = tableInfo.some(c => c.name === 'bill_number');
    const hasRemarks = tableInfo.some(c => c.name === 'remarks');
    const hasBillDiscount = tableInfo.some(c => c.name === 'bill_discount');
    const hasLoyaltyPointsDiscount = tableInfo.some(c => c.name === 'loyalty_points_discount');
    const hasAdditionalCharges = tableInfo.some(c => c.name === 'additional_charges');
    const hasBalance = tableInfo.some(c => c.name === 'balance');
    const hasAmountReceived = tableInfo.some(c => c.name === 'amount_received');
    const hasPaymentMethod = tableInfo.some(c => c.name === 'payment_method');

    if (!hasRoundOff) {
      console.log("Auto-migrating schema: Adding round_off column to invoices...");
      db.prepare("ALTER TABLE invoices ADD COLUMN round_off REAL DEFAULT 0").run();
    }
    if (!hasTotalCost) {
      console.log("Auto-migrating schema: Adding total_cost column to invoices...");
      db.prepare("ALTER TABLE invoices ADD COLUMN total_cost REAL DEFAULT 0").run();
    }
    if (!hasBillNumber) {
      console.log("Auto-migrating schema: Adding bill_number column to invoices...");
      db.prepare("ALTER TABLE invoices ADD COLUMN bill_number INTEGER").run();
    }
    if (!hasRemarks) {
      console.log("Auto-migrating schema: Adding remarks column to invoices...");
      db.prepare("ALTER TABLE invoices ADD COLUMN remarks TEXT").run();
    }
    if (!hasBillDiscount) {
      console.log("Auto-migrating schema: Adding bill_discount column to invoices...");
      db.prepare("ALTER TABLE invoices ADD COLUMN bill_discount REAL DEFAULT 0").run();
    }
    if (!hasLoyaltyPointsDiscount) {
      console.log("Auto-migrating schema: Adding loyalty_points_discount column to invoices...");
      db.prepare("ALTER TABLE invoices ADD COLUMN loyalty_points_discount REAL DEFAULT 0").run();
    }
    if (!hasAdditionalCharges) {
      console.log("Auto-migrating schema: Adding additional_charges column to invoices...");
      db.prepare("ALTER TABLE invoices ADD COLUMN additional_charges REAL DEFAULT 0").run();
    }
    if (!hasBalance) {
      console.log("Auto-migrating schema: Adding balance column to invoices...");
      db.prepare("ALTER TABLE invoices ADD COLUMN balance REAL DEFAULT 0").run();
    }
    if (!hasAmountReceived) {
      console.log("Auto-migrating schema: Adding amount_received column to invoices...");
      db.prepare("ALTER TABLE invoices ADD COLUMN amount_received REAL DEFAULT 0").run();
    }
    if (!hasPaymentMethod) {
      console.log("Auto-migrating schema: Adding payment_method column to invoices...");
      db.prepare("ALTER TABLE invoices ADD COLUMN payment_method TEXT").run();
    }

    // Check for new columns in expenses
    const expenseTableInfo = db.prepare("PRAGMA table_info(expenses)").all();
    const hasReceiptUrl = expenseTableInfo.some(c => c.name === 'receipt_url');

    if (!hasReceiptUrl) {
      console.log("Auto-migrating schema: Adding receipt_url column to expenses...");
      db.prepare("ALTER TABLE expenses ADD COLUMN receipt_url TEXT").run();
    }

    // Check for new columns in customers
    const customerTableInfo = db.prepare("PRAGMA table_info(customers)").all();
  } catch (err) {
    console.error("Schema migration error in initDB:", err);
  }

  // 2. Data Fix v2: Backfill Items JSON and Recalculate Costs
  try {
    db.exec("CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, executed_at TEXT)");

    // Bump version to v2 to force re-run
    const MIGRATION_ID = 'fix_costs_2026_01_30_v2';
    const hasMigrated = db.prepare("SELECT 1 FROM _migrations WHERE id = ?").get(MIGRATION_ID);

    if (!hasMigrated) {
      console.log(`Running migration: ${MIGRATION_ID} (Fixing Invoice items & costs)...`);

      const products = db.prepare('SELECT * FROM products').all();
      const productMap = {};
      products.forEach(p => productMap[p.id] = p);

      const invoices = db.prepare('SELECT * FROM invoices').all();
      let updatedCount = 0;
      const updateStmt = db.prepare('UPDATE invoices SET items = ?, total_cost = ? WHERE id = ?');

      const runTransaction = db.transaction(() => {
        for (const inv of invoices) {
          let items = [];
          try { items = JSON.parse(inv.items); } catch (e) { continue; }

          const { newItems, totalCost, wasModified } = fixInvoiceData(items, productMap);
          const currentCost = inv.total_cost || 0;

          // Update if items were modified (backfilled) OR if total cost changed slightly
          // (Checking items modification is crucial for "Top Movers" fix)
          const costChanged = Math.abs(currentCost - totalCost) > 0.01;

          if (wasModified || costChanged) {
            updateStmt.run(JSON.stringify(newItems), totalCost, inv.id);
            updatedCount++;
          }
        }
      });

      runTransaction();
      console.log(`Migration v2 complete. Updated ${updatedCount} invoices.`);

      db.prepare("INSERT INTO _migrations (id, executed_at) VALUES (?, ?)").run(MIGRATION_ID, new Date().toISOString());
    }

    // 3. Data Migration V3: Backfill balance and amount_received
    const MIGRATION_V3_ID = 'backfill_balance_amount_received_2026_02_11';
    const hasMigratedV3 = db.prepare("SELECT 1 FROM _migrations WHERE id = ?").get(MIGRATION_V3_ID);

    if (!hasMigratedV3) {
      console.log(`Running migration: ${MIGRATION_V3_ID} (Backfilling Balance & Amount Received)...`);
      const invoices = db.prepare('SELECT id, total, status, payments, amount_received, balance FROM invoices').all();
      const updateStmt = db.prepare('UPDATE invoices SET balance = ?, amount_received = ? WHERE id = ?');

      const runTransaction = db.transaction(() => {
        for (const inv of invoices) {
          let payments = [];
          try { payments = JSON.parse(inv.payments || "[]"); } catch (e) { }
          const amountPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
          const total = parseFloat(inv.total) || 0;

          const balance = Math.max(0, total - amountPaid);

          // Backfill amount_received if it's 0 or null
          let amountReceived = inv.amount_received || 0;
          if (amountReceived <= 0) {
            if (inv.status === 'Paid') amountReceived = total;
            else if (inv.status === 'Partially Paid') amountReceived = amountPaid;
          }

          updateStmt.run(balance, amountReceived, inv.id);
        }
      });

      runTransaction();
      console.log(`Migration V3 complete.`);
      db.prepare("INSERT INTO _migrations (id, executed_at) VALUES (?, ?)").run(MIGRATION_V3_ID, new Date().toISOString());
    }
  } catch (err) {
    console.error("Data migration error:", err);
  }

  return db;
}

module.exports = { initDB };
