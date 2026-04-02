import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveUserDetailsToDrive, syncUserDataToDrive, restoreUserDataFromDrive } from '../services/googleDriveservices';
import { fetchAllTableData, clearDatabase, db, switchUserDatabase } from '../services/database';
import services from '../services/api';
import * as SecureStore from 'expo-secure-store';
import { clearSensitiveStoreData } from '../utils/storageKeys';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(async () => {
    try {
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');
      await GoogleSignin.signOut();
    } catch (e) {
      console.log('Google signOut error:', e);
    } finally {
      // Save their email before removing the user object so we know who the local DB belongs to
      const currentUserStr = await AsyncStorage.getItem('user');
      let currentEmail = null;
      if (currentUserStr) {
        try {
          const u = JSON.parse(currentUserStr);
          if (u.email) {
            currentEmail = u.email;
            await AsyncStorage.setItem('last_logged_in_email', u.email);
          }
        } catch (e) { }
      }

      // ── STEP 1: Clear sensitive session-scoped store & bank data ──
      // This ensures next login always fetches fresh data from the server.
      // Auth preferences and last-used email are intentionally kept.
      await clearSensitiveStoreData(currentEmail);

      // CRITICAL: Wipe session and tokens
      await SecureStore.deleteItemAsync('token');
      
      // 🛡️ SECURITY FIX: Clear all master keys and security metadata on logout.
      // This ensures that when a new user logs in, they don't inherit the previous user's Master Key,
      // which would cause decryption failures for their own vault.
      try {
        const { SECURE_KEYS } = require('../services/SecurityService');
        await Promise.all(
          Object.values(SECURE_KEYS).map(key => SecureStore.deleteItemAsync(key).catch(() => {}))
        );
      } catch (e) {
        // Fallback for direct deletion if service import fails
        ['kwiq.master_key', 'kwiq.hmac_key', 'kwiq.pin_hash', 'kwiq.pin_salt', 'kwiq.lockout_meta'].forEach(async key => {
           await SecureStore.deleteItemAsync(key).catch(() => {});
        });
      }

      // Wipe ALL session-specific AsyncStorage keys
      const { SESSION_KEYS } = require('../utils/storageKeys');
      await Promise.all(
        Object.values(SESSION_KEYS).map(key => AsyncStorage.removeItem(key).catch(() => {}))
      );

      // Clear sync in-memory cache and wait for DB to close 
      const { SyncService } = require('../services/OneWaySyncService');
      const { logoutDB } = require('../services/database');
      
      // 🟢 CRITICAL: Wipe module caches
      SyncService.logout();
      
      // 🟢 CRITICAL: Wait for handle to close BEFORE clearing user state
      await logoutDB(); 

      // 🛡️ SECURITY: Explicitly invalidate the local access token for this user
      if (currentEmail) {
        try {
          const tokenKey = `local_access_token_${currentEmail.replace(/[@.]/g, '_')}`;
          await AsyncStorage.removeItem(tokenKey);
        } catch (e) { }
      }

      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      // PRO-GRADE THROTTLE: Don't hit the backend if we refreshed in the last 5 minutes
      const lastFresh = await AsyncStorage.getItem('last_user_refresh_ts');
      const now = Date.now();
      if (lastFresh && (now - parseInt(lastFresh) < 5 * 60 * 1000)) {
        console.log('[Auth] Profile is still fresh, skipping backend hit.');
        return user;
      }

      const token = await SecureStore.getItemAsync('token');
      if (!token) return null;

      const latestUser = await services.auth.getCurrentUser();
      if (latestUser) {
        const savedUserDataStr = await AsyncStorage.getItem('user');
        const userData = savedUserDataStr ? JSON.parse(savedUserDataStr) : {};
        
        const updatedUser = {
          ...userData,
          backendId: latestUser.id,
          role: latestUser.role,
          trialExpiresAt: latestUser.trialExpiresAt,
          plan: latestUser.plan,
          planExpiresAt: latestUser.planExpiresAt,
          isBlocked: latestUser.isBlocked,
          encryptedMasterKeyBackup: latestUser.encryptedMasterKeyBackup,
        };
        
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        await AsyncStorage.setItem('last_user_refresh_ts', String(now));
        setUser(updatedUser);
        console.log('[Auth] User profile refreshed. Role:', latestUser.role);
        return updatedUser;
      }
    } catch (error) {
      console.log('[Auth] Failed to refresh user profile:', error.message);
      if (error.response && (error.response.status === 401 || error.response.status === 404)) {
        await logout();
      }
    }
    return null;
  }, [logout, user]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { GoogleSignin } = require('@react-native-google-signin/google-signin');
        const currentUser = await GoogleSignin.getCurrentUser();

        // Keeps login/session data in AsyncStorage
        const savedUserDataStr = await AsyncStorage.getItem('user');

        // Only restore session if both local user exists AND Google session is active
        if (savedUserDataStr && currentUser) {
          const userData = JSON.parse(savedUserDataStr);
          // PRODUCTION GRADE: Immediately switch to the correct user database file
          await switchUserDatabase(userData.email);
          setUser(userData);
          setIsLoading(false); // 🚀 UNLOCK AUTH UI IMMEDIATELY

          // Auto-refresh from backend in background
          refreshUser().catch(() => {});
        } else if (savedUserDataStr && !currentUser) {
          // Attempt silent sign-in if we have a saved user but no active session object
          try {
            const user = await GoogleSignin.signInSilently();
            if (user) {
              const u = JSON.parse(savedUserDataStr);
              setUser(u);
              setIsLoading(false); // 🚀 UNLOCK AUTH UI IMMEDIATELY
              refreshUser().catch(() => {});
            } else {
              await logout(); // Clear everything if session is truly gone
            }
          } catch (e) {
            await logout();
          }
        }
      } catch (error) {
        console.log('Auth init error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  const googleLogin = async (idToken, userProfile, onProgress) => {
    try {
      if (onProgress) onProgress('Verifying credentials...', 0.1);

      const userData = {
        id: userProfile.id,
        email: userProfile.email,
        name: userProfile.name,
        photo: userProfile.photo,
      };

      // 2. EXCHANGE: Send Google token to backend to get our own JWT
      if (onProgress) onProgress('Connecting to server...', 0.2);
      console.log('Exchanging token with backend...');

      const authResponse = await services.auth.googleLogin(idToken);

      if (!authResponse || !authResponse.token) {
        throw new Error('Backend failed to issue a secure token. Please try again.');
      }

      let backendToken = authResponse.token;
      // Update userData with backend ID and trial info if available
      if (authResponse.user) {
        if (authResponse.user.id) userData.backendId = authResponse.user.id;
        if (authResponse.user.role) userData.role = authResponse.user.role; // Added role
        if (authResponse.user.trialExpiresAt) userData.trialExpiresAt = authResponse.user.trialExpiresAt;
        if (authResponse.user.plan) userData.plan = authResponse.user.plan;
        if (authResponse.user.planExpiresAt) userData.planExpiresAt = authResponse.user.planExpiresAt;
        if (authResponse.user.isBlocked !== undefined) userData.isBlocked = authResponse.user.isBlocked;
        if (authResponse.user.encryptedMasterKeyBackup) userData.encryptedMasterKeyBackup = authResponse.user.encryptedMasterKeyBackup;
      }
      // 3. Save secure token
      if (backendToken && backendToken !== idToken) {
        await SecureStore.setItemAsync('token', backendToken);
      } else {
        await SecureStore.deleteItemAsync('token');
      }

      // Critical: Save user to storage BEFORE sync so SyncService uses the correct user-specific keys.
      await AsyncStorage.setItem('user', JSON.stringify(userData));

      // PRODUCTION GRADE: Physically isolate this user's data into their own .db file.
      await switchUserDatabase(userData.email);

      // --- 🛡️ SECURITY LAYER WARM-UP ---
      if (onProgress) onProgress('Engaging Security Layer...', 0.08);
      const { SyncService } = require('../services/OneWaySyncService');
      SyncService.setSyncContext(userData.email);
      
      const { prewarmEncryptionKeys } = require('../services/googleDriveservices');
      await prewarmEncryptionKeys(userData.email);
      if (onProgress) onProgress('Synchronizing Cloud Vaults...', 0.12);

      // 4. RESTORE: Fetch Snapshot & Settings from Drive
      try {
        const lastEmail = await AsyncStorage.getItem('last_logged_in_email');
        const isSameUser = lastEmail === userData.email;

        let needsFullRestore = true;

        if (isSameUser) {
          try {
            const result = await db.getFirstAsync('SELECT COUNT(*) as count FROM products');
            const { getUserSpecificKey, SETTINGS_KEY } = require('../utils/storageKeys');
            const settingsKey = getUserSpecificKey(SETTINGS_KEY, userData.email);
            const savedSettings = await AsyncStorage.getItem(settingsKey);
 
            if (savedSettings || (result && result.count > 0)) {
              needsFullRestore = false;
            }
          } catch (e) {
            console.log('Error checking local DB:', e);
          }
        }

        if (needsFullRestore) {
          if (onProgress) onProgress('Locating baseline snapshot...', 0.15);
          
          const { SyncService } = require('../services/OneWaySyncService');
          
          // 1. Try Rapid Snapshot Hardware Restore
          const snapshotSuccess = await SyncService.restoreFromLatestSnapshot((msg, prog) => {
            if (onProgress) onProgress(msg, 0.15 + (prog * 0.35)); // 15% -> 50%
          });

          if (!snapshotSuccess) {
            console.log('[Auth] No snapshots found, falling back to full Drive restoration.');
            if (onProgress) onProgress('Searching for legacy backups...', 0.2);
            
            // 2. Fallback to Legacy/Desktop Restoration Logic
            await SyncService.resetSyncState(); 
            await restoreUserDataFromDrive(userData, (msg, prog, stats) => {
              // restoreUserDataFromDrive internally uses its own range, 
              // but we wrap it into our linear flow here
              if (onProgress) onProgress(msg, 0.2 + (prog * 0.3), stats); // 20% -> 50%
            });
          }
        } else {
          console.log('[Auth] Skipped Drive restore. Local data belongs to ' + userData.email);
          if (onProgress) onProgress('Loading local storage...', 0.4);
        }
      } catch (restoreErr) {
        console.error('Restore failed:', restoreErr);
      }

      // 6. AUTO-SYNC: Sync Down Events (Apply deltas)
      try {
        console.log('Starting Initial Sync Down...');
        if (onProgress) onProgress('Syncing transactions...', 0.5);

        const { SyncService } = require('../services/OneWaySyncService');

        // Custom progress handler for the sync service 
        const syncProgressHandler = (msg, progress, stats) => {
          if (onProgress) onProgress(msg, progress || 0.55, stats);
        };

        // FORCE SYNC (Bypass cooldown on first login)
        await SyncService.syncDown(syncProgressHandler);

        // --- NEW: Restore Security Vault (Staff & PIN Metadata) ---
        if (onProgress) onProgress('Restoring security vault...', 0.9);
        const { SecurityService } = require('../services/SecurityService');
        await SecurityService.getReceptionists(userData); 
        if (onProgress) onProgress('Updating cloud backup...', 0.95);
        await saveUserDetailsToDrive(userData);
      } catch (syncError) {
        console.error('Initial Sync Down failed:', syncError);
      }

      // 5. Update State & Persist
      if (onProgress) onProgress('Finalizing local records...', 0.97);
      
      // ── MANDATORY POST-LOGIN FETCH ──
      // Always pull the latest store & bank details from MongoDB right after login.
      // This ensures the user never sees stale cached data from a previous session.
      // The settings cache was cleared at logout, so AsyncStorage has no store data yet.
      if (onProgress) onProgress('Fetching your store profile...', 0.98);
      try {
        const { getUserSpecificKey, SETTINGS_KEY: SK } = require('../utils/storageKeys');
        const settingsKey = getUserSpecificKey(SK, userData.email);

        const freshResponse = await services.settings.getSettings();
        const body = freshResponse?.data || freshResponse;
        
        // UNWRAP: Handle both direct object or { settings: ... } wrapper
        const freshSettings = (body && body.settings && typeof body.settings === 'object') 
          ? body.settings 
          : body;

        if (freshSettings && typeof freshSettings === 'object') {
          // Persist to user-specific AsyncStorage key so SettingsContext loads it instantly
          await AsyncStorage.setItem(settingsKey, JSON.stringify(freshSettings));
          console.log('[Auth] ✅ Fresh store/bank settings fetched and cached for:', userData.email);
        }
      } catch (settingsErr) {
        // Non-fatal: SettingsContext will fetch on its own if this fails
        console.warn('[Auth] Post-login settings fetch failed (non-fatal):', settingsErr.message);
      }

      if (onProgress) onProgress('Finalizing...', 1.0);
      
      // CRITICAL: Longer delay for old phones to allow SQLite and Contexts to finish indexing
      await new Promise(r => setTimeout(r, 1500)); 

      // Prevent SettingsContext from running a duplicate sync instantly
      await AsyncStorage.setItem('just_logged_in', 'true');

      setUser(userData);

      return userData;
    } catch (error) {
      console.error('Local Auth Error:', error);
      throw error;
    }
  };


  return (
    <AuthContext.Provider value={{ user, googleLogin, logout, refreshUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};