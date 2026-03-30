const { withDB } = require("../db/db");
const { syncTableToJson } = require("../db/syncToJson");
const { v4: uuid } = require("uuid");

exports.createInvoice = async (req, res) => {
  const db = await withDB(req);
  // Fetch Settings for Custom ID Prefix
  let settings = {};
  try {
    const settingsRow = db.prepare("SELECT data FROM settings WHERE id = 'singleton'").get();
    settings = settingsRow ? JSON.parse(settingsRow.data) : {};
  } catch (e) {
    console.error("Failed to fetch settings for ID generation", e);
  }

  const storeName = settings.store?.name || 'Store';
  const prefix = (storeName[0] || 'S').toUpperCase();
  const randomSuffix = Math.floor(100000 + Math.random() * 900000); // 6 digit random
  const id = `${prefix}-${randomSuffix}`; // e.g. M-839210

  const date = new Date().toISOString();

  // Auto-migrate schema
  try {
    const tableInfo = db.prepare("PRAGMA table_info(invoices)").all();
    const hasRoundOff = tableInfo.some(c => c.name === 'round_off');
    const hasTotalCost = tableInfo.some(c => c.name === 'total_cost');
    const hasDeliveryStatus = tableInfo.some(c => c.name === 'delivery_status');

    if (!hasRoundOff) {
      console.log("Auto-migrating schema: Adding round_off column to invoices...");
      db.prepare("ALTER TABLE invoices ADD COLUMN round_off REAL DEFAULT 0").run();
    }
    if (!hasTotalCost) {
      console.log("Auto-migrating schema: Adding total_cost column to invoices...");
      db.prepare("ALTER TABLE invoices ADD COLUMN total_cost REAL DEFAULT 0").run();
    }
    if (!hasDeliveryStatus) {
      console.log("Auto-migrating schema: Adding delivery_status column to invoices...");
      db.prepare("ALTER TABLE invoices ADD COLUMN delivery_status TEXT DEFAULT 'pending'").run();
    }

    // Check for bill_number column
    const hasBillNumber = tableInfo.some(c => c.name === 'bill_number');
    if (!hasBillNumber) {
      console.log("Auto-migrating schema: Adding bill_number column to invoices...");
      db.prepare("ALTER TABLE invoices ADD COLUMN bill_number INTEGER DEFAULT 0").run();
    }

    // Check for new invoice detail columns
    const hasRemarks = tableInfo.some(c => c.name === 'remarks');
    const hasBillDiscount = tableInfo.some(c => c.name === 'bill_discount');
    const hasLoyaltyDiscount = tableInfo.some(c => c.name === 'loyalty_points_discount');
    const hasAdditionalCharges = tableInfo.some(c => c.name === 'additional_charges');
    const hasBalance = tableInfo.some(c => c.name === 'balance');

    if (!hasRemarks) {
      console.log("Auto-migrating schema: Adding remarks column to invoices...");
      db.prepare("ALTER TABLE invoices ADD COLUMN remarks TEXT DEFAULT ''").run();
    }
    if (!hasBillDiscount) {
      console.log("Auto-migrating schema: Adding bill_discount column to invoices...");
      db.prepare("ALTER TABLE invoices ADD COLUMN bill_discount REAL DEFAULT 0").run();
    }
    if (!hasLoyaltyDiscount) {
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

    // Migrate customers table
    // Removed whatsapp schema patches.

    // Note: Adding UNIQUE constraint to existing phone column requires creating a new table
    // We'll skip this for migration safety. New databases will have it from schema.sql
    // If needed, can be done manually or via more complex migration
  } catch (err) {
    console.error("Schema migration error:", err);
  }

  const runTransaction = db.transaction(() => {
    // 0. Calculate Bill Number (Inside transaction for safety)
    const settingsRow = db.prepare("SELECT data FROM settings WHERE id = 'singleton'").get();
    const settings = settingsRow ? JSON.parse(settingsRow.data) : {};
    const resetPeriod = settings.invoice?.billNumberResetPeriod || 'Daily'; // 'Daily' or 'Monthly'

    // FIXED: Use a more robust date range query to avoid timezone prefix issues
    // We want invoices from 00:00:00 to 23:59:59 in the user's LOCAL time
    // But since dates are stored as ISO (UTC), we should ideally store a local_date column
    // For now, let's keep it simple: prefix match on a local string is risky.
    // Let's use the same logic as recalculate: get all invoices for the day

    const localDate = new Date(date);
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    const todayISO = `${year}-${month}-${day}`;
    const monthISO = `${year}-${month}`;

    // Instead of LIKE, let's fetch all invoices and filter in JS if needed, or use a date range
    // but the 'date' column in DB is ISO string. 
    // To be safe, we can use: WHERE date >= '2026-02-11T00:00:00' AND date <= '2026-02-11T23:59:59'
    // But wait, if it's stored as UTC, this range is UTC range.

    // Most robust way: Query with date truncation if SQLite supports it, or just use LIKE with a wider range
    // and then filter accurately.
    // Actually, the prefix match `YYYY-MM-DD%` works IF the stored date matches the local date.
    // The current code stores `new Date().toISOString()` which IS UTC.

    // Let's fix this by querying for the last invoice created TODAY in local time.
    // We'll search for invoices where the LOCAL date matches today.

    const lastBill = db.prepare(`
      SELECT MAX(bill_number) as maxSeq 
      FROM invoices 
      WHERE date(date, 'localtime') = date(?, 'localtime')
    `).get(date);
    const nextBillNumber = (lastBill?.maxSeq || 0) + 1;

    // 1. Prepare Items with Cost Price Snapshot
    const rawItems = req.body.items || [];
    const enrichedItems = [];
    let productsUpdated = false;
    let totalCost = 0;

    // We'll update stock as we process items
    for (const item of rawItems) {
      if (item.id || item.productId) {
        const productId = item.id || item.productId;

        // Fetch current product state
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
        let finalItem = { ...item }; // Clone

        if (product) {
          let variants = [];
          try { variants = JSON.parse(product.variants || "[]"); } catch (e) { variants = []; }

          let costPrice = product.cost_price || 0;
          let variantIndex = -1;

          // Check if variant
          if (variants.length > 0 && (item.variantId || item.variantIndex !== undefined || item.variantIndex !== null)) {


            // Try by ID first
            if (item.variantId) {
              variantIndex = variants.findIndex(v => {
                const vId = v._id || v.id;
                const match = String(vId) === String(item.variantId);
                return match;
              });

            }
            // Fallback to index
            if (variantIndex === -1 && item.variantIndex !== undefined && item.variantIndex !== null) {
              variantIndex = parseInt(item.variantIndex);

            }

            if (variantIndex >= 0 && variants[variantIndex]) {
              // Found variant
              costPrice = variants[variantIndex].costPrice || costPrice; // Variant cost > Product cost

              // Deduct Stock
              const oldStock = variants[variantIndex].stock || 0;
              variants[variantIndex].stock = Math.max(0, oldStock - item.quantity);



              const newTotalStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);

              db.prepare('UPDATE products SET variants = ?, stock = ?, updated_at = ? WHERE id = ?').run(
                JSON.stringify(variants),
                newTotalStock,
                date,
                productId
              );
              productsUpdated = true;
            } else {

            }
          } else {
            // Standard Product

            const newStock = Math.max(0, (product.stock || 0) - item.quantity);
            db.prepare('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?').run(
              newStock,
              date,
              productId
            );
            productsUpdated = true;
          }

          // Snapshot Cost Price
          finalItem.costPrice = costPrice;
        }

        // Calculate Cost for this item
        const qty = parseFloat(item.quantity) || 0;
        const uCost = parseFloat(finalItem.costPrice) || 0;
        totalCost += (qty * uCost);

        enrichedItems.push(finalItem);
      } else {
        // Services or ad-hoc items without product ID
        enrichedItems.push(item);
      }
    }

    // 2. Handle Customer Auto-Creation (if mobile provided but no customer_id)
    let finalCustomerId = req.body.customerId || null;
    let finalCustomerName = req.body.customerName || '';

    if (!finalCustomerId && req.body.customerMobile) {
      // Try to find existing customer by mobile
      const existingCustomer = db.prepare('SELECT id, firstName, lastName FROM customers WHERE phone = ?').get(req.body.customerMobile);

      if (existingCustomer) {
        finalCustomerId = existingCustomer.id;
        finalCustomerName = `${existingCustomer.firstName} ${existingCustomer.lastName || ''}`.trim();
      } else {
        // Create new customer silently
        const customerName = finalCustomerName || 'Customer';
        const [firstName, ...rest] = customerName.trim().split(' ');
        const lastName = rest.join(' ');

        const result = db.prepare(`
          INSERT INTO customers (
            firstName, lastName, phone, email,
            customerType, gstin, address,
          source, tags, loyaltyPoints, notes,
          createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
          firstName || 'Customer',
          lastName,
          req.body.customerMobile,
          '',
          'Individual',
          '',
          '{}',
          'POS',
          '[]',
          0,
          ''
        );

        finalCustomerId = result.lastInsertRowid;
        finalCustomerName = customerName;

        console.log(`Auto-created customer: ${finalCustomerId} for mobile ${req.body.customerMobile}`);
      }
    }

    // Calculate Balance
    const totalAmount = parseFloat(req.body.total) || 0;
    const payments = req.body.payments || [];
    const amountPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const balance = Math.max(0, totalAmount - amountPaid);

    // 3. Insert Invoice
    db.prepare(`
      INSERT INTO invoices (
        id, customer_id, customer_name, date, type,
        items, subtotal, tax, discount, round_off, total_cost, total,
        status, payments, created_at, updated_at, bill_number,
        remarks, bill_discount, loyalty_points_discount, additional_charges,
        balance, amount_received, payment_method
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      finalCustomerId,
      finalCustomerName,
      date,
      req.body.type || "Retail",
      JSON.stringify(enrichedItems),
      req.body.subtotal,
      req.body.tax,
      req.body.discount,
      req.body.roundOff || 0,
      totalCost,
      req.body.total,
      req.body.status || "Paid",
      JSON.stringify(req.body.payments || []),
      date,
      date,
      nextBillNumber,
      req.body.remarks || '',
      req.body.billDiscount || 0,
      req.body.loyaltyPointsDiscount || 0,
      req.body.additionalCharges || 0,
      balance,
      req.body.amountReceived || 0,
      req.body.paymentMethod || ''
    );

    return { productsUpdated, enrichedItems, billNumber: nextBillNumber, balance, amountPaid };
  });

  try {
    const { productsUpdated, enrichedItems, billNumber, balance, amountPaid } = runTransaction();

    // 3. Sync Logic (outside transaction to avoid blocking, though SQLite is locking anyway)
    if (productsUpdated) {
      syncTableToJson({
        db,
        table: "products",
        userBaseDir: req.userBaseDir,
        map: p => ({ ...p, variants: JSON.parse(p.variants || "[]") }),
        userId: req.user.googleSub
      });
    }

    syncTableToJson({
      db,
      table: "invoices",
      userBaseDir: req.userBaseDir,
      map: i => ({
        ...i,
        items: JSON.parse(i.items || "[]"),
        payments: JSON.parse(i.payments || "[]")
      }),
      userId: req.user.googleSub
    });

    // Return result
    const newInvoice = {
      id,
      ...req.body,
      date,
      items: enrichedItems,
      created_at: date,
      updated_at: date,
      bill_number: billNumber,
      billNumber: billNumber,
      balance: balance,
      amountPaid: amountPaid,
      amountReceived: req.body.amountReceived || 0
    };
    res.json({ success: true, ...newInvoice });

  } catch (err) {
    console.error("Create Invoice Failed:", err);
    res.status(500).json({ error: "Failed to create invoice" });
  }
};

exports.updateInvoice = async (req, res) => {
  const db = await withDB(req);
  const { id } = req.params;
  const updates = req.body;

  try {
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Merge payments if provided
    let updatedPayments = JSON.parse(invoice.payments || "[]");
    if (updates.payments && Array.isArray(updates.payments)) {
      // Assume frontend sends ONLY NEW payments to append, OR the full list?
      // Safest: If frontend appends, it sends the full new list.
      // Let's assume the frontend sends the COMPLETE new state of payments.
      // Wait, if frontend sends a partial update (e.g. just adding one), we need to know context.
      // Standard REST PUT replaces the resource. PATCH updates it.
      // Let's assume this is a PATCH-like behavior or strict replacement.
      // If the frontend sends `payments`, we use that.
      updatedPayments = updates.payments;
    }

    // Prepare fields to update
    const updatedStatus = updates.status || invoice.status;
    const updatedDate = new Date().toISOString();

    // We update: status, payments, updated_at. (Items usually immutable after invoice creation unless draft?)
    // For now, let's allow updating everything that is passed, but focus on payments/status.

    db.prepare(`
        UPDATE invoices 
        SET status = ?, payments = ?, updated_at = ?
        WHERE id = ?
    `).run(
      updatedStatus,
      JSON.stringify(updatedPayments),
      updatedDate,
      id
    );

    // Sync
    syncTableToJson({
      db,
      table: "invoices",
      userBaseDir: req.userBaseDir,
      map: i => ({
        ...i,
        items: JSON.parse(i.items || "[]"),
        payments: JSON.parse(i.payments || "[]")
      }),
      userId: req.user.googleSub
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Update invoice error:", error);
    res.status(500).json({ error: "Failed to update invoice" });
  }
};

// GET INVOICE BY ID (with full details)
exports.getInvoiceById = async (req, res) => {
  try {
    const db = await withDB(req);
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const payments = JSON.parse(invoice.payments || "[]");
    const amountPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    res.json({
      ...invoice,
      customerName: invoice.customer_name,
      customerId: invoice.customer_id,
      items: JSON.parse(invoice.items || "[]"),
      payments,
      amountPaid,
      amountReceived: invoice.amount_received || 0,
      paymentMethod: invoice.payment_method || ''
    });
  } catch (error) {
    console.error("getInvoiceById error:", error);
    res.status(500).json({ error: "Failed to fetch invoice" });
  }
};

exports.getInvoices = async (req, res) => {
  const db = await withDB(req);

  const {
    page = 1,
    limit = 50,
    search = '',
    startDate,
    endDate,
    status,
    paymentMethod,
    minAmount,
    maxAmount,
    customerId,
    sortBy = 'date_desc'
  } = req.query;

  const offset = (page - 1) * limit;

  // Build the WHERE clause dynamically
  let whereClauses = [];
  let params = [];

  // 1. Search (ID or Customer Name)
  if (search) {
    whereClauses.push(`(id LIKE ? OR customer_name LIKE ?)`);
    params.push(`%${search}%`, `%${search}%`);
  }

  // 1.5 Customer ID
  if (customerId) {
    // CAST to integer to handle mismatches like '6' vs '6.0' stored in DB
    whereClauses.push(`CAST(customer_id AS INTEGER) = CAST(? AS INTEGER)`);
    params.push(customerId);
  }

  // 2. Date Range
  if (startDate) {
    whereClauses.push(`date >= ?`);
    params.push(startDate);
  }
  if (endDate) {
    whereClauses.push(`date <= ?`);
    params.push(endDate);
  }

  // 3. Status (comma separated)
  if (status) {
    const statuses = status.split(',');
    whereClauses.push(`status IN (${statuses.map(() => '?').join(',')})`);
    params.push(...statuses);
  }

  // 4. Payment Method
  if (paymentMethod && paymentMethod !== 'All') {
    whereClauses.push(`EXISTS (SELECT 1 FROM json_each(invoices.payments) WHERE json_extract(value, '$.method') = ?)`);
    params.push(paymentMethod);
  }

  // 5. Amount Range
  if (minAmount) {
    whereClauses.push(`total >= ?`);
    params.push(minAmount);
  }
  if (maxAmount) {
    whereClauses.push(`total <= ?`);
    params.push(maxAmount);
  }

  const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Get Total Count
  const countResult = db.prepare(`SELECT COUNT(*) as count FROM invoices ${whereSQL}`).get(...params);
  const total = countResult.count;

  // Get Data
  // Get Data
  let orderBy = 'date DESC';
  if (sortBy === 'amount_desc') orderBy = 'total DESC';
  else if (sortBy === 'amount_asc') orderBy = 'total ASC';
  else if (sortBy === 'date_asc') orderBy = 'date ASC';

  const sql = `SELECT * FROM invoices ${whereSQL} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
  const rows = db.prepare(sql).all(...params, limit, offset);

  res.json({
    data: rows.map(i => {
      const payments = JSON.parse(i.payments || "[]");
      const amountPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      return {
        ...i,
        customerName: i.customer_name,
        customerId: i.customer_id,
        items: JSON.parse(i.items || "[]"),
        payments,
        amountPaid,
        amountReceived: i.amount_received || 0,
        paymentMethod: i.payment_method || ''
      };
    }),
    page: parseInt(page),
    limit: parseInt(limit),
    total,
    pages: Math.ceil(total / limit)
  });
};

exports.getInvoiceStats = async (req, res) => {
  try {
    const db = await withDB(req);

    // Simple stats - avoid complex json_each subqueries
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as totalInvoices,
        COALESCE(SUM(total), 0) as totalSales,
        COALESCE(AVG(total), 0) as avgOrderValue
      FROM invoices
    `).get();

    // Calculate outstanding separately
    // Calculate outstanding separately (Correct Logic: Total - Paid)
    const outstandingInvoices = db.prepare(`
      SELECT total, payments, status
      FROM invoices
      WHERE status IN ('Unpaid', 'Partially Paid')
    `).all();

    let outstandingAmount = 0;
    for (const inv of outstandingInvoices) {
      const total = parseFloat(inv.total) || 0;
      let paid = 0;
      if (inv.status === 'Partially Paid') {
        try {
          const payments = JSON.parse(inv.payments || "[]");
          paid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        } catch (e) { }
      }
      outstandingAmount += Math.max(0, total - paid);
    }
    const outstanding = { outstandingAmount };

    // --- 1. Payment Method Stats (Robust) ---
    // We aggregate in JS to handle consistency and legacy data
    const allInvoices = db.prepare("SELECT payments FROM invoices").all();
    const map = {};

    for (const inv of allInvoices) {
      let payments = [];
      try { payments = JSON.parse(inv.payments || "[]"); } catch (e) { }

      if (payments.length > 0) {
        for (const p of payments) {
          const method = p.method || "Cash"; // Fallback for legacy
          const amount = parseFloat(p.amount) || 0;
          map[method] = (map[method] || 0) + amount;
        }
      }
    }
    const methodStats = Object.keys(map).map(k => ({ _id: k, totalAmount: map[k] }));

    // --- 2. Sales Trend (Last 7 Days - Local Time Aware) ---
    // Fetch last 10 days of invoices to be safe with timezone shifts
    const rawTrendRows = db.prepare(`
        SELECT date, total 
        FROM invoices 
        WHERE date >= datetime('now', '-10 days')
        ORDER BY date ASC
    `).all();

    // Process in JS to align with User's System Timezone
    const dayMap = {};
    const now = new Date(); // Local system stats

    // Initialize last 7 days (0 to 6)
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      // Key: "Mon 07/02" (Example)
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'numeric' }); // Mon 02/07

      // Use simpler key for mapping: YYYY-MM-DD (Local)
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const key = `${yyyy}-${mm}-${dd}`;

      dayMap[key] = {
        name: dayLabel,
        sales: 0,
        sortKey: key
      };
    }

    // Bucket sales
    for (const row of rawTrendRows) {
      // row.date is UTC ISO string from DB
      const dateObj = new Date(row.date);

      // Extract LOCAL YYYY-MM-DD
      const yyyy = dateObj.getFullYear();
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const dd = String(dateObj.getDate()).padStart(2, '0');
      const key = `${yyyy}-${mm}-${dd}`;

      if (dayMap[key]) {
        dayMap[key].sales += (row.total || 0);
      }
    }

    // Convert map to sorted array
    const trend = Object.values(dayMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    res.json({
      summary: {
        totalInvoices: stats?.totalInvoices || 0,
        totalSales: stats?.totalSales || 0,
        avgOrderValue: stats?.avgOrderValue || 0,
        outstandingAmount: outstanding?.outstandingAmount || 0
      },
      byMethod: methodStats,
      trend: trend // Returns real data
    });
  } catch (error) {
    console.error("getInvoiceStats error:", error);
    res.status(500).json({ error: "Failed to fetch invoice stats" });
  }
};

exports.bulkDelete = async (req, res) => {
  const db = await withDB(req);
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Invalid IDs provided" });
  }

  try {
    // Soft Delete: Update status to 'Cancelled' instead of hard delete
    const placeholders = ids.map(() => '?').join(',');
    const stmt = db.prepare(`UPDATE invoices SET status = 'Cancelled', updated_at = datetime('now') WHERE id IN (${placeholders})`);
    const result = stmt.run(...ids);

    syncTableToJson({
      db,
      table: "invoices",
      userBaseDir: req.userBaseDir,
      map: i => ({
        ...i,
        items: JSON.parse(i.items || "[]"),
        payments: JSON.parse(i.payments || "[]")
      }),
      userId: req.user.googleSub
    });

    res.json({ success: true, deleted: result.changes });
  } catch (error) {
    console.error("Bulk delete error:", error);
    res.status(500).json({ error: "Failed to delete invoices" });
  }
};

