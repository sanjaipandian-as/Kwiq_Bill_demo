import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveUserDetailsToDrive, syncUserDataToDrive, restoreUserDataFromDrive } from '../services/googleDriveservices';
import { fetchAllTableData, clearDatabase } from '../services/database';
import services from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { GoogleSignin } = require('@react-native-google-signin/google-signin');
        const currentUser = await GoogleSignin.getCurrentUser();

        // Keeps login/session data in AsyncStorage
        const savedUser = await AsyncStorage.getItem('user');

        // Only restore session if both local user exists AND Google session is active
        if (savedUser && currentUser) {
          setUser(JSON.parse(savedUser));
        } else if (savedUser && !currentUser) {
          // Attempt silent sign-in if we have a saved user but no active session object
          try {
            const user = await GoogleSignin.signInSilently();
            if (user) {
              setUser(JSON.parse(savedUser));
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
      let backendToken = idToken;
      try {
        if (onProgress) onProgress('Connecting to server...', 0.2);
        console.log('Exchanging token with backend...');
        const authResponse = await services.auth.googleLogin(idToken);
        if (authResponse && authResponse.token) {
          backendToken = authResponse.token;
          // Update userData with backend ID if available
          if (authResponse.user && authResponse.user.id) {
            userData.backendId = authResponse.user.id;
          }
          console.log('Successfully exchanged Google token for backend JWT');
        }
      } catch (authError) {
        console.warn('Backend Auth Exchange failed:', authError.message);
        // Alert removed to keep sync UI smooth
      }

      // 3. Save locally - ONLY TOKEN for now, we save USER after sync
      if (backendToken && backendToken !== idToken) {
        await AsyncStorage.setItem('token', backendToken);
      } else {
        await AsyncStorage.removeItem('token');
      }

      // 4. RESTORE: Fetch Snapshot & Settings from Drive (Before setting user state)
      try {
        await restoreUserDataFromDrive(userData, onProgress);
      } catch (restoreErr) {
        console.log('Restore failed:', restoreErr);
      }

      // 6. AUTO-SYNC: Sync Down Events (Apply deltas)
      try {
        console.log('Starting Initial Sync Down...');
        if (onProgress) onProgress('Syncing transactions...', 0.65);

        const { SyncService } = require('../services/OneWaySyncService');

        // Custom progress handler for the sync service - pass through granular progress
        const syncProgressHandler = (msg, progress) => {
          if (onProgress) onProgress(msg, progress || 0.75);
        };

        await SyncService.syncDown(syncProgressHandler);

        if (onProgress) onProgress('Updating cloud backup...', 0.95);
        await saveUserDetailsToDrive(userData);
      } catch (syncError) {
        console.log('Initial Sync Down failed:', syncError);
      }

      // 5. Update State & Persist ONLY after 100% completion
      if (onProgress) onProgress('Finishing up...', 1.0);
      await new Promise(r => setTimeout(r, 800)); // Delay for UX

      // Critical: Don't set user in storage or state until sync is complete
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);

      return userData;
    } catch (error) {
      console.error('Local Auth Error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');
      await GoogleSignin.signOut();
    } catch (e) {
      console.log('Google signOut error:', e);
    } finally {
      setUser(null);
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      await clearDatabase();
      const { SyncService } = require('../services/OneWaySyncService');
      await SyncService.resetSyncState();
      await AsyncStorage.multiRemove(['app_settings', 'last_synced_timestamp', 'processed_events_ids', 'pending_upload_queue']);
    }
  };

  return (
    <AuthContext.Provider value={{ user, googleLogin, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};