import { db } from './database';
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
    PRODUCT_DELETED: 'PRODUCT_DELETED',
    PRODUCT_STOCK_ADJUSTED: 'PRODUCT_STOCK_ADJUSTED',
};

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

        // 2. Try to upload immediately
        try {
            const accessToken = await getAccessToken(); // This might fail if offline
            if (!accessToken) throw new Error("No access token");

            const folderId = await this.getEventsFolderId(accessToken);

            await uploadFileToFolder(accessToken, folderId, fileName, JSON.stringify(envelope));

            // If successful, remove from queue
            await this.removeFromQueue(eventId);
            console.log(`[Sync] Event uploaded successfully: ${fileName}`);
            return true;
        } catch (error) {
            console.log(`[Sync] Upload failed (offline?), kept in queue: ${error.message}`);
            return false;
        }
    },

    /**
     * "Turn Sync On" - Fetch, Filter, Apply
     */
    async syncDown() {
        console.log('[Sync] Starting Sync Down...');
        try {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                console.log('[Sync] No access token, aborting sync down.');
                return;
            }
            const folderId = await this.getEventsFolderId(accessToken);

            // 1. List all files in events folder
            const query = `'${folderId}' in parents and trashed=false`;
            // Note: Google Drive API pagination should be handled for large lists, 
            // but for this implementation we fetch the first page (usually 100-1000 files).
            const res = await fetchWithTimeout(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=name`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            const data = await res.json();
            let files = data.files || [];

            // 2. Filter: Ignore already processed events
            const processedIdsStr = await AsyncStorage.getItem(PROCESSED_EVENTS_KEY);
            const processedIds = processedIdsStr ? JSON.parse(processedIdsStr) : [];
            const processedSet = new Set(processedIds);

            // Filter out files that don't look like events or are already processed
            // We rely on downloading the content to allow true idempotency check via eventId
            // Optimization: Filter by name structure if possible, but strict check is better.

            console.log(`[Sync Debug] Found ${files.length} files in Drive folder.`);
            if (files.length > 0) {
                console.log(`[Sync Debug] First 5 files: ${JSON.stringify(files.slice(0, 5).map(f => f.name))}`);
            }
            console.log(`[Sync Debug] Already processed ${processedSet.size} events locally.`);

            // Sort by filename (which includes timestamp) to ensure chronological order
            // format: event_{ISO_TIMESTAMP}_{TYPE}_{EVENT_ID}.json
            files.sort((a, b) => a.name.localeCompare(b.name));

            // 3. Download and Apply Events
            const filesToProcess = files.filter(f => {
                if (!f.name.startsWith('event_')) return false;
                const parts = f.name.replace('.json', '').split('_');
                const probableEventId = parts[parts.length - 1];
                return !processedSet.has(probableEventId);
            });

            console.log(`[Sync] ${filesToProcess.length} new events to process.`);

            // Optimization: Fetch event contents in parallel batches
            const BATCH_SIZE = 10;
            let processedCount = 0;

            for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
                const batch = filesToProcess.slice(i, i + BATCH_SIZE);
                console.log(`[Sync] Downloading batch ${i / BATCH_SIZE + 1}...`);

                const envelopes = await Promise.all(batch.map(async (file) => {
                    try {
                        const contentRes = await fetchWithTimeout(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
                            headers: { Authorization: `Bearer ${accessToken}` }
                        });
                        return await contentRes.json();
                    } catch (e) {
                        console.error(`[Sync] Failed to download event ${file.name}:`, e.message);
                        return null;
                    }
                }));

                // Apply batch sequentially to ensure order
                for (const envelope of envelopes) {
                    if (!envelope || processedSet.has(envelope.eventId)) continue;

                    try {
                        await this.applyEvent(envelope);
                        processedIds.push(envelope.eventId);
                        processedSet.add(envelope.eventId);
                        processedCount++;
                    } catch (applyError) {
                        console.error(`[Sync] Failed to apply event ${envelope.eventId}:`, applyError.message);
                        if (applyError.message.includes('UNIQUE constraint failed')) {
                            processedIds.push(envelope.eventId);
                            processedSet.add(envelope.eventId);
                        }
                    }
                }
            }

            // Save updated processed list
            await AsyncStorage.setItem(PROCESSED_EVENTS_KEY, JSON.stringify(processedIds));
            await AsyncStorage.setItem(LAST_SYNCED_KEY, new Date().toISOString());
            console.log(`[Sync] Sync Down Complete. Processed ${processedCount} new events.`);

        } catch (error) {
            console.error('[Sync] Sync Down Error:', error);
        }
    },

    /**
     * Resets the local sync state, effectively forcing a full re-sync on next run.
     */
    async resetSyncState() {
        try {
            await AsyncStorage.removeItem(PROCESSED_EVENTS_KEY);
            await AsyncStorage.removeItem(LAST_SYNCED_KEY);
            // Also clear pending queue to avoid re-uploading conflicts if needed?
            // No, keep pending queue.
            // processedIds = []; // These are local variables in syncDown, not global state
            // processedSet = new Set(); // These are local variables in syncDown, not global state
            console.log('[Sync] Sync State Reset Successfully');
            return true;
        } catch (e) {
            console.error('[Sync] Failed to reset sync state:', e);
            return false;
        }
    },

    /**
     * Apply a single event to the local state/DB
     */
    async applyEvent(event) {
        const { type, payload } = event;
        // console.log(`[Sync] Applying event: ${type}`);

        try {
            if (type === EventTypes.INVOICE_CREATED) {
                // 1. Insert Invoice
                const exists = db.getAllSync(`SELECT id FROM invoices WHERE id = ?`, [payload.id]);
                if (exists.length === 0) {
                    const itemsStr = JSON.stringify(payload.items);
                    const paymentsStr = JSON.stringify(payload.payments || []);

                    db.runSync(
                        `INSERT INTO invoices (
                            id, customer_id, customer_name, date, type, items, subtotal, tax, discount, total, status, payments, 
                            created_at, updated_at, taxType, grossTotal, itemDiscount, additionalCharges, roundOff, amountReceived, internalNotes
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            payload.id,
                            payload.customer_id,
                            payload.customer_name,
                            payload.date,
                            payload.type,
                            itemsStr,
                            payload.subtotal,
                            payload.tax,
                            payload.discount,
                            payload.total,
                            payload.status,
                            paymentsStr,
                            payload.created_at,
                            payload.updated_at,
                            payload.taxType || 'intra',
                            payload.grossTotal || 0,
                            payload.itemDiscount || 0,
                            payload.additionalCharges || 0,
                            payload.roundOff || 0,
                            payload.amountReceived || 0,
                            payload.internalNotes || ''
                        ]
                    );

                    // 2. Deduct Stock
                    // "Stock is calculated from Invoices" -> We update local cache
                    if (payload.items && Array.isArray(payload.items)) {
                        for (const item of payload.items) {
                            // item.productId, item.quantity
                            // If product exists locally, decrement stock
                            db.runSync(`UPDATE products SET stock = stock - ? WHERE id = ?`, [item.quantity, item.productId || item.id]);
                        }
                    }
                }

            } else if (type === EventTypes.PRODUCT_CREATED) {
                // Insert Product
                const exists = db.getAllSync(`SELECT id FROM products WHERE id = ?`, [payload.id]);
                if (exists.length === 0) {
                    db.runSync(
                        `INSERT INTO products (id, name, sku, category, price, stock, unit, tax_rate, variants, variant, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            String(payload.id),
                            String(payload.name || ''),
                            String(payload.sku || ''),
                            String(payload.category || ''),
                            Number(payload.price || 0),
                            Number(payload.stock || 0),
                            String(payload.unit || 'pc'),
                            Number(payload.tax_rate || 0),
                            JSON.stringify(payload.variants || []),
                            String(payload.variant || ''),
                            String(payload.created_at || new Date().toISOString()),
                            String(payload.updated_at || new Date().toISOString())
                        ]
                    );
                }

            } else if (type === EventTypes.PRODUCT_UPDATED) {
                // Update Product Details, ignore Stock
                db.runSync(
                    `UPDATE products SET name = ?, category = ?, price = ?, unit = ?, tax_rate = ?, variants = ?, variant = ?, updated_at = ? WHERE id = ?`,
                    [
                        payload.name, payload.category, payload.price, payload.unit, payload.tax_rate,
                        JSON.stringify(payload.variants), payload.variant, payload.updated_at,
                        payload.id
                    ]
                );

            } else if (type === EventTypes.CUSTOMER_CREATED) {
                const exists = db.getAllSync(`SELECT id FROM customers WHERE id = ?`, [payload.id]);
                if (exists.length === 0) {
                    db.runSync(
                        `INSERT INTO customers (id, name, phone, email, type, gstin, address, source, tags, loyaltyPoints, notes, created_at, updated_at, whatsappOptIn, smsOptIn)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            payload.id, payload.name, payload.phone, payload.email, payload.type,
                            payload.gstin,
                            typeof payload.address === 'object' ? JSON.stringify(payload.address) : payload.address,
                            payload.source,
                            Array.isArray(payload.tags) ? payload.tags.join(',') : payload.tags,
                            payload.loyaltyPoints || 0,
                            payload.notes,
                            payload.created_at, payload.updated_at,
                            payload.whatsappOptIn ? 1 : 0, payload.smsOptIn ? 1 : 0
                        ]
                    );
                }

            } else if (type === EventTypes.CUSTOMER_UPDATED) {
                db.runSync(
                    `UPDATE customers SET name = ?, phone = ?, email = ?, type = ?, gstin = ?, address = ?, source = ?, tags = ?, loyaltyPoints = ?, notes = ?, updated_at = ?, whatsappOptIn = ?, smsOptIn = ? WHERE id = ?`,
                    [
                        payload.name, payload.phone, payload.email, payload.type, payload.gstin,
                        typeof payload.address === 'object' ? JSON.stringify(payload.address) : payload.address,
                        payload.source,
                        Array.isArray(payload.tags) ? payload.tags.join(',') : payload.tags,
                        payload.loyaltyPoints || 0,
                        payload.notes,
                        payload.updated_at,
                        payload.whatsappOptIn ? 1 : 0, payload.smsOptIn ? 1 : 0,
                        payload.id
                    ]
                );

            } else if (type === EventTypes.EXPENSE_CREATED) {
                const exists = db.getAllSync(`SELECT id FROM expenses WHERE id = ?`, [payload.id]);
                if (exists.length === 0) {
                    db.runSync(
                        `INSERT INTO expenses (id, title, amount, category, date, payment_method, tags, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            payload.id, payload.title, payload.amount, payload.category, payload.date,
                            payload.payment_method, JSON.stringify(payload.tags),
                            payload.created_at, payload.updated_at
                        ]
                    );
                }

            } else if (type === EventTypes.EXPENSE_ADJUSTED) {
                const { expenseId, delta, reason } = payload;
                // 1. Insert into expense_adjustments
                db.runSync(
                    `INSERT INTO expense_adjustments (expense_id, delta, reason, created_at) VALUES (?, ?, ?, ?)`,
                    [expenseId, delta, reason, new Date().toISOString()]
                );

                // 2. Update current expense amount (State Derivation)
                db.runSync(
                    `UPDATE expenses SET amount = amount + ? WHERE id = ?`,
                    [delta, expenseId]
                );

            } else if (type === EventTypes.INVOICE_DELETED) {
                // Payload should contain invoice info needed to restore stock: items
                // 1. Restore Stock
                if (payload.items && Array.isArray(payload.items)) {
                    for (const item of payload.items) {
                        // item.productId, item.quantity
                        if (item.productId || item.id) {
                            db.runSync(`UPDATE products SET stock = stock + ? WHERE id = ?`, [item.quantity, item.productId || item.id]);
                        }
                    }
                }

                // 2. Delete Invoice
                db.runSync(`DELETE FROM invoices WHERE id = ?`, [payload.id]);

            } else if (type === EventTypes.CUSTOMER_DELETED) {
                db.runSync(`DELETE FROM customers WHERE id = ?`, [payload.id]);

            } else if (type === EventTypes.PRODUCT_DELETED) {
                db.runSync(`DELETE FROM products WHERE id = ?`, [payload.id]);

            } else if (type === EventTypes.EXPENSE_UPDATED) {
                db.runSync(
                    `UPDATE expenses SET title = ?, amount = ?, category = ?, date = ?, payment_method = ?, receipt_url = ?, updated_at = ? WHERE id = ?`,
                    [
                        payload.title, payload.amount, payload.category, payload.date,
                        payload.payment_method, payload.receipt_url, payload.updated_at,
                        payload.id
                    ]
                );
            } else if (type === EventTypes.EXPENSE_DELETED) {
                db.runSync(`DELETE FROM expenses WHERE id = ?`, [payload.id]);

            } else if (type === EventTypes.PRODUCT_STOCK_ADJUSTED) {
                db.runSync(`UPDATE products SET stock = ? WHERE id = ?`, [payload.stock, payload.id]);
            }
        } catch (e) {
            console.error(`[Sync] Apply Event Error (${type}):`, e);
            throw e; // Re-throw to ensure we don't mark as processed if failed? 
            // If we throw, the loop continues to retry next time. 
            // But if it's a permanent data error, we might get stuck. 
            // For now, logging error is safer to prevent crash loop, but we risk desync.
            // Let's swallow error but log critical failure.
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
