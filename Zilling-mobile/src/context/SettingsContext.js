import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

import { triggerAutoSave } from '../services/autosaveService';
import services, { API } from '../services/api';
import { useNetwork } from './NetworkContext';
import { useToast } from './ToastContext';

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
            termsAndConditions: '1. Goods once sold will not be taken back.',
            conditionsText: '',
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
    const [dbProfileComplete, setDbProfileComplete] = useState(false); // Tracks if profile exists in MongoDB
    const [isLogoUploading, setIsLogoUploading] = useState(false);

    // Network / Auto-Sync States
    const { isConnected, wasOfflinePreviously, setWasOffline } = useNetwork();
    const { showToast } = useToast();
    const [estimatedUploadTime, setEstimatedUploadTime] = useState(0);

    useEffect(() => {
        // Roughly 2 seconds per queued item
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

    const loadSettings = async () => {
        try {
            const saved = await AsyncStorage.getItem('app_settings');
            if (saved) {
                setSettings(JSON.parse(saved));
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

            // 0. Update Queue Count
            setSyncStatus('Checking pending uploads...');
            let qLen = await checkQueueStatus();

            // 1. Retry pending uploads
            if (qLen > 0) {
                setSyncStatus(`Pushing ${qLen} pending changes...`);
                await SyncService.retryQueue();
                qLen = await checkQueueStatus(); // Re-check after retry
            }

            // 2. Fetch and apply new events (Drive Sync)
            setSyncStatus('Checking for cloud updates...');
            await SyncService.syncDown((msg, prog, stats) => {
                setSyncStatus(msg);
                if (stats) setSyncStats(stats);
            });

            // 3. Retry Onboarding Sync if dirty (MongoDB)
            const dirtyFlag = await AsyncStorage.getItem('settings_dirty');
            if (dirtyFlag === 'true') {
                setSyncStatus('Finalizing cloud setup...');
                const saved = await AsyncStorage.getItem('app_settings');
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

            // 1. Instantly load local data
            await loadSettings();
            await loadSyncTime();
            await checkQueueStatus();

            let hasUnlockedUI = false;

            if (user && user.id) {
                // OFFLINE-FIRST: Unblock the UI immediately if local profile is complete
                try {
                    const saved = await AsyncStorage.getItem('app_settings');
                    if (saved) {
                        const local = JSON.parse(saved);
                        if (local.onboardingCompletedAt || !!local.store?.name) {
                            console.log('[SettingsContext] Local settings verified. Unlocking UI instantly for Offline-First.');
                            setDbProfileComplete(!!local.onboardingCompletedAt);
                            setLoading(false);
                            hasUnlockedUI = true;
                        }
                    }
                } catch (e) {
                    console.log('Error verifying offline settings:', e);
                }

                // 2. Run Network Syncs (will occur in background if UI was already unlocked)
                (async () => {
                    console.log('[SettingsContext] Beginning background sync process...');
                    let isFreshLogin = false;
                    try {
                        const justLoggedIn = await AsyncStorage.getItem('just_logged_in');
                        if (justLoggedIn === 'true') {
                            isFreshLogin = true;
                            console.log('[SettingsContext] Skipping syncAllData — user just completed fresh login sync.');
                            await AsyncStorage.removeItem('just_logged_in'); // Consume the flag

                            // Only show countdown if the UI is still locked
                            if (!hasUnlockedUI) {
                                for (let i = 3; i > 0; i--) {
                                    setSyncStatus(`Aligning Your Data... (Est. time: ${i}s)`);
                                    await new Promise(r => setTimeout(r, 1000));
                                }
                                setSyncStatus('Data was aligned. Opening app...');
                                await new Promise(r => setTimeout(r, 600)); // Give the success checkmark time to show
                            }
                        } else {
                            await syncAllData(false); // Does syncDown in the background
                        }
                    } catch (e) {
                        console.warn('[SettingsContext] Background sync check failed:', e.message);
                    }

                    // STEP 1: Fetch store/bank/tax/invoice settings from Google Drive
                    let driveDataLoaded = false;
                    try {
                        if (isFreshLogin) {
                            console.log('[SettingsContext] Skipping Drive settings fetch - already loaded during auth.');
                            driveDataLoaded = true; // Kept true so DB data doesn't overwrite it
                        } else {
                            console.log('[SettingsContext] Fetching settings from Drive in background...');
                            const { fetchSettingsFromDrive } = require('../services/googleDriveservices');
                            const driveResult = await fetchSettingsFromDrive(user);
                            if (driveResult) {
                                driveDataLoaded = true;
                                setSettings(prev => {
                                    return { ...prev, ...driveResult };
                                });
                                console.log('[SettingsContext] ✅ Background Drive settings loaded');
                            }
                        }
                    } catch (driveErr) {
                        console.warn('[SettingsContext] Background Drive settings fetch failed:', driveErr.message);
                    }

                    // STEP 2: Check DB for profile existence + fetch LOGO
                    try {
                        console.log('[SettingsContext] Checking database for profile & logo in background...');
                        const response = await services.settings.getSettings();
                        const dbSettings = response?.data || response;

                        if (dbSettings && dbSettings.onboardingCompletedAt) {
                            console.log('[SettingsContext] ✅ Profile found in database');
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
                                        bankDetails: {
                                            ...prev.bankDetails,
                                            ...(dbSettings.bankDetails || {}),
                                        },
                                        tax: {
                                            ...prev.tax,
                                            ...(dbSettings.tax || {}),
                                        },
                                        invoice: {
                                            ...prev.invoice,
                                            ...(dbSettings.invoice || {}),
                                        },
                                        defaults: {
                                            ...prev.defaults,
                                            ...(dbSettings.defaults || {}),
                                        },
                                    };
                                }

                                AsyncStorage.setItem('app_settings', JSON.stringify(updated));
                                return updated;
                            });
                        } else {
                            if (!hasUnlockedUI) setDbProfileComplete(false);
                        }
                    } catch (dbErr) {
                        console.warn('[SettingsContext] DB profile check failed:', dbErr.message);
                        if (!hasUnlockedUI) {
                            const saved = await AsyncStorage.getItem('app_settings');
                            if (saved) {
                                const local = JSON.parse(saved);
                                setDbProfileComplete(!!local.onboardingCompletedAt);
                            } else {
                                setDbProfileComplete(false);
                            }
                        }
                    }

                    // Ensure loading is set to false exactly once if it hasn't been already
                    if (!hasUnlockedUI) {
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
                // Base64 from ImagePicker
                const parts = logoData.split(',');
                const mime = parts[0].match(/:(.*?);/)[1];
                const extension = mime.split('/')[1];

                // We'll use a specific name for the logo
                fileObject = {
                    uri: logoData,
                    name: `store_logo.${extension}`,
                    type: mime,
                };
            } else if (logoData.startsWith('file://')) {
                const fileName = logoData.split('/').pop();
                const ext = fileName.split('.').pop().toLowerCase();
                fileObject = {
                    uri: logoData,
                    name: fileName,
                    type: ext === 'png' ? 'image/png' : 'image/jpeg',
                };
            } else {
                return logoData;
            }

            const response = await services.settings.uploadLogo(fileObject);
            const cloudUrl = response?.data?.logoUrl || '';
            if (cloudUrl) {
                console.log(`[Logo] ✅ Uploaded to Cloudinary: ${cloudUrl}`);
            }
            return cloudUrl || logoData;
        } catch (err) {
            console.warn(`[Logo] ⚠️ Cloudinary upload failed: ${err.message}`);
            return logoData;
        }
    };

    const ensurePortableSettings = async (s) => {
        // If logo is already a Cloudinary/Remote URL, it's portable!
        if (s.store?.logo && s.store.logo.startsWith('http')) {
            return s;
        }

        if (s.store?.logo && s.store.logo.startsWith('file://')) {
            try {
                const base64 = await FileSystem.readAsStringAsync(s.store.logo, { encoding: 'base64' });
                const mime = s.store.logo.endsWith('.png') ? 'image/png' : 'image/jpeg';
                return {
                    ...s,
                    store: { ...s.store, logo: `data:${mime};base64,${base64}` }
                };
            } catch (e) {
                console.warn('[SettingsContext] Portability conversion failed:', e);
            }
        }
        return s;
    };

    const updateSettings = (section, updates) => {
        setSettings(prev => {
            const newSettings = {
                ...prev,
                [section]: {
                    ...prev[section],
                    ...updates
                }
            };
            AsyncStorage.setItem('app_settings', JSON.stringify(newSettings));

            (async () => {
                // Background logo upload if it's the store section and logo changed
                let finalSettings = newSettings;
                if (section === 'store' && updates.logo && !updates.logo.startsWith('http')) {
                    const cloudLogo = await uploadLogoToCloud(updates.logo);
                    if (cloudLogo !== updates.logo) {
                        finalSettings = {
                            ...newSettings,
                            store: { ...newSettings.store, logo: cloudLogo }
                        };
                        setSettings(finalSettings);
                        AsyncStorage.setItem('app_settings', JSON.stringify(finalSettings));
                    }
                }

                const portable = await ensurePortableSettings(finalSettings);
                const onboardingData = {
                    user: portable.user,
                    store: portable.store,
                    userEmail: user?.email || portable.user?.email,
                    onboardingCompletedAt: portable.onboardingCompletedAt
                };

                try {
                    await services.settings.updateSettings(onboardingData);
                    AsyncStorage.setItem('settings_dirty', 'false');
                    setIsSettingsDirty(false);
                } catch (err) {
                    console.log('Background Sync to MongoDB failed (Keep Dirty):', err.message);
                    AsyncStorage.setItem('settings_dirty', 'true');
                    setIsSettingsDirty(true);
                }

                if (user && user.id) {
                    const { syncSettingsToDrive } = require('../services/googleDriveservices');
                    syncSettingsToDrive(user, portable)
                        .then(success => console.log('Background: Drive Sync (Settings Update)', success ? 'Success' : 'Failed'))
                        .catch(err => console.error('Background: Drive Sync Error:', err));
                }
            })();

            return newSettings;
        });
    };



    const saveFullSettings = async (fullSettings) => {
        setIsUploading(true);
        try {
            const updated = { ...fullSettings, lastUpdatedAt: new Date() };

            // 1. Instant Local Update - THIS IS THE MOST IMPORTANT STEP FOR OFFLINE-FIRST
            setSettings(updated);
            await AsyncStorage.setItem('app_settings', JSON.stringify(updated));
            console.log('[SettingsContext] ✅ Local settings saved successfully (Offline-First)');

            let finalToSync = updated;

            // 2. Attempt logo upload to Cloudinary (Non-blocking if it fails)
            const logoData = updated.store?.logo;
            if (logoData && !logoData.startsWith('http')) {
                setIsLogoUploading(true);
                try {
                    const cloudUrl = await uploadLogoToCloud(logoData);
                    if (cloudUrl && cloudUrl !== logoData) {
                        finalToSync = {
                            ...updated,
                            store: { ...updated.store, logo: cloudUrl }
                        };
                        setSettings(finalToSync);
                        await AsyncStorage.setItem('app_settings', JSON.stringify(finalToSync));
                    }
                } catch (logoErr) {
                    console.log('[SettingsContext] Logo upload failed (Offline), will retry later.');
                }
                setIsLogoUploading(false);
            }

            // 3. Attempt MongoDB & Drive Sync (If offline, we just mark as dirty)
            if (user && user.id) {
                const portable = await ensurePortableSettings(finalToSync);
                const { _id, __v, createdAt, updatedAt, ...cleanPortable } = portable;

                try {
                    console.log('[SettingsContext] Attempting background cloud sync...');
                    // Try MongoDB
                    await services.settings.updateSettings(cleanPortable);
                    console.log('[SettingsContext] ✅ Cloud Sync: MongoDB updated.');
                    setDbProfileComplete(true);
                    await AsyncStorage.setItem('settings_dirty', 'false');
                    setIsSettingsDirty(false);

                    // Try Google Drive
                    const { syncSettingsToDrive } = require('../services/googleDriveservices');
                    syncSettingsToDrive(user, portable)
                        .then(() => console.log('[SettingsContext] ✅ Cloud Sync: Google Drive updated.'))
                        .catch(e => console.log('[SettingsContext] Drive sync failed (Background).'));
                } catch (networkErr) {
                    console.log('[SettingsContext] Cloud sync failed (Device is Offline). Settings marked for retry.');
                    await AsyncStorage.setItem('settings_dirty', 'true');
                    setIsSettingsDirty(true);

                    // Inform the user that it's saved locally
                    if (showToast) showToast("Offline: Saved locally. Sync pending.", "info");
                }
            }

            // 4. Trigger secondary hooks (like backups)
            setTimeout(() => {
                triggerAutoSave().catch(e => console.warn('AutoSave Warning:', e));
            }, 50);

            return true;
        } catch (error) {
            console.error('Critical failure in saveFullSettings:', error);
            setIsUploading(false);
            setIsLogoUploading(false);
            // Only throw if even the LOCAL save failed (very rare)
            throw error;
        } finally {
            setIsUploading(false);
            setIsLogoUploading(false);
        }
    };

    const forceResync = async () => {
        const currentQueueLen = await checkQueueStatus();
        if (currentQueueLen > 0) {
            Alert.alert("Cannot Re-sync Now", `You have ${currentQueueLen} items pending upload. Please wait for them to finish uploading to avoid data loss.`);
            return false;
        }

        setLoading(true);
        setSyncStatus('Resetting sync state...');
        setIsUploading(true);

        try {
            const { SyncService } = require('../services/OneWaySyncService');
            console.log('[SettingsContext] Forcing Re-sync...');
            await SyncService.resetSyncState();
            await syncAllData(false);
            return true;
        } catch (error) {
            console.error('Force Resync Error:', error);
            setSyncStatus('Error: ' + error.message);
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
            await AsyncStorage.setItem('app_settings', JSON.stringify(updated));
            Alert.alert("Reset Complete", "Onboarding status has been reset. Restart the app or navigate back to see the onboarding screen.");
            return true;
        } catch (error) {
            console.error('Failed to reset onboarding', error);
            return false;
        }
    };

    const syncToCloud = async () => {
        if (!user || !user.id) {
            Alert.alert("Cloud Backup", "Please log in with Google to enable Cloud Backup.");
            return false;
        }
        setIsUploading(true);
        try {
            const { fetchAllTableData } = require('../services/database');
            const { syncUserDataToDrive } = require('../services/googleDriveservices');

            const allData = await fetchAllTableData();
            allData.settings = [settings];

            const success = await syncUserDataToDrive(user, allData);
            return success;
        } catch (error) {
            console.error('Cloud Backup Error:', error);
            return false;
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <SettingsContext.Provider value={{
            settings,
            updateSettings,
            saveFullSettings,
            resetOnboarding,
            syncAllData,
            syncToCloud,
            forceResync,
            lastEventSyncTime,
            syncStatus,
            loading,
            queueLength,
            isUploading,
            isLogoUploading,
            checkQueueStatus,
            dbProfileComplete,
            syncStats,
            estimatedUploadTime,
            isConnected
        }}>
            {children}
        </SettingsContext.Provider>
    );
};
