import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../services/database';

import { triggerAutoSave } from '../services/autosaveService';

const ExpenseContext = createContext();

export const useExpenses = () => useContext(ExpenseContext);

export const ExpenseProvider = ({ children }) => {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Initial load from SQLite
    useEffect(() => {
        const loadExpenses = async () => {
            try {
                const data = db.getAllSync('SELECT * FROM expenses ORDER BY date DESC');
                setExpenses(data || []);
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
            setExpenses(data || []);
        } finally {
            setLoading(false);
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
            // Capture the receipt URI from the modal
            const receiptUrl = data.receiptUrl || '';
            const tags = JSON.stringify(data.tags || []);
            const createdAt = new Date().toISOString();

            db.runSync(
                `INSERT OR REPLACE INTO expenses (id, title, amount, category, date, payment_method, receipt_url, tags, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, title, amount, category, date, paymentMethod, receiptUrl, tags, createdAt]
            );

            const newExpense = { ...data, id, title, amount, category, date, paymentMethod, receiptUrl, tags, createdAt };
            setExpenses(prev => [newExpense, ...prev]);

            triggerAutoSave();

            // [Sync]
            try {
                const { SyncService, EventTypes } = require('../services/OneWaySyncService');
                SyncService.createAndUploadEvent(EventTypes.EXPENSE_CREATED, newExpense);
            } catch (e) {
                console.log('Sync Add Expense Error:', e);
            }

            return newExpense;
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
            const receiptUrl = data.receiptUrl || '';
            const tags = JSON.stringify(data.tags || []);
            const updatedAt = new Date().toISOString();

            db.runSync(
                `UPDATE expenses SET title = ?, amount = ?, category = ?, date = ?, payment_method = ?, receipt_url = ?, tags = ?, updated_at = ? WHERE id = ?`,
                [title, amount, category, date, paymentMethod, receiptUrl, tags, updatedAt, id]
            );

            setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...data, amount, receiptUrl, tags, updatedAt } : e));
            triggerAutoSave();

            // [Sync]
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
                    // Trigger generic update for other fields
                    const updatedExpense = { ...oldExpense, ...data, amount, receiptUrl, updatedAt };
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

    const uploadReceipt = async (id, file) => {
        console.log('Mocking receipt upload for ID:', id);
        // Logic for saving file URI to DB could be added here if needed
        return true;
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
            bulkDeleteExpenses
        }}>
            {children}
        </ExpenseContext.Provider>
    );
};
