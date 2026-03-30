import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import services from '../services/api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const CustomerContext = createContext();

export const useCustomers = () => {
    const context = useContext(CustomerContext);
    if (!context) {
        throw new Error('useCustomers must be used within a CustomerProvider');
    }
    return context;
};

export const CustomerProvider = ({ children }) => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user, isLoading: authLoading } = useAuth();
    const toast = useToast();

    const fetchCustomers = useCallback(async () => {
        setLoading(true);
        try {
            const response = await services.customers.getAll();
            setCustomers(response.data);
        } catch (error) {
            console.error("Failed to fetch customers", error);
            toast.error("Failed to load customers");
            setCustomers([]);
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        // Only fetch if user is authenticated and auth is not loading
        if (authLoading || !user) {
            setLoading(false);
            if (!user) {
                setCustomers([]);
            }
            return;
        }

        fetchCustomers();
    }, [user, authLoading, fetchCustomers]);

    const addCustomer = useCallback(async (customerData) => {
        try {
            const response = await services.customers.create(customerData);
            const newCustomer = response.data;
            setCustomers(prev => [...prev, newCustomer]);
            toast.success("Customer added successfully");
            return newCustomer;
        } catch (error) {
            console.error("Failed to add customer", error);
            const message = error.response?.data?.message || "Failed to add customer";
            toast.error(message);
            throw error;
        }
    }, [toast]);

    const updateCustomer = useCallback(async (id, updatedData) => {
        try {
            const response = await services.customers.update(id, updatedData);
            const updatedCustomer = response.data;
            setCustomers(prev => prev.map(c => c.id === id ? updatedCustomer : c));
            toast.success("Customer updated successfully");
            return updatedCustomer;
        } catch (error) {
            console.error("Failed to update customer", error);
            const message = error.response?.data?.message || "Failed to update customer";
            toast.error(message);
            throw error;
        }
    }, [toast]);

    const deleteCustomer = useCallback(async (id) => {
        try {
            await services.customers.delete(id);
            setCustomers(prev => prev.filter(c => c.id !== id));
            toast.success("Customer deleted successfully");
        } catch (error) {
            console.error("Failed to delete customer", error);
            const message = error.response?.data?.message || "Failed to delete customer";
            toast.error(message);
            throw error;
        }
    }, [toast]);

    const getCustomerByMobile = useCallback(async (mobile) => {
        try {
            const response = await services.customers.getByMobile(mobile);
            return response.data;
        } catch (error) {
            // 404 is expected for new customers - don't log as error
            if (error.response?.status === 404) {
                return null;
            }
            // Only log unexpected errors
            console.error('Unexpected error looking up customer:', error);
            return null;
        }
    }, []);

    const findOrCreateCustomer = useCallback(async (customerData) => {
        try {
            const response = await services.customers.findOrCreate(customerData);
            const customer = response.data;

            // If new customer was created, add to local state
            if (customer.isNew) {
                setCustomers(prev => [...prev, customer]);
                // Silent - no toast for auto-creation
            }

            return customer;
        } catch (error) {
            console.error("Failed to find or create customer", error);
            const message = error.response?.data?.message || "Failed to create customer";
            toast.error(message);
            throw error;
        }
    }, [toast]);

    const value = useMemo(() => ({
        customers,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        getCustomerByMobile,
        findOrCreateCustomer,
        refreshCustomers: fetchCustomers,
        loading
    }), [
        customers,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        getCustomerByMobile,
        findOrCreateCustomer,
        fetchCustomers,
        loading
    ]);

    return (
        <CustomerContext.Provider value={value}>
            {children}
        </CustomerContext.Provider>
    );
};
