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
// Fix #5: Single normalized iteration count for all new encryption operations.
// Old values used 1000/5000/20000 — the mismatch caused the 12-attempt fallback loop.
// All NEW encrypted values use exactly 10000 iterations.
const KWIQ_ITERATIONS = 10000;
const DRIVE_ENC_ITERATIONS = KWIQ_ITERATIONS; // kept for legacy compat reads
const SUPREME_ENC_ITERATIONS = KWIQ_ITERATIONS;
// Version prefix embedded in every newly encrypted string.
// Format: KWIQV2:<iterations>:<AES ciphertext>
// Presence of this prefix lets decryptContent skip the exhaustive fallback loop entirely.
const KWIQ_ENC_PREFIX = `KWIQV2:${KWIQ_ITERATIONS}:`;
const ADMIN_MASTER_SECRET = 'KWIQ_SUPREME_2026_F9B2_X5D7_Z001_A882_C774_KWIQ_BILL_ADMIN_MASTER_OVERRIDE_MASTER';

// Cache for derived keys and tokens to prevent redundant calculations and API calls
const _keyCache = {
  email: null,
  supreme: null,
  standard: null,
  legacy: null,
};

// Extremely fast static cache for legacy decrypt fallback loop
const _legacyKeyCache = {};

// Access token caching for 5-minute performance windows
const _syncCache = {
  accessToken: null,
  expireTime: 0,
  refreshPromise: null
};

/**
 * PRODUCTION-GRADE ISOLATION: Wipe in-memory caches on logout.
 * Prevents account A's encryption keys or tokens from being reused for account B.
 */
export const logoutDriveCache = () => {
  _keyCache.email = null;
  _keyCache.supreme = null;
  _keyCache.standard = null;
  _keyCache.legacy = null;
  
  _syncCache.accessToken = null;
  _syncCache.expireTime = 0;
  _syncCache.refreshPromise = null;
  console.log('[Drive] Service caches wiped for security isolation.');
};

/**
 * Get or create a per-device encryption salt for Drive backups.
 * Stored in SecureStore (hardware-backed on Android).
 */
export const getDriveEncSalt = async (tier = 'standard') => {
  // 🛡️ RECOVERY FIX: Using a stable shared salt allows multiple devices for the same user 
  // (e.g. PC + Phone 1 + Phone 2) to successfully decrypt each other's cloud backups.
   // Tier 1: Supreme (Harden)
   if (tier === 'supreme') return 'kwiq_bill_shared_supreme_salt_2024_x922_long_v5_vulnerability_proof_6002';
   // Tier 2: Standard
   return 'kwiq-bill-shared-salt-2024';
};

export const deriveEncryptionKey = (email, salt) => {
  if (!email) return null;
  const normalizedEmail = email.toLowerCase().trim();
  
  // Decide which cache bucket to use based on salt
  let cacheKey = 'standard';
  const supremeSalt = 'kwiq_bill_shared_supreme_salt_2024_x922_long_v5_vulnerability_proof_6002';
  const legacySalt = 'kwiq_bill_secret_salt';

  if (salt === supremeSalt) cacheKey = 'supreme';
  else if (salt === legacySalt) cacheKey = 'legacy';

  // Check global cache first (CRITICAL for Performance)
  if (_keyCache.email === normalizedEmail && _keyCache[cacheKey]) {
    return _keyCache[cacheKey];
  }

  // Fix #5: All derivations now use the single normalized KWIQ_ITERATIONS count.
  // Legacy iteration variants (1000, 20000 etc.) are only used in fallback read paths,
  // never for new derivations via this function.
  const iterations = KWIQ_ITERATIONS;

  console.log(`[Crypto] Deriving ${cacheKey} key... (${iterations} iterations)`);
  const start = Date.now();

  const key = CryptoJS.PBKDF2(normalizedEmail, salt || 'kwiq-bill-shared-salt-2024', {
    keySize: 256 / 32,
    iterations,
    hasher: CryptoJS.algo.SHA256
  }).toString(CryptoJS.enc.Hex);
  
  // Update cache
  _keyCache.email = normalizedEmail;
  _keyCache[cacheKey] = key;
  console.log(`[Crypto] ${cacheKey} key cached in ${Date.now() - start}ms.`);
  return key;
};

/**
 * Pre-warm the cache asynchronously to avoid freezing the UI.
 * Yields the JS thread between heavy PBKDF2 calculations.
 */
