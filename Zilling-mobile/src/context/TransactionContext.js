import React, { createContext, useContext, useState, useEffect } from 'react';
import { triggerAutoSave } from '../services/autosaveService';
import { db } from '../services/database';

const TransactionContext = createContext();

export const useTransactions = () => useContext(TransactionContext);

export const TransactionProvider = ({ children }) => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Initial load from SQLite
    useEffect(() => {
        const loadTransactions = async () => {
            try {
                const data = db.getAllSync(`
                    SELECT i.*, c.name as c_name 
                    FROM invoices i 
                    LEFT JOIN customers c ON i.customer_id = c.id 
                    WHERE i.is_deleted = 0 
                    ORDER BY i.date DESC
                `);
                // Parse items and payments JSON strings and normalize keys
                const parsedData = data.map(tx => {
                    // Get customer name with multiple fallbacks
                    let custName = tx.c_name || tx.customer_name || tx.customerName;
                    // If customer name is empty, null, or just whitespace, try to get it from items
                    if (!custName || custName.trim() === '') {
                        custName = 'Guest';
                    }
                    return {
                        ...tx,
                        customerName: custName,
                        customerId: tx.customer_id || tx.customerId || '',
                        items: typeof tx.items === 'string' ? JSON.parse(tx.items) : (tx.items || []),
                        payments: typeof tx.payments === 'string' ? JSON.parse(tx.payments) : (tx.payments || [])
                    };
                });
                setTransactions(parsedData || []);
            } catch (err) {
                console.error('Failed to load transactions:', err);
                setError('Failed to load transactions');
            } finally {
                setLoading(false);
            }
        };
        loadTransactions();
    }, []);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const data = db.getAllSync(`
                SELECT i.*, c.name as c_name 
                FROM invoices i 
                LEFT JOIN customers c ON i.customer_id = c.id 
                WHERE i.is_deleted = 0 
                ORDER BY i.date DESC
            `);
            // Parse items and payments JSON strings and normalize keys
            const parsedData = data.map(tx => {
                // Get customer name with multiple fallbacks
                let custName = tx.c_name || tx.customer_name || tx.customerName;
                // If customer name is empty, null, or just whitespace, default to Guest
                if (!custName || custName.trim() === '') {
                    custName = 'Guest';
                }
                return {
                    ...tx,
                    customerName: custName,
                    customerId: tx.customer_id || tx.customerId || '',
                    items: typeof tx.items === 'string' ? JSON.parse(tx.items) : (tx.items || []),
                    payments: typeof tx.payments === 'string' ? JSON.parse(tx.payments) : (tx.payments || [])
                };
            });
            setTransactions(parsedData || []);
        } finally {
            setLoading(false);
        }
    };

    const fetchDeletedTransactions = async () => {
        try {
            const data = db.getAllSync(`
                SELECT i.*, c.name as c_name 
                FROM invoices i 
                LEFT JOIN customers c ON i.customer_id = c.id 
                WHERE i.is_deleted = 1 
                ORDER BY i.date DESC
            `);
            return data.map(tx => {
                // Get customer name with multiple fallbacks
                let custName = tx.c_name || tx.customer_name || tx.customerName;
                // If customer name is empty, null, or just whitespace, default to Guest
                if (!custName || custName.trim() === '') {
                    custName = 'Guest';
                }
                return {
                    ...tx,
                    customerName: custName,
                    items: typeof tx.items === 'string' ? JSON.parse(tx.items) : (tx.items || []),
                    payments: typeof tx.payments === 'string' ? JSON.parse(tx.payments) : (tx.payments || [])
                };
            });
        } catch (err) {
            console.error('Fetch deleted error:', err);
            return [];
        }
    };

    const addTransaction = async (data) => {
        try {
            const id = data.id || `INV-${Date.now()}`;
            const itemsJson = JSON.stringify(data.items || []);
            const paymentsJson = JSON.stringify(data.payments || []);
            const date = data.date ? new Date(data.date).toISOString() : new Date().toISOString();

            // Calculate Weekly Sequence (Starts from 1 and resets every Sunday)
            const invoiceDate = new Date(date);
            const startOfWeek = new Date(invoiceDate);
            startOfWeek.setDate(invoiceDate.getDate() - invoiceDate.getDay()); // To Sunday
            startOfWeek.setHours(0, 0, 0, 0);

            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 7);

            let weeklySequence = 1;
            try {
                // Try to get max sequence
                const row = db.getFirstSync(
                    'SELECT MAX(weekly_sequence) as maxSeq FROM invoices WHERE date >= ? AND date < ?',
                    [startOfWeek.toISOString(), endOfWeek.toISOString()]
                );
                weeklySequence = (Number(row?.maxSeq) || 0) + 1;
            } catch (e) {
                console.log("[TransactionContext] Sequence column might be missing, falling back to 1. Error:", e.message);
                // Attempt an emergency migration if column is missing
                try {
                    db.execSync('ALTER TABLE invoices ADD COLUMN weekly_sequence INTEGER DEFAULT 1;');
                    console.log("[TransactionContext] Emergency migration: weekly_sequence column added.");
                } catch (migrationErr) {
                    // Column might already exist but query failed for another reason, or table is busy
                }
            }


            db.runSync(
                `INSERT INTO invoices (
                    id, customer_id, customer_name, date, type, items, subtotal, tax, discount, total, status, payments, 
                    created_at, updated_at, taxType, grossTotal, itemDiscount, additionalCharges, roundOff, amountReceived, internalNotes, weekly_sequence,
                    loyalty_points_redeemed, loyalty_points_earned, loyalty_points_discount, is_deleted
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    data.customerId || '',
                    data.customerName || 'Guest',
                    date,
                    data.type || 'Sales',
                    itemsJson,
                    data.subtotal || 0,
                    data.tax || 0,
                    data.discount || 0,
                    data.total || 0,
                    data.status || 'Paid',
                    paymentsJson,
                    new Date().toISOString(),
                    new Date().toISOString(),
                    data.taxType || 'intra',
                    data.grossTotal || 0,
                    data.itemDiscount || 0,
                    data.additionalCharges || 0,
                    data.roundOff || 0,
                    data.amountReceived || 0,
                    data.internalNotes || '',
                    weeklySequence,
                    data.loyaltyPointsRedeemed || 0,
                    data.loyaltyPointsEarned || 0,
                    data.loyaltyPointsDiscount || 0,
                    0 // is_deleted
                ]
            );

            const newTx = { ...data, id, date, items: data.items || [], payments: data.payments || [], weekly_sequence: weeklySequence, is_deleted: 0 };
            setTransactions(prev => [newTx, ...prev]);

            // [AutoSave]
            triggerAutoSave();

            // [Loyalty Points & Balance Update]
            if (data.customerId) {
                try {
                    const received = parseFloat(data.amountReceived) || 0;
                    const total = parseFloat(data.total) || 0;
                    const outstandingDelta = Math.max(0, total - received);

                    const redeemed = parseInt(data.loyaltyPointsRedeemed) || 0;
                    const earned = parseInt(data.loyaltyPointsEarned) || 0;

                    // Update loyalty points (Net Change = Earned - Redeemed), lifetime amountPaid, and current outstanding
                    db.runSync(
                        `UPDATE customers SET 
                            loyaltyPoints = loyaltyPoints - ? + ?,
                            amountPaid = amountPaid + ?,
                            outstanding = outstanding + ?
                         WHERE id = ?`,
                        [redeemed, earned, received, outstandingDelta, String(data.customerId)]
                    );
                    console.log(`[TransactionContext] Updated customer ${data.customerId}: -${redeemed} +${earned} Loyalty, +${received} Paid, +${outstandingDelta} Due`);

                    // [Sync Customer Stats]
                    try {
                        const { SyncService, EventTypes } = require('../services/OneWaySyncService');
                        const updatedCust = db.getFirstSync('SELECT * FROM customers WHERE id = ?', [String(data.customerId)]);
                        if (updatedCust) {
                            SyncService.createAndUploadEvent(EventTypes.CUSTOMER_UPDATED, updatedCust);
                        }
                    } catch (syncCustErr) {
                        console.log('[TransactionContext] Sync Customer Stats Error:', syncCustErr);
                    }
                } catch (custUpdateErr) {
                    console.error('[TransactionContext] Failed to update customer stats:', custUpdateErr);
                }
            }

            // [Stock Update] - Decrement stock for sold items
            if (data.items && Array.isArray(data.items)) {
                data.items.forEach(item => {
                    const pid = item.productId || item.id;
                    const qty = parseFloat(item.quantity) || 0;
                    if (pid && qty > 0) {
                        try {
                            // ... stock update logic ...
                            db.runSync(`UPDATE products SET stock = stock - ? WHERE id = ?`, [Number(qty), String(pid)]);
                            // ... variant logic ...
                            if (item.variantName) {
                                const productRow = db.getFirstSync('SELECT variants FROM products WHERE id = ?', [pid]);
                                if (productRow && productRow.variants) {
                                    let variantsArr = [];
                                    try { variantsArr = JSON.parse(productRow.variants); } catch (e) { variantsArr = []; }
                                    if (Array.isArray(variantsArr) && variantsArr.length > 0) {
                                        let updated = false;
                                        const newVariants = variantsArr.map(v => {
                                            if (v.name && v.name.trim() === item.variantName.trim()) {
                                                const currentStock = parseFloat(v.stock) || 0;
                                                v.stock = Math.max(0, currentStock - qty);
                                                updated = true;
                                            }
                                            return v;
                                        });
                                        if (updated) {
                                            db.runSync('UPDATE products SET variants = ? WHERE id = ?', [JSON.stringify(newVariants), pid]);
                                        }
                                    }
                                }
                            }
                        } catch (stockErr) {
                            console.error(`[TransactionContext] Failed to update stock for ${pid}:`, stockErr);
                        }
                    }
                });
            }

            // [Sync]
            try {
                const { SyncService, EventTypes } = require('../services/OneWaySyncService');
                SyncService.createAndUploadEvent(EventTypes.INVOICE_CREATED, newTx);

                // [Enhanced Sync] Explicitly update stock in the cloud log for each item
                if (data.items && Array.isArray(data.items)) {
                    data.items.forEach(item => {
                        const pid = item.productId || item.id;
                        if (pid) {
                            // Fetch the latest stock from local DB after restoration/deduction
                            const prodRow = db.getFirstSync('SELECT stock FROM products WHERE id = ?', [String(pid)]);
                            if (prodRow) {
                                SyncService.createAndUploadEvent(EventTypes.PRODUCT_STOCK_ADJUSTED, {
                                    id: pid,
                                    stock: prodRow.stock
                                });
                            }
                        }
                    });
                }
            } catch (syncErr) {
                console.log('Sync Trigger Error:', syncErr);
            }

            return newTx;
        } catch (err) {
            console.error('Add Transaction SQL Error:', err);
            throw err;
        }
    };

    const updateTransactionStatus = async (id, status) => {
        try {
            db.runSync(
                'UPDATE invoices SET status = ?, updated_at = ? WHERE id = ?',
                [status, new Date().toISOString(), id]
            );
            setTransactions(prev => prev.map(t => t.id === id ? { ...t, status } : t));

            // [AutoSave]
            triggerAutoSave();

            // [Sync]
            try {
                const { SyncService, EventTypes } = require('../services/OneWaySyncService');
                SyncService.createAndUploadEvent(EventTypes.INVOICE_STATUS_UPDATED, { id, status, updated_at: new Date().toISOString() });
            } catch (e) {
                console.log('Sync Status Update Error:', e);
            }
        } catch (err) {
            console.error('Update Status Error:', err);
            throw err;
        }
    };

    const clearAllTransactions = async () => {
        try {
            // Use execSync for simple parameter-less statements to avoid potential binding issues
            db.execSync('DELETE FROM invoices');
            setTransactions([]);
            triggerAutoSave();
        } catch (err) {
            console.error('Clear All Error:', err);
            throw err;
        }
    };

    const editTransaction = async (data) => {
        try {
            const id = data.id;
            if (!id) throw new Error("Transaction ID missing for update");

            const itemsJson = JSON.stringify(data.items || []);
            const paymentsJson = JSON.stringify(data.payments || []);
            const date = data.date ? new Date(data.date).toISOString() : new Date().toISOString();

            db.runSync(
                `UPDATE invoices SET 
                    customer_id = ?, customer_name = ?, date = ?, type = ?, items = ?, 
                    subtotal = ?, tax = ?, discount = ?, total = ?, status = ?, payments = ?, updated_at = ?, 
                    taxType = ?, grossTotal = ?, itemDiscount = ?, additionalCharges = ?, roundOff = ?, amountReceived = ?, internalNotes = ?, weekly_sequence = ?,
                    loyalty_points_redeemed = ?, loyalty_points_earned = ?, loyalty_points_discount = ?
                 WHERE id = ?`,
                [
                    String(data.customerId || ''),
                    String(data.customerName || 'Guest'),
                    String(date),
                    String(data.type || 'Sales'),
                    String(itemsJson),
                    Number(data.subtotal || 0),
                    Number(data.tax || 0),
                    Number(data.discount || 0),
                    Number(data.total || 0),
                    String(data.status || 'Paid'),
                    String(paymentsJson),
                    new Date().toISOString(),
                    data.taxType || 'intra',
                    data.grossTotal || 0,
                    data.itemDiscount || 0,
                    data.additionalCharges || 0,
                    data.roundOff || 0,
                    data.amountReceived || 0,
                    data.internalNotes || '',
                    data.weekly_sequence || 1,
                    data.loyaltyPointsRedeemed || 0,
                    data.loyaltyPointsEarned || 0,
                    data.loyaltyPointsDiscount || 0,
                    id
                ]
            );

            // Update in state
            setTransactions(prev => prev.map(tx => tx.id === id ? { ...data, items: data.items, payments: data.payments, date } : tx));

            triggerAutoSave();

            // [Sync]
            try {
                const { SyncService, EventTypes } = require('../services/OneWaySyncService');
                const updatedTx = { ...data, items: data.items, payments: data.payments, date, id, updated_at: new Date().toISOString(), is_deleted: data.is_deleted || 0 };
                SyncService.createAndUploadEvent(EventTypes.INVOICE_UPDATED, updatedTx);
            } catch (e) {
                console.log('Sync Update Transaction Error:', e);
            }

            return { ...data, id };
        } catch (err) {
            console.error('Edit Transaction SQL Error:', err);
            throw err;
        }
    };

    const deleteTransaction = async (id) => {
        try {
            const invoice = transactions.find(t => t.id === id);
            if (!invoice) throw new Error("Invoice not found");

            // 1. Restore Stock locally
            if (invoice.items && Array.isArray(invoice.items)) {
                for (const item of invoice.items) {
                    if (item.productId || item.id) {
                        db.runSync(`UPDATE products SET stock = stock + ? WHERE id = ?`, [item.quantity, item.productId || item.id]);
                    }
                }
            }

            // 2. Soft Delete Invoice (Move to Recycle Bin)
            db.runSync('UPDATE invoices SET is_deleted = 1, updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);

            // 3. Update State
            setTransactions(prev => prev.filter(t => t.id !== id));

            // 4. Trigger Sync Event
            try {
                const { SyncService, EventTypes } = require('../services/OneWaySyncService');
                SyncService.createAndUploadEvent(EventTypes.INVOICE_STATUS_UPDATED, { id, is_deleted: 1, updated_at: new Date().toISOString() });
            } catch (syncErr) {
                console.log('Sync Trigger Error (Soft Delete):', syncErr);
            }

            // 5. Trigger AutoSave
            triggerAutoSave();

        } catch (err) {
            console.error('Delete Transaction Error:', err);
            throw err;
        }
    };

    const restoreTransaction = async (id) => {
        try {
            // Fetch the invoice from DB
            const row = db.getFirstSync('SELECT * FROM invoices WHERE id = ?', [id]);
            if (!row) throw new Error("Invoice not found in DB");

            const invoice = {
                ...row,
                items: typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []),
                payments: typeof row.payments === 'string' ? JSON.parse(row.payments) : (row.payments || [])
            };

            // 1. Re-deduct Stock
            if (invoice.items && Array.isArray(invoice.items)) {
                for (const item of invoice.items) {
                    if (item.productId || item.id) {
                        db.runSync(`UPDATE products SET stock = stock - ? WHERE id = ?`, [item.quantity, item.productId || item.id]);
                    }
                }
            }

            // 2. Clear deleted flag
            db.runSync('UPDATE invoices SET is_deleted = 0, updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);

            // 3. Refresh State
            await fetchTransactions();

            // 4. Sync
            try {
                const { SyncService, EventTypes } = require('../services/OneWaySyncService');
                SyncService.createAndUploadEvent(EventTypes.INVOICE_UPDATED, { ...invoice, is_deleted: 0, updated_at: new Date().toISOString() });
            } catch (e) { }

            triggerAutoSave();
        } catch (err) {
            console.error('Restore Transaction Error:', err);
            throw err;
        }
    };

    const permanentlyDeleteTransaction = async (id) => {
        try {
            db.runSync('DELETE FROM invoices WHERE id = ?', [id]);
            // Sync permanent delete
            try {
                const { SyncService, EventTypes } = require('../services/OneWaySyncService');
                SyncService.createAndUploadEvent(EventTypes.INVOICE_DELETED, { id });
            } catch (e) { }
            triggerAutoSave();
        } catch (err) {
            console.error('Permanent delete error:', err);
            throw err;
        }
    };

    const getTransactionById = (id) => {
        return transactions.find(t => t.id === id) || null;
    };

    return (
        <TransactionContext.Provider value={{
            transactions,
            loading,
            error,
            fetchTransactions,
            fetchDeletedTransactions,
            addTransaction,
            editTransaction,
            deleteTransaction,
            restoreTransaction,
            permanentlyDeleteTransaction,
            emptyRecycleBin: async () => {
                try {
                    const deleted = db.getAllSync('SELECT id FROM invoices WHERE is_deleted = 1');
                    db.runSync('DELETE FROM invoices WHERE is_deleted = 1');
                    // Sync each deletion
                    const { SyncService, EventTypes } = require('../services/OneWaySyncService');
                    for (const row of deleted) {
                        try {
                            SyncService.createAndUploadEvent(EventTypes.INVOICE_DELETED, { id: row.id });
                        } catch (e) { }
                    }
                    triggerAutoSave();
                } catch (err) {
                    console.error('Empty Bin Error:', err);
                    throw err;
                }
            },
            restoreAllInvoices: async () => {
                try {
                    const deleted = db.getAllSync('SELECT * FROM invoices WHERE is_deleted = 1');
                    for (const row of deleted) {
                        await restoreTransaction(row.id);
                    }
                } catch (err) {
                    console.error('Restore All Error:', err);
                    throw err;
                }
            },
            updateTransaction: editTransaction,
            updateTransactionStatus,
            clearAllTransactions,
            getTransactionById
        }}>
            {children}
        </TransactionContext.Provider>
    );
};
