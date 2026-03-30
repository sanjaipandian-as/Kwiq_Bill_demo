const { withDB } = require("../db/db");
const { syncTableToJson } = require("../db/syncToJson");
const { v4: uuid } = require("uuid");

exports.createExpense = async (req, res) => {
  const db = await withDB(req);
  const id = uuid();
  const date = req.body.date || new Date().toISOString();

  const newExpense = {
    id,
    title: req.body.title,
    amount: req.body.amount,
    category: req.body.category,
    date,
    paymentMethod: req.body.paymentMethod || "Cash",
    tags: req.body.tags || [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.prepare(`
    INSERT INTO expenses (
      id, title, amount, category, date,
      payment_method, tags, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    newExpense.id,
    newExpense.title,
    newExpense.amount,
    newExpense.category,
    newExpense.date,
    newExpense.paymentMethod,
    JSON.stringify(newExpense.tags),
    newExpense.created_at,
    newExpense.updated_at
  );

  // 🔄 AUTO JSON SYNC
  syncTableToJson({
    db,
    table: "expenses",
    userBaseDir: req.userBaseDir,
    map: e => ({
      ...e,
      tags: JSON.parse(e.tags || "[]")
    }),
    userId: req.user.googleSub
  });

  res.json({ success: true, ...newExpense });
};

exports.getExpenses = async (req, res) => {
  const db = await withDB(req);
  // Get expenses with aggregated adjustments
  const rows = db.prepare(`
    SELECT e.*, COALESCE(SUM(a.delta_amount), 0) as adjustment_total
    FROM expenses e
    LEFT JOIN expense_adjustments a ON e.id = a.expense_id
    GROUP BY e.id
  `).all();

  res.json(
    rows.map(e => ({
      ...e,
      // The stored 'amount' is the original. The effective amount is original + adjustments.
      amount: (e.amount || 0) + (e.adjustment_total || 0),
      originalAmount: e.amount,
      tags: JSON.parse(e.tags || "[]")
    }))
  );
};

exports.updateExpense = async (req, res) => {
  const db = await withDB(req);
  const { id } = req.params;
  const { title, category, date, paymentMethod, tags, amount, description } = req.body;

  // 1. Get current state (Original + Adjustments)
  const current = db.prepare(`
    SELECT e.*, COALESCE(SUM(a.delta_amount), 0) as adjustment_total
    FROM expenses e
    LEFT JOIN expense_adjustments a ON e.id = a.expense_id
    WHERE e.id = ?
    GROUP BY e.id
  `).get(id);

  if (!current) {
    return res.status(404).json({ success: false, message: "Expense not found" });
  }

  const currentTotal = (current.amount || 0) + (current.adjustment_total || 0);
  const newAmount = parseFloat(amount);
  const delta = newAmount - currentTotal;

  // 2. Insert Adjustment for Amount Change
  if (Math.abs(delta) > 0.001) { // Floating point check
    const adjustmentId = uuid();
    db.prepare(`
      INSERT INTO expense_adjustments (id, expense_id, delta_amount, reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      adjustmentId,
      id,
      delta,
      "Update via Edit",
      new Date().toISOString(),
      new Date().toISOString()
    );
  }

  // 3. Update Metadata (Title, Category, etc.) - Keeps 'amount' unchanged!
  // Note: We are allowing metadata overwrites for now as per plan, but strictly auditing amount.
  db.prepare(`
    UPDATE expenses
    SET title = ?, category = ?, date = ?, payment_method = ?, tags = ?, updated_at = ?
    WHERE id = ?
  `).run(
    title,
    category,
    date,
    paymentMethod,
    JSON.stringify(tags || []),
    new Date().toISOString(),
    id
  );

  // 4. Return Updated View
  const updated = db.prepare(`
    SELECT e.*, COALESCE(SUM(a.delta_amount), 0) as adjustment_total
    FROM expenses e
    LEFT JOIN expense_adjustments a ON e.id = a.expense_id
    WHERE e.id = ?
    GROUP BY e.id
  `).get(id);

  const response = {
    ...updated,
    amount: (updated.amount || 0) + (updated.adjustment_total || 0),
    tags: JSON.parse(updated.tags || "[]"),
    // return delta info for sync event trigger
    _syncInfo: {
      delta,
      reason: "Update via Edit"
    }
  };

  // 🔄 AUTO JSON SYNC
  syncTableToJson({
    db,
    table: "expenses",
    userBaseDir: req.userBaseDir,
    map: e => ({ ...e, tags: JSON.parse(e.tags || "[]") }),
    userId: req.user.googleSub
  });

  res.json({ success: true, ...response });
};

exports.uploadReceipt = async (req, res) => {
  try {
    const db = await withDB(req);
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const base64 = req.file.buffer.toString("base64");
    const dataUrl = `data:${req.file.mimetype};base64,${base64}`;

    db.prepare(`UPDATE expenses SET receipt_url = ? WHERE id = ?`).run(dataUrl, id);

    syncTableToJson({
      db,
      table: "expenses",
      userBaseDir: req.userBaseDir,
      map: e => ({ ...e, tags: JSON.parse(e.tags || "[]") }),
      userId: req.user.googleSub
    });

    res.json({ success: true, receiptUrl: dataUrl });
  } catch (err) {
    console.error("Receipt upload error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteExpense = async (req, res) => {
  const db = await withDB(req);
  const { id } = req.params;

  db.prepare('DELETE FROM expense_adjustments WHERE expense_id = ?').run(id);
  db.prepare('DELETE FROM expenses WHERE id = ?').run(id);

  syncTableToJson({
    db,
    table: "expenses",
    userBaseDir: req.userBaseDir,
    map: e => ({ ...e, tags: JSON.parse(e.tags || "[]") }),
    userId: req.user.googleSub
  });

  res.json({ success: true, message: "Expense deleted" });
};

exports.bulkUpdateExpenses = async (req, res) => {
  const db = await withDB(req);
  const { ids, updates } = req.body;

  if (!ids || !ids.length) return res.json({ success: true });

  const { category, paymentMethod } = updates;
  const updateArr = [];
  let queryStr = "UPDATE expenses SET updated_at = ?";
  updateArr.push(new Date().toISOString());

  if (category !== undefined) {
    queryStr += ", category = ?";
    updateArr.push(category);
  }
  if (paymentMethod !== undefined) {
    queryStr += ", payment_method = ?";
    updateArr.push(paymentMethod);
  }

  const placeholders = ids.map(() => '?').join(',');
  queryStr += ` WHERE id IN (${placeholders})`;

  try {
    db.prepare(queryStr).run(...updateArr, ...ids);
    syncTableToJson({
      db,
      table: "expenses",
      userBaseDir: req.userBaseDir,
      map: e => ({ ...e, tags: JSON.parse(e.tags || "[]") }),
      userId: req.user.googleSub
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.bulkDeleteExpenses = async (req, res) => {
  const db = await withDB(req);
  const { ids } = req.body;

  if (!ids || !ids.length) return res.json({ success: true });

  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`DELETE FROM expense_adjustments WHERE expense_id IN (${placeholders})`).run(...ids);
  db.prepare(`DELETE FROM expenses WHERE id IN (${placeholders})`).run(...ids);

  syncTableToJson({
    db,
    table: "expenses",
    userBaseDir: req.userBaseDir,
    map: e => ({ ...e, tags: JSON.parse(e.tags || "[]") }),
    userId: req.user.googleSub
  });

  res.json({ success: true });
};
