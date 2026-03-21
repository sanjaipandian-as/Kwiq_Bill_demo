import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

import { triggerAutoSave } from '../services/autosaveService';
import services, { API } from '../services/api';
import { useNetwork } from './NetworkContext';
import { useToast } from './ToastContext';
import { getUserSpecificKey, SETTINGS_KEY } from '../utils/storageKeys';
import { SecurityService } from '../services/SecurityService';
import CryptoJS from 'crypto-js';
import { getDriveEncSalt, deriveEncryptionKey, encryptContent, decryptContent } from '../services/googleDriveservices';

const SENSITIVE_FIELDS = [
    { section: 'bankDetails', fields: ['accountName', 'accountNumber', 'ifsc', 'bankName', 'branch'] },
    { section: 'user', fields: ['fullName', 'mobile', 'email'] },
    { section: 'store', fields: ['name', 'legalName', 'contact', 'email', 'gstin', 'address', 'fssai', 'pan'] },
    { section: 'receptionists', fields: ['name'] },
    { section: 'security', fields: ['managerPin'] }
];

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children, user }) => {
    const [settings, setSettings] = useState({
        store: {
            name: '',
            legalName: '',
            businessType: 'Proprietorship',
            contact: '',
            email: '',
            website: '',
            whatsapp: '',
            address: {
                street: '',
                area: '',
                city: '',
                state: '',
                pincode: ''
            },
            gstin: '',
            fssai: '',
            logo: null
        },
        bankDetails: {
            accountName: '',
            accountNumber: '',
            ifsc: '',
            bankName: '',
            branch: ''
        },
        tax: {
            gstEnabled: true,
            defaultType: 'Exclusive',
            taxGroups: [
                { id: '1', name: 'GST 18%', rate: 18, cgst: 9, sgst: 9, igst: 18, active: true },
                { id: '2', name: 'GST 5%', rate: 5, cgst: 2.5, sgst: 2.5, igst: 5, active: true }
            ]
        },
        invoice: {
            template: 'Classic',
            billTemplate: 'Classic',
            headerTitle: 'Tax Invoice',
            footerNote: 'Thank you for shopping!',
            termsAndConditions: 'Goods once sold will not be taken back.',
            conditionsText: 'All disputes are subject to local jurisdiction only.',
            invoicePaperSize: 'A4',
            billPaperSize: '80mm',
            showLogo: true,
            showWatermark: false,
            showStoreAddress: true,
            showTaxBreakup: true,
            showHsn: true,
            showMrp: true,
            showSavings: true,
            showCustomerGstin: true,
            showQrcode: true,
            showTerms: true,
            showLoyaltyPoints: false,
            showSignature: true,
            selectedPrinter: null,
            billLanguage: 'en'
        },
        defaults: {
            language: 'en',
            currency: 'INR',
            autoSave: true
        },
        user: {
            fullName: '',
            mobile: '',
            email: '',
            role: 'Owner',
            consent: {
                analytics: true,
                contact: true
            }
        },
        security: {
            managerPin: null,
            lastPinVerifiedAt: null
        },
        receptionists: [],
        onboardingCompletedAt: null,
        lastUpdatedAt: null
    });

    const [loading, setLoading] = useState(true);
    const [syncStatus, setSyncStatus] = useState('');
    const [syncStats, setSyncStats] = useState(null);
    const [lastEventSyncTime, setLastEventSyncTime] = useState(null);
    const [isSettingsDirty, setIsSettingsDirty] = useState(false);
    const [queueLength, setQueueLength] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [dbProfileComplete, setDbProfileComplete] = useState(false);
    const [isLogoUploading, setIsLogoUploading] = useState(false);

    const settingsKey = getUserSpecificKey(SETTINGS_KEY, user?.email);

    const { isConnected, wasOfflinePreviously, setWasOffline } = useNetwork();
    const { showToast } = useToast();
    const [estimatedUploadTime, setEstimatedUploadTime] = useState(0);

    // Fix #6: Pre-derive and cache the strong key for local encryption
    const [strongKey, setStrongKey] = useState(null);
    useEffect(() => {
        if (user?.email) {
            getDriveEncSalt().then(salt => {
                const key = deriveEncryptionKey(user.email, salt);
                setStrongKey(key);
            });
        }
    }, [user?.email]);

    useEffect(() => {
        setEstimatedUploadTime(queueLength * 2);
    }, [queueLength]);

    useEffect(() => {
        if (isConnected && wasOfflinePreviously) {
            checkQueueStatus().then(async (len) => {
                if (len > 0) {
                    showToast(`Cloud Restored: Syncing ${len} offline items...`, 'info');
                    try {
                        const { SyncService } = require('../services/OneWaySyncService');
                        await SyncService.retryQueue();
                        await checkQueueStatus();
                        showToast("Sync Successful: All offline bills backed up to Drive!", 'success');
                    } catch (e) {
                        showToast("Background sync encountered an error.", 'error');
                    }
                }
                setWasOffline(false);
            });
        }
    }, [isConnected, wasOfflinePreviously]);

    useEffect(() => {
        checkQueueStatus();
        const qInterval = setInterval(() => {
            checkQueueStatus();
        }, 5000);
        return () => clearInterval(qInterval);
    }, []);

    const checkQueueStatus = async () => {
        try {
            const { SyncService } = require('../services/OneWaySyncService');
            const len = await SyncService.getPendingQueueLength();
            setQueueLength(len);
            return len;
        } catch (e) {
            console.log("Queue Check Error:", e);
            return 0;
        }
    };

    const processSensitiveFields = (data, email, mode = 'encrypt', strongKey = null) => {
        if (!data || (!email && !strongKey)) return data;
        
        // Shallow copy top-level to avoid polluting the original reference until sections are deep-copied
        const processed = { ...data };

        SENSITIVE_FIELDS.forEach(({ section, fields }) => {
            const sectionData = processed[section];
            if (!sectionData) return;

            // Deep copy only the section we are about to modify
            const sectionTarget = Array.isArray(sectionData) 
                ? [...sectionData] 
                : { ...sectionData };
            
            processed[section] = sectionTarget;

            const processObject = (obj, objFields) => {
                objFields.forEach(field => {
                    const value = obj[field];
                    if (!value) return;
                    try {
                        if (mode === 'encrypt') {
                            const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                            if (!strValue.startsWith('U2FsdGVkX1')) {
                                obj[field] = encryptContent(strValue, strongKey || email);
                            }
                        } else {
                            if (typeof value === 'string' && value.startsWith('U2FsdGVkX1')) {
                                // Use the robust helper to try strongKey first, then email fallback
                                const result = decryptContent(value, email, strongKey || null);

                                if (result) {
                                    try {
                                        obj[field] = (result.startsWith('{') || result.startsWith('['))
                                            ? JSON.parse(result)
                                            : result;
                                    } catch (e) { obj[field] = result; }
                                }
                            }
                        }
                    } catch (err) {
                        console.warn(`[Crypto] Failed to ${mode} field ${section}.${field}:`, err.message);
                    }
                });
            };

            if (Array.isArray(sectionTarget)) {
                // For arrays, each item is treated as an object to have its fields processed
                processed[section] = sectionTarget.map(item => {
                    const newItem = { ...item };
                    processObject(newItem, fields);
                    return newItem;
                });
            } else {
                processObject(sectionTarget, fields);
            }
        });
        return processed;
    };

    const loadSettings = async () => {
        try {
            const saved = await AsyncStorage.getItem(settingsKey);
            if (saved && saved !== 'null') {
                const parsed = JSON.parse(saved);
                if (parsed) {
                    let strongKey = null;
                    if (user?.email) {
                        const salt = await getDriveEncSalt();
                        strongKey = deriveEncryptionKey(user.email, salt);
                    }
                    const decrypted = processSensitiveFields(parsed, user?.email, 'decrypt', strongKey);
                    setSettings(decrypted || {});
                }
            }
            const dirty = await AsyncStorage.getItem('settings_dirty');
            if (dirty === 'true') setIsSettingsDirty(true);
        } catch (error) {
            console.error('Failed to load settings', error);
        }
    };

    const loadSyncTime = async () => {
        const time = await AsyncStorage.getItem('last_synced_timestamp');
        if (time) setLastEventSyncTime(time);
    };

    const syncAllData = async (isManual = true) => {
        if (isManual) setLoading(true);
        setSyncStatus('Starting sync...');
        setIsUploading(true);

        try {
            const { SyncService } = require('../services/OneWaySyncService');
            setSyncStatus('Checking pending uploads...');
            let qLen = await checkQueueStatus();

            if (qLen > 0) {
                setSyncStatus(`Pushing ${qLen} pending changes...`);
                await SyncService.retryQueue();
                qLen = await checkQueueStatus();
            }

            setSyncStatus('Checking for cloud updates...');
            await SyncService.syncDown((msg, prog, stats) => {
                setSyncStatus(msg);
                if (stats) setSyncStats(stats);
            });

            const dirtyFlag = await AsyncStorage.getItem('settings_dirty');
            if (dirtyFlag === 'true') {
                setSyncStatus('Finalizing cloud setup...');
                const saved = await AsyncStorage.getItem(settingsKey);
                if (saved) {
                    const currentSettings = JSON.parse(saved);
                    const onboardingData = {
                        user: currentSettings.user,
                        store: currentSettings.store,
                        userEmail: user?.email || currentSettings.user?.email,
                        onboardingCompletedAt: currentSettings.onboardingCompletedAt
                    };
                    try {
                        await services.settings.updateSettings(onboardingData);
                        await AsyncStorage.setItem('settings_dirty', 'false');
                        setIsSettingsDirty(false);
                    } catch (e) {
                        console.warn('[Sync] Onboarding retry failed:', e.message);
                    }
                }
            }

            setSyncStatus('Ready');
            const time = await AsyncStorage.getItem('last_synced_timestamp');
            if (time) setLastEventSyncTime(time);

            return true;
        } catch (error) {
            console.error('Manual Sync Error:', error);
            setSyncStatus('Sync Error');
            return false;
        } finally {
            setIsUploading(false);
            if (isManual) setLoading(false);
            checkQueueStatus();
        }
    };

    useEffect(() => {
        const initializeSettings = async () => {
            setLoading(true);
            await loadSettings();
            await loadSyncTime();
            await checkQueueStatus();

            let hasUnlockedUI = false;

            if (user && user.id) {
                try {
                    const saved = await AsyncStorage.getItem(settingsKey);
                    if (saved) {
                        const local = JSON.parse(saved);
                        if (local.onboardingCompletedAt || !!local.store?.name) {
                            setDbProfileComplete(!!local.onboardingCompletedAt);
                            hasUnlockedUI = true;
                        }
                    }
                } catch (e) {
                    console.log('Error verifying offline settings:', e);
                }

                (async () => {
                    let isFreshLogin = false;
                    try {
                        const justLoggedIn = await AsyncStorage.getItem('just_logged_in');
                        if (justLoggedIn === 'true') {
                            isFreshLogin = true;
                            await AsyncStorage.removeItem('just_logged_in');
                            for (let i = 2; i > 0; i--) {
                                setSyncStatus(`Finalizing Database... (Est. time: ${i}s)`);
                                await new Promise(r => setTimeout(r, 1000));
                            }
                            setSyncStatus('Data was aligned. Opening app...');
                            await new Promise(r => setTimeout(r, 600));
                        } else {
                            const syncPromise = syncAllData(false);
                            if (hasUnlockedUI) {
                                setSyncStatus('Checking for recent updates...');
                                await new Promise(r => setTimeout(r, 1500));
                                await Promise.race([
                                    syncPromise,
                                    new Promise(r => setTimeout(r, 4000))
                                ]);
                            } else {
                                await syncPromise;
                            }
                        }
                    } catch (e) {
                        console.warn('[SettingsContext] Alignment check failed:', e.message);
                    }

                    try {
                        const vaultRecep = await SecurityService.getReceptionists(user);
                        if (vaultRecep && vaultRecep.length > 0) {
                            setSettings(prev => ({ ...prev, receptionists: vaultRecep }));
                        }
                    } catch (secErr) {
                        console.warn('[SettingsContext] Security Vault fetch failed:', secErr.message);
                    }

                    // Fix #6: Derive key once for this session to ensure consistency across background tasks
                    const salt = await getDriveEncSalt();
                    const activeStrongKey = deriveEncryptionKey(user.email, salt);

                    let driveDataLoaded = false;
                    try {
                        if (!isFreshLogin) {
                            const { fetchSettingsFromDrive } = require('../services/googleDriveservices');
                            const driveResult = await fetchSettingsFromDrive(user);
                            if (driveResult) {
                                driveDataLoaded = true;
                                setSettings(prev => {
                                    const decryptedDriveData = processSensitiveFields(driveResult, user?.email, 'decrypt', activeStrongKey);
                                    return { ...prev, ...decryptedDriveData };
                                });
                            }
                        }
                    } catch (driveErr) {
                        console.warn('[SettingsContext] Background Drive settings fetch failed:', driveErr.message);
                    }

                    try {
                        const response = await services.settings.getSettings();
                        const dbSettings = response?.data || response;

                        if (dbSettings && dbSettings.onboardingCompletedAt) {
                            setDbProfileComplete(true);
                            const dbLogo = dbSettings.store?.logo || null;

                            setSettings(prev => {
                                let updated;
                                const hasValidDriveData = driveDataLoaded && !!prev.store?.name;

                                if (hasValidDriveData) {
                                    updated = {
                                        ...prev,
                                        onboardingCompletedAt: dbSettings.onboardingCompletedAt,
                                        store: {
                                            ...prev.store,
                                            logo: dbLogo || prev.store?.logo || null,
                                        },
                                    };
                                } else {
                                    updated = {
                                        ...prev,
                                        onboardingCompletedAt: dbSettings.onboardingCompletedAt,
                                        store: {
                                            ...prev.store,
                                            ...(dbSettings.store || {}),
                                            logo: dbLogo || prev.store?.logo || null,
                                        },
                                        bankDetails: { ...prev.bankDetails, ...(dbSettings.bankDetails || {}) },
                                        tax: { ...prev.tax, ...(dbSettings.tax || {}) },
                                        invoice: { ...prev.invoice, ...(dbSettings.invoice || {}) },
                                        defaults: { ...prev.defaults, ...(dbSettings.defaults || {}) },
                                    };
                                }

                                const decryptedFinal = processSensitiveFields(updated, user?.email, 'decrypt', activeStrongKey);
                                const toSaveLocal = processSensitiveFields(decryptedFinal, user?.email, 'encrypt', activeStrongKey);
                                AsyncStorage.setItem(settingsKey, JSON.stringify(toSaveLocal));
                                return decryptedFinal;
                            });
                        } else {
                            if (!hasUnlockedUI) setDbProfileComplete(false);
                        }
                    } catch (dbErr) {
                        console.warn('[SettingsContext] DB profile check failed:', dbErr.message);
                        if (!hasUnlockedUI) {
                            const saved = await AsyncStorage.getItem(settingsKey);
                            if (saved) {
                                const local = JSON.parse(saved);
                                setDbProfileComplete(!!local.onboardingCompletedAt);
                            } else {
                                setDbProfileComplete(false);
                            }
                        }
                    } finally {
                        // FIX: Only turn off the loading overlay AFTER we fetch the database profile
                        // This prevents the "flash of onboarding form" on fresh logins.
                        setLoading(false);
                    }
                })();
            } else {
                setDbProfileComplete(false);
                setLoading(false);
            }
        };
        initializeSettings();
    }, [user?.id, user?.email]);

    const uploadLogoToCloud = async (logoData) => {
        if (!logoData || logoData.startsWith('http')) return logoData;
        try {
            const { services } = require('../services/api');
            let fileObject;
            if (logoData.startsWith('data:image')) {
                const parts = logoData.split(',');
                const mime = parts[0].match(/:(.*?);/)[1];
                const extension = mime.split('/')[1];
                fileObject = { uri: logoData, name: `store_logo.${extension}`, type: mime };
            } else if (logoData.startsWith('file://')) {
                const fileName = logoData.split('/').pop();
                const ext = fileName.split('.').pop().toLowerCase();
                fileObject = { uri: logoData, name: fileName, type: ext === 'png' ? 'image/png' : 'image/jpeg' };
            } else return logoData;

            const response = await services.settings.uploadLogo(fileObject);
            return response?.data?.logoUrl || logoData;
        } catch (err) {
            console.warn(`[Logo] ⚠️ Cloudinary upload failed: ${err.message}`);
            return logoData;
        }
    };

    const ensurePortableSettings = async (s) => {
        if (s.store?.logo && s.store.logo.startsWith('http')) return s;
        if (s.store?.logo && s.store.logo.startsWith('file://')) {
            try {
                const base64 = await FileSystem.readAsStringAsync(s.store.logo, { encoding: 'base64' });
                const mime = s.store.logo.endsWith('.png') ? 'image/png' : 'image/jpeg';
                return { ...s, store: { ...s.store, logo: `data:${mime};base64,${base64}` } };
            } catch (e) { console.warn('[SettingsContext] Portability conversion failed:', e); }
        }
        return s;
    };

    const updateSettings = (section, updates) => {
        setSettings(prev => {
            const newSettings = { ...prev, [section]: { ...prev[section], ...updates } };
            const toPersist = processSensitiveFields(newSettings, user?.email, 'encrypt', strongKey);
            AsyncStorage.setItem(settingsKey, JSON.stringify(toPersist));

            (async () => {
                // Defer intense security updates to keep the "continue/save" animation buttery smooth
                if (section === 'security' && updates.managerPin) {
                    setTimeout(async () => {
                        try {
                            await SecurityService.saveVault(user, updates.managerPin, newSettings.receptionists);
                        } catch (secErr) { 
                            console.error('[SettingsContext] Security Vault Save failed:', secErr.message); 
                        }
                    }, 800);
                }

                let finalSettings = newSettings;
                if (section === 'store' && updates.logo && !updates.logo.startsWith('http')) {
                    const cloudLogo = await uploadLogoToCloud(updates.logo);
                    if (cloudLogo !== updates.logo) {
                        finalSettings = { ...newSettings, store: { ...newSettings.store, logo: cloudLogo } };
                        setSettings(finalSettings);
                        AsyncStorage.setItem(settingsKey, JSON.stringify(finalSettings));
                    }
                }

                const portable = await ensurePortableSettings(finalSettings);
                const toCloud = processSensitiveFields(portable, user?.email, 'encrypt');
                const { _id, __v, createdAt, updatedAt, ...cleanToCloud } = toCloud;

                try {
                    await services.settings.updateSettings(cleanToCloud);
                    AsyncStorage.setItem('settings_dirty', 'false');
                    setIsSettingsDirty(false);
                } catch (err) {
                    AsyncStorage.setItem('settings_dirty', 'true');
                    setIsSettingsDirty(true);
                }

                if (user && user.id) {
                    const { syncSettingsToDrive } = require('../services/googleDriveservices');
                    syncSettingsToDrive(user, toCloud).catch(e => console.error(e));
                }
            })();
            return newSettings;
        });
    };

    const saveFullSettings = async (fullSettings) => {
        setIsUploading(true);
        try {
            const updated = { ...fullSettings, lastUpdatedAt: new Date().toISOString() };
            setSettings(updated);
            
            let strongKey = null;
            if (user?.email) {
                const salt = await getDriveEncSalt();
                strongKey = deriveEncryptionKey(user.email, salt);
            }
            
            const toPersist = processSensitiveFields(updated, user?.email, 'encrypt', strongKey);
            await AsyncStorage.setItem(settingsKey, JSON.stringify(toPersist));

            let finalToSync = updated;
            const logoData = updated.store?.logo;
            if (logoData && !logoData.startsWith('http')) {
                setIsLogoUploading(true);
                try {
                    const cloudUrl = await uploadLogoToCloud(logoData);
                    if (cloudUrl && cloudUrl !== logoData) {
                        finalToSync = { ...updated, store: { ...updated.store, logo: cloudUrl } };
                        setSettings(finalToSync);
                        await AsyncStorage.setItem(settingsKey, JSON.stringify(finalToSync));
                    }
                } catch (e) { }
                setIsLogoUploading(false);
            }

            if (user && user.id) {
                const portable = await ensurePortableSettings(finalToSync);
                const toCloud = processSensitiveFields(portable, user?.email, 'encrypt');
                const { _id, __v, createdAt, updatedAt, ...cleanToCloud } = toCloud;

                try {
                    await services.settings.updateSettings(cleanToCloud);
                    setDbProfileComplete(true);
                    await AsyncStorage.setItem('settings_dirty', 'false');
                    setIsSettingsDirty(false);
                } catch (err) {
                    await AsyncStorage.setItem('settings_dirty', 'true');
                    setIsSettingsDirty(true);
                }

                try {
                    const { syncSettingsToDrive } = require('../services/googleDriveservices');
                    await syncSettingsToDrive(user, portable);
                } catch (e) { }
            }

            setTimeout(() => { triggerAutoSave().catch(e => { }); }, 50);
            return true;
        } catch (error) {
            setIsUploading(false);
            setIsLogoUploading(false);
            throw error;
        } finally {
            setIsUploading(false);
            setIsLogoUploading(false);
        }
    };

    const forceResync = async () => {
        const currentQueueLen = await checkQueueStatus();
        if (currentQueueLen > 0) {
            Alert.alert("Cannot Re-sync Now", `You have ${currentQueueLen} items pending upload.`);
            return false;
        }
        setLoading(true);
        setIsUploading(true);
        try {
            const { SyncService } = require('../services/OneWaySyncService');
            await SyncService.resetSyncState();
            await syncAllData(false);
            return true;
        } catch (error) {
            return false;
        } finally {
            setIsUploading(false);
            setLoading(false);
        }
    };

    const repairSync = async () => {
        setLoading(true);
        setIsUploading(true);
        try {
            const { SyncService } = require('../services/OneWaySyncService');
            await SyncService.resetProcessedEvents();
            await syncAllData(false);
            return true;
        } catch (error) {
            return false;
        } finally {
            setIsUploading(false);
            setLoading(false);
        }
    };

    const deepRepair = async () => {
        if (!user || !user.id) return false;
        setLoading(true);
        setIsUploading(true);
        try {
            const { SyncService } = require('../services/OneWaySyncService');
            setSyncStatus('Locating baseline snapshot...');
            let restoreResult = await SyncService.restoreFromLatestSnapshot((msg) => setSyncStatus(`[Snapshot] ${msg}`));
            if (!restoreResult) {
                await SyncService.forceRestoreFromDrive(user, (msg) => setSyncStatus(`[Legacy] ${msg}`));
            }
            await SyncService.syncDown((msg) => setSyncStatus(msg));
            return true;
        } catch (error) {
            return false;
        } finally {
            setIsUploading(false);
            setLoading(false);
        }
    };

    const resetOnboarding = async () => {
        try {
            const updated = { ...settings, onboardingCompletedAt: null };
            setSettings(updated);
            await AsyncStorage.setItem(settingsKey, JSON.stringify(updated));
            Alert.alert("Reset Complete", "Onboarding status has been reset.");
            return true;
        } catch (error) { return false; }
    };

    const addReceptionist = async (name) => {
        const newReceptionist = { id: `RECEP-${Date.now()}`, name, is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        const updatedReceptionists = [...(settings.receptionists || []), newReceptionist];
        const updated = { ...settings, receptionists: updatedReceptionists, lastUpdatedAt: new Date().toISOString() };
        setSettings(updated);
        try { await SecurityService.saveVault(user, null, updatedReceptionists); } catch (e) { console.error('[Settings] Vault save failed on add:', e.message); }
        try {
            const { db } = require('../services/database');
            const { SyncService, EventTypes } = require('../services/OneWaySyncService');
            await db.runAsync('INSERT INTO receptionists (id, name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [newReceptionist.id, newReceptionist.name, newReceptionist.is_active, newReceptionist.created_at, newReceptionist.updated_at]);
            SyncService.createAndUploadEvent(EventTypes.RECEPTIONIST_CREATED, newReceptionist);
        } catch (e) { console.error('[Settings] DB/Sync failed on add receptionist:', e.message); }
    };

    const updateReceptionist = async (id, name) => {
        const updatedAt = new Date().toISOString();
        const updatedReceptionists = settings.receptionists.map(r => r.id === id ? { ...r, name, updated_at: updatedAt } : r);
        const updated = { ...settings, receptionists: updatedReceptionists, lastUpdatedAt: updatedAt };
        setSettings(updated);
        try { await SecurityService.saveVault(user, null, updatedReceptionists); } catch (e) { console.error('[Settings] Vault save failed on update:', e.message); }
        try {
            const { db } = require('../services/database');
            const { SyncService, EventTypes } = require('../services/OneWaySyncService');
            await db.runAsync('UPDATE receptionists SET name = ?, updated_at = ? WHERE id = ?', [name, updatedAt, id]);
            SyncService.createAndUploadEvent(EventTypes.RECEPTIONIST_UPDATED, { id, name, updated_at: updatedAt });
        } catch (e) { console.error('[Settings] DB/Sync failed on update receptionist:', e.message); }
    };

    const toggleReceptionistActive = async (id, isActive) => {
        const updatedAt = new Date().toISOString();
        const activeStatus = isActive ? 1 : 0;
        const updatedReceptionists = settings.receptionists.map(r => r.id === id ? { ...r, is_active: activeStatus, updated_at: updatedAt } : r);
        const updated = { ...settings, receptionists: updatedReceptionists, lastUpdatedAt: updatedAt };
        setSettings(updated);
        try { await SecurityService.saveVault(user, null, updatedReceptionists); } catch (e) { console.error('[Settings] Vault save failed on toggle:', e.message); }
        try {
            const { db } = require('../services/database');
            const { SyncService, EventTypes } = require('../services/OneWaySyncService');
            await db.runAsync('UPDATE receptionists SET is_active = ?, updated_at = ? WHERE id = ?', [activeStatus, updatedAt, id]);
            SyncService.createAndUploadEvent(EventTypes.RECEPTIONIST_UPDATED, { id, is_active: activeStatus, updated_at: updatedAt });
        } catch (e) { console.error('[Settings] DB/Sync failed on toggle receptionist:', e.message); }
    };

    const deleteReceptionist = async (id) => {
        const updatedReceptionists = settings.receptionists.filter(r => r.id !== id);
        const updated = { ...settings, receptionists: updatedReceptionists, lastUpdatedAt: new Date().toISOString() };
        setSettings(updated);
        try { await SecurityService.saveVault(user, null, updatedReceptionists); } catch (e) { console.error('[Settings] Vault save failed on delete:', e.message); }
        try {
            const { db } = require('../services/database');
            const { SyncService, EventTypes } = require('../services/OneWaySyncService');
            await db.runAsync('DELETE FROM receptionists WHERE id = ?', [id]);
            SyncService.createAndUploadEvent(EventTypes.RECEPTIONIST_DELETED, { id });
        } catch (e) { console.error('[Settings] DB/Sync failed on delete receptionist:', e.message); }
    };

    const syncToCloud = async () => {
        if (!user || !user.id) { return false; }
        setIsUploading(true);
        try {
            const { fetchAllTableData } = require('../services/database');
            const { syncUserDataToDrive } = require('../services/googleDriveservices');
            const allData = await fetchAllTableData();
            allData.settings = [settings];
            const success = await syncUserDataToDrive(user, allData);
            if (success) {
                const { SyncService } = require('../services/OneWaySyncService');
                SyncService.createGlobalSnapshot().catch(e => { });
            }
            return success;
        } catch (error) { return false; } finally { setIsUploading(false); }
    };

    const backupDataToCloud = async (onLog) => {
        if (!user || !user.id) { return false; }
        const log = (msg) => {
            setSyncStatus(msg);
            if (typeof onLog === 'function') onLog(msg);
        };
        setIsUploading(true);
        try {
            const { SyncService } = require('../services/OneWaySyncService');
            const { fetchAllTableData } = require('../services/database');
            log('Starting secure backup...');
            await SyncService.retryQueue();
            const snapSuccess = await SyncService.createGlobalSnapshot((msg) => log(msg));
            if (snapSuccess) {
                log('Backup complete!');
                showToast("Data securely backed up to your Google Drive.", "success");
                return true;
            }
            return false;
        } catch (error) { return false; } finally { setIsUploading(false); }
    };

    // Stable context value (Settings and Actions)
    const settingsValue = React.useMemo(() => ({
        settings,
        updateSettings,
        saveFullSettings,
        resetOnboarding,
        syncAllData,
        syncToCloud,
        backupDataToCloud,
        forceResync,
        repairSync,
        deepRepair,
        addReceptionist,
        updateReceptionist,
        toggleReceptionistActive,
        deleteReceptionist,
        loading,
        dbProfileComplete,
        isConnected,
        verifyManagerPin: async (pin) => await SecurityService.verifyPin(pin, user)
    }), [settings, loading, dbProfileComplete, isConnected, user?.id]);

    // High-frequency context value (Sync Status)
    const statusValue = React.useMemo(() => ({
        lastEventSyncTime,
        syncStatus,
        queueLength,
        isUploading,
        isLogoUploading,
        checkQueueStatus,
        syncStats,
        estimatedUploadTime
    }), [lastEventSyncTime, syncStatus, queueLength, isUploading, isLogoUploading, syncStats, estimatedUploadTime]);

    return (
        <SettingsContext.Provider value={{ ...settingsValue, ...statusValue }}>
            {children}
        </SettingsContext.Provider>
    );
};