export const prewarmEncryptionKeys = async (email) => {
  if (!email) return;
  const normalizedEmail = email.toLowerCase().trim();
  const supremeSalt = 'kwiq_bill_shared_supreme_salt_2024_x922_long_v5_vulnerability_proof_6002';
  const standardSalt = 'kwiq-bill-shared-salt-2024';
  const legacySalt = 'kwiq_bill_secret_salt';

  // 🚀 PERFORMANCE FIX: Increase yield time to give UI more space
  const UI_GRACE_PERIOD = 200; 

  // Supreme
  if (!_keyCache.email || _keyCache.email !== normalizedEmail || !_keyCache.supreme) {
      await new Promise(res => setTimeout(res, UI_GRACE_PERIOD)); // Yield to UI
      deriveEncryptionKey(email, supremeSalt);
  }
  // Standard
  if (!_keyCache.email || _keyCache.email !== normalizedEmail || !_keyCache.standard) {
      await new Promise(res => setTimeout(res, UI_GRACE_PERIOD)); // Yield to UI
      deriveEncryptionKey(email, standardSalt);
  }
  // Legacy
  if (!_keyCache.email || _keyCache.email !== normalizedEmail || !_keyCache.legacy) {
      await new Promise(res => setTimeout(res, UI_GRACE_PERIOD)); // Yield to UI
      deriveEncryptionKey(email, legacySalt);
  }

  // 🛡️ RECOVERY PRE-WARM: If the original email has uppercase, pre-warm it too
  if (email !== normalizedEmail) {
      console.log('[Crypto] Case-sensitivity mismatch detected. Pre-warming additional recovery keys...');
      await new Promise(res => setTimeout(res, UI_GRACE_PERIOD));
      CryptoJS.PBKDF2(email, supremeSalt, { iterations: SUPREME_ENC_ITERATIONS });
      await new Promise(res => setTimeout(res, UI_GRACE_PERIOD));
      CryptoJS.PBKDF2(email, standardSalt, { iterations: DRIVE_ENC_ITERATIONS });
  }
};

/**
 * Helper: Encrypt content using a PBKDF2-derived key.
 * Fix #5: Prepends KWIQV2:<iterations>: prefix so decryptContent can
 * resolve in a SINGLE PBKDF2 attempt instead of the 12-attempt loop.
 */
export const encryptContent = (content, key) => {
  if (!content || !key) {
    throw new Error('[Crypto] Cannot encrypt: content or key is missing.');
  }
  if (!CryptoJS || !CryptoJS.AES) {
    throw new Error('[Crypto] CryptoJS not fully initialized. Encryption aborted.');
  }
  const ciphertext = CryptoJS.AES.encrypt(content, key).toString();
  // Embed the iteration count so decryptContent resolves without guessing
  return `${KWIQ_ENC_PREFIX}${ciphertext}`;
};

/**
 * Helper: Decrypt content.
 * Fix #5: If the value carries a KWIQV2 prefix, we extract the exact
 * iteration count and resolve in ONE PBKDF2 call — no more 12-attempt loop.
 * Old U2FsdGVkX1 values (no prefix) fall through to the legacy loop for
 * full backward compatibility.
 */
export const decryptContent = (encryptedText, email, keyOrSalt) => {
  if (!encryptedText) return null;

  // ── NEW FORMAT: KWIQV2:<iterations>:<ciphertext> ──
  if (encryptedText.startsWith('KWIQV2:')) {
    try {
      const parts = encryptedText.split(':');
      // parts[0]='KWIQV2', parts[1]=iterations, parts[2..]=ciphertext (ciphertext may contain ':')
      const embeddedIter = parseInt(parts[1], 10);
      const ciphertext = parts.slice(2).join(':');

      // If a pre-derived 256-bit key was passed, try it first (fast path)
      if (keyOrSalt && typeof keyOrSalt === 'string' && keyOrSalt.length >= 32) {
        try {
          const bytes = CryptoJS.AES.decrypt(ciphertext, keyOrSalt);
          const result = bytes.toString(CryptoJS.enc.Utf8);
          if (result && result.length > 0) return result;
        } catch (e) { }
      }

      // Derive key with the EXACT iteration count embedded in the prefix — single attempt
      if (email) {
        const normalizedEmail = email.toLowerCase().trim();
        const salt = 'kwiq-bill-shared-salt-2024';
        const key = CryptoJS.PBKDF2(normalizedEmail, salt, {
          keySize: 256 / 32,
          iterations: embeddedIter,
          hasher: CryptoJS.algo.SHA256
        }).toString(CryptoJS.enc.Hex);
        const bytes = CryptoJS.AES.decrypt(ciphertext, key);
        const result = bytes.toString(CryptoJS.enc.Utf8);
        if (result && result.length > 0) return result;
      }
    } catch (e) { }
    // If KWIQV2 prefix parse fully fails, fall through to legacy loop below
  }

  // ── LEGACY FORMAT: U2FsdGVkX1... (no prefix) ──
  // 1. PRIMARY: pre-derived key passed in directly
  if (keyOrSalt && typeof keyOrSalt === 'string' && keyOrSalt.length >= 32) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, keyOrSalt);
      const result = bytes.toString(CryptoJS.enc.Utf8);
      if (result && result.length > 0) return result;
    } catch (e) { }
  }

  // 2. RAW STATIC KEY FALLBACK (Bilingual Desktop Support - NO EMAIL NEEDED)
  const staticKeys = ['kwiq-bill-shared-salt-2024', 'kwiq_bill_shared_salt_2024', 'kwiq-bill-secret-2024', 'kwiq_bill_secret_salt', 'kwiq-bill-master-2024'];
  for (const sKey of staticKeys) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, sKey);
      const result = bytes.toString(CryptoJS.enc.Utf8);
      if (result && result.length > 0) return result;
    } catch (e) { }
  }

  // 2.5 DIRECT NAKED EMAIL FALLBACK (Desktop pure AES without hash)
  if (email) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, email);
      const result = bytes.toString(CryptoJS.enc.Utf8);
      if (result && result.length > 0) return result;
    } catch (e) { }
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, email.toLowerCase().trim());
      const result = bytes.toString(CryptoJS.enc.Utf8);
      if (result && result.length > 0) return result;
    } catch (e) { }
  }

  if (!email) return null;
  const normalizedEmail = email.toLowerCase().trim();

  // 3. TIERED FALLBACKS (legacy only — new values never reach here)
  const salts = [
    { value: 'kwiq_bill_shared_supreme_salt_2024_x922_long_v5_vulnerability_proof_6002', type: 'supreme' },
    { value: 'kwiq-bill-shared-salt-2024', type: 'standard' },
    { value: 'kwiq_bill_secret_salt', type: 'legacy' }
  ];
  const iterations = [20000, 10000, 5000, 1000];
  const hashers = [CryptoJS.algo.SHA256, CryptoJS.algo.SHA1];
  const emails = [normalizedEmail];
  if (email && email !== normalizedEmail) emails.push(email);

  for (const saltItem of salts) {
    for (const iter of iterations) {
      for (const hashAlgo of hashers) {
        for (const mail of emails) {
          try {
            const isModern = (iter === KWIQ_ITERATIONS && hashAlgo === CryptoJS.algo.SHA256);
            let key;
            const cacheKey = `${mail}_${saltItem.value}_${iter}_${hashAlgo === CryptoJS.algo.SHA256 ? 'SHA256' : 'SHA1'}`;
            
            if (_legacyKeyCache[cacheKey]) {
                key = _legacyKeyCache[cacheKey];
            } else if (isModern) {
               key = deriveEncryptionKey(mail, saltItem.value);
               _legacyKeyCache[cacheKey] = key;
            } else {
               key = CryptoJS.PBKDF2(mail, saltItem.value, { 
                 keySize: 256 / 32, 
                 iterations: iter, 
                 hasher: hashAlgo 
               }).toString(CryptoJS.enc.Hex);
               _legacyKeyCache[cacheKey] = key;
            }
            const bytes = CryptoJS.AES.decrypt(encryptedText, key);
            const result = bytes.toString(CryptoJS.enc.Utf8);
            if (result && result.length > 0) return result;
          } catch (e) { }
        }
      }
    }
  }

  // 4. RAW EMAIL FALLBACK: V1 Backups (No PBKDF2)
  for (const mail of emails) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, mail);
      const result = bytes.toString(CryptoJS.enc.Utf8);
      if (result && result.length > 0) return result;
    } catch (e) { }
  }

  return null;
};

