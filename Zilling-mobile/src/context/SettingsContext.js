import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { triggerAutoSave } from '../services/autosaveService';
import services, { API } from '../services/api';

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children, user }) => { // Accept user prop
    const [settings, setSettings] = useState({
        // ... (state initialization remains same)
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
            fssai: ''
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
            paperSize: '80mm',
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
            selectedPrinter: null
        },
        defaults: {
            language: 'en',
            currency: 'INR',
            autoSave: false
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
    const [lastEventSyncTime, setLastEventSyncTime] = useState(null);
    const [isSettingsDirty, setIsSettingsDirty] = useState(false); // New: Tracks if MongoDB update is pending

    const syncAllData = async (isManual = true) => {
        if (isManual) setLoading(true);
        try {
            const { SyncService } = require('../services/OneWaySyncService');
            // 1. Retry pending uploads
            await SyncService.retryQueue();
            // 2. Fetch and apply new events (Drive Sync)
            await SyncService.syncDown();

            // 3. Refresh Settings from MongoDB
            try {
                const settingsRes = await services.settings.getSettings();
                if (settingsRes.data) {
                    setSettings(prev => {
                        const merged = { ...prev, ...settingsRes.data };
                        AsyncStorage.setItem('app_settings', JSON.stringify(merged));
                        return merged;
                    });
                }
            } catch (apiErr) {
                console.log('[Sync] MongoDB Settings refresh skipped:', apiErr.message);
            }

            // 4. Retry Onboarding Sync if dirty
            const dirtyFlag = await AsyncStorage.getItem('settings_dirty');
            if (dirtyFlag === 'true') {
                console.log('[Sync] Retrying pending onboarding upload to MongoDB...');
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
                        console.log('[Sync] Pending onboarding uploaded successfully.');
                    } catch (e) {
                        console.warn('[Sync] Onboarding retry failed (still offline?):', e.message);
                    }
                }
            }

            // Refresh time
            const time = await AsyncStorage.getItem('last_synced_timestamp');
            if (time) setLastEventSyncTime(time);

            return true;
        } catch (error) {
            console.error('Manual Sync Error:', error);
            return false;
        } finally {
            if (isManual) setLoading(false);
        }
    };

    useEffect(() => {
        loadSettings();
        loadSyncTime();

        // [Auto-Sync] Start background sync on mount
        const initAutoSync = async () => {
            // Wait a bit for app to settle
            setTimeout(() => {
                syncAllData(false); // Silent sync
            }, 5000);
        };
        initAutoSync();

        // [Auto-Sync] Schedule periodic sync (every 1 minute)
        const intervalId = setInterval(() => {
            console.log('[AutoSync] Triggering periodic sync...');
            syncAllData(false);
        }, 1 * 60 * 1000);

        return () => clearInterval(intervalId);
    }, []);

    const loadSyncTime = async () => {
        const time = await AsyncStorage.getItem('last_synced_timestamp');
        if (time) setLastEventSyncTime(time);
    };

    const loadSettings = async () => {
        try {
            // 1. Load from Local Storage (Drive/Offline)
            const saved = await AsyncStorage.getItem('app_settings');
            if (saved) {
                setSettings(JSON.parse(saved));
            }

            const dirty = await AsyncStorage.getItem('settings_dirty');
            if (dirty === 'true') setIsSettingsDirty(true);

            // 2. Load from MongoDB (API) & Sync
            try {
                const response = await services.settings.getSettings();
                if (response.data) {
                    console.log('Settings synced from MongoDB');
                    setSettings(prev => {
                        // Merge remote settings with local defaults/overrides
                        // We prioritize remote data for specific sections like 'store'
                        const merged = { ...prev, ...response.data };
                        AsyncStorage.setItem('app_settings', JSON.stringify(merged));
                        return merged;
                    });
                }
            } catch (apiError) {
                console.log('MongoDB Settings Sync skipped (Offline/Auth):', apiError.message);
            }
        } catch (error) {
            console.error('Failed to load settings', error);
        } finally {
            setLoading(false);
        }
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
            // Save to Local Drive
            AsyncStorage.setItem('app_settings', JSON.stringify(newSettings));

            // Save to MongoDB (Only User & Store details)
            const onboardingData = {
                user: newSettings.user,
                store: newSettings.store,
                userEmail: user?.email || newSettings.user?.email,
                onboardingCompletedAt: newSettings.onboardingCompletedAt
            };
            services.settings.updateSettings(onboardingData).then(() => {
                AsyncStorage.setItem('settings_dirty', 'false');
                setIsSettingsDirty(false);
            }).catch(err => {
                console.log('Background Sync to MongoDB failed (Keep Dirty):', err.message);
                AsyncStorage.setItem('settings_dirty', 'true');
                setIsSettingsDirty(true);
            });

            return newSettings;
        });
    };

    const saveFullSettings = async (fullSettings) => {
        try {
            const updated = { ...fullSettings, lastUpdatedAt: new Date() };

            // 1. Optimistic UI Update
            setSettings(updated);

            // 2. Persist to Local Storage (Fast & Critical)
            await AsyncStorage.setItem('app_settings', JSON.stringify(updated));

            // 3. Trigger Background Processes (Non-blocking)
            // These run independently so the UI doesn't freeze waiting for network

            // Background: MongoDB Sync
            services.settings.updateSettings(updated)
                .then(() => console.log('Background: Settings saved to MongoDB'))
                .catch(err => console.warn('Background: MongoDB Sync Warning:', err.message));

            // Background: File System AutoSave
            setTimeout(() => {
                triggerAutoSave().catch(e => console.warn('AutoSave Warning:', e));
            }, 100);

            // Background: Google Drive Sync
            if (user && user.id) {
                const { syncSettingsToDrive } = require('../services/googleDriveservices');
                syncSettingsToDrive(user, updated)
                    .then(success => {
                        if (success) console.log('Background: Drive Sync Success');
                        else console.warn('Background: Drive Sync Failed');
                    })
                    .catch(err => console.error('Background: Drive Sync Error:', err));
            }

            // Return immediately to allow UI to show "Success"
            return true;
        } catch (error) {
            console.error('Failed to save full settings locally', error);
            throw error;
        }
    };

    const forceResync = async () => {
        setLoading(true);
        try {
            const { SyncService } = require('../services/OneWaySyncService');
            console.log('[SettingsContext] Forcing Re-sync...');
            await SyncService.resetSyncState();
            await syncAllData(false); // Reuse existing sync logic
            return true;
        } catch (error) {
            console.error('Force Resync Error:', error);
            return false;
        } finally {
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

    return (
        <SettingsContext.Provider value={{
            settings,
            updateSettings,
            saveFullSettings,
            resetOnboarding,
            syncAllData,
            forceResync,
            lastEventSyncTime,
            loading
        }}>
            {children}
        </SettingsContext.Provider>
    );
};
