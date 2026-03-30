import axios from 'axios';

// Vite uses import.meta.env for environment variables.
// Variables must start with VITE_ to be exposed to the client.
// For Electron: VITE_API_URL should be set to http://localhost:5000
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true
});

// Request interceptor to add JWT token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor to handle errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Suppress 404 errors for customer mobile lookups (expected for new customers)
        if (error.response?.status === 404 && error.config?.url?.includes('/customers/mobile/')) {
            return Promise.reject(error);
        }

        // Log other API errors
        if (error.response) {
            console.error('API error:', error.response.data);

            // Check for Account Blocked Kill-Switch
            if (error.response.status === 403 && error.response.data.reason === 'blocked') {
                console.warn('⛔ Account Blocked: Triggering kill-switch overlay');
                window.dispatchEvent(new CustomEvent('account-blocked', {
                    detail: { message: error.response.data.message }
                }));
            }
        } else if (error.request) {
            console.error('Network error:', error.message);
        } else {
            console.error('Request error:', error.message);
        }
        return Promise.reject(error);
    }
);

// Environment Detection
const isElectron = false; // Force HTTP mode even in Electron to communicate with local backend
// const isElectron = window.electron !== undefined;

// Helper to mimic Axios Response for Electron IPC
const ipcResponse = async (promise) => {
    try {
        const data = await promise;
        return { data, status: 200, statusText: 'OK' }; // Mimic Axios structure
    } catch (error) {
        console.error('Electron IPC Error:', error);
        throw { response: { status: 500, data: { message: error.message } } };
    }
};

