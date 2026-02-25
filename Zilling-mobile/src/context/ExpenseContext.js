import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../services/database';

import { triggerAutoSave } from '../services/autosaveService';

const ExpenseContext = createContext();

export const useExpenses = () => useContext(ExpenseContext);

export const ExpenseProvider = ({ children }) => {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Normalize SQLite row → camelCase JS object
    const normalizeExpense = (row) => ({
        ...row,
        receiptUrl: row.receipt_url || row.receiptUrl || '',
        paymentMethod: row.payment_method || row.paymentMethod || 'Cash',
    });

    // Initial load from SQLite
    useEffect(() => {
        const loadExpenses = async () => {
            try {
                const data = db.getAllSync('SELECT * FROM expenses ORDER BY date DESC');
                setExpenses((data || []).map(normalizeExpense));
            } catch (err) {
                console.error('Failed to load expenses:', err);
                setError('Failed to load expenses');
            } finally {
                setLoading(false);
            }
        };
        loadExpenses();
    }, []);

    const fetchExpenses = async () => {
        setLoading(true);
        try {
            const data = db.getAllSync('SELECT * FROM expenses ORDER BY date DESC');
            setExpenses((data || []).map(normalizeExpense));
        } finally {
            setLoading(false);
        }
    };

    // ─── Receipt Upload Helper ───
    const uploadReceiptToCloud = async (expenseId, localUri) => {
        if (!localUri || !localUri.startsWith('file://')) return localUri;
        try {
            const { services } = require('../services/api');
            const fileName = localUri.split('/').pop();
            const ext = (fileName.split('.').pop() || 'jpg').toLowerCase();
            const fileObject = {
                uri: localUri,
                name: fileName,
                type: ext === 'pdf' ? 'application/pdf' : 'image/jpeg',
            };
            const res = await services.expenses.uploadReceipt(expenseId, fileObject);
            return res.data?.receiptUrl || localUri;
        } catch (err) {
            console.warn('[Sync] Cloudinary upload failed:', err.message);
            return localUri;
        }
    };

    const addExpense = async (data) => {
        try {
            const id = data.id || Date.now().toString();
            const title = data.title || 'Untitled Expense';
            const amount = parseFloat(data.amount) || 0;
            const category = data.category || 'General';
            const date = data.date || new Date().toISOString();
            const paymentMethod = data.paymentMethod || 'Cash';
            const localUri = data.receiptUrl || data.receiptFile || data.receipt_url || '';
            const tags = JSON.stringify(data.tags || []);
            const createdAt = new Date().toISOString();

            // 1. Instant local save
            db.runSync(
                `INSERT OR REPLACE INTO expenses (id, title, amount, category, date, payment_method, receipt_url, tags, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, title, amount, category, date, paymentMethod, localUri, tags, createdAt]
            );
            const initialExpense = { ...data, id, title, amount, category, date, paymentMethod, receiptUrl: localUri, tags, createdAt };
            setExpenses(prev => [initialExpense, ...prev]);
            triggerAutoSave();

            // 2. Background Upload
            const cloudUrl = await uploadReceiptToCloud(id, localUri);
            if (cloudUrl && cloudUrl !== localUri) {
                db.runSync(`UPDATE expenses SET receipt_url = ? WHERE id = ?`, [cloudUrl, id]);
                setExpenses(prev => prev.map(e => e.id === id ? { ...e, receiptUrl: cloudUrl } : e));
            }

            // 3. Sync with FINAL url
            try {
                const { SyncService, EventTypes } = require('../services/OneWaySyncService');
                SyncService.createAndUploadEvent(EventTypes.EXPENSE_CREATED, { ...initialExpense, receiptUrl: cloudUrl });
            } catch (e) {
                console.log('Sync Add Expense Error:', e);
            }

            return initialExpense;
        } catch (err) {
            console.error('Add Expense SQL Error:', err);
            throw err;
        }
    };

    const updateExpense = async (id, data) => {
        try {
            if (!id) throw new Error("ID is required for update");

            const title = data.title || 'Untitled Expense';
            const amount = parseFloat(data.amount) || 0;
            const category = data.category || 'General';
            const date = data.date || new Date().toISOString();
            const paymentMethod = data.paymentMethod || 'Cash';
            const localUri = data.receiptUrl || data.receiptFile || data.receipt_url || '';
            const tags = JSON.stringify(data.tags || []);
            const updatedAt = new Date().toISOString();

            db.runSync(
                `UPDATE expenses SET title = ?, amount = ?, category = ?, date = ?, payment_method = ?, receipt_url = ?, tags = ?, updated_at = ? WHERE id = ?`,
                [title, amount, category, date, paymentMethod, localUri, tags, updatedAt, id]
            );

            setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...data, amount, receiptUrl: localUri, tags, updatedAt } : e));
            triggerAutoSave();

            // Background Upload
            const cloudUrl = await uploadReceiptToCloud(id, localUri);
            if (cloudUrl && cloudUrl !== localUri) {
                db.runSync(`UPDATE expenses SET receipt_url = ? WHERE id = ?`, [cloudUrl, id]);
                setExpenses(prev => prev.map(e => e.id === id ? { ...e, receiptUrl: cloudUrl } : e));
            }

            // Sync
            try {
                const { SyncService, EventTypes } = require('../services/OneWaySyncService');
                const oldExpense = expenses.find(e => e.id === id);
                if (oldExpense) {
                    const delta = amount - (parseFloat(oldExpense.amount) || 0);
                    if (delta !== 0) {
                        SyncService.createAndUploadEvent(EventTypes.EXPENSE_ADJUSTED, {
                            expenseId: id,
                            delta: delta,
                            reason: 'Expense Update'
                        });
                    }
                    const updatedExpense = { ...oldExpense, ...data, amount, receiptUrl: cloudUrl, updatedAt };
                    SyncService.createAndUploadEvent(EventTypes.EXPENSE_UPDATED, updatedExpense);
                }
            } catch (e) {
                console.log('Sync Update Expense Error:', e);
            }
        } catch (err) {
            console.error('Update Expense SQL Error:', err);
            throw err;
        }
    };

    const deleteExpense = async (id) => {
        try {
            db.runSync('DELETE FROM expenses WHERE id = ?', [id]);
            setExpenses(prev => prev.filter(e => e.id !== id));
            triggerAutoSave();

            // [Sync]
            try {
                const { SyncService, EventTypes } = require('../services/OneWaySyncService');
                SyncService.createAndUploadEvent(EventTypes.EXPENSE_DELETED, { id });
            } catch (e) {
                console.log('Sync Delete Expense Error:', e);
            }
        } catch (err) {
            console.error('Delete Expense SQL Error:', err);
            throw err;
        }
    };

    const uploadReceipt = async (id, fileUri) => {
        try {
            const cloudUrl = await uploadReceiptToCloud(id, fileUri);
            if (cloudUrl && cloudUrl !== fileUri) {
                db.runSync(`UPDATE expenses SET receipt_url = ? WHERE id = ?`, [cloudUrl, id]);
                setExpenses(prev => prev.map(e => e.id === id ? { ...e, receiptUrl: cloudUrl } : e));
            }
            return cloudUrl;
        } catch (err) {
            return fileUri;
        }
    };

    const bulkDeleteExpenses = async (ids) => {
        try {
            ids.forEach(id => {
                db.runSync('DELETE FROM expenses WHERE id = ?', [id]);
            });
            setExpenses(prev => prev.filter(e => !ids.includes(e.id)));
            triggerAutoSave();
            // [Sync]
            try {
                const { SyncService, EventTypes } = require('../services/OneWaySyncService');
                ids.forEach(id => {
                    SyncService.createAndUploadEvent(EventTypes.EXPENSE_DELETED, { id });
                });
            } catch (e) {
                console.log('Sync Bulk Delete Expense Error:', e);
            }
        } catch (err) {
            console.error('Bulk Delete Error:', err);
            throw err;
        }
    };

    return (
        <ExpenseContext.Provider value={{
            expenses,
            loading,
            error,
            fetchExpenses,
            updateExpense,
            deleteExpense,
            addExpense,
            uploadReceipt,
            bulkDeleteExpenses,
            bulkUpdateExpenses: async (ids, updates) => {
                try {
                    ids.forEach(id => {
                        const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
                        const values = [...Object.values(updates), id];
                        db.runSync(`UPDATE expenses SET ${setClauses} WHERE id = ?`, values);
                    });
                    setExpenses(prev => prev.map(e => ids.includes(e.id) ? { ...e, ...updates } : e));
                    triggerAutoSave();
                } catch (e) { console.error(e); }
            }
        }}>
            {children}
        </ExpenseContext.Provider>
    );
};
