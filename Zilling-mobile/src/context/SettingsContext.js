import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

import { triggerAutoSave } from '../services/autosaveService';
import services, { API } from '../services/api';

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
            invoicePaperSize: 'A4',
            billPaperSize: '80mm',
            showLogo: true,
            showLogoInBill: true,
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
            selectedPrinter: null
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
            await loadSettings();
            await loadSyncTime();
            await checkQueueStatus();

            // Initial Sync: Blocking if user is logged in
            // This ensures the user stays on the loading screen until data is fetched
            if (user && user.id) {
                console.log('[SettingsContext] Initializing blocking sync...');
                let isFreshLogin = false;
                try {
                    const justLoggedIn = await AsyncStorage.getItem('just_logged_in');
                    if (justLoggedIn === 'true') {
                        isFreshLogin = true;
                        console.log('[SettingsContext] Skipping syncAllData — user just completed fresh login sync.');
                        await AsyncStorage.removeItem('just_logged_in'); // Consume the flag

                        // Show a smooth 3..2..1 countdown timer for user trust
                        for (let i = 3; i > 0; i--) {
                            setSyncStatus(`Aligning Your Data... (Est. time: ${i}s)`);
                            await new Promise(r => setTimeout(r, 1000));
                        }
                        setSyncStatus('Data was aligned. Opening app...');
                        await new Promise(r => setTimeout(r, 600)); // Give the success checkmark time to show
                    } else {
                        await syncAllData(false);
                    }
                } catch (e) {
                    console.warn('[SettingsContext] Initial sync failed, allowing access:', e.message);
                }

                // STEP 1: Fetch store/bank/tax/invoice settings from Google Drive
                let driveDataLoaded = false;
                try {
                    if (isFreshLogin) {
                        console.log('[SettingsContext] Skipping Drive settings fetch - already loaded during auth.');
                        driveDataLoaded = true; // Kept true so DB data doesn't overwrite it
                    } else {
                        console.log('[SettingsContext] Fetching settings from Drive...');
                        const { fetchSettingsFromDrive } = require('../services/googleDriveservices');
                        const driveResult = await fetchSettingsFromDrive(user);
                        if (driveResult) {
                            driveDataLoaded = true;
                            // Update React state with Drive-sourced settings
                            setSettings(prev => {
                                const merged = { ...prev, ...driveResult };
                                return merged;
                            });
                            console.log('[SettingsContext] ✅ Drive settings loaded (store, bank, tax, invoice)');
                        } else {
                            console.log('[SettingsContext] ⚠️ No settings found on Drive, will use DB fallback');
                        }
                    }
                } catch (driveErr) {
                    console.warn('[SettingsContext] Drive settings fetch failed:', driveErr.message);
                }

                // STEP 2: Check DB for profile existence + fetch LOGO (and full details if Drive failed)
                try {
                    console.log('[SettingsContext] Checking database for profile & logo...');
                    const response = await services.settings.getSettings();
                    const dbSettings = response?.data || response;

                    if (dbSettings && dbSettings.onboardingCompletedAt) {
                        console.log('[SettingsContext] ✅ Profile found in database');
                        setDbProfileComplete(true);

                        // Always extract LOGO from DB
                        const dbLogo = dbSettings.store?.logo || null;

                        setSettings(prev => {
                            let updated;

                            // SMART FALLBACK: Just because we "loaded" drive data, doesn't mean it wasn't empty. 
                            // We MUST verify we actually have a store name to consider it a valid Drive restore.
                            const hasValidDriveData = driveDataLoaded && !!prev.store?.name;

                            if (hasValidDriveData) {
                                // Drive data was successfully loaded AND contained real store data.
                                updated = {
                                    ...prev,
                                    onboardingCompletedAt: dbSettings.onboardingCompletedAt,
                                    store: {
                                        ...prev.store,
                                        logo: dbLogo || prev.store?.logo || null,
                                    },
                                };
                                console.log('[SettingsContext] Using Drive for details, DB for logo only');
                            } else {
                                // Drive data NOT available OR it was empty — safely fallback to MongoDB for EVERYTHING!
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
                                console.log('[SettingsContext] Drive unavailable or empty — using DB for all details');
                            }

                            AsyncStorage.setItem('app_settings', JSON.stringify(updated));
                            console.log('[SettingsContext] Logo from DB:', dbLogo?.substring(0, 40) || 'none');
                            console.log('[SettingsContext] Store name:', updated.store?.name || 'empty');
                            return updated;
                        });
                    } else {
                        console.log('[SettingsContext] ⚠️ Profile NOT found in database — will show onboarding');
                        setDbProfileComplete(false);
                    }
                } catch (dbErr) {
                    console.warn('[SettingsContext] DB profile check failed:', dbErr.message);

                    // Fallback: If DB check fails (offline?), check if we already have it locally
                    const saved = await AsyncStorage.getItem('app_settings');
                    if (saved) {
                        const local = JSON.parse(saved);
                        if (local.onboardingCompletedAt) {
                            console.log('[SettingsContext] 🌐 DB offline, but local profile complete. Allowing access.');
                            setDbProfileComplete(true);
                        } else {
                            setDbProfileComplete(false);
                        }
                    } else {
                        setDbProfileComplete(false);
                    }
                }
            } else {
                // Not logged in — default to false
                setDbProfileComplete(false);
            }

            setLoading(false);
        };

        initializeSettings();

        const intervalId = setInterval(() => {
            console.log('[AutoSync] Triggering periodic sync...');
            syncAllData(false);
        }, 1 * 60 * 1000);

        return () => clearInterval(intervalId);
    }, [user]);

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

            // 1. Instant Local Update
            setSettings(updated);
            await AsyncStorage.setItem('app_settings', JSON.stringify(updated));

            let finalToSync = updated;

            // 2. Upload logo to Cloudinary if needed (await this)
            const logoData = updated.store?.logo;
            if (logoData && !logoData.startsWith('http')) {
                setIsLogoUploading(true);
                const cloudUrl = await uploadLogoToCloud(logoData);
                if (cloudUrl && cloudUrl !== logoData) {
                    finalToSync = {
                        ...updated,
                        store: { ...updated.store, logo: cloudUrl }
                    };
                    setSettings(finalToSync);
                    await AsyncStorage.setItem('app_settings', JSON.stringify(finalToSync));
                }
                setIsLogoUploading(false);
            }

            // 3. AWAIT MongoDB save — ensures data is in DB before proceeding
            if (user && user.id) {
                const portable = await ensurePortableSettings(finalToSync);
                // Strip Mongoose metadata fields before sending
                const { _id, __v, createdAt, updatedAt, ...cleanPortable } = portable;
                console.log('[SettingsContext] Saving to MongoDB (awaiting)...');
                await services.settings.updateSettings(cleanPortable);
                console.log('[SettingsContext] ✅ MongoDB save confirmed!');

                // Mark DB profile as complete now that we've saved
                setDbProfileComplete(true);

                // 4. Fire-and-forget Drive sync (background, non-blocking)
                (async () => {
                    try {
                        const { syncSettingsToDrive } = require('../services/googleDriveservices');
                        await syncSettingsToDrive(user, portable);
                        console.log('[SettingsContext] Drive sync completed.');
                    } catch (err) {
                        console.warn('[SettingsContext] Drive sync failed (non-critical):', err.message);
                    }
                })();
            }

            // 5. Trigger secondary hooks
            setTimeout(() => {
                triggerAutoSave().catch(e => console.warn('AutoSave Warning:', e));
            }, 50);

            return true;
        } catch (error) {
            console.error('Failed to save settings:', error);
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
            syncStats
        }}>
            {children}
        </SettingsContext.Provider>
    );
};
