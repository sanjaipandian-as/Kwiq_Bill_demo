
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginPage from '../pages/Auth/LoginPage';
import BarcodePage from '../pages/Barcode/BarcodePage';
import ExpensesPage from '../pages/Expenses/ExpensesPage';
import InvoicesPage from '../pages/Invoices/InvoicesPage';
import ReportsPage from '../pages/Reports/ReportsPage';
import CustomersPage from '../pages/customers/CustomerPage';
import BillingPage from '../pages/Billing/BillingPage';
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
import WhoWeAre from '../pages/Settings/Settingscomponents/Contact/WhoWeAre';
import WhatWeDo from '../pages/Settings/Settingscomponents/Contact/WhatWeDo';
import BulkUploadScreen from '../pages/Products/BulkUploadScreen';
import DataSearchLoader from '../components/ui/DataSearchLoader';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { user, isLoading } = useAuth();
  const { settings, loading: settingsLoading, dbProfileComplete } = useSettings();

  if (isLoading || settingsLoading) {
    return <LoadingTransition isLoading={isLoading} settingsLoading={settingsLoading} />;
  }

  return <MainNavigation user={user} settings={settings} dbProfileComplete={dbProfileComplete} />;
}

// 🚀 PRO-LEVEL OPTIMIZATION: Sub-component prevents full-app re-renders 
// during background sync. Only this component re-renders when syncStatus changes.
function LoadingTransition({ isLoading, settingsLoading }) {
  const { syncStatus, syncStats, dbProfileComplete, initStage, finishLoading } = useSettings();
  const message = isLoading ? "Authenticating Session..." : (syncStatus || "Preparing Data Sync...");
  
  let currentProgress = settingsLoading ? 0.35 : 0.15;
  if (syncStatus?.includes('aligned') || syncStatus?.includes('Opening app')) {
    currentProgress = 1.0;
  }

  // 🛡️ KwiqLoader Injection: If the app is verifying if the user has database
  // records before throwing them to the Onboarding form, show the sleek HTML loader
  // instead of the bulky DataSyncPage.
  if (settingsLoading && !dbProfileComplete) {
    return <DataSearchLoader stage={initStage || 1} onReady={finishLoading} />;
  }

  return (
    <DataSyncPage
      progressMessage={message}
      progressValue={currentProgress}
      syncStats={syncStats}
    />
  );
}

// 🚀 Only re-renders on AUTH change or major PROFILE update, not on sync progression
function MainNavigation({ user, settings, dbProfileComplete }) {
  const isProfileComplete = () => {
    // 🛡️ TRUST THE FAST-PATH: If the DB is verified and we're unlocked, 
    // we are NOT on the onboarding page, even if keys are still warming up.
    if (dbProfileComplete) return true;
    
    if (!settings) return false;
    if (settings.onboardingCompletedAt) return true;
    const { store, user: userInfo } = settings;
    if (!store?.name || !store?.contact) return false;
    if (!store?.address?.city || !store?.address?.state) return false;
    if (!userInfo?.fullName || !userInfo?.mobile) return false;
    return true;
  };

  const profileComplete = isProfileComplete();

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          freezeOnBlur: true,
        }}>
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
            <Stack.Screen name="WhoWeAre" component={WhoWeAre} />
            <Stack.Screen name="WhatWeDo" component={WhatWeDo} />
            <Stack.Screen name="BulkUpload" component={BulkUploadScreen} />
          </>
        )}
        <Stack.Screen name="TermsOfService" component={TermsOfService} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicy} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
