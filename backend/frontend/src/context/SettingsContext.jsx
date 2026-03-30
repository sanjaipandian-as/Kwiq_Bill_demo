import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import services from '../services/api';
import { useAuth } from './AuthContext';

const SettingsContext = createContext();

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};

export const SettingsProvider = ({ children }) => {
    const { user, isLoading: authLoading } = useAuth();
    const defaultSettings = {
        tax: {
            gstEnabled: true,
            defaultType: 'Exclusive',
            gstin: '',
            state: '',
            registrationType: 'Regular',
            priceMode: 'Exclusive',
            automaticTax: true,
            taxGroups: [
                { id: 'gst-0', name: 'GST 0%', rate: 0, cgst: 0, sgst: 0, igst: 0, active: true },
                { id: 'gst-5', name: 'GST 5%', rate: 5, cgst: 2.5, sgst: 2.5, igst: 5, active: true },
                { id: 'gst-12', name: 'GST 12%', rate: 12, cgst: 6, sgst: 6, igst: 12, active: true },
                { id: 'gst-18', name: 'GST 18%', rate: 18, cgst: 9, sgst: 9, igst: 18, active: true },
                { id: 'gst-28', name: 'GST 28%', rate: 28, cgst: 14, sgst: 14, igst: 28, active: true },
            ],
            slabs: [] // Deprecated but kept for compatibility
        },
        invoice: {
            template: 'Classic',
            paperSize: 'A4',
            showLogo: true,
            showWatermark: false,
            showStoreAddress: true,
            showSignature: true,
            showTaxBreakup: true,
            showHsn: true,
            showMrp: false,
            showSavings: true,
            showCustomerGstin: true,
            showLoyaltyPoints: false,
            showQrcode: true,
            showTerms: true,
            showB2bGstin: true,
            headerTitle: 'Tax Invoice',
            footerNote: 'Thank you for your business!',
            termsAndConditions: '1. Goods once sold will not be taken back.\n2. Interest @18% pa will be charged if not paid within due date.',
            roundingType: 'Nearest',
            showTaxGroupHeaders: true
        },
        defaults: {
            currency: 'INR',
            timeZone: 'Asia/Kolkata',
            language: 'en',
            printLanguage: 'en',
            hsnCode: ''
        },
        print: {
            showPreview: true,
            silentPrint: false,
            margins: { top: 0, right: 0, bottom: 0, left: 0 },
            printerName: ''
        },
        store: {
            name: 'My Billing Co.',
            legalName: '',
            businessType: 'Proprietorship',
            contact: '',
            email: '',
            website: '',
            address: {
                street: '',
                area: '',
                city: '',
                state: '',
                pincode: '',
                country: 'India'
            },
            footer: 'Thank you for shopping with us!',
            terms: true,
            logo: null,
            gstin: '',
            fssai: ''
        },
        billing: {
            requireCustomerMobile: true,
            allowAnonymousBilling: false,
            autoSendInvoice: false
        },
        user: {
            fullName: '',
            mobile: '',
            email: '',
            role: 'Owner',
            consent: {
                analytics: true,
                contact: true
            }
        },
        backup: {
            enabled: false,
            frequency: 'Daily',
            time: '02:00'
        },
        onboardingCompletedAt: null
    };

    const [settings, setSettings] = useState(defaultSettings);
    const [loading, setLoading] = useState(true);
    const [networkError, setNetworkError] = useState(null);

    useEffect(() => {
        // 1. If auth is loading, keep settings loading (don't set to false yet)
        if (authLoading) return;

        // 2. Auth done. If no user, reset to defaults and stop loading.
        if (!user) {
            setSettings(defaultSettings);
            setLoading(false);
            return;
        }

        // 3. Auth done, User exists. Start loading settings.
        setLoading(true);
        setNetworkError(null);

        const fetchSettings = async () => {
            try {
                // Parallel check for settings and subscription status
                const [settingsRes] = await Promise.all([
                    services.settings.getSettings(),
                    // Background check subscription to update local cache or trigger lock
                    services.subscription.getStatus({
                        deviceId: window.electron?.deviceId || 'UNKNOWN-DEVICE',
                        appVersion: '1.0.0'
                    }).catch(err => {
                        console.warn("Background subscription check failed (expected if offline)", err.message);
                    })
                ]);

                const response = settingsRes;

                // Deep merge with defaults
                setSettings(prev => ({
                    ...prev,
                    ...response.data,
                    store: { ...prev.store, ...response.data.store },
                    tax: { ...prev.tax, ...response.data.tax },
                    invoice: { ...prev.invoice, ...response.data.invoice },
                    defaults: { ...prev.defaults, ...response.data.defaults },
                    billing: { ...prev.billing, ...response.data.billing },
                    user: { ...prev.user, ...response.data.user },
                    onboardingCompletedAt: response.data.onboardingCompletedAt || prev.onboardingCompletedAt
                }));
            } catch (error) {
                console.error("Failed to fetch settings", error);
                if (error.response?.status === 503 || error.response?.data?.code === 'NETWORK_ERROR') {
                    setNetworkError("Unable to connect to the cloud database. Please check your internet connection and try again.");
                } else if (error.code === 'ERR_NETWORK') {
                    setNetworkError("Unable to reach the local server. Please ensure the app backend is running.");
                }
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [user, authLoading]);

    const saveSettings = useCallback(async (newSettings) => {
        // Propagate error to caller
        await services.settings.updateSettings(newSettings);
        setSettings(newSettings);
    }, []);

    const updateSettings = useCallback((section, data) => {
        setSettings(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                ...data
            }
        }));
    }, []);

    const refreshSettings = useCallback(async () => {
        setLoading(true);
        setNetworkError(null);
        try {
            const response = await services.settings.getSettings();
            setSettings(prev => ({
                ...prev,
                ...response.data,
                store: { ...prev.store, ...response.data.store },
                tax: { ...prev.tax, ...response.data.tax },
                invoice: { ...prev.invoice, ...response.data.invoice },
                defaults: { ...prev.defaults, ...response.data.defaults },
                billing: { ...prev.billing, ...response.data.billing },
                user: { ...prev.user, ...response.data.user },
                onboardingCompletedAt: response.data.onboardingCompletedAt || prev.onboardingCompletedAt
            }));
        } catch (error) {
            console.error("Failed to refresh settings", error);
            if (error.response?.status === 503 || error.response?.data?.code === 'NETWORK_ERROR') {
                setNetworkError("Unable to connect to the cloud database. Please check your internet connection and try again.");
            } else if (error.code === 'ERR_NETWORK') {
                setNetworkError("Unable to reach the local server. Please ensure the app backend is running.");
            }
        } finally {
            setLoading(false);
        }
    }, []);

    const updateTaxSlab = useCallback((id, updates) => {
        setSettings(prev => ({
            ...prev,
            tax: {
                ...prev.tax,
                slabs: prev.tax.slabs.map(slab =>
                    slab.id === id ? { ...slab, ...updates } : slab
                )
            }
        }));
    }, []);

    const addTaxSlab = useCallback((newSlab) => {
        setSettings(prev => {
            const next = {
                ...prev,
                tax: {
                    ...prev.tax,
                    slabs: [...prev.tax.slabs, { ...newSlab, id: `gst-${Date.now()}` }]
                }
            };
            saveSettings(next);
            return next;
        });
    }, [saveSettings]);

    const resetSlabs = useCallback(() => {
        setSettings(prev => {
            const next = {
                ...prev,
                tax: {
                    ...prev.tax,
                    slabs: []
                }
            };
            saveSettings(next);
            return next;
        });
    }, [saveSettings]);

    const value = useMemo(() => ({
        settings,
        updateSettings,
        saveSettings,
        refreshSettings,
        updateTaxSlab,
        addTaxSlab,
        resetSlabs
    }), [settings, updateSettings, saveSettings, refreshSettings, updateTaxSlab, addTaxSlab, resetSlabs]);

    if (loading) {
        return <div className="p-10 text-center text-slate-500">Loading settings...</div>;
    }

    if (networkError) {
        return (
            <div className="flex flex-col items-center justify-center p-10 h-screen bg-slate-50 text-slate-600">
                <div className="w-16 h-16 text-slate-400 mb-6 bg-white p-4 rounded-full shadow-sm border border-slate-100 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Network Error</h2>
                <p className="max-w-md text-center text-slate-500 mb-8">{networkError}</p>
                <button
                    onClick={() => {
                        setNetworkError(null);
                        setLoading(true);
                        window.location.reload();
                    }}
                    className="px-8 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium drop-shadow-md hover:drop-shadow-lg"
                >
                    Retry Connection
                </button>
            </div>
        );
    }

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
};
