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
            const updateStatus = (msg) => {
                console.log(`[Sync] ${msg}`);
                onProgress(msg);
            };

            updateStatus('Starting Sync Down...');
            const accessToken = await getAccessToken();
            if (!accessToken) return { success: false, processedCount: 0, failures: 1, error: "No Access Token" };


            const folderId = await this.getEventsFolderId(accessToken);
            if (!folderId) return { success: false, processedCount: 0, failures: 1, error: "No Folder ID" };

            // 1. List all files in events folder
            updateStatus('Fetching cloud updates...');

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

            updateStatus(`Found ${allFiles.length} files total. Filtering...`);

            // Sort by filename 
            allFiles.sort((a, b) => a.name.localeCompare(b.name));

            // 3. Download and Apply Events
            const filesToProcess = allFiles.filter(f => {
                const parts = f.name.replace('.json', '').split('_');
                // Pattern: event_TIMESTAMP_TYPE_EVENTID
                // If it doesn't match roughly, might not handle well, but let's try extracting last part
                const probableEventId = parts[parts.length - 1];
                return !processedSet.has(probableEventId);
            });

            if (filesToProcess.length === 0) {
                updateStatus('Cloud is already up to date.');
                return { success: true, processedCount: 0, failures: 0 };
            }

            updateStatus(`${filesToProcess.length} new events found.`);

            // Optimization: Fetch event contents in parallel batches
            const BATCH_SIZE = 50; // Increased from 10 to significantly speed up sync
            let processedCount = 0;
            let failures = 0;

            const startTime = Date.now();

            for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
                const batch = filesToProcess.slice(i, i + BATCH_SIZE);

                // Calculate granular progress for this segment (mapping from ~0.7 to 0.9 range)
                const segmentProgress = i / filesToProcess.length;
                const overallProgress = 0.65 + (segmentProgress * 0.25); // Range 0.65 to 0.9

                // Re-fetch token once per batch to ensure it's fresh and avoid redundant calls in the inner loop
                const currentToken = await getAccessToken();
                if (!currentToken) throw new Error("Token expired or missing");

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
                    if (updateStatus) updateStatus(msg, overallProgress);
                } else {
                    if (updateStatus) updateStatus(`Starting data download...`, 0.65);
                }

                const envelopes = await Promise.all(batch.map(async (file) => {
                    let attempts = 0;
                    while (attempts < 3) {
                        try {
                            const contentRes = await fetchWithTimeout(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
                                headers: { Authorization: `Bearer ${currentToken}` }
                            });

                            if (!contentRes.ok) {
                                const errorText = await contentRes.text();
                                throw new Error(`HTTP ${contentRes.status}: ${errorText.substring(0, 50)}`);
                            }

                            const text = await contentRes.text();
                            if (!text || text.trim() === "") {
                                console.warn(`[Sync] Empty content for ${file.name}`);
                                return null;
                            }

                            // Robust Cleaning: Strip MIME headers if they were accidentally saved in the file content
                            let cleanText = text.trim();
                            if (cleanText.toLowerCase().includes('content-type:')) {
                                console.log(`[Sync] Found MIME headers in ${file.name}, attempts to extract body...`);
                                // Headers end with double newline. The body follows the headers.
                                const parts = cleanText.split(/\r?\n\r?\n/);
                                if (parts.length > 1) {
                                    // The part after headers is usually the body. 
                                    // Find the first part that is NOT a header.
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
                                if (cleanText.startsWith('U2FsdGVkX1')) {
                                    // Silently skip legacy encrypted events
                                    return null;
                                }
                                console.error(`[Sync] JSON Parse Error for ${file.name}. Content starts with: "${cleanText.substring(0, 100)}"`);
                                throw jsonError;
                            }
                        } catch (e) {
                            attempts++;
                            console.warn(`[Sync] Download attempt ${attempts} failed for ${file.name}: ${e.message}`);
                            if (attempts >= 3) {
                                console.error(`[Sync] Failed to download event ${file.name} after 3 attempts.`);
                                return null;
                            }
                            // Exponential backoff
                            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempts - 1)));
                        }
                    }
                    return null;
                }));

                // Apply batch sequentially to ensure order
                for (let j = 0; j < envelopes.length; j++) {
                    const envelope = envelopes[j];
                    if (!envelope) {
                        failures++;
                        continue;
                    }

                    if (processedSet.has(envelope.eventId)) continue;

                    try {
                        await this.applyEvent(envelope);
                        processedIds.push(envelope.eventId);
                        processedSet.add(envelope.eventId);
                        processedCount++;
                    } catch (applyError) {
                        console.error(`[Sync] Failed to apply event ${envelope.eventId}:`, applyError.message);
                        failures++;
                    }
                }

                // Save progress aggressively
                await AsyncStorage.setItem(PROCESSED_EVENTS_KEY, JSON.stringify(processedIds));
            }

            await AsyncStorage.setItem(LAST_SYNCED_KEY, new Date().toISOString());
            const finalMsg = `Sync Complete! Applied ${processedCount} new events. ${failures > 0 ? `(${failures} failed)` : ''}`;
            updateStatus(finalMsg);

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

    /**
     * Apply a single event to the local state/DB
     */
    async applyEvent(event) {
        const { type, payload } = event;

        try {
            if (type === EventTypes.INVOICE_CREATED) {
                // 1. Insert Invoice
                const exists = db.getAllSync(`SELECT id FROM invoices WHERE id = ?`, [payload.id]);
                if (exists.length === 0) {
                    const itemsStr = JSON.stringify(payload.items);
                    const paymentsStr = JSON.stringify(payload.payments || []);

                    // Normalize customer name from payload (handle both camelCase and snake_case)
                    const customerName = payload.customer_name || payload.customerName || 'Guest';
                    const customerId = payload.customer_id || payload.customerId || '';

                    db.runSync(
                        `INSERT INTO invoices (
                            id, customer_id, customer_name, date, type, items, subtotal, tax, discount, total, status, payments, 
                            created_at, updated_at, taxType, grossTotal, itemDiscount, additionalCharges, roundOff, amountReceived, internalNotes,
                            is_deleted
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            payload.id,
                            customerId,
                            customerName,
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
                            payload.internalNotes || '',
                            payload.is_deleted || 0
                        ]
                    );

                    // 2. Deduct Stock
                    if (payload.items && Array.isArray(payload.items)) {
                        for (const item of payload.items) {
                            db.runSync(`UPDATE products SET stock = stock - ? WHERE id = ?`, [item.quantity, item.productId || item.id]);
                        }
                    }

                    // 3. Update Customer Stats (Loyalty & Balance)
                    if (payload.customer_id || payload.customerId) {
                        try {
                            const cid = payload.customer_id || payload.customerId;
                            const received = parseFloat(payload.amountReceived) || 0;
                            const total = parseFloat(payload.total) || 0;
                            const outstandingDelta = Math.max(0, total - received);

                            db.runSync(
                                `UPDATE customers SET 
                                    loyaltyPoints = loyaltyPoints + 1,
                                    amountPaid = amountPaid + ?,
                                    outstanding = outstanding + ?
                                 WHERE id = ?`,
                                [received, outstandingDelta, String(cid)]
                            );
                        } catch (custErr) {
                            console.log('[Sync] Customer update skipped (maybe guest or deleted):', custErr.message);
                        }
                    }
                }

            } else if (type === EventTypes.PRODUCT_CREATED) {
                // Insert Product - Use OR REPLACE to handle duplicates or SKU conflicts
                db.runSync(
                    `INSERT OR REPLACE INTO products (id, name, sku, category, price, cost_price, stock, min_stock, unit, tax_rate, variants, variant, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        String(payload.id),
                        String(payload.name || ''),
                        String(payload.sku || ''),
                        String(payload.category || ''),
                        Number(payload.price || 0),
                        Number(payload.costPrice || payload.cost_price || 0),
                        Number(payload.stock || 0),
                        Number(payload.minStock || payload.min_stock || 0),
                        String(payload.unit || 'pc'),
                        Number(payload.tax_rate || 0),
                        JSON.stringify(payload.variants || []),
                        String(payload.variant || ''),
                        String(payload.created_at || new Date().toISOString()),
                        String(payload.updated_at || new Date().toISOString())
                    ]
                );

            } else if (type === EventTypes.PRODUCT_UPDATED) {
                // Update Product Details, ignore Stock (Stock is managed by adjustments/invoices)
                db.runSync(
                    `UPDATE products SET name = ?, sku = ?, category = ?, price = ?, cost_price = ?, stock = ?, min_stock = ?, unit = ?, tax_rate = ?, variants = ?, variant = ?, updated_at = ? WHERE id = ?`,
                    [
                        payload.name, payload.sku, payload.category, payload.price,
                        Number(payload.costPrice || payload.cost_price || 0),
                        (payload.stock !== undefined ? parseInt(payload.stock) : (payload.stock || 0)),
                        (payload.minStock || payload.min_stock || 0),
                        payload.unit, payload.tax_rate,
                        JSON.stringify(payload.variants || []), payload.variant, payload.updated_at,
                        payload.id
                    ]
                );

            } else if (type === EventTypes.CUSTOMER_CREATED) {
                const exists = db.getAllSync(`SELECT id FROM customers WHERE id = ?`, [payload.id]);
                if (exists.length === 0) {
                    db.runSync(
                        `INSERT INTO customers (id, name, phone, email, type, gstin, address, source, tags, loyaltyPoints, outstanding, amountPaid, notes, created_at, updated_at, whatsappOptIn, smsOptIn)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            payload.id, payload.name, payload.phone, payload.email, payload.type,
                            payload.gstin,
                            typeof payload.address === 'object' ? JSON.stringify(payload.address) : payload.address,
                            payload.source,
                            Array.isArray(payload.tags) ? payload.tags.join(',') : payload.tags,
                            payload.loyaltyPoints || 0,
                            payload.outstanding || 0,
                            payload.amountPaid || 0,
                            payload.notes,
                            payload.created_at, payload.updated_at,
                            payload.whatsappOptIn ? 1 : 0, payload.smsOptIn ? 1 : 0
                        ]
                    );
                }

            } else if (type === EventTypes.CUSTOMER_UPDATED) {
                db.runSync(
                    `UPDATE customers SET name = ?, phone = ?, email = ?, type = ?, gstin = ?, address = ?, source = ?, tags = ?, loyaltyPoints = ?, outstanding = ?, amountPaid = ?, notes = ?, updated_at = ?, whatsappOptIn = ?, smsOptIn = ? WHERE id = ?`,
                    [
                        payload.name, payload.phone, payload.email, payload.type, payload.gstin,
                        typeof payload.address === 'object' ? JSON.stringify(payload.address) : payload.address,
                        payload.source,
                        Array.isArray(payload.tags) ? payload.tags.join(',') : payload.tags,
                        payload.loyaltyPoints || 0,
                        payload.outstanding || 0,
                        payload.amountPaid || 0,
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
                        `INSERT INTO expenses (id, title, amount, category, date, payment_method, receipt_url, tags, created_at, updated_at)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            payload.id, payload.title, payload.amount, payload.category, payload.date,
                            payload.payment_method, payload.receiptUrl || payload.receipt_url || '',
                            JSON.stringify(payload.tags || []),
                            payload.created_at, payload.updated_at
                        ]
                    );
                }

            } else if (type === EventTypes.EXPENSE_ADJUSTED) {
                const { expenseId, delta, reason } = payload;
                db.runSync(
                    `INSERT INTO expense_adjustments (expense_id, delta, reason, created_at) VALUES (?, ?, ?, ?)`,
                    [expenseId, delta, reason, new Date().toISOString()]
                );
                db.runSync(
                    `UPDATE expenses SET amount = amount + ? WHERE id = ?`,
                    [delta, expenseId]
                );

            } else if (type === EventTypes.INVOICE_DELETED) {
                if (payload.items && Array.isArray(payload.items)) {
                    for (const item of payload.items) {
                        if (item.productId || item.id) {
                            db.runSync(`UPDATE products SET stock = stock + ? WHERE id = ?`, [item.quantity, item.productId || item.id]);
                        }
                    }
                }
                if (payload.customer_id || payload.customerId) {
                    try {
                        const cid = payload.customer_id || payload.customerId;
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

            } else if (type === EventTypes.INVOICE_UPDATED) {
                const itemsStr = JSON.stringify(payload.items);
                const paymentsStr = JSON.stringify(payload.payments || []);
                db.runSync(
                    `UPDATE invoices SET 
                        customer_id = ?, customer_name = ?, date = ?, type = ?, items = ?, subtotal = ?, tax = ?, discount = ?, 
                        total = ?, status = ?, payments = ?, updated_at = ?, taxType = ?, grossTotal = ?, itemDiscount = ?, 
                        additionalCharges = ?, roundOff = ?, amountReceived = ?, internalNotes = ?, is_deleted = ?
                     WHERE id = ?`,
                    [
                        payload.customer_id || payload.customerId || '', 
                        payload.customer_name || payload.customerName || 'Guest',
                        payload.date, payload.type, itemsStr, payload.subtotal, payload.tax, payload.discount,
                        payload.total, payload.status, paymentsStr, payload.updated_at, payload.taxType,
                        payload.grossTotal, payload.itemDiscount, payload.additionalCharges, payload.roundOff,
                        payload.amountReceived, payload.internalNotes, payload.is_deleted !== undefined ? payload.is_deleted : 0,
                        payload.id
                    ]
                );

            } else if (type === EventTypes.INVOICE_STATUS_UPDATED) {
                if (payload.is_deleted !== undefined) {
                    db.runSync(`UPDATE invoices SET is_deleted = ?, updated_at = ? WHERE id = ?`, [payload.is_deleted, payload.updated_at, payload.id]);
                }
                if (payload.status) {
                    db.runSync(`UPDATE invoices SET status = ?, updated_at = ? WHERE id = ?`, [payload.status, payload.updated_at, payload.id]);
                }

            } else if (type === EventTypes.PRODUCT_STOCK_ADJUSTED) {
                if (payload.minStock !== undefined) {
                    db.runSync(`UPDATE products SET stock = ?, min_stock = ? WHERE id = ?`, [payload.stock, payload.minStock, payload.id]);
                } else {
                    db.runSync(`UPDATE products SET stock = ? WHERE id = ?`, [payload.stock, payload.id]);
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