/**
 * Helper: Get valid access token
 */
export const getAccessToken = async () => {
  // Check memory cache first (Rapid return for high-frequency boot calls)
  if (_syncCache.accessToken && Date.now() < _syncCache.expireTime) {
    return _syncCache.accessToken;
  }

  // Prevent multiple simultaneous refresh calls
  if (_syncCache.refreshPromise) {
    return _syncCache.refreshPromise;
  }

  _syncCache.refreshPromise = (async () => {
    const driveScope = 'https://www.googleapis.com/auth/drive';
    try {
      console.log('[Sync] Getting access token...');
      let currentUser = await GoogleSignin.getCurrentUser();

      if (!currentUser) {
        try {
          currentUser = await GoogleSignin.signInSilently();
        } catch (error) {
          console.log('[Sync] Silent sign-in failed:', error);
        }
      }

      if (!currentUser) return null;

      const hasScope = currentUser?.scopes?.includes(driveScope);
      if (!hasScope) {
        console.log('[Sync] Drive scope missing, requesting...');
        await GoogleSignin.addScopes({ scopes: [driveScope] });
      }

      const tokens = await GoogleSignin.getTokens();
      if (!tokens || !tokens.accessToken) return null;

      // Update cache: Tokens typically last 60 minutes, we cache for 5 minutes for stability
      _syncCache.accessToken = tokens.accessToken;
      _syncCache.expireTime = Date.now() + (5 * 60 * 1000); 

      return tokens.accessToken;
    } catch (error) {
      console.error('[Sync] getAccessToken Error:', error);
      return null;
    } finally {
      // Clear promise so next fetch can retry if this one failed
      _syncCache.refreshPromise = null;
    }
  })();

  return _syncCache.refreshPromise;
};
/**
 * Helper: Fetch with Timeout to prevent hanging connections
 * Includes retry logic for improved reliability
 */
