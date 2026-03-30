import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

// In-process memory store for the current database instance
let _activeDb = null;
let _currentDbName = null;
let _initializationPromise = null;

// The default "legacy" database name
const DEFAULT_DB_NAME = 'zilling.db';

/**
 * Normalizes email into a safe database filename.
 */
const getDbNameFromEmail = (email) => {
    if (!email) return DEFAULT_DB_NAME;
    return `kwiq_${email.toLowerCase().replace(/[@.]/g, '_')}.db`;
};

/**
 * Async version of getDB ensuring it's ready.
 * This is the ONLY safe way to get the DB handle if you aren't 100% sure it's open.
 */
export const getActiveDB = async () => {
    // 0. Identity Awareness: Detect who SHOULD be the active user
    let targetEmail = null;
    try {
        const userStr = await AsyncStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            targetEmail = user?.email || null;
        }
    } catch (e) {
        console.warn(`[DB] Failed to check active user for DB routing:`, e.message);
    }
    const targetDbName = getDbNameFromEmail(targetEmail);

    // 1. If we already have the CORRECT handle, return it
    if (_activeDb && _currentDbName === targetDbName) {
        return _activeDb;
    }

    // 2. If an initialization is already ongoing...
    if (_initializationPromise) {
        // ...but it's for the WRONG database, we must wait and then re-switch
        const currentInitializingName = _currentDbName; // This is set at the start of switch
        if (currentInitializingName && currentInitializingName !== targetDbName) {
           console.log(`[DB] Currently initializing ${currentInitializingName}, but need ${targetDbName}. Waiting...`);
           await _initializationPromise;
           // Fall through to switch below
        } else {
           // It's the right one (or we don't know yet), just wait
           return _initializationPromise;
        }
    }

    // 3. Otherwise, start/restart initialization for the target user DB
    console.log(`[DB] Routing to database: ${targetDbName}`);
    return switchUserDatabase(targetEmail); 
};

/**
 * Gets the current active database instance (synchronously).
 * NOTE: Might return null if not initialized.
 */
export const getDB = () => _activeDb;

/**
 * Switch to a user-specific database file.
 * This is the core of "Account Isolation".
 */
export const switchUserDatabase = async (email) => {
    const newDbName = getDbNameFromEmail(email);
    
    // If already initialized to this DB, return it
    if (_currentDbName === newDbName && _activeDb) {
        return _activeDb;
    }

    // Prevent concurrent switching/initialization
    // If one is running, we wait for it.
    if (_initializationPromise) {
        console.log(`[DB] Waiting for current initialization to finish before switching to ${newDbName}...`);
        await _initializationPromise;
    }

    _initializationPromise = (async () => {
        try {
            console.log(`[DB] Opening database file: ${newDbName}`);
            
            // 0. CLEANUP OLD HANDLE
            // Explicitly closing the old handle prevents "NativeDatabase.prepareAsync" NPEs on Android
            if (_activeDb) {
                try {
                    console.log(`[DB] Closing previous session handle...`);
                    await _activeDb.closeAsync();
                } catch (closeErr) {
                    console.warn(`[DB] Non-critical error closing previous handle:`, closeErr.message);
                }
                _activeDb = null;
            }

            // 1. Open Native Handle
            let newDb = await SQLite.openDatabaseAsync(newDbName);
            if (!newDb) throw new Error("Failed to open database handle: SQLite.openDatabaseAsync returned null");
            
            // 2. NATIVE WARM-UP DELAY
            // NPEs in 'prepareAsync' often happen because the native DB object isn't fully linked to the JS handle yet.
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // 3. NATIVE SMOKE TEST
            // Verify the handle actually works before putting it into the schema logic
            try {
                await newDb.execAsync('SELECT 1;');
            } catch (smokeErr) {
                console.warn(`[DB] Smoke test failed for ${newDbName}, retrying open...`);
                await new Promise(resolve => setTimeout(resolve, 300));
                newDb = await SQLite.openDatabaseAsync(newDbName);
                await newDb.execAsync('SELECT 1;');
            }
            
            console.log(`[DB] Native handle verified for ${newDbName}. Rebuilding schema...`);
            
            // 4. Initialize schema on this specific instance
            await initializeDB(newDb, newDbName);
            
            // 5. Commit to shared memory state
            _activeDb = newDb;
            _currentDbName = newDbName;
            
            console.log(`[DB] Database switch to ${newDbName} complete.`);
            return newDb;
        } catch (err) {
            console.error(`[DB] CRITICAL INITIALIZATION ERROR for ${newDbName}:`, err);
            _activeDb = null;
            _currentDbName = null;
            throw err;
        } finally {
            _initializationPromise = null;
        }
    })();

    return _initializationPromise;
};