// Service Wrapper
const services = {
    auth: {
        login: async (credentials) => {
            if (isElectron) {
                // Mock Login for Offline Mode
                return { user: { name: 'Offline User', role: 'admin' }, token: 'offline-token' };
            }
            const response = await api.post('/auth/login', credentials);
            return response.data;
        },
        googleLogin: async (token) => {
            // Not supported offline strictly, or handled via deep link
            const response = await api.post('/auth/google', { token });
            return response.data;
        },
        register: async (userData) => {
            // Registration not supported offline? Or just create user locally?
            const response = await api.post('/auth/register', userData);
            return response.data;
        },
        logout: () => isElectron ? Promise.resolve() : api.post('/auth/logout'),
        getCurrentUser: () => isElectron ?
            Promise.resolve({ data: { user: { name: 'Offline User' } } }) :
            api.get('/auth/me'),
    },
    customers: {
        getAll: () => isElectron ? ipcResponse(window.electron.customer.findAll()) : api.get('/customers'),
        getById: (id) => isElectron ? ipcResponse(window.electron.customer.findById(id)) : api.get(`/customers/${id}`),
        getByMobile: (mobile) => isElectron ? ipcResponse(window.electron.customer.findByMobile(mobile)) : api.get(`/customers/mobile/${mobile}`),
        create: (data) => isElectron ? ipcResponse(window.electron.customer.create(data)) : api.post('/customers', data),
        findOrCreate: (data) => isElectron ? ipcResponse(window.electron.customer.findOrCreate(data)) : api.post('/customers/find-or-create', data),
        update: (id, data) => isElectron ? ipcResponse(window.electron.customer.update(id, data)) : api.put(`/customers/${id}`, data),
        delete: (id) => isElectron ? ipcResponse(window.electron.customer.delete(id)) : api.delete(`/customers/${id}`),
        searchDuplicates: (query) => isElectron ? Promise.resolve({ data: [] }) : api.get('/customers/search-duplicates', { params: { query } }),
    },
    products: {
        getAll: () => isElectron ? ipcResponse(window.electron.product.findAll()) : api.get('/products'),
        getById: (id) => isElectron ? ipcResponse(window.electron.product.findById(id)) : api.get(`/products/${id}`),
        create: (data) => isElectron ? ipcResponse(window.electron.product.create(data)) : api.post('/products', data),
        createMany: (products) => isElectron ?
            Promise.all(products.map(p => window.electron.product.create(p))).then(results => ({ data: { success: true, addedCount: results.length } })) :
            api.post('/products/bulk', { products }),
        update: (id, data) => isElectron ? ipcResponse(window.electron.product.update(id, data)) : api.put(`/products/${id}`, data),
        delete: (id) => isElectron ? ipcResponse(window.electron.product.delete(id)) : api.delete(`/products/${id}`),
        bulkDelete: (ids) => isElectron ?
            Promise.all(ids.map(id => window.electron.product.delete(id))).then(() => ({ data: { success: true } })) :
            api.post('/products/bulk-delete', { ids }),
        getStats: (id) => isElectron ? Promise.resolve({ data: {} }) : api.get(`/products/${id}/stats`),
    },
    billing: {
        createInvoice: (data) => isElectron ? ipcResponse(window.electron.invoice.create(data)) : api.post('/invoices', data),
    },
    invoices: {
        getAll: (params) => isElectron ? ipcResponse(window.electron.invoice.findAll(params)) : api.get('/invoices', { params }),
        getStats: (params) => isElectron ? Promise.resolve({ data: {} }) : api.get('/invoices/stats', { params }),
        getById: (id) => isElectron ? ipcResponse(window.electron.invoice.findById(id)) : api.get(`/invoices/${id}`),
        update: (id, data) => isElectron ? ipcResponse(window.electron.invoice.update(id, data)) : api.put(`/invoices/${id}`, data),
        delete: (id) => isElectron ? ipcResponse(window.electron.invoice.delete(id)) : api.delete(`/invoices/${id}`),
        bulkDelete: (ids) => isElectron ?
            Promise.all(ids.map(id => window.electron.invoice.delete(id))).then(() => ({ data: { success: true } })) :
            api.post('/invoices/bulk-delete', { ids }),
        uncancel: (id) => isElectron ?
            Promise.resolve({ data: { success: true } }) : // Mocking for now if electron not updated
            api.post(`/invoices/${id}/uncancel`),
        bulkUncancel: (ids) => isElectron ?
            Promise.resolve({ data: { success: true } }) :
            api.post('/invoices/bulk-uncancel', { ids }),
        permanentDelete: (id) => isElectron ?
            Promise.resolve({ data: { success: true } }) :
            api.delete(`/invoices/${id}/permanent`),
        bulkPermanentDelete: (ids) => isElectron ?
            Promise.resolve({ data: { success: true } }) :
            api.post('/invoices/bulk-permanent-delete', { ids }),
    },
    expenses: {
        getAll: () => isElectron ? ipcResponse(window.electron.expense.findAll()) : api.get('/expenses'),
        create: (data) => isElectron ? ipcResponse(window.electron.expense.create(data)) : api.post('/expenses', data),
        update: (id, data) => isElectron ? ipcResponse(window.electron.expense.update(id, data)) : api.put(`/expenses/${id}`, data),
        delete: (id) => isElectron ? ipcResponse(window.electron.expense.delete(id)) : api.delete(`/expenses/${id}`),
        bulkUpdate: (ids, updates) => isElectron ? ipcResponse(window.electron.expense.bulkUpdate(ids, updates)) : api.post('/expenses/bulk-update', { ids, updates }),
        bulkDelete: (ids) => isElectron ? ipcResponse(window.electron.expense.bulkDelete(ids)) : api.post('/expenses/bulk-delete', { ids }),
        exportCSV: () => {
            if (isElectron) return Promise.resolve({ data: new Blob(['title,amount\n'], { type: 'text/csv' }) });
            return api.get('/expenses/export/csv', { responseType: 'blob' });
        },
        uploadReceipt: (id, file) => {
            if (isElectron) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = async () => {
                        try {
                            const response = await ipcResponse(window.electron.expense.update(id, { receiptUrl: reader.result }));
                            resolve({ data: response.data });
                        } catch (err) { reject(err); }
                    };
                    reader.onerror = error => reject(error);
                });
            }
            const formData = new FormData();
            formData.append('receipt', file);
            return api.post(`/expenses/${id}/receipt`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        },
    },
    reports: {
        getDashboardStats: (params) => api.get('/reports/dashboard', { params }),
        getFinancials: (params) => api.get('/reports/financials', { params }),
        getSalesTrend: (params) => api.get('/reports/sales-trend', { params }),
        getPaymentMethodStats: (params) => api.get('/reports/payment-methods', { params }),
        getTopProducts: (params) => api.get('/reports/top-products', { params }),
        getCustomerMetrics: (params) => api.get('/reports/customers', { params }),
    },
    settings: {
        getSettings: () => isElectron ? ipcResponse(window.electron.settings.getSettings()) : api.get('/settings'),
        updateSettings: (data) => isElectron ? ipcResponse(window.electron.settings.updateSettings(data)) : api.put('/settings', data),
    },
    backup: {
        trigger: () => api.post('/backup/trigger'),
        getStatus: () => api.get('/backup/status'),
    },
    subscription: {
        getStatus: (params) => api.get('/subscription/status', { params }),
    },
    companyProfile: {
        save: (data) => api.post('/api/company-profile', data),
        get: (userId) => api.get(`/api/company-profile/${userId}`),
        getAll: () => api.get('/api/company-profile'),
    },
};

export default services;
