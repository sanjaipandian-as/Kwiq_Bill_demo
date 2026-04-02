import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert, InteractionManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { triggerAutoSave } from '../services/autosaveService';
import services, { API } from '../services/api';
import { useNetwork } from './NetworkContext';
import { useToast } from './ToastContext';
import { getUserSpecificKey, SETTINGS_KEY } from '../utils/storageKeys';
import { SecurityService } from '../services/SecurityService';
import CryptoJS from 'crypto-js';
import { getDriveEncSalt, deriveEncryptionKey, encryptContent, decryptContent, prewarmEncryptionKeys } from '../services/googleDriveservices';

// Fix: include store fields so AES-encrypted values from MongoDB are decrypted
const SENSITIVE_FIELDS = [
    { section: 'security', fields: ['managerPin'] },
    { section: 'receptionists', fields: ['pin'] },
    { section: 'bankDetails', fields: ['accountNumber', 'ifsc'] },
    { section: 'store', fields: ['name', 'legalName', 'contact', 'email', 'gstin'] },
    { section: 'user', fields: ['fullName', 'mobile'] }
];

const INITIAL_SETTINGS = {
    store: {
        name: '',
        legalName: '',
        businessType: 'Proprietorship',
        contact: '',
        email: '',
        website: '',
        address: {
            street: '',
            area: '',
            city: '',
            state: '',
            pincode: '',
        },
        gstin: '',
        logo: null,
    },
    tax: {
        gstEnabled: true,
        taxType: 'none',
        gstNumber: '',
        taxGroups: [
            { id: '1', name: 'GST 18%', rate: 18, cgst: 9, sgst: 9, igst: 18, active: true },
            { id: '2', name: 'GST 5%', rate: 5, cgst: 2.5, sgst: 2.5, igst: 5, active: true }
        ]
    },
    bankDetails: {
        accountName: '',
        bankName: '',
        accountNumber: '',
        ifsc: '',
        upiId: '',
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
        autoSave: true // Forced ALWAYS ON for data protection
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
};

/**
 * 🚀 ROBUSTNESS: Unwrap settings if it comes from the server wrapped in a { settings: ... } object
 */
const unwrapSettings = (data) => {
    if (!data) return data;
    
    // Case 1: Wrapped in { settings: { ... } }
    if (data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)) {
        return data.settings;
    }
    
    // Case 2: Wrapped in { user: { settings: { ... } } } (Some Mongo-Aggregate routes)
    if (data.user?.settings && typeof data.user.settings === 'object') {
        return data.user.settings;
    }

    // Case 3: Wrapped in { data: { ... } } (Double-wrap fallback)
    if (data.data && typeof data.data === 'object' && !data.data.store && data.data.settings) {
        return data.data.settings;
    }

    return data;
};

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children, user }) => {
    const [settings, setSettings] = useState(INITIAL_SETTINGS);

    const [loading, setLoading] = useState(true);
    const [syncStatus, setSyncStatus] = useState('');
    const [syncStats, setSyncStats] = useState(null);
    const [lastEventSyncTime, setLastEventSyncTime] = useState(null);
    const [isSettingsDirty, setIsSettingsDirty] = useState(false);
    const [queueLength, setQueueLength] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [dbProfileComplete, setDbProfileComplete] = useState(false);
    const [isLogoUploading, setIsLogoUploading] = useState(false);
    // Fix #1: Tracks whether keys are warm and decryption of sensitive fields is done.
    // UI components gate on this to show skeleton instead of "Not set".
    const [isDecryptionReady, setIsDecryptionReady] = useState(false);
    const [isTokenReady, setIsTokenReady] = useState(false);
    const [initStage, setInitStage] = useState(1);

    const finishLoading = React.useCallback(() => {
        setLoading(false);
    }, []);

    const settingsKey = getUserSpecificKey(SETTINGS_KEY, user?.email);

    const { isConnected, wasOfflinePreviously, setWasOffline } = useNetwork();
    const { showToast } = useToast();
    const [estimatedUploadTime, setEstimatedUploadTime] = useState(0);
    const [isRepairing, setIsRepairing] = useState(false);
    const [lastLocalUpdateAt, setLastLocalUpdateAt] = useState(Date.now());

    // Fix #6: Pre-derive and cache the strong key for local encryption
    const [strongKey, setStrongKey] = useState(null);
    // REMOVED: Redundant and blocking effect. Moved to consolidated lazy pre-warm.

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

    const checkQueueStatus = React.useCallback(async () => {
        try {
            const { SyncService } = require('../services/OneWaySyncService');
            const len = await SyncService.getPendingQueueLength();
            setQueueLength(len);
            return len;
        } catch (e) {
            console.log("Queue Check Error:", e);
            return 0;
        }
    }, []);

    const processSensitiveFields = React.useCallback(async (data, email, mode = 'encrypt', activeStrongKey = null) => {
        if (!data || (!email && !activeStrongKey)) return data;

        const normalizedEmail = email?.toLowerCase()?.trim?.() || email;
        const processed = { ...data };

        for (const { section, fields } of SENSITIVE_FIELDS) {
            // Support deep nesting (e.g. 'store.address')
            const sectionParts = section.split('.');
            let parent = processed;

            // Navigate to the leaf parent
            for (let i = 0; i < sectionParts.length - 1; i++) {
                const part = sectionParts[i];
                if (!parent[part]) {
                    parent = null;
                    break; 
                }
                parent[part] = Array.isArray(parent[part]) ? [...parent[part]] : { ...parent[part] };
                parent = parent[part];
            }
            if (!parent) continue; // Section path doesn't exist

            const sectionName = sectionParts[sectionParts.length - 1];
            let sectionData = parent[sectionName];
            // 🚀 ROBUSTNESS: Only process and update parent if the section actually exists in the data.
            // Previously, this would overwrite missing sections with 'undefined', wiping the state.
            if (sectionData === undefined) continue;

            if (typeof sectionData === 'string' && (sectionData.startsWith('{') || sectionData.startsWith('['))) {
                try {
                    sectionData = JSON.parse(sectionData);
                } catch(e) {}
            }

            const sectionTarget = Array.isArray(sectionData) ? [...sectionData] : (sectionData && typeof sectionData === 'object' ? { ...sectionData } : sectionData);
            if (!sectionTarget || typeof sectionTarget !== 'object') continue;

            parent[sectionName] = sectionTarget;

            const processObject = async (obj, objFields) => {
                if (!obj || typeof obj !== 'object') return;
                for (const field of objFields) {
                    let value = obj[field];
                    if (!value) continue;

                    if (value && typeof value === 'object' && !Array.isArray(value) && value['0'] !== undefined) {
                        try {
                            value = Object.values(value).join('');
                            obj[field] = value;
                        } catch (e) { }
                    }

                    try {
                        if (mode === 'encrypt') {
                            const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                            if (!strValue.startsWith('U2FsdGVkX1') && !strValue.startsWith('KWIQV2:')) {
                                obj[field] = encryptContent(strValue, activeStrongKey || normalizedEmail);
                            }
                        } else {
                            if (typeof value === 'string' && (value.startsWith('U2FsdGVkX1') || value.startsWith('KWIQV2:'))) {
                                // 1. Try Mobile Key (Strong Key or Email)
                                let result = await decryptContent(value, email, activeStrongKey || null);

                                // 2. FALLBACK: Try Desktop Salt if first attempt fails
                                if (!result) {
                                    result = await decryptContent(value, email, 'kwiq-bill-shared-salt-2024');
                                }

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
                }
            };

            if (Array.isArray(sectionTarget)) {
                for (let i = 0; i < sectionTarget.length; i++) {
                    if (sectionTarget[i] && typeof sectionTarget[i] === 'object') {
                        const newItem = { ...sectionTarget[i] };
                        await processObject(newItem, fields);
                        sectionTarget[i] = newItem;
                    }
                }
            } else {
                await processObject(sectionTarget, fields);
            }
        }
        return processed;
    }, []);

    // 🔍 DEBUG UTILITY: Log full decrypted profile to terminal for verification
    const logDecryptedSettings = React.useCallback((data, source = 'Cloud') => {
        if (!data) return;
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`💎 [${source.toUpperCase()}] SETTINGS ALIGNED: Decrypted Profile Data`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🏪 Store Name:`, data?.store?.name || 'Not Set');
        console.log(`🏢 Legal Name:`, data?.store?.legalName || 'Not Set');
        console.log(`📞 Contact:`, data?.store?.contact || 'Not Set');
        console.log(`📧 Store Email:`, data?.store?.email || 'Not Set');
        console.log(`💰 Bank Holder:`, data?.bankDetails?.accountName || 'Not Set');
        console.log(`🏦 Bank Name:`, data?.bankDetails?.bankName || 'Not Set');
        console.log(`🔢 Account No:`, data?.bankDetails?.accountNumber || 'Not Set');
        console.log(`🔑 IFSC Code:`, data?.bankDetails?.ifsc || 'Not Set');
        console.log(`👤 Owner Full Name:`, data?.user?.fullName || 'Not Set');
        console.log(`📱 Owner Mobile:`, data?.user?.mobile || 'Not Set');
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    }, []);

    const repairSettingsFromDrive = React.useCallback(async () => {
        if (!user?.email || isRepairing) return;

        setIsRepairing(true);
        const startTime = Date.now();
        console.log('[Settings] Starting background repair from Drive...');

        try {
            const { fetchSettingsFromDrive } = require('../services/googleDriveservices');
            const driveData = await fetchSettingsFromDrive(user);

            if (driveData) {
                // RACE CONDITION CHECK: If user edited local settings while we were fetching, ABORT.
                if (Date.now() - lastLocalUpdateAt < (Date.now() - startTime)) {
                    console.log('[Settings] Aborting repair: Local edits detected during fetch.');
                    return;
                }

                const salt = await getDriveEncSalt();
                const activeStrongKey = deriveEncryptionKey(user.email, salt);
                const decoded = await processSensitiveFields(driveData, user.email, 'decrypt', activeStrongKey);
                logDecryptedSettings(decoded, 'Background Repair');

                setSettings(prev => {
                    // Deep merge to preserve logo or other local-only states if any
                    const updated = { ...prev, ...decoded };
                    // Persist fixed data
                    (async () => {
                        const toSave = await processSensitiveFields(updated, user.email, 'encrypt', activeStrongKey);
                        AsyncStorage.setItem(settingsKey, JSON.stringify(toSave));
                    })();
                    return updated;
                });
                console.log('[Settings] ✓ Background repair successful.');
            }
        } catch (e) {
            console.warn('[Settings] Repair fetch failed:', e.message);
            showToast('Cloud sync paused. Some details may be encrypted.', 'info');
        } finally {
            setIsRepairing(false);
        }
    }, [user, isRepairing, lastLocalUpdateAt, settingsKey, processSensitiveFields, showToast]);

    const loadSettings = React.useCallback(async () => {
        try {
            // Fix #2: Pre-warm encryption keys BEFORE any decryption runs.
            // On cold restart the _keyCache is empty. prewarmEncryptionKeys populates it
            // with all key variants (supreme/standard/legacy) by yielding between each
            // PBKDF2 call so the JS thread isn't frozen.
            // This MUST be awaited — firing it in parallel causes the timing trap where
            // processSensitiveFields runs before the cache is hot.
            if (user?.email) {
                setIsDecryptionReady(false); // signal UI to show skeletons
                await prewarmEncryptionKeys(user.email);
            }

            // ── POST-LOGIN FRESH FETCH ──
            const justLoggedIn = await AsyncStorage.getItem('just_logged_in');
            if (justLoggedIn === 'true') {
                await AsyncStorage.removeItem('just_logged_in');

                const saved = await AsyncStorage.getItem(settingsKey);
                if (saved && saved !== 'null') {
                    const rawParsed = JSON.parse(saved);
                    const parsed = unwrapSettings(rawParsed || {});
                    if (parsed) {
                        const salt = await getDriveEncSalt();
                        const activeStrongKey = user?.email ? deriveEncryptionKey(user.email, salt) : null;
                        
                        // Fix: The data fetched post-login may still contain raw MongoDB encrypted strings
                        // like 'U2FsdGVkX1...'. We MUST decrypt them FIRST before setting state!
                        // Fix #3: Deep merge to preserve existing data (like receptionists) when loading fresh MongoDB data
                        const decrypted = await processSensitiveFields(parsed, user?.email, 'decrypt', activeStrongKey);
                        logDecryptedSettings(decrypted, 'Post-Login Cache');
                        setSettings(prev => ({
                            ...prev,
                            ...decrypted,
                            store: { ...(prev.store || {}), ...(decrypted.store || {}) },
                            bankDetails: { ...(prev.bankDetails || {}), ...(decrypted.bankDetails || {}) },
                            user: { ...(prev.user || {}), ...(decrypted.user || {}) },
                            security: { ...(prev.security || {}), ...(decrypted.security || {}) },
                            receptionists: prev.receptionists?.length > 0 ? prev.receptionists : (decrypted.receptionists || [])
                        }));

                        const toSave = await processSensitiveFields(decrypted, user?.email, 'encrypt', activeStrongKey);
                        await AsyncStorage.setItem(settingsKey, JSON.stringify(toSave));
                        
                        if (parsed.onboardingCompletedAt) setDbProfileComplete(true);
                        
                        // 🚀 ADDED: IMMEDIATE VAULT RECOVERY AFTER LOGIN
                        try {
                            const vaultRecep = await SecurityService.getReceptionists(user);
                            if (vaultRecep && vaultRecep.length > 0) {
                                setSettings(prev => ({ ...prev, receptionists: vaultRecep }));
                            }
                            const hasPin = await SecurityService.hasManagerPin();
                            if (hasPin) {
                                setSettings(prev => ({ 
                                    ...prev, 
                                    security: { ...(prev.security || {}), managerPin: prev.security?.managerPin || 'RECLAIMED' } 
                                }));
                            }
                        } catch (vaultErr) { console.warn('[Settings] Post-login vault recovery failed'); }

                        setIsDecryptionReady(true);
                        console.log('[Settings] ✅ Loaded FRESH data from post-login fetch.');
                        return;
                    }
                }

                console.log('[Settings] Post-login cache empty, fetching directly from MongoDB...');
                if (isConnected) {
                    try {
                        const response = await services.settings.getSettings();
                        const body = response?.data || response;
                        const dbSettings = unwrapSettings(body);
                        if (dbSettings) {
                            const salt = await getDriveEncSalt();
                            const activeStrongKey = user?.email ? deriveEncryptionKey(user.email, salt) : null;
                            const decryptedFromMongo = await processSensitiveFields(dbSettings, user?.email, 'decrypt', activeStrongKey);
                            logDecryptedSettings(decryptedFromMongo, 'Login Fallback Mongo');
                            setSettings(prev => ({
                                ...prev,
                                ...decryptedFromMongo,
                                store: { ...(prev.store || {}), ...(decryptedFromMongo.store || {}) },
                                bankDetails: { ...(prev.bankDetails || {}), ...(decryptedFromMongo.bankDetails || {}) },
                                user: { ...(prev.user || {}), ...(decryptedFromMongo.user || {}) },
                                security: { ...(prev.security || {}), ...(decryptedFromMongo.security || {}) },
                                receptionists: prev.receptionists?.length > 0 ? prev.receptionists : (decryptedFromMongo.receptionists || [])
                            }));

                            const toPersist = await processSensitiveFields(decryptedFromMongo, user?.email, 'encrypt', activeStrongKey);
                            await AsyncStorage.setItem(settingsKey, JSON.stringify(toPersist));
                            
                            if (dbSettings.onboardingCompletedAt) setDbProfileComplete(true);
                            
                            // 🚀 ADDED: IMMEDIATE VAULT RECOVERY AFTER LOGIN FALLBACK
                            try {
                                const vaultRecep = await SecurityService.getReceptionists(user);
                                if (vaultRecep && vaultRecep.length > 0) {
                                    setSettings(prev => ({ ...prev, receptionists: vaultRecep }));
                                }
                                const hasPin = await SecurityService.hasManagerPin();
                                if (hasPin) {
                                    setSettings(prev => ({ 
                                        ...prev, 
                                        security: { ...(prev.security || {}), managerPin: prev.security?.managerPin || 'RECLAIMED' } 
                                    }));
                                }
                            } catch (vaultErr) { console.warn('[Settings] Post-login fallback vault recovery failed'); }

                            setIsDecryptionReady(true);
                            console.log('[Settings] ✅ Fresh settings loaded on login fallback.');
                            return;
                        }
                    } catch (e) {
                        console.warn('[Settings] Login-time MongoDB fetch failed:', e.message);
                    }
                }
                return;
            }

            // ── NORMAL LOAD (subsequent in-session loads) ──
            const saved = await AsyncStorage.getItem(settingsKey);
            const tokenKey = `local_access_token_${user.email.replace(/[@.]/g, '_')}`;
            const localToken = await AsyncStorage.getItem(tokenKey);

            if (saved && saved !== 'null' && localToken) {
                const parsed = JSON.parse(saved);
                if (parsed) {
                    // Key cache is already warm from the prewarmEncryptionKeys call above
                    const salt = await getDriveEncSalt();
                    const activeStrongKey = user?.email ? deriveEncryptionKey(user.email, salt) : null;
                    const decrypted = await processSensitiveFields(parsed, user?.email, 'decrypt', activeStrongKey);
                    logDecryptedSettings(decrypted, 'Local Cache');

                    // 🛡️ RECOVERY TRIGGER: If critical fields are still encrypted, trigger repair
                    const stringified = JSON.stringify(decrypted);
                    const isStillEncrypted = stringified.includes('U2FsdGVkX1') || stringified.includes('KWIQV2:');
                    if (isStillEncrypted && isConnected) {
                        repairSettingsFromDrive();
                    }

                    if (parsed.onboardingCompletedAt) setDbProfileComplete(true);
                    
                    // 🚀 PROTECTION: Always preserve local receptionists & deep merge objects
                    setSettings(prev => ({
                        ...prev,
                        ...decrypted,
                        store: { ...(prev.store || {}), ...(decrypted.store || {}) },
                        bankDetails: { ...(prev.bankDetails || {}), ...(decrypted.bankDetails || {}) },
                        user: { ...(prev.user || {}), ...(decrypted.user || {}) },
                        security: { ...(prev.security || {}), ...(decrypted.security || {}) },
                        receptionists: prev.receptionists?.length > 0 ? prev.receptionists : (decrypted.receptionists || [])
                    }));

                    // 🚀 ADDED: IMMEDIATE VAULT RECOVERY FROM CACHE
                    // Correctly uses SecurityService to handle decryption/cache logic
                    try {
                        const vaultRecep = await SecurityService.getReceptionists(user);
                        if (vaultRecep && vaultRecep.length > 0) {
                            setSettings(prev => ({ ...prev, receptionists: vaultRecep }));
                        }
                        const hasPin = await SecurityService.hasManagerPin();
                        if (hasPin) {
                            setSettings(prev => ({ 
                                ...prev, 
                                security: { ...(prev.security || {}), managerPin: prev.security?.managerPin || 'RECLAIMED' } 
                            }));
                        }
                    } catch (vaultErr) { console.warn('[Settings] Local vault recovery failed'); }

                    setIsDecryptionReady(true); // ✅ keys warm, data decrypted
                    setIsTokenReady(true); // ✅ token exists
                    return;
                }
            }
            
            // 🚀 FALLBACK: No local data OR no local access token - fetch from MongoDB
            if (isConnected) {
                console.log('[Settings] No valid local auth token or local data, fetching from MongoDB...');
                try {
                    const response = await services.settings.getSettings();
                    const dbSettings = response?.data || response;
                    if (dbSettings) {
                        console.log("Raw DB Settings:", JSON.stringify(dbSettings));
                        const salt = await getDriveEncSalt();
                        const activeStrongKey = user?.email ? deriveEncryptionKey(user.email, salt) : null;
                        const decryptedFromMongo = await processSensitiveFields(dbSettings, user?.email, 'decrypt', activeStrongKey);
                        logDecryptedSettings(decryptedFromMongo, 'Fallback Mongo');
                        const toPersist = await processSensitiveFields(decryptedFromMongo, user?.email, 'encrypt', activeStrongKey);
                        await AsyncStorage.setItem(settingsKey, JSON.stringify(toPersist));
                        
                        setSettings(prev => ({
                            ...prev,
                            ...decryptedFromMongo,
                            store: { ...(prev.store || {}), ...(decryptedFromMongo.store || {}) },
                            bankDetails: { ...(prev.bankDetails || {}), ...(decryptedFromMongo.bankDetails || {}) },
                            user: { ...(prev.user || {}), ...(decryptedFromMongo.user || {}) },
                            security: { ...(prev.security || {}), ...(decryptedFromMongo.security || {}) },
                            receptionists: prev.receptionists?.length > 0 ? prev.receptionists : (decryptedFromMongo.receptionists || [])
                        }));

                        // 🚀 ADDED: Check PIN presence during fallback
                        const hasPin = await SecurityService.hasManagerPin();
                        if (hasPin) {
                            setSettings(prev => ({ 
                                ...prev, 
                                security: { ...(prev.security || {}), managerPin: prev.security?.managerPin || 'RECLAIMED' } 
                            }));
                        }

                        if (dbSettings.onboardingCompletedAt) setDbProfileComplete(true);
                        setIsDecryptionReady(true); // ✅
                        console.log('[Settings] Loaded from MongoDB:', JSON.stringify(dbSettings)?.slice(0, 200));
                        return;
                    }
                } catch (e) {
                    console.warn('[Settings] MongoDB fetch failed:', e.message);
                }
                repairSettingsFromDrive();
            }
            // Even if nothing loaded, mark ready so UI doesn't freeze on skeleton state
            setIsDecryptionReady(true);
            const dirty = await AsyncStorage.getItem('settings_dirty');
            if (dirty === 'true') setIsSettingsDirty(true);
        } catch (error) {
            setIsDecryptionReady(true); // failsafe — never leave UI stuck on skeleton
            console.error('Failed to load settings', error);
        }
    }, [settingsKey, user?.email, processSensitiveFields, isConnected, repairSettingsFromDrive]);

    const loadSyncTime = React.useCallback(async () => {
        const time = await AsyncStorage.getItem('last_synced_timestamp');
        if (time) setLastEventSyncTime(time);
    }, []);

    const syncAllData = React.useCallback(async (isManual = true) => {
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
                    // 🚀 RETRY REFINEMENT: Include all settings including bankDetails when retrying cloud sync
                    const { _id, __v, createdAt, updatedAt, ...cleanSettings } = currentSettings;
                    try {
                        await services.settings.updateSettings(cleanSettings);
                        await AsyncStorage.setItem('settings_dirty', 'false');
                        setIsSettingsDirty(false);
                    } catch (e) {
                        console.warn('[Sync] Settings retry failed:', e.message);
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
    }, [checkQueueStatus, settingsKey, user]);

    // Helper function to generate a local access token
    const generateLocalAccessToken = React.useCallback(async () => {
        if (!user?.email) return;
        const tokenKey = `local_access_token_${user.email.replace(/[@.]/g, '_')}`;
        const token = {
            userId: user.email,
            isValid: true,
            timestamp: Date.now(),
        };
        await AsyncStorage.setItem(tokenKey, JSON.stringify(token));
        setIsTokenReady(true);
        console.log('[Settings] Local Access Token generated.');
    }, [user?.email]);

    // Helper function to invalidate the local access token
    const invalidateLocalAccessToken = React.useCallback(async () => {
        if (!user?.email) return;
        const tokenKey = `local_access_token_${user.email.replace(/[@.]/g, '_')}`;
        await AsyncStorage.removeItem(tokenKey);
        setIsTokenReady(false);
        console.log('[Settings] Local Access Token invalidated.');
    }, [user?.email]);

    // 🚀 PERFORMANCE FIX: Optimized Lazy Security Pre-warm
    // We use InteractionManager to wait for navigation/animations to finish
    // and then perform heavy PBKDF2 operations in a non-blocking way.
    useEffect(() => {
        if (!user?.email) return;

        let interactionTask = null;
        
        const performPrewarm = async () => {
            // Wait for UI to be completely idle
            interactionTask = require('react-native').InteractionManager.runAfterInteractions(async () => {
                // Extra grace period to ensure the user has settled into the target page
                await new Promise(r => setTimeout(r, 8000));
                
                console.log('[Settings] Starting lazy security pre-warm...');
                
                const { prewarmEncryptionKeys, getDriveEncSalt, deriveEncryptionKey } = require('../services/googleDriveservices');
                
                // 1. Pre-warm all keys (yields internally)
                await prewarmEncryptionKeys(user.email);

                // 2. Get the specific key we need for local refinement
                const salt = await getDriveEncSalt();
                const key = deriveEncryptionKey(user.email, salt);
                
                // 3. Yield once more before updating state (prevents double-tap freeze)
                await new Promise(r => setTimeout(r, 100));

                setStrongKey(key);

                // 4. Perform settings refinement in a separate step
                setSettings(prev => {
                    const performRefinement = async () => {
                        const refined = await processSensitiveFields(prev, user?.email, 'decrypt', key);
                        setSettings(refined);
                        setIsDecryptionReady(true);
                    };
                    performRefinement();
                    return prev;
                });
                
                console.log('[Settings] Security refinement complete.');
            });
        };

        performPrewarm();

        return () => {
            if (interactionTask) interactionTask.cancel();
        };
    }, [user?.email, processSensitiveFields]);

    useEffect(() => {
        setEstimatedUploadTime(queueLength * 2);
    }, [queueLength]);

    useEffect(() => {
        if (isConnected && wasOfflinePreviously) {
            (async () => {
                const { SyncService } = require('../services/OneWaySyncService');
                const len = await SyncService.getPendingQueueLength();
                if (len > 0) {
                    showToast(`Cloud Restored: Syncing ${len} offline items...`, 'info');
                    try {
                        await SyncService.retryQueue();
                        await checkQueueStatus();
                        showToast("Sync Successful: All offline bills backed up to Drive!", 'success');
                    } catch (e) {
                        showToast("Background sync encountered an error.", 'error');
                    }
                }
                setWasOffline(false);
            })();
        }
    }, [isConnected, wasOfflinePreviously, checkQueueStatus, showToast]);

    const syncSettingsWithCloud = React.useCallback(async () => {
        if (!user || (!user.id && !user.email)) return;
        try {
            const response = await services.settings.getSettings();
            const body = response?.data || response;
            const dbSettings = unwrapSettings(body);
            if (dbSettings) {
                console.log("📡 [BACKEND] RAW Cloud Data:", JSON.stringify(dbSettings));
                if (dbSettings.onboardingCompletedAt) setDbProfileComplete(true);

                let activeStrongKey = null;
                if (user?.email) {
                    const salt = await getDriveEncSalt();
                    activeStrongKey = deriveEncryptionKey(user.email, salt);
                }
                const decrypted = await processSensitiveFields(dbSettings, user?.email, 'decrypt', activeStrongKey);
                
                logDecryptedSettings(decrypted, 'Cloud Sync');

                setSettings(prev => {
                    const updated = { 
                        ...prev, 
                        ...decrypted,
                        store: { ...(prev.store || {}), ...(decrypted.store || {}) },
                        bankDetails: { ...(prev.bankDetails || {}), ...(decrypted.bankDetails || {}) },
                        // 🚀 PROTECTION: Deep merge user profile details to prevent wiping "Full Name" 
                        // if the server only returns specific fields (like email).
                        user: { ...(prev.user || {}), ...(decrypted.user || {}) },
                        // 🚀 PROTECTION: Only overwrite receptionists if server returns a NON-EMPTY array.
                        // This prevents MongoDB (which doesn't store staff for security) from wiping the vault data.
                        receptionists: (decrypted.receptionists && decrypted.receptionists.length > 0) 
                            ? decrypted.receptionists 
                            : (prev.receptionists && prev.receptionists.length > 0 ? prev.receptionists : (decrypted.receptionists || [])),
                        security: {
                            ...(prev.security || {}),
                            ...(decrypted.security || {}),
                            managerPin: (decrypted.security?.managerPin) 
                                ? decrypted.security.managerPin 
                                : (prev.security?.managerPin || null)
                        }
                    };
                    (async () => {
                        const toSave = await processSensitiveFields(updated, user?.email, 'encrypt', activeStrongKey);
                        AsyncStorage.setItem(settingsKey, JSON.stringify(toSave));
                    })();
                    return updated;
                });
                return true;
            }
        } catch (e) {
            console.warn('[Settings] Cloud sync failed:', e.message);
        }
        return false;
    }, [user, settingsKey, processSensitiveFields]);

    const startBackgroundServices = React.useCallback(async (hasUnlockedUI, isFreshLogin = false) => {
        // Fix: allow email-login users (no user.id)
        if (!user || (!user.id && !user.email)) return;

        // RUN INTENSIVE CLOUD OPS IN BACKGROUND
        (async () => {
            try {
                // Remove the login flag since Stage 3 logic already used it
                await AsyncStorage.removeItem('just_logged_in');

                const verifyReady = async () => {
                    await new Promise(resolve =>
                        require('react-native').InteractionManager.runAfterInteractions(resolve)
                    );
                    if (hasUnlockedUI) {
                        await new Promise(r => setTimeout(r, 1500));
                    }
                    // Since Stage 3 already did a sync, we just ensure the token is ready
                    // as a fallback if it wasn't done already.
                    await generateLocalAccessToken();
                };
                verifyReady();
            } catch (e) { }

            // DEFER ALL BACKGROUND METADATA SCRAPING
            setTimeout(async () => {
                // Now sync with MongoDB settings
                await syncSettingsWithCloud();
            }, hasUnlockedUI ? 3000 : 500);
        })();
    }, [user, generateLocalAccessToken, syncSettingsWithCloud]);

    useEffect(() => {
        // 🚀 CRITICAL: When user is null (logout), ensure loading is false so navigation can redirect to login
        if (!user) {
            setLoading(false);
            return;
        }

        if (user) {
            const initializeSettings = async () => {
                if (!user?.email) {
                    setLoading(false);
                    return;
                }

                // 🚀 PREVENT RE-INITIALIZATION: Only start if not already loading
                if (loading && settings?.store?.name) return;

                setLoading(true);
                setInitStage(1);
                console.log('[Settings] Standard initialization flow...');

                // ── HARD FAILSAFE TIMEOUT ──
                // No background operation is allowed to keep the app blocked indefinitely.
                // Force-unlock navigation after 15 seconds.
                const forceUnlockTimer = setTimeout(() => {
                    setInitStage(4);
                    setLoading(false);
                    console.warn('[Settings] Hard failsafe triggered — force-unlocking navigation after 15s.');
                }, 15000);

                try {
                    setInitStage(2);
                    await loadSettings();
                    
                    setInitStage(3);
                    await Promise.all([loadSyncTime(), checkQueueStatus()]);
                    
                    const justLoggedIn = await AsyncStorage.getItem('just_logged_in');
                    const isFreshLogin = justLoggedIn === 'true';
                    // 🚀 PERFORMANCE FIX: Limit UI-blocking sync to 6.5 seconds.
                    // If the cloud sync takes longer (due to heavy history), we move it to the background
                    // to keep the user experience snappy and professional.
                    const syncTask = syncAllData(isFreshLogin);
                    await Promise.race([
                        syncTask,
                        new Promise(resolve => setTimeout(resolve, 6500))
                    ]).catch(e => console.warn('[Sync] Initial fetch error/timeout:', e.message));

                    // 🛡️ SECURITY FIX: Removed "hasLocalData" shortcut as it caused new users to skip onboarding.
                    // Onboarding is now strictly controlled by the 'onboardingCompletedAt' profile field.
                    let hasUnlockedUI = false;

                    setInitStage(4); // 🟢 COMPULSORY move to Stage 4 after fetch

                    // Fire reduced background services — most sync work is now done
                    startBackgroundServices(hasUnlockedUI, isFreshLogin);
                } catch (err) {
                    console.error('[SettingsContext] Initialization Error:', err.message);
                } finally {
                    // Cancel the hard failsafe
                    clearTimeout(forceUnlockTimer);
                    // Defer loading completion, let DataSearchLoader invoke finishLoading via onReady callback.
                    // Keep a 3.5s failsafe here just in case WebView fails to mount or send message.
                    setTimeout(() => setLoading(false), 3500);
                }
            };

            initializeSettings();
        }
    // Depend on BOTH user.id (Google OAuth) AND user.email (email-login users)
    // so that initialization fires correctly for both login methods.
    }, [user?.id, user?.email]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const updateSettings = React.useCallback(async (section, updates) => {
        setLastLocalUpdateAt(Date.now());

        // 🚀 ATOMIC UPDATE: Use functional state to avoid stale closure race conditions
        setSettings(prevSettings => {
            const newSettings = { 
                ...prevSettings, 
                [section]: { ...(prevSettings[section] || {}), ...updates },
                // Explicitly preserve receptionists across section-level updates
                receptionists: prevSettings.receptionists || []
            };

            // Side-effects (Background persistence)
            (async () => {
                try {
                    // Persist locally
                    const toPersist = await processSensitiveFields(newSettings, user?.email, 'encrypt', strongKey);
                    AsyncStorage.setItem(settingsKey, JSON.stringify(toPersist));

                    // Security Vault Side-effect (Manager PIN)
                    if (section === 'security' && updates.managerPin) {
                        await SecurityService.saveVault(user, updates.managerPin, newSettings.receptionists);
                    }

                    // Cloudinary Branding Side-effect
                    if (section === 'store' && updates.logo && !updates.logo.startsWith('http')) {
                        const cloudLogo = await uploadLogoToCloud(updates.logo);
                        if (cloudLogo !== updates.logo) {
                            const settingsWithCloudLogo = { ...newSettings, store: { ...newSettings.store, logo: cloudLogo } };
                            setSettings(settingsWithCloudLogo);
                            AsyncStorage.setItem(settingsKey, JSON.stringify(settingsWithCloudLogo));
                        }
                    }

                    // MongoDB/Drive Cloud Sync
                    const portable = await ensurePortableSettings(newSettings);
                    const { _id, __v, createdAt, updatedAt, ...cleanToCloud } = portable;

                    try {
                        const { services } = require('../services/api');
                        await services.settings.updateSettings(cleanToCloud);
                        AsyncStorage.setItem('settings_dirty', 'false');
                        setIsSettingsDirty(false);
                    } catch (err) {
                        AsyncStorage.setItem('settings_dirty', 'true');
                        setIsSettingsDirty(true);
                    }

                    if (user?.id) {
                        const { syncSettingsToDrive } = require('../services/googleDriveservices');
                        const encryptedForDrive = await processSensitiveFields(portable, user?.email, 'encrypt');
                        syncSettingsToDrive(user, encryptedForDrive).catch(() => {});
                    }
                } catch (e) {
                    console.error('[SettingsContext] Post-update failed:', e);
                }
            })();

            return newSettings;
        });
    }, [processSensitiveFields, strongKey, user, settingsKey]);

    const saveFullSettings = React.useCallback(async (fullSettings) => {
        setIsUploading(true);
        try {
            const updated = { ...fullSettings, lastUpdatedAt: new Date().toISOString() };
            setSettings(updated);

            let activeStrongKey = null;
            if (user?.email) {
                const salt = await getDriveEncSalt();
                activeStrongKey = deriveEncryptionKey(user.email, salt);
            }

            const toPersist = await processSensitiveFields(updated, user?.email, 'encrypt', activeStrongKey);
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

            if (user && (user.id || user.email)) {
                const portable = await ensurePortableSettings(finalToSync);
                // 🚀 FIX: For MongoDB, send DECRYPTED data (plain text)
                // Only encrypt for Google Drive storage
                const { _id, __v, createdAt, updatedAt, ...cleanToCloud } = portable;

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
                    const encryptedForDrive = await processSensitiveFields(portable, user?.email, 'encrypt');
                    await syncSettingsToDrive(user, encryptedForDrive);
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
    }, [processSensitiveFields, settingsKey, user]);

    const forceResync = React.useCallback(async () => {
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
    }, [checkQueueStatus, syncAllData]);

    const repairSync = React.useCallback(async () => {
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
    }, [syncAllData]);

    const deepRepair = React.useCallback(async () => {
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
    }, [user]);

    const nuclearWipe = React.useCallback(async () => {
        setLoading(true);
        try {
            const { clearDatabase } = require('../services/database');
            // 1. Clear SQLite Database
            await clearDatabase();

            // 2. Clear All AsyncStorage
            await AsyncStorage.clear();

            // 3. Clear Secure Store via Logout (implicit in context but let's be explicit if needed)
            // We return true so the UI can trigger the final logout redirect
            return true;
        } catch (error) {
            console.error("Nuclear Wipe Failed:", error);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    const resetOnboarding = React.useCallback(async () => {
        try {
            const updated = { ...settings, onboardingCompletedAt: null };
            setSettings(updated);
            await AsyncStorage.setItem(settingsKey, JSON.stringify(updated));
            Alert.alert("Reset Complete", "Onboarding status has been reset.");
            return true;
        } catch (error) { return false; }
    }, [settings, settingsKey]);

    const addReceptionist = React.useCallback(async (name) => {
        const newReceptionist = { id: `RECEP-${Date.now()}`, name, is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        
        setSettings(prev => {
            const updatedReceptionists = [...(prev.receptionists || []), newReceptionist];
            const updated = { ...prev, receptionists: updatedReceptionists, lastUpdatedAt: new Date().toISOString() };
            
            // Side effects
            (async () => {
                try { await SecurityService.saveVault(user, null, updatedReceptionists); } catch (e) { }
                try {
                    const { db } = require('../services/database');
                    const { SyncService, EventTypes } = require('../services/OneWaySyncService');
                    await db.runAsync('INSERT INTO receptionists (id, name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [newReceptionist.id, newReceptionist.name, newReceptionist.is_active, newReceptionist.created_at, newReceptionist.updated_at]);
                    SyncService.createAndUploadEvent(EventTypes.RECEPTIONIST_CREATED, newReceptionist);
                } catch (e) { }
            })();
            
            return updated;
        });
    }, [user]);

    const updateReceptionist = React.useCallback(async (id, name) => {
        const updatedAt = new Date().toISOString();
        setSettings(prev => {
            const updatedReceptionists = (prev.receptionists || []).map(r => r.id === id ? { ...r, name, updated_at: updatedAt } : r);
            const updated = { ...prev, receptionists: updatedReceptionists, lastUpdatedAt: updatedAt };
            
            (async () => {
                try { await SecurityService.saveVault(user, null, updatedReceptionists); } catch (e) { }
                try {
                    const { db } = require('../services/database');
                    const { SyncService, EventTypes } = require('../services/OneWaySyncService');
                    await db.runAsync('UPDATE receptionists SET name = ?, updated_at = ? WHERE id = ?', [name, updatedAt, id]);
                    SyncService.createAndUploadEvent(EventTypes.RECEPTIONIST_UPDATED, { id, name, updated_at: updatedAt });
                } catch (e) { }
            })();
            
            return updated;
        });
    }, [user]);

    const toggleReceptionistActive = React.useCallback(async (id, isActive) => {
        const updatedAt = new Date().toISOString();
        const activeStatus = isActive ? 1 : 0;
        setSettings(prev => {
            const updatedReceptionists = (prev.receptionists || []).map(r => r.id === id ? { ...r, is_active: activeStatus, updated_at: updatedAt } : r);
            const updated = { ...prev, receptionists: updatedReceptionists, lastUpdatedAt: updatedAt };

            (async () => {
                try { await SecurityService.saveVault(user, null, updatedReceptionists); } catch (e) { }
                try {
                    const { db } = require('../services/database');
                    const { SyncService, EventTypes } = require('../services/OneWaySyncService');
                    await db.runAsync('UPDATE receptionists SET is_active = ?, updated_at = ? WHERE id = ?', [activeStatus, updatedAt, id]);
                    SyncService.createAndUploadEvent(EventTypes.RECEPTIONIST_UPDATED, { id, is_active: activeStatus, updated_at: updatedAt });
                } catch (e) { }
            })();

            return updated;
        });
    }, [user]);

    const deleteReceptionist = React.useCallback(async (id) => {
        setSettings(prev => {
            const updatedReceptionists = (prev.receptionists || []).filter(r => r.id !== id);
            const updated = { ...prev, receptionists: updatedReceptionists, lastUpdatedAt: new Date().toISOString() };

            (async () => {
                try { await SecurityService.saveVault(user, null, updatedReceptionists); } catch (e) { }
                try {
                    const { db } = require('../services/database');
                    const { SyncService, EventTypes } = require('../services/OneWaySyncService');
                    await db.runAsync('DELETE FROM receptionists WHERE id = ?', [id]);
                    SyncService.createAndUploadEvent(EventTypes.RECEPTIONIST_DELETED, { id });
                } catch (e) { }
            })();

            return updated;
        });
    }, [user]);

    const syncToCloud = React.useCallback(async () => {
        if (!user || (!user.id && !user.email)) { return false; }
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
    }, [user, settings]);

    const backupDataToCloud = React.useCallback(async (onLog) => {
        if (!user || (!user.id && !user.email)) { return false; }
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
    }, [user, showToast]);

    // Stable context value (Settings and Actions) — Dependencies strictly minimized!
    const settingsValue = React.useMemo(() => ({
        settings,
        updateSettings,
        saveFullSettings,
        resetOnboarding,
        syncAllData,
        syncSettingsWithCloud,
        syncToCloud,
        backupDataToCloud,
        forceResync,
        repairSync,
        deepRepair,
        addReceptionist,
        updateReceptionist,
        toggleReceptionistActive,
        deleteReceptionist,
        nuclearWipe,
        loading,
        finishLoading,
        initStage,
        dbProfileComplete,
        isConnected,
        // Fix #3: expose decryption readiness so UI can gate on it
        isDecryptionReady,
        isTokenReady,
        verifyManagerPin: async (pin) => await SecurityService.verifyPin(pin, user)
    }), [
        settings, loading, dbProfileComplete, isConnected, user?.id,
        isDecryptionReady, isTokenReady, initStage, finishLoading,
        updateSettings, saveFullSettings, resetOnboarding, syncAllData,
        syncSettingsWithCloud, syncToCloud, backupDataToCloud, forceResync, 
        repairSync, deepRepair, addReceptionist, updateReceptionist, 
        toggleReceptionistActive, deleteReceptionist, nuclearWipe
    ]);

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
    }), [
        lastEventSyncTime, syncStatus, queueLength, isUploading,
        isLogoUploading, syncStats, estimatedUploadTime, checkQueueStatus
    ]);

    return (
        <SettingsContext.Provider value={React.useMemo(() => ({ ...settingsValue, ...statusValue }), [settingsValue, statusValue])}>
            {children}
        </SettingsContext.Provider>
    );
};

