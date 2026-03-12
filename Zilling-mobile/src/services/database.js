import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

// In-process memory store for the current database instance
let _activeDb = null;
let _currentDbName = null;

// The default "legacy" database name
const DEFAULT_DB_NAME = 'zilling.db';

/**
 * Gets the current active database instance.
 * If no user is logged in, it falls back to the default database.
 */
export const getDB = () => {
    if (!_activeDb) {
        console.log(`[DB] No active DB, opening default: ${DEFAULT_DB_NAME}`);
        _activeDb = SQLite.openDatabaseSync(DEFAULT_DB_NAME);
        _currentDbName = DEFAULT_DB_NAME;
        initializeDB(_activeDb);
    }
    return _activeDb;
};

/**
 * Switch to a user-specific database file.
 * This is the core of "Production Grade" account isolation.
 */
export const switchUserDatabase = async (email) => {
    if (!email) return getDB();

    const newDbName = `zilling_${email.replace(/[@.]/g, '_')}.db`;
    
    if (_currentDbName === newDbName && _activeDb) {
        return _activeDb;
    }

    console.log(`[DB] Switching to user-specific database: ${newDbName}`);
    
    // Note: We don't "close" the old one explicitly in openDatabaseSync (expo manages connections)
    // but we update our reference.
    const newDb = SQLite.openDatabaseSync(newDbName);
    _activeDb = newDb;
    _currentDbName = newDbName;
    
    // Ensure the schema is ready for this specific user's file
    initializeDB(newDb);
    return newDb;
};

/**
 * Resets the active database connection (used on logout).
 */
export const logoutDB = () => {
    console.log(`[DB] Logging out of database session: ${_currentDbName}`);
    _activeDb = null;
    _currentDbName = null;
};

// Use a proxy for the 'db' export so existing code doesn't break
export const db = new Proxy({}, {
    get(target, prop) {
        const dbInstance = getDB();
        const value = dbInstance[prop];
        return typeof value === 'function' ? value.bind(dbInstance) : value;
    }
});

/**
 * Initialize schema on a specific database instance
 */
export const initializeDB = (targetDb = null) => {
  const currentDb = targetDb || getDB();
  
  try {
    console.log(`[DB] Initializing schema for: ${_currentDbName}`);
    // 1. Initial basic setup
    currentDb.execSync('PRAGMA journal_mode = WAL;');
    currentDb.execSync('PRAGMA foreign_keys = ON;');

    // 2. Customers Table & Migrations
    currentDb.execSync(`
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
    const custInfo = currentDb.getAllSync(`PRAGMA table_info(customers)`);
    const custCols = custInfo.map(c => c.name);

    if (!custCols.includes('amountPaid')) {
      currentDb.execSync(`ALTER TABLE customers ADD COLUMN amountPaid REAL DEFAULT 0;`);
    }
    if (!custCols.includes('whatsappOptIn')) {
      currentDb.execSync(`ALTER TABLE customers ADD COLUMN whatsappOptIn INTEGER DEFAULT 0;`);
    }
    if (!custCols.includes('smsOptIn')) {
      currentDb.execSync(`ALTER TABLE customers ADD COLUMN smsOptIn INTEGER DEFAULT 0;`);
    }
    if (!custCols.includes('outstanding')) {
      currentDb.execSync(`ALTER TABLE customers ADD COLUMN outstanding REAL DEFAULT 0;`);
    }

    // 3. Products Table & Migrations
    currentDb.execSync(`
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

    const prodInfo = currentDb.getAllSync(`PRAGMA table_info(products)`);
    const prodCols = prodInfo.map(c => c.name);
    if (!prodCols.includes('min_stock')) {
      currentDb.execSync(`ALTER TABLE products ADD COLUMN min_stock INTEGER DEFAULT 0;`);
    }
    if (!prodCols.includes('cost_price')) {
      currentDb.execSync(`ALTER TABLE products ADD COLUMN cost_price REAL DEFAULT 0;`);
    }

    // 4. Invoices Table & Migrations
    currentDb.execSync(`
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

    const invInfo = currentDb.getAllSync(`PRAGMA table_info(invoices)`);
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
        currentDb.execSync(`ALTER TABLE invoices ADD COLUMN ${col.name} ${col.type};`);
      }
    });

    // 5. Remaining Tables
    currentDb.execSync(`
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
    const expInfo = currentDb.getAllSync(`PRAGMA table_info(expenses)`);
    const expCols = expInfo.map(c => c.name);
    if (!expCols.includes('receipt_url')) {
      currentDb.execSync(`ALTER TABLE expenses ADD COLUMN receipt_url TEXT;`);
    }

    currentDb.execSync(`
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

      -- PRODUCTION GRADE: Performance Indexes
      CREATE INDEX IF NOT EXISTS idx_customers_created ON customers(created_at);
      CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
      CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
      
      CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at);
      CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
      
      CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
      CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
      CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    `);

    console.log(`[DB] Schema Initialized successfully for ${_currentDbName}`);
  } catch (error) {
    console.error(`[DB] Initialization failed for ${_currentDbName}:`, error);
  }
};

export const fetchAllTableData = async () => {
  const currentDb = getDB();
  try {
    const { getActiveSettingsKey } = require('../utils/storageKeys');
    const settingsKey = await getActiveSettingsKey();
    const settingsStr = await AsyncStorage.getItem(settingsKey);
    const settings = settingsStr ? JSON.parse(settingsStr) : {};

    return {
      customers: currentDb.getAllSync('SELECT * FROM customers'),
      products: currentDb.getAllSync('SELECT * FROM products'),
      invoices: currentDb.getAllSync('SELECT * FROM invoices'),
      expenses: currentDb.getAllSync('SELECT * FROM expenses'),
      settings: [settings],
    };
  } catch (error) {
    console.error("Error fetching table data:", error);
    return { customers: [], products: [], invoices: [], expenses: [], settings: [] };
  }
};

export const clearDatabase = async () => {
  const currentDb = getDB();
  try {
    console.log(`[DB] Clearing tables in ${_currentDbName}...`);
    currentDb.execSync('DELETE FROM customers');
    currentDb.execSync('DELETE FROM products');
    currentDb.execSync('DELETE FROM invoices');
    currentDb.execSync('DELETE FROM expenses');
    currentDb.execSync('DELETE FROM expense_adjustments');
    currentDb.execSync('DELETE FROM settings');
    console.log(`[DB] All tables cleared in ${_currentDbName}.`);
    return true;
  } catch (error) {
    console.error(`[DB] Failed to clear database ${_currentDbName}:`, error);
    return false;
  }
};