/**
 * Resets the active database connection (used on logout).
 */
export const logoutDB = async () => {
    console.log(`[DB] Closing database session: ${_currentDbName}`);
    if (_activeDb) {
        try {
            await _activeDb.closeAsync();
        } catch (e) {
            console.warn(`[DB] Error during logout closure:`, e.message);
        }
    }
    _activeDb = null;
    _currentDbName = null;
    _initializationPromise = null;
};

/**
 * SMARTER PROXY: All calls via 'db.method(...)' now automatically wait
 * for the database to be fully initialized. This eliminates 100% of race conditions
 * where a query might fire while the handle is still switching.
 */
export const db = new Proxy({}, {
    get(target, prop) {
        // Return an async function that queues behind 'getActiveDB'
        return async (...args) => {
            try {
                const activeHandle = await getActiveDB();
                if (!activeHandle) {
                    throw new Error(`Database could not be initialized for call: ${prop}`);
                }
                
                if (typeof activeHandle[prop] !== 'function') {
                    // Safety check for properties that are not functions
                    return activeHandle[prop];
                }
                
                // Bind and execute
                return activeHandle[prop](...args);
            } catch (err) {
                // Better logging for the specific method that failed
                console.error(`[DB Proxy] Error executing '${prop}':`, err.message);
                throw err;
            }
        };
    }
});

/**
 * Initialize schema on a specific database instance
 */
