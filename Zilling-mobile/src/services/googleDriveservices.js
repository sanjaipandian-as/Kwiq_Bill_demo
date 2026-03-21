import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { db } from './database';
import { generateUUID } from '../utils/crypto';
import { getUserSpecificKey, SETTINGS_KEY } from '../utils/storageKeys';
import CryptoJS from 'crypto-js';
import * as SecureStore from 'expo-secure-store';

// ═══════════════════════════════════════════════════════════════
// Fix #6: Strengthen Drive encryption — derive key with PBKDF2
// instead of using raw email. Backward-compatible decryption.
// ═══════════════════════════════════════════════════════════════
const DRIVE_SALT_KEY = 'kwiq.drive_enc_salt';
const DRIVE_ENC_ITERATIONS = 20000;

// Fix #6: In-memory cache for the derived key to prevent expensive re-calculation (2800ms lag)
let _cachedDerivedKey = null;
let _cachedEmail = null;
let _cachedSalt = null;

/**
 * Get or create a per-device encryption salt for Drive backups.
 * Stored in SecureStore (hardware-backed on Android).
 */
export const getDriveEncSalt = async () => {
  try {
    let salt = await SecureStore.getItemAsync(DRIVE_SALT_KEY);
    if (!salt) {
      console.log('[Crypto] Generating new Drive encryption salt...');
      salt = CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
      await SecureStore.setItemAsync(DRIVE_SALT_KEY, salt);
    }
    return salt;
  } catch (e) {
    console.error('[Crypto] SecureStore salt access failed, falling back to unstable salt:', e.message);
    return 'kwiq.unstable.fallback.salt';
  }
};

/**
 * Derive a strong encryption key from user email + salt using PBKDF2
 */
export const deriveEncryptionKey = (email, salt) => {
  if (!email || !salt) return email;
  
  const normalizedEmail = email.toLowerCase().trim();

  // Return from cache if we already did this for the same user+salt
  if (_cachedDerivedKey && _cachedEmail === normalizedEmail && _cachedSalt === salt) {
    console.log('[Crypto] Using cached security key (0ms).');
    return _cachedDerivedKey;
  }

  console.log(`[Crypto] Deriving security key for ${normalizedEmail} (20k iterations)...`);
  const start = Date.now();
  const key = CryptoJS.PBKDF2(normalizedEmail, salt, {
    keySize: 256 / 32,
    iterations: DRIVE_ENC_ITERATIONS,
    hasher: CryptoJS.algo.SHA256
  }).toString(CryptoJS.enc.Hex);
  
  // Update cache
  _cachedDerivedKey = key;
  _cachedEmail = normalizedEmail;
  _cachedSalt = salt;

  console.log(`[Crypto] Key derived in ${Date.now() - start}ms.`);
  return key;
};

/**
 * Helper: Encrypt content using a PBKDF2-derived key from user email
 * Fix #12: Throws on failure instead of silently saving plain data
 */
export const encryptContent = (content, key) => {
  if (!content || !key) {
    throw new Error('[Crypto] Cannot encrypt: content or key is missing.');
  }
  if (!CryptoJS || !CryptoJS.AES) {
    throw new Error('[Crypto] CryptoJS not fully initialized. Encryption aborted.');
  }
  return CryptoJS.AES.encrypt(content, key).toString();
};

/**
 * Helper: Decrypt content — tries PBKDF2-derived key first, falls back to raw email
 * for backward compatibility with old backups.
 */
export const decryptContent = (encryptedText, email, keyOrSalt) => {
  if (!encryptedText || !email) return null;
  
  // Attempt 1: Try PBKDF2-derived key (new backups)
  if (keyOrSalt) {
    try {
      // If keyOrSalt is a 64-char hex string, it's already a derived key
      const derivedKey = (typeof keyOrSalt === 'string' && keyOrSalt.length === 64)
          ? keyOrSalt 
          : deriveEncryptionKey(email, keyOrSalt);
          
      const bytes = CryptoJS.AES.decrypt(encryptedText, derivedKey);
      const result = bytes.toString(CryptoJS.enc.Utf8);
      if (result && result.length > 0) return result;
    } catch (e) { /* Fall through to legacy */ }
  }

  // Attempt 2: Try raw email as key (legacy backups)
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, email);
    const result = bytes.toString(CryptoJS.enc.Utf8);
    if (result && result.length > 0) return result;
  } catch (e) { /* Decryption failed */ }

  return null;
};

/**
 * Helper: Get valid access token
 */
// Mutex for token refresh to prevent "previous promise did not settle" error
let tokenRefreshPromise = null;

/**
 * Helper: Fetch with Timeout to prevent hanging connections
 */
export const fetchWithTimeout = async (url, options = {}, timeout = 30000) => {
  const controller = new AbortController();
  const id = setTimeout(() => {
    console.warn(`[Drive] Fetch timeout reached for: ${url}`);
    controller.abort();
  }, timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('Connection timed out. Please check your internet.');
    }
    throw error;
  }
};

