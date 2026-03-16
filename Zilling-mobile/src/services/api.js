import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const PRODUCTION_URL = 'https://kwiq-bill.onrender.com';
let LOCAL_IP;
try {
  // Optional local-env config; if present, it can override the default LOCAL_IP
  // eslint-disable-next-line global-require
  const cfg = require('../config/local-env');
  LOCAL_IP = cfg?.LOCAL_IP;
} catch {
  // If local-env isn't present, fall back to environment variable (Expo) or a default
  LOCAL_IP = process.env.EXPO_PUBLIC_LOCAL_IP;
}
if (!LOCAL_IP) {
  LOCAL_IP = '10.220.176.96';
}
const LOCAL_URL = Platform.OS === 'android'
  ? `http://${LOCAL_IP}:5001`
  : `http://localhost:5001`;

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
  const token = await SecureStore.getItemAsync('token');
  if (token) {
    if (!config.headers) config.headers = {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Handle 401 Unauthorized and 403 Trial Expired globally
let unauthorizedCount = 0;
let lastReset = Date.now();

API.interceptors.response.use(
  (response) => {
    // Reset consecutive 401 counter on success
    unauthorizedCount = 0;
    return response;
  },
  async (error) => {
    // Detailed error logging for debugging "Network Error"
    if (error.message === 'Network Error') {
      console.error(`[API] Network Error connecting to: ${BASE_URL}`);
      console.error('Possible causes: Server not running, IP changed, or device not on same WiFi.');
    } else if (error.response) {
      const sanitizedUrl = error.config?.url ? error.config.url.split('?')[0] : 'unknown_url';
      console.log(`[API] Error Status: ${error.response.status} for ${sanitizedUrl}`);
    }

    if (error.response && error.response.status === 401) {
      const now = Date.now();
      const isAuthRoute = error.config?.url?.includes('/auth/login') || 
                         error.config?.url?.includes('/auth/google') ||
                         error.config?.url?.includes('/auth/register');

      if (now - lastReset > 60000) {
        unauthorizedCount = 1;
        lastReset = now;
      } else {
        unauthorizedCount++;
      }

      if (unauthorizedCount > 10) {
        console.warn('Circuit breaker triggered: Too many 401 Unauthorized responses.');
        return Promise.reject(new Error("Circuit breaker triggered."));
      }

      if (!isAuthRoute) {
        const justLoggedIn = await AsyncStorage.getItem('just_logged_in');
        if (!justLoggedIn) {
          console.warn('Unauthorized request - 401. Clearing token...');
          await SecureStore.deleteItemAsync('token').catch(() => {});
          await AsyncStorage.removeItem('user').catch(() => {});
        } else {
          console.log('[API] 401 detected but "just_logged_in" flag is set. Ignoring wipe.');
        }
      }
    }

    // Handle trial expiration from backend
    if (error.response && error.response.status === 403) {
      const message = error.response.data?.message || '';
      if (message.includes('TRIAL_EXPIRED')) {
        console.warn('Trial expired - API access blocked by server.');
        error.isTrialExpired = true;
        // Broadcast the real-time server check
        import('react-native').then(({ DeviceEventEmitter }) => {
          DeviceEventEmitter.emit('TRIAL_EXPIRED_EVENT');
        });
      }
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
      return await API.get('/reports/dashboard', { params });
    },
    getCustomerMetrics: (params) => API.get('/reports/customers', { params }),
    getPaymentMethodStats: (params) => API.get('/reports/payments', { params }),
    getSalesTrend: (params) => API.get('/reports/sales-trend', { params }),
    getTopProducts: (params) => API.get('/reports/top-products', { params }),
  },
  settings: {
    getSettings: () => API.get('/settings'),
    updateSettings: (data) => API.put('/settings', data),
    uploadLogo: async (file) => {
      const formData = new FormData();
      formData.append('logo', file);
      return API.post('/settings/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
  },
  broadcasts: {
    getLatest: () => API.get('/broadcasts/latest'),
  }
};

export { API };
export default services;
