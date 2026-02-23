import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Opens the physical database file on the mobile device
export const db = SQLite.openDatabaseSync('zilling.db');

// Use a flag to ensure initialization only happens once
let isInitialized = false;

export const initializeDB = () => {
  if (isInitialized) return;

  try {
    console.log("[DB] Initializing database...");
    // 1. Initial basic setup
    db.execSync('PRAGMA journal_mode = WAL;');
    db.execSync('PRAGMA foreign_keys = ON;');

    // 2. Customers Table & Migrations
    db.execSync(`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        type TEXT,
        gstin TEXT,
        address TEXT,
        source TEXT,
        tags TEXT,
        loyaltyPoints INTEGER DEFAULT 0,
        notes TEXT,
        created_at TEXT,
        updated_at TEXT
      )
    `);

    // Migration: amountPaid, opt-ins
    const custInfo = db.getAllSync(`PRAGMA table_info(customers)`);
    const custCols = custInfo.map(c => c.name);

    if (!custCols.includes('amountPaid')) {
      db.execSync(`ALTER TABLE customers ADD COLUMN amountPaid REAL DEFAULT 0;`);
    }
    if (!custCols.includes('whatsappOptIn')) {
      db.execSync(`ALTER TABLE customers ADD COLUMN whatsappOptIn INTEGER DEFAULT 0;`);
    }
    if (!custCols.includes('smsOptIn')) {
      db.execSync(`ALTER TABLE customers ADD COLUMN smsOptIn INTEGER DEFAULT 0;`);
    }
    if (!custCols.includes('outstanding')) {
      db.execSync(`ALTER TABLE customers ADD COLUMN outstanding REAL DEFAULT 0;`);
    }

    // 3. Products Table & Migrations
    db.execSync(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sku TEXT NOT NULL,
        category TEXT,
        price REAL DEFAULT 0,
        cost_price REAL DEFAULT 0,
        stock INTEGER DEFAULT 0,
        min_stock INTEGER DEFAULT 0,
        unit TEXT DEFAULT 'pc',
        tax_rate REAL DEFAULT 0,
        variants JSON DEFAULT '[]',
        variant TEXT,
        created_at TEXT,
        updated_at TEXT,
        UNIQUE(sku)
      )
    `);

    const prodInfo = db.getAllSync(`PRAGMA table_info(products)`);
    const prodCols = prodInfo.map(c => c.name);
    if (!prodCols.includes('min_stock')) {
      db.execSync(`ALTER TABLE products ADD COLUMN min_stock INTEGER DEFAULT 0;`);
    }
    if (!prodCols.includes('cost_price')) {
      db.execSync(`ALTER TABLE products ADD COLUMN cost_price REAL DEFAULT 0;`);
    }

    // 4. Invoices Table & Migrations
    db.execSync(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        customer_name TEXT,
        date TEXT,
        type TEXT,
        items JSON,
        subtotal REAL,
        tax REAL,
        discount REAL,
        total REAL,
        status TEXT,
        payments JSON,
        grossTotal REAL DEFAULT 0,
        itemDiscount REAL DEFAULT 0,
        additionalCharges REAL DEFAULT 0,
        roundOff REAL DEFAULT 0,
        amountReceived REAL DEFAULT 0,
        internalNotes TEXT,
        taxType TEXT DEFAULT 'intra',
        weekly_sequence INTEGER DEFAULT 1,
        created_at TEXT,
        updated_at TEXT
      )
    `);

    const invInfo = db.getAllSync(`PRAGMA table_info(invoices)`);
    const invCols = invInfo.map(c => c.name);
    const missingInvCols = [
      { name: 'taxType', type: 'TEXT DEFAULT \'intra\'' },
      { name: 'grossTotal', type: 'REAL DEFAULT 0' },
      { name: 'itemDiscount', type: 'REAL DEFAULT 0' },
      { name: 'additionalCharges', type: 'REAL DEFAULT 0' },
      { name: 'roundOff', type: 'REAL DEFAULT 0' },
      { name: 'amountReceived', type: 'REAL DEFAULT 0' },
      { name: 'internalNotes', type: 'TEXT' },
      { name: 'weekly_sequence', type: 'INTEGER DEFAULT 1' },
      { name: 'loyalty_points_redeemed', type: 'INTEGER DEFAULT 0' },
      { name: 'loyalty_points_earned', type: 'INTEGER DEFAULT 0' },
      { name: 'loyalty_points_discount', type: 'REAL DEFAULT 0' },
      { name: 'is_deleted', type: 'INTEGER DEFAULT 0' }
    ];

    missingInvCols.forEach(col => {
      if (!invCols.includes(col.name)) {
        db.execSync(`ALTER TABLE invoices ADD COLUMN ${col.name} ${col.type};`);
      }
    });

    // 5. Remaining Tables
    db.execSync(`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        title TEXT,
        amount REAL,
        category TEXT,
        date TEXT,
        payment_method TEXT,
        receipt_url TEXT,
        tags JSON,
        created_at TEXT,
        updated_at TEXT
      );
    `);

    // Migration: receipt_url for expenses
    const expInfo = db.getAllSync(`PRAGMA table_info(expenses)`);
    const expCols = expInfo.map(c => c.name);
    if (!expCols.includes('receipt_url')) {
      db.execSync(`ALTER TABLE expenses ADD COLUMN receipt_url TEXT;`);
    }

    db.execSync(`

      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        data JSON,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS expense_adjustments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_id TEXT,
        delta REAL,
        reason TEXT,
        created_at TEXT,
        FOREIGN KEY(expense_id) REFERENCES expenses(id)
      );
    `);

    isInitialized = true;
    console.log("[DB] Local SQLite Database Initialized successfully");
  } catch (error) {
    console.error("[DB] Initialization failed:", error);
  }
};

// Run it once immediately
initializeDB();

export const fetchAllTableData = async () => {
  try {
    const settingsStr = await AsyncStorage.getItem('app_settings');
    const settings = settingsStr ? JSON.parse(settingsStr) : {};

    return {
      customers: db.getAllSync('SELECT * FROM customers'),
      products: db.getAllSync('SELECT * FROM products'),
      invoices: db.getAllSync('SELECT * FROM invoices'),
      expenses: db.getAllSync('SELECT * FROM expenses'),
      settings: [settings],
    };
  } catch (error) {
    console.error("Error fetching table data:", error);
    return { customers: [], products: [], invoices: [], expenses: [], settings: [] };
  }
};

export const clearDatabase = async () => {
  try {
    console.log('[DB] Clearing all local data...');
    db.execSync('DELETE FROM customers');
    db.execSync('DELETE FROM products');
    db.execSync('DELETE FROM invoices');
    db.execSync('DELETE FROM expenses');
    db.execSync('DELETE FROM expense_adjustments');
    db.execSync('DELETE FROM settings');
    console.log('[DB] All tables cleared.');
    return true;
  } catch (error) {
    console.error('[DB] Failed to clear database:', error);
    return false;
  }
};