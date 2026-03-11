import React, { useEffect } from 'react'; // Added useEffect
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser'; // Add this
import { GoogleSignin } from '@react-native-google-signin/google-signin'; // Add this
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { ProductProvider } from './src/context/ProductContext';
import { CustomerProvider } from './src/context/CustomerContext';
import { TransactionProvider } from './src/context/TransactionContext';
import { SettingsProvider } from './src/context/SettingsContext';
// Add 'Platform' here
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { ExpenseProvider } from './src/context/ExpenseContext'
import { ToastProvider } from './src/context/ToastContext';
import { NetworkProvider } from './src/context/NetworkContext';
import SyncStatusIndicator from './src/components/SyncStatusIndicator';
import { initializeDB } from './src/services/database';
import './src/utils/crypto'; // Ensure crypto polyfill is active
import { useFonts } from 'expo-font';
import IndianScriptRenderer from './src/components/IndianScriptRenderer';
import { globalPrintRef } from './src/utils/printGlobals';

// Allows the auth session to close correctly on Android
WebBrowser.maybeCompleteAuthSession();

// Configure Google Sign-In outside the component to ensure it's ready immediately
GoogleSignin.configure({
  webClientId: "346340397259-6bimnha1f8j3u1tc0lmon55j398trdib.apps.googleusercontent.com",
  offlineAccess: true,
  scopes: ['profile', 'email', 'https://www.googleapis.com/auth/drive.file'],
});

// 1. Extract the inner stack that depends on User Data
const AuthenticatedApp = () => {
  const { useAuth } = require('./src/context/AuthContext');
  const { user } = useAuth();

  const TrialGuard = require('./src/components/TrialGuard').default;

  // Keying by user.id forces a complete unmount/remount of all these providers
  // whenever the user changes (Login/Logout).
  // This ensures no in-memory state (products, customers, etc.) leaks between sessions.
  return (
    <TrialGuard>
      <SettingsProvider user={user}>
        <CustomerProvider>
          <ProductProvider>
            <ExpenseProvider>
              <TransactionProvider>
                <AppNavigator />
                <SyncStatusIndicator />
              </TransactionProvider>
            </ExpenseProvider>
          </ProductProvider>
        </CustomerProvider>
      </SettingsProvider>
    </TrialGuard>
  );
};

import { PermissionsAndroid } from 'react-native';
import * as Device from 'expo-device';
export default function App() {
  const [fontsLoaded] = useFonts({
    'NotoSansTamil': require('./assets/fonts/NotoSansTamil-VariableFont_wdth,wght.ttf'),
  });

  // useEffect is no longer needed for configuration
  useEffect(() => {
    // initializeDB() is now called automatically in src/services/database.js
    const requestBluetoothPermissions = async () => {
      if (Platform.OS === 'android') {
        try {
          if (Device.osVersion && parseInt(Device.osVersion) >= 12) {
            await PermissionsAndroid.requestMultiple([
              PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
              PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
              PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            ]);
          } else {
            await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
            );
          }
        } catch (err) {
          console.warn(err);
        }
      }
    };
    const initializePrinter = async () => {
      try {
        const { BLEPrinter } = require('react-native-thermal-receipt-printer-image-qr');
        await BLEPrinter.init();
        console.log('[Printer] BLE Printer initialized');
      } catch (e) {
        console.warn('[Printer] Failed to initialize BLE:', e.message);
      }
    };
    requestBluetoothPermissions();
    initializePrinter();
  }, []);

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <NetworkProvider>
          <AuthProvider>
            <AuthenticatedApp />
            <IndianScriptRenderer ref={globalPrintRef} />
          </AuthProvider>
        </NetworkProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}