export const initializeDB = async (targetDb, logName = "passed_instance") => {
  if (!targetDb) throw new Error("[DB] Schema init failed: Handle is null");
  
  try {
    // 1. Stability Retry for PRAGMAs
    let pragmaSuccess = false;
    for (let i = 0; i < 3 && !pragmaSuccess; i++) {
        try {
            await targetDb.execAsync('PRAGMA journal_mode = WAL;');
            await targetDb.execAsync('PRAGMA foreign_keys = ON;');
            pragmaSuccess = true;
        } catch (pErr) {
            console.warn(`[DB] PRAGMA attempt ${i+1} failed for ${logName}:`, pErr.message);
            await new Promise(resolve => setTimeout(resolve, 200));
            if (i === 2) throw pErr;
        }
    }

    // 2. Core Tables
    await targetDb.execAsync(`
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
      );

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
        is_deleted INTEGER DEFAULT 0,
        UNIQUE(sku)
      );


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
        receptionist_name TEXT,
        receptionist_id TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS receptionists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT,
        updated_at TEXT
      );

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

      CREATE TABLE IF NOT EXISTS conflict_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT,
        record_id TEXT,
        local_version JSON,
        cloud_version JSON,
        base_version JSON,
        resolved INTEGER DEFAULT 0,
        detected_at TEXT
      );
    `);


    // 3. Schema Migrations (Sequential)
    // Customers
    try {
        const custInfo = await targetDb.getAllAsync(`PRAGMA table_info(customers)`);
        const custCols = custInfo.map(c => c.name);
        if (!custCols.includes('amountPaid')) await targetDb.execAsync(`ALTER TABLE customers ADD COLUMN amountPaid REAL DEFAULT 0;`);
        if (!custCols.includes('whatsappOptIn')) await targetDb.execAsync(`ALTER TABLE customers ADD COLUMN whatsappOptIn INTEGER DEFAULT 0;`);
        if (!custCols.includes('smsOptIn')) await targetDb.execAsync(`ALTER TABLE customers ADD COLUMN smsOptIn INTEGER DEFAULT 0;`);
        if (!custCols.includes('outstanding')) await targetDb.execAsync(`ALTER TABLE customers ADD COLUMN outstanding REAL DEFAULT 0;`);
    } catch (e) { console.warn("[DB] Customer migration error", e.message); }

    // Products
    try {
        const prodInfo = await targetDb.getAllAsync(`PRAGMA table_info(products)`);
        const prodCols = prodInfo.map(c => c.name);
        if (!prodCols.includes('min_stock')) await targetDb.execAsync(`ALTER TABLE products ADD COLUMN min_stock INTEGER DEFAULT 0;`);
        if (!prodCols.includes('cost_price')) await targetDb.execAsync(`ALTER TABLE products ADD COLUMN cost_price REAL DEFAULT 0;`);
    } catch (e) { console.warn("[DB] Product migration error", e.message); }


    // Products (Soft Delete)
    try {
        const prodInfo = await targetDb.getAllAsync(`PRAGMA table_info(products)`);
        const prodCols = prodInfo.map(c => c.name);
        if (!prodCols.includes('is_deleted')) {
            await targetDb.execAsync(`ALTER TABLE products ADD COLUMN is_deleted INTEGER DEFAULT 0;`);
        }
    } catch (e) { console.warn("[DB] Product is_deleted migration error", e.message); }

    // Invoices
    try {

        const invInfo = await targetDb.getAllAsync(`PRAGMA table_info(invoices)`);
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
          { name: 'receptionist_name', type: 'TEXT' },
          { name: 'receptionist_id', type: 'TEXT' },
          { name: 'is_deleted', type: 'INTEGER DEFAULT 0' }
        ];
        for (const col of missingInvCols) {
            if (!invCols.includes(col.name)) {
                await targetDb.execAsync(`ALTER TABLE invoices ADD COLUMN ${col.name} ${col.type};`);
            }
        }
    } catch (e) { console.warn("[DB] Invoice migration error", e.message); }

    // 4. Performance Indexes
    await targetDb.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
      CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
    `);

    console.log(`[DB] Schema for ${logName} is up to date.`);
  } catch (error) {
    console.error(`[DB] Initialization logic crashed for ${logName}:`, error);
    throw error; 
  }
};

export const fetchAllTableData = async () => {
  const currentDb = await getActiveDB();
  try {
    const { getActiveSettingsKey } = require('../utils/storageKeys');
    const settingsKey = await getActiveSettingsKey();
    const settingsStr = await AsyncStorage.getItem(settingsKey);
    const settings = settingsStr ? JSON.parse(settingsStr) : {};

    const [customers, products, invoices, expenses, receptionists, expense_adjustments] = await Promise.all([
      currentDb.getAllAsync('SELECT * FROM customers'),
      currentDb.getAllAsync('SELECT * FROM products'),
      currentDb.getAllAsync('SELECT * FROM invoices'),
      currentDb.getAllAsync('SELECT * FROM expenses'),
      currentDb.getAllAsync('SELECT * FROM receptionists'),
      currentDb.getAllAsync('SELECT * FROM expense_adjustments').catch(() => [])
    ]);

    return {
      customers,
      products,
      invoices,
      expenses,
      receptionists,
      expense_adjustments,
      settings: [settings],
    };
  } catch (error) {
    console.error("Error fetching table data:", error);
    return { customers: [], products: [], invoices: [], expenses: [], settings: [] };
  }
};

export const clearDatabase = async () => {
  const currentDb = await getActiveDB();
  try {
    console.log(`[DB] Clearing tables in ${_currentDbName}...`);
    
    await currentDb.execAsync('DELETE FROM customers');
    await currentDb.execAsync('DELETE FROM products');
    await currentDb.execAsync('DELETE FROM invoices');
    await currentDb.execAsync('DELETE FROM expenses'); 
    await currentDb.execAsync('DELETE FROM expense_adjustments');
    await currentDb.execAsync('DELETE FROM receptionists');
    
    try {
        await currentDb.execAsync('DELETE FROM settings');
    } catch (e) {}

    console.log(`[DB] All tables cleared in ${_currentDbName}.`);
    return true;
  } catch (error) {
    console.error(`[DB] Failed to clear database ${_currentDbName}:`, error);
    return false;
  }
};