import React, { createContext, useContext, useState, useEffect } from 'react';
import { triggerAutoSave } from '../services/autosaveService';
import { db } from '../services/database';
const { SyncService, EventTypes } = require('../services/OneWaySyncService');

const TransactionContext = createContext();

export const useTransactions = () => useContext(TransactionContext);

export const TransactionProvider = ({ children }) => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const { user } = require('./AuthContext').useAuth();

    // Initial load from SQLite - reload when user changes
    useEffect(() => {
        const loadTransactions = async () => {
            if (!user) {
                setTransactions([]);
                setLoading(false);
                return;
            }
            try {
                const data = await db.getAllAsync(`
                    SELECT i.*, c.name as c_name 
                    FROM invoices i 
                    LEFT JOIN customers c ON i.customer_id = c.id 
                    WHERE i.is_deleted = 0 
                    ORDER BY i.date DESC
                `);
                const parsedData = data.map(tx => {
                    let custName = tx.c_name || tx.customer_name || tx.customerName;
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
    }, [user?.id]);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const data = await db.getAllAsync(`
                SELECT i.*, c.name as c_name 
                FROM invoices i 
                LEFT JOIN customers c ON i.customer_id = c.id 
                WHERE i.is_deleted = 0 
                ORDER BY i.date DESC
            `);
            const parsedData = data.map(tx => {
                let custName = tx.c_name || tx.customer_name || tx.customerName;
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
            const data = await db.getAllAsync(`
                SELECT i.*, c.name as c_name 
                FROM invoices i 
                LEFT JOIN customers c ON i.customer_id = c.id 
                WHERE i.is_deleted = 1 
                ORDER BY i.date DESC
            `);
            return data.map(tx => {
                let custName = tx.c_name || tx.customer_name || tx.customerName;
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

    const adjustInvoiceEffects = async (invoice, direction = 1) => {
        // 1. Stock Update (Inc variants)
        if (invoice.items && Array.isArray(invoice.items)) {
            for (const item of invoice.items) {
                const pid = item.productId || item.id;
                const qty = parseFloat(item.quantity) || 0;
                if (pid && qty > 0) {
                    try {
                        const operator = direction === 1 ? '-' : '+';
                        await db.runAsync(`UPDATE products SET stock = stock ${operator} ? WHERE id = ?`, [Number(qty), String(pid)]);
                        if (item.variantName) {
                            const productRow = await db.getFirstAsync('SELECT variants FROM products WHERE id = ?', [pid]);
                            if (productRow && productRow.variants) {
                                let variantsArr = [];
                                try { variantsArr = JSON.parse(productRow.variants); } catch (e) { variantsArr = []; }
                                if (Array.isArray(variantsArr) && variantsArr.length > 0) {
                                    let updated = false;
                                    const newVariants = variantsArr.map(v => {
                                        if (v.name && v.name.trim() === item.variantName.trim()) {
                                            const currentStock = parseFloat(v.stock) || 0;
                                            v.stock = direction === 1 ? Math.max(0, currentStock - qty) : (currentStock + qty);
                                            updated = true;
                                        }
                                        return v;
                                    });
                                    if (updated) {
                                        await db.runAsync('UPDATE products SET variants = ? WHERE id = ?', [JSON.stringify(newVariants), pid]);
                                    }
                                }
                            }
                        }
                        // Sync stock adjustment info
                        try {
                            const prodRow = await db.getFirstAsync('SELECT stock FROM products WHERE id = ?', [String(pid)]);
                            if (prodRow) {
                                SyncService.createAndUploadEvent(EventTypes.PRODUCT_STOCK_ADJUSTED, { id: pid, stock: prodRow.stock });
                            }
                        } catch (e) {}
                    } catch (stockErr) {
                        console.error(`[TransactionContext] Failed to adjust stock for ${pid}:`, stockErr);
                    }
                }
            }
        }
        // 2. Customer Ledger Update
        if (invoice.customerId) {
            try {
                const received = parseFloat(invoice.amountReceived) || 0;
                const total = parseFloat(invoice.total) || 0;
                const outstandingDelta = Math.max(0, total - received);
                const redeemed = parseInt(invoice.loyaltyPointsRedeemed) || 0;
                const earned = parseInt(invoice.loyaltyPointsEarned) || 0;
                const operator = direction === 1 ? '+' : '-';
                const reverseOp = direction === 1 ? '-' : '+';
                await db.runAsync(
                    `UPDATE customers SET 
                        loyaltyPoints = loyaltyPoints ${reverseOp} ? ${operator} ?,
                        amountPaid = amountPaid ${operator} ?,
                        outstanding = outstanding ${operator} ?
                     WHERE id = ?`,
                    [redeemed, earned, received, outstandingDelta, String(invoice.customerId)]
                );
                // Sync updated customer
                try {
                    const updatedCust = await db.getFirstAsync('SELECT * FROM customers WHERE id = ?', [String(invoice.customerId)]);
                    if (updatedCust) {
                        SyncService.createAndUploadEvent(EventTypes.CUSTOMER_UPDATED, updatedCust);
                    }
                } catch (e) {}
            } catch (custUpdateErr) {
                console.error('[TransactionContext] Failed to adjust customer ledger:', custUpdateErr);
            }
        }
    };

    const addTransaction = async (data) => {
        try {
            const id = data.id || `INV-${Date.now()}`;
            const itemsJson = JSON.stringify(data.items || []);
            const paymentsJson = JSON.stringify(data.payments || []);
            const date = data.date ? new Date(data.date).toISOString() : new Date().toISOString();

            // Sequence Logic
            const invoiceDate = new Date(date);
            const startOfWeek = new Date(invoiceDate);
            startOfWeek.setDate(invoiceDate.getDate() - invoiceDate.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 7);

            let weeklySequence = 1;
            try {
                const row = await db.getFirstAsync(
                    'SELECT MAX(weekly_sequence) as maxSeq FROM invoices WHERE date >= ? AND date < ?',
                    [startOfWeek.toISOString(), endOfWeek.toISOString()]
                );
                weeklySequence = (Number(row?.maxSeq) || 0) + 1;
            } catch (e) {}

            await db.runAsync(
                `INSERT INTO invoices (
                    id, customer_id, customer_name, date, type, items, subtotal, tax, discount, total, status, payments, 
                    created_at, updated_at, taxType, grossTotal, itemDiscount, additionalCharges, roundOff, amountReceived, internalNotes, weekly_sequence,
                    loyalty_points_redeemed, loyalty_points_earned, loyalty_points_discount, is_deleted
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, data.customerId || '', data.customerName || 'Guest', date, data.type || 'Sales', itemsJson,
                    data.subtotal || 0, data.tax || 0, data.discount || 0, data.total || 0, data.status || 'Paid', paymentsJson,
                    new Date().toISOString(), new Date().toISOString(), data.taxType || 'intra', data.grossTotal || 0,
                    data.itemDiscount || 0, data.additionalCharges || 0, data.roundOff || 0, data.amountReceived || 0,
                    data.internalNotes || '', weeklySequence, data.loyaltyPointsRedeemed || 0,
                    data.loyaltyPointsEarned || 0, data.loyaltyPointsDiscount || 0, 0
                ]
            );

            const newTx = { ...data, id, date, items: data.items || [], payments: data.payments || [], weekly_sequence: weeklySequence, is_deleted: 0 };
            setTransactions(prev => [newTx, ...prev]);

            // Apply Effects
            await adjustInvoiceEffects(newTx, 1);
            triggerAutoSave();

            // Sync
            try {
                SyncService.createAndUploadEvent(EventTypes.INVOICE_CREATED, { ...newTx, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
            } catch (e) {}

            return newTx;
        } catch (err) {
            console.error('Add Transaction Error:', err);
            throw err;
        }
    };

    const updateTransactionStatus = async (id, status) => {
        try {
            await db.runAsync('UPDATE invoices SET status = ?, updated_at = ? WHERE id = ?', [status, new Date().toISOString(), id]);
            setTransactions(prev => prev.map(t => t.id === id ? { ...t, status } : t));
            triggerAutoSave();
            try {
                SyncService.createAndUploadEvent(EventTypes.INVOICE_STATUS_UPDATED, { id, status, updated_at: new Date().toISOString() });
            } catch (e) {}
        } catch (err) {
            throw err;
        }
    };

    const editTransaction = async (data) => {
        try {
            const id = data.id;
            const oldRow = await db.getFirstAsync('SELECT * FROM invoices WHERE id = ?', [id]);
            if (oldRow) {
                const oldInvoice = {
                    ...oldRow,
                    items: typeof oldRow.items === 'string' ? JSON.parse(oldRow.items) : (oldRow.items || []),
                    payments: typeof oldRow.payments === 'string' ? JSON.parse(oldRow.payments) : (oldRow.payments || []),
                    customerId: oldRow.customer_id,
                    amountReceived: oldRow.amountReceived,
                    total: oldRow.total,
                    loyaltyPointsRedeemed: oldRow.loyalty_points_redeemed,
                    loyaltyPointsEarned: oldRow.loyalty_points_earned
                };
                await adjustInvoiceEffects(oldInvoice, -1);
            }

            const itemsJson = JSON.stringify(data.items || []);
            const paymentsJson = JSON.stringify(data.payments || []);
            const date = data.date ? new Date(data.date).toISOString() : new Date().toISOString();

            await db.runAsync(
                `UPDATE invoices SET 
                    customer_id = ?, customer_name = ?, date = ?, type = ?, items = ?, 
                    subtotal = ?, tax = ?, discount = ?, total = ?, status = ?, payments = ?, updated_at = ?, 
                    taxType = ?, grossTotal = ?, itemDiscount = ?, additionalCharges = ?, roundOff = ?, amountReceived = ?, internalNotes = ?, weekly_sequence = ?,
                    loyalty_points_redeemed = ?, loyalty_points_earned = ?, loyalty_points_discount = ?
                 WHERE id = ?`,
                [
                    String(data.customerId || ''), String(data.customerName || 'Guest'), String(date), String(data.type || 'Sales'),
                    String(itemsJson), Number(data.subtotal || 0), Number(data.tax || 0), Number(data.discount || 0),
                    Number(data.total || 0), String(data.status || 'Paid'), String(paymentsJson), new Date().toISOString(),
                    data.taxType || 'intra', data.grossTotal || 0, data.itemDiscount || 0, data.additionalCharges || 0,
                    data.roundOff || 0, data.amountReceived || 0, data.internalNotes || '', data.weekly_sequence || 1,
                    data.loyaltyPointsRedeemed || 0, data.loyaltyPointsEarned || 0, data.loyaltyPointsDiscount || 0, id
                ]
            );

            setTransactions(prev => prev.map(tx => tx.id === id ? { ...data, items: data.items, payments: data.payments, date } : tx));
            
            await adjustInvoiceEffects(data, 1);
            triggerAutoSave();

            try {
                SyncService.createAndUploadEvent(EventTypes.INVOICE_UPDATED, { ...data, id, updated_at: new Date().toISOString() });
            } catch (e) {}

            return { ...data, id };
        } catch (err) {
            throw err;
        }
    };

    const deleteTransaction = async (id) => {
        try {
            const invoice = transactions.find(t => t.id === id);
            if (!invoice) throw new Error("Invoice not found");

            await adjustInvoiceEffects(invoice, -1);
            await db.runAsync('UPDATE invoices SET is_deleted = 1, updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
            setTransactions(prev => prev.filter(t => t.id !== id));
            
            try {
                SyncService.createAndUploadEvent(EventTypes.INVOICE_STATUS_UPDATED, { id, is_deleted: 1, updated_at: new Date().toISOString() });
            } catch (e) {}

            triggerAutoSave();
        } catch (err) {
            throw err;
        }
    };

    const restoreTransaction = async (id) => {
        try {
            const row = await db.getFirstAsync('SELECT * FROM invoices WHERE id = ?', [id]);
            if (!row) throw new Error("Invoice not found");
            const invoice = {
                ...row,
                items: typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []),
                payments: typeof row.payments === 'string' ? JSON.parse(row.payments) : (row.payments || []),
                customerId: row.customer_id
            };

            await adjustInvoiceEffects(invoice, 1);
            await db.runAsync('UPDATE invoices SET is_deleted = 0, updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
            await fetchTransactions();
            
            try {
                SyncService.createAndUploadEvent(EventTypes.INVOICE_UPDATED, { ...invoice, is_deleted: 0, updated_at: new Date().toISOString() });
            } catch (e) {}

            triggerAutoSave();
        } catch (err) {
            throw err;
        }
    };

    const permanentlyDeleteTransaction = async (id) => {
        try {
            await db.runAsync('DELETE FROM invoices WHERE id = ?', [id]);
            try {
                SyncService.createAndUploadEvent(EventTypes.INVOICE_DELETED, { id });
            } catch (e) {}
            triggerAutoSave();
        } catch (err) {
            throw err;
        }
    };

    return (
        <TransactionContext.Provider value={{
            transactions, loading, error, fetchTransactions, fetchDeletedTransactions, addTransaction, editTransaction,
            deleteTransaction, restoreTransaction, permanentlyDeleteTransaction,
            updateTransaction: editTransaction, updateTransactionStatus, clearAllTransactions: async () => {
                await db.execAsync('DELETE FROM invoices');
                setTransactions([]);
                triggerAutoSave();
            },
            getTransactionById: (id) => transactions.find(t => t.id === id) || null,
            emptyRecycleBin: async () => {
                const deleted = await db.getAllAsync('SELECT id FROM invoices WHERE is_deleted = 1');
                await db.runAsync('DELETE FROM invoices WHERE is_deleted = 1');
                for (const row of deleted) {
                    try { SyncService.createAndUploadEvent(EventTypes.INVOICE_DELETED, { id: row.id }); } catch (e) {}
                }
                triggerAutoSave();
            },
            restoreAllInvoices: async () => {
                const deleted = await db.getAllAsync('SELECT id FROM invoices WHERE is_deleted = 1');
                for (const row of deleted) { await restoreTransaction(row.id); }
            }
        }}>
            {children}
        </TransactionContext.Provider>
    );
};
