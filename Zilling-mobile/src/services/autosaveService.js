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
    const settingsStr = await AsyncStorage.getItem('app_settings');
    if (!settingsStr) return;

    const settings = JSON.parse(settingsStr);
    if (!settings.defaults?.autoSave) {
      console.log("[AutoSave] Disabled in settings.");
      return;
    }

    console.log("[AutoSave] Running background sync to local files...");

    // 2. Fetch all data from SQLite (it's now async because it pulls settings too)
    const allData = await fetchAllTableData();

    // 3. Sync to device folders using BackupServices (which handles SAF and file matching)
    // We run this without 'await' in contexts if we want it to be non-blocking,
    // but here we export it as a standard async function.
    await exportToDeviceFolders(allData, null, { isAutoSave: true });

    console.log("[AutoSave] Sync complete.");
  } catch (error) {
    console.error("[AutoSave] Failed:", error);
  }
};