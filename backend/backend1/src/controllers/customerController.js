const { withDB } = require("../db/db");
const { syncTableToJson } = require("../db/syncToJson");

// ------------------------------------
// CREATE CUSTOMER
// ------------------------------------
exports.createCustomer = async (req, res, next) => {
  try {
    const db = await withDB(req);

    const {
      fullName,
      phone,
      email = "",
      customerType = "Individual",
      gstin = "",
      address = {},
      source = "Walk-in",
      loyaltyPoints = 0,
      notes = "",
    } = req.body;

    // Validate phone
    if (!phone || phone.trim() === "") {
      return res.status(400).json({ message: "Phone number is required" });
    }

    // Check for duplicate phone
    const existingCustomer = db.prepare("SELECT id FROM customers WHERE phone = ?").get(phone);
    if (existingCustomer) {
      return res.status(409).json({ message: "Customer with this phone number already exists", customerId: existingCustomer.id });
    }

    const [firstName, ...rest] = (fullName || "").trim().split(" ");
    const lastName = rest.join(" ");

    const result = db.prepare(`
      INSERT INTO customers(
      firstName, lastName, phone, email,
      customerType, gstin, address,
      source, tags, loyaltyPoints, notes,
      createdAt
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      firstName || "Customer",
      lastName,
      phone,
      email,
      customerType,
      gstin,
      JSON.stringify(address),
      source,
      JSON.stringify(tags),
      loyaltyPoints,
      notes
    );

    // Get the newly created customer
    const newCustomer = db.prepare(`SELECT * FROM customers WHERE id = ? `).get(result.lastInsertRowid);

    // Format the customer for response
    const formattedCustomer = {
      address: JSON.parse(newCustomer.address || "{}"),
      tags: JSON.parse(newCustomer.tags || "[]"),
      fullName: `${newCustomer.firstName} ${newCustomer.lastName} `.trim()
    };

    // 🔄 AUTO SYNC
    syncTableToJson({
      db,
      table: "customers",
      userBaseDir: req.userBaseDir,
      map: c => ({
        address: JSON.parse(c.address || "{}"),
        tags: JSON.parse(c.tags || "[]"),
        fullName: `${c.firstName} ${c.lastName} `.trim()
      }),
      userId: req.user.googleSub
    });

    res.status(201).json(formattedCustomer);
  } catch (error) {
    console.error('Error in createCustomer:', error);
    next(error);
  }
};
// GET ALL CUSTOMERS
// ------------------------------------
exports.getCustomers = async (req, res, next) => {
  try {
    const db = await withDB(req);

    const rows = db.prepare(`
      SELECT c.*,
      (SELECT COUNT(*) FROM invoices WHERE customer_id = c.id) as totalVisits,
        (SELECT COALESCE(SUM(total), 0) FROM invoices WHERE customer_id = c.id) as totalSpent,
          (
            SELECT COALESCE(SUM(
              total - COALESCE((
                SELECT SUM(CAST(json_extract(value, '$.amount') AS REAL))
              FROM json_each(invoices.payments)
              ), 0)
            ), 0)
          FROM invoices
          WHERE customer_id = c.id AND status != 'Paid'
        ) as due
      FROM customers c
      ORDER BY c.createdAt DESC
    `).all();

    const customers = rows.map(c => ({
      ...c,
      tags: c.tags ? JSON.parse(c.tags) : [],
      address: c.address ? JSON.parse(c.address) : {},
      fullName: `${c.firstName} ${c.lastName || ""} `.trim(),
    }));

    res.json(customers);
  } catch (error) {
    console.error('Error in getCustomers:', error);
    next(error);
  }
};

// ------------------------------------
// DELETE CUSTOMER
// ------------------------------------
exports.deleteCustomer = async (req, res, next) => {
  try {
    const db = await withDB(req);
    db.prepare(`DELETE FROM customers WHERE id = ? `).run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error in deleteCustomer:', error);
    next(error);
  }
};

// ------------------------------------
// SEARCH DUPLICATES
// ------------------------------------
exports.searchDuplicates = async (req, res, next) => {
  try {
    const { query } = req.query;
    if (!query) return res.json([]);

    const db = await withDB(req);

    const rows = db.prepare(`
      SELECT *
      FROM customers
      WHERE phone LIKE ?
      OR email LIKE ?
        LIMIT 5
          `).all(` % ${query}% `, ` % ${query}% `);

    const results = rows.map(c => ({
      ...c,
      tags: c.tags ? JSON.parse(c.tags) : [],
      address: c.address ? JSON.parse(c.address) : {},
      fullName: `${c.firstName} ${c.lastName || ""} `.trim(),
    }));

    res.json(results);
  } catch (error) {
    console.error('Error in searchDuplicates:', error);
    next(error);
  }
};

// ------------------------------------
// GET CUSTOMER BY ID
// ------------------------------------
exports.getCustomerById = async (req, res, next) => {
  try {
    const db = await withDB(req);
    const customer = db.prepare(`
      SELECT c.*,
      (SELECT COUNT(*) FROM invoices WHERE customer_id = c.id) as totalVisits,
        (SELECT COALESCE(SUM(total), 0) FROM invoices WHERE customer_id = c.id) as totalSpent,
          (
            SELECT COALESCE(SUM(
              total - COALESCE((
                SELECT SUM(CAST(json_extract(value, '$.amount') AS REAL))
              FROM json_each(invoices.payments)
              ), 0)
            ), 0)
          FROM invoices
          WHERE customer_id = c.id AND status != 'Paid'
        ) as due
      FROM customers c
      WHERE c.id = ?
      `).get(req.params.id);

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const formattedCustomer = {
      ...customer,
      tags: customer.tags ? JSON.parse(customer.tags) : [],
      address: customer.address ? JSON.parse(customer.address) : {},
      fullName: `${customer.firstName} ${customer.lastName || ""} `.trim(),
    };

    res.json(formattedCustomer);
  } catch (error) {
    console.error('Error in getCustomerById:', error);
    next(error);
  }
};

// ------------------------------------
// UPDATE CUSTOMER
// ------------------------------------
exports.updateCustomer = async (req, res, next) => {
  try {
    const db = await withDB(req);
    const {
      fullName,
      phone,
      email = "",
      customerType = "Individual",
      gstin = "",
      address = {},
      source = "Walk-in",
      tags = [],
      loyaltyPoints = 0,
      notes = "",
    } = req.body;

    const [firstName, ...rest] = fullName.trim().split(" ");
    const lastName = rest.join(" ");

    db.prepare(`
      UPDATE customers
      SET firstName = ?, lastName = ?, phone = ?, email = ?,
      customerType = ?, gstin = ?, address = ?,
      source = ?, tags = ?, loyaltyPoints = ?, notes = ?
        WHERE id = ?
          `).run(
      firstName,
      lastName,
      phone,
      email,
      customerType,
      gstin,
      JSON.stringify(address),
      source,
      JSON.stringify(tags),
      loyaltyPoints,
      notes,
      req.params.id
    );

    // Get the updated customer
    const updatedCustomer = db.prepare(`
      SELECT c.*,
      (SELECT COUNT(*) FROM invoices WHERE customer_id = c.id) as totalVisits,
        (SELECT COALESCE(SUM(total), 0) FROM invoices WHERE customer_id = c.id) as totalSpent,
          (
            SELECT COALESCE(SUM(
              total - COALESCE((
                SELECT SUM(CAST(json_extract(value, '$.amount') AS REAL))
              FROM json_each(invoices.payments)
              ), 0)
            ), 0)
          FROM invoices
          WHERE customer_id = c.id AND status != 'Paid'
        ) as due
      FROM customers c
      WHERE c.id = ?
      `).get(req.params.id);

    const formattedCustomer = {
      ...updatedCustomer,
      address: JSON.parse(updatedCustomer.address || "{}"),
      tags: JSON.parse(updatedCustomer.tags || "[]"),
      fullName: `${updatedCustomer.firstName} ${updatedCustomer.lastName} `.trim()
    };

    // 🔄 AUTO SYNC
    syncTableToJson({
      db,
      table: "customers",
      userBaseDir: req.userBaseDir,
      map: c => ({
        ...c,
        address: JSON.parse(c.address || "{}"),
        tags: JSON.parse(c.tags || "[]"),
        fullName: `${c.firstName} ${c.lastName} `.trim()
      }),
      userId: req.user.googleSub
    });

    res.json(formattedCustomer);
  } catch (error) {
    console.error('Error in updateCustomer:', error);
    next(error);
  }
};

// ------------------------------------
// GET CUSTOMER BY MOBILE
// ------------------------------------
exports.getCustomerByMobile = async (req, res, next) => {
  try {
    const db = await withDB(req);
    const { mobile } = req.params;

    if (!mobile) {
      return res.status(400).json({ message: "Mobile number is required" });
    }

    const customer = db.prepare(`
      SELECT c.*,
      (SELECT COUNT(*) FROM invoices WHERE customer_id = c.id) as totalVisits,
        (SELECT COALESCE(SUM(total), 0) FROM invoices WHERE customer_id = c.id) as totalSpent,
          (
            SELECT COALESCE(SUM(
              total - COALESCE((
                SELECT SUM(CAST(json_extract(value, '$.amount') AS REAL))
              FROM json_each(invoices.payments)
              ), 0)
            ), 0)
          FROM invoices
          WHERE customer_id = c.id AND status != 'Paid'
        ) as due
      FROM customers c
      WHERE c.phone = ?
      `).get(mobile);

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const formattedCustomer = {
      tags: customer.tags ? JSON.parse(customer.tags) : [],
      address: customer.address ? JSON.parse(customer.address) : {},
      fullName: `${customer.firstName} ${customer.lastName || ""} `.trim()
    };

    res.json(formattedCustomer);
  } catch (error) {
    console.error('Error in getCustomerByMobile:', error);
    next(error);
  }
};

// ------------------------------------
// FIND OR CREATE CUSTOMER (Silent)
// ------------------------------------
exports.findOrCreateCustomer = async (req, res, next) => {
  try {
    const db = await withDB(req);
    const {
      mobile,
      name = "",
      gstin = "",
      address = {},
      source = "POS"
    } = req.body;

    if (!mobile || mobile.trim() === "") {
      return res.status(400).json({ message: "Mobile number is required" });
    }

    // Try to find existing customer
    const existingCustomer = db.prepare("SELECT * FROM customers WHERE phone = ?").get(mobile);

    if (existingCustomer) {
      const formattedCustomer = {
        ...existingCustomer,
        tags: JSON.parse(existingCustomer.tags || "[]"),
        address: JSON.parse(existingCustomer.address || "{}"),
        fullName: `${existingCustomer.firstName} ${existingCustomer.lastName || ""}`.trim()
      };
      return res.json({ ...formattedCustomer, isNew: false });
    }

    // Create new customer
    const [firstName, ...rest] = (name || "").trim().split(" ");
    const lastName = rest.join(" ");

    const result = db.prepare(`
      INSERT INTO customers (
        firstName, lastName, phone, email,
        customerType, gstin, address,
        source, tags, loyaltyPoints, notes,
        createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      firstName || "Customer",
      lastName,
      mobile,
      "",
      "Individual",
      gstin,
      JSON.stringify(address),
      source,
      JSON.stringify([]),
      0,
      ""
    );

    const newCustomer = db.prepare("SELECT * FROM customers WHERE id = ?").get(result.lastInsertRowid);

    const formattedCustomer = {
      ...newCustomer,
      tags: JSON.parse(newCustomer.tags || "[]"),
      address: JSON.parse(newCustomer.address || "{}"),
      fullName: `${newCustomer.firstName} ${newCustomer.lastName}`.trim()
    };

    // 🔄 AUTO SYNC
    syncTableToJson({
      db,
      table: "customers",
      userBaseDir: req.userBaseDir,
      map: c => ({
        address: JSON.parse(c.address || "{}"),
        tags: JSON.parse(c.tags || "[]"),
        fullName: `${c.firstName} ${c.lastName}`.trim()
      }),
      userId: req.user.googleSub
    });

    res.status(201).json({ ...formattedCustomer, isNew: true });
  } catch (error) {
    console.error('Error in findOrCreateCustomer:', error);
    next(error);
  }
};
