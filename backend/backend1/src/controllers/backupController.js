const { withDB } = require("../db/db");
const { performBackup, uploadEvent, listEvents, downloadEvent, clearEvents, uploadSnapshot } = require("../services/backupService");
const { v4: uuidv4 } = require('uuid');

exports.triggerBackup = async (req, res) => {
    try {
        const db = await withDB(req);

        // 🛡️ Check Settings for Automated Triggers
        const isAutomated = req.headers['x-automated-trigger'] === 'true';
        if (isAutomated) {
            const settingsRow = db.prepare('SELECT data FROM settings WHERE id = ?').get('singleton');
            const settingsData = settingsRow ? JSON.parse(settingsRow.data) : {};

            if (!settingsData.backup?.enabled) {
                console.log("[Backup] Automated trigger skipped: Disabled in settings");
                return res.json({ success: true, skipped: true, message: "Auto-backup disabled in settings" });
            }
        }

        const result = await performBackup(req.user.googleSub, req.userBaseDir);

        if (result.success) {
            res.json({ success: true, timestamp: result.timestamp });
        } else {
            res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error("Manual Backup Error:", error);

        // Detect authentication errors and return 401
        if (error.code === 'AUTH_REQUIRED' || error.code === 'AUTH_EXPIRED') {
            return res.status(401).json({
                success: false,
                error: error.message,
                authRequired: true
            });
        }

        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Upload an Event to Drive
 * Body: { type, payload }
 */
exports.syncEvent = async (req, res) => {
    const { type, payload } = req.body;
    if (!type || !payload) return res.status(400).json({ error: "Missing type or payload" });

    try {
        const db = await withDB(req);

        // Wrap in Envelope
        const eventEnvelope = {
            eventId: uuidv4(),
            eventVersion: 1,
            type,
            deviceId: 'desktop-electron', // Or get from req/config
            createdAt: new Date().toISOString(),
            payload
        };

        // 🌩️ Fire and forget upload to Drive (Non-blocking for offline support)
        uploadEvent(req.user.googleSub, eventEnvelope).catch(error => {
            console.error("☁️ Background Sync Event Upload Failed:", error.message);
            // In a production app, we would retry this later or queue it.
        });

        // Optimistically mark as processed locally
        const settings = db.prepare('SELECT data FROM settings WHERE id = ?').get('sync_state');
        let syncState = settings ? JSON.parse(settings.data) : { processedEventIds: [] };

        syncState.processedEventIds.push(eventEnvelope.eventId);

        // Save state
        db.prepare(`
            INSERT INTO settings (id, data, updated_at) 
            VALUES ('sync_state', ?, ?)
            ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
        `).run(JSON.stringify(syncState), new Date().toISOString());

        res.json({ success: true, eventId: eventEnvelope.eventId });
    } catch (error) {
        console.error("Sync Event Upload Error:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Force Push All Data (Segregated Snapshots)
 */
exports.pushAllData = async (req, res) => {
    try {
        const { clearExisting } = req.body;
        const db = await withDB(req);
        const userId = req.user.googleSub;

        // 1. Clear existing events if requested
        if (clearExisting) {
            console.log("🧹 Clearing existing events before push...");
            await clearEvents(userId);

            // Reset local sync state
            db.prepare(`
                UPDATE settings SET data = ?, updated_at = ? WHERE id = 'sync_state'
            `).run(JSON.stringify({ processedEventIds: [] }), new Date().toISOString());
        }

        let totalCount = 0;

        // Helper to push snapshot
        const pushSnapshot = async (table, filename, mapFn) => {
            const rows = db.prepare(`SELECT * FROM ${table}`).all();
            if (rows.length === 0) return;

            console.log(`📤 Pushing ${rows.length} ${table} as SNAPSHOT (flat file)...`);

            const payload = rows.map(row => mapFn ? mapFn(row) : row);

            await uploadSnapshot(userId, filename, payload);
            totalCount += rows.length;
        };

        // 2. Push Snapshots
        await pushSnapshot('products', 'products.json', (p) => ({
            ...p,
            variants: JSON.parse(p.variants || "[]")
        }));

        await pushSnapshot('customers', 'customers.json', (c) => ({
            ...c,
            address: JSON.parse(c.address || "{}"),
            tags: JSON.parse(c.tags || "[]")
        }));

        await pushSnapshot('invoices', 'invoices.json', (i) => ({
            ...i,
            items: JSON.parse(i.items || "[]"),
            payments: JSON.parse(i.payments || "[]")
        }));

        await pushSnapshot('expenses', 'expenses.json', (e) => ({
            ...e,
            tags: JSON.parse(e.tags || "[]")
        }));

        // 3. Update Local State (We don't need to add eventIds anymore for flat file snapshots)
        const settings = db.prepare('SELECT data FROM settings WHERE id = ?').get('sync_state');
        let syncState = settings ? JSON.parse(settings.data) : { processedEventIds: [] };

        db.prepare(`
            INSERT INTO settings (id, data, updated_at) 
            VALUES ('sync_state', ?, ?)
            ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
        `).run(JSON.stringify(syncState), new Date().toISOString());

        res.json({ success: true, count: totalCount, message: `Pushed ${totalCount} items in 4 snapshots` });

    } catch (error) {
        console.error("Push All Data Error:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Trigger Sync (Download & Apply)
 */
exports.triggerSync = async (req, res) => {
    try {
        const db = await withDB(req);

        // 1. Load Local State
        const settings = db.prepare('SELECT data FROM settings WHERE id = ?').get('sync_state');
        let syncState = settings ? JSON.parse(settings.data) : { processedEventIds: [], lastSyncAt: null };
        const processedIds = new Set(syncState.processedEventIds || []);

        // 2. List Events from Drive
        // TODO: Use pageToken for large sets
        const { files } = await listEvents(req.user.googleSub, null, syncState.lastSyncAt);

        if (!files || files.length === 0) {
            return res.json({ success: true, applied: 0, message: "No events found" });
        }

        // 3. Download & Mem-Sort (for strict ordering by payload.createdAt)
        const newEvents = [];

        // Filter by ID first *if* possible, but to be safe we check file content or rely on processedIds check after download.
        // Optimization: If filename contains uuid, we can check `processedIds` before download.
        // Filename format: event_{TIMESTAMP}_{TYPE}_{UUID}.json

        for (const file of files) {
            // content regex to extract uuid from filename?
            // "event_2024-01-30..._INVOICE..._uuid.json"
            const match = file.name.match(/_([0-9a-fA-F-]{36})\.json$/);
            if (match && processedIds.has(match[1])) {
                continue; // Skip already processed
            }

            // Download
            try {
                const content = await downloadEvent(req.user.googleSub, file.id);
                if (content && content.eventId && !processedIds.has(content.eventId)) {
                    newEvents.push(content);
                }
            } catch (e) {
                console.error(`Failed to download event ${file.id}`, e);
            }
        }

        // 4. Sort by Content Timestamp
        newEvents.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        // 5. Apply Events
        let appliedCount = 0;
        const transaction = db.transaction(() => {
            const applyEntity = (type, entity) => {
                // Map SNAPSHOT items to CREATED types logic
                // Or unify logic here

                switch (type) {
                    case 'INVOICE_CREATED':
                    case 'INVOICE_UPDATED':
                    case 'INVOICE_SNAPSHOT_ITEM':
                        const invItems = typeof entity.items === 'string' ? entity.items : JSON.stringify(entity.items || []);
                        const invPayments = typeof entity.payments === 'string' ? entity.payments : JSON.stringify(entity.payments || []);

                        db.prepare(`
                            INSERT INTO invoices (
                                id, customer_id, customer_name, date, type, items, 
                                subtotal, tax, discount, total, status, payments, 
                                created_at, updated_at, round_off, total_cost, 
                                balance, amount_received, payment_method, remarks
                            )
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(id) DO UPDATE SET 
                                customer_id=excluded.customer_id, customer_name=excluded.customer_name,
                                date=excluded.date, type=excluded.type, items=excluded.items,
                                subtotal=excluded.subtotal, tax=excluded.tax, discount=excluded.discount,
                                total=excluded.total, status=excluded.status, payments=excluded.payments,
                                updated_at=excluded.updated_at, round_off=excluded.round_off, 
                                total_cost=excluded.total_cost, balance=excluded.balance, 
                                amount_received=excluded.amount_received, payment_method=excluded.payment_method, 
                                remarks=excluded.remarks
                        `).run(
                            entity.id, entity.customer_id || entity.customerId || null, entity.customer_name || entity.customerName || 'Customer',
                            entity.date, entity.type || 'Retail',
                            invItems, entity.subtotal || 0, entity.tax || 0, entity.discount || 0, entity.total || 0,
                            entity.status || 'Paid', invPayments, entity.created_at || entity.createdAt || new Date().toISOString(),
                            entity.updated_at || entity.updatedAt || new Date().toISOString(),
                            entity.round_off || entity.roundOff || 0, entity.total_cost || entity.totalCost || 0,
                            entity.balance || 0, entity.amount_received || entity.amountReceived || 0,
                            entity.payment_method || entity.paymentMethod || '', entity.remarks || ''
                        );
                        break;
                    case 'INVOICE_DELETED':
                        db.prepare('DELETE FROM invoices WHERE id = ?').run(entity.id || entity.invoiceId);
                        break;

                    case 'EXPENSE_CREATED':
                    case 'EXPENSE_UPDATED':
                    case 'EXPENSE_SNAPSHOT_ITEM':
                        const expTags = typeof entity.tags === 'string' ? entity.tags : JSON.stringify(entity.tags || []);
                        db.prepare(`
                            INSERT INTO expenses (id, title, amount, category, date, payment_method, tags, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(id) DO UPDATE SET
                                title=excluded.title, amount=excluded.amount, category=excluded.category,
                                date=excluded.date, payment_method=excluded.payment_method, tags=excluded.tags,
                                updated_at=excluded.updated_at
                         `).run(
                            entity.id, entity.title, entity.amount, entity.category, entity.date || new Date().toISOString(),
                            entity.payment_method || entity.paymentMethod || '', expTags,
                            entity.created_at || entity.createdAt || new Date().toISOString(),
                            entity.updated_at || entity.updatedAt || new Date().toISOString()
                        );
                        break;
                    case 'EXPENSE_DELETED':
                        db.prepare('DELETE FROM expenses WHERE id = ?').run(entity.id || entity.expenseId);
                        break;

                    case 'EXPENSE_ADJUSTED':
                        // Check if adjustment ALREADY applied (idempotency via processedEvents usually handles this, 
                        // but if we re-process, we need to be careful).
                        // However, eventId check at top of loop prevents re-processing same event file.
                        // So we just need to valid the expense exists.

                        const parentExp = db.prepare('SELECT 1 FROM expenses WHERE id = ?').get(entity.expenseId);
                        if (parentExp) {
                            // Ensure adjustment ID uniqueness if provided in payload, or generate one?
                            // Best practice: Payload should have the adjustment details including ID.
                            // If entity is the "adjustment record":
                            const adjExists = db.prepare('SELECT 1 FROM expense_adjustments WHERE id = ?').get(entity.id);
                            if (!adjExists) {
                                db.prepare(`
                                    INSERT INTO expense_adjustments (id, expense_id, delta_amount, reason, created_at, updated_at)
                                    VALUES (?, ?, ?, ?, ?, ?)
                                `).run(
                                    entity.id || uuidv4(), // Fallback if no ID in payload (should satisfy NOT NULL)
                                    entity.expenseId,
                                    entity.delta,
                                    entity.reason,
                                    entity.createdAt || new Date().toISOString(),
                                    new Date().toISOString()
                                );
                            }
                        }
                        break;

                    case 'PRODUCT_CREATED':
                    case 'PRODUCT_UPDATED':
                    case 'PRODUCT_SNAPSHOT_ITEM':
                        const prodVariants = typeof entity.variants === 'string' ? entity.variants : JSON.stringify(entity.variants || []);
                        db.prepare(`
                            INSERT INTO products (
                                id, name, sku, category, brand, price, stock, unit, tax_rate, variants, created_at, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(id) DO UPDATE SET 
                                name=excluded.name, sku=excluded.sku, category=excluded.category, brand=excluded.brand,
                                price=excluded.price, stock=excluded.stock, unit=excluded.unit, tax_rate=excluded.tax_rate,
                                variants=excluded.variants, updated_at=excluded.updated_at
                        `).run(
                            entity.id, entity.name || 'Unnamed', entity.sku || '', entity.category || '', entity.brand || '',
                            entity.price || 0, entity.stock || 0, entity.unit || '', entity.tax_rate || entity.taxRate || 0,
                            prodVariants, entity.created_at || entity.createdAt || new Date().toISOString(),
                            entity.updated_at || entity.updatedAt || new Date().toISOString()
                        );
                        break;
                    case 'PRODUCT_DELETED':
                        db.prepare('DELETE FROM products WHERE id = ?').run(entity.id || entity.productId);
                        break;

                    case 'CUSTOMER_CREATED':
                    case 'CUSTOMER_UPDATED':
                    case 'CUSTOMER_SNAPSHOT_ITEM':
                        const custAddress = typeof entity.address === 'string' ? entity.address : JSON.stringify(entity.address || {});
                        const custTags = typeof entity.tags === 'string' ? entity.tags : JSON.stringify(entity.tags || []);
                        db.prepare(`
                            INSERT INTO customers (
                                id, firstName, lastName, phone, email, customerType, gstin, address, 
                                source, tags, loyaltyPoints, notes, createdAt
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(id) DO UPDATE SET 
                                firstName=excluded.firstName, lastName=excluded.lastName, phone=excluded.phone, 
                                email=excluded.email, customerType=excluded.customerType, gstin=excluded.gstin, 
                                address=excluded.address, source=excluded.source, tags=excluded.tags, 
                                loyaltyPoints=excluded.loyaltyPoints, notes=excluded.notes
                        `).run(
                            entity.id, entity.firstName || 'Unknown', entity.lastName || '', entity.phone || '',
                            entity.email || '', entity.customerType || 'Individual', entity.gstin || '',
                            custAddress, entity.source || 'Sync', custTags, entity.loyaltyPoints || 0,
                            entity.notes || '',
                            entity.createdAt || entity.created_at || new Date().toISOString()
                        );
                        break;
                    case 'CUSTOMER_DELETED':
                        db.prepare('DELETE FROM customers WHERE id = ?').run(entity.id || entity.customerId);
                        break;
                }
            };

            for (const event of newEvents) {
                if (processedIds.has(event.eventId)) continue;

                const { type, payload } = event;

                if (type.endsWith('_SNAPSHOT')) {
                    // Handle Snapshot Arrays
                    const entityList = Array.isArray(payload) ? payload : [];
                    let itemType = '';
                    if (type === 'PRODUCTS_SNAPSHOT') itemType = 'PRODUCT_SNAPSHOT_ITEM';
                    if (type === 'CUSTOMERS_SNAPSHOT') itemType = 'CUSTOMER_SNAPSHOT_ITEM';
                    if (type === 'INVOICES_SNAPSHOT') itemType = 'INVOICE_SNAPSHOT_ITEM';
                    if (type === 'EXPENSES_SNAPSHOT') itemType = 'EXPENSE_SNAPSHOT_ITEM';

                    for (const item of entityList) {
                        applyEntity(itemType, item);
                    }
                } else {
                    // Handle Single Events
                    const entity = payload.entity || payload;
                    applyEntity(type, entity);
                }

                processedIds.add(event.eventId);
                appliedCount++;
            }
        });

        transaction();

        // 6. Recalculate Stock (Simplified)
        // REMOVED: Do not calculate stock passively. Trust explicit PRODUCT_UPDATED events 
        // that both Desktop and Mobile correctly send next in the timeline.

        // 7. Save Sync State
        // Truncate processed events array to the last 1000 to prevent bloat, since lastSyncAt handles older events
        const recentProcessedIds = Array.from(processedIds).slice(-1000);
        const finalSyncState = { processedEventIds: recentProcessedIds, lastSyncAt: new Date().toISOString() };
        db.prepare(`
            UPDATE settings SET data = ?, updated_at = ? WHERE id = 'sync_state'
        `).run(JSON.stringify(finalSyncState), new Date().toISOString());

        res.json({ success: true, applied: appliedCount });

    } catch (error) {
        console.error("Sync Error:", error);

        // Detect authentication errors and return 401
        if (error.code === 'AUTH_REQUIRED' || error.code === 'AUTH_EXPIRED') {
            return res.status(401).json({
                success: false,
                error: error.message,
                authRequired: true
            });
        }

        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getBackupStatus = async (req, res) => {
    try {
        const db = await withDB(req);
        const settings = db.prepare('SELECT data FROM settings WHERE id = ?').get('sync_state');
        const syncState = settings ? JSON.parse(settings.data) : { lastSyncAt: null };
        res.json({ status: "idle", lastSyncAt: syncState.lastSyncAt });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
