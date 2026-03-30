import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SyncService } from '../services/OneWaySyncService';
import { DeviceEventEmitter } from 'react-native';

const LAST_SMART_SYNC_KEY = 'last_smart_sync_timestamp';
const SYNC_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Smart Sync Hook:
 * Automatically triggers an incremental sync in the background
 * based on a cooldown period.
 */
export const useSmartSync = (user) => {
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState(null);

    const triggerSync = useCallback(async (force = false) => {
        if (!user || isSyncing) return;

        try {
            const now = Date.now();
            const { getUserSpecificKey } = require('../utils/storageKeys');
            const userSpecificLastSyncKey = getUserSpecificKey(LAST_SMART_SYNC_KEY, user.email);
            const lastSync = await AsyncStorage.getItem(userSpecificLastSyncKey);
            const lastSyncTs = lastSync ? Number(lastSync) || 0 : 0;

            const timeDiff = now - lastSyncTs;
            const isCooldownPassed = timeDiff > SYNC_COOLDOWN_MS;

            // Only sync if forced or cooldown has passed
            if (force || isCooldownPassed) {
                console.log(`[SmartSync] Starting background sync... (Force: ${force}, Diff: ${timeDiff}ms, LastSync: ${lastSyncTs})`);
                setIsSyncing(true);
                
                const result = await SyncService.syncDown();
                
                if (result.success) {
                    await AsyncStorage.setItem(userSpecificLastSyncKey, String(now));
                    setLastSyncTime(now);
                    console.log(`[SmartSync] Successfully applied ${result.processedCount} updates.`);
                }
                
                setIsSyncing(false);
            } else {
                const minsRemaining = Math.ceil((SYNC_COOLDOWN_MS - timeDiff) / 60000);
                console.log(`[SmartSync] Skipping sync. Cooldown active (${minsRemaining}m remaining).`);
            }
        } catch (error) {
            console.error('[SmartSync] Sync failed:', error);
            setIsSyncing(false);
        }
    }, [user, isSyncing]);

    useEffect(() => {
        // Trigger on mount (with cooldown check)
        if (user) {
            triggerSync();
        }
    }, [user]);

    // Listen for manual sync requests from other parts of the app
    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('FORCE_SMART_SYNC', () => {
            triggerSync(true);
        });
        return () => subscription.remove();
    }, [triggerSync]);

    return { isSyncing, lastSyncTime, triggerSync };
};