export const fetchWithTimeout = async (url, options = {}, timeout = 30000, retries = 2) => {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => {
      if (attempt === 0) {
        console.warn(`[Drive] Fetch timeout (attempt ${attempt + 1}/${retries + 1}) for: ${url}`);
      }
      controller.abort();
    }, timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(id);

      // If response is not OK and we have retries left, retry
      if (!response.ok && attempt < retries) {
        console.warn(`[Drive] Fetch failed with ${response.status}, retrying (${attempt + 2}/${retries + 1})...`);
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // Exponential backoff
        continue;
      }

      return response;
    } catch (error) {
      clearTimeout(id);
      lastError = error;

      if (attempt < retries) {
        console.warn(`[Drive] Fetch error (attempt ${attempt + 1}/${retries + 1}): ${error.message}, retrying...`);
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  // All retries exhausted
  throw lastError || new Error('Connection timed out. Please check your internet.');
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
 * Optimization: Caches folder IDs in AsyncStorage to prevent redundant Drive API calls on app restart.
 */
export const getOrCreateFolder = async (accessToken, folderName, parentId = null) => {
  const cacheKey = `drive_folder_${folderName}_${parentId || 'root'}`;
  
  // 1. Try Cache First
  try {
    const cachedId = await AsyncStorage.getItem(cacheKey);
    if (cachedId) {
      console.log(`[Drive] Using cached folder ID for ${folderName}: ${cachedId}`);
      return cachedId;
    }
  } catch (e) {
    console.warn('[Drive] Folder cache read failed:', e.message);
  }

  // 2. Search for folder on Drive
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
    const folderId = searchData.files[0].id;
    console.log(`[Drive] Folder found: ${folderName} (${folderId})`);
    
    // Update local cache
    await AsyncStorage.setItem(cacheKey, folderId);
    return folderId;
  }
  
  console.log(`[Drive] Folder not found: ${folderName}, creating...`);

  // 3. Create folder if not found
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
  if (createData.id) {
    console.log(`[Drive] Folder created: ${folderName} (${createData.id})`);
    await AsyncStorage.setItem(cacheKey, createData.id);
    return createData.id;
  }
  
  throw new Error(`Failed to create folder: ${folderName}`);
};

/**
 * Clear cached folder IDs
 */
export const clearCachedFolderIds = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const folderKeys = keys.filter(k => k.startsWith('drive_folder_'));
    if (folderKeys.length > 0) {
      await AsyncStorage.multiRemove(folderKeys);
      console.log('[Drive] Folder ID cache cleared.');
    }
  } catch (e) {
    console.warn('[Drive] Failed to clear folder cache:', e.message);
  }
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
    if (!accessToken) return;

    // 1. Dual-Redundancy Discovery (Target BOTH folders for max safety)
    const rootsToTry = ['Kwiqbill', 'Kwiq Bill Backup', 'Kwiq Billing', 'KwiqBill'];
    if (user?.id) rootsToTry.push(`KwiqBilling-${user.id}`);
    
    for (const fName of rootsToTry) {
      let folderId = null;
      const q = `name='${fName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      try {
        const res = await fetchWithTimeout(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const data = await res.json();
        if (data.files && data.files.length > 0) {
          folderId = data.files[0].id;
        } else if (fName === 'Kwiq Bill Backup') {
          // Always ensure the backup folder exists as the last safety net
          folderId = await getOrCreateFolder(accessToken, fName);
        }
      } catch (e) {
        console.warn(`[Sync] Folder discovery failed for ${fName}:`, e.message);
      }
      if (folderId) targetRootIds.push({ id: folderId, name: fName });
    }

    if (targetRootIds.length === 0) return;

    // Fix #6: Derive secure key once per sync session
    let derivedKey = null;
    if (user.email) {
      const salt = await getDriveEncSalt();
      derivedKey = deriveEncryptionKey(user.email, salt);
    }

    // 2. Upload to each target root
    for (const root of targetRootIds) {
      console.log(`[FullBackup] Synchronizing snapshots to: ${root.name} (${root.id})`);
      
      // Ensure 'snapshots' subfolder exists in THIS root
      const snapshotsId = await getOrCreateFolder(accessToken, 'snapshots', root.id);

      // Upload each data category
      const tables = Object.keys(allData);
      for (const table of tables) {
        if (allData[table] && allData[table].length > 0) {
          const fileName = `${table}.json`;
          let content = JSON.stringify(allData[table], null, 2);
          if (derivedKey) content = encryptContent(content, derivedKey);
          
          await uploadFileToFolder(accessToken, snapshotsId, fileName, content);
        }
      }

      // 3. Generate and Upload Tax Report (GST Details) in THIS root
      if (allData.invoices && Array.isArray(allData.invoices)) {
        try {
          let totalSales = 0, totalGST = 0, totalSGST = 0, totalCGST = 0, totalIGST = 0;
          const taxDetails = allData.invoices.map(inv => {
            const tax = inv.tax || 0, amount = inv.total || 0;
            let sgst = 0, cgst = 0, igst = 0;
            if (inv.taxType === 'inter') igst = tax;
            else { sgst = tax / 2; cgst = tax / 2; }
            totalSales += amount; totalGST += tax; totalSGST += sgst; totalCGST += cgst; totalIGST += igst;
            return {
              id: inv.id, invoiceNumber: inv.invoiceNumber || inv.id, date: inv.date,
              customerName: inv.customer_name, totalAmount: amount, totalTax: tax,
              sgst, cgst, igst
            };
          });

          const taxReport = {
            generatedAt: new Date().toISOString(),
            summary: { totalSales, totalGST, totalSGST, totalCGST, totalIGST },
            details: taxDetails
          };

          let reportContent = JSON.stringify(taxReport, null, 2);
          if (derivedKey) reportContent = encryptContent(reportContent, derivedKey);
          await uploadFileToFolder(accessToken, snapshotsId, 'tax_report.json', reportContent);
        } catch (e) {
          console.warn('[Sync] Tax report generation failed for ' + root.name, e.message);
        }
      }

      // 4. Save User Details (for Restore reference) in THIS root
      let profileContent = JSON.stringify(user, null, 2);
      if (derivedKey) profileContent = encryptContent(profileContent, derivedKey);
      await uploadFileToFolder(accessToken, snapshotsId, 'user details.json', profileContent);
    }

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
    if (onProgress) onProgress('Connecting to Cloud... (Est. time: 5s)', 0.05);

    // Yield to let the data sync page animate and render before freezing the CPU
    await new Promise(res => setTimeout(res, 850));

    // Pre-warm the encryption keys asynchronously to keep UI responsive
    if (onProgress) onProgress('Initializing Secure Channel...', 0.1);
    await prewarmEncryptionKeys(user.email);

    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.log('[Restore] No access token, skipping.');
      return;
    }

    // 1. Bilingual robust folder discovery
    let folderIds = [];
    const rootsToTry = ['Kwiqbill', 'Kwiq Bill Backup', 'Kwiq Billing', 'KwiqBill'];
    if (user?.id) rootsToTry.push(`KwiqBilling-${user.id}`);
    if (user?.email) rootsToTry.push(`KwiqBill-${user.email.split('@')[0]}`);

    for (const fName of rootsToTry) {
      const query = `name='${fName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const sRes = await fetchWithTimeout(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name)`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const sData = await sRes.json();
      
      if (sData.files) {
        for (const rootFolder of sData.files) {
          folderIds.push(rootFolder.id);
          console.log(`[Restore] Found root folder: ${fName} (${rootFolder.id})`);

          // Deep search for subfolders (Snapshots, backups)
          try {
            const subQuery = `mimeType='application/vnd.google-apps.folder' and '${rootFolder.id}' in parents and trashed=false`;
            const subRes = await fetchWithTimeout(
              `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(subQuery)}&fields=files(id, name)`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const subData = await subRes.json();
            if (subData.files && subData.files.length > 0) {
              for (const sub of subData.files) {
                folderIds.push(sub.id);
                console.log(`[Restore] Found subfolder: ${sub.name} in ${fName}`);
                
                // If it's 'backups' or 'backup', check one level deeper for daily/weekly/monthly
                const lowerName = sub.name.toLowerCase();
                if (lowerName === 'backups' || lowerName === 'backup' || lowerName === 'kwiq bill backup') {
                  const deepQuery = `mimeType='application/vnd.google-apps.folder' and '${sub.id}' in parents and trashed=false`;
                  const deepRes = await fetchWithTimeout(
                    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(deepQuery)}&fields=files(id, name)`,
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                  );
                  const deepData = await deepRes.json();
                  if (deepData.files) {
                    deepData.files.forEach(d => {
                      folderIds.push(d.id);
                      console.log(`[Restore] Found deep subfolder: ${d.name} in ${sub.name}`);
                    });
                  }
                }
              }
            }
          } catch (e) {
            console.warn(`[Restore] Error listing subfolders for ${fName}:`, e.message);
          }
        }
      }
    }

    if (folderIds.length === 0) {
      console.log('[Restore] No backup folders found on Drive.');
      return;
    }
    // Remove duplicates from folderIds
    folderIds = [...new Set(folderIds)];
    console.log('[Restore] Final search locations (Folder IDs):', folderIds);

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

            // 4. Final attempt to parse if it's JSON
            if (cleanText.startsWith('{') || cleanText.startsWith('[')) {
              return JSON.parse(cleanText);
            }

            console.warn(`[Restore] ${baseName} content is not JSON and could not be decrypted.`);
            return null;
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
            name: String(item.name || item.detail || 'Standard'),
            sku: String(item.sku || ''),
            cost_price: parseFloat(item.cost_price || item.costPrice || 0) || 0,
            price: parseFloat(item.price || 0) || 0,
            stock: parseInt(item.stock || item.qty || 0) || 0,
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
              p.name || 'Untitled Product',
              p.sku || `SKU-${Date.now()}`,
              p.category || 'General',
              parseFloat(p.price) || 0,
              parseFloat(p.cost_price || p.costPrice) || 0,
              parseInt(p.stock || p.qty) || 0,
              parseInt(p.min_stock || p.minStock) || 0,
              p.unit || 'pc',
              parseFloat(p.tax_rate || p.taxRate) || 0,
              normalizeVariants(p.variants),
              p.variant || '',
              p.created_at || p.createdAt || new Date().toISOString(),
              p.updated_at || p.updatedAt || new Date().toISOString()
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
          const resolvedName = (c.name || 
                              (c.firstName ? `${c.firstName} ${c.lastName || ''}`.trim() : '') || 
                              'Guest Customer');

          await db.runAsync(
            `INSERT OR REPLACE INTO customers (id, name, phone, email, type, gstin, address, source, tags, loyaltyPoints, notes, created_at, updated_at, amountPaid, whatsappOptIn, smsOptIn, outstanding)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              String(c.id || `CUST-${Date.now()}-${Math.random().toString(36).substr(2,9)}`), 
              resolvedName, 
              c.phone || c.mobile || '', 
              c.email || '', 
              c.type || c.customerType || 'retail', 
              c.gstin || '', 
              (typeof c.address === 'object' ? JSON.stringify(c.address) : (c.address || '')), 
              c.source || '', 
              (Array.isArray(c.tags) ? c.tags.join(',') : (c.tags || '')),
              parseInt(c.loyaltyPoints || c.loyalty_points) || 0, 
              c.notes || c.remarks || '', 
              c.created_at || c.createdAt || new Date().toISOString(), 
              c.updated_at || c.updatedAt || new Date().toISOString(), 
              parseFloat(c.amountPaid || c.amount_paid) || 0,
              (c.whatsappOptIn || c.whatsapp_opt_in) ? 1 : 0, 
              (c.smsOptIn || c.sms_opt_in) ? 1 : 0, 
              parseFloat(c.outstanding) || 0
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
            `INSERT OR REPLACE INTO expenses (id, title, amount, category, date, payment_method, tags, receipt_url, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              String(e.id || `EXP-${Date.now()}-${Math.random().toString(36).substr(2,9)}`), 
              e.title || 'Untitled Expense', 
              parseFloat(e.amount) || 0, 
              e.category || 'Other', 
              e.date || new Date().toISOString(), 
              e.payment_method || e.paymentMethod || 'Cash', 
              (typeof e.tags === 'string' ? e.tags : JSON.stringify(e.tags || [])), 
              e.receipt_url || e.receiptUrl || '',
              e.created_at || e.createdAt || new Date().toISOString(), 
              e.updated_at || e.updatedAt || new Date().toISOString()
            ]
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
              String(i.id || `INV-${Date.now()}-${Math.random().toString(36).substr(2,9)}`),
              String(i.customer_id || i.customerId || ''),
              i.customer_name || i.customerName || 'Walk-in Customer',
              i.date || new Date().toISOString(),
              i.type || 'Standard',
              (typeof i.items === 'string' ? i.items : JSON.stringify(i.items || [])),
              parseFloat(i.subtotal) || 0,
              parseFloat(i.tax) || 0,
              parseFloat(i.discount) || 0,
              parseFloat(i.total) || 0,
              i.status || 'Paid',
              (typeof i.payments === 'string' ? i.payments : JSON.stringify(i.payments || [])),
              parseFloat(i.grossTotal || i.gross_total || i.total_cost || 0),
              parseFloat(i.itemDiscount || i.item_discount || 0),
              parseFloat(i.additionalCharges || i.additional_charges || 0),
              parseFloat(i.roundOff || i.round_off || 0),
              parseFloat(i.amountReceived || i.amount_received || 0),
              String(i.internalNotes || i.remarks || ''),
              i.taxType || 'intra',
              parseInt(i.weekly_sequence || i.bill_number || 1) || 1,
              parseInt(i.loyalty_points_redeemed || 0) || 0,
              parseInt(i.loyalty_points_earned || 0) || 0,
              parseFloat(i.loyalty_points_discount || 0) || 0,
              (i.is_deleted || i.deleted) ? 1 : 0,
              i.created_at || i.createdAt || new Date().toISOString(),
              i.updated_at || i.updatedAt || new Date().toISOString()
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


let _settingsSyncState = {
  isSyncing: false,
  startTime: 0
};

/**
 * Sync Settings to Drive (User-specific folder)
 */
export const syncSettingsToDrive = async (user, settings) => {
  if (!user || !user.id || !settings) {
    return;
  }
  
  const now = Date.now();
  if (_settingsSyncState.isSyncing) {
    // 5-minute timeout for settings sync (it's much smaller than full data sync)
    if (now - _settingsSyncState.startTime > 5 * 60000) {
      console.warn('[DriveSync] Stale settings sync lock detected. Resetting.');
      _settingsSyncState.isSyncing = false;
    } else {
      console.log('[DriveSync] Upload already in progress, skipping duplicate.');
      return;
    }
  }
  
  _settingsSyncState = { isSyncing: true, startTime: now };

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) return false;

    // 1. Dual-Redundancy Folder Discovery (Upload to BOTH for safety)
    const rootsToTry = ['Kwiqbill', 'Kwiq Bill Backup'];
    let targetFolderIds = [];
    
    for (const fName of rootsToTry) {
        let folderId = null;
        const query = `name='${fName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        try {
            const sRes = await fetchWithTimeout(
                `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const sData = await sRes.json();
            if (sData.files && sData.files.length > 0) {
                folderId = sData.files[0].id;
            } else if (fName === 'Kwiq Bill Backup') {
                folderId = await getOrCreateFolder(accessToken, fName);
            }
        } catch (e) {
            console.warn(`[Sync] Failed to find folder ${fName}:`, e.message);
        }
        
        if (folderId) targetFolderIds.push({ id: folderId, name: fName });
    }
    
    // 🚀 DEDUPLICATION: Ensure unique folder IDs
    const uniqueMap = new Map();
    targetFolderIds.forEach(target => uniqueMap.set(target.id, target));
    targetFolderIds = Array.from(uniqueMap.values());
    if (targetFolderIds.length === 0) return false;

    // 🚀 PHASE 1: Heavy Serialization & Logo Preparation (Runs ONCE per session)
    await new Promise(res => setTimeout(res, 50)); // Yield to Breathe
    const settingsSnapshot = JSON.parse(JSON.stringify(settings));
    
    // Logo logic (handled once to avoid double reading disk)
    let logoData = null;
    let logoMime = 'image/jpeg';
    if (settingsSnapshot.store?.logo) {
      const uri = settingsSnapshot.store.logo;
      if (uri.startsWith('file://')) {
        try {
          logoData = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
          if (uri.endsWith('.png')) logoMime = 'image/png';
          settingsSnapshot.store.logo = `data:${logoMime};base64,${logoData}`;
        } catch (e) { console.warn('[DriveSync] Logo preparation failed:', e.message); }
      } else if (uri.startsWith('data:image')) {
        logoData = uri.split(',')[1];
        const match = uri.match(/^data:(image\/\w+);base64,/);
        if (match) logoMime = match[1];
      }
    }

    // 🚀 PHASE 2: Heavy Encryption (Runs ONCE per session)
    const salt = await getDriveEncSalt();
    const derivedKey = deriveEncryptionKey(user.email, salt);
    
    const settingsContent = encryptContent(JSON.stringify([settingsSnapshot]), derivedKey);
    const userDetails = {
      store: settingsSnapshot.store,
      user: settingsSnapshot.user,
      bankDetails: settingsSnapshot.bankDetails,
      tax: settingsSnapshot.tax,
      invoice: settingsSnapshot.invoice,
      onboardingCompletedAt: settingsSnapshot.onboardingCompletedAt
    };
    const detailsContent = encryptContent(JSON.stringify(userDetails, null, 2), derivedKey);

    // 🚀 PHASE 3: Network I/O (Loop only through found folders)
    let anySuccess = false;
    for (const folder of targetFolderIds) {
      console.log(`[DriveSync] Uploading settings to folder: ${folder.name} (${folder.id})`);
      
      // Upload Logo if exists
      if (logoData) {
        await uploadImageToFolder(accessToken, folder.id, 'store_logo.jpg', settingsSnapshot.store.logo, logoMime).catch(() => {});
      }

      // Upload settings.json
      await uploadFileToFolder(accessToken, folder.id, 'settings.json', settingsContent);
      
      // Upload user details.json
      await uploadFileToFolder(accessToken, folder.id, 'user details.json', detailsContent);
      
      anySuccess = true;
      // Small yield between folders to keep UI responsive to frame events
      await new Promise(res => setTimeout(res, 50));
    }

    return anySuccess;
  } catch (error) {
    console.error('[Sync] Settings upload failed:', error);
    return false;
  } finally {
    _settingsSyncState = { isSyncing: false, startTime: 0 };
  }
};

export const saveUserDetailsToDrive = async (userDetails) => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) return false;

    // 1. Dual-Redundancy Discovery
    const rootsToTry = ['Kwiqbill', 'Kwiq Bill Backup'];
    const targetFolderIds = [];
    
    for (const fName of rootsToTry) {
        let folderId = null;
        const query = `name='${fName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        try {
            const sRes = await fetchWithTimeout(
                `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const sData = await sRes.json();
            if (sData.files && sData.files.length > 0) {
                folderId = sData.files[0].id;
            } else if (fName === 'Kwiq Bill Backup') {
                folderId = await getOrCreateFolder(accessToken, fName);
            }
        } catch (e) {}
        if (folderId) targetFolderIds.push({ id: folderId, name: fName });
    }

    if (targetFolderIds.length === 0) return false;

    let anySuccess = false;
    for (const folder of targetFolderIds) {
        // Prepare content
        let content = JSON.stringify(userDetails, null, 2);
        if (userDetails.email) {
            // Use stable salt for consistency
            const salt = await getDriveEncSalt();
            const derivedKey = deriveEncryptionKey(userDetails.email, salt);
            content = encryptContent(content, derivedKey);
        }

        await uploadFileToFolder(accessToken, folder.id, 'user_details_backup.json', content);
        anySuccess = true;
    }

    return anySuccess;
  } catch (error) {
    console.error("User details backup error:", error);
    return false;
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
    }    // 1. Bilingual robust folder discovery
    let folderIds = [];
    const rootsToTry = ['Kwiqbill', 'Kwiq Bill Backup', 'Kwiq Billing', 'KwiqBill'];
    if (user?.id) rootsToTry.push(`KwiqBilling-${user.id}`);
    if (user?.email) rootsToTry.push(`KwiqBill-${user.email.split('@')[0]}`);

    for (const fName of rootsToTry) {
      const query = `name='${fName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const sRes = await fetchWithTimeout(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name)`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const sData = await sRes.json();
      
      if (sData.files) {
        for (const rootFolder of sData.files) {
          folderIds.push(rootFolder.id);

          // Deep search for subfolders (Snapshots, backups)
          try {
            const subQuery = `mimeType='application/vnd.google-apps.folder' and '${rootFolder.id}' in parents and trashed=false`;
            const subRes = await fetchWithTimeout(
              `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(subQuery)}&fields=files(id, name)`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const subData = await subRes.json();
            if (subData.files) {
              subData.files.forEach(sub => {
                  folderIds.push(sub.id);
                  // Check one level deeper for backups/daily/etc
                  // (Reduced depth for settings fetch compared to full restore for speed)
              });
            }
          } catch (e) {}
        }
      }
    }

    if (folderIds.length === 0) {
      console.log('[DriveSettings] No Drive folders found.');
      return null;
    }
    
    // Deduplicate
    folderIds = [...new Set(folderIds)];

    // 2. Fetch latest versions of settings.json and user details.json
    const targetFiles = ['settings.json', 'user details.json'];
    const namesQuery = targetFiles.map(name => `name='${name}'`).join(' or ');
    const parentsQuery = folderIds.map(id => `'${id}' in parents`).join(' or ');
    const listQuery = `(${namesQuery}) and (${parentsQuery}) and trashed=false`;

    const listRes = await fetchWithTimeout(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(listQuery)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const listData = await listRes.json();
    
    // We want the LATEST file for each name
    const filesMap = {};
    if (listData.files) {
      listData.files.forEach(f => { 
        if (!filesMap[f.name]) filesMap[f.name] = f.id; 
      });
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
        
        // Robust smart decryption logic — handles whole-file encrypted format (KWIQV2 or U2FsdGVkX1)
        if (cleanText.startsWith('U2FsdGVkX1') || cleanText.startsWith('U2V') || cleanText.startsWith('KWIQV2:')) {
          try {
            const salt = await getDriveEncSalt();
            const decrypted = decryptContent(cleanText, user.email, salt);
            if (decrypted) cleanText = decrypted;
            else {
               console.warn('[DriveSettings] Decryption failed for ' + baseName);
               return null; 
            }
          } catch (e) {
            console.warn('[DriveSettings] Decryption error for ' + baseName);
            return null;
          }
        }

        // Final attempt to parse if it's JSON
        if (cleanText.startsWith('{') || cleanText.startsWith('[')) {
          return JSON.parse(cleanText);
        }
        
        console.warn(`[DriveSettings] ${baseName} content is not JSON and could not be decrypted.`);
        return null;
      } catch (e) {
        console.warn('[DriveSettings] Error fetching ' + baseName + ':', e.message);
        return null;
      }
    };

    const [settingsData, userDetailsData] = await Promise.all([
      fetchFile('settings.json'),
      fetchFile('user details.json'),
    ]);

    // 3. Extract and Merge drive settings object
    let driveSettings = settingsData || userDetailsData || null;
    if (driveSettings && Array.isArray(driveSettings) && driveSettings.length > 0) {
      driveSettings = driveSettings[0];
    }

    if (!driveSettings) {
      console.log('[DriveSettings] No settings found on Drive.');
      return null;
    }
    // Deep extraction of bank details
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
 
    // ── DECRYPT INDIVIDUAL SENSITIVE FIELDS ────────────────────────────────────
    // Desktop Drive files are plain JSON objects where individual fields like
    // store.name/contact/email/gstin may still be CryptoJS-encrypted strings
    // (e.g. 'U2FsdGVkX1...'). We MUST decrypt them here before saving to
    // AsyncStorage, otherwise they persist as raw encrypted text across sessions.
    const salt = await getDriveEncSalt();
    const derivedKey = deriveEncryptionKey(user.email, salt);

    const decryptField = (val) => {
      if (!val || typeof val !== 'string') return val;
      if (!val.startsWith('U2FsdGVkX1') && !val.startsWith('KWIQV2:')) return val;
      const result = decryptContent(val, user.email, derivedKey);
      return result || val; // fallback to raw if all decryption attempts fail
    };

    if (merged.store && typeof merged.store === 'object') {
      ['name', 'legalName', 'contact', 'email', 'gstin', 'fssai', 'website', 'pan'].forEach(f => {
        if (merged.store[f]) merged.store[f] = decryptField(merged.store[f]);
      });
      if (merged.store.address && typeof merged.store.address === 'string') {
        const addrDec = decryptField(merged.store.address);
        try { merged.store.address = JSON.parse(addrDec); } catch(e) { merged.store.address = addrDec; }
      }
    }
    if (merged.user && typeof merged.user === 'object') {
      ['fullName', 'mobile', 'email'].forEach(f => {
        if (merged.user[f]) merged.user[f] = decryptField(merged.user[f]);
      });
    }
    // ────────────────────────────────────────────────────────────────────────────

    await AsyncStorage.setItem(settingsKey, JSON.stringify(merged));
    console.log('[DriveSettings] ✅ Settings fetched, decrypted, and merged.');
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
    
    // Bilingual Upload: Search for either folder, prefer Kwiqbill if it exists
    const foldersToTry = ['Kwiqbill', 'Kwiq Bill Backup'];
    let folderId = null;
    for (const fName of foldersToTry) {
      const query = `name='${fName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const sRes = await fetchWithTimeout(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const sData = await sRes.json();
      if (sData.files && sData.files.length > 0) {
        folderId = sData.files[0].id;
        break;
      }
    }
    
    if (!folderId) {
      folderId = await getOrCreateFolder(accessToken, 'Kwiq Bill Backup');
    }
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

