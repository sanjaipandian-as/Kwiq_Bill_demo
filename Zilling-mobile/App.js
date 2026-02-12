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
import { initializeDB } from './src/services/database';

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

  // Keying by user.id forces a complete unmount/remount of all these providers
  // whenever the user changes (Login/Logout).
  // This ensures no in-memory state (products, customers, etc.) leaks between sessions.
  return (
    <SettingsProvider key={user?.id || 'guest'} user={user}>
      <CustomerProvider>
        <ProductProvider>
          <ExpenseProvider>
            <TransactionProvider>
              <AppNavigator />
            </TransactionProvider>
          </ExpenseProvider>
        </ProductProvider>
      </CustomerProvider>
    </SettingsProvider>
  );
};

export default function App() {
  // useEffect is no longer needed for configuration
  useEffect(() => {
    // initializeDB() is now called automatically in src/services/database.js
  }, []);

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AuthProvider>
          <AuthenticatedApp />
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}