export const getAccessToken = async () => {
  if (tokenRefreshPromise) {
    return tokenRefreshPromise;
  }

  tokenRefreshPromise = (async () => {
    const driveScope = 'https://www.googleapis.com/auth/drive.file';

    try {
      console.log('[Sync] Getting access token...');
      let currentUser = await GoogleSignin.getCurrentUser();

      // Attempt silent sign-in if no user is found
      if (!currentUser) {
        try {
          currentUser = await GoogleSignin.signInSilently();
        } catch (error) {
          console.log('[Sync] Silent sign-in failed:', error);
        }
      }

      if (!currentUser) {
        console.log('[Sync] No user signed in, aborting token fetch.');
        return null;
      }

      const hasScope = currentUser?.scopes?.includes(driveScope);
      if (!hasScope) {
        console.log('[Sync] Drive scope missing, requesting...');
        await GoogleSignin.addScopes({ scopes: [driveScope] });
      }

      // Get tokens safely
      const tokens = await GoogleSignin.getTokens();
      if (!tokens || !tokens.accessToken) {
        console.error('[Sync] getTokens returned empty or no access token');
        return null;
      }
      return tokens.accessToken;

    } catch (error) {
      if (error.message && error.message.includes('requires a user to be signed in')) {
        console.warn('[Sync] User session expired or not signed in. Refresh required.');
      }
      console.error('[Sync] getAccessToken Error:', error);
      return null;
    } finally {
      tokenRefreshPromise = null;
    }
  })();

  return tokenRefreshPromise;
};

/**
 * DEBUG: Check if Store Branding (Logo) exists in Drive
 */
export const checkStoreBrandingStatus = async (user) => {
  if (!user || !user.id) return { error: 'No user ID' };
  try {
    const accessToken = await getAccessToken();
    const backupName = 'Kwiq Bill Backup';

    // 1. Find the top-level backup folder directly
    const folderQuery = `name='${backupName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const folderRes = await fetchWithTimeout(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(folderQuery)}&fields=files(id)`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const folderData = await folderRes.json();
    const folderId = folderData.files?.[0]?.id;

    if (!folderId) return { folderExists: false, backupFolderExists: false, logoExists: false };

    // 2. Find logo
    const logoQuery = `name='store_logo.jpg' and '${folderId}' in parents and trashed=false`;
    const logoRes = await fetchWithTimeout(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(logoQuery)}&fields=files(id, modifiedTime, size)`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const logoData = await logoRes.json();
    const logoFile = logoData.files?.[0];

    // 3. Find settings.json
    const settingsQuery = `name='settings.json' and '${folderId}' in parents and trashed=false`;
    const settingsRes = await fetchWithTimeout(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(settingsQuery)}&fields=files(id, modifiedTime)`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const settingsData = await settingsRes.json();

    return {
      folderExists: true,
      folderId,
      backupFolderExists: true,
      logoExists: !!logoFile,
      logoId: logoFile?.id,
      logoModified: logoFile?.modifiedTime,
      logoSize: logoFile?.size,
      settingsExists: !!settingsData.files?.[0],
      settingsId: settingsData.files?.[0]?.id,
      settingsModified: settingsData.files?.[0]?.modifiedTime
    };
  } catch (error) {
    console.error('[Debug] Branding Check Error:', error);
    return { error: error.message };
  }
};

/**
 * Helper: Find or Create Folder
 */
export const getOrCreateFolder = async (accessToken, folderName, parentId = null) => {
  // 1. Search for folder
  let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const searchRes = await fetchWithTimeout(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();

  console.log(`[Drive] Searching for folder: ${folderName} (Parent: ${parentId || 'Root'})`);
  if (searchData.files && searchData.files.length > 0) {
    console.log(`[Drive] Folder found: ${folderName} (${searchData.files[0].id})`);
    return searchData.files[0].id; // Return existing folder ID
  }
  console.log(`[Drive] Folder not found: ${folderName}, creating...`);

  // 2. Create folder if not found
  const metadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  const createRes = await fetchWithTimeout(
    'https://www.googleapis.com/drive/v3/files',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    }
  );
  const createData = await createRes.json();
  console.log(`[Drive] Folder created: ${folderName} (${createData.id})`);
  return createData.id;
};

/**
 * Helper: Upload or Update File in Folder
 */
export const uploadFileToFolder = async (accessToken, folderId, fileName, content) => {
  // 1. Search for file in specific folder
  const searchRes = await fetchWithTimeout(
    `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and '${folderId}' in parents and trashed=false`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();
  const existingFile = searchData.files && searchData.files.length > 0 ? searchData.files[0] : null;

  // 2. Prepare Body
  const boundary = 'foo_bar_baz';
  const metadata = {
    name: fileName,
    mimeType: 'application/json'
  };

  // Only include parents for NEW files (POST)
  if (!existingFile) {
    metadata.parents = [folderId];
  }

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  // 3. Upload (PATCH if exists, POST if new)
  const url = existingFile
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const method = existingFile ? 'PATCH' : 'POST';

  const uploadRes = await fetchWithTimeout(url, {
    method: method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: body,
  });

  const responseText = await uploadRes.text();
  let data = {};
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    // Not JSON or empty
  }

  if (!uploadRes.ok) {
    console.error(`[Sync] File Upload Failed (${fileName}): ${uploadRes.status}`, data);
  }

  return data;
};

/**
 * Helper: Upload Image to Folder
 */
