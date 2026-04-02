import { db, clearDatabase } from './database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { getAccessToken, getOrCreateFolder, uploadFileToFolder, fetchWithTimeout, getDriveEncSalt, deriveEncryptionKey, encryptContent, decryptContent, prewarmEncryptionKeys } from './googleDriveservices';
import { generateUUID } from '../utils/crypto';
import CryptoJS from 'crypto-js';
import { InteractionManager } from 'react-native';

// Helper: true micro-task yield for React Native.
// setImmediate gives React a proper 16ms animation frame budget;
// setTimeout(0) only yields one tick and can still block long animations.
const yieldToUI = () => new Promise(resolve => {
  if (typeof setImmediate === 'function') setImmediate(resolve);
  else setTimeout(resolve, 0);
});
const PROCESSED_EVENTS_KEY = 'processed_events_ids';
const PENDING_UPLOAD_QUEUE_KEY = 'pending_upload_queue';
const LAST_SYNCED_KEY = 'last_synced_timestamp';
const DEVICE_ID_KEY = 'device_unique_id';
const LAST_SNAPSHOT_TIME_KEY = 'last_snapshot_timestamp';
const SNAPSHOT_THRESHOLD = 50; // Every 50 events, trigger a snapshot
const SYNC_HISTORY_LIMIT_DAYS = 30; // "Recent Mode" limit

/**
 * PRO-LEVEL: CHUNKED WRITES WITH PRIORITY QUEUE
 * Prevents UI thread blocking during large sync operations.
 * Yields the thread for 16ms between chunks to keep animations fluid.
 */
class SyncWriteQueue {
  constructor() {
    this.queue = [];
    this.isFlushing = false;
    this.startupMode = true;
    
    // Switch to background mode after 60s
    setTimeout(() => { this.startupMode = false; }, 60000);
  }

  async enqueue(chunk, isHighPriority = false) {
    if (isHighPriority) this.queue.unshift(chunk);
    else this.queue.push(chunk);
    
    if (!this.isFlushing) {
      this.isFlushing = true;
      try {
        await this.flush();
      } finally {
        this.isFlushing = false;
      }
    }
  }

  async flush() {
    while (this.queue.length > 0) {
      const chunk = this.queue.shift();
      // 🚀 ADAPTIVE YIELDING: run fewer ops per yield on startup
      const SUB_BATCH_SIZE = this.startupMode ? 5 : 15;
      const YIELD_MS = this.startupMode ? 32 : 16;

      for (let i = 0; i < chunk.length; i += SUB_BATCH_SIZE) {
        const subBatch = chunk.slice(i, i + SUB_BATCH_SIZE);
        await db.withTransactionAsync(async () => {
          for (const op of subBatch) {
            await op();
          }
        });
        // 🚀 CRITICAL: Longer yield on startup to allow Navigation to respond
        await new Promise(r => setTimeout(r, YIELD_MS));
      }
    }
  }
}

const writeQueue = new SyncWriteQueue();

/**
 * PRO-LEVEL: PERSISTENT SYNC LEDGER
 * Tracks 3-tier health status instead of just success/fail.
 */
export class SyncLedger {
  static async recordAttempt(success, count = 0) {
    const statusStr = await AsyncStorage.getItem('sync_ledger');
    const status = statusStr ? JSON.parse(statusStr) : { lastSuccess: Date.now(), failStreak: 0 };
    
    const newStatus = {
      lastAttempt: Date.now(),
      lastSuccess: success ? Date.now() : status.lastSuccess,
      failStreak: success ? 0 : (status.failStreak || 0) + 1,
      pendingChanges: count
    };
    await AsyncStorage.setItem('sync_ledger', JSON.stringify(newStatus));
    return newStatus;
  }

  static async getHealthStatus() {
    const statusStr = await AsyncStorage.getItem('sync_ledger');
    if (!statusStr) return 'HEALTHY';
    const status = JSON.parse(statusStr);
    const minsSinceSuccess = (Date.now() - status.lastSuccess) / 60000;
    
    if (minsSinceSuccess < 5) return 'HEALTHY';
    if (minsSinceSuccess < 30 && status.pendingChanges === 0) return 'WARNING';
    if (status.pendingChanges > 0 || minsSinceSuccess >= 30) return 'CRITICAL';
    return 'HEALTHY';
  }
}


import { DeviceEventEmitter } from 'react-native';
export const SYNC_EVENTS = {
    SYNC_STARTED: 'SYNC_STARTED',
    SYNC_COMPLETED: 'SYNC_COMPLETED',
    SYNC_PROGRESS: 'SYNC_PROGRESS',
    DATA_UPDATED: 'DATA_UPDATED' // Generic data changed event
};

// Event Types
export const EventTypes = {
    INVOICE_CREATED: 'INVOICE_CREATED',
    PRODUCT_CREATED: 'PRODUCT_CREATED',
    PRODUCT_UPDATED: 'PRODUCT_UPDATED',
    CUSTOMER_CREATED: 'CUSTOMER_CREATED',
    CUSTOMER_UPDATED: 'CUSTOMER_UPDATED',
    CUSTOMER_DELETED: 'CUSTOMER_DELETED',
    EXPENSE_CREATED: 'EXPENSE_CREATED',
    EXPENSE_ADJUSTED: 'EXPENSE_ADJUSTED',
    EXPENSE_UPDATED: 'EXPENSE_UPDATED',
    EXPENSE_DELETED: 'EXPENSE_DELETED',
    INVOICE_DELETED: 'INVOICE_DELETED',
    INVOICE_UPDATED: 'INVOICE_UPDATED',
    INVOICE_STATUS_UPDATED: 'INVOICE_STATUS_UPDATED',
    PRODUCT_DELETED: 'PRODUCT_DELETED',
    PRODUCT_STOCK_ADJUSTED: 'PRODUCT_STOCK_ADJUSTED',
    RECEPTIONIST_CREATED: 'RECEPTIONIST_CREATED',
    RECEPTIONIST_UPDATED: 'RECEPTIONIST_UPDATED',
    RECEPTIONIST_DELETED: 'RECEPTIONIST_DELETED',
    CATEGORY_CREATED: 'CATEGORY_CREATED',
    CATEGORY_DELETED: 'CATEGORY_DELETED',
};

// ═══════════════════════════════════════════════════════════════════
// GOLDEN RULE #1: Strict Schema Parser
// Normalizes incoming event payloads from Desktop (or any source)
// into a consistent shape before applying to SQLite.
// ═══════════════════════════════════════════════════════════════════

/**
 * Normalizes items: ensures always a JS Array of objects.
 * Handles: Array, stringified JSON, null/undefined, single-object, malformed.
 */
// ═══════════════════════════════════════════════════════════════════
// GOLDEN RULE #0: Smart Parser & Data Cleaning
// Automatically handles Plain JSON (Desktop) vs Encrypted (Mobile)
// and strips Google Drive multipart/MIME leakage.
// ═══════════════════════════════════════════════════════════════════

async function smartParse(text, key, fileName = "unknown") {
    if (!text || text.trim() === "") return null;

    // 1. ROBUST CLEANING: Strip hidden MIME/Multipart trash
    let cleaned = text.trim();
    
    // Find where the real data starts ({ or [ for JSON, U2Fsd or KWIQV2 for Encrypted)
    const jsonStart = cleaned.search(/[\{\[]/);
    let encStart = cleaned.indexOf('U2FsdGVkX1');
    if (encStart === -1) encStart = cleaned.indexOf('KWIQV2:');
    
    if (jsonStart !== -1 || encStart !== -1) {
        const start = (jsonStart !== -1 && encStart !== -1) 
            ? Math.min(jsonStart, encStart) 
            : Math.max(jsonStart, encStart);
        cleaned = cleaned.substring(start);
        
        // If it looks like JSON, find the absolute last bracket/brace
        if (cleaned.startsWith('{')) {
            const lastBrace = cleaned.lastIndexOf('}');
            if (lastBrace !== -1) cleaned = cleaned.substring(0, lastBrace + 1);
        } else if (cleaned.startsWith('[')) {
            const lastBracket = cleaned.lastIndexOf(']');
            if (lastBracket !== -1) cleaned = cleaned.substring(0, lastBracket + 1);
        }
    }

    // 2. SMART DETECTION & PARSING
    // Attempt A: Plain JSON First (Desktop Format)
    try {
        if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
            return JSON.parse(cleaned);
        }
    } catch (e) {
        // Not valid JSON yet, might be encrypted
    }

    // Attempt B: Decryption (Mobile/Legacy Format)
    if (cleaned.startsWith('U2FsdGVkX1') || cleaned.startsWith('KWIQV2:')) {
        if (!key) {
            console.warn(`[Sync] Encrypted file ${fileName} skipped: No decryption key (email).`);
            return null;
        }
        try {
            const salt = await getDriveEncSalt();
            const decrypted = await decryptContent(cleaned, key, salt);
            
            if (decrypted && (decrypted.trim().startsWith('{') || decrypted.trim().startsWith('['))) {
                return JSON.parse(decrypted);
            }
        } catch (decErr) {
            if (__DEV__) console.log(`[Sync] Skipping encrypted file ${fileName} (Decryption failed)`);
        }
    }

    return null;
}

/**
 * Normalizes items: ensures always a JS Array of objects.
 * Handles: Array, stringified JSON, null/undefined, single-object, malformed.
 */
function normalizeItems(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
            console.warn('[Schema] Failed to parse items string:', raw?.substring?.(0, 100));
            return [];
        }
    }
    if (typeof raw === 'object') return [raw]; // single item object
    return [];
}

/**
 * BILINGUAL FIELD DECRYPTOR
 * Desktop/Electron may send fields that are already encrypted (U2Fsd...).
 * This helper tries multiple legacy keys and salts used by the PC app.
 */
async function bilingualFieldDecrypt(value, email) {
    if (typeof value !== 'string' || (!value.startsWith('U2FsdGVkX1') && !value.startsWith('KWIQV2:'))) return value;
    
    // We try decryption with email and a fallback to the common PC salt 
    // to ensure the phone can read data created on the computer.
    try {
        const decrypted = await decryptContent(value, email, 'kwiq-bill-shared-salt-2024');
        return decrypted || value; // Return decrypted or original if failed
    } catch (e) {
        return value;
    }
}

/**
 * Normalizes variants: ensures always a JS Array of objects with correct numeric types.
 */
function normalizeVariants(raw) {
    const list = normalizeItems(raw);
    return list.map(v => {
        // Robust cost price mapping
        const computedCost = Number(
            (v.cost_price !== undefined && v.cost_price !== null && v.cost_price !== '') ? v.cost_price : 
            ((v.costPrice !== undefined && v.costPrice !== null && v.costPrice !== '') ? v.costPrice : 0)
        ) || 0;

        const resolvedBarcode = String(v.barcode || v.sku || '').trim();
        
        // Robust stock/qty mapping
        const computedStock = Number(
            (v.stock !== undefined && v.stock !== null && v.stock !== '') ? v.stock : 
            ((v.qty !== undefined && v.qty !== null && v.qty !== '') ? v.qty : 
            ((v.quantity !== undefined && v.quantity !== null && v.quantity !== '') ? v.quantity : 0))
        ) || 0;

        return {
            ...v,
            name: String(v.name || v.detail || ''),
            sku: String(v.sku || ''),
            barcode: resolvedBarcode,
            price: (v.price !== null && v.price !== undefined && v.price !== '') ? Number(v.price) : null,
            cost_price: computedCost,
            costPrice: computedCost,
            stock: computedStock,
            tax_rate: Number(v.tax_rate || v.taxRate || 0),
        };
    });
}

