import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';
import * as SecureStore from 'expo-secure-store';
import { syncSecurityVaultToDrive, fetchSecurityVaultFromDrive } from './googleDriveservices';

const VAULT_METADATA_KEY = '@security_vault_meta';
const VAULT_CACHE_KEY = '@security_vault_cache';

// SecureStore Keys Schema
const SECURE_KEYS = {
  MASTER_KEY: 'kwiq.master_key',
  HMAC_KEY: 'kwiq.hmac_key',
  PIN_HASH: 'kwiq.pin_hash',
  PIN_SALT: 'kwiq.pin_salt',
  LOCKOUT_META: 'kwiq.lockout_meta'
};

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYSIZE = 256 / 32;

/**
 * Utility: Get or create cryptographically random secret in SecureStore
 */
const getOrCreateSecret = async (key, lengthBytes = 32) => {
  let secret = await SecureStore.getItemAsync(key);
  if (!secret) {
    secret = CryptoJS.lib.WordArray.random(lengthBytes).toString(CryptoJS.enc.Hex);
    await SecureStore.setItemAsync(key, secret);
  }
  return secret;
};

/**
 * Utility: Compute HMAC-SHA256 signature
 */
const computeHMAC = (data, key) => {
  return CryptoJS.HmacSHA256(data, key).toString(CryptoJS.enc.Hex);
};

