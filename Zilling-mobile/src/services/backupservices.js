import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncUserDataToDrive } from './googleDriveservices';

const STORAGE_KEY_BACKUP_URI = '@kwiqbilling_backup_uri';
const STORAGE_KEY_FILE_URIS = '@kwiqbilling_file_uris';

// Global lock to prevent multiple simultaneous SAF permission requests
let isRequestingPermission = false;

export const exportToDeviceFolders = async (allData, user = null, options = {}) => {
    const { isAutoSave = false } = options;
    try {
        // --- 1. Cloud Sync (Auto) ---
        if (user && user.id) {
            console.log("Starting Auto-Sync to Drive...");
            syncUserDataToDrive(user, allData).then(res => {
                if (res) console.log("Drive Sync Completed.");
            }).catch(e => console.error("Drive Sync Failed:", e));
        }

        // --- 2. Local Device Backup ---
        const tables = Object.keys(allData);
        // Standard expo-file-system supports SAF directly on Android
        const SAF = FileSystem.StorageAccessFramework;

        if (Platform.OS === 'android' && SAF) {
            console.log("Checking for saved backup folder...");
            let rootUri = await AsyncStorage.getItem(STORAGE_KEY_BACKUP_URI);
            let permissionsGranted = false;

            // Verify access
            if (rootUri) {
                try {
                    await SAF.readDirectoryAsync(rootUri);
                    permissionsGranted = true;
                } catch (e) {
                    console.warn("[Backup] Saved root URI is no longer accessible:", e.message);
                    rootUri = null;
                }
            }

            // Request access - SKIP if it's an background auto-save to avoid annoying popups
            if (!rootUri && !isAutoSave) {
                if (isRequestingPermission) {
                    console.log("[Backup] Permission request already in progress, skipping duplicate call.");
                    return { success: false, error: 'Permission request already active' };
                }

                try {
                    isRequestingPermission = true;
                    console.log("[Backup] Requesting directory permissions...");
                    const permissions = await SAF.requestDirectoryPermissionsAsync();

                    if (permissions && permissions.granted) {
                        rootUri = permissions.directoryUri;
                        await AsyncStorage.setItem(STORAGE_KEY_BACKUP_URI, rootUri);
                        permissionsGranted = true;
                        console.log("[Backup] Permission granted for:", rootUri);
                    } else {
                        console.log("[Backup] Permission denied by user.");
                        return { success: false, error: 'Permission denied' };
                    }
                } catch (safErr) {
                    console.error("[Backup] SAF Permission Error:", safErr);
                    if (safErr.message?.includes("unfinished permission request")) {
                        Alert.alert("Permission Busy", "A folder selection window is already open. Please complete or cancel it.");
                    } else if (safErr.message?.includes("User cancelled")) {
                        console.log("[Backup] User cancelled folder selection.");
                    } else {
                        throw safErr;
                    }
                    return { success: false, error: safErr.message };
                } finally {
                    isRequestingPermission = false;
                }
            }

            if (permissionsGranted && rootUri) {
                let targetUri = rootUri;

                // --- User Specific Folder Logic ---
                if (user && user.id) {
                    const folderName = `KwiqBilling-${user.id}`;
                    try {
                        const files = await SAF.readDirectoryAsync(rootUri);
                        targetUri = await SAF.makeDirectoryAsync(rootUri, folderName).catch(async (e) => {
                            const found = files.find(u => decodeURIComponent(u).endsWith(folderName));
                            if (found) return found;
                            console.warn("Could not create user folder, using root.", e);
                            return rootUri;
                        });
                        console.log("Backing up to folder:", targetUri);
                    } catch (e) {
                        console.warn("Folder creation error", e);
                    }
                }

                // Write Files
                let savedCount = 0;
                for (const tableName of tables) {
                    if (allData[tableName] && allData[tableName].length > 0) {
                        const fileName = `${tableName}.json`;
                        const dataString = JSON.stringify(allData[tableName], null, 2);

                        // Check existence in TARGET uri
                        const existingFiles = await SAF.readDirectoryAsync(targetUri);
                        let fileUri = existingFiles.find(u => decodeURIComponent(u).endsWith(fileName));

                        if (!fileUri) {
                            fileUri = await SAF.createFileAsync(targetUri, fileName, 'application/json');
                        }

                        await SAF.writeAsStringAsync(fileUri, dataString, { encoding: FileSystem.EncodingType.UTF8 });
                        savedCount++;
                    }
                }

                return { success: true, method: 'SAF', count: savedCount };
            }
        }

        // 3. Fallback: Sharing (Master Backup JSON) - ONLY show if it's a manual export, not background auto-save
        if (!isAutoSave) {
            console.log("Using Sharing Fallback...");
            const masterBackupUri = FileSystem.cacheDirectory + (user ? `KwiqBilling_Backup_${user.id}.json` : 'KwiqBilling_Master_Backup.json');
            await FileSystem.writeAsStringAsync(masterBackupUri, JSON.stringify(allData, null, 2));

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(masterBackupUri);
                return { success: true, method: 'SHARE' };
            }
        } else {
            console.log("[AutoSave] Skipping sharing fallback as background task.");
        }

        return { success: false, error: 'No storage method available or folder not selected' };
    } catch (error) {
        console.error("Critical Backup Error:", error);
        return { success: false, error: error.message };
    }
};