export const uploadImageToFolder = async (accessToken, folderId, fileName, localUri, mimeType = 'image/jpeg') => {
  try {
    // Read file as base64 or extract from data URL
    let base64;
    if (localUri.startsWith('data:image')) {
      base64 = localUri.split(',')[1];
    } else {
      base64 = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' });
    }

    // Search for existing file
    const searchRes = await fetchWithTimeout(
      `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and '${folderId}' in parents and trashed=false`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const searchData = await searchRes.json();
    const existingFile = searchData.files && searchData.files.length > 0 ? searchData.files[0] : null;

    // Metadata
    const metadata = {
      name: fileName,
      mimeType: mimeType
    };

    // Only include parents for NEW files (POST)
    if (!existingFile) {
      metadata.parents = [folderId];
    }

    const boundary = 'foo_bar_baz_image';
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n` +
      `Content-Transfer-Encoding: base64\r\n\r\n` +
      `${base64}\r\n` +
      `--${boundary}--`;

    const url = existingFile
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

    const method = existingFile ? 'PATCH' : 'POST';

    const uploadRes = await fetchWithTimeout(url, {
      method: method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: body,
    });

    const responseText = await uploadRes.text();
    let data = {};
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error(`[Sync] Failed to parse Drive response as JSON: ${responseText}`);
    }

    if (!uploadRes.ok) {
      console.error(`[Sync] Drive Upload Failed: ${uploadRes.status} ${uploadRes.statusText}`, data);
      return null;
    }

    if (!data.id) {
      console.warn(`[Sync] Drive Upload Success but no ID returned. Response:`, data);
    } else {
      console.log(`[Sync] Image ${fileName} ${existingFile ? 'updated' : 'uploaded'}. ID: ${data.id}`);
    }
    return data;
  } catch (e) {
    console.error(`[Sync] Failed to upload image ${fileName}:`, e);
    return null;
  }
};

/**
 * Main: Sync User Data to User-Specific Folder
 */
export const syncUserDataToDrive = async (user, allData) => {
  if (!user || !user.id || !allData) return;

  try {
    const accessToken = await getAccessToken();
    const backupName = 'Kwiq Bill Backup';

    // 1. Ensure Top-level Backup Folder Exists
    const folderId = await getOrCreateFolder(accessToken, backupName);

    console.log(`Syncing to Drive: ${backupName} (${folderId})`);

    // Fix #6: Derive secure key once per sync session
    let derivedKey = null;
    if (user.email) {
      const salt = await getDriveEncSalt();
      derivedKey = deriveEncryptionKey(user.email, salt);
    }

    // 2. Upload each data category as a separate file
    const tables = Object.keys(allData); // ['products', 'customers', 'settings', etc.]

    for (const table of tables) {
      if (allData[table] && allData[table].length > 0) { // Only save non-empty
        const fileName = `${table}.json`;
        let content = JSON.stringify(allData[table], null, 2);

        // Encrypt snapshots for security
        if (derivedKey) {
          content = encryptContent(content, derivedKey);
        }

        await uploadFileToFolder(accessToken, folderId, fileName, content);
        console.log(`Uploaded ${fileName} to Drive (Encrypted).`);
      }
    }

    // 3. Generate and Upload Tax Report (GST Details)
    if (allData.invoices && Array.isArray(allData.invoices)) {
      try {
        let totalSales = 0;
        let totalGST = 0;
        let totalSGST = 0;
        let totalCGST = 0;
        let totalIGST = 0;

        const taxDetails = allData.invoices.map(inv => {
          const tax = inv.tax || 0;
          const amount = inv.total || 0;

          // Basic estimation logic if tax breakdown isn't stored explicitly
          // In a real scenario, this should come from inv.taxDetails or similar
          let sgst = 0, cgst = 0, igst = 0;

          // Check if explicit details exist (assuming they might be stored in a 'taxDetails' column or parsed)
          // For now, using the same logic as GSTPage for consistency
          if (inv.taxType === 'inter') {
            igst = tax;
          } else {
            sgst = tax / 2;
            cgst = tax / 2;
          }

          totalSales += amount;
          totalGST += tax;
          totalSGST += sgst;
          totalCGST += cgst;
          totalIGST += igst;

          return {
            id: inv.id,
            invoiceNumber: inv.invoiceNumber || inv.id,
            date: inv.date,
            customerName: inv.customer_name,
            totalAmount: amount,
            totalTax: tax,
            sgst,
            cgst,
            igst
          };
        });

        const taxReport = {
          generatedAt: new Date().toISOString(),
          summary: {
            totalSales,
            totalGST,
            totalSGST,
            totalCGST,
            totalIGST
          },
          details: taxDetails
        };

        let reportContent = JSON.stringify(taxReport, null, 2);
        if (derivedKey) {
          reportContent = encryptContent(reportContent, derivedKey);
        }

        await uploadFileToFolder(accessToken, folderId, 'tax_report.json', reportContent);
        console.log('Uploaded tax_report.json to Drive (Encrypted).');

      } catch (e) {
        console.warn('Error generating tax report for Drive:', e);
      }
    }

    // Also save User Details in the same folder for reference (Standardized for Restore)
    let profileContent = JSON.stringify(user, null, 2);
    if (derivedKey) {
      profileContent = encryptContent(profileContent, derivedKey);
    }
    await uploadFileToFolder(accessToken, folderId, 'user details.json', profileContent);

    return true;
  } catch (error) {
    console.error("Drive Sync Error:", error);
    return false;
  }
};

/**
 * Main: Restore Data from Drive (Snapshot Restore)
 */
export const restoreUserDataFromDrive = async (user, onProgress) => {
  console.log('[Restore] Starting restore for user:', user?.id);
  if (!user || !user.id) return;

  try {
    if (onProgress) onProgress('Connecting to Cloud... (Est. time: 5s)', 0.35);
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.log('[Restore] No access token, skipping.');
      return;
    }

    // Standardized search: Primary is 'Kwiq Bill Backup', fallbacks for legacy versions
    let folderIds = [];
    const foldersToTry = ['Kwiq Bill Backup', 'Kwiqbill', `KwiqBilling-${user.id}`];

    for (const fName of foldersToTry) {
      const query = `name='${fName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const sRes = await fetchWithTimeout(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const sData = await sRes.json();
      if (sData.files && sData.files.length > 0) {
        const rootId = sData.files[0].id;
        folderIds.push(rootId); // Search in root

        // Also check for 'kwiq bill backup' inside this root
        const subQuery = `name='kwiq bill backup' and '${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        const subRes = await fetchWithTimeout(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(subQuery)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const subData = await subRes.json();
        if (subData.files && subData.files.length > 0) {
          folderIds.push(subData.files[0].id); // Search in subfolder
        }
      }
    }

    if (folderIds.length === 0) {
      console.log('[Restore] No backup folders found on Drive.');
      return;
    }
    console.log('[Restore] Searching in folders:', folderIds);

    // 1. Search for specific snapshot files we need to restore
    // Optimization: query for specific filenames to avoid pagination issues when there are many event files.
    if (onProgress) onProgress('Connecting to backup engine...', 0.42);
    const targetFiles = ['settings.json', 'products.json', 'customers.json', 'expenses.json', 'expense_adjustments.json', 'invoices.json', 'user details.json', 'store_logo.jpg'];
    const namesQuery = targetFiles.map(name => `name='${name}'`).join(' or ');
    const parentsQuery = folderIds.map(id => `'${id}' in parents`).join(' or ');
    const listQuery = `(${namesQuery}) and (${parentsQuery}) and trashed=false`;

    console.log('[Restore] Querying for snapshots:', listQuery);

    const listRes = await fetchWithTimeout(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(listQuery)}&fields=files(id,name,modifiedTime)&pageSize=100&orderBy=modifiedTime desc`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const listData = await listRes.json();
    const filesMap = {};
    if (listData.files) {
      listData.files.forEach(f => {
        // Since we orderBy modifiedTime desc, the first occurrence is the latest
        if (!filesMap[f.name]) {
          filesMap[f.name] = f.id;
        }
      });
      console.log('[Restore] Latest files found in cloud:', Object.keys(filesMap).join(', '));
    }

    // Helper to download JSON file using the map
    const fetchFileFromMap = async (baseName) => {
      try {
        const fileId = filesMap[baseName];
        if (fileId) {
          console.log(`[Restore] Downloading ${baseName} (ID: ${fileId})...`);
          const contentRes = await fetchWithTimeout(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          if (!contentRes.ok) throw new Error(`HTTP ${contentRes.status}`);

          const text = await contentRes.text();
          if (!text || text.trim() === "") return null;

          try {
            let cleanText = text.trim();
            
            // Attempt 1: Direct JSON parse (Case for Desktop Backups)
            try {
              if (cleanText.startsWith('{') || cleanText.startsWith('[')) {
                return JSON.parse(cleanText);
              }
            } catch (e) { /* Not plain JSON */ }

            // Attempt 2: Decryption (Cases for Mobile Backups — PBKDF2 & legacy Email)
            if (cleanText.startsWith('U2FsdGVkX1')) {
              try {
                const salt = await getDriveEncSalt();
                const decryptedData = decryptContent(cleanText, user.email, salt);
                if (decryptedData) cleanText = decryptedData;
              } catch (err) {
                console.warn(`[Restore] Decryption failed for ${baseName}. Key mismatch or corrupted.`);
              }
            }

            // Failsafe: Standard cleaning if still has MIME headers leaking from Drive
            if (cleanText.toLowerCase().includes('content-type:')) {
              const parts = cleanText.split(/\r?\n\r?\n/);
              for (let part of parts) {
                const trimmed = part.trim();
                if (trimmed.toLowerCase().includes('content-type:')) continue;
                if (trimmed.length > 0 && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
                  try { return JSON.parse(trimmed); } catch(e) {}
                }
              }
            }

            return JSON.parse(cleanText);
          } catch (e) {
            console.error(`[Restore] Fatal Parse Error for ${baseName}:`, e.message);
            return null;
          }
        }
      } catch (e) {
        console.log(`[Restore] Error fetching ${baseName}:`, e);
      }
      return null;
    };

    // Helper to download image using the map
    const downloadImageFromMap = async (baseName) => {
      try {
        const fileId = filesMap[baseName];
        if (fileId) {
          let baseUrl = FileSystem.documentDirectory || '';
          if (baseUrl && !baseUrl.endsWith('/')) baseUrl += '/';
          const destinationUri = `${baseUrl}${baseName}`;

          await FileSystem.downloadAsync(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            destinationUri,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          return destinationUri;
        }
      } catch (e) {
        console.warn(`[Restore] Failed to download image ${baseName}:`, e);
      }
      return null;
    };

    // Parallel Fetch All Data using the optimized map
    if (onProgress) onProgress('Downloading store snapshots... (Est. time: 3s)', 0.45);
    const [settings, products, customers, expenses, expense_adjustments, invoices, userDetailsFile] = await Promise.all([
      fetchFileFromMap('settings.json'),
      fetchFileFromMap('products.json'),
      fetchFileFromMap('customers.json'),
      fetchFileFromMap('expenses.json'),
      fetchFileFromMap('expense_adjustments.json'),
      fetchFileFromMap('invoices.json'),
      fetchFileFromMap('user details.json')
    ]);

    // Live Metrics Tracking during restoration
    const restoredStats = {
      synced: 0,
      errors: 0,
      total: (products?.length || 0) + (customers?.length || 0) + (expenses?.length || 0) + (invoices?.length || 0)
    };

    const updateRestoreProgress = (msg, prog) => {
      if (onProgress) onProgress(msg, prog, restoredStats);
    };

    // Restore Logo if available
    let localLogoUri = null;
    try {
      localLogoUri = await downloadImageFromMap('store_logo.jpg');
    } catch (e) {
      console.warn("[Restore] Logo restore failed", e);
    }

    // 1. Restore Settings
    if ((settings && Array.isArray(settings) && settings.length > 0) || userDetailsFile) {
      updateRestoreProgress('Syncing store preferences...', 0.48);
      try {
        const settingsKey = getUserSpecificKey(SETTINGS_KEY, user.email);
        const localSaved = await AsyncStorage.getItem(settingsKey);
        const localSettings = localSaved ? JSON.parse(localSaved) : {};

        // Settings from settings.json take priority, fallback to user details.json
        const driveSettings = (settings && Array.isArray(settings) && settings.length > 0) ? settings[0] : (userDetailsFile || {});

        // Deep extraction of bank details from multiple sources
        const driveBank = driveSettings.bankDetails || userDetailsFile?.bankDetails || {};

        // Deep merge drive settings with local
        // LOGO PRIORITY: DB logo > Drive settings logo (base64) > downloaded store_logo.jpg > existing local
        const driveLogo = driveSettings.store?.logo || null;
        const existingLogo = localSettings.store?.logo || null;
        const bestLogo = existingLogo || driveLogo || (localLogoUri ? `file://${localLogoUri.replace('file://', '')}` : null);

        const merged = {
          ...localSettings,
          ...driveSettings,
          store: {
            ...(localSettings.store || {}),
            ...(driveSettings.store || {}),
            logo: bestLogo  // Smart fallback: local > drive settings > downloaded file
          },
          tax: { ...(localSettings.tax || {}), ...(driveSettings.tax || {}) },
          invoice: { ...(localSettings.invoice || {}), ...(driveSettings.invoice || {}) },
          defaults: { ...(localSettings.defaults || {}), ...(driveSettings.defaults || {}) },
          bankDetails: {
            accountName: '', accountNumber: '', ifsc: '', bankName: '', branch: '',
            ...(localSettings.bankDetails || {}),
            ...driveBank
          }
        };

        await AsyncStorage.setItem(settingsKey, JSON.stringify(merged));
        console.log('[Restore] Settings merged from Drive. Logo source:', bestLogo ? (bestLogo.startsWith('data:') ? 'base64' : bestLogo.startsWith('http') ? 'cloud URL' : 'local file') : 'none');
      } catch (e) {
        console.warn('[Restore] Settings merge failed, fixing state:', e.message);
        // Minimum viable settings restore
        const settingsKey = getUserSpecificKey(SETTINGS_KEY, user.email);
        const fallback = (settings && settings[0]) || userDetailsFile || {};
        await AsyncStorage.setItem(settingsKey, JSON.stringify(fallback));
      }
    }

    // 2. Restore Products
    if (products && Array.isArray(products)) {
      updateRestoreProgress(`Restoring ${products.length} products...`, 0.52);

      const normalizeVariants = (v) => {
        try {
          const list = (typeof v === 'string' ? JSON.parse(v) : (v || []));
          if (!Array.isArray(list)) return JSON.stringify([]);
          return JSON.stringify(list.map(item => ({
            ...item,
            name: String(item.name || item.detail || ''),
            sku: String(item.sku || ''),
            cost_price: parseFloat((item.cost_price !== undefined && item.cost_price !== null && item.cost_price !== '') ? item.cost_price : ((item.costPrice !== undefined && item.costPrice !== null && item.costPrice !== '') ? item.costPrice : 0)) || 0,
            price: (item.price !== null && item.price !== undefined && item.price !== '') ? parseFloat(item.price) : null,
            stock: parseInt((item.stock !== undefined && item.stock !== null && item.stock !== '') ? item.stock : ((item.qty !== undefined && item.qty !== null && item.qty !== '') ? item.qty : ((item.quantity !== undefined && item.quantity !== null && item.quantity !== '') ? item.quantity : 0))) || 0,
            tax_rate: parseFloat(item.tax_rate || item.taxRate || 0) || 0,
          })));
        } catch (e) {
          return JSON.stringify([]);
        }
      };

      await db.withTransactionAsync(async () => {
        for (const p of products) {
          await db.runAsync(
            `INSERT OR REPLACE INTO products (id, name, sku, category, price, cost_price, stock, min_stock, unit, tax_rate, variants, variant, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              p.id,
              p.name,
              p.sku,
              p.category,
              p.price || 0,
              p.cost_price || p.costPrice || 0,
              p.stock || 0,
              p.min_stock || p.minStock || 0,
              p.unit || 'pc',
              p.tax_rate || p.taxRate || 0,
              normalizeVariants(p.variants),
              p.variant,
              p.created_at,
              p.updated_at
            ]
          );
          restoredStats.synced++;
        }
      });
      console.log(`[Restore] Restored ${products.length} products.`);
    }

    // 3. Restore Customers
    if (customers && Array.isArray(customers)) {
      updateRestoreProgress(`Restoring ${customers.length} customers...`, 0.55);
      await db.withTransactionAsync(async () => {
        for (const c of customers) {
          await db.runAsync(
            `INSERT OR REPLACE INTO customers (id, name, phone, email, type, gstin, address, source, tags, loyaltyPoints, notes, created_at, updated_at, amountPaid, whatsappOptIn, smsOptIn, outstanding)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              c.id, c.name, c.phone, c.email, c.type, c.gstin, c.address, c.source, c.tags,
              c.loyaltyPoints || 0, c.notes, c.created_at, c.updated_at, c.amountPaid || 0,
              c.whatsappOptIn ? 1 : 0, c.smsOptIn ? 1 : 0, c.outstanding || 0
            ]
          );
          restoredStats.synced++;
        }
      });
      console.log(`[Restore] Restored ${customers.length} customers.`);
    }

    // 4. Restore Expenses
    if (expenses && Array.isArray(expenses)) {
      updateRestoreProgress(`Restoring ${expenses.length} expenses...`, 0.57);
      await db.withTransactionAsync(async () => {
        for (const e of expenses) {
          await db.runAsync(
            `INSERT OR REPLACE INTO expenses (id, title, amount, category, date, payment_method, tags, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [e.id, e.title, e.amount, e.category, e.date, e.payment_method, (typeof e.tags === 'string' ? e.tags : JSON.stringify(e.tags || [])), e.created_at, e.updated_at]
          );
          restoredStats.synced++;
        }
      });
      console.log(`[Restore] Restored ${expenses.length} expenses.`);
    }

    // 4b. Restore Expense Adjustments
    if (expense_adjustments && Array.isArray(expense_adjustments) && expense_adjustments.length > 0) {
      updateRestoreProgress(`Restoring ${expense_adjustments.length} expense adjustments...`, 0.58);
      await db.withTransactionAsync(async () => {
        for (const ea of expense_adjustments) {
          await db.runAsync(
            `INSERT OR REPLACE INTO expense_adjustments (id, expense_id, delta, reason, created_at)
                    VALUES (?, ?, ?, ?, ?)`,
            [ea.id, ea.expense_id, ea.delta || 0, ea.reason || '', ea.created_at]
          );
          restoredStats.synced++;
        }
      });
      console.log(`[Restore] Restored ${expense_adjustments.length} expense adjustments.`);
    }

    // 5. Restore Invoices
    if (invoices && Array.isArray(invoices)) {
      updateRestoreProgress(`Restoring ${invoices.length} invoices...`, 0.59);
      await db.withTransactionAsync(async () => {
        for (const i of invoices) {
          await db.runAsync(
            `INSERT OR REPLACE INTO invoices (
                id, customer_id, customer_name, date, type, items, subtotal, tax, discount, total, status, payments, 
                grossTotal, itemDiscount, additionalCharges, roundOff, amountReceived, internalNotes, taxType, weekly_sequence,
                loyalty_points_redeemed, loyalty_points_earned, loyalty_points_discount, is_deleted, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              i.id, i.customer_id, i.customer_name, i.date, i.type,
              (typeof i.items === 'string' ? i.items : JSON.stringify(i.items || [])),
              i.subtotal || 0, i.tax || 0, i.discount || 0, i.total || 0, i.status || 'Paid',
              (typeof i.payments === 'string' ? i.payments : JSON.stringify(i.payments || [])),
              i.grossTotal || 0, i.itemDiscount || 0, i.additionalCharges || 0, i.roundOff || 0, i.amountReceived || 0,
              i.internalNotes || '', i.taxType || 'intra', i.weekly_sequence || 1,
              i.loyalty_points_redeemed || 0, i.loyalty_points_earned || 0, i.loyalty_points_discount || 0,
              i.is_deleted ? 1 : 0, i.created_at, i.updated_at
            ]
          );
          restoredStats.synced++;
        }
      });
      console.log(`[Restore] Restored ${invoices.length} invoices.`);
    }

    return true;
  } catch (error) {
    console.error('[Restore] Restoration failed:', error);
    return false;
  }
};


/**
 * Sync Settings to Drive (User-specific folder)
 */
export const syncSettingsToDrive = async (user, settings) => {
  if (!user || !user.id || !settings) {
    console.log('[DriveSync] Aborting sync: Missing user or settings data.');
    return;
  }

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.log('[DriveSync] Aborting sync: No Google access token available.');
      return false;
    }

    const backupName = 'Kwiq Bill Backup';

    console.log('[DriveSync] Starting sync to Google Drive...');

    // 1. Ensure Folder Structure Exists
    const folderId = await getOrCreateFolder(accessToken, backupName);

    // 2. Prepare Payload
    // CLONE settings to avoid mutating state passed in
    const settingsToSave = JSON.parse(JSON.stringify(settings));
    
    // Log the key fields being saved (for verification)
    console.log('[DriveSync] Saving settings. Invoice template:', settingsToSave.invoice?.template);
    if (settingsToSave.invoice?.conditionsText) {
        console.log('[DriveSync] Including conditions text:', settingsToSave.invoice.conditionsText.substring(0, 20) + '...');
    }

    // CHECK FOR LOGO UPLOAD
    if (settingsToSave.store && settingsToSave.store.logo) {
      let logoUri = settingsToSave.store.logo;
      let shouldUpload = false;
      let mimeType = 'image/jpeg';

      if (typeof logoUri === 'string') {
        if (logoUri.startsWith('file://')) {
          shouldUpload = true;
          if (logoUri.endsWith('.png')) mimeType = 'image/png';
        } else if (logoUri.startsWith('data:image')) {
          // Handle base64
          shouldUpload = true;
          const match = logoUri.match(/^data:(image\/\w+);base64,/);
          if (match) mimeType = match[1];
        }
      }

      if (shouldUpload) {
        console.log(`[Sync] Found new logo (${mimeType}), uploading to Drive...`);
        const uploadResult = await uploadImageToFolder(accessToken, folderId, 'store_logo.jpg', logoUri, mimeType);
        if (uploadResult && uploadResult.id) {
          console.log('[Sync] Logo uploaded successfully.');
        }

        // PORTABILITY FIX: If the logo is a local file, convert to base64 for the settings.json backup
        // This ensures that even if local file download fails on restore, the logo persists via JSON
        if (logoUri.startsWith('file://')) {
          try {
            const base64 = await FileSystem.readAsStringAsync(logoUri, { encoding: 'base64' });
            settingsToSave.store.logo = `data:${mimeType};base64,${base64}`;
          } catch (e) {
            console.warn('[Sync] Failed to convert local logo to base64 for backup:', e);
          }
        }
      } else if (typeof logoUri === 'string' && logoUri.startsWith('file://')) {
        // If it's a file path but we decided NOT to upload (maybe old logic?), 
        // we still MUST NOT save a device-specific path to settings.json
        // Let's at least null it out or try to preserve it if it was already in Drive as a file.
        // For safety, we should really ensure it's portable.
        try {
          const base64 = await FileSystem.readAsStringAsync(logoUri, { encoding: 'base64' });
          settingsToSave.store.logo = `data:image/jpeg;base64,${base64}`;
        } catch (e) {
          settingsToSave.store.logo = null;
        }
      }
    }

    // Fix #6: Secure key derivation
    let derivedKey = null;
    if (user.email) {
      const salt = await getDriveEncSalt();
      derivedKey = deriveEncryptionKey(user.email, salt);
    }

    let content = JSON.stringify([settingsToSave], null, 2);
    if (derivedKey) {
      content = encryptContent(content, derivedKey);
    }

    // 3. Upload
    await uploadFileToFolder(accessToken, folderId, 'settings.json', content);

    // 4. Also upload explicit user_details.json as requested for cross-platform ease
    const userDetails = {
      store: settings.store,
      user: settings.user,
      bankDetails: settings.bankDetails,
      tax: settings.tax,
      invoice: settings.invoice,
      onboardingCompletedAt: settings.onboardingCompletedAt
    };
    let detailsContent = JSON.stringify(userDetails, null, 2);
    if (derivedKey) {
      detailsContent = encryptContent(detailsContent, derivedKey);
    }
    await uploadFileToFolder(accessToken, folderId, 'user details.json', detailsContent);

    console.log('[Sync] Settings and User Details uploaded to Drive (Encrypted).');
    return true;
  } catch (error) {
    console.error('[Sync] Settings upload failed:', error);
    return false;
  }
};

/**
 * Legacy: Saves user details to Google Drive Root (Kept for backward compatibility if needed)
 */
export const saveUserDetailsToDrive = async (userDetails) => {
  try {
    const accessToken = await getAccessToken();
    const filename = "user_details_backup.json";

    // 1. Check for valid user folder to keep it clean (New logic integration)
    // If we have an ID, we try to put it in the folder too? 
    // The user asked to "also save in addition to user details".
    // Let's keep this legacy function dumping to root OR update it to use the folder?
    // "inside the folder seperate files need to be saved... and also the in the google drve also it should get saved in addition to the user details"
    // I will modify this to ALSO save to the user folder if possible, but the 'syncUserDataToDrive' handles the bulk.
    // Let's keep this simple and isolated as requested: "functionality or structure nothing should not be disturbed unless needed"
    // So I leave this function mostly alone but refactored to use `uploadFileToFolder` if I wanted, 
    // but better to blindly paste the old logic back + my new helpers to ensure 100% no regression.

    // ... (Pasting original logic back in slightly cleaned form to coexist with new exports)

    // 3. Search for existing file
    const searchResponse = await fetchWithTimeout(
      `https://www.googleapis.com/drive/v3/files?q=name='${filename}'`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const searchData = await searchResponse.json();
    const existingFile = searchData.files && searchData.files.length > 0 ? searchData.files[0] : null;

    // 4. Prepare Multipart Body
    const boundary = 'auto_sync_boundary';
    const metadata = {
      name: filename,
      mimeType: 'application/json'
    };

    let content = JSON.stringify(userDetails);
    if (userDetails.email) {
      content = encryptContent(content, userDetails.email);
    }

    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `\r\n--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${content}\r\n` +
      `\r\n--${boundary}--`;

    const url = existingFile
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

    const method = existingFile ? 'PATCH' : 'POST';

    await fetchWithTimeout(url, {
      method: method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: body,
    });

  } catch (error) {
    console.error("Auto-sync error:", error);
  }
};

/**
 * Fetch ONLY settings.json from Drive and merge into local AsyncStorage.
 * Called on EVERY session init to keep store/bank/tax/invoice prefs in sync.
 * Logo is NOT touched — it comes from the Database (MongoDB).
 */
export const fetchSettingsFromDrive = async (user) => {
  if (!user || !user.id) return null;

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.log('[DriveSettings] No access token, skipping.');
      return null;
    }    // Search for the Drive folder
    let folderId = null;
    const foldersToTry = ['Kwiq Bill Backup', 'Kwiqbill', `KwiqBilling-${user.id}`];

    for (const fName of foldersToTry) {
      if (folderId) break;
      const query = `name='${fName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const sRes = await fetchWithTimeout(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const sData = await sRes.json();
      if (sData.files && sData.files.length > 0) {
        const rootId = sData.files[0].id;
        // For the new flat structure ('Kwiq Bill Backup'), use root directly
        if (fName === 'Kwiq Bill Backup') {
          folderId = rootId;
        } else {
          // Check for subfolder in legacy structures
          const subQuery = `name='kwiq bill backup' and '${rootId}' in parents and trashed=false`;
          const subRes = await fetchWithTimeout(
                `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(subQuery)}`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const subData = await subRes.json();
          folderId = (subData.files && subData.files.length > 0) ? subData.files[0].id : rootId;
        }
      }
    }
 

    if (!folderId) {
      console.log('[DriveSettings] No Drive folder found.');
      return null;
    }

    // Fetch settings.json and user details.json
    const targetFiles = ['settings.json', 'user details.json'];
    const namesQuery = targetFiles.map(name => `name='${name}'`).join(' or ');
    const listQuery = `(${namesQuery}) and '${folderId}' in parents and trashed=false`;

    const listRes = await fetchWithTimeout(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(listQuery)}&fields=files(id,name)&pageSize=10`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const listData = await listRes.json();
    const filesMap = {};
    if (listData.files) {
      listData.files.forEach(f => { filesMap[f.name] = f.id; });
    }

    // Download and parse a file
    const fetchFile = async (baseName) => {
      const fileId = filesMap[baseName];
      if (!fileId) return null;

      try {
        const contentRes = await fetchWithTimeout(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!contentRes.ok) return null;

        let text = await contentRes.text();
        if (!text || text.trim() === '') return null;

        let cleanText = text.trim();
        // Handle encrypted data
        if (cleanText.startsWith('U2FsdGVkX1')) {
          try {
            const bytes = CryptoJS.AES.decrypt(cleanText, user.email);
            const decrypted = bytes.toString(CryptoJS.enc.Utf8);
            if (decrypted) cleanText = decrypted;
          } catch (e) {
            console.warn('[DriveSettings] Decryption failed for ' + baseName);
          }
        }

        return JSON.parse(cleanText);
      } catch (e) {
        console.warn('[DriveSettings] Error fetching ' + baseName + ':', e.message);
        return null;
      }
    };

    const [settingsData, userDetailsData] = await Promise.all([
      fetchFile('settings.json'),
      fetchFile('user details.json'),
    ]);

    // Extract the drive settings object
    const driveSettings = (settingsData && Array.isArray(settingsData) && settingsData.length > 0)
      ? settingsData[0]
      : (settingsData || userDetailsData || null);

    if (!driveSettings) {
      console.log('[DriveSettings] No settings found on Drive.');
      return null;
    }    // Deep extraction of bank details
    const driveBank = driveSettings.bankDetails || userDetailsData?.bankDetails || {};
 
    // Merge with local, preserving logo from DB
    const settingsKey = getUserSpecificKey(SETTINGS_KEY, user.email);
    const localSaved = await AsyncStorage.getItem(settingsKey);
    const localSettings = localSaved ? JSON.parse(localSaved) : {};
    const existingLogo = localSettings.store?.logo || null;
 
    // MERGE STRATEGY: Only overwrite local settings if Drive is actually NEWER
    // or if local settings are essentially empty (new device).
    const localTime = localSettings.lastUpdatedAt ? new Date(localSettings.lastUpdatedAt).getTime() : 0;
    const driveTime = driveSettings.lastUpdatedAt ? new Date(driveSettings.lastUpdatedAt).getTime() : 0;
    
    console.log(`[DriveSettings] Comparing Timestamps - Local: ${localSettings.lastUpdatedAt || 'never'}, Drive: ${driveSettings.lastUpdatedAt || 'never'}`);

    // If local is newer, we DON'T want to overwrite with old drive data.
    // However, if we're on a fresh install (no store name), we should definitely take the Drive data.
    const isLocalFresh = !localSettings.store?.name;
    
    let merged;
    if (driveTime > localTime || isLocalFresh) {
      console.log('[DriveSettings] Drive data is newer or local is empty. Applying cloud preferences.');
      // LOGO PRIORITY: existing local > Drive settings logo (base64/URL) > null
      const driveLogo = driveSettings.store?.logo || null;
      const bestLogo = existingLogo || driveLogo;
      merged = {
        ...localSettings,
        ...driveSettings,
        store: {
          ...(localSettings.store || {}),
          ...(driveSettings.store || {}),
          logo: bestLogo, // Smart fallback: local > Drive settings
        },
        tax: { ...(localSettings.tax || {}), ...(driveSettings.tax || {}) },
        invoice: { ...(localSettings.invoice || {}), ...(driveSettings.invoice || {}) },
        defaults: { ...(localSettings.defaults || {}), ...(driveSettings.defaults || {}) },
        bankDetails: {
          accountName: '', accountNumber: '', ifsc: '', bankName: '', branch: '',
          ...(localSettings.bankDetails || {}),
          ...driveBank,
        },
      };
    } else {
      console.log('[DriveSettings] Local data is newer than Drive. Keeping local and skipping overwrite.');
      return localSettings;
    }
 
    await AsyncStorage.setItem(settingsKey, JSON.stringify(merged));
    console.log('[DriveSettings] ✅ Settings fetched from Drive and merged.');
    console.log('[DriveSettings] Store:', merged.store?.name, '| Bank:', merged.bankDetails?.bankName || 'none');

    return merged;
  } catch (error) {
    console.error('[DriveSettings] Failed:', error.message);
    return null;
  }
};

