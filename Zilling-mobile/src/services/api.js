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
  LOCAL_IP = '10.60.148.96';
}

// Emulators use 10.0.2.2, but physical phones over USB/WiFi must use the actual IPv4 Address of your PC.
// Since we detected 10.146.104.244 from your ipconfig, let's force that so physical phones work.
let androidIp = LOCAL_IP === '127.0.0.1' || LOCAL_IP === 'localhost' || LOCAL_IP === '10.0.2.2'
  ? '10.60.148.96'
  : LOCAL_IP;

const LOCAL_URL = Platform.OS === 'android'
  ? `http://${androidIp}:5001`
  : `http://localhost:5001`;

// Toggle this to true when deploying the APK
const IS_PRODUCTION = true;

const BASE_URL = IS_PRODUCTION ? PRODUCTION_URL : LOCAL_URL;

const API = axios.create({
  baseURL: BASE_URL,
  timeout: 10000, // Increased to 10s for Render "cold starts"
});

// For debugging: verify which URL is being used
console.log(`[API] Initialized with baseURL: ${BASE_URL} (Mode: ${IS_PRODUCTION ? 'PROD' : 'LOCAL'})`);

/* =====================================================================
 * PHASE 3: STRICT SSL CERTIFICATE PINNING (Anti-MITM)
 * To permanently activate, run: npx expo install react-native-ssl-public-key-pinning
 * and uncomment this block. Once active, all Axios requests to untrusted certs will physically abort.
 * =====================================================================
 */
import { initializeSslPinning } from 'react-native-ssl-public-key-pinning';

// We initialize SSL pinning immediately to protect the production node
if (IS_PRODUCTION) {
  initializeSslPinning({
    'kwiq-bill.onrender.com': {
      includeSubdomains: true,
      publicKeyHashes: [
        'sha256/WoiWRyIOVNa9ihaBciRSC7XHjliYS9VwUGOIud4PB18=', // Primary Let's Encrypt / Render Hash
        'sha256/8Rw90Ej3Ttt8RRkrg+WYDS9n7y03zkV7vHym1mYf4s4='  // Backup CA Hash
      ],
    }
  }).catch(err => console.error('[SSL_PINNING] Failed to initialize', err));
}

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
      if (error.response.status === 400 && error.response.data) {
        console.log(`[API] Error Detail:`, JSON.stringify(error.response.data));
      }
    }

    if (error.response && error.response.status === 401) {
      const now = Date.now();
      const isAuthRoute = error.config?.url?.includes('/auth/login') ||
        error.config?.url?.includes('/auth/google') ||
        error.config?.url?.includes('/auth/register') ||
        error.config?.url?.includes('/security/recover'); // Recovery is public — never wipe token for this

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
          await SecureStore.deleteItemAsync('token').catch(() => { });
          await AsyncStorage.removeItem('user').catch(() => { });
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
  },
  security: {
    backupKey: async (data) => { const res = await API.post('/security/backup-key', data); return res.data; },
    recoverKey: async (data) => { const res = await API.post('/security/recover', data); return res.data; },
    auditLog: async (data) => { const res = await API.post('/security/audit', data); return res.data; },
  },
  requests: {
    createCustomizeRequest: (data) => API.post('/customize-requests', data),
    getMyRequestStatus: (email) => API.get('/customize-requests/my-status', { params: { email } }),
  },
  sync: {
    uploadEvent: (data) => API.post('/backup/event', data),
    syncEvents: (lastSyncedAt) => API.post('/backup/sync', { lastSyncedAt }),
    getStatus: () => API.get('/backup/status'),
    pushAllData: (clearExisting = false) => API.post('/backup/push-all', { clearExisting }),
  },
  payment: {
    createOrder: (data) => API.post('/payment/order', data),
    verifyPayment: (data) => API.post('/payment/verify', data),
  }
};

export { API };
export default services;
