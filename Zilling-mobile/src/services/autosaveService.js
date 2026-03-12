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
    if (!settings.defaults?.autoSave) {
      console.log("[AutoSave] Disabled in settings.");
      return;
    }

    console.log("[AutoSave] Running background sync to local files...");

    // 2. Fetch all data from SQLite (it's now async because it pulls settings too)
    const allData = await fetchAllTableData();

    // 3. Sync to device folders using BackupServices
    await exportToDeviceFolders(allData, null, { isAutoSave: true });

    // 4. Cloud Auto-Save: Sync snapshots to Google Drive (if user is logged in)
    const userStr = await AsyncStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const { syncUserDataToDrive } = require('./googleDriveservices');
        console.log("[AutoSave] Syncing snapshots to Google Drive...");
        // Non-blocking call to ensure UI fluidity
        syncUserDataToDrive(user, allData).catch(err => console.log('Drive Snap-Sync Error:', err.message));
      } catch (e) {
        console.log('User parse error in AutoSave:', e.message);
      }
    }

    console.log("[AutoSave] Sync complete.");
  } catch (error) {
    console.error("[AutoSave] Failed:", error);
  }
};