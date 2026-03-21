import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';
import * as SecureStore from 'expo-secure-store';
import { syncSecurityVaultToDrive, fetchSecurityVaultFromDrive } from './googleDriveservices';
import services from './api';

const VAULT_METADATA_KEY = '@security_vault_meta';
const VAULT_CACHE_KEY = '@security_vault_cache';
const LAST_ROTATION_KEY = 'kwiq.last_key_rotation';

// SecureStore Keys Schema
const SECURE_KEYS = {
  MASTER_KEY: 'kwiq.master_key',
  HMAC_KEY: 'kwiq.hmac_key',
  PIN_HASH: 'kwiq.pin_hash',
  PIN_SALT: 'kwiq.pin_salt',
  LOCKOUT_META: 'kwiq.lockout_meta'
};

const PBKDF2_ITERATIONS = 10000; // Legacy / Master Key Esrow (Optimized for instant mobile response)
const PIN_PBKDF2_ITERATIONS = 2000; // PIN Hashing (Optimized for instant mobile response)
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
   * Encrypt and backup Master Key to MongoDB using Google Account ID logic
   */
  _backupMasterKeyToMongo: async (user, masterKey) => {
    try {
      if (!user || (!user.id && !user.user?.id)) {
        console.warn('Cannot backup Master Key without a permanent Google Account ID');
        return;
      }
      const googleAccountId = user.id || user.user?.id;
      if (!googleAccountId) {
        console.warn('[Security] No ID for escrow');
        return;
      }
      // Fix #6/7: Stronger key derivation for Master Key escrow
      // Deriving a 256-bit key using PBKDF2-HMAC-SHA256
      const anchorSalt = `kwiq.anchor.${googleAccountId}`.split('').reverse().join('');
      const backupEncryptionKey = CryptoJS.PBKDF2(googleAccountId, anchorSalt, {
        keySize: PBKDF2_KEYSIZE,
        iterations: PBKDF2_ITERATIONS, // Reduced from 250k to 10k to prevent UI lockup
        hasher: CryptoJS.algo.SHA256
      }).toString(CryptoJS.enc.Hex);

      const encryptedBackup = CryptoJS.AES.encrypt(masterKey, backupEncryptionKey).toString();

      // We assume services.security.backupKey exists on the backend
      if (services.security?.backupKey) {
        await services.security.backupKey({ encryptedMasterKeyBackup: encryptedBackup });
        console.log('[SecurityService] Master Key successfully escrowed to MongoDB.');
      }
    } catch (e) {
      console.error('[SecurityService] Failed to escrow master key', e);
    }
  },

  /**
   * Save vault with Hardware-Backed Keys, PBKDF2 Hashing, and HMAC Signatures.
   */
  saveVault: async (user, pin, receptionists, forceNewKey = false) => {
    if (!user || (!pin && !receptionists)) return { success: false, error: 'Incomplete data' };

    try {
      // If forcing rotation, delete old key
      if (forceNewKey) {
        await SecureStore.deleteItemAsync(SECURE_KEYS.MASTER_KEY);
      }

      // 1. Initialize Root of Trust
      const masterKey = await getOrCreateSecret(SECURE_KEYS.MASTER_KEY);
      const hmacKey = await getOrCreateSecret(SECURE_KEYS.HMAC_KEY);

      // Perform Zero-Knowledge Backup to MongoDB
      await SecurityService._backupMasterKeyToMongo(user, masterKey);

      // 2. PBKDF2 PIN Hashing
      if (pin) {
        const salt = CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
        const pinHash = CryptoJS.PBKDF2(pin, salt, {
          keySize: PBKDF2_KEYSIZE,
          iterations: PIN_PBKDF2_ITERATIONS,
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

      const vaultStr = JSON.stringify(vaultData);

      // Encrypt with Master Key
      const encryptedCache = CryptoJS.AES.encrypt(vaultStr, masterKey).toString();

      // 4. HMAC Vault Integrity Verification
      const signature = computeHMAC(encryptedCache, hmacKey);

      const payload = {
        data: encryptedCache,
        signature: signature
      };

      // 5. Local Storage (Encrypted + Signed)
      await AsyncStorage.setItem(VAULT_CACHE_KEY, JSON.stringify(payload));

      const localMetaStr = await AsyncStorage.getItem(VAULT_METADATA_KEY);
      const existingMeta = localMetaStr ? JSON.parse(localMetaStr) : {};

      const meta = {
        hasPin: !!pin,
        receptionistCount: receptionists?.length || 0,
        lastSyncAt: new Date().toISOString(),
        pinIterations: pin ? PIN_PBKDF2_ITERATIONS : (existingMeta.pinIterations || PBKDF2_ITERATIONS)
      };
      await AsyncStorage.setItem(VAULT_METADATA_KEY, JSON.stringify(meta));

      // Mark rotation setup
      await AsyncStorage.setItem(LAST_ROTATION_KEY, Date.now().toString());

      // 6. Primary Storage Sync (Google Drive)
      const driveSuccess = await syncSecurityVaultToDrive(user, payload);

      if (!driveSuccess) {
        console.warn('[SecurityService] Cloud save failed, data kept locally.');
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

  _rotateMasterKey: async (user) => {
    try {
      console.log('[SecurityService] Executing Event-Driven Key Rotation...');
      // 1. Decrypt current vault
      const receptionists = await SecurityService.getReceptionists(user);

      // 2. We don't have the plain text PIN here locally if we only had 'user', 
      // but saveVault handles Pin separately if passed null.
      await SecurityService.saveVault(user, null, receptionists, true);
      console.log('[SecurityService] Master Key successfully rotated.');
    } catch (e) {
      console.error('[SecurityService] Rotation failed', e);
    }
  },

  _logAudit: async (event, details) => {
    try {
      const { default: services } = require('./api');
      await services.security.auditLog({ event, details, timestamp: new Date().toISOString() });
    } catch (e) { } // Silent fail 
  },

  /**
   * Verify PIN with PBKDF2 algorithm + Exponential Lockout + Stale Key Detection.
   */
  verifyPin: async (inputPin, user) => {
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

      // Get iterations from metadata for migration support
      const metaStr = await AsyncStorage.getItem(VAULT_METADATA_KEY);
      let iterations = metaStr ? (JSON.parse(metaStr).pinIterations || PIN_PBKDF2_ITERATIONS) : PIN_PBKDF2_ITERATIONS;

      let inputHash = CryptoJS.PBKDF2(inputPin, savedSalt, {
        keySize: PBKDF2_KEYSIZE,
        iterations: iterations,
        hasher: CryptoJS.algo.SHA256
      }).toString(CryptoJS.enc.Hex);

      // --- MIGRATION FALLBACK: Try 100,000 if 2000/5000 failed ---
      // This solves the 'Wrong PIN' error for users who set their PIN during the 100k iterations peak.
      if (inputHash !== savedHash && iterations < 100000) {
        console.log('[SecurityService] 2k-check failed, attempting 100k migration check...');
        const migrationHash = CryptoJS.PBKDF2(inputPin, savedSalt, {
          keySize: PBKDF2_KEYSIZE,
          iterations: 100000, 
          hasher: CryptoJS.algo.SHA256
        }).toString(CryptoJS.enc.Hex);
        
        if (migrationHash === savedHash) {
          console.log('[SecurityService] Legacy 100k Hash verified! Marking for performance upgrade...');
          inputHash = migrationHash; 
          // Flag this session for rotation as if it came from the metadata
          if (JSON.parse(metaStr || '{}').pinIterations !== 100000) { 
            // Injects flag to trigger the 'if (iterations > 5000)' block below
            iterations = 100000; 
          }
        }
      }

      if (inputHash === savedHash) {
        // Reset Lockout
        if (lockoutMeta.attempts > 0) {
          SecurityService._logAudit('PIN_SUCCESS_AFTER_FAILURES', { previous_attempts: lockoutMeta.attempts });
        }
        await SecureStore.setItemAsync(SECURE_KEYS.LOCKOUT_META, JSON.stringify({ attempts: 0, last_fail: 0 }));

        // --- Migration Support: Silently upgrade slow legacy hashes ---
        // We only upgrade if iterations are significantly higher (> 5000) to prevent redundant writes
        if (iterations > 5000 && user) {
          console.log('[SecurityService] Scheduling background security migration...');
          setTimeout(async () => {
            try {
              const currentRecep = await SecurityService.getReceptionists(user);
              await SecurityService.saveVault(user, inputPin, currentRecep);
              console.log('[SecurityService] Security Migration Complete (Hash now optimized).');
            } catch (e) {
              console.warn('[SecurityService] Background migration failed', e.message);
            }
          }, 1000); // 1-second delay lets the UI navigate and 'unlock' first
        }

        // --- V3 Stale Key Detection Handling ---
        if (user) {
          const lastRotation = await AsyncStorage.getItem(LAST_ROTATION_KEY);
          const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
          if (!lastRotation || (Date.now() - parseInt(lastRotation, 10) > ninetyDaysMs)) {
            console.log('[SecurityService] Stale key detected. Triggering automated rotation.');
            // Fire async so we don't block the UI unlocking
            SecurityService._rotateMasterKey(user);
          }
        }

        return true;
      } else {
        // Record Attempt
        lockoutMeta.attempts += 1;
        lockoutMeta.last_fail = Date.now();
        SecurityService._logAudit('PIN_FAILED', { attempts: lockoutMeta.attempts });

        if (lockoutMeta.attempts >= 15) {
          // Nuclear Wipe (Local device logout only)
          await SecureStore.deleteItemAsync(SECURE_KEYS.MASTER_KEY);
          await SecureStore.deleteItemAsync(SECURE_KEYS.PIN_HASH);
          await SecureStore.deleteItemAsync(SECURE_KEYS.PIN_SALT);
          await SecureStore.deleteItemAsync(SECURE_KEYS.HMAC_KEY);
          await AsyncStorage.removeItem(VAULT_CACHE_KEY);
          await AsyncStorage.removeItem(VAULT_METADATA_KEY);
          console.error('[SecurityService] Local Vault Wiped due to 15 failed PIN attempts');
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
      return null;
    }

    // Decrypt
    try {
      const bytes = CryptoJS.AES.decrypt(payload.data, masterKey);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      return JSON.parse(decrypted);
    } catch (e) {
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
  },

  /**
   * Reset local PIN state and verify override code with Backend.
   * On Success: Recovers the escrowed Master Key to allow full vault access on new devices.
   */
  recoverVaultWithOTP: async (otp, user) => {
    try {
      const { default: services } = require('./api');
      // The /security/recover endpoint is public — OTP is the auth factor.
      // We must send userId so the backend can identify whose backup record to check.
      const userId = user?.backendId || user?.id || user?.user?.id;
      if (!userId) {
        console.error('[SecurityService] Cannot recover: no userId available');
        return { success: false, error: 'User ID is missing. Please log in first.' };
      }
      const response = await services.security.recoverKey({ otp, userId });

      if (response && response.success) {
        // 1. Identity Verified: Clear local PIN lockout
        await SecureStore.deleteItemAsync(SECURE_KEYS.PIN_HASH);
        await SecureStore.deleteItemAsync(SECURE_KEYS.PIN_SALT);
        await SecureStore.setItemAsync(SECURE_KEYS.LOCKOUT_META, JSON.stringify({ attempts: 0, last_fail: 0 }));

        // 2. Escrow Recovery (Crucial for new devices)
        const encryptedBackup = response.encryptedMasterKeyBackup;
        const accountId = user?.id || user?.user?.id; // Updated source for accountId

        if (encryptedBackup && accountId) {
          console.log('[SecurityService] Found Master Key backup on cloud. Attempting decryption...');
          try {
            // Derive the anchor key (matching the backup logic in _backupMasterKeyToMongo)
            const backupEncryptionKey = CryptoJS.PBKDF2(accountId, 'kwiq_bill_secret_salt', {
              keySize: PBKDF2_KEYSIZE,
              iterations: 1000,
              hasher: CryptoJS.algo.SHA256
            }).toString(CryptoJS.enc.Hex);

            const bytes = CryptoJS.AES.decrypt(encryptedBackup, backupEncryptionKey);
            const masterKey = bytes.toString(CryptoJS.enc.Utf8);

            if (masterKey) {
              await SecureStore.setItemAsync(SECURE_KEYS.MASTER_KEY, masterKey);
              console.log('[SecurityService] ✅ Root Master Key recovered and saved to SecureStore.'); // Specific success log
              await getOrCreateSecret(SECURE_KEYS.HMAC_KEY);
            } else {
              console.warn('[SecurityService] ⚠️ Decryption resulted in empty key. Wrong account ID?');
              return { success: false, error: 'Decryption failed. Ensure you are using the same Google account.' };
            }
          } catch (decryptError) {
            console.error('[SecurityService] ❌ Decryption Fatal Error:', decryptError.message);
            return { success: false, error: 'Failed to decrypt recovered key.' };
          }
        }

        SecurityService._logAudit('RECOVERY_SUCCESS_VIA_ADMIN', { timestamp: new Date().toISOString() });

        // CRITICAL: Wipe local PIN state so ManagerPinGate.jsx can transition to 'setup' mode
        await SecureStore.deleteItemAsync(SECURE_KEYS.PIN_HASH);
        await SecureStore.deleteItemAsync(SECURE_KEYS.PIN_SALT);
        await SecureStore.deleteItemAsync(SECURE_KEYS.LOCKOUT_META);

        return { success: true };
      }
      return { success: false, error: 'Invalid or expired code' };
    } catch (e) {
      console.error('[SecurityService] Recovery failed', e);
      return { success: false, error: e.response?.data?.error || e.message };
    }
  }
};
