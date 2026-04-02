import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchAllTableData } from './database';
import { exportToDeviceFolders } from './backupservices';

/**
 * Centrally manages the Auto Save logic across all modules.
 * Instead of creating new files, it updates the existing ones in the user-selected folder.
 */
export const triggerAutoSave = async () => {
  try {
    // 1. Check if Auto Save is enabled in settings
    const { getActiveSettingsKey } = require('../utils/storageKeys');
    const settingsKey = await getActiveSettingsKey();
    const settingsStr = await AsyncStorage.getItem(settingsKey);
    if (!settingsStr) return;

    const settings = JSON.parse(settingsStr);
    // Auto Save is now PERMANENTLY ENABLED by request - ignoring manual toggle checks
    console.log("[AutoSave] Running mandatory background sync to local files...");

    // 2. Fetch all data from SQLite (it's now async because it pulls settings too)
    const allData = await fetchAllTableData();

    // 3. Sync to device folders using BackupServices
    await exportToDeviceFolders(allData, null, { isAutoSave: true });

    // 4. Cloud Auto-Save: Sync snapshots to Google Drive (if user is logged in)
    const userStr = await AsyncStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const { SyncService } = require('./OneWaySyncService');
        
        // 4. Intelligent Background Snapshotting
        // Only trigger a full snapshot if 15 mins have passed since the last one
        // to avoid excessive Drive API usage while maintaining high security.
        const lastSnapTimeKey = await SyncService.getUserSyncKey('last_snapshot_timestamp');
        const lastSnapStr = await AsyncStorage.getItem(lastSnapTimeKey);
        const now = Date.now();
        const diff = lastSnapStr ? (now - new Date(lastSnapStr).getTime()) : (16 * 60 * 1000); // Default to trigger if none found

        if (diff > 15 * 60 * 1000) {
            console.log("[AutoSave] Triggering 15-min interval Cloud Snapshot...");
            SyncService.createGlobalSnapshot().catch(err => console.log('Auto-Snapshot Error:', err.message));
        } else {
            console.log("[AutoSave] Recent snapshot exists, skipping cloud update.");
        }
      } catch (e) {
        console.log('User parse/snapshot error in AutoSave:', e.message);
      }
    }

    console.log("[AutoSave] Sync complete.");
  } catch (error) {
    console.error("[AutoSave] Failed:", error);
  }
};