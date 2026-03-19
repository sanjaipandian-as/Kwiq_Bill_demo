import { db, clearDatabase } from './database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { getAccessToken, getOrCreateFolder, uploadFileToFolder, fetchWithTimeout } from './googleDriveservices';
import { generateUUID } from '../utils/crypto';
const CryptoJS = require('crypto-js');
const PROCESSED_EVENTS_KEY = 'processed_events_ids';
const PENDING_UPLOAD_QUEUE_KEY = 'pending_upload_queue';
const LAST_SYNCED_KEY = 'last_synced_timestamp';
const DEVICE_ID_KEY = 'device_unique_id';
const LAST_SNAPSHOT_TIME_KEY = 'last_snapshot_timestamp';
const SNAPSHOT_THRESHOLD = 50; // Every 50 events, trigger a snapshot

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

function smartParse(text, key, fileName = "unknown") {
    if (!text || text.trim() === "") return null;

    // 1. ROBUST CLEANING: Strip hidden MIME/Multipart trash
    let cleaned = text.trim();
    
    // Find where the real data starts ({ or [ for JSON, U2Fsd for Encrypted)
    const jsonStart = cleaned.search(/[\{\[]/);
    const encStart = cleaned.indexOf('U2FsdGVkX1');
    
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
    if (cleaned.startsWith('U2FsdGVkX1')) {
        if (!key) {
            console.warn(`[Sync] Encrypted file ${fileName} skipped: No decryption key.`);
            return null;
        }
        try {
            const bytes = CryptoJS.AES.decrypt(cleaned, key);
            const decrypted = bytes.toString(CryptoJS.enc.Utf8);
            if (decrypted && (decrypted.trim().startsWith('{') || decrypted.trim().startsWith('['))) {
                return JSON.parse(decrypted);
            }
        } catch (decErr) {
            // Silence common 'Malformed UTF-8' errors which happen when keys don't match across teammates
            if (__DEV__) console.log(`[Sync] Skipping encrypted file ${fileName} (Key mismatch or corrupt)`);
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
 * Normalizes variants: ensures consistent snake_case fields (cost_price, tax_rate, etc.)
 * and coercing numeric types. Handles both camelCase and snake_case inputs.
 */
function normalizeVariants(raw) {
    const list = normalizeItems(raw);
    return list.map(v => {
        const computedCost = Number((v.cost_price !== undefined && v.cost_price !== null && v.cost_price !== '') ? v.cost_price : ((v.costPrice !== undefined && v.costPrice !== null && v.costPrice !== '') ? v.costPrice : 0)) || 0;
        const resolvedBarcode = String(v.barcode || v.sku || '').trim();
        return {
            ...v,
            name: String(v.name || v.detail || ''),
            sku: String(v.sku || ''),
            barcode: resolvedBarcode,
            price: (v.price !== null && v.price !== undefined && v.price !== '') ? Number(v.price) : null,
            cost_price: computedCost,
            costPrice: computedCost,
            stock: Number((v.stock !== undefined && v.stock !== null && v.stock !== '') ? v.stock : ((v.qty !== undefined && v.qty !== null && v.qty !== '') ? v.qty : ((v.quantity !== undefined && v.quantity !== null && v.quantity !== '') ? v.quantity : 0))) || 0,
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
 */
function normalizeInvoicePayload(payload) {
    const items = normalizeItems(payload.items);
    const payments = normalizePayments(payload.payments);

    return {
        id: payload.id,
        customer_id: payload.customer_id || payload.customerId || '',
        customer_name: payload.customer_name || payload.customerName || 'Guest',
        date: payload.date || new Date().toISOString(),
        type: payload.type || 'sale',
        items,
        itemsStr: JSON.stringify(items),       // GOLDEN RULE: Always stringify for SQLite
        payments,
        paymentsStr: JSON.stringify(payments),  // GOLDEN RULE: Always stringify for SQLite
        subtotal: parseFloat(payload.subtotal) || 0,
        tax: parseFloat(payload.tax) || 0,
        discount: parseFloat(payload.discount) || 0,
        total: calculateTotalFromItems(items, payload.total),
        status: payload.status || 'Paid',
        created_at: payload.created_at || new Date().toISOString(),
        updated_at: payload.updated_at || new Date().toISOString(),
        taxType: payload.taxType || 'intra',
        grossTotal: parseFloat(payload.grossTotal) || 0,
        itemDiscount: parseFloat(payload.itemDiscount) || 0,
        additionalCharges: parseFloat(payload.additionalCharges) || 0,
        roundOff: parseFloat(payload.roundOff) || 0,
        amountReceived: parseFloat(payload.amountReceived) || 0,
        internalNotes: payload.internalNotes || '',
        receptionist_name: payload.receptionist_name || payload.receptionistName || null,
        receptionist_id: payload.receptionist_id || payload.receptionistId || null,
        is_deleted: payload.is_deleted ? 1 : 0,
    };
}

/**
 * Normalizes a product payload.
 */
function normalizeProductPayload(payload) {
    return {
        id: String(payload.id),
        name: String(payload.name || ''),
        sku: String(payload.sku || ''),
        category: String(payload.category || ''),
        price: Number(payload.price || 0),
        cost_price: Number(payload.costPrice || payload.cost_price || 0),
        stock: parseInt(payload.stock) || 0,
        min_stock: parseInt(payload.minStock || payload.min_stock) || 0,
        unit: String(payload.unit || 'pc'),
        tax_rate: Number(payload.tax_rate || payload.taxRate || 0),
        variants: JSON.stringify(normalizeVariants(payload.variants)),
        variant: String(payload.variant || ''),
        created_at: String(payload.created_at || new Date().toISOString()),
        updated_at: String(payload.updated_at || new Date().toISOString()),
    };
}

/**
 * Normalizes a customer payload.
 */
function normalizeCustomerPayload(payload) {
    return {
        id: payload.id,
        name: payload.name || '',
        phone: payload.phone || '',
        email: payload.email || '',
        type: payload.type || '',
        gstin: payload.gstin || '',
        address: typeof payload.address === 'object' ? JSON.stringify(payload.address) : (payload.address || ''),
        source: payload.source || '',
        tags: Array.isArray(payload.tags) ? payload.tags.join(',') : (payload.tags || ''),
        loyaltyPoints: parseInt(payload.loyaltyPoints) || 0,
        outstanding: parseFloat(payload.outstanding) || 0,
        amountPaid: parseFloat(payload.amountPaid) || 0,
        notes: payload.notes || '',
        created_at: payload.created_at || new Date().toISOString(),
        updated_at: payload.updated_at || new Date().toISOString(),
        whatsappOptIn: payload.whatsappOptIn ? 1 : 0,
        smsOptIn: payload.smsOptIn ? 1 : 0,
    };
}

/**
 * Normalizes an expense payload.
 */
function normalizeExpensePayload(payload) {
    return {
        id: payload.id,
        title: payload.title || '',
        amount: parseFloat(payload.amount) || 0,
        category: payload.category || '',
        date: payload.date || new Date().toISOString(),
        payment_method: payload.payment_method || payload.paymentMethod || '',
        receipt_url: payload.receiptUrl || payload.receipt_url || '',
        tags: JSON.stringify(normalizeItems(payload.tags)),
        created_at: payload.created_at || new Date().toISOString(),
        updated_at: payload.updated_at || new Date().toISOString(),
    };
}

/**
 * Normalizes a receptionist payload.
 */
function normalizeReceptionistPayload(payload) {
    return {
        id: String(payload.id),
        name: String(payload.name || ''),
        is_active: payload.is_active !== undefined ? (payload.is_active ? 1 : 0) : 1,
        created_at: payload.created_at || new Date().toISOString(),
        updated_at: payload.updated_at || new Date().toISOString(),
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


// ═══════════════════════════════════════════════════════════════════
// SYNC SERVICE
// ═══════════════════════════════════════════════════════════════════

/**
 * Sync Service responsible for Event Sourcing logic.
 */
// In-memory cache: folder lookup costs 2 Drive API calls (3-5s) on every upload.
// We cache it once per app session to avoid repeated latency.
let _cachedEventsFolderId = null;
let _cachedSnapshotsFolderId = null;
let _cachedBackupsFolderId = null;
let _cachedSyncKey = null;

export const SyncService = {

    /**
     * Clear session caches on logout
     */
    logout() {
        _cachedEventsFolderId = null;
        _cachedSnapshotsFolderId = null;
        _cachedBackupsFolderId = null;
        _cachedSyncKey = null;
    },

    /**
     * Get or Create Root 'Kwiqbill' Folder
     */
    async getRootFolderId(accessToken) {
        return getOrCreateFolder(accessToken, 'Kwiqbill');
    },

    /**
     * Get or Create the official 'kwiq bill backup' folder
     * (Inside the Kwiqbill root folder)
     */
    async getBackupFolderId(accessToken) {
        if (_cachedBackupsFolderId) return _cachedBackupsFolderId;
        const rootId = await this.getRootFolderId(accessToken);
        const backupId = await getOrCreateFolder(accessToken, 'kwiq bill backup', rootId);
        _cachedBackupsFolderId = backupId;
        return backupId;
    },

    /**
     * Get or Create Subfolders (Inside the 'kwiq bill backup' folder)
     */
    async getEventsFolderId(accessToken) {
        return this.getBackupFolderId(accessToken);
    },

    async getSnapshotsFolderId(accessToken) {
        return this.getBackupFolderId(accessToken);
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
                    content = CryptoJS.AES.encrypt(content, syncKey).toString();
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
            content = CryptoJS.AES.encrypt(content, user.email).toString();
 
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
            const query = `'${snapshotsFolderId}' in parents and (name contains 'snapshot_' or name contains 'global_snapshot_') and trashed=false`;
            const res = await fetchWithTimeout(
                `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=createdTime desc&fields=files(id,name,createdTime)`, // Removed pageSize=1
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const data = await res.json();

            // Sort and filter in JS to be 100% sure we get the right one
            let files = data.files || [];
            files = files.filter(f => f.name.startsWith('global_snapshot_') || f.name.startsWith('snapshot_'));
            files.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));

            if (files.length === 0) {
                console.log('[Restore] No valid snapshot files found in folder.');
                return false;
            }
            
            const latest = files[0];
            console.log(`[Restore] Found latest snapshot: ${latest.name} (${latest.createdTime})`);
            onProgress('Downloading baseline...', 0.3);

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
                const bytes = CryptoJS.AES.decrypt(encryptedContent, user.email);
                decrypted = bytes.toString(CryptoJS.enc.Utf8);
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
            
            const { customers, products, invoices, expenses, receptionists } = snapshot.data;
            
            // Re-insert logic (simplified for batch)
            await db.withTransactionAsync(async () => {
                if (Array.isArray(customers)) {
                  for (const c of customers) {
                    const nc = normalizeCustomerPayload(c);
                    await db.runAsync(
                      `INSERT OR REPLACE INTO customers (id, name, phone, email, type, gstin, address, source, tags, loyaltyPoints, notes, created_at, updated_at, amountPaid, whatsappOptIn, smsOptIn, outstanding)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [nc.id, nc.name, nc.phone, nc.email, nc.type, nc.gstin, nc.address, nc.source, nc.tags, nc.loyaltyPoints, nc.notes, nc.created_at, nc.updated_at, nc.amountPaid, nc.whatsappOptIn, nc.smsOptIn, nc.outstanding]
                    );
                  }
                }
                if (Array.isArray(products)) {
                  for (const p of products) {
                    const np = normalizeProductPayload(p);
                    await db.runAsync(
                      `INSERT OR REPLACE INTO products (id, name, sku, category, price, cost_price, stock, min_stock, unit, tax_rate, variants, variant, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [np.id, np.name, np.sku, np.category, np.price, np.cost_price, np.stock, np.min_stock, np.unit, np.tax_rate, np.variants, np.variant, np.created_at, np.updated_at]
                    );
                  }
                }
                if (Array.isArray(invoices)) {
                  for (const inv of invoices) {
                    const ni = normalizeInvoicePayload(inv);
                    await db.runAsync(
                      `INSERT OR REPLACE INTO invoices (id, customer_id, customer_name, date, type, items, subtotal, tax, discount, total, status, payments, grossTotal, itemDiscount, additionalCharges, roundOff, amountReceived, internalNotes, taxType, created_at, updated_at, is_deleted)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [ni.id, ni.customer_id, ni.customer_name, ni.date, ni.type, ni.itemsStr, ni.subtotal, ni.tax, ni.discount, ni.total, ni.status, ni.paymentsStr, ni.grossTotal, ni.itemDiscount, ni.additionalCharges, ni.roundOff, ni.amountReceived, ni.internalNotes, ni.taxType, ni.created_at, ni.updated_at, ni.is_deleted]
                    );
                  }
                }
                if (Array.isArray(expenses)) {
                  for (const e of expenses) {
                    const ne = normalizeExpensePayload(e);
                    await db.runAsync(
                      `INSERT OR REPLACE INTO expenses (id, title, amount, category, date, payment_method, receipt_url, tags, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [ne.id, ne.title, ne.amount, ne.category, ne.date, ne.payment_method, ne.receipt_url, ne.tags, ne.created_at, ne.updated_at]
                    );
                  }
                }
                if (Array.isArray(receptionists)) {
                  for (const r of receptionists) {
                    const nr = normalizeReceptionistPayload(r);
                    await db.runAsync(
                      `INSERT OR REPLACE INTO receptionists (id, name, is_active, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?)`,
                      [nr.id, nr.name, nr.is_active, nr.created_at, nr.updated_at]
                    );
                  }
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
     * "Turn Sync On" - Fetch, Filter, Apply
     */

    async syncDown(onProgress = () => { }) {
        try {
            DeviceEventEmitter.emit(SYNC_EVENTS.SYNC_STARTED);
            const updateStatus = (msg, progress, stats) => {
                console.log(`[Sync] ${msg}`);
                onProgress(msg, progress, stats);
            };

            updateStatus('Starting Sync Down...', 0.65);
            const accessToken = await getAccessToken();
            if (!accessToken) return { success: false, processedCount: 0, failures: 1, error: "No Access Token" };

            // Decryption Support: Get encryption key (user email)
            const userStr = await AsyncStorage.getItem('user');
            const currentUser = userStr ? JSON.parse(userStr) : null;
            const syncKey = currentUser?.email || "";
            
            if (!syncKey) {
                console.warn('[Sync] No sync key (user email) found. Encrypted files will fail.');
            }


            const folderId = await this.getEventsFolderId(accessToken);
            if (!folderId) return { success: false, processedCount: 0, failures: 1, error: "No Folder ID" };

            // 1. List all files in events folder
            updateStatus('Fetching cloud updates...', 0.66);

            const userLastSyncedKey = await this.getUserSyncKey(LAST_SYNCED_KEY);
            const userProcessedEventsKey = await this.getUserSyncKey(PROCESSED_EVENTS_KEY);

            let lastSyncTime = await AsyncStorage.getItem(userLastSyncedKey);

            // RAPID RECOVERY: If this is a new device (no lastSyncTime), check for snapshots first
            if (!lastSyncTime) {
                updateStatus('New device detected. Looking for cloud snapshots...', 0.1);
                const restored = await this.restoreFromLatestSnapshot((msg, prog) => {
                    updateStatus(`[Restore] ${msg}`, 0.1 + (prog * 0.5));
                });
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
                } catch (e) {
                    console.error('[Sync] Failed to list files:', e);
                    return { success: false, processedCount: 0, failures: 1, error: "List Files Failed" };
                }
            } while (nextPageToken);

            // 2. Filter: Ignore already processed events
            const processedIdsStr = await AsyncStorage.getItem(userProcessedEventsKey);
            const processedIds = processedIdsStr ? JSON.parse(processedIdsStr) : [];
            const processedSet = new Set(processedIds);

            updateStatus(`Found ${allFiles.length} files total. Filtering...`, 0.67);

            // Sort by filename 
            allFiles.sort((a, b) => a.name.localeCompare(b.name));

            // 3. Download and Apply Events
            const filesToProcess = allFiles.filter(f => {
                // IMPORTANT: Since all files (snapshots, settings, events) now live in the same folder,
                // we must only process files prefixed with 'event_'.
                if (!f.name.startsWith('event_')) return false;

                const parts = f.name.replace('.json', '').split('_');
                // Pattern: event_TIMESTAMP_TYPE_EVENTID
                const probableEventId = parts[parts.length - 1];
                // Also ignore files we know are permanently broken
                return !processedSet.has(probableEventId) && !processedSet.has(f.id);
            });

            if (filesToProcess.length === 0) {
                updateStatus('Cloud is already up to date.', 0.90);
                return { success: true, processedCount: 0, failures: 0 };
            }

            updateStatus(`${filesToProcess.length} new events found.`, 0.68);

            // Optimization: Fetch event contents in parallel batches
            // Increased BATCH_SIZE to 100 to accelerate the synchronization process.
            const BATCH_SIZE = 100;
            let processedCount = 0;
            let failures = 0;
            const totalToProcess = filesToProcess.length;

            const liveStats = () => ({
                synced: processedCount,
                errors: failures,
                total: totalToProcess
            });

            const startTime = Date.now();

            // Get token once upfront — only refresh if we get a 401
            let currentToken = await getAccessToken();
            if (!currentToken) throw new Error("Token expired or missing");

            // Store IDs for batch saving
            let newProcessedIds = [...processedIds];

            for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
                const batch = filesToProcess.slice(i, i + BATCH_SIZE);

                // Calculate granular progress
                const segmentProgress = i / filesToProcess.length;
                const overallProgress = 0.65 + (segmentProgress * 0.25);

                // Estimate time remaining
                if (i > 0) {
                    const elapsed = Date.now() - startTime;
                    const msPerEvent = elapsed / i;
                    const remaining = filesToProcess.length - i;
                    const estMs = remaining * msPerEvent;
                    const estMin = Math.floor(estMs / 60000);
                    const estSec = Math.round((estMs % 60000) / 1000);
                    let timeStr = estMin > 0 ? `${estMin}m ${estSec}s` : `${estSec}s`;
                    const currentBatch = Math.floor(i / BATCH_SIZE) + 1;
                    const totalBatches = Math.ceil(filesToProcess.length / BATCH_SIZE);
                    const msg = `Syncing batch ${currentBatch} of ${totalBatches}... (Est. time: ${timeStr})`;
                    updateStatus(msg, overallProgress, liveStats());
                } else {
                    updateStatus(`Starting data download...`, 0.65, liveStats());
                }

                const envelopes = await Promise.all(batch.map(async (file) => {
                    let attempts = 0;
                    while (attempts < 2) { // Reduced from 3 to 2 retries for speed
                        try {
                            // Use 90s timeout for event files (increased for larger batch size stability)
                            const contentRes = await fetchWithTimeout(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
                                headers: { Authorization: `Bearer ${currentToken}` }
                            }, 90000);

                            // If 401, refresh token once and retry
                            if (contentRes.status === 401 && attempts === 0) {
                                currentToken = await getAccessToken();
                                attempts++;
                                continue;
                            }

                            if (!contentRes.ok) {
                                const errorText = await contentRes.text();
                                throw new Error(`HTTP ${contentRes.status}: ${errorText.substring(0, 50)}`);
                            }

                            const text = await contentRes.text();
                            // Use SmartParse to handle Plain JSON (Desktop) or Encrypted (Mobile)
                            try {
                                const envelope = smartParse(text, syncKey, file.name);
                                if (!envelope) {
                                    // If parsing failed (unrecognized format or wrong key), skip this file
                                    return null;
                                }
                                return envelope;
                            } catch (error) {
                                console.error(`[Sync] Parse Error for ${file.name}:`, error.message);
                                throw error;
                            }
                        } catch (e) {
                            attempts++;
                            console.warn(`[Sync] Download attempt ${attempts} failed for ${file.name}: ${e.message}`);
                            if (attempts >= 2) {
                                console.error(`[Sync] Failed to download event ${file.name} after 2 attempts.`);
                                // Stop retrying broken downloads forever
                                newProcessedIds.push(file.id);
                                processedSet.add(file.id);
                                return { _isInvalid: true, fileId: file.id };
                            }
                            // Shorter backoff: 500ms then 1s
                            await new Promise(r => setTimeout(r, 500 * attempts));
                        }
                    }
                    return null;
                }));

                // ═══════════════════════════════════════════════════════════════
                // GOLDEN RULE #4: Batched Transaction with Per-Event Error Safety
                // Wrap entire batch in ONE transaction. If a single event fails,
                // catch it, log it, and continue — never crash the whole batch.
                // ═══════════════════════════════════════════════════════════════
                try {
                    await db.withTransactionAsync(async () => {
                        for (let j = 0; j < envelopes.length; j++) {
                            const envelope = envelopes[j];
                            if (!envelope || envelope._isInvalid) {
                                failures++;
                                continue;
                            }

                            if (processedSet.has(envelope.eventId)) continue;

                            try {
                                await this.applyEvent(envelope);
                                newProcessedIds.push(envelope.eventId);
                                processedSet.add(envelope.eventId);
                                processedCount++;
                            } catch (applyError) {
                                console.error(`[Sync] Failed to apply event ${envelope.eventId} (${envelope.type}):`, applyError.message);
                                // Mark as processed to avoid retrying a permanently broken event
                                newProcessedIds.push(envelope.eventId);
                                processedSet.add(envelope.eventId);
                                failures++;
                            }
                        }
                    });
                } catch (txError) {
                    console.error(`[Sync] Batch transaction error:`, txError.message);
                    // Fallback: apply events individually outside transaction
                    for (let j = 0; j < envelopes.length; j++) {
                        const envelope = envelopes[j];
                        if (!envelope || envelope._isInvalid || processedSet.has(envelope.eventId)) continue;
                        try {
                            await this.applyEvent(envelope);
                            newProcessedIds.push(envelope.eventId);
                            processedSet.add(envelope.eventId);
                            processedCount++;
                        } catch (applyError) {
                            console.error(`[Sync] Fallback apply failed for ${envelope.eventId}:`, applyError.message);
                            newProcessedIds.push(envelope.eventId);
                            processedSet.add(envelope.eventId);
                            failures++;
                        }
                    }
                }

                // Save progress periodically to avoid massive AsyncStorage write at end
                // and to preserve progress if app crashes.
                try {
                    await AsyncStorage.setItem(userProcessedEventsKey, JSON.stringify(newProcessedIds));
                } catch (e) {
                    console.warn('[Sync] Progress save failed:', e.message);
                }

                // Small delay between batches to give the network stack a breather
                if (i + BATCH_SIZE < filesToProcess.length) {
                    await new Promise(r => setTimeout(r, 200));
                }
            }

            // Save processed IDs once at the end (not per-batch)
            await AsyncStorage.setItem(userProcessedEventsKey, JSON.stringify(newProcessedIds));

            await AsyncStorage.setItem(userLastSyncedKey, new Date().toISOString());
            const finalMsg = `Sync Complete! Applied ${processedCount} new events. ${failures > 0 ? `(${failures} failed)` : ''}`;
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

        } catch (error) {
            console.error('[Sync] Sync Down Error:', error);
            return { success: false, processedCount: 0, failures: 1, error: error.message };
        }
    },

    /**
     * Resets the local sync state, effectively forcing a full re-sync on next run.
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
            const foldersToTry = ['Kwiqbill', `KwiqBilling-${user.id}`];

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
                    return smartParse(text, user.email, fileName);
                } catch (e) {
                    console.error(`[ForceRestore] Failed to fetch ${fileName}:`, e.message);
                    return null;
                }
            };

            const [products, customers, expenses, invoices] = await Promise.all([
                fetchSnapshot('products.json'),
                fetchSnapshot('customers.json'),
                fetchSnapshot('expenses.json'),
                fetchSnapshot('invoices.json'),
                fetchSnapshot('receptionists.json'),
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

            const restored = { products: 0, customers: 0, expenses: 0, invoices: 0, receptionists: 0 };

            // 4. Re-insert from snapshots using batched INSERT OR REPLACE
            // GOLDEN RULE #2: Idempotency — all inserts use INSERT OR REPLACE

            if (customers && Array.isArray(customers) && customers.length > 0) {
                onProgress(`Restoring ${customers.length} customers...`, 0.55);
                await db.withTransactionAsync(async () => {
                    for (const c of customers) {
                        const nc = normalizeCustomerPayload(c);
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
                        const np = normalizeProductPayload(p);
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
                        const ne = normalizeExpensePayload(e);
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
                        const ni = normalizeInvoicePayload(i);
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
                        const nr = normalizeReceptionistPayload(r);
                        await db.runAsync(
                            `INSERT OR REPLACE INTO receptionists (id, name, is_active, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?)`,
                            [nr.id, nr.name, nr.is_active, nr.created_at, nr.updated_at]
                        );
                        restored.receptionists++;
                    }
                });
            }

            // 5. Reset sync timestamp to the force-push date
            //    This ensures future event-based syncs only process events AFTER this snapshot.
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
     * Apply a single event to the local state/DB
     */
    async applyEvent(event) {
        const { type, payload } = event;

        try {
            if (type === EventTypes.INVOICE_CREATED) {
                // ─── Strict Schema Parse ───
                const inv = normalizeInvoicePayload(payload);

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
                // GOLDEN RULE #3 (Sync mirrors state, not formulas):
                // We still deduct stock here for INVOICE_CREATED because Desktop sends
                // a separate PRODUCT_UPDATED/PRODUCT_STOCK_ADJUSTED event with the absolute
                // stock value right after — which overwrites this deduction with the precise number.
                // This deduction is a best-effort fallback for offline scenarios where
                // the PRODUCT_UPDATED event might not arrive immediately.
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
                const p = normalizeProductPayload(payload);
                await db.runAsync(
                    `INSERT OR REPLACE INTO products (id, name, sku, category, price, cost_price, stock, min_stock, unit, tax_rate, variants, variant, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [p.id, p.name, p.sku, p.category, p.price, p.cost_price, p.stock, p.min_stock, p.unit, p.tax_rate, p.variants, p.variant, p.created_at, p.updated_at]
                );

            } else if (type === EventTypes.PRODUCT_UPDATED) {
                // ─── GOLDEN RULE #3: Use absolute stock value from the event ───
                const p = normalizeProductPayload(payload);
                await db.runAsync(
                    `INSERT OR REPLACE INTO products (id, name, sku, category, price, cost_price, stock, min_stock, unit, tax_rate, variants, variant, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [p.id, p.name, p.sku, p.category, p.price, p.cost_price, p.stock, p.min_stock, p.unit, p.tax_rate, p.variants, p.variant, p.created_at, p.updated_at]
                );

            } else if (type === EventTypes.CUSTOMER_CREATED) {
                // ─── Idempotent: INSERT OR REPLACE handles duplicates ───
                const c = normalizeCustomerPayload(payload);
                await db.runAsync(
                    `INSERT OR REPLACE INTO customers (id, name, phone, email, type, gstin, address, source, tags, loyaltyPoints, outstanding, amountPaid, notes, created_at, updated_at, whatsappOptIn, smsOptIn)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [c.id, c.name, c.phone, c.email, c.type, c.gstin, c.address, c.source, c.tags, c.loyaltyPoints, c.outstanding, c.amountPaid, c.notes, c.created_at, c.updated_at, c.whatsappOptIn, c.smsOptIn]
                );

            } else if (type === EventTypes.CUSTOMER_UPDATED) {
                const c = normalizeCustomerPayload(payload);
                await db.runAsync(
                    `INSERT OR REPLACE INTO customers (id, name, phone, email, type, gstin, address, source, tags, loyaltyPoints, outstanding, amountPaid, notes, created_at, updated_at, whatsappOptIn, smsOptIn)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [c.id, c.name, c.phone, c.email, c.type, c.gstin, c.address, c.source, c.tags, c.loyaltyPoints, c.outstanding, c.amountPaid, c.notes, c.created_at, c.updated_at, c.whatsappOptIn, c.smsOptIn]
                );

            } else if (type === EventTypes.EXPENSE_CREATED) {
                // ─── Idempotent: INSERT OR REPLACE ───
                const e = normalizeExpensePayload(payload);
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
                        const received = parseFloat(payload.amountReceived) || 0;
                        const total = parseFloat(payload.total) || 0;
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
                const e = normalizeExpensePayload(payload);
                await db.runAsync(
                    `INSERT OR REPLACE INTO expenses (id, title, amount, category, date, payment_method, receipt_url, tags, created_at, updated_at)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [e.id, e.title, e.amount, e.category, e.date, e.payment_method, e.receipt_url, e.tags, e.created_at, e.updated_at]
                );

            } else if (type === EventTypes.EXPENSE_DELETED) {
                await db.runAsync(`DELETE FROM expenses WHERE id = ?`, [payload.id]);

            } else if (type === EventTypes.INVOICE_UPDATED) {
                const inv = normalizeInvoicePayload(payload);
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
                const r = normalizeReceptionistPayload(payload);
                await db.runAsync(
                    `INSERT OR REPLACE INTO receptionists (id, name, is_active, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?)`,
                    [r.id, r.name, r.is_active, r.created_at, r.updated_at]
                );

            } else if (type === EventTypes.RECEPTIONIST_UPDATED) {
                const r = normalizeReceptionistPayload(payload);
                await db.runAsync(
                    `INSERT OR REPLACE INTO receptionists (id, name, is_active, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?)`,
                    [r.id, r.name, r.is_active, r.created_at, r.updated_at]
                );

            } else if (type === EventTypes.RECEPTIONIST_DELETED) {
                await db.runAsync(`DELETE FROM receptionists WHERE id = ?`, [payload.id]);
            }
        } catch (e) {
            console.error(`[Sync] Apply Event Error (${type}):`, e);
            throw e;
        }
    },

    // Queue Utils
    async addToQueue(item) {
        const queueStr = await AsyncStorage.getItem(PENDING_UPLOAD_QUEUE_KEY);
        const queue = queueStr ? JSON.parse(queueStr) : [];
        if (!queue.find(q => q.content.eventId === item.content.eventId)) {
            queue.push(item);
            await AsyncStorage.setItem(PENDING_UPLOAD_QUEUE_KEY, JSON.stringify(queue));
        }
    },

    async removeFromQueue(eventId) {
        const queueStr = await AsyncStorage.getItem(PENDING_UPLOAD_QUEUE_KEY);
        let queue = queueStr ? JSON.parse(queueStr) : [];
        queue = queue.filter(q => q.content.eventId !== eventId);
        await AsyncStorage.setItem(PENDING_UPLOAD_QUEUE_KEY, JSON.stringify(queue));
    },

    async getPendingQueueLength() {
        try {
            const queueStr = await AsyncStorage.getItem(PENDING_UPLOAD_QUEUE_KEY);
            const queue = queueStr ? JSON.parse(queueStr) : [];
            return queue.length;
        } catch (e) {
            return 0;
        }
    },

    async retryQueue() {
        const queueStr = await AsyncStorage.getItem(PENDING_UPLOAD_QUEUE_KEY);
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
                        content = CryptoJS.AES.encrypt(content, syncKey).toString();
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
