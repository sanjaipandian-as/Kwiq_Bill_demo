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
                const data = db.getAllSync('SELECT * FROM invoices ORDER BY date DESC');
                // Parse items and payments JSON strings and normalize keys
                const parsedData = data.map(tx => ({
                    ...tx,
                    customerName: tx.customer_name || tx.customerName || 'Walk-in Customer',
                    customerId: tx.customer_id || tx.customerId || '',
                    items: typeof tx.items === 'string' ? JSON.parse(tx.items) : (tx.items || []),
                    payments: typeof tx.payments === 'string' ? JSON.parse(tx.payments) : (tx.payments || [])
                }));
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
            const data = db.getAllSync('SELECT * FROM invoices ORDER BY date DESC');
            // Parse items and payments JSON strings and normalize keys
            const parsedData = data.map(tx => ({
                ...tx,
                customerName: tx.customer_name || tx.customerName || 'Walk-in Customer',
                customerId: tx.customer_id || tx.customerId || '',
                items: typeof tx.items === 'string' ? JSON.parse(tx.items) : (tx.items || []),
                payments: typeof tx.payments === 'string' ? JSON.parse(tx.payments) : (tx.payments || [])
            }));
            setTransactions(parsedData || []);
        } finally {
            setLoading(false);
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
                    created_at, updated_at, taxType, grossTotal, itemDiscount, additionalCharges, roundOff, amountReceived, internalNotes, weekly_sequence
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    data.customerId || '',
                    data.customerName || 'Walk-in Customer',
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
                    weeklySequence
                ]
            );

            const newTx = { ...data, id, date, items: data.items || [], payments: data.payments || [], weekly_sequence: weeklySequence };
            setTransactions(prev => [newTx, ...prev]);

            // [AutoSave]
            triggerAutoSave();

            // [Loyalty Points & Balance Update]
            if (data.customerId) {
                try {
                    const received = parseFloat(data.amountReceived) || 0;
                    const total = parseFloat(data.total) || 0;
                    const outstandingDelta = Math.max(0, total - received);

                    // Update loyalty points (+1 per order), lifetime amountPaid, and current outstanding
                    db.runSync(
                        `UPDATE customers SET 
                            loyaltyPoints = loyaltyPoints + 1,
                            amountPaid = amountPaid + ?,
                            outstanding = outstanding + ?
                         WHERE id = ?`,
                        [received, outstandingDelta, String(data.customerId)]
                    );
                    console.log(`[TransactionContext] Updated customer ${data.customerId}: +1 Loyalty, +${received} Paid, +${outstandingDelta} Due`);
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
                    taxType = ?, grossTotal = ?, itemDiscount = ?, additionalCharges = ?, roundOff = ?, amountReceived = ?, internalNotes = ?, weekly_sequence = ?
                 WHERE id = ?`,
                [
                    String(data.customerId || ''),
                    String(data.customerName || 'Walk-in Customer'),
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
                    id
                ]
            );

            // Update in state
            setTransactions(prev => prev.map(tx => tx.id === id ? { ...data, items: data.items, payments: data.payments, date } : tx));

            triggerAutoSave();
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

            // 1. Restore Stock locally (Optimistic UI update for products not strict requirement here but good practice if ProductContext existed. 
            // However, our sync "applyEvent" does the heavy lifting for stock on other devices. 
            // Locally we should also update stock if we want immediate consistency without waiting for a loop.
            // But since stock is in `products` table and we are in `TransactionContext`, let's do direct DB operations here for consistency.

            // Restore Stock logic
            if (invoice.items && Array.isArray(invoice.items)) {
                for (const item of invoice.items) {
                    if (item.productId || item.id) {
                        db.runSync(`UPDATE products SET stock = stock + ? WHERE id = ?`, [item.quantity, item.productId || item.id]);
                        // Note: If we had a ProductContext, we should update its state too. 
                        // For now we assume listeners or refetches will handle it.
                    }
                }
            }

            // 2. Delete Invoice from DB
            db.runSync('DELETE FROM invoices WHERE id = ?', [id]);

            // 3. Update State
            setTransactions(prev => prev.filter(t => t.id !== id));

            // 4. Trigger Sync Event
            try {
                const { SyncService, EventTypes } = require('../services/OneWaySyncService');
                SyncService.createAndUploadEvent(EventTypes.INVOICE_DELETED, invoice);
            } catch (syncErr) {
                console.log('Sync Trigger Error (Delete):', syncErr);
            }

            // 5. Trigger AutoSave
            triggerAutoSave();

        } catch (err) {
            console.error('Delete Transaction Error:', err);
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
            addTransaction,
            editTransaction,
            deleteTransaction,
            updateTransaction: editTransaction,
            updateTransactionStatus,
            clearAllTransactions,
            getTransactionById
        }}>
            {children}
        </TransactionContext.Provider>
    );
};