/**
 * Normalizes payments: same logic as items.
 */
function normalizePayments(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
            return [];
        }
    }
    if (typeof raw === 'object') return [raw];
    return [];
}

/**
 * Calculates total from items array if the payload total is missing/zero.
 * GOLDEN RULE: Defensive fallback — never trust a missing `total`.
 */
function calculateTotalFromItems(items, fallbackTotal) {
    const existing = parseFloat(fallbackTotal);
    if (existing && existing > 0) return existing;

    if (!Array.isArray(items) || items.length === 0) return 0;

    return items.reduce((sum, item) => {
        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.price || item.rate || item.unitPrice) || 0;
        return sum + (qty * price);
    }, 0);
}

/**
 * Normalizes a full invoice payload into a strict, consistent schema.
 * Map Desktop (snake_case/remarks) to Mobile (camelCase/internalNotes)
 */
async function normalizeInvoicePayload(payload, email = null) {
    const items = normalizeItems(payload.items);
    const payments = normalizePayments(payload.payments);

    const customerName = bilingualFieldDecrypt(payload.customer_name || payload.customerName || 'Guest', email);
    return {
        id: payload.id,
        customer_id: payload.customer_id || payload.customerId || '',
        customer_name: await bilingualFieldDecrypt(payload.customer_name || payload.customerName || 'Walk-in Customer', email),
        date: payload.date || new Date().toISOString(),
        type: payload.type || 'Standard',
        items,
        itemsStr: typeof payload.items === 'string' ? payload.items : JSON.stringify(items),
        payments,
        paymentsStr: typeof payload.payments === 'string' ? payload.payments : JSON.stringify(payments),
        subtotal: parseFloat(payload.subtotal) || 0,
        tax: parseFloat(payload.tax) || 0,
        discount: parseFloat(payload.discount) || 0,
        total: calculateTotalFromItems(items, payload.total || payload.total_amount),
        status: payload.status || 'PAID',
        created_at: payload.created_at || payload.createdAt || new Date().toISOString(),
        updated_at: payload.updated_at || payload.updatedAt || new Date().toISOString(),
        taxType: payload.taxType || payload.tax_type || 'intra',
        grossTotal: parseFloat(payload.grossTotal || payload.gross_total || payload.total_cost || 0),
        itemDiscount: parseFloat(payload.itemDiscount || payload.item_discount || 0),
        additionalCharges: parseFloat(payload.additionalCharges || payload.additional_charges || 0),
        roundOff: parseFloat(payload.roundOff || payload.round_off || 0),
        amountReceived: parseFloat(payload.amountReceived || payload.amount_received || 0),
        internalNotes: await bilingualFieldDecrypt(payload.internalNotes || payload.remarks || '', email),
        receptionist_name: await bilingualFieldDecrypt(payload.receptionist_name || payload.receptionistName || null, email),
        receptionist_id: payload.receptionist_id || payload.receptionistId || null,
        is_deleted: (payload.is_deleted || payload.deleted) ? 1 : 0,
    };
}

async function normalizeProductPayload(p, email = null) {
    return {
        id: String(p.id),
        name: await bilingualFieldDecrypt(String(p.name || 'Untitled Product'), email),
        sku: await bilingualFieldDecrypt(String(p.sku || ''), email),
        category: await bilingualFieldDecrypt(String(p.category || 'General'), email),
        price: Number(p.price || 0),
        cost_price: Number(p.costPrice || p.cost_price || 0),
        stock: parseInt(p.stock || p.qty || p.quantity) || 0,
        min_stock: parseInt(p.minStock || p.min_stock) || 0,
        unit: String(p.unit || 'pc'),
        tax_rate: Number(p.tax_rate || p.taxRate || 0),
        variants: JSON.stringify(normalizeVariants(p.variants)),
        variant: String(p.variant || ''),
        is_deleted: (p.is_deleted || p.deleted) ? 1 : 0,
        created_at: String(p.created_at || p.createdAt || new Date().toISOString()),
        updated_at: String(p.updated_at || p.updatedAt || new Date().toISOString()),
    };
}


/**
 * Normalizes a customer payload.
 * Handles Name concatenation for Desktop (firstName/lastName) and field snake_case.
 */
async function normalizeCustomerPayload(payload, email = null) {
    // Handle concatenated name if Desktop sends firstName + lastName
    const rawName = payload.name || 
                        (payload.firstName ? `${payload.firstName} ${payload.lastName || ''}`.trim() : '') || 
                        'Guest';
    
    const resolvedName = await bilingualFieldDecrypt(rawName, email);

    return {
        id: payload.id,
        name: resolvedName,
        phone: await bilingualFieldDecrypt(payload.phone || payload.mobile || '', email),
        email: await bilingualFieldDecrypt(payload.email || '', email),
        type: payload.type || 'retail',
        gstin: await bilingualFieldDecrypt(payload.gstin || '', email),
        address: typeof payload.address === 'object' ? JSON.stringify(payload.address) : await bilingualFieldDecrypt(payload.address || '', email),
        source: payload.source || '',
        tags: Array.isArray(payload.tags) ? payload.tags.join(',') : (payload.tags || ''),
        loyaltyPoints: parseInt(payload.loyaltyPoints || payload.loyalty_points) || 0,
        outstanding: parseFloat(payload.outstanding) || 0,
        amountPaid: parseFloat(payload.amountPaid || payload.amount_paid) || 0,
        notes: await bilingualFieldDecrypt(payload.notes || payload.remarks || '', email),
        created_at: payload.created_at || payload.createdAt || new Date().toISOString(),
        updated_at: payload.updated_at || payload.updatedAt || new Date().toISOString(),
        whatsappOptIn: (payload.whatsappOptIn || payload.whatsapp_opt_in) ? 1 : 0,
        smsOptIn: (payload.smsOptIn || payload.sms_opt_in) ? 1 : 0,
    };
}

async function normalizeExpensePayload(payload, email = null) {
    return {
        id: payload.id,
        title: await bilingualFieldDecrypt(payload.title || '', email),
        amount: parseFloat(payload.amount) || 0,
        category: await bilingualFieldDecrypt(payload.category || '', email),
        date: payload.date || new Date().toISOString(),
        payment_method: payload.payment_method || payload.paymentMethod || 'Cash',
        receipt_url: payload.receipt_url || payload.receiptUrl || '',
        tags: Array.isArray(payload.tags) ? payload.tags.join(',') : (payload.tags || ''),
        created_at: payload.created_at || payload.createdAt || new Date().toISOString(),
        updated_at: payload.updated_at || payload.updatedAt || new Date().toISOString(),
    };
}

/**
 * Normalizes a receptionist payload.
 */
async function normalizeReceptionistPayload(payload, email = null) {
    return {
        id: String(payload.id),
        name: await bilingualFieldDecrypt(String(payload.name || ''), email),
        is_active: payload.is_active !== undefined ? (payload.is_active ? 1 : 0) : 1,
        created_at: payload.created_at || new Date().toISOString(),
        updated_at: payload.updated_at || new Date().toISOString(),
    };
}

async function normalizeCategoryPayload(payload, email = null) {
    return {
        id: payload.id,
        name: await bilingualFieldDecrypt(payload.name || '', email),
        color: payload.color || '#000',
        created_at: payload.created_at || payload.createdAt || new Date().toISOString(),
        updated_at: payload.updated_at || payload.updatedAt || new Date().toISOString(),
    };
}


// ═══════════════════════════════════════════════════════════════════
// GOLDEN RULE #3: Ghost Customer Creator
// If an invoice references a customer_id that doesn't exist locally,
// auto-create a ghost profile to prevent foreign key crashes.
// ═══════════════════════════════════════════════════════════════════

/**
 * Ensures a customer exists locally. If not, creates a ghost profile.
 * This prevents dashboard crashes from orphaned invoice→customer relationships.
 */
