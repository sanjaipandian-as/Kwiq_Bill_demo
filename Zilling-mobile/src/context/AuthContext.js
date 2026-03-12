import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveUserDetailsToDrive, syncUserDataToDrive, restoreUserDataFromDrive } from '../services/googleDriveservices';
import { fetchAllTableData, clearDatabase, db, switchUserDatabase } from '../services/database';
import services from '../services/api';

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
      if (currentUserStr) {
        try {
          const u = JSON.parse(currentUserStr);
          if (u.email) await AsyncStorage.setItem('last_logged_in_email', u.email);
        } catch (e) { }
      }

      setUser(null);
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('just_logged_in');

      // Clear sync in-memory cache
      const { SyncService } = require('../services/OneWaySyncService');
      const { logoutDB } = require('../services/database');
      SyncService.logout();
      logoutDB();

      // We NO LONGER wipe the database or sync state on logout.
      // This preserves the data for instant loading if the same user logs back in.
      // Wiping now exclusively happens in googleLogin() if a DIFFERENT user logs in.
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return null;

      const latestUser = await services.auth.getCurrentUser();
      if (latestUser) {
        const savedUserDataStr = await AsyncStorage.getItem('user');
        const userData = savedUserDataStr ? JSON.parse(savedUserDataStr) : {};
        
        const updatedUser = {
          ...userData,
          backendId: latestUser.id,
          trialExpiresAt: latestUser.trialExpiresAt,
          plan: latestUser.plan,
          planExpiresAt: latestUser.planExpiresAt,
          isBlocked: latestUser.isBlocked,
        };
        
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        console.log('[Auth] User profile refreshed from backend. Plan:', latestUser.plan);
        return updatedUser;
      }
    } catch (error) {
      console.log('[Auth] Failed to refresh user profile:', error.message);
      if (error.response && (error.response.status === 401 || error.response.status === 404)) {
        await logout();
      }
    }
    return null;
  }, [logout]);

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
          // Auto-refresh from backend
          await refreshUser();
        } else if (savedUserDataStr && !currentUser) {
          // Attempt silent sign-in if we have a saved user but no active session object
          try {
            const user = await GoogleSignin.signInSilently();
            if (user) {
              setUser(JSON.parse(savedUserDataStr));
              // Auto-refresh from backend
              await refreshUser();
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
        if (authResponse.user.trialExpiresAt) userData.trialExpiresAt = authResponse.user.trialExpiresAt;
        if (authResponse.user.plan) userData.plan = authResponse.user.plan;
        if (authResponse.user.planExpiresAt) userData.planExpiresAt = authResponse.user.planExpiresAt;
        if (authResponse.user.isBlocked !== undefined) userData.isBlocked = authResponse.user.isBlocked;
      }
      // 3. Save secure token
      if (backendToken && backendToken !== idToken) {
        await AsyncStorage.setItem('token', backendToken);
      } else {
        await AsyncStorage.removeItem('token');
      }

      // Critical: Save user to storage BEFORE sync so SyncService uses the correct user-specific keys.
      await AsyncStorage.setItem('user', JSON.stringify(userData));

      // PRODUCTION GRADE: Physically isolate this user's data into their own .db file.
      // This ensures User B can NEVER see User A's data even if sync fails.
      await switchUserDatabase(userData.email);

      // 4. RESTORE: Fetch Snapshot & Settings from Drive
      try {
        const lastEmail = await AsyncStorage.getItem('last_logged_in_email');
        const isSameUser = lastEmail === userData.email;

        let needsFullRestore = true;

        if (isSameUser) {
          try {
            const result = db.getFirstSync('SELECT COUNT(*) as count FROM products');
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
          if (onProgress) onProgress('Locating baseline snapshot...', 0.2);
          
          const { SyncService } = require('../services/OneWaySyncService');
          
          // 1. Try Rapid Snapshot Hardware Restore
          const snapshotSuccess = await SyncService.restoreFromLatestSnapshot((msg, prog) => {
            if (onProgress) onProgress(msg, 0.2 + (prog * 0.3));
          });

          if (!snapshotSuccess) {
            console.log('[Auth] No snapshots found, falling back to full Drive restoration.');
            if (onProgress) onProgress('Searching for legacy backups...', 0.3);
            
            // 2. Fallback to Legacy/Desktop Restoration Logic
            await SyncService.resetSyncState(); 
            await restoreUserDataFromDrive(userData, (msg, prog, stats) => {
              if (onProgress) onProgress(msg, prog, stats);
            });
          }
        } else {
          console.log('[Auth] Skipped Drive restore. Local data belongs to ' + userData.email);
          if (onProgress) onProgress('Loading local storage...', 0.5);
        }
      } catch (restoreErr) {
        console.error('Restore failed:', restoreErr);
      }

      // 6. AUTO-SYNC: Sync Down Events (Apply deltas)
      try {
        console.log('Starting Initial Sync Down...');
        if (onProgress) onProgress('Syncing transactions...', 0.65);

        const { SyncService } = require('../services/OneWaySyncService');

        // Custom progress handler for the sync service 
        const syncProgressHandler = (msg, progress, stats) => {
          if (onProgress) onProgress(msg, progress || 0.75, stats);
        };

        await SyncService.syncDown(syncProgressHandler);

        if (onProgress) onProgress('Updating cloud backup...', 0.95);
        await saveUserDetailsToDrive(userData);
      } catch (syncError) {
        console.error('Initial Sync Down failed:', syncError);
      }

      // 5. Update State & Persist
      if (onProgress) onProgress('Finishing up...', 1.0);
      await new Promise(r => setTimeout(r, 800)); 


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