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
        // Keeps login/session data in AsyncStorage
        const savedUser = await AsyncStorage.getItem('user');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
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

      // 3. Save locally
      if (backendToken && backendToken !== idToken) {
        await AsyncStorage.setItem('token', backendToken);
      } else {
        await AsyncStorage.removeItem('token');
      }
      await AsyncStorage.setItem('user', JSON.stringify(userData));

      // 4. RESTORE: Fetch Snapshot & Settings from Drive (Before setting user state)
      try {
        await restoreUserDataFromDrive(userData, onProgress);
      } catch (restoreErr) {
        console.log('Restore failed:', restoreErr);
      }

      // 6. AUTO-SYNC: Sync Down Events (Apply deltas)
      try {
        console.log('Starting Initial Sync Down...');
        if (onProgress) onProgress('Syncing recent transactions...', 0.6);

        const { SyncService } = require('../services/OneWaySyncService');

        // Custom progress handler for the sync service
        const syncProgressHandler = (msg) => {
          if (onProgress) onProgress(msg, 0.7);
        };

        await SyncService.syncDown(syncProgressHandler);

        if (onProgress) onProgress('Updating cloud backup...', 0.9);
        await saveUserDetailsToDrive(userData);
      } catch (syncError) {
        console.log('Initial Sync Down failed:', syncError);
      }

      // 5. Update State
      if (onProgress) onProgress('Finalizing...', 1.0);
      await new Promise(r => setTimeout(r, 500)); // Small delay for UX

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