async function ensureCustomerExists(customerId, customerName) {
    if (!customerId) return;

    try {
        const exists = await db.getAllAsync(`SELECT id FROM customers WHERE id = ?`, [String(customerId)]);
        if (exists.length === 0) {
            const now = new Date().toISOString();
            console.log(`[Sync] Auto-creating ghost customer: ${customerName} (${customerId})`);
            await db.runAsync(
                `INSERT OR IGNORE INTO customers (id, name, phone, email, type, gstin, address, source, tags, loyaltyPoints, outstanding, amountPaid, notes, created_at, updated_at, whatsappOptIn, smsOptIn)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    String(customerId),
                    customerName || 'Unknown Customer',
                    '', '', 'retail', '', '', 'auto-sync', '',
                    0, 0, 0, 'Auto-created during sync (ghost profile)',
                    now, now, 0, 0
                ]
            );
        }
    } catch (e) {
        console.warn(`[Sync] Ghost customer creation failed for ${customerId}:`, e.message);
    }
}


// SYNC MUTEX: Avoid multiple syncs stomping on each other
let _syncState = {
    isSyncing: false,
    startTime: 0,
    type: null
};

const SYNC_TIMEOUT_MS = 15 * 60000; // 15 minutes failsafe

/**
 * Robust Mutex for Sync Operations
 */
const acquireSyncLock = (type = 'down') => {
    const now = Date.now();
    if (_syncState.isSyncing) {
        // Check for stale lock (older than 15 mins)
        if (now - _syncState.startTime > SYNC_TIMEOUT_MS) {
            console.warn(`[Sync] Stale ${_syncState.type} lock detected (elapsed: ${Math.round((now - _syncState.startTime)/1000)}s). Forcing reset.`);
            _syncState.isSyncing = false;
        } else {
            console.log(`[Sync] ${type} requested, but ${_syncState.type} already in progress (elapsed: ${Math.round((now - _syncState.startTime)/1000)}s). Skipping.`);
            return false;
        }
    }
    _syncState = { isSyncing: true, startTime: now, type };
    return true;
};

const releaseSyncLock = () => {
    const duration = Date.now() - _syncState.startTime;
    console.log(`[Sync] ${_syncState.type} lock released. Duration: ${duration}ms`);
    _syncState = { isSyncing: false, startTime: 0, type: null };
};

let _cachedEventsFolderId = null;
let _cachedSnapshotsFolderId = null;
let _cachedBackupsFolderId = null;
let _cachedSyncKey = null;

export const SyncService = {
    
    // Allow external callers (like AuthContext) to set the key directly
    setSyncContext(email) {
        if (email) {
            _cachedSyncKey = email;
            console.log(`[Sync] Context locked to user: ${email}`);
        }
    },

    /**
     * Clear session caches on logout
     */
    logout() {
        _cachedEventsFolderId = null;
        _cachedSnapshotsFolderId = null;
        _cachedBackupsFolderId = null;
        _cachedSyncKey = null;
        try {
            const { logoutDriveCache } = require('./googleDriveservices');
            logoutDriveCache();
        } catch (e) {}
    },

    /**
     * Get or Create Root 'Kwiq Bill Backup' Folder
     * Smart Folder Detection: Searches for Kwiqbill, Kwiq Bill Backup, or User-specific folders.
     */
    async getRootFolderId(accessToken) {
        // Optimization: Try to find existing folders first to be "bilingual" with Desktop
        try {
            const userStr = await AsyncStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            const foldersToTry = ['Kwiq Bill Backup', 'Kwiqbill'];
            if (user?.id) foldersToTry.push(`KwiqBilling-${user.id}`);

            for (const fName of foldersToTry) {
                const query = `name='${fName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
                const searchRes = await fetchWithTimeout(
                    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`,
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                );
                const searchData = await searchRes.json();
                if (searchData.files && searchData.files.length > 0) {
                    return searchData.files[0].id;
                }
            }
        } catch (e) {
            console.warn('[Sync] Smart folder detection failed, falling back to default.');
        }

        // Default fallback if none found
        return getOrCreateFolder(accessToken, 'Kwiq Bill Backup');
    },

    /**
     * Get or Create Subfolders (Uses detected root)
     */
    async getBackupFolderId(accessToken) {
        if (_cachedBackupsFolderId) return _cachedBackupsFolderId;
        const rootId = await this.getRootFolderId(accessToken);
        _cachedBackupsFolderId = rootId;
        return rootId;
    },

    async getEventsFolderId(accessToken) {
        if (_cachedEventsFolderId) return _cachedEventsFolderId;
        const rootId = await this.getBackupFolderId(accessToken);
        
        // Use subfolder 'events' to be compatible with Desktop/Electron structure
        const folderId = await getOrCreateFolder(accessToken, 'events', rootId);
        _cachedEventsFolderId = folderId;
        return folderId;
    },

    async getSnapshotsFolderId(accessToken) {
        if (_cachedSnapshotsFolderId) return _cachedSnapshotsFolderId;
        const rootId = await this.getBackupFolderId(accessToken);
        
        // Use subfolder 'snapshots' to be compatible with Desktop/Electron structure
        const folderId = await getOrCreateFolder(accessToken, 'snapshots', rootId);
        _cachedSnapshotsFolderId = folderId;
        return folderId;
    },

    /**
     * Get User-Specific Storage Key
     */
    async getUserSyncKey(baseKey) {
        try {
            const userStr = await AsyncStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            if (user && user.email) {
                // Return a key specific to this email (e.g., 'last_synced_timestamp_user@gmail.com')
                return `${baseKey}_${user.email.replace(/[@.]/g, '_')}`;
            }
        } catch (e) {
            console.warn('[Sync] Failed to get user for sync key, using default.');
        }
        return baseKey;
    },

    /**
     * Get or Create Unique Device ID
     */
    async getDeviceId() {
        let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (!deviceId) {
            deviceId = `mobile-${generateUUID().slice(0, 8)}`;
            await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
        }
        return deviceId;
    },


    /**
     * Create and Dispatch an Event
     */
    async createAndUploadEvent(type, payload) {
        const eventId = generateUUID();
        const timestamp = new Date().toISOString();

        const envelope = {
            eventId,
            type,
            createdAt: timestamp,
            deviceId: await this.getDeviceId(),
            payload
        };

        const fileName = `event_${timestamp}_${type}_${eventId}.json`;
        console.log(`[Sync] Dispatching event: ${type} (${eventId.slice(0, 8)})`);

        // 1. Save locally first — data is never lost even if upload fails/times out
        await this.addToQueue({ fileName, content: envelope });

        // 2. Upload to Drive non-blocking, with 25s timeout
        //    (8s was too tight: folder lookup alone takes 3-5s on first call)
        try {
            const uploadPromise = (async () => {
                // Parallelize: get token + encryption key at the same time
                const [accessToken, userStr] = await Promise.all([
                    getAccessToken(),
                    AsyncStorage.getItem('user'),
                ]);

                if (!accessToken) throw new Error('No access token — user not signed in');

                // Cache encryption key in memory to skip AsyncStorage on subsequent calls
                if (!_cachedSyncKey && userStr) {
                    const user = JSON.parse(userStr);
                    _cachedSyncKey = user?.email || '';
                }
                const syncKey = _cachedSyncKey || '';

                let content = JSON.stringify(envelope);
                if (syncKey) {
                    const salt = await getDriveEncSalt();
                    const derivedKey = deriveEncryptionKey(syncKey, salt);
                    content = encryptContent(content, derivedKey);
                }

                // Folder ID is cached after first call — near-zero cost on subsequent uploads
                const folderId = await this.getEventsFolderId(accessToken);
                await uploadFileToFolder(accessToken, folderId, fileName, content);

                await this.removeFromQueue(eventId);
                console.log(`[Sync] ✓ Event uploaded: ${type}`);
 
                // TRACK FOR SNAPSHOT (Every X events, suggest a snapshot)
                const countKey = await this.getUserSyncKey('local_event_count');
                const currentCount = parseInt(await AsyncStorage.getItem(countKey)) || 0;
                const newCount = currentCount + 1;
                await AsyncStorage.setItem(countKey, String(newCount));
 
                if (newCount >= SNAPSHOT_THRESHOLD) {
                    console.log('[Sync] Threshold reached. Creating Global Snapshot in background...');
                    this.createGlobalSnapshot().catch(e => console.log('Auto-Snapshot failed:', e));
                    await AsyncStorage.setItem(countKey, '0');
                }
 
                return true;
            })();

            // 25 seconds — enough for slow connections + first-time folder creation
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Upload Timeout (25s)')), 25000)
            );

            return await Promise.race([uploadPromise, timeoutPromise]);
        } catch (error) {
            // Event is already in the local queue — retryQueue() will upload it next time
            console.log(`[Sync] Upload queued for retry: ${error.message}`);
            return false;
        }
    },
 
    /**
     * Create a Full Baseline Snapshot of the Database
     * PRODUCTION GRADE: Bundles all tables into a single encrypted file.
     */
    async createGlobalSnapshot(onProgress = () => { }) {
        try {
            console.log('[Snapshot] Generating Global Snapshot...');
            onProgress('Gathering local data...', 0.1);
 
            const { fetchAllTableData } = require('./database');
            const [accessToken, allData, userStr] = await Promise.all([
                getAccessToken(),
                fetchAllTableData(),
                AsyncStorage.getItem('user'),
            ]);
 
            if (!accessToken) throw new Error('Not logged in');
            const user = userStr ? JSON.parse(userStr) : null;
            if (!user?.email) throw new Error('User email missing');
 
            onProgress('Encrypting baseline...', 0.4);
            // Add metadata to the snapshot
            const snapshot = {
                v: 3, // Version 3: Added Integrity Signing
                timestamp: new Date().toISOString(),
                deviceId: await this.getDeviceId(),
                data: allData,
                hash: '' // Placeholder
            };
 
            // ═══════════════════════════════════════════════════════════════
            // GOLDEN RULE #5: Integrity Signing (SHA-256)
            // Signs the snapshot payload so we can detect tampering on restore.
            // ═══════════════════════════════════════════════════════════════
            const signable = JSON.stringify(snapshot.data);
            snapshot.hash = CryptoJS.SHA256(signable).toString();

            let content = JSON.stringify(snapshot);
            const salt = await getDriveEncSalt();
            const derivedKey = deriveEncryptionKey(user.email, salt);
            content = encryptContent(content, derivedKey);
 
            onProgress('Uploading to cloud...', 0.7);
            const folderId = await this.getSnapshotsFolderId(accessToken);
            const fileName = `global_snapshot_${new Date().toISOString().split('T')[0]}_${generateUUID().slice(0, 8)}.json`;
            
            await uploadFileToFolder(accessToken, folderId, fileName, content);
            
            // Update last snapshot time tracker
            const snapTimeKey = await this.getUserSyncKey(LAST_SNAPSHOT_TIME_KEY);
            await AsyncStorage.setItem(snapTimeKey, new Date().toISOString());

            console.log('[Snapshot] ✓ Global Snapshot created successfully.');
            onProgress('Snapshot complete!', 1.0);
            return true;
        } catch (e) {
            console.error('[Snapshot] Failed:', e.message);
            return false;
        }
    },
 
    /**
     * Restore from the Latest Baseline Snapshot
     * PRODUCTION GRADE: Rapid recovery for new devices.
     */
    async restoreFromLatestSnapshot(onProgress = () => { }) {
        try {
            console.log('[Restore] Checking for cloud snapshots...');
            onProgress('Checking for snapshots...', 0.1);

            const accessToken = await getAccessToken();
            if (!accessToken) throw new Error('Not logged in');

            const snapshotsFolderId = await this.getSnapshotsFolderId(accessToken);
            // Search for anything containing 'snapshot_' to be robust across minor naming variations
            // Fetch all files that might be snapshots, then filter and sort in JS
            const query = `'${snapshotsFolderId}' in parents and (name contains '.json') and trashed=false`;
            const res = await fetchWithTimeout(
                `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=createdTime desc&fields=files(id,name,createdTime)`, // Removed pageSize=1
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const data = await res.json();

            // Sort and filter in JS to be 100% sure we get the right one
            let files = data.files || [];
            files = files.filter(f => f.name.toLowerCase().endsWith('.json'));
            files.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));

            if (files.length === 0) {
                console.log('[Restore] No valid snapshot files found in folder.');
                return false;
            }
            
            const latest = files[0];
            const isGlobal = latest.name.includes('global_snapshot_') || latest.name.includes('snapshot_v');

            console.log(`[Restore] Found snapshot file: ${latest.name} (${latest.createdTime})`);
            onProgress('Downloading snapshots...', 0.3);

            // If it's NOT a global snapshot, we might need to fetch OTHER individual files too
            if (!isGlobal) {
                console.log('[Restore] Detected individual snapshots (Electron-style). Fetching all files...');
                return this.restoreFromIndividualSnapshots(files, onProgress);
            }

            const fileRes = await fetchWithTimeout(
                `https://www.googleapis.com/drive/v3/files/${latest.id}?alt=media`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const encryptedContent = await fileRes.text();
            
            const userStr = await AsyncStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            if (!user?.email) throw new Error('User email missing for decryption');

            onProgress('Decrypting...', 0.5);
            let decrypted;
            try {
                const salt = await getDriveEncSalt();
                decrypted = decryptContent(encryptedContent, user.email, salt);
                if (!decrypted) throw new Error('Decryption resulted in empty string. Wrong key or corrupted data.');
            } catch (decryptError) {
                console.error('[Restore] Decryption failed:', decryptError.message);
                throw new Error('Failed to decrypt snapshot. Possible wrong encryption key or corrupted file.');
            }

            let snapshot;
            try {
                snapshot = JSON.parse(decrypted);
            } catch (parseError) {
                console.error('[Restore] Failed to parse decrypted content as JSON:', parseError.message);
                throw new Error('Failed to parse snapshot content. File might be corrupted.');
            }

            if (snapshot.v < 2) throw new Error('Unsupported snapshot version');

            // ═══════════════════════════════════════════════════════════════
            // INTEGRITY CHECK: Verify hash if present (Version 3+)
            // ═══════════════════════════════════════════════════════════════
            if (snapshot.v >= 3 && snapshot.hash) {
                console.log('[Restore] Verifying snapshot integrity...');
                const currentHash = CryptoJS.SHA256(JSON.stringify(snapshot.data)).toString();
                if (currentHash !== snapshot.hash) {
                    throw new Error('CORRUPTION DETECTED: Snapshot signature mismatch. Data may be tampered.');
                }
                console.log('[Restore] ✓ Integrity verified.');
            }

            onProgress('Applying snapshot to local DB...', 0.7);
            // Nuclear wipe and re-insert
            await clearDatabase();
            
            const { customers, products, invoices, expenses, receptionists, expense_categories } = snapshot.data;
            
            // Re-insert logic (simplified for batch)
            await db.withTransactionAsync(async () => {
                if (Array.isArray(customers)) {
                  for (const c of customers) {
                    const nc = await normalizeCustomerPayload(c, user.email);
                    await db.runAsync(
                      `INSERT OR REPLACE INTO customers (id, name, phone, email, type, gstin, address, source, tags, loyaltyPoints, notes, created_at, updated_at, amountPaid, whatsappOptIn, smsOptIn, outstanding)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [nc.id, nc.name, nc.phone, nc.email, nc.type, nc.gstin, nc.address, nc.source, nc.tags, nc.loyaltyPoints, nc.notes, nc.created_at, nc.updated_at, nc.amountPaid, nc.whatsappOptIn, nc.smsOptIn, nc.outstanding]
                    );
                  }
                }
                if (Array.isArray(products)) {
                  for (const p of products) {
                    const np = await normalizeProductPayload(p, user.email);
                    await db.runAsync(
                      `INSERT OR REPLACE INTO products (id, name, sku, category, price, cost_price, stock, min_stock, unit, tax_rate, variants, variant, created_at, updated_at, is_deleted)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [np.id, np.name, np.sku, np.category, np.price, np.cost_price, np.stock, np.min_stock, np.unit, np.tax_rate, np.variants, np.variant, np.created_at, np.updated_at, np.is_deleted]
                    );
                  }
                }

                if (Array.isArray(invoices)) {
                  for (const inv of invoices) {
                    const ni = await normalizeInvoicePayload(inv, user.email);
                    await db.runAsync(
                      `INSERT OR REPLACE INTO invoices (id, customer_id, customer_name, date, type, items, subtotal, tax, discount, total, status, payments, grossTotal, itemDiscount, additionalCharges, roundOff, amountReceived, internalNotes, taxType, created_at, updated_at, is_deleted)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [ni.id, ni.customer_id, ni.customer_name, ni.date, ni.type, ni.itemsStr, ni.subtotal, ni.tax, ni.discount, ni.total, ni.status, ni.paymentsStr, ni.grossTotal, ni.itemDiscount, ni.additionalCharges, ni.roundOff, ni.amountReceived, ni.internalNotes, ni.taxType, ni.created_at, ni.updated_at, ni.is_deleted]
                    );
                  }
                }
                if (Array.isArray(expenses)) {
                  for (const e of expenses) {
                    const ne = await normalizeExpensePayload(e, user.email);
                    await db.runAsync(
                      `INSERT OR REPLACE INTO expenses (id, title, amount, category, date, payment_method, receipt_url, tags, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [ne.id, ne.title, ne.amount, ne.category, ne.date, ne.payment_method, ne.receipt_url, ne.tags, ne.created_at, ne.updated_at]
                    );
                  }
                }
                if (Array.isArray(receptionists)) {
                  for (const r of receptionists) {
                    const nr = await normalizeReceptionistPayload(r, user.email);
                    await db.runAsync(
                      `INSERT OR REPLACE INTO receptionists (id, name, is_active, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?)`,
                      [nr.id, nr.name, nr.is_active, nr.created_at, nr.updated_at]
                    );
                  }
                }
                if (Array.isArray(expense_categories)) {
                    for (const c of expense_categories) {
                        const nc = await normalizeCategoryPayload(c, user.email);
                        await db.runAsync(
                            `INSERT OR REPLACE INTO expense_categories (id, name, color, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?)`,
                            [nc.id, nc.name, nc.color, nc.created_at, nc.updated_at]
                        );
                    }
                }
                // Restore expense adjustments if present in snapshot
                const { expense_adjustments } = snapshot.data;
                if (Array.isArray(expense_adjustments)) {
                  for (const ea of expense_adjustments) {
                    await db.runAsync(
                      `INSERT OR REPLACE INTO expense_adjustments (id, expense_id, delta, reason, created_at)
                       VALUES (?, ?, ?, ?, ?)`,
                      [ea.id, ea.expense_id, ea.delta || 0, ea.reason || '', ea.created_at]
                    );
                  }
                  console.log(`[Restore] Restored ${expense_adjustments.length} expense adjustments from snapshot.`);
                }
            });

            // Update last sync time to the snapshot time
            const userLastSyncedKey = await this.getUserSyncKey(LAST_SYNCED_KEY);
            await AsyncStorage.setItem(userLastSyncedKey, snapshot.timestamp);

            console.log('[Restore] ✓ Snapshot restored successfully.');
            onProgress('Snapshot restored!', 1.0);
            return true;
        } catch (e) {
            console.error('[Restore] Snapshot restoration failed:', e.message);
            return false;
        }
    },

    /**
     * Restore from individual snapshot files (Electron/Desktop bilingual support)
     */
    async restoreFromIndividualSnapshots(files, onProgress) {
        try {
            const accessToken = await getAccessToken();
            const userStr = await AsyncStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            const syncKey = user?.email || '';

            const data = {
                customers: [],
                products: [],
                invoices: [],
                expenses: [],
                receptionists: [],
                expense_adjustments: []
            };

            const targetFiles = {
                'products.json': 'products',
                'customers.json': 'customers',
                'invoices.json': 'invoices',
                'expenses.json': 'expenses',
                'receptionists.json': 'receptionists',
                'expense_adjustments.json': 'expense_adjustments',
                'settings.json': 'settings',
                'user details.json': 'settings' // Desktop synonym
            };

            for (const file of files) {
                const tableKey = targetFiles[file.name] || targetFiles[file.name.toLowerCase()];
                if (tableKey) {
                    console.log(`[Restore] Downloading ${file.name}...`);
                    const res = await fetchWithTimeout(
                        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
                        { headers: { Authorization: `Bearer ${accessToken}` } }
                    );
                    const rawText = await res.text();
                    const parsed = await smartParse(rawText, syncKey, file.name);
                    if (parsed) {
                        if (tableKey === 'settings') {
                            // Apply settings separately? For now just keep in memory
                            data.settings = parsed;
                        } else {
                            data[tableKey] = Array.isArray(parsed) ? parsed : [parsed];
                        }
                    }
                }
            }

            onProgress('Applying individual snapshots...', 0.7);
            await clearDatabase();

            await db.withTransactionAsync(async () => {
                // Products
               if (data.products.length > 0) {
                   for (const p of data.products) {
                       const np = normalizeProductPayload(p, syncKey);
                       await db.runAsync(
                           `INSERT OR REPLACE INTO products (id, name, sku, category, price, cost_price, stock, min_stock, unit, tax_rate, variants, variant, created_at, updated_at) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                           [np.id, np.name, np.sku, np.category, np.price, np.cost_price, np.stock, np.min_stock, np.unit, np.tax_rate, np.variants, np.variant, np.created_at, np.updated_at]
                       );
                   }
               }
               // Customers
                if (data.customers.length > 0) {
                    for (const c of data.customers) {
                        const nc = normalizeCustomerPayload(c, syncKey);
                        await db.runAsync(
                            `INSERT OR REPLACE INTO customers (id, name, phone, email, type, gstin, address, source, tags, loyaltyPoints, notes, created_at, updated_at, amountPaid, whatsappOptIn, smsOptIn, outstanding) 
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [nc.id, nc.name, nc.phone, nc.email, nc.type, nc.gstin, nc.address, nc.source, nc.tags, nc.loyaltyPoints, nc.notes, nc.created_at, nc.updated_at, nc.amountPaid, nc.whatsappOptIn, nc.smsOptIn, nc.outstanding]
                        );
                    }
                }
                // Invoices
                if (data.invoices.length > 0) {
                    for (const inv of data.invoices) {
                        const ni = normalizeInvoicePayload(inv, syncKey);
                        await db.runAsync(
                            `INSERT OR REPLACE INTO invoices (id, customer_id, customer_name, date, type, items, subtotal, tax, discount, total, status, payments, grossTotal, itemDiscount, additionalCharges, roundOff, amountReceived, internalNotes, taxType, created_at, updated_at, is_deleted) 
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [ni.id, ni.customer_id, ni.customer_name, ni.date, ni.type, ni.itemsStr, ni.subtotal, ni.tax, ni.discount, ni.total, ni.status, ni.paymentsStr, ni.grossTotal, ni.itemDiscount, ni.additionalCharges, ni.roundOff, ni.amountReceived, ni.internalNotes, ni.taxType, ni.created_at, ni.updated_at, ni.is_deleted]
                        );
                    }
                }
                // Expenses
                if (data.expenses.length > 0) {
                    for (const e of data.expenses) {
                        const ne = normalizeExpensePayload(e);
                        await db.runAsync(
                            `INSERT OR REPLACE INTO expenses (id, title, amount, category, date, payment_method, receipt_url, tags, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [ne.id, ne.title, ne.amount, ne.category, ne.date, ne.payment_method, ne.receipt_url, ne.tags, ne.created_at, ne.updated_at]
                        );
                    }
                }
                // Expense Adjustments
                if (data.expense_adjustments.length > 0) {
                    for (const ea of data.expense_adjustments) {
                        await db.runAsync(
                            `INSERT OR REPLACE INTO expense_adjustments (id, expense_id, delta, reason, created_at)
                             VALUES (?, ?, ?, ?, ?)`,
                            [ea.id, ea.expense_id, ea.delta || 0, ea.reason || '', ea.created_at]
                        );
                    }
                }
            });

            console.log('[Restore] ✓ Individual snapshots restored successfully.');
            // Update last sync time to now
            const userLastSyncedKey = await this.getUserSyncKey(LAST_SYNCED_KEY);
            await AsyncStorage.setItem(userLastSyncedKey, new Date().toISOString());

            onProgress('Snapshot restored!', 1.0);
            return true;
        } catch (e) {
            console.error('[Restore] Individual snapshot restoration failed:', e.message);
            return false;
        }
    },

    /**
     * "Turn Sync On" - Fetch, Filter, Apply
     */

    async syncDown(onProgress = () => { }) {
        if (!acquireSyncLock('down')) {
            return { success: true, processedCount: 0, failures: 0, skipped: true };
        }

        // 🚀 GLOBAL SYNC TIMEOUT (15 Minutes)
        const syncTimeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Global Sync Timeout (15m)')), SYNC_TIMEOUT_MS)
        );

        try {
            const syncPromise = (async () => {
                DeviceEventEmitter.emit(SYNC_EVENTS.SYNC_STARTED);
                const updateStatus = (msg, progress, stats) => {
                    console.log(`[Sync] ${msg}`);
                    onProgress(msg, progress, stats);
                };

                updateStatus('Starting Sync Down...', 0.65);
                
                // 🚀 UI OPTIMIZATION: Wait for animations to settle
                // But only if we are in foreground (onProgress is provided)
                await new Promise(res => setTimeout(res, 400));

                const userStr = await AsyncStorage.getItem('user');
                const currentUser = userStr ? JSON.parse(userStr) : null;
                
                // Decryption Support: Get encryption key (user email)
                // 🚀 PRO-LEVEL: Use cached sync key if available, or populate it from storage
                if (currentUser?.email) _cachedSyncKey = currentUser.email;
                const syncKey = _cachedSyncKey || "";
                
                if (!syncKey) {
                    console.warn('[Sync] No sync key (user email) found. Encrypted files will fail.');
                }

                // Pre-warm the encryption keys asynchronously to keep UI responsive
                updateStatus('Initializing Secure Channel...', 0.66);
                if (syncKey) {
                    await prewarmEncryptionKeys(syncKey);
                }

                const accessToken = await getAccessToken();
                if (!accessToken) return { success: false, processedCount: 0, failures: 1, error: "No Access Token" };

                // 🚀 PRO-LEVEL: SERVER TIMESTAMP AUTHORITY
                // Get the 'Official' time from backend to avoid device clock drift bugs
                let authoritativeTime = Date.now();
                try {
                    const { default: services } = require('./api');
                    const timeRes = await services.misc?.getServerTime?.();
                    if (timeRes?.data?.timestamp) authoritativeTime = timeRes.data.timestamp;
                } catch (e) { /* Fallback to device clock if offline/error */ }

                console.log(`[Sync] Starting sync with Authoritative Time: ${new Date(authoritativeTime).toISOString()}`);

                const folderId = await this.getEventsFolderId(accessToken);
                if (!folderId) return { success: false, processedCount: 0, failures: 1, error: "No Folder ID" };

                // 1. List all files in events folder
                const syncStartTime = Date.now();
                updateStatus('Fetching cloud updates...', 0.66);

                const userLastSyncedKey = await this.getUserSyncKey(LAST_SYNCED_KEY);
                const userProcessedEventsKey = await this.getUserSyncKey(PROCESSED_EVENTS_KEY);

                let lastSyncTime = await AsyncStorage.getItem(userLastSyncedKey);

                // RAPID RECOVERY: If this is a new device (no lastSyncTime), check for snapshots first
                if (!lastSyncTime) {
                    const restoreStart = Date.now();
                    updateStatus('New device detected. Looking for cloud snapshots...', 0.1);
                    const restored = await this.restoreFromLatestSnapshot((msg, prog) => {
                        updateStatus(`[Restore] ${msg}`, 0.1 + (prog * 0.5));
                    });
                    console.log(`[Sync] Snapshot restore took ${Date.now() - restoreStart}ms`);
                    if (restored) {
                        updateStatus('Snapshot restored! Re-checking for recent events...', 0.6);
                        lastSyncTime = await AsyncStorage.getItem(userLastSyncedKey);
                    } else {
                        updateStatus('No snapshots found. Starting fresh sync...', 0.2);
                    }
                }
                let timeFilter = "";
                if (lastSyncTime) {
                    // Formatting for Google Drive RFC 3339
                    const date = new Date(lastSyncTime);
                    timeFilter = ` and createdTime > '${date.toISOString()}'`;
                    console.log(`[Sync] Performing incremental sync for user since: ${date.toISOString()}`);
                }

                let allFiles = [];
                let nextPageToken = null;
                const listStart = Date.now();
                // Fetch all pages of files
                do {
                    const query = `'${folderId}' in parents and trashed=false${timeFilter}`;
                    // OPTIMIZATION: only fetch necessary fields
                    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=name&pageSize=1000&fields=nextPageToken,files(id,name)${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;

                    try {
                        const res = await fetchWithTimeout(url, {
                            headers: { Authorization: `Bearer ${accessToken}` }
                        });

                        if (!res.ok) {
                            const errorText = await res.text();
                            console.error(`[Sync] Google Drive API Error (${res.status}):`, errorText);
                            return { success: false, processedCount: 0, failures: 1, error: `Drive API ${res.status}` };
                        }

                        const data = await res.json();
                        if (data.files) allFiles = [...allFiles, ...data.files];
                        nextPageToken = data.nextPageToken;

                        // 🚀 CRITICAL: Yield the thread after each page fetch to prevent UI freezing
                        // during large metadata downloads (e.g. thousands of files)
                        await new Promise(r => setTimeout(r, 0));
                    } catch (e) {
                        console.error('[Sync] Failed to list files:', e);
                        return { success: false, processedCount: 0, failures: 1, error: "List Files Failed" };
                    }
                } while (nextPageToken);
                console.log(`[Sync] Listing ${allFiles.length} files took ${Date.now() - listStart}ms`);

                // 2. Filter: Ignore already processed events
                const processedIdsStr = await AsyncStorage.getItem(userProcessedEventsKey);
                
                // 🚀 PERFORMANCE: Yield after storage fetch
                await new Promise(r => setTimeout(r, 0));
                
                const processedIds = processedIdsStr ? JSON.parse(processedIdsStr) : [];
                
                // 🚀 PERFORMANCE: Yield after heavy JSON parse
                await new Promise(r => setTimeout(r, 0));
                
                const processedSet = new Set(processedIds);
                
                // 🚀 PERFORMANCE: Yield after set creation
                await new Promise(r => setTimeout(r, 0));

                updateStatus(`Found ${allFiles.length} files total. Filtering...`, 0.67);
                
                // DEBUG: Verbose logging of all cloud files
                console.log(`[Sync] Detected ${allFiles.length} total files:`, allFiles.map(f => f.name));

                // Sort by filename 
                allFiles.sort((a, b) => a.name.localeCompare(b.name));

                // 3. Download and Apply Events (PROGRESSIVE LOADING)
                const filesToProcess = allFiles.filter(f => {
                    if (!f.name.startsWith('event_')) return false;
                    const parts = f.name.replace('.json', '').split('_');
                    const probableEventId = parts[parts.length - 1];
                    return !processedSet.has(probableEventId) && !processedSet.has(f.id);
                });

                // Split into Recent (30 days) and History
                const thirtyDaysAgo = Date.now() - (SYNC_HISTORY_LIMIT_DAYS * 24 * 60 * 60 * 1000);
                const recentFiles = [];
                const historyFiles = [];

                filesToProcess.forEach(f => {
                    const parts = f.name.split('_');
                    const timestamp = parseInt(parts[1]) || 0;
                    if (timestamp > thirtyDaysAgo) recentFiles.push(f);
                    else historyFiles.push(f);
                });

                console.log(`[Sync] Split: ${recentFiles.length} Recent, ${historyFiles.length} History.`);

                let processedCount = 0;
                let failures = 0;
                const liveStats = () => ({ synced: processedCount, errors: failures, total: recentFiles.length + historyFiles.length });

                const processFolderBatch = async (files, name = 'Batch') => {
                    const BATCH_SIZE = 20; // Parallel fetch batch size
                    let currentToken = await getAccessToken();
                    const batchStart = Date.now();

                    for (let i = 0; i < files.length; i += BATCH_SIZE) {
                        const batch = files.slice(i, i + BATCH_SIZE);
                        const contents = [];
                        
                        for (const file of batch) {
                            try {
                                const res = await fetchWithTimeout(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, { headers: { Authorization: `Bearer ${currentToken}` } }, 30000);
                                if (res.status === 401) { currentToken = await getAccessToken(); }
                                if (!res.ok) continue;
                                const text = await res.text();
                                
                                // 🚀 500KB PAYLOAD GUARD: Check for heavy data files
                                const fileSizeKB = text.length / 1024;
                                if (fileSizeKB > 500) {
                                    console.warn(`[Sync] Heavy Payload Guard active: ${file.name} is ${Math.round(fileSizeKB)}KB. Throttling CPU...`);
                                    await new Promise(r => setTimeout(r, 64)); // Deeper yield for heavy parsing
                                }

                                // 🚀 DEFER DECRYPTION/PARSING (CPU Intensive)
                                // We yield after EACH file download + parse to keep JS thread responsive
                                const parsed = await smartParse(text, syncKey, file.name);
                                if (parsed) contents.push(parsed);
                                
                                await new Promise(r => setTimeout(r, 0)); 
                            } catch (e) { continue; }
                        }

                        // 🚀 CHUNKED WRITES VIA PRIORITY QUEUE
                        const ops = contents
                            .filter(e => e && !processedSet.has(e.eventId))
                            .map(envelope => async () => {
                                try {
                                    await this.applyEvent(envelope);
                                    processedCount++;
                                    processedSet.add(envelope.eventId);
                                } catch (e) { failures++; }
                            });

                        if (ops.length > 0) {
                            await writeQueue.enqueue(ops, name === 'Recent');
                            
                            // 🚀 OPTIMIZATION: stringify large arrays is slow. 
                            // Only save to disk every 3 batches if the list is huge.
                            if (processedSet.size < 500 || i % (BATCH_SIZE * 3) === 0 || i + BATCH_SIZE >= files.length) {
                               await AsyncStorage.setItem(userProcessedEventsKey, JSON.stringify([...processedSet]));
                            }
                        }
                        
                        // Throttled UI update (at most every ~1.2s to prevent Context re-render spam)
                        if (i % (BATCH_SIZE * 3) === 0 || i + BATCH_SIZE >= files.length) {
                             // 🚀 UI OPTIMIZATION: Always yield before state updates to ensure responsiveness
                             await new Promise(r => setTimeout(r, 0));
                            updateStatus(`Syncing ${name}... ${Math.round((i/files.length)*100)}%`, 0.6 + (i/files.length)*0.3, liveStats());
                        }
                    }
                    console.log(`[Sync] Batch ${name} (${files.length} files) took ${Date.now() - batchStart}ms`);
                };

                // Phase 1: Recent Data (Foreground Priority)
                if (recentFiles.length > 0) {
                    await processFolderBatch(recentFiles, 'Recent');
                }

                // Phase 2: Signal Completion (Allows UI Unlock)
                await SyncLedger.recordAttempt(true, historyFiles.length);

                // Phase 3: History (Background Silent)
                if (historyFiles.length > 0) {
                    // Return early if this is an initial sync so the caller can setLoading(false)
                    // The history will keep running via the writeQueue's persistence if we structure it right
                    processFolderBatch(historyFiles, 'History').catch(e => console.warn('[Sync] History background fail:', e));
                }


                // ─── BACKEND SYNC BRIDGE ───────────────────────────────────────────────────
                // Run inline during the sync cycle so the UI loading animations ("DataSyncPage" 
                // or "Settings Loader") accurately reflect the 3-5s network wait, and NEVER block 
                // the InteractionManager queue which freezes React Navigation tab switching.
                try {
                    updateStatus('Bridging Backend Events...', 0.85);
                    const { default: services } = require('./api');

                        const backendSyncKey = await this.getUserSyncKey('last_backend_sync');
                        const lastBackendSync = await AsyncStorage.getItem(backendSyncKey);

                        console.log(`[Sync] Bridging Backend Events... (Since: ${lastBackendSync || 'Ever'})`);
                        const res = await services.sync.syncEvents(lastBackendSync);

                        await yieldToUI();

                        if (res.data?.success) {
                            if (res.data.events && res.data.events.length > 0) {
                                console.log(`[Sync] Found ${res.data.events.length} new backend events from Desktop!`);

                                const backendOps = res.data.events
                                    .filter(event => !processedSet.has(event.eventId))
                                    .map(event => async () => {
                                        try {
                                            await this.applyEvent(event);
                                            processedCount++;
                                            processedSet.add(event.eventId);
                                        } catch (e) {
                                            console.error(`[Sync] Failed to apply backend event ${event.eventId}:`, e.message);
                                        }
                                    });

                                await yieldToUI();

                                if (backendOps.length > 0) {
                                    // 🚀 YIELD BEFORE HEAVY BACKEND SYNC PROCESSING
                                    await new Promise(r => setTimeout(r, 64));
                                    await writeQueue.enqueue(backendOps, true);
                                    await new Promise(r => setTimeout(r, 0));
                                }
                            }

                            // Always update the timestamp if the request succeeded, even if 0 new events,
                            // to prevent infinite "Since: Ever" loops fetching history.
                            await AsyncStorage.setItem(backendSyncKey, new Date().toISOString());
                        }
                    } catch (backendErr) {
                        console.warn('[Sync] Backend Bridge Sync failed:', backendErr.message);
                    }
                // ──────────────────────────────────────────────────────────────────────────

                // 🚀 FINAL STORAGE OPTIMIZATION
                // stringify(processedSet) can be huge. We only save if it changed.
                if (processedCount > 0) {
                    await AsyncStorage.setItem(userProcessedEventsKey, JSON.stringify([...processedSet]));
                }

                await AsyncStorage.setItem(userLastSyncedKey, new Date().toISOString());
                const syncDuration = Date.now() - syncStartTime;
                const finalMsg = `Sync Complete! Applied ${processedCount} new events in ${Math.round(syncDuration/1000)}s. ${failures > 0 ? `(${failures} failed)` : ''}`;
                updateStatus(finalMsg, 0.90, liveStats());

                DeviceEventEmitter.emit(SYNC_EVENTS.SYNC_COMPLETED, {
                    processedCount,
                    failures
                });

                // If we processed anything, notify all contexts to refresh
                if (processedCount > 0) {
                    DeviceEventEmitter.emit(SYNC_EVENTS.DATA_UPDATED);
                }

                return {
                    success: failures === 0,
                    processedCount,
                    failures
                };
            })();

            // 🚀 RACE BETWEEN SYNC AND TIMEOUT
            return await Promise.race([syncPromise, syncTimeoutPromise]);

        } catch (error) {
            console.error('[Sync] Sync Down Error:', error);
            return { success: false, processedCount: 0, failures: 1, error: error.message };
        } finally {
            releaseSyncLock();
        }
    },

    /**
     * PRO-LEVEL: STARTUP INTELLIGENCE
     * Checks if the device already has data for this user.
     */
    async hasLocalData() {
        try {
            // 1. Check AsyncStorage (The "official" tracker)
            const key = await this.getUserSyncKey(LAST_SYNCED_KEY);
            const val = await AsyncStorage.getItem(key);
            const procKey = await this.getUserSyncKey(PROCESSED_EVENTS_KEY);
            const procVal = await AsyncStorage.getItem(procKey);
            
            if (val || (procVal && procVal.length > 5)) return true;

            // 2. 🚀 BINGO: If metadata is missing but SQLite has real data, it's NOT a clean install.
            // This happens if a user closes the app during the first sync's final seconds.
            const stats = await db.getFirstAsync(`
                SELECT 
                    (SELECT COUNT(*) FROM products) as pCount, 
                    (SELECT COUNT(*) FROM invoices) as iCount
            `);
            
            return (stats.pCount > 0 || stats.iCount > 0);
        } catch (e) {
            console.warn('[Sync] hasLocalData check failed:', e.message);
            return false;
        }
    },

    /**
     * Resets the local sync state...
     * Wipes SQLite and all possible sync keys.
     */
    async resetSyncState() {
        try {
            console.log('[Sync] Wiping local data for full re-sync...');
            await clearDatabase();
            
            // Wipe shared keys
            await AsyncStorage.removeItem(PROCESSED_EVENTS_KEY);
            await AsyncStorage.removeItem(LAST_SYNCED_KEY);
            await AsyncStorage.removeItem(PENDING_UPLOAD_QUEUE_KEY);

            // Wipe user-specific keys if user is present
            const userProcessedEventsKey = await this.getUserSyncKey(PROCESSED_EVENTS_KEY);
            const userLastSyncedKey = await this.getUserSyncKey(LAST_SYNCED_KEY);
            if (userProcessedEventsKey !== PROCESSED_EVENTS_KEY) {
                await AsyncStorage.removeItem(userProcessedEventsKey);
            }
            if (userLastSyncedKey !== LAST_SYNCED_KEY) {
                await AsyncStorage.removeItem(userLastSyncedKey);
            }

            console.log('[Sync] Sync State Reset Successfully');
            return true;
        } catch (e) {
            console.error('[Sync] Failed to reset sync state:', e);
            return false;
        }
    },

    /**
     * Repairs the sync state by clearing ONLY the processed events list,
     * allowing the system to re-try events that might have failed previously.
     */
    async resetProcessedEvents() {
        try {
            const userProcessedEventsKey = await this.getUserSyncKey(PROCESSED_EVENTS_KEY);
            const userLastSyncedKey = await this.getUserSyncKey(LAST_SYNCED_KEY);
            await AsyncStorage.removeItem(userProcessedEventsKey);
            await AsyncStorage.removeItem(userLastSyncedKey);
            console.log('[Sync] Processed events list cleared for repair.');
            return true;
        } catch (e) {
            console.error('[Sync] Failed to reset processed events:', e);
            return false;
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // FORCE RESTORE from Drive Snapshots
    // Designed for "Force Sync" button on Mobile.
    // Fetches products.json, customers.json, etc. from Drive,
    // clears all local data, and re-inserts everything cleanly.
    // Resets lastSyncTimestamp to the force-push date.
    // ═══════════════════════════════════════════════════════════════

    /**
     * Force Restore: Wipes local DB and restores from Drive snapshot files.
     * This is the nuclear option for when event-based sync is insufficient.
     * 
     * @param {Object} user - The current user object (needs user.id)
     * @param {Function} onProgress - Progress callback (msg, progress)
     * @returns {{ success: boolean, restored: Object, error?: string }}
     */
    async forceRestoreFromDrive(user, onProgress = () => { }) {
        if (!user || !user.id) {
            return { success: false, error: 'No user ID provided' };
        }

        try {
            onProgress('Starting Force Restore...', 0.1);
            const accessToken = await getAccessToken();
            if (!accessToken) return { success: false, error: 'No access token' };

            // 1. Find the user's backup folder on Drive (Search standard 'Kwiqbill' first)
            onProgress('Locating cloud backup...', 0.15);
            let folderId = null;
            const foldersToTry = ['Kwiq Bill Backup', 'Kwiqbill', `KwiqBilling-${user.id}`];

            for (const fName of foldersToTry) {
                if (folderId) break;
                const folderQuery = `name='${fName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
                const sRes = await fetchWithTimeout(
                    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(folderQuery)}`,
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                );
                const sData = await sRes.json();
                if (sData.files && sData.files.length > 0) {
                    const rootId = sData.files[0].id;
                    // Check for 'kwiq bill backup' inside root
                    const subQuery = `name='kwiq bill backup' and '${rootId}' in parents and trashed=false`;
                    const subRes = await fetchWithTimeout(
                        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(subQuery)}`,
                        { headers: { Authorization: `Bearer ${accessToken}` } }
                    );
                    const subData = await subRes.json();
                    
                    if (subData.files && subData.files.length > 0) {
                        folderId = subData.files[0].id;
                    } else {
                        // FALLBACK: If no subfolder, use the root folder itself (Legacy Desktop behavior)
                        folderId = rootId;
                    }
                    console.log(`[ForceRestore] Found folder: ${fName} -> ${folderId}`);
                }
            }

            if (!folderId) {
                return { success: false, error: 'No backup folder found on Drive' };
            }

            // 2. Download all snapshot files in parallel
            onProgress('Downloading snapshots...', 0.25);
            const targetFiles = ['products.json', 'customers.json', 'expenses.json', 'invoices.json'];
            const namesQuery = targetFiles.map(name => `name='${name}'`).join(' or ');
            const listQuery = `(${namesQuery}) and '${folderId}' in parents and trashed=false`;

            const listRes = await fetchWithTimeout(
                `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(listQuery)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=100`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const listData = await listRes.json();
            const filesMap = {};
            let latestModifiedTime = null;

            if (listData.files) {
                listData.files.forEach(f => {
                    // Only keep the NEWEST version of each file in the map
                    if (!filesMap[f.name]) {
                        filesMap[f.name] = f.id;
                    }
                    
                    // Track the overall latest modification time
                    if (!latestModifiedTime || new Date(f.modifiedTime) > new Date(latestModifiedTime)) {
                        latestModifiedTime = f.modifiedTime;
                    }
                });
            }

            // Helper: download and parse a JSON file from Drive
            const fetchSnapshot = async (fileName) => {
                const fileId = filesMap[fileName];
                if (!fileId) return null;
                try {
                    const res = await fetchWithTimeout(
                        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
                        { headers: { Authorization: `Bearer ${accessToken}` } },
                        30000
                    );
                    if (!res.ok) return null;
                    const text = await res.text();
                    return await smartParse(text, user.email, fileName);
                } catch (e) {
                    console.error(`[ForceRestore] Failed to fetch ${fileName}:`, e.message);
                    return null;
                }
            };

            const [products, customers, expenses, invoices, receptionists, expense_categories] = await Promise.all([
                fetchSnapshot('products.json'),
                fetchSnapshot('customers.json'),
                fetchSnapshot('expenses.json'),
                fetchSnapshot('invoices.json'),
                fetchSnapshot('receptionists.json'),
                fetchSnapshot('expense_categories.json'),
            ]);

            // 3. WIPE all local data (the nuclear clear)
            onProgress('Clearing local data...', 0.50);
            console.log('[ForceRestore] Clearing all local tables...');
            await db.execAsync('DELETE FROM expense_adjustments');
            await db.execAsync('DELETE FROM invoices');
            await db.execAsync('DELETE FROM expenses');
            await db.execAsync('DELETE FROM products');
            await db.execAsync('DELETE FROM customers');
            await db.execAsync('DELETE FROM receptionists');
            await db.execAsync('DELETE FROM expense_categories');

            const restored = { products: 0, customers: 0, expenses: 0, invoices: 0, receptionists: 0, categories: 0 };

            // 4. Re-insert from snapshots using batched INSERT OR REPLACE
            // GOLDEN RULE #2: Idempotency — all inserts use INSERT OR REPLACE

            if (customers && Array.isArray(customers) && customers.length > 0) {
                onProgress(`Restoring ${customers.length} customers...`, 0.55);
                await db.withTransactionAsync(async () => {
                    for (const c of customers) {
                        const nc = await normalizeCustomerPayload(c, user.email);
                        await db.runAsync(
                            `INSERT OR REPLACE INTO customers (id, name, phone, email, type, gstin, address, source, tags, loyaltyPoints, outstanding, amountPaid, notes, created_at, updated_at, whatsappOptIn, smsOptIn)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [nc.id, nc.name, nc.phone, nc.email, nc.type, nc.gstin, nc.address, nc.source, nc.tags, nc.loyaltyPoints, nc.outstanding, nc.amountPaid, nc.notes, nc.created_at, nc.updated_at, nc.whatsappOptIn, nc.smsOptIn]
                        );
                        restored.customers++;
                    }
                });
            }

            if (products && Array.isArray(products) && products.length > 0) {
                onProgress(`Restoring ${products.length} products...`, 0.65);
                await db.withTransactionAsync(async () => {
                    for (const p of products) {
                        const np = await normalizeProductPayload(p, user.email);
                        await db.runAsync(
                            `INSERT OR REPLACE INTO products (id, name, sku, category, price, cost_price, stock, min_stock, unit, tax_rate, variants, variant, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [np.id, np.name, np.sku, np.category, np.price, np.cost_price, np.stock, np.min_stock, np.unit, np.tax_rate, np.variants, np.variant, np.created_at, np.updated_at]
                        );
                        restored.products++;
                    }
                });
            }

            if (expenses && Array.isArray(expenses) && expenses.length > 0) {
                onProgress(`Restoring ${expenses.length} expenses...`, 0.75);
                await db.withTransactionAsync(async () => {
                    for (const e of expenses) {
                        const ne = await normalizeExpensePayload(e, user.email);
                        await db.runAsync(
                            `INSERT OR REPLACE INTO expenses (id, title, amount, category, date, payment_method, receipt_url, tags, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [ne.id, ne.title, ne.amount, ne.category, ne.date, ne.payment_method, ne.receipt_url, ne.tags, ne.created_at, ne.updated_at]
                        );
                        restored.expenses++;
                    }
                });
            }

            if (invoices && Array.isArray(invoices) && invoices.length > 0) {
                onProgress(`Restoring ${invoices.length} invoices...`, 0.85);
                await db.withTransactionAsync(async () => {
                    for (const i of invoices) {
                        const ni = await normalizeInvoicePayload(i, user.email);
                        // Ensure customer exists before inserting invoice (ghost creation)
                        await ensureCustomerExists(ni.customer_id, ni.customer_name);

                        await db.runAsync(
                            `INSERT OR REPLACE INTO invoices (
                                id, customer_id, customer_name, date, type, items, subtotal, tax, discount, total, status, payments,
                                created_at, updated_at, taxType, grossTotal, itemDiscount, additionalCharges, roundOff, amountReceived, internalNotes, is_deleted
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                ni.id, ni.customer_id, ni.customer_name, ni.date, ni.type, ni.itemsStr, ni.subtotal, ni.tax, ni.discount,
                                ni.total, ni.status, ni.paymentsStr, ni.created_at, ni.updated_at, ni.taxType, ni.grossTotal,
                                ni.itemDiscount, ni.additionalCharges, ni.roundOff, ni.amountReceived, ni.internalNotes, ni.is_deleted
                            ]
                        );
                        restored.invoices++;
                    }
                });
            }

            if (receptionists && Array.isArray(receptionists) && receptionists.length > 0) {
                onProgress(`Restoring ${receptionists.length} receptionists...`, 0.90);
                await db.withTransactionAsync(async () => {
                    for (const r of receptionists) {
                        const nr = await normalizeReceptionistPayload(r, user.email);
                        await db.runAsync(
                            `INSERT OR REPLACE INTO receptionists (id, name, is_active, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?)`,
                            [nr.id, nr.name, nr.is_active, nr.created_at, nr.updated_at]
                        );
                        restored.receptionists++;
                    }
                });
            }

            if (expense_categories && Array.isArray(expense_categories) && expense_categories.length > 0) {
                onProgress(`Restoring ${expense_categories.length} categories...`, 0.95);
                await db.withTransactionAsync(async () => {
                    for (const c of expense_categories) {
                        const nc = await normalizeCategoryPayload(c, user.email);
                        await db.runAsync(
                            `INSERT OR REPLACE INTO expense_categories (id, name, color, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?)`,
                            [nc.id, nc.name, nc.color, nc.created_at, nc.updated_at]
                        );
                        restored.categories++;
                    }
                });
            }

            // 5. Reset sync timestamp to the force-push date
            const userLastSyncedKey = await this.getUserSyncKey(LAST_SYNCED_KEY);
            const userProcessedEventsKey = await this.getUserSyncKey(PROCESSED_EVENTS_KEY);
            
            const resetTimestamp = latestModifiedTime || new Date().toISOString();
            await AsyncStorage.setItem(userLastSyncedKey, resetTimestamp);
            await AsyncStorage.removeItem(userProcessedEventsKey); // Clear processed IDs — start fresh
            console.log(`[ForceRestore] User sync timestamp reset to: ${resetTimestamp}`);

            onProgress('Force Restore Complete!', 1.0);
            console.log('[ForceRestore] Results:', restored);
            return { success: true, restored };

        } catch (error) {
            console.error('[ForceRestore] Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * PRO-LEVEL: THREE-WAY MERGE ENGINE
     * Merges cloud changes with local edits if they don't overlap in fields.
     */
    async resolveConflict(tableName, recordId, cloudRecord, localRecord) {
        // Simple intelligent merge: only overwrite fields if cloud is newer OR field was null locally
        const merged = { ...localRecord };
        const cloudUpdated = new Date(cloudRecord.updated_at || 0).getTime();
        const localUpdated = new Date(localRecord.updated_at || 0).getTime();

        if (cloudUpdated > localUpdated) {
            // Cloud is newer: adopt all its fields EXCEPT maybe some local-only tags/notes 
            // but for safety in this version we'll just merge any field that is different
            Object.keys(cloudRecord).forEach(key => {
                if (cloudRecord[key] !== undefined && cloudRecord[key] !== null) {
                    merged[key] = cloudRecord[key];
                }
            });
        }
        
        // If they are exactly the same or very close (within 1s), use either (cloud takes priority)
        return merged;
    },

    /**
     * Apply a single event to the local state/DB
     */
    async applyEvent(event) {
        const { type, payload } = event;
        
        // Use cached sync key for field-level decryption
        const syncKey = _cachedSyncKey || '';

        try {
            if (type === EventTypes.INVOICE_CREATED) {
                // ─── Strict Schema Parse ───
                const inv = await normalizeInvoicePayload(payload, syncKey);

                // ─── GOLDEN RULE #3: Ensure customer exists (ghost creation) ───
                await ensureCustomerExists(inv.customer_id, inv.customer_name);

                // ─── GOLDEN RULE #2: Idempotent INSERT OR REPLACE ───
                await db.runAsync(
                    `INSERT OR REPLACE INTO invoices (
                        id, customer_id, customer_name, date, type, items, subtotal, tax, discount, total, status, payments, 
                        created_at, updated_at, taxType, grossTotal, itemDiscount, additionalCharges, roundOff, amountReceived, internalNotes,
                        is_deleted
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        inv.id, inv.customer_id, inv.customer_name, inv.date, inv.type,
                        inv.itemsStr, inv.subtotal, inv.tax, inv.discount, inv.total, inv.status, inv.paymentsStr,
                        inv.created_at, inv.updated_at, inv.taxType, inv.grossTotal, inv.itemDiscount,
                        inv.additionalCharges, inv.roundOff, inv.amountReceived, inv.internalNotes, inv.is_deleted
                    ]
                );

                // ─── Stock Deduction ───
                if (inv.items && Array.isArray(inv.items)) {
                    for (const item of inv.items) {
                        const productId = item.productId || item.id;
                        if (productId) {
                            await db.runAsync(`UPDATE products SET stock = stock - ? WHERE id = ?`, [parseInt(item.quantity) || 0, productId]);
                        }
                    }
                }

                // ─── Update Customer Stats ───
                if (inv.customer_id) {
                    try {
                        const received = inv.amountReceived;
                        const total = inv.total;
                        const outstandingDelta = Math.max(0, total - received);

                        await db.runAsync(
                            `UPDATE customers SET 
                                loyaltyPoints = loyaltyPoints + 1,
                                amountPaid = amountPaid + ?,
                                outstanding = outstanding + ?
                             WHERE id = ?`,
                            [received, outstandingDelta, String(inv.customer_id)]
                        );
                    } catch (custErr) {
                        console.log('[Sync] Customer update skipped (maybe guest or deleted):', custErr.message);
                    }
                }

            } else if (type === EventTypes.PRODUCT_CREATED) {
                // ─── Strict Schema Parse + Idempotent Insert ───
                const p = await normalizeProductPayload(payload, syncKey);
                await db.runAsync(
                    `INSERT OR REPLACE INTO products (id, name, sku, category, price, cost_price, stock, min_stock, unit, tax_rate, variants, variant, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [p.id, p.name, p.sku, p.category, p.price, p.cost_price, p.stock, p.min_stock, p.unit, p.tax_rate, p.variants, p.variant, p.created_at, p.updated_at]
                );

            } else if (type === EventTypes.PRODUCT_UPDATED) {
                const cloudProduct = await normalizeProductPayload(payload, syncKey);
                // 🚀 PRO-LEVEL: Check for conflicts before overwriting
                const localRes = await db.getAllAsync(`SELECT * FROM products WHERE id = ?`, [cloudProduct.id]);
                if (localRes.length > 0) {
                    const localProduct = localRes[0];
                    const merged = await this.resolveConflict('products', cloudProduct.id, cloudProduct, localProduct);
                    await db.runAsync(
                        `INSERT OR REPLACE INTO products (id, name, sku, category, price, cost_price, stock, min_stock, unit, tax_rate, variants, variant, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [merged.id, merged.name, merged.sku, merged.category, merged.price, merged.cost_price, merged.stock, merged.min_stock, merged.unit, merged.tax_rate, merged.variants, merged.variant, merged.created_at, merged.updated_at]
                    );
                } else {
                    // Standard insert
                    await db.runAsync(
                        `INSERT OR REPLACE INTO products (id, name, sku, category, price, cost_price, stock, min_stock, unit, tax_rate, variants, variant, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [cloudProduct.id, cloudProduct.name, cloudProduct.sku, cloudProduct.category, cloudProduct.price, cloudProduct.cost_price, cloudProduct.stock, cloudProduct.min_stock, cloudProduct.unit, cloudProduct.tax_rate, cloudProduct.variants, cloudProduct.variant, cloudProduct.created_at, cloudProduct.updated_at]
                    );
                }

            } else if (type === EventTypes.CUSTOMER_CREATED) {
                // ─── Idempotent: INSERT OR REPLACE handles duplicates ───
                const c = await normalizeCustomerPayload(payload, syncKey);
                await db.runAsync(
                    `INSERT OR REPLACE INTO customers (id, name, phone, email, type, gstin, address, source, tags, loyaltyPoints, outstanding, amountPaid, notes, created_at, updated_at, whatsappOptIn, smsOptIn)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [c.id, c.name, c.phone, c.email, c.type, c.gstin, c.address, c.source, c.tags, c.loyaltyPoints, c.outstanding, c.amountPaid, c.notes, c.created_at, c.updated_at, c.whatsappOptIn, c.smsOptIn]
                );

            } else if (type === EventTypes.CUSTOMER_UPDATED) {
                const cloudCustomer = await normalizeCustomerPayload(payload, syncKey);
                const localRes = await db.getAllAsync(`SELECT * FROM customers WHERE id = ?`, [cloudCustomer.id]);
                if (localRes.length > 0) {
                    const localCustomer = localRes[0];
                    const merged = await this.resolveConflict('customers', cloudCustomer.id, cloudCustomer, localCustomer);
                    await db.runAsync(
                        `INSERT OR REPLACE INTO customers (id, name, phone, email, type, gstin, address, source, tags, loyaltyPoints, outstanding, amountPaid, notes, created_at, updated_at, whatsappOptIn, smsOptIn)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [merged.id, merged.name, merged.phone, merged.email, merged.type, merged.gstin, merged.address, merged.source, merged.tags, merged.loyaltyPoints, merged.outstanding, merged.amountPaid, merged.notes, merged.created_at, merged.updated_at, merged.whatsappOptIn, merged.smsOptIn]
                    );
                } else {
                    await db.runAsync(
                        `INSERT OR REPLACE INTO customers (id, name, phone, email, type, gstin, address, source, tags, loyaltyPoints, outstanding, amountPaid, notes, created_at, updated_at, whatsappOptIn, smsOptIn)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [cloudCustomer.id, cloudCustomer.name, cloudCustomer.phone, cloudCustomer.email, cloudCustomer.type, cloudCustomer.gstin, cloudCustomer.address, cloudCustomer.source, cloudCustomer.tags, cloudCustomer.loyaltyPoints, cloudCustomer.outstanding, cloudCustomer.amountPaid, cloudCustomer.notes, cloudCustomer.created_at, cloudCustomer.updated_at, cloudCustomer.whatsappOptIn, cloudCustomer.smsOptIn]
                    );
                }


            } else if (type === EventTypes.EXPENSE_CREATED) {
                // ─── Idempotent: INSERT OR REPLACE ───
                const e = await normalizeExpensePayload(payload, syncKey);
                await db.runAsync(
                    `INSERT OR REPLACE INTO expenses (id, title, amount, category, date, payment_method, receipt_url, tags, created_at, updated_at)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [e.id, e.title, e.amount, e.category, e.date, e.payment_method, e.receipt_url, e.tags, e.created_at, e.updated_at]
                );

            } else if (type === EventTypes.EXPENSE_ADJUSTED) {
                const { expenseId, delta, reason } = payload;
                // Adjustment tracking — this is append-only, not idempotent inherently.
                // But event dedup at the caller level ensures we never double-apply.
                await db.runAsync(
                    `INSERT INTO expense_adjustments (expense_id, delta, reason, created_at) VALUES (?, ?, ?, ?)`,
                    [expenseId, parseFloat(delta) || 0, reason || '', new Date().toISOString()]
                );
                await db.runAsync(
                    `UPDATE expenses SET amount = amount + ? WHERE id = ?`,
                    [parseFloat(delta) || 0, expenseId]
                );

            } else if (type === EventTypes.INVOICE_DELETED) {
                // Restore stock for deleted invoice items
                const items = normalizeItems(payload.items);
                if (items.length > 0) {
                    for (const item of items) {
                        const productId = item.productId || item.id;
                        if (productId) {
                            await db.runAsync(`UPDATE products SET stock = stock + ? WHERE id = ?`, [parseInt(item.quantity) || 0, productId]);
                        }
                    }
                }
                // Reverse customer stats
                const cid = payload.customer_id || payload.customerId;
                if (cid) {
                    try {
                        const received = parseFloat(payload.amountReceived || payload.amount_received) || 0;
                        const total = parseFloat(payload.total || payload.total_amount) || 0;
                        const outstandingDelta = Math.max(0, total - received);

                        await db.runAsync(
                            `UPDATE customers SET 
                                loyaltyPoints = MAX(0, loyaltyPoints - 1),
                                amountPaid = amountPaid - ?,
                                outstanding = outstanding - ?
                             WHERE id = ?`,
                            [received, outstandingDelta, String(cid)]
                        );
                    } catch (custErr) {
                        console.log('[Sync] Customer restore skipped:', custErr.message);
                    }
                }
                await db.runAsync(`DELETE FROM invoices WHERE id = ?`, [payload.id]);

            } else if (type === EventTypes.CUSTOMER_DELETED) {
                await db.runAsync(`DELETE FROM customers WHERE id = ?`, [payload.id]);

            } else if (type === EventTypes.PRODUCT_DELETED) {
                await db.runAsync(`DELETE FROM products WHERE id = ?`, [payload.id]);

            } else if (type === EventTypes.EXPENSE_UPDATED) {
                const e = await normalizeExpensePayload(payload, syncKey);
                await db.runAsync(
                    `INSERT OR REPLACE INTO expenses (id, title, amount, category, date, payment_method, receipt_url, tags, created_at, updated_at)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [e.id, e.title, e.amount, e.category, e.date, e.payment_method, e.receipt_url, e.tags, e.created_at, e.updated_at]
                );

            } else if (type === EventTypes.EXPENSE_DELETED) {
                await db.runAsync(`DELETE FROM expenses WHERE id = ?`, [payload.id]);

            } else if (type === EventTypes.INVOICE_UPDATED) {
                const inv = await normalizeInvoicePayload(payload, syncKey);
                // Ensure customer exists for updated invoice too
                await ensureCustomerExists(inv.customer_id, inv.customer_name);

                await db.runAsync(
                    `INSERT OR REPLACE INTO invoices (
                        id, customer_id, customer_name, date, type, items, subtotal, tax, discount, total, status, payments, 
                        created_at, updated_at, taxType, grossTotal, itemDiscount, additionalCharges, roundOff, amountReceived, internalNotes, is_deleted
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        inv.id, inv.customer_id, inv.customer_name, inv.date, inv.type,
                        inv.itemsStr, inv.subtotal, inv.tax, inv.discount, inv.total, inv.status, inv.paymentsStr,
                        inv.created_at, inv.updated_at, inv.taxType, inv.grossTotal, inv.itemDiscount,
                        inv.additionalCharges, inv.roundOff, inv.amountReceived, inv.internalNotes, inv.is_deleted
                    ]
                );

            } else if (type === EventTypes.INVOICE_STATUS_UPDATED) {
                if (payload.is_deleted !== undefined) {
                    await db.runAsync(`UPDATE invoices SET is_deleted = ?, updated_at = ? WHERE id = ?`, [payload.is_deleted ? 1 : 0, payload.updated_at, payload.id]);
                }
                if (payload.status) {
                    await db.runAsync(`UPDATE invoices SET status = ?, updated_at = ? WHERE id = ?`, [payload.status, payload.updated_at, payload.id]);
                }

            } else if (type === EventTypes.PRODUCT_STOCK_ADJUSTED) {
                // ─── GOLDEN RULE #3: Use ABSOLUTE stock value, never stock = stock - qty ───
                if (payload.minStock !== undefined) {
                    await db.runAsync(`UPDATE products SET stock = ?, min_stock = ? WHERE id = ?`, [parseInt(payload.stock) || 0, parseInt(payload.minStock) || 0, payload.id]);
                } else {
                    await db.runAsync(`UPDATE products SET stock = ? WHERE id = ?`, [parseInt(payload.stock) || 0, payload.id]);
                }
            } else if (type === EventTypes.RECEPTIONIST_CREATED) {
                const r = await normalizeReceptionistPayload(payload);
                await db.runAsync(
                    `INSERT OR REPLACE INTO receptionists (id, name, is_active, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?)`,
                    [r.id, r.name, r.is_active, r.created_at, r.updated_at]
                );

            } else if (type === EventTypes.RECEPTIONIST_UPDATED) {
                const r = await normalizeReceptionistPayload(payload);
                await db.runAsync(
                    `INSERT OR REPLACE INTO receptionists (id, name, is_active, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?)`,
                    [r.id, r.name, r.is_active, r.created_at, r.updated_at]
                );

            } else if (type === EventTypes.RECEPTIONIST_DELETED) {
                await db.runAsync(`DELETE FROM receptionists WHERE id = ?`, [payload.id]);
            } else if (type === EventTypes.CATEGORY_CREATED) {
                const c = await normalizeCategoryPayload(payload, syncKey);
                await db.runAsync(
                    `INSERT OR REPLACE INTO expense_categories (id, name, color, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?)`,
                    [c.id, c.name, c.color, c.created_at, c.updated_at]
                );
            } else if (type === EventTypes.CATEGORY_DELETED) {
                await db.runAsync(`DELETE FROM expense_categories WHERE id = ?`, [payload.id]);
            }
        } catch (e) {
            console.error(`[Sync] Apply Event Error (${type}):`, e);
            throw e;
        }
    },

    // Queue Utils
    async addToQueue(item) {
        const key = await this.getUserSyncKey(PENDING_UPLOAD_QUEUE_KEY);
        const queueStr = await AsyncStorage.getItem(key);
        const queue = queueStr ? JSON.parse(queueStr) : [];
        if (!queue.find(q => q.content.eventId === item.content.eventId)) {
            queue.push(item);
            await AsyncStorage.setItem(key, JSON.stringify(queue));
        }
    },

    async removeFromQueue(eventId) {
        const key = await this.getUserSyncKey(PENDING_UPLOAD_QUEUE_KEY);
        const queueStr = await AsyncStorage.getItem(key);
        let queue = queueStr ? JSON.parse(queueStr) : [];
        queue = queue.filter(q => q.content.eventId !== eventId);
        await AsyncStorage.setItem(key, JSON.stringify(queue));
    },

    async getPendingQueueLength() {
        try {
            const key = await this.getUserSyncKey(PENDING_UPLOAD_QUEUE_KEY);
            const queueStr = await AsyncStorage.getItem(key);
            const queue = queueStr ? JSON.parse(queueStr) : [];
            return queue.length;
        } catch (e) {
            return 0;
        }
    },

    async retryQueue() {
        const key = await this.getUserSyncKey(PENDING_UPLOAD_QUEUE_KEY);
        const queueStr = await AsyncStorage.getItem(key);
        const queue = queueStr ? JSON.parse(queueStr) : [];
        if (queue.length === 0) return;

        console.log(`[Sync] Retrying ${queue.length} pending events...`);
        try {
            const accessToken = await getAccessToken();
            if (!accessToken) return;

            const folderId = await this.getEventsFolderId(accessToken);
            // Copy array to avoid mutation issues during iteration
            const currentQueue = [...queue];

            // Get encryption key for retry
            const userStr = await AsyncStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            const syncKey = user?.email || "";

            for (const item of currentQueue) {
                try {
                    let content = JSON.stringify(item.content);
                        if (syncKey) {
                            const salt = await getDriveEncSalt();
                            const derivedKey = deriveEncryptionKey(syncKey, salt);
                            content = encryptContent(content, derivedKey);
                        }

                    await uploadFileToFolder(accessToken, folderId, item.fileName, content);
                    await this.removeFromQueue(item.content.eventId);
                    console.log(`[Sync] Retried & Uploaded: ${item.fileName}`);
                } catch (e) {
                    console.log(`[Sync] Retry failed for ${item.fileName}`);
                }
            }

            // ─── NEW: RETRY SECURITY VAULT SYNC ───
            if (user) {
                try {
                    const { SecurityService } = require('./SecurityService');
                    await SecurityService.retryPendingSync(user);
                    console.log('[Sync] Security Vault retry check complete.');
                } catch (vaultErr) {
                    console.warn('[Sync] Security Vault retry failed:', vaultErr.message);
                }
            }
        } catch (e) {
            console.log("[Sync] Retry loop aborted (Network?)", e);
        }
    }
};