export const SecurityService = {
  
  /**
   * Save vault with Hardware-Backed Keys, PBKDF2 Hashing, and HMAC Signatures.
   */
  saveVault: async (user, pin, receptionists) => {
    if (!user || (!pin && !receptionists)) return { success: false, error: 'Incomplete data' };

    try {
      // 1. Initialize Root of Trust (Fix 1)
      const masterKey = await getOrCreateSecret(SECURE_KEYS.MASTER_KEY);
      const hmacKey = await getOrCreateSecret(SECURE_KEYS.HMAC_KEY);

      // 2. PBKDF2 PIN Hashing (Fix 2 & 3)
      if (pin) {
        // Generate random 16-byte salt
        const salt = CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
        const pinHash = CryptoJS.PBKDF2(pin, salt, {
          keySize: PBKDF2_KEYSIZE,
          iterations: PBKDF2_ITERATIONS,
          hasher: CryptoJS.algo.SHA256
        }).toString(CryptoJS.enc.Hex);

        await SecureStore.setItemAsync(SECURE_KEYS.PIN_SALT, salt);
        await SecureStore.setItemAsync(SECURE_KEYS.PIN_HASH, pinHash);
      }

      // 3. Prepare Encrypted Vault Payload
      const vaultData = {
        receptionists: receptionists || [],
        updatedAt: new Date().toISOString()
      };

      // Ensure no PIN inside vaultData in plain text
      const vaultStr = JSON.stringify(vaultData);
      
      // Encrypt with Master Key
      const encryptedCache = CryptoJS.AES.encrypt(vaultStr, masterKey).toString();
      
      // 4. HMAC Vault Integrity Verification (Fix 5)
      const signature = computeHMAC(encryptedCache, hmacKey);
      
      const payload = {
        data: encryptedCache,
        signature: signature
      };

      // 5. Local Storage (Encrypted + Signed)
      await AsyncStorage.setItem(VAULT_CACHE_KEY, JSON.stringify(payload));
      
      const meta = {
        hasPin: !!pin,
        receptionistCount: receptionists?.length || 0,
        lastSyncAt: new Date().toISOString()
      };
      await AsyncStorage.setItem(VAULT_METADATA_KEY, JSON.stringify(meta));
      
      // 6. Primary Storage Sync (Google Drive)
      const driveSuccess = await syncSecurityVaultToDrive(user, payload);
      
      if (!driveSuccess) {
        console.warn('[SecurityService] Cloud save failed, data kept in local retry queue.');
        await AsyncStorage.setItem('@security_vault_dirty', 'true');
        return { success: true, cloudSynced: false };
      }

      await AsyncStorage.setItem('@security_vault_dirty', 'false');
      return { success: true, cloudSynced: true };
    } catch (err) {
      console.error('[SecurityService] Save failed:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Verify PIN with PBKDF2 algorithm + Exponential Lockout (Fix 2, 4).
   */
  verifyPin: async (inputPin, userEmail) => {
    try {
      if (!inputPin) return false;
      
      // Check Lockout Status
      const lockoutMetaStr = await SecureStore.getItemAsync(SECURE_KEYS.LOCKOUT_META);
      let lockoutMeta = lockoutMetaStr ? JSON.parse(lockoutMetaStr) : { attempts: 0, last_fail: 0 };
      
      let lockDuration = 0;
      if (lockoutMeta.attempts >= 10) lockDuration = 24 * 60 * 60 * 1000;
      else if (lockoutMeta.attempts >= 7) lockDuration = 30 * 60 * 1000;
      else if (lockoutMeta.attempts >= 5) lockDuration = 5 * 60 * 1000;
      else if (lockoutMeta.attempts >= 3) lockDuration = 30 * 1000;

      if (lockDuration > 0) {
        const timePassed = Date.now() - lockoutMeta.last_fail;
        if (timePassed < lockDuration) {
          console.warn('[SecurityService] App is locked. Try again later.');
          return false;
        }
      }
      
      // Perform Verification
      const savedHash = await SecureStore.getItemAsync(SECURE_KEYS.PIN_HASH);
      const savedSalt = await SecureStore.getItemAsync(SECURE_KEYS.PIN_SALT);
      
      if (!savedHash || !savedSalt) {
         return false;
      }
      
      const inputHash = CryptoJS.PBKDF2(inputPin, savedSalt, {
        keySize: PBKDF2_KEYSIZE,
        iterations: PBKDF2_ITERATIONS,
        hasher: CryptoJS.algo.SHA256
      }).toString(CryptoJS.enc.Hex);
      
      if (inputHash === savedHash) {
        // Reset Lockout
        await SecureStore.setItemAsync(SECURE_KEYS.LOCKOUT_META, JSON.stringify({ attempts: 0, last_fail: 0 }));
        return true;
      } else {
        // Record Attempt
        lockoutMeta.attempts += 1;
        lockoutMeta.last_fail = Date.now();
        
        if (lockoutMeta.attempts >= 15) {
          // Nuclear Wipe
          await SecureStore.deleteItemAsync(SECURE_KEYS.MASTER_KEY);
          await SecureStore.deleteItemAsync(SECURE_KEYS.PIN_HASH);
          await SecureStore.deleteItemAsync(SECURE_KEYS.PIN_SALT);
          await SecureStore.deleteItemAsync(SECURE_KEYS.HMAC_KEY);
          await AsyncStorage.removeItem(VAULT_CACHE_KEY);
          await AsyncStorage.removeItem(VAULT_METADATA_KEY);
          console.error('[SecurityService] Vault Wiped due to too many failed attempts');
          return false;
        }
        
        await SecureStore.setItemAsync(SECURE_KEYS.LOCKOUT_META, JSON.stringify(lockoutMeta));
        return false;
      }
    } catch (err) {
      console.error('[SecurityService] App error during verify', err);
      return false;
    }
  },

  /**
   * Retrieve Vault Payload, Validate HMAC, Return Content
   */
  _decryptAndVerifyPayload: async (payload) => {
    if (!payload || !payload.data || !payload.signature) return null;
    
    const masterKey = await SecureStore.getItemAsync(SECURE_KEYS.MASTER_KEY);
    const hmacKey = await SecureStore.getItemAsync(SECURE_KEYS.HMAC_KEY);
    
    if (!masterKey || !hmacKey) return null; // Can't decrypt if no keys

    // Verify HMAC
    const computedSig = computeHMAC(payload.data, hmacKey);
    if (computedSig !== payload.signature) {
       console.error('[SecurityService] TAMPERING DETECTED: Invalid HMAC signature!');
       // Possible alarm or wipe could be triggered here
       return null;
    }

    // Decrypt
    try {
       const bytes = CryptoJS.AES.decrypt(payload.data, masterKey);
       const decrypted = bytes.toString(CryptoJS.enc.Utf8);
       return JSON.parse(decrypted);
    } catch(e) {
       console.error('[SecurityService] Decryption failed', e);
       return null;
    }
  },

  /**
   * Safe fetch for receptionists with integrity checking.
   */
  getReceptionists: async (user) => {
    try {
      // 1. Check Cloud
      const cloudPayload = await fetchSecurityVaultFromDrive(user);
      if (cloudPayload && cloudPayload.data) {
         // Trust Cloud, Update Local
         // Because payload data doesn't use email as key anymore, we can just save it.
         await AsyncStorage.setItem(VAULT_CACHE_KEY, JSON.stringify(cloudPayload));
         const vault = await SecurityService._decryptAndVerifyPayload(cloudPayload);
         if (vault) return vault.receptionists || [];
      }

      // 2. Check Local Fallback
      const localStr = await AsyncStorage.getItem(VAULT_CACHE_KEY);
      if (localStr) {
         const localPayload = JSON.parse(localStr);
         const vault = await SecurityService._decryptAndVerifyPayload(localPayload);
         if (vault) return vault.receptionists || [];
      }

      return [];
    } catch (err) {
      console.warn('[SecurityService] Fetch failed:', err.message);
      return [];
    }
  },

  /**
   * Background retry syncing for Cloud.
   */
  retryPendingSync: async (user) => {
    const isDirty = await AsyncStorage.getItem('@security_vault_dirty');
    if (isDirty === 'true') {
      const localStr = await AsyncStorage.getItem(VAULT_CACHE_KEY);
      if (localStr) {
         const payload = JSON.parse(localStr);
         const success = await syncSecurityVaultToDrive(user, payload);
         if (success) await AsyncStorage.setItem('@security_vault_dirty', 'false');
      }
    }
  }
};
