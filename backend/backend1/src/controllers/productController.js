const { withDB } = require("../db/db");
const { syncTableToJson } = require("../db/syncToJson");
const { v4: uuid } = require("uuid");

/**
 * Normalizes variant data to strict format:
 * { options: [string], price: number, stock: number }
 * 
 * Rules:
 * - Drops variants with no valid option label
 * - Converts legacy {option: "val"} or {name: "val"} to {options: ["val"]}
 * - Ensures options is always an array of strings
 * - Price/Stock are coerced to numbers
 */
const normalizeVariants = (rawVariants) => {
  if (!Array.isArray(rawVariants)) return [];

  return rawVariants
    .map(v => {
      let options = [];

      // 1. Handle "options" array (PREFERRED)
      if (Array.isArray(v.options)) {
        options = v.options.map(o => String(o).trim()).filter(o => o.length > 0);
      }
      // 2. Handle legacy "option" (single string)
      else if (v.option && typeof v.option === "string") {
        const trimmed = v.option.trim();
        if (trimmed) options = [trimmed];
      }
      // 3. Handle legacy "name" (single string)
      else if (v.name && typeof v.name === "string") {
        const trimmed = v.name.trim();
        if (trimmed) options = [trimmed];
      }

      // If we still have no options, this variant is invalid
      if (options.length === 0) return null;

      return {
        id: v.id || uuid(), // Ensure ID exists for precise tracking
        options, // Strict: always array of strings
        price: parseFloat(v.price) || 0,
        stock: parseInt(v.stock) || 0,
        costPrice: parseFloat(v.costPrice) || 0
      };
    })
    .filter(Boolean); // Drop invalid forms
};

