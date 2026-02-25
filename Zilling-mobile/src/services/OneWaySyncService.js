import { db, clearDatabase } from './database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { getAccessToken, getOrCreateFolder, uploadFileToFolder, fetchWithTimeout } from './googleDriveservices';

const PROCESSED_EVENTS_KEY = 'processed_events_ids';
const PENDING_UPLOAD_QUEUE_KEY = 'pending_upload_queue';
const LAST_SYNCED_KEY = 'last_synced_timestamp';
const DEVICE_ID_KEY = 'device_unique_id';

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
        variants: JSON.stringify(normalizeItems(payload.variants)),
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


// ═══════════════════════════════════════════════════════════════════
// GOLDEN RULE #3: Ghost Customer Creator
// If an invoice references a customer_id that doesn't exist locally,
// auto-create a ghost profile to prevent foreign key crashes.
// ═══════════════════════════════════════════════════════════════════

/**
 * Ensures a customer exists locally. If not, creates a ghost profile.
 * This prevents dashboard crashes from orphaned invoice→customer relationships.
 */
function ensureCustomerExists(customerId, customerName) {
    if (!customerId) return;

    try {
        const exists = db.getAllSync(`SELECT id FROM customers WHERE id = ?`, [String(customerId)]);
        if (exists.length === 0) {
            const now = new Date().toISOString();
            console.log(`[Sync] Auto-creating ghost customer: ${customerName} (${customerId})`);
            db.runSync(
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
export const SyncService = {

    /**
     * Initialize or verify folder structure
     */
    async getEventsFolderId(accessToken) {
        const rootId = await getOrCreateFolder(accessToken, 'Kwiqbill');
        const eventsId = await getOrCreateFolder(accessToken, 'events', rootId);
        return eventsId;
    },

    /**
     * Get or Create Unique Device ID
     */
    async getDeviceId() {
        let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (!deviceId) {
            deviceId = `mobile-${Crypto.randomUUID().slice(0, 8)}`;
            await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
        }
        return deviceId;
    },

    /**
     * Create and Dispatch an Event
     */
    async createAndUploadEvent(type, payload) {
        const eventId = Crypto.randomUUID();
        const timestamp = new Date().toISOString();
        const deviceId = await this.getDeviceId();

        const envelope = {
            eventId,
            type,
            createdAt: timestamp,
            deviceId,
            payload
        };

        const fileName = `event_${timestamp}_${type}_${eventId}.json`;

        console.log(`[Sync] dispatching event: ${fileName}`);

        // 1. Save to local queue first (Optimistic approach / Offline support)
        await this.addToQueue({ fileName, content: envelope });

        // 2. Try to upload immediately - with a racing timeout to prevent UI hanging
        try {
            const uploadPromise = (async () => {
                const accessToken = await getAccessToken();
                if (!accessToken) throw new Error("No access token");

                const folderId = await this.getEventsFolderId(accessToken);
                await uploadFileToFolder(accessToken, folderId, fileName, JSON.stringify(envelope));

                // If successful, remove from queue
                await this.removeFromQueue(eventId);
                console.log(`[Sync] Event uploaded successfully: ${fileName}`);
                return true;
            })();

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Upload Timeout")), 8000)
            );

            return await Promise.race([uploadPromise, timeoutPromise]);
        } catch (error) {
            console.log(`[Sync] Upload delayed/failed (Offline or Timeout): ${error.message}`);
            return false;
        }
    },

    /**
     * "Turn Sync On" - Fetch, Filter, Apply
     */
    async syncDown(onProgress = () => { }) {
        try {
            const updateStatus = (msg, progress) => {
                console.log(`[Sync] ${msg}`);
                onProgress(msg, progress);
            };

            updateStatus('Starting Sync Down...', 0.65);
            const accessToken = await getAccessToken();
            if (!accessToken) return { success: false, processedCount: 0, failures: 1, error: "No Access Token" };


            const folderId = await this.getEventsFolderId(accessToken);
            if (!folderId) return { success: false, processedCount: 0, failures: 1, error: "No Folder ID" };

            // 1. List all files in events folder
            updateStatus('Fetching cloud updates...', 0.66);

            // OPTIMIZATION: Use Incremental Sync by filtering by createdTime
            const lastSyncTime = await AsyncStorage.getItem(LAST_SYNCED_KEY);
            let timeFilter = "";
            if (lastSyncTime) {
                // Formatting for Google Drive RFC 3339
                const date = new Date(lastSyncTime);
                timeFilter = ` and createdTime > '${date.toISOString()}'`;
                console.log(`[Sync] Performing incremental sync since: ${date.toISOString()}`);
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
            const processedIdsStr = await AsyncStorage.getItem(PROCESSED_EVENTS_KEY);
            const processedIds = processedIdsStr ? JSON.parse(processedIdsStr) : [];
            const processedSet = new Set(processedIds);

            updateStatus(`Found ${allFiles.length} files total. Filtering...`, 0.67);

            // Sort by filename 
            allFiles.sort((a, b) => a.name.localeCompare(b.name));

            // 3. Download and Apply Events
            const filesToProcess = allFiles.filter(f => {
                const parts = f.name.replace('.json', '').split('_');
                // Pattern: event_TIMESTAMP_TYPE_EVENTID
                const probableEventId = parts[parts.length - 1];
                return !processedSet.has(probableEventId);
            });

            if (filesToProcess.length === 0) {
                updateStatus('Cloud is already up to date.', 0.90);
                return { success: true, processedCount: 0, failures: 0 };
            }

            updateStatus(`${filesToProcess.length} new events found.`, 0.68);

            // Optimization: Fetch event contents in parallel batches
            const BATCH_SIZE = 100; // Large batches for maximum parallel throughput
            let processedCount = 0;
            let failures = 0;

            const startTime = Date.now();

            // Get token once upfront — only refresh if we get a 401
            let currentToken = await getAccessToken();
            if (!currentToken) throw new Error("Token expired or missing");

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
                    updateStatus(msg, overallProgress);
                } else {
                    updateStatus(`Starting data download...`, 0.65);
                }

                const envelopes = await Promise.all(batch.map(async (file) => {
                    let attempts = 0;
                    while (attempts < 2) { // Reduced from 3 to 2 retries for speed
                        try {
                            // Use shorter 15s timeout for small JSON event files
                            const contentRes = await fetchWithTimeout(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
                                headers: { Authorization: `Bearer ${currentToken}` }
                            }, 15000);

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
                            if (!text || text.trim() === "") {
                                console.warn(`[Sync] Empty content for ${file.name}`);
                                return null;
                            }

                            // Robust Cleaning: Strip MIME headers if accidentally saved
                            let cleanText = text.trim();
                            if (cleanText.toLowerCase().includes('content-type:')) {
                                const parts = cleanText.split(/\r?\n\r?\n/);
                                if (parts.length > 1) {
                                    for (let part of parts) {
                                        const trimmed = part.trim();
                                        if (trimmed.toLowerCase().includes('content-type:')) continue;
                                        if (trimmed.length > 0) {
                                            cleanText = trimmed;
                                            break;
                                        }
                                    }
                                }
                            }

                            try {
                                return JSON.parse(cleanText);
                            } catch (jsonError) {
                                if (cleanText.startsWith('U2FsdGVkX1')) return null; // Skip encrypted
                                console.error(`[Sync] JSON Parse Error for ${file.name}. Content starts with: "${cleanText.substring(0, 100)}"`);
                                throw jsonError;
                            }
                        } catch (e) {
                            attempts++;
                            console.warn(`[Sync] Download attempt ${attempts} failed for ${file.name}: ${e.message}`);
                            if (attempts >= 2) {
                                console.error(`[Sync] Failed to download event ${file.name} after 2 attempts.`);
                                return null;
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
                    db.withTransactionSync(() => {
                        for (let j = 0; j < envelopes.length; j++) {
                            const envelope = envelopes[j];
                            if (!envelope) {
                                failures++;
                                continue;
                            }

                            if (processedSet.has(envelope.eventId)) continue;

                            try {
                                this.applyEventSync(envelope);
                                processedIds.push(envelope.eventId);
                                processedSet.add(envelope.eventId);
                                processedCount++;
                            } catch (applyError) {
                                console.error(`[Sync] Failed to apply event ${envelope.eventId} (${envelope.type}):`, applyError.message);
                                // Mark as processed to avoid retrying a permanently broken event
                                processedIds.push(envelope.eventId);
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
                        if (!envelope || processedSet.has(envelope.eventId)) continue;
                        try {
                            this.applyEventSync(envelope);
                            processedIds.push(envelope.eventId);
                            processedSet.add(envelope.eventId);
                            processedCount++;
                        } catch (applyError) {
                            console.error(`[Sync] Fallback apply failed for ${envelope.eventId}:`, applyError.message);
                            processedIds.push(envelope.eventId);
                            processedSet.add(envelope.eventId);
                            failures++;
                        }
                    }
                }
            }

            // Save processed IDs once at the end (not per-batch)
            await AsyncStorage.setItem(PROCESSED_EVENTS_KEY, JSON.stringify(processedIds));

            await AsyncStorage.setItem(LAST_SYNCED_KEY, new Date().toISOString());
            const finalMsg = `Sync Complete! Applied ${processedCount} new events. ${failures > 0 ? `(${failures} failed)` : ''}`;
            updateStatus(finalMsg, 0.90);

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
     */
    async resetSyncState() {
        try {
            console.log('[Sync] Wiping local data for full re-sync...');
            await clearDatabase();
            await AsyncStorage.removeItem(PROCESSED_EVENTS_KEY);
            await AsyncStorage.removeItem(LAST_SYNCED_KEY);
            console.log('[Sync] Sync State Reset Successfully');
            return true;
        } catch (e) {
            console.error('[Sync] Failed to reset sync state:', e);
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

            const folderName = `KwiqBilling-${user.id}`;

            // 1. Find the user's backup folder on Drive
            onProgress('Locating cloud backup...', 0.15);
            const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
            const searchRes = await fetchWithTimeout(
                `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const searchData = await searchRes.json();

            if (!searchData.files || searchData.files.length === 0) {
                return { success: false, error: 'No backup folder found on Drive' };
            }
            const folderId = searchData.files[0].id;

            // 2. Download all snapshot files in parallel
            onProgress('Downloading snapshots...', 0.25);
            const targetFiles = ['products.json', 'customers.json', 'expenses.json', 'invoices.json'];
            const namesQuery = targetFiles.map(name => `name='${name}'`).join(' or ');
            const listQuery = `(${namesQuery}) and '${folderId}' in parents and trashed=false`;

            const listRes = await fetchWithTimeout(
                `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(listQuery)}&fields=files(id,name,modifiedTime)&pageSize=100`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const listData = await listRes.json();
            const filesMap = {};
            let latestModifiedTime = null;

            if (listData.files) {
                listData.files.forEach(f => {
                    filesMap[f.name] = f.id;
                    // Track the latest modification time for sync reset
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
                    if (!text || text.trim() === '') return null;

                    // Strip MIME headers if present
                    let cleanText = text.trim();
                    if (cleanText.toLowerCase().includes('content-type:')) {
                        const parts = cleanText.split(/\r?\n\r?\n/);
                        for (const part of parts) {
                            const trimmed = part.trim();
                            if (!trimmed.toLowerCase().includes('content-type:') && trimmed.length > 0) {
                                cleanText = trimmed;
                                break;
                            }
                        }
                    }
                    return JSON.parse(cleanText);
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
            ]);

            // 3. WIPE all local data (the nuclear clear)
            onProgress('Clearing local data...', 0.50);
            console.log('[ForceRestore] Clearing all local tables...');
            db.execSync('DELETE FROM expense_adjustments');
            db.execSync('DELETE FROM invoices');
            db.execSync('DELETE FROM expenses');
            db.execSync('DELETE FROM products');
            db.execSync('DELETE FROM customers');

            const restored = { products: 0, customers: 0, expenses: 0, invoices: 0 };

            // 4. Re-insert from snapshots using batched INSERT OR REPLACE
            // GOLDEN RULE #2: Idempotency — all inserts use INSERT OR REPLACE

            if (customers && Array.isArray(customers) && customers.length > 0) {
                onProgress(`Restoring ${customers.length} customers...`, 0.55);
                db.withTransactionSync(() => {
                    for (const c of customers) {
                        const nc = normalizeCustomerPayload(c);
                        db.runSync(
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
                db.withTransactionSync(() => {
                    for (const p of products) {
                        const np = normalizeProductPayload(p);
                        db.runSync(
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
                db.withTransactionSync(() => {
                    for (const e of expenses) {
                        const ne = normalizeExpensePayload(e);
                        db.runSync(
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
                db.withTransactionSync(() => {
                    for (const i of invoices) {
                        const ni = normalizeInvoicePayload(i);
                        // Ensure customer exists before inserting invoice (ghost creation)
                        ensureCustomerExists(ni.customer_id, ni.customer_name);

                        db.runSync(
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

            // 5. Reset sync timestamp to the force-push date
            //    This ensures future event-based syncs only process events AFTER this snapshot.
            const resetTimestamp = latestModifiedTime || new Date().toISOString();
            await AsyncStorage.setItem(LAST_SYNCED_KEY, resetTimestamp);
            await AsyncStorage.removeItem(PROCESSED_EVENTS_KEY); // Clear processed IDs — start fresh
            console.log(`[ForceRestore] Sync timestamp reset to: ${resetTimestamp}`);

            onProgress('Force Restore Complete!', 1.0);
            console.log('[ForceRestore] Results:', restored);
            return { success: true, restored };

        } catch (error) {
            console.error('[ForceRestore] Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Apply a single event to the local state/DB (async wrapper for backward compat)
     */
    async applyEvent(event) {
        return this.applyEventSync(event);
    },

    /**
     * Synchronous version of applyEvent - used inside withTransactionSync for speed
     * 
     * FORTIFICATION: Uses strict schema parsers, ghost customer creation,
     * idempotent inserts (INSERT OR REPLACE), and absolute stock values.
     */
    applyEventSync(event) {
        const { type, payload } = event;

        try {
            if (type === EventTypes.INVOICE_CREATED) {
                // ─── Strict Schema Parse ───
                const inv = normalizeInvoicePayload(payload);

                // ─── GOLDEN RULE #3: Ensure customer exists (ghost creation) ───
                ensureCustomerExists(inv.customer_id, inv.customer_name);

                // ─── GOLDEN RULE #2: Idempotent INSERT OR REPLACE ───
                db.runSync(
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
                            db.runSync(`UPDATE products SET stock = stock - ? WHERE id = ?`, [parseInt(item.quantity) || 0, productId]);
                        }
                    }
                }

                // ─── Update Customer Stats ───
                if (inv.customer_id) {
                    try {
                        const received = inv.amountReceived;
                        const total = inv.total;
                        const outstandingDelta = Math.max(0, total - received);

                        db.runSync(
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
                db.runSync(
                    `INSERT OR REPLACE INTO products (id, name, sku, category, price, cost_price, stock, min_stock, unit, tax_rate, variants, variant, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [p.id, p.name, p.sku, p.category, p.price, p.cost_price, p.stock, p.min_stock, p.unit, p.tax_rate, p.variants, p.variant, p.created_at, p.updated_at]
                );

            } else if (type === EventTypes.PRODUCT_UPDATED) {
                // ─── GOLDEN RULE #3: Use absolute stock value from the event ───
                const p = normalizeProductPayload(payload);
                db.runSync(
                    `INSERT OR REPLACE INTO products (id, name, sku, category, price, cost_price, stock, min_stock, unit, tax_rate, variants, variant, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [p.id, p.name, p.sku, p.category, p.price, p.cost_price, p.stock, p.min_stock, p.unit, p.tax_rate, p.variants, p.variant, p.created_at, p.updated_at]
                );

            } else if (type === EventTypes.CUSTOMER_CREATED) {
                // ─── Idempotent: INSERT OR REPLACE handles duplicates ───
                const c = normalizeCustomerPayload(payload);
                db.runSync(
                    `INSERT OR REPLACE INTO customers (id, name, phone, email, type, gstin, address, source, tags, loyaltyPoints, outstanding, amountPaid, notes, created_at, updated_at, whatsappOptIn, smsOptIn)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [c.id, c.name, c.phone, c.email, c.type, c.gstin, c.address, c.source, c.tags, c.loyaltyPoints, c.outstanding, c.amountPaid, c.notes, c.created_at, c.updated_at, c.whatsappOptIn, c.smsOptIn]
                );

            } else if (type === EventTypes.CUSTOMER_UPDATED) {
                const c = normalizeCustomerPayload(payload);
                db.runSync(
                    `INSERT OR REPLACE INTO customers (id, name, phone, email, type, gstin, address, source, tags, loyaltyPoints, outstanding, amountPaid, notes, created_at, updated_at, whatsappOptIn, smsOptIn)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [c.id, c.name, c.phone, c.email, c.type, c.gstin, c.address, c.source, c.tags, c.loyaltyPoints, c.outstanding, c.amountPaid, c.notes, c.created_at, c.updated_at, c.whatsappOptIn, c.smsOptIn]
                );

            } else if (type === EventTypes.EXPENSE_CREATED) {
                // ─── Idempotent: INSERT OR REPLACE ───
                const e = normalizeExpensePayload(payload);
                db.runSync(
                    `INSERT OR REPLACE INTO expenses (id, title, amount, category, date, payment_method, receipt_url, tags, created_at, updated_at)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [e.id, e.title, e.amount, e.category, e.date, e.payment_method, e.receipt_url, e.tags, e.created_at, e.updated_at]
                );

            } else if (type === EventTypes.EXPENSE_ADJUSTED) {
                const { expenseId, delta, reason } = payload;
                // Adjustment tracking — this is append-only, not idempotent inherently.
                // But event dedup at the caller level ensures we never double-apply.
                db.runSync(
                    `INSERT INTO expense_adjustments (expense_id, delta, reason, created_at) VALUES (?, ?, ?, ?)`,
                    [expenseId, parseFloat(delta) || 0, reason || '', new Date().toISOString()]
                );
                db.runSync(
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
                            db.runSync(`UPDATE products SET stock = stock + ? WHERE id = ?`, [parseInt(item.quantity) || 0, productId]);
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

                        db.runSync(
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
                db.runSync(`DELETE FROM invoices WHERE id = ?`, [payload.id]);

            } else if (type === EventTypes.CUSTOMER_DELETED) {
                db.runSync(`DELETE FROM customers WHERE id = ?`, [payload.id]);

            } else if (type === EventTypes.PRODUCT_DELETED) {
                db.runSync(`DELETE FROM products WHERE id = ?`, [payload.id]);

            } else if (type === EventTypes.EXPENSE_UPDATED) {
                const e = normalizeExpensePayload(payload);
                db.runSync(
                    `INSERT OR REPLACE INTO expenses (id, title, amount, category, date, payment_method, receipt_url, tags, created_at, updated_at)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [e.id, e.title, e.amount, e.category, e.date, e.payment_method, e.receipt_url, e.tags, e.created_at, e.updated_at]
                );

            } else if (type === EventTypes.EXPENSE_DELETED) {
                db.runSync(`DELETE FROM expenses WHERE id = ?`, [payload.id]);

            } else if (type === EventTypes.INVOICE_UPDATED) {
                const inv = normalizeInvoicePayload(payload);
                // Ensure customer exists for updated invoice too
                ensureCustomerExists(inv.customer_id, inv.customer_name);

                db.runSync(
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
                    db.runSync(`UPDATE invoices SET is_deleted = ?, updated_at = ? WHERE id = ?`, [payload.is_deleted ? 1 : 0, payload.updated_at, payload.id]);
                }
                if (payload.status) {
                    db.runSync(`UPDATE invoices SET status = ?, updated_at = ? WHERE id = ?`, [payload.status, payload.updated_at, payload.id]);
                }

            } else if (type === EventTypes.PRODUCT_STOCK_ADJUSTED) {
                // ─── GOLDEN RULE #3: Use ABSOLUTE stock value, never stock = stock - qty ───
                if (payload.minStock !== undefined) {
                    db.runSync(`UPDATE products SET stock = ?, min_stock = ? WHERE id = ?`, [parseInt(payload.stock) || 0, parseInt(payload.minStock) || 0, payload.id]);
                } else {
                    db.runSync(`UPDATE products SET stock = ? WHERE id = ?`, [parseInt(payload.stock) || 0, payload.id]);
                }
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

            for (const item of currentQueue) {
                try {
                    await uploadFileToFolder(accessToken, folderId, item.fileName, JSON.stringify(item.content));
                    await this.removeFromQueue(item.content.eventId);
                    console.log(`[Sync] Retried & Uploaded: ${item.fileName}`);
                } catch (e) {
                    console.log(`[Sync] Retry failed for ${item.fileName}`);
                }
            }
        } catch (e) {
            console.log("[Sync] Retry loop aborted (Network?)", e);
        }
    }
};