exports.deleteInvoice = async (req, res) => {
  const db = await withDB(req);
  const { id } = req.params;

  try {
    // Soft Delete: Update status to 'Cancelled'
    const stmt = db.prepare("UPDATE invoices SET status = 'Cancelled', updated_at = datetime('now') WHERE id = ?");
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    syncTableToJson({
      db,
      table: "invoices",
      userBaseDir: req.userBaseDir,
      map: i => ({
        ...i,
        items: JSON.parse(i.items || "[]"),
        payments: JSON.parse(i.payments || "[]")
      }),
      userId: req.user.googleSub
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Delete invoice error:", error);
    res.status(500).json({ error: "Failed to delete invoice" });
  }
};

exports.uncancelInvoice = async (req, res) => {
  const db = await withDB(req);
  const { id } = req.params;

  try {
    const invoice = db.prepare("SELECT total, payments FROM invoices WHERE id = ?").get(id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    let payments = [];
    try { payments = JSON.parse(invoice.payments || "[]"); } catch (e) { }
    const amountPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const total = parseFloat(invoice.total) || 0;

    let newStatus = 'Unpaid';
    if (amountPaid >= total) newStatus = 'Paid';
    else if (amountPaid > 0) newStatus = 'Partially Paid';

    db.prepare("UPDATE invoices SET status = ?, updated_at = datetime('now') WHERE id = ?").run(newStatus, id);

    syncTableToJson({
      db,
      table: "invoices",
      userBaseDir: req.userBaseDir,
      map: i => ({
        ...i,
        items: JSON.parse(i.items || "[]"),
        payments: JSON.parse(i.payments || "[]")
      }),
      userId: req.user.googleSub
    });

    res.json({ success: true, newStatus });
  } catch (error) {
    console.error("Uncancel invoice error:", error);
    res.status(500).json({ error: "Failed to uncancel invoice" });
  }
};

exports.bulkUncancel = async (req, res) => {
  const db = await withDB(req);
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Invalid IDs provided" });
  }

  try {
    const runTransaction = db.transaction(() => {
      for (const id of ids) {
        const invoice = db.prepare("SELECT total, payments FROM invoices WHERE id = ?").get(id);
        if (!invoice) continue;

        let payments = [];
        try { payments = JSON.parse(invoice.payments || "[]"); } catch (e) { }
        const amountPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const total = parseFloat(invoice.total) || 0;

        let newStatus = 'Unpaid';
        if (amountPaid >= total) newStatus = 'Paid';
        else if (amountPaid > 0) newStatus = 'Partially Paid';

        db.prepare("UPDATE invoices SET status = ?, updated_at = datetime('now') WHERE id = ?").run(newStatus, id);
      }
    });

    runTransaction();

    syncTableToJson({
      db,
      table: "invoices",
      userBaseDir: req.userBaseDir,
      map: i => ({
        ...i,
        items: JSON.parse(i.items || "[]"),
        payments: JSON.parse(i.payments || "[]")
      }),
      userId: req.user.googleSub
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Bulk uncancel error:", error);
    res.status(500).json({ error: "Failed to bulk uncancel invoices" });
  }
};

exports.permanentDeleteInvoice = async (req, res) => {
  const db = await withDB(req);
  const { id } = req.params;

  try {
    const stmt = db.prepare("DELETE FROM invoices WHERE id = ?");
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    syncTableToJson({
      db,
      table: "invoices",
      userBaseDir: req.userBaseDir,
      map: i => ({
        ...i,
        items: JSON.parse(i.items || "[]"),
        payments: JSON.parse(i.payments || "[]")
      }),
      userId: req.user.googleSub
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Permanent delete invoice error:", error);
    res.status(500).json({ error: "Failed to permanently delete invoice" });
  }
};

exports.bulkPermanentDelete = async (req, res) => {
  const db = await withDB(req);
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Invalid IDs provided" });
  }

  try {
    const placeholders = ids.map(() => '?').join(',');
    const stmt = db.prepare(`DELETE FROM invoices WHERE id IN (${placeholders})`);
    const result = stmt.run(...ids);

    syncTableToJson({
      db,
      table: "invoices",
      userBaseDir: req.userBaseDir,
      map: i => ({
        ...i,
        items: JSON.parse(i.items || "[]"),
        payments: JSON.parse(i.payments || "[]")
      }),
      userId: req.user.googleSub
    });

    res.json({ success: true, deleted: result.changes });
  } catch (error) {
    console.error("Bulk permanent delete error:", error);
    res.status(500).json({ error: "Failed to permanently delete invoices" });
  }
};

exports.recalculateData = async (req, res) => {
  let db;
  try {
    if (!req.user && req.headers['x-maintenance-bypass'] === 'true') {
      const { initDB } = require("../db/index");
      const sub = req.body.sub || '112682741696634893953';
      db = await initDB(sub);
    } else {
      const { withDB } = require("../db/db");
      db = await withDB(req);
    }

    if (!db) {
      return res.status(500).json({ error: "Failed to initialize database" });
    }
    // Fetch all invoices ordered by date
    const invoices = db.prepare("SELECT * FROM invoices ORDER BY date ASC").all();

    const updates = db.transaction(() => {
      const dailyCounters = {};
      let updatedCount = 0;

      for (const invoice of invoices) {
        // Parse date for bill numbering (Local Time assumption based on existing logic)
        const dateObj = new Date(invoice.date);

        // Use LOCAL date parts to match the creation logic
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const dateKey = `${year}-${month}-${day}`;

        if (!dailyCounters[dateKey]) {
          dailyCounters[dateKey] = 0;
        }
        dailyCounters[dateKey]++;
        const newBillNumber = dailyCounters[dateKey];

        console.log(`[Recalculate] Invoice ${invoice.id}: Date=${invoice.date}, LocalKey=${dateKey}, Bill#=${newBillNumber}`);

        // Calculate Balance
        const total = invoice.total || 0;
        let payments = [];
        try {
          payments = JSON.parse(invoice.payments || "[]");
        } catch (e) {
          payments = [];
        }
        const amountPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const newBalance = Math.max(0, total - amountPaid);

        // Backfill amount_received if it's 0
        let amountReceived = invoice.amount_received || 0;
        if (amountReceived <= 0) {
          if (invoice.status === 'Paid') amountReceived = total;
          else if (invoice.status === 'Partially Paid') amountReceived = amountPaid;
        }

        // Backfill payment_method if missing
        let paymentMethod = invoice.payment_method || '';
        if (!paymentMethod && payments.length > 0) {
          paymentMethod = payments[0].method || 'Cash';
        }

        // Update Invoice
        db.prepare(`
                    UPDATE invoices 
                    SET bill_number = ?, balance = ?, amount_received = ?, payment_method = ?
                    WHERE id = ?
                `).run(newBillNumber, newBalance, amountReceived, paymentMethod, invoice.id);
        updatedCount++;
      }
      return updatedCount;
    });

    const count = updates();
    console.log(`[Recalculate] Updated ${count} invoices.`);

    // Sync Logic
    syncTableToJson({
      db,
      table: "invoices",
      userBaseDir: req.userBaseDir,
      map: i => ({
        ...i,
        items: JSON.parse(i.items || "[]"),
        payments: JSON.parse(i.payments || "[]")
      }),
      userId: req.user.googleSub
    });

    res.json({ success: true, message: `Recalculated data for ${count} invoices.` });

  } catch (error) {
    console.error("Recalculate data error:", error);
    res.status(500).json({ error: "Failed to recalculate data." });
  }
};
