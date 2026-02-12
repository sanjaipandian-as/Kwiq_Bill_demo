import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../services/database'; // Import the db instance
import { triggerAutoSave } from '../services/autosaveService';
import services from '../services/api';

const CustomerContext = createContext();
export const useCustomers = () => useContext(CustomerContext);

export const CustomerProvider = ({ children }) => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);

    // 1. Initial load from the device SQLite file
    useEffect(() => {
        refreshCustomers();
        setLoading(false);
    }, []);

    const addCustomer = async (data) => {
        try {
            const id = data.id || Date.now().toString();
            const name = data.fullName || data.name || "Unnamed Customer";
            const phone = data.phone || "";
            const email = data.email || "";
            const gstin = data.gstin || "";
            const type = data.customerType || data.type || "Individual";
            const tags = Array.isArray(data.tags) ? data.tags.join(',') : (data.tags || "");
            const address = typeof data.address === 'object' ? JSON.stringify(data.address) : (data.address || "");
            const notes = data.notes || "";
            const amountPaid = parseFloat(data.amountPaid || 0);
            const whatsappOptIn = data.whatsappOptIn ? 1 : 0;
            const smsOptIn = data.smsOptIn ? 1 : 0;
            const timestamp = new Date().toISOString();

            // 2. Physical Save to Device Storage
            db.runSync(
                `INSERT OR REPLACE INTO customers (id, name, phone, email, gstin, type, tags, address, notes, amountPaid, whatsappOptIn, smsOptIn, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, name, phone, email, gstin, type, tags, address, notes, amountPaid, whatsappOptIn, smsOptIn, timestamp]
            );

            const newCustomer = { ...data, id, name, phone, email, gstin, type, tags, address, notes, amountPaid, whatsappOptIn, smsOptIn, created_at: timestamp };
            setCustomers(prev => [newCustomer, ...prev]);

            // [AutoSave Trigger]
            triggerAutoSave();

            // [Sync]
            try {
                const { SyncService, EventTypes } = require('../services/OneWaySyncService');
                SyncService.createAndUploadEvent(EventTypes.CUSTOMER_CREATED, newCustomer);

                // [Sync to MongoDB]
                services.customers.add(newCustomer).catch(err => console.log('MongoDB Customer Sync Error:', err.message));
            } catch (syncErr) {
                console.log('Sync Trigger Error (Customer):', syncErr);
            }

            return newCustomer;
        } catch (err) {
            console.error('Device Save Error:', err);
            throw err;
        }
    };

    const updateCustomer = async (id, data) => {
        try {
            const name = data.fullName || data.name;
            const tags = Array.isArray(data.tags) ? data.tags.join(',') : (data.tags || "");
            const address = typeof data.address === 'object' ? JSON.stringify(data.address) : (data.address || "");
            const amountPaid = parseFloat(data.amountPaid || 0);
            const whatsappOptIn = data.whatsappOptIn !== undefined ? (data.whatsappOptIn ? 1 : 0) : undefined;
            const smsOptIn = data.smsOptIn !== undefined ? (data.smsOptIn ? 1 : 0) : undefined;
            const timestamp = new Date().toISOString();

            // 3. Physical Update to Device Storage
            // Only update opt-ins if provided (though typically we update full object, let's include them in query)
            // To simplify, we'll update them if provided, or keep existing? 
            // Better to assume data has latest.

            db.runSync(
                `UPDATE customers SET name = ?, phone = ?, email = ?, gstin = ?, type = ?, tags = ?, address = ?, notes = ?, amountPaid = ?, whatsappOptIn = ?, smsOptIn = ?, updated_at = ? WHERE id = ?`,
                [
                    name,
                    data.phone || "",
                    data.email || "",
                    data.gstin || "",
                    data.customerType || data.type || "Individual",
                    tags,
                    address,
                    data.notes || "",
                    amountPaid,
                    data.whatsappOptIn ? 1 : 0,
                    data.smsOptIn ? 1 : 0, // Assuming full update usually
                    timestamp,
                    id
                ]
            );

            setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...data, name, tags, address, amountPaid, updated_at: timestamp } : c));

            // [AutoSave Trigger]
            triggerAutoSave();

            // [Sync]
            try {
                const { SyncService, EventTypes } = require('../services/OneWaySyncService');
                const updatedCustomer = { ...data, id, name, tags, address, amountPaid, updated_at: timestamp };
                SyncService.createAndUploadEvent(EventTypes.CUSTOMER_UPDATED, updatedCustomer);

                // [Sync to MongoDB]
                services.customers.update(id, updatedCustomer).catch(err => console.log('MongoDB Customer Update Error:', err.message));
            } catch (e) {
                console.log('Sync Update Customer Error:', e);
            }
        } catch (err) {
            console.error('Device Update Error:', err);
            throw err;
        }
    };

    const deleteCustomer = async (id) => {
        try {
            db.runSync('DELETE FROM customers WHERE id = ?', [id]);
            setCustomers(prev => prev.filter(c => c.id !== id));

            // [AutoSave Trigger]
            triggerAutoSave();

            // [Sync]
            try {
                const { SyncService, EventTypes } = require('../services/OneWaySyncService');
                SyncService.createAndUploadEvent(EventTypes.CUSTOMER_DELETED, { id });

                // [Sync to MongoDB]
                services.customers.delete(id).catch(err => console.log('MongoDB Customer Delete Error:', err.message));
            } catch (e) {
                console.log('Sync Delete Customer Error:', e);
            }
        } catch (err) {
            console.error('Device Delete Error:', err);
            throw err;
        }
    };

    const refreshCustomers = () => {
        try {
            const data = db.getAllSync('SELECT * FROM customers ORDER BY created_at DESC');
            setCustomers(data || []);
        } catch (err) {
            console.error('Refresh Error:', err);
        }
    };

    return (
        <CustomerContext.Provider value={{
            customers,
            loading,
            addCustomer,
            updateCustomer,
            deleteCustomer,
            refreshCustomers,
            fetchCustomers: refreshCustomers // Alias for backward compatibility
        }}>
            {children}
        </CustomerContext.Provider>
    );
};