exports.createProduct = async (req, res, next) => {
  try {
    const db = await withDB(req);
    const id = uuid();
    const now = new Date().toISOString();

    // 1. Validate Mandatory SKU
    if (!req.body.sku || !req.body.sku.trim()) {
      return res.status(400).json({ error: "Product SKU is mandatory." });
    }

    // 2. Prepare Data
    let { name, sku, category, brand, unit, taxRate, description, variants } = req.body;
    let price = parseFloat(req.body.price) || 0;
    let stock = parseInt(req.body.stock) || 0;
    let costPrice = parseFloat(req.body.costPrice) || 0;

    // 3. Normalize Variants
    const finalVariants = normalizeVariants(variants);

    // 4. Aggregate Product Stats from Variants (if any)
    if (finalVariants.length > 0) {
      stock = finalVariants.reduce((sum, v) => sum + v.stock, 0);
      price = Math.min(...finalVariants.map(v => v.price));
    }

    // 5. Handle isActive field
    const isActive = req.body.isActive !== undefined ? (req.body.isActive ? 1 : 0) : 1;

    db.prepare(`
      INSERT INTO products (
        id, name, sku, category, brand, price, stock, unit,
        tax_rate, variants, is_active, created_at, updated_at, cost_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      sku.trim(),
      category,
      brand || "",
      price,
      stock,
      unit || "pc",
      taxRate || 0,
      JSON.stringify(finalVariants),
      isActive,
      now,
      now,
      costPrice
    );

    // AUTO JSON SYNC
    syncTableToJson({
      db,
      table: "products",
      userBaseDir: req.userBaseDir,
      map: p => ({
        ...p,
        variants: JSON.parse(p.variants || "[]")
      }),
      userId: req.user.googleSub
    });

    // Return the created product
    const newProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.json({
      ...newProduct,
      costPrice: newProduct.cost_price,
      isActive: newProduct.is_active !== undefined ? newProduct.is_active === 1 : true,
      variants: JSON.parse(newProduct.variants || "[]")
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: "SKU already exists. Please use a unique SKU." });
    }
    console.error('Error in createProduct:', error);
    next(error);
  }
};

exports.createManyProducts = async (req, res, next) => {
  try {
    const db = await withDB(req);
    const products = req.body.products;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: "Invalid product array." });
    }

    const now = new Date().toISOString();
    let addedCount = 0;

    const insertStmt = db.prepare(`
      INSERT INTO products (
        id, name, sku, category, brand, price, stock, unit,
        tax_rate, variants, is_active, created_at, updated_at, cost_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Use transaction for massive speed boost
    const runTransaction = db.transaction((productsList) => {
      for (const p of productsList) {
        const id = uuid();
        const finalVariants = normalizeVariants(p.variants);

        // Calculate aggregations
        let stock = parseInt(p.stock) || 0;
        let price = parseFloat(p.price) || 0;

        if (finalVariants.length > 0) {
          stock = finalVariants.reduce((sum, v) => sum + v.stock, 0);
          price = Math.min(...finalVariants.map(v => v.price));
        }

        try {
          insertStmt.run(
            id,
            p.name,
            String(p.sku).trim(),
            p.category || 'Uncategorized',
            p.brand || "",
            price,
            stock,
            p.unit || "pc",
            parseFloat(p.taxRate) || 0,
            JSON.stringify(finalVariants),
            p.isActive !== undefined ? (p.isActive ? 1 : 0) : 1,
            now,
            now,
            parseFloat(p.costPrice) || 0
          );
          addedCount++;
        } catch (e) {
          // If SKU already exists or other constraint fails, safely ignore this row
          if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            console.log(`Skipped duplicate SKU: ${p.sku}`);
          } else {
            console.error(`Error inserting import row`, e);
          }
        }
      }
    });

    runTransaction(products);

    // Run JSON sync once after transaction
    if (addedCount > 0) {
      syncTableToJson({
        db,
        table: "products",
        userBaseDir: req.userBaseDir,
        map: p => ({
          ...p,
          variants: JSON.parse(p.variants || "[]")
        }),
        userId: req.user.googleSub
      });
    }

    res.json({ success: true, addedCount });
  } catch (error) {
    console.error('Error in createManyProducts:', error);
    next(error);
  }
};

exports.getProducts = async (req, res) => {
  const db = await withDB(req);

  // Auto-migration: Check for brand, cost_price, and is_active columns
  try {
    const tableInfo = db.prepare("PRAGMA table_info(products)").all();

    // Brand
    const hasBrand = tableInfo.some(c => c.name === 'brand');
    if (!hasBrand) {
      console.log("Auto-migrating schema: Adding brand column...");
      db.prepare("ALTER TABLE products ADD COLUMN brand TEXT").run();
    }

    // Cost Price
    const hasCostPrice = tableInfo.some(c => c.name === 'cost_price');
    if (!hasCostPrice) {
      console.log("Auto-migrating schema: Adding cost_price column...");
      db.prepare("ALTER TABLE products ADD COLUMN cost_price REAL DEFAULT 0").run();
    }

    // Is Active
    const hasIsActive = tableInfo.some(c => c.name === 'is_active');
    if (!hasIsActive) {
      console.log("Auto-migrating schema: Adding is_active column...");
      db.prepare("ALTER TABLE products ADD COLUMN is_active INTEGER DEFAULT 1").run();
    }
  } catch (err) {
    console.error("Schema migration error:", err);
  }

  const rows = db.prepare(`SELECT * FROM products`).all();

  res.json(
    rows.map((p, index) => {
      let variants = [];
      try {
        variants = JSON.parse(p.variants || "[]");
      } catch (e) {
        variants = [];
      }
      return {
        ...p,
        costPrice: p.cost_price,
        isActive: p.is_active !== undefined ? p.is_active === 1 : true,
        variants
      };
    })
  );
};

exports.getProductById = async (req, res) => {
  const db = await withDB(req);
  const product = db.prepare(`SELECT * FROM products WHERE id = ?`).get(req.params.id);

  if (product) {
    let variants = [];
    try {
      variants = JSON.parse(product.variants || "[]");
    } catch (e) {
      variants = [];
    }
    res.json({
      ...product,
      costPrice: product.cost_price,
      isActive: product.is_active !== undefined ? product.is_active === 1 : true,
      variants
    });
  } else {
    res.status(404).json({ error: "Product not found" });
  }
};

exports.updateStock = async (req, res, next) => {
  try {
    const db = await withDB(req);

    // Simplistic stock update - might violate variants sync if not careful
    // Ideally, we should update specific variant stock, but for now just updating total.
    // If strict variance consistency is needed, this endpoint needs detailed variant logic.
    // Assuming simple usage for now.

    db.prepare(`
      UPDATE products SET stock = stock + ?, updated_at = ?
      WHERE id = ?
    `).run(req.body.delta, new Date().toISOString(), req.params.id);

    // AUTO JSON SYNC
    syncTableToJson({
      db,
      table: "products",
      userBaseDir: req.userBaseDir,
      map: p => ({
        ...p,
        variants: JSON.parse(p.variants || "[]")
      }),
      userId: req.user.googleSub
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error in updateStock:', error);
    next(error);
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const db = await withDB(req);

    // Check if product exists first
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Helper to keep existing if undefined (partial update)
    const val = (newVal, oldVal) => newVal !== undefined ? newVal : oldVal;

    let name = val(req.body.name, existing.name);
    let sku = val(req.body.sku, existing.sku);
    let category = val(req.body.category, existing.category);
    let brand = val(req.body.brand, existing.brand);
    let unit = val(req.body.unit, existing.unit);
    let taxRate = val(req.body.taxRate, existing.tax_rate);

    // Explicitly handle numbers to avoid partial update issues
    let price = req.body.price !== undefined ? parseFloat(req.body.price) : existing.price;
    let stock = req.body.stock !== undefined ? parseInt(req.body.stock) : existing.stock;
    let costPrice = req.body.costPrice !== undefined ? parseFloat(req.body.costPrice) : (existing.cost_price || 0);

    // Variant Logic
    let finalVariants = [];

    // If variants are provided in the update, use them
    if (req.body.variants !== undefined) {
      finalVariants = normalizeVariants(req.body.variants);
    }
    // Otherwise keep existing variants safely
    else {
      try {
        finalVariants = JSON.parse(existing.variants || "[]");
      } catch (e) {
        finalVariants = [];
      }
    }

    // Re-Aggregate if variants exist (either verified existing or new)
    if (finalVariants.length > 0) {
      stock = finalVariants.reduce((sum, v) => sum + v.stock, 0);
      price = Math.min(...finalVariants.map(v => v.price));
    }

    // Handle isActive field
    let isActive;
    if (req.body.isActive !== undefined) {
      isActive = req.body.isActive ? 1 : 0;
    } else {
      isActive = existing.is_active !== undefined ? existing.is_active : 1;
    }

    const info = db.prepare(`
      UPDATE products SET 
        name = ?, sku = ?, category = ?, brand = ?, price = ?, 
        stock = ?, unit = ?, tax_rate = ?, variants = ?, is_active = ?, updated_at = ?, cost_price = ?
      WHERE id = ?
    `).run(
      name,
      sku,
      category,
      brand || "",
      price,
      stock,
      unit,
      taxRate,
      JSON.stringify(finalVariants),
      isActive,
      new Date().toISOString(),
      costPrice,
      req.params.id
    );

    // AUTO JSON SYNC
    syncTableToJson({
      db,
      table: "products",
      userBaseDir: req.userBaseDir,
      map: p => ({
        ...p,
        variants: JSON.parse(p.variants || "[]")
      }),
      userId: req.user.googleSub
    });

    // Return updated product
    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json({
      success: true,
      ...updated,
      costPrice: updated.cost_price,
      isActive: updated.is_active !== undefined ? updated.is_active === 1 : true,
      variants: JSON.parse(updated.variants || "[]")
    });
  } catch (error) {
    console.error('Error in updateProduct:', error);
    next(error);
  }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const db = await withDB(req);
    const { id } = req.params;

    const result = db.prepare('DELETE FROM products WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Product not found." });
    }

    // Fast asynchronous backup hook.
    syncTableToJson({
      db,
      table: "products",
      userBaseDir: req.userBaseDir,
      map: p => ({
        ...p,
        variants: JSON.parse(p.variants || "[]")
      }),
      userId: req.user.googleSub
    });

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error('Error in deleteProduct:', error);
    next(error);
  }
};

exports.deleteManyProducts = async (req, res, next) => {
  try {
    const db = await withDB(req);
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Invalid product ID array." });
    }

    const deleteStmt = db.prepare('DELETE FROM products WHERE id = ?');
    let deletedCount = 0;

    const runTransaction = db.transaction((idList) => {
      for (const id of idList) {
        const result = deleteStmt.run(id);
        deletedCount += result.changes;
      }
    });

    runTransaction(ids);

    if (deletedCount > 0) {
      syncTableToJson({
        db,
        table: "products",
        userBaseDir: req.userBaseDir,
        map: p => ({
          ...p,
          variants: JSON.parse(p.variants || "[]")
        }),
        userId: req.user.googleSub
      });
    }

    res.json({ success: true, deletedCount });
  } catch (error) {
    console.error('Error in deleteManyProducts:', error);
    next(error);
  }
};

exports.getProductStats = async (req, res, next) => {
  try {
    const db = await withDB(req);
    const id = req.params.id;

    // Calculate sales stats for this product from invoices
    // Note: Items are stored as JSON strings in the invoices table.
    // We need to fetch all invoices and parse items to aggregate stats.

    // Optimization: In a real app, use a dedicated analytics table or indexed json.
    const invoices = db.prepare('SELECT items, date, created_at FROM invoices').all();

    let totalSold = 0;
    let totalRevenue = 0;

    // Monthly Sales & Last Sold calculation
    let monthlySales = 0;
    let lastSold = null;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get product to fetch lastUpdated as fallback for lastRestocked
    const product = db.prepare('SELECT updated_at FROM products WHERE id = ?').get(id);
    const lastRestocked = product?.updated_at || null;

    invoices.forEach(inv => {
      try {
        const items = JSON.parse(inv.items);
        if (Array.isArray(items)) {
          const productItem = items.find(i => (i.productId === id || i.id === id || i._id === id));
          if (productItem) {
            const qty = (parseFloat(productItem.quantity) || 0);
            const rev = (parseFloat(productItem.total) || 0);

            // Prefer date field, fallback to created_at
            const invDate = new Date(inv.date || inv.created_at);

            totalSold += qty;
            totalRevenue += rev;

            // Monthly Sales
            if (invDate >= thirtyDaysAgo) {
              monthlySales += qty;
            }

            // Last Sold (find max date)
            if (!lastSold || invDate > new Date(lastSold)) {
              lastSold = invDate.toISOString();
            }
          }
        }
      } catch (e) {
        // ignore
      }
    });

    res.json({
      totalSold,
      totalRevenue,
      monthlySales,
      lastSold,
      lastRestocked,
      margin: 0
    });
  } catch (error) {
    console.error('Error in getProductStats:', error);
    next(error);
  }
};

exports.fixVariants = async (req, res, next) => {
  try {
    const db = await withDB(req);
    const products = db.prepare('SELECT id, name, variants, price, stock FROM products').all();
    let updatedCount = 0;

    const updateStmt = db.prepare(`
        UPDATE products 
        SET variants = ?, price = ?, stock = ?, updated_at = ? 
        WHERE id = ?
    `);

    const runTransaction = db.transaction(() => {
      for (const p of products) {
        let parsedVariants = [];
        try {
          parsedVariants = JSON.parse(p.variants || "[]");
        } catch (e) {
          parsedVariants = [];
        }

        // Normalize
        const normalized = normalizeVariants(parsedVariants);

        // Compare
        const originalJson = JSON.stringify(parsedVariants);
        const newJson = JSON.stringify(normalized);

        if (originalJson !== newJson) {
          let newPrice = p.price;
          let newStock = p.stock;

          if (normalized.length > 0) {
            newStock = normalized.reduce((sum, v) => sum + v.stock, 0);
            newPrice = Math.min(...normalized.map(v => v.price));
          }

          updateStmt.run(newJson, newPrice, newStock, new Date().toISOString(), p.id);
          updatedCount++;
        }
      }
    });

    runTransaction();

    // FORCE SYNC ALL
    syncTableToJson({
      db,
      table: "products",
      userBaseDir: req.userBaseDir,
      map: p => ({
        ...p,
        variants: JSON.parse(p.variants || "[]")
      }),
      userId: req.user.googleSub
    });

    res.json({ success: true, updatedCount, message: `Fixed ${updatedCount} products.` });
  } catch (error) {
    console.error('Error in fixVariants:', error);
    next(error);
  }
};

exports.migrateSchema = async (req, res, next) => {
  try {
    const db = await withDB(req);
    // Check if brand column exists
    const tableInfo = db.prepare("PRAGMA table_info(products)").all();
    const hasBrand = tableInfo.some(c => c.name === 'brand');

    if (!hasBrand) {
      console.log("Migrating schema: Adding brand column...");
      db.prepare("ALTER TABLE products ADD COLUMN brand TEXT").run();
      res.json({ success: true, message: "Added brand column to products." });
    } else {
      res.json({ success: true, message: "Schema already up to date." });
    }
  } catch (error) {
    console.error('Error in migrateSchema:', error);
    next(error);
  }
};
