
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginPage from '../pages/Auth/LoginPage';
import Dashboard from '../pages/Dashboard';
import BillingPage from '../pages/Billing/BillingPage';
import BarcodePage from '../pages/Barcode/BarcodePage';
import ExpensesPage from '../pages/Expenses/ExpensesPage';
import InvoicesPage from '../pages/Invoices/InvoicesPage';
import ReportsPage from '../pages/Reports/ReportsPage';
import CustomersPage from '../pages/customers/CustomerPage';
import MainTabs from './MainTabs';
import LowStockPage from '../pages/LowStockPage';
import GSTPage from '../pages/GST/GSTPage';
import RecycleBinPage from '../pages/Invoices/RecycleBinPage';
import TermsOfService from '../pages/Legal/TermsOfService';
import PrivacyPolicy from '../pages/Legal/PrivacyPolicy';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import ShopDetails from '../pages/Settings/ShopDetails';
import DataSyncPage from '../pages/Auth/DataSyncPage';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { user, isLoading } = useAuth();
  const { settings, loading: settingsLoading, dbProfileComplete, syncStatus, syncStats } = useSettings();

  const isProfileComplete = () => {
    if (!settings) return false;

    // Must have profile saved in database (MongoDB) — this is the primary check
    if (!dbProfileComplete) return false;

    // 1. If onboarding was explicitly completed, consider it complete 
    // This prevents the app from redirecting to ShopDetails while the user is editing settings (and temporarily clearing fields)
    if (settings.onboardingCompletedAt) return true;

    const { store, user: userInfo } = settings;

    // Core validation: Store Name, Contact, City, State, Owner Name, Owner Mobile
    if (!store?.name) return false;
    if (!store?.contact) return false;
    if (!store?.address?.city || !store?.address?.state) return false;
    if (!userInfo?.fullName || !userInfo?.mobile) return false;

    return true;
  };

  if (isLoading || settingsLoading) {
    const message = isLoading ? "Authenticating Session..." : (syncStatus || "Preparing Data Sync...");

    // Ensure the aligning popup triggers its 100% completion success state smoothly
    let currentProgress = settingsLoading ? 0.35 : 0.15;
    if (syncStatus?.includes('aligned') || syncStatus?.includes('Opening app')) {
      currentProgress = 1.0;
    }

    return (
      <DataSyncPage
        progressMessage={message}
        progressValue={currentProgress}
        syncStats={syncStats}
      />
    );
  }

  const profileComplete = isProfileComplete();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginPage} />
        ) : !profileComplete ? (
          <Stack.Screen name="ShopDetails" component={ShopDetails} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Barcode" component={BarcodePage} />
            <Stack.Screen name="Expenses" component={ExpensesPage} />
            <Stack.Screen name="Invoices" component={InvoicesPage} />
            <Stack.Screen name="Reports" component={ReportsPage} />
            <Stack.Screen name="GST" component={GSTPage} />
            <Stack.Screen name="Customers" component={CustomersPage} />
            <Stack.Screen name="Billing" component={BillingPage} />
            <Stack.Screen name="LowStock" component={LowStockPage} />
            <Stack.Screen name="RecycleBin" component={RecycleBinPage} />
          </>
        )}
        <Stack.Screen name="TermsOfService" component={TermsOfService} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicy} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

