import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import CustomTitleBar from './components/layout/CustomTitleBar';
import TokenExpiryBanner from './components/TokenExpiryBanner';

import Dashboard from './pages/Dashboard';
import Billing from './pages/Billing/BillingPage';
import Products from './pages/Products/ProductsPage';
import Customers from './pages/Customers/CustomersPage';
import Invoices from './pages/Invoices/InvoicesPage';
import Reports from './pages/Reports/ReportsPage';
import GSTReports from './pages/Reports/GSTReportsPage';
import Expenses from './pages/Expenses/ExpensesPage';
import Settings from './pages/Settings/SettingsPage';
import BarcodeGenerator from './pages/Barcode/BarcodePage';

import LoginPage from './pages/Auth/LoginPage';
import CompleteProfile from './pages/onboarding/CompleteProfile';
import ProtectedRoute from './components/layout/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CustomerProvider } from './context/CustomerContext';
import { TransactionProvider } from './context/TransactionContext';
import { ProductProvider } from './context/ProductContext';
import { ExpenseProvider } from './context/ExpenseContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { ToastProvider } from './context/ToastContext';
import { isProfileComplete } from './hooks/useOnboardingStatus';

import BlockingOverlay from './components/BlockingOverlay';
import logoImage from './assets/logo.png';

// Advanced animated waiting component
const LoadingScreen = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-slate-200 relative overflow-hidden">
      {/* Decorative background blur blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/20 rounded-full blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-400/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1.5s' }}></div>

      <div className="z-10 flex flex-col items-center">
        {/* Animated Logo Container */}
        <div className="relative flex flex-col items-center justify-center mb-16 w-full max-w-3xl">
          {/* Logo element with epic entrance and floating animation */}
          <img
            src={logoImage}
            alt="Kwiq Bill Logo"
            className="w-[300px] sm:w-[450px] md:w-[600px] h-auto object-contain drop-shadow-2xl transition-transform duration-1000 ease-out hover:scale-105"
            style={{ animation: 'logo-entrance 1.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards, float-glow 6s ease-in-out 1.5s infinite' }}
            onError={(e) => {
              // Fallback text logo if the image is missing
              e.target.style.display = 'none';
              document.getElementById('fallback-text-logo').classList.remove('hidden');
              document.getElementById('fallback-text-logo').classList.add('flex');
            }}
          />

          {/* Fallback Text Logo */}
          <div id="fallback-text-logo" className="hidden flex-col items-center justify-center bg-white/70 backdrop-blur-md p-10 rounded-3xl shadow-2xl border border-white/50" style={{ animation: 'logo-entrance 1.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards, float-glow 6s ease-in-out 1.5s infinite' }}>
            <div className="flex items-center gap-1 mb-2">
              <span className="text-7xl font-sans font-extrabold tracking-tighter text-[#0a4d8c]">kwi</span>
              <span className="text-7xl font-sans font-extrabold tracking-tighter text-[#3b82f6]">q</span>
              <span className="text-7xl font-sans font-normal tracking-tight text-[#3b82f6] ml-3">bill</span>
            </div>
            <div className="text-[0.8rem] tracking-[0.3em] text-slate-500 mt-2 font-bold uppercase">
              Minimalistic Invoicing
            </div>
          </div>
        </div>

        {/* Loading Indicator */}
        <div className="flex flex-col items-center gap-6 mt-8" style={{ animation: 'fade-in-up 1s ease-out 1s forwards', opacity: 0 }}>
          <div className="flex gap-3">
            <div className="w-3.5 h-3.5 rounded-full bg-blue-600 shadow-lg shadow-blue-500/50" style={{ animation: 'bounce 1s infinite 0ms' }}></div>
            <div className="w-3.5 h-3.5 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" style={{ animation: 'bounce 1s infinite 150ms' }}></div>
            <div className="w-3.5 h-3.5 rounded-full bg-blue-400 shadow-lg shadow-blue-500/50" style={{ animation: 'bounce 1s infinite 300ms' }}></div>
          </div>
          <p className="text-slate-500 font-semibold text-sm tracking-widest uppercase mt-2" style={{ animation: 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>
            Starting Workspace...
          </p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes fade-in-up {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes logo-entrance {
          0% { opacity: 0; transform: scale(0.8) translateY(30px); filter: blur(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0px); }
        }
        @keyframes float-glow {
          0% { transform: translateY(0px) scale(1); filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.05)); }
          50% { transform: translateY(-15px) scale(1.02); filter: drop-shadow(0 0 30px rgba(255, 255, 255, 0.15)); }
          100% { transform: translateY(0px) scale(1); filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.05)); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}} />
    </div>
  );
};

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CustomerProvider>
          <TransactionProvider>
            <ProductProvider>
              <ExpenseProvider>
                <SettingsProvider>
                  <AppContent />
                </SettingsProvider>
              </ExpenseProvider>
            </ProductProvider>
          </TransactionProvider>
        </CustomerProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

import ScrollToTop from './components/layout/ScrollToTop';

// Extract content to use Auth Context
const AppContent = () => {
  const { authStatus, logout } = useAuth();
  const { settings, loading: settingsLoading } = useSettings();
  const [blocked, setBlocked] = React.useState(false);
  const [blockedMessage, setBlockedMessage] = React.useState('');

  React.useEffect(() => {
    const handleBlocked = (e) => {
      setBlocked(true);
      setBlockedMessage(e.detail?.message || '');
    };
    window.addEventListener('account-blocked', handleBlocked);
    return () => window.removeEventListener('account-blocked', handleBlocked);
  }, []);

  if (authStatus === 'loading' || settingsLoading) {
    return <LoadingScreen />;
  }

  // Token expired → redirect to login (shows expired notice there)
  if (authStatus === 'token-expired') {
    return <Navigate to="/login" replace />;
  }

  // Check if user needs onboarding (only for authenticated users)
  if (authStatus === 'authenticated') {
    console.log("[DEBUG] App State:", {
      authStatus,
      hasSettings: !!settings,
      onboardingCompletedAt: settings?.onboardingCompletedAt,
      settingsUser: settings?.user
    });

    const needsOnboarding = !isProfileComplete(settings);

    // If profile is incomplete and not already on onboarding page, show onboarding
    if (needsOnboarding && !window.location.pathname.includes('/onboarding')) {
      console.log("[DEBUG] Redirecting to Onboarding. Needs:", needsOnboarding);
      return <CompleteProfile />;
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {blocked && <BlockingOverlay message={blockedMessage} onLogout={logout} />}
      <ScrollToTop />
      <CustomTitleBar />
      <TokenExpiryBanner />
      <div className="flex-1 overflow-hidden mt-8">
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/" element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="billing" element={<Billing />} />
            <Route path="products" element={<Products />} />
            <Route path="customers" element={<Customers />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="reports" element={<Reports />} />
            <Route path="gst-reports" element={<GSTReports />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="barcode" element={<BarcodeGenerator />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </div>
    </div>
  );
};

export default App;
