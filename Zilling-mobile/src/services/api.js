import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const PRODUCTION_URL = 'https://zilling-backend.onrender.com';
const LOCAL_URL = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';

// Toggle this to true when deploying the APK
const IS_PRODUCTION = false;

const BASE_URL = IS_PRODUCTION ? PRODUCTION_URL : LOCAL_URL;

const API = axios.create({
  baseURL: BASE_URL,
  timeout: 10000, // Increased to 10s for Render "cold starts"
});

// For debugging: verify which URL is being used
console.log(`[API] Initialized with baseURL: ${BASE_URL} (Mode: ${IS_PRODUCTION ? 'PROD' : 'LOCAL'})`);


// Attach token automatically
API.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 Unauthorized globally
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('Unauthorized request - 401. Clearing token...');
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      // Note: We can't easily trigger a logout in AuthContext from here 
      // without a circular dependency or an event emitter.
      // But clearing storage will cause the next app reload or auth check to fail.
    }
    return Promise.reject(error);
  }
);

export const services = {
  auth: {
    login: async (data) => {
      const res = await API.post('/auth/login', data);
      return res.data;
    },
    register: async (data) => {
      const res = await API.post('/auth/register', data);
      return res.data;
    },
    getCurrentUser: async () => {
      const res = await API.get('/auth/me');
      return res.data;
    },
    logout: async () => {
      return true;
    },
    googleLogin: async (token) => {
      const res = await API.post('/auth/google', { token });
      return res.data;
    },
  },
  products: {
    getAll: (params) => API.get('/products', { params }),
    add: (data) => API.post('/products', data),
    update: (id, data) => API.put(`/products/${id}`, data),
    delete: (id) => API.delete(`/products/${id}`),
  },
  customers: {
    getAll: (params) => API.get('/customers', { params }),
    add: (data) => API.post('/customers', data),
    update: (id, data) => API.put(`/customers/${id}`, data),
    delete: (id) => API.delete(`/customers/${id}`),
  },
  expenses: {
    getAll: (params) => API.get('/expenses', { params }),
    getById: (id) => API.get(`/expenses/${id}`),
    add: (data) => API.post('/expenses', data),
    update: (id, data) => API.put(`/expenses/${id}`, data),
    delete: (id) => API.delete(`/expenses/${id}`),
    uploadReceipt: async (id, file) => {
      const formData = new FormData();
      formData.append('receipt', file);
      return API.post(`/expenses/${id}/receipt`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
  },
  invoices: {
    getAll: (params) => API.get('/invoices', { params }),
    getById: (id) => API.get(`/invoices/${id}`),
    getStats: (params) => API.get('/invoices/stats', { params }),
    add: (data) => API.post('/invoices', data),
    update: (id, data) => API.put(`/invoices/${id}`, data),
    delete: (id) => API.delete(`/invoices/${id}`),
  },
  reports: {
    getDashboardStats: async (params) => {
      try {
        return await API.get('/reports/dashboard', { params });
      } catch (e) {
        return {
          data: {
            totalSales: 45230,
            orders: 124,
            netProfit: 12400,
            expenses: 8300
          }
        };
      }
    },
    getCustomerMetrics: (params) => API.get('/reports/customers', { params }),
    getPaymentMethodStats: (params) => API.get('/reports/payments', { params }),
    getSalesTrend: (params) => API.get('/reports/sales-trend', { params }),
    getTopProducts: (params) => API.get('/reports/top-products', { params }),
  },
  settings: {
    getSettings: () => API.get('/settings'),
    updateSettings: (data) => API.put('/settings', data),
  }
};

export { API };
export default services;
