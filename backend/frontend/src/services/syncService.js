
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_URL = `${API_BASE_URL}/backup`;

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        headers: {
            Authorization: `Bearer ${token}`
        }
    };
};

export const syncService = {
    triggerSync: async () => {
        try {
            const response = await axios.post(`${API_URL}/sync`, {}, getAuthHeaders());
            return response.data;
        } catch (error) {
            console.error("Sync Failed:", error);
            throw error;
        }
    },

    uploadEvent: async (type, payload) => {
        try {
            const response = await axios.post(`${API_URL}/event`, { type, payload }, getAuthHeaders());
            return response.data;
        } catch (error) {
            console.error("Event Upload Failed:", error);
            throw error;
        }
    },

    getBackupStatus: async () => {
        try {
            const response = await axios.get(`${API_URL}/status`, getAuthHeaders());
            return response.data;
        } catch (error) {
            console.error("Status Check Failed:", error);
            throw error;
        }
    },

    pushAllData: async (clearExisting = false) => {
        try {
            const response = await axios.post(`${API_URL}/push-all`, { clearExisting }, getAuthHeaders());
            return response.data;
        } catch (error) {
            console.error("Push All Data Failed:", error);
            throw error;
        }
    }
};