export const syncSecurityVaultToDrive = async (user, vaultData) => {
  if (!user || !user.email || !vaultData) return false;
  try {
    const accessToken = await getAccessToken();
    const folderId = await getOrCreateFolder(accessToken, 'Kwiq Bill Backup');
    const salt = await getDriveEncSalt();
    const derivedKey = deriveEncryptionKey(user.email, salt);
    const content = encryptContent(JSON.stringify(vaultData), derivedKey);
    await uploadFileToFolder(accessToken, folderId, 'security_vault.json', content);
    return true;
  } catch (error) {
    console.error('[DriveSecure] Vault sync failed:', error.message);
    return false;
  }
};

export const fetchSecurityVaultFromDrive = async (user) => {
  if (!user || !user.email) return null;
  try {
    const accessToken = await getAccessToken();
    const query = `name='security_vault.json' and trashed=false`;
    const searchRes = await fetchWithTimeout(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const searchData = await searchRes.json();
    const fileId = searchData.files?.[0]?.id;
    if (!fileId) return null;
    const contentRes = await fetchWithTimeout(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const encryptedText = await contentRes.text();
    if (encryptedText && encryptedText.trim().startsWith('U2FsdGVkX1')) {
      const salt = await getDriveEncSalt();
      const decrypted = decryptContent(encryptedText.trim(), user.email, salt);
      if (decrypted) return JSON.parse(decrypted);
    }
    return null;
  } catch (error) {
    console.error('[DriveSecure] Vault fetch failed:', error.message);
    return null;
  }
};
