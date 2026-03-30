import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import services from '../../services/api';
import { Store, MapPin, User, CheckCircle, ChevronRight, ChevronLeft } from 'lucide-react';

const CompleteProfile = () => {
    const navigate = useNavigate();
    const { settings, updateSettings, saveSettings } = useSettings();
    const { user, logout } = useAuth();

    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        // Step 1: Store Profile
        storeName: settings?.store?.name || '',
        legalName: settings?.store?.legalName || '',
        businessType: settings?.store?.businessType || 'Proprietorship',
        contact: settings?.store?.contact || '',
        email: settings?.store?.email || '',
        website: settings?.store?.website || '',

        // Step 2: Address & Tax
        street: settings?.store?.address?.street || '',
        area: settings?.store?.address?.area || '',
        city: settings?.store?.address?.city || '',
        state: settings?.store?.address?.state || '',
        pincode: settings?.store?.address?.pincode || '',
        gstEnabled: settings?.tax?.gstEnabled ?? true,
        gstin: settings?.store?.gstin || '',

        // Step 3: User Info
        fullName: settings?.user?.fullName || '',
        mobile: settings?.user?.mobile || '',
        userEmail: settings?.user?.email || '',
        consentAnalytics: settings?.user?.consent?.analytics ?? true,
        consentContact: settings?.user?.consent?.contact ?? true,
    });

    const [saving, setSaving] = useState(false);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const isStep1Valid = () => {
        return formData.storeName.trim() &&
            formData.legalName.trim() &&
            formData.contact.trim() &&
            formData.email.trim();
    };

    const isStep2Valid = () => {
        const basic = formData.street.trim() &&
            formData.area.trim() &&
            formData.city.trim() &&
            formData.state.trim() &&
            formData.pincode.trim();

        if (formData.gstEnabled) {
            return basic && formData.gstin.trim();
        }
        return basic;
    };

    const isStep3Valid = () => {
        return formData.fullName.trim() &&
            formData.mobile.trim() &&
            formData.userEmail.trim();
    };

    const canProceed = () => {
        if (currentStep === 1) return isStep1Valid();
        if (currentStep === 2) return isStep2Valid();
        if (currentStep === 3) return isStep3Valid();
        return false;
    };

    const handleNext = () => {
        if (currentStep < 3) {
            // Auto-save current step
            saveCurrentStep();
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const saveCurrentStep = async () => {
        // Prepare partial update based on current step
        const updates = {};

        if (currentStep === 1) {
            updates.store = {
                ...settings.store,
                name: formData.storeName,
                legalName: formData.legalName,
                businessType: formData.businessType,
                contact: formData.contact,
                email: formData.email,
                website: formData.website,
            };
        } else if (currentStep === 2) {
            updates.store = {
                ...settings.store,
                address: {
                    ...settings.store.address,
                    street: formData.street,
                    area: formData.area,
                    city: formData.city,
                    state: formData.state,
                    pincode: formData.pincode,
                },
                gstin: formData.gstin,
            };
            updates.tax = {
                ...settings.tax,
                gstEnabled: formData.gstEnabled,
            };
        }

        // Update context (don't save to backend yet on intermediate steps)
        Object.keys(updates).forEach(section => {
            updateSettings(section, updates[section]);
        });
    };

    const handleComplete = async () => {
        if (!isStep3Valid()) return;

        setSaving(true);
        try {
            // Prepare tax settings specifically stripping out 'defaultType' for onboarding
            const taxSettings = {
                ...settings.tax,
                gstEnabled: formData.gstEnabled,
            };
            delete taxSettings.defaultType;

            // Prepare final payload with all data
            const finalSettings = {
                ...settings,
                store: {
                    ...settings.store,
                    name: formData.storeName,
                    legalName: formData.legalName,
                    businessType: formData.businessType,
                    contact: formData.contact,
                    email: formData.email,
                    website: formData.website,
                    address: {
                        ...settings.store.address,
                        street: formData.street,
                        area: formData.area,
                        city: formData.city,
                        state: formData.state,
                        pincode: formData.pincode,
                    },
                    gstin: formData.gstin,
                },
                tax: taxSettings,
                user: {
                    fullName: formData.fullName,
                    mobile: formData.mobile,
                    email: formData.userEmail,
                    consent: {
                        analytics: formData.consentAnalytics,
                        contact: formData.consentContact,
                    },
                },
                onboardingCompletedAt: new Date().toISOString(),
            };

            // 1. Save to local SQLite (existing behavior)
            try {
                await saveSettings(finalSettings);
                console.log('✅ Profile saved to local database');
            } catch (saveError) {
                console.error("❌ Failed to save profile to local database:", saveError);
                toast.error("Failed to save profile locally (Database Error). Please try again.");
                setIsSubmitting(false);
                return; // Stop execution, do not sync to MongoDB if local save failed
            }

            // 2. ALSO sync to MongoDB for company analytics (non-blocking)
            try {
                // Robust user ID extraction
                const userId = user?.googleSub || user?.googleId || user?.sub || user?.id || user?._id || user?.user?.id ||
                    (formData.userEmail ? `email-${btoa(formData.userEmail).replace(/=/g, '')}` : `local-${Date.now()}`);

                const userEmail = user?.email || formData.userEmail;

                console.log('🔄 Syncing to MongoDB with:', { userId, userEmail });

                await services.companyProfile.save({
                    userId,
                    userEmail,
                    store: finalSettings.store,
                    tax: finalSettings.tax,
                    user: finalSettings.user,
                    onboardingCompletedAt: finalSettings.onboardingCompletedAt
                });
                console.log('✅ Company profile synced to MongoDB');
            } catch (mongoError) {
                // MongoDB sync is optional - don't block onboarding if it fails
                console.warn('⚠️ MongoDB sync failed (non-critical):', mongoError.message);
                if (mongoError.response) {
                    console.warn('Error details:', mongoError.response.data);
                }
            }

            // 3. Update local context
            updateSettings('store', finalSettings.store);
            updateSettings('tax', finalSettings.tax);
            updateSettings('user', finalSettings.user);

            // 4. Navigate to billing
            navigate('/billing');
        } catch (error) {
            console.error('❌ Failed to complete onboarding:', error);
            alert('Failed to save profile. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const steps = [
        { number: 1, title: 'Store Profile', icon: Store },
        { number: 2, title: 'Address & Tax', icon: MapPin },
        { number: 3, title: 'Owner Info', icon: User },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
            <div className="w-full max-w-4xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-full mb-4">
                        <Store className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Complete Your Profile</h1>
                    <p className="text-slate-600">Let's set up your store to get started with billing</p>
                    <button onClick={logout} className="mt-4 text-sm text-red-600 hover:text-red-700 underline">
                        Logout / Reset Session
                    </button>
                </div>

                {/* Progress Indicator */}
                <div className="mb-8">
                    <div className="flex items-center justify-center gap-2">
                        {steps.map((step, idx) => (
                            <React.Fragment key={step.number}>
                                <div className="flex flex-col items-center">
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${currentStep === step.number
                                            ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                                            : currentStep > step.number
                                                ? 'bg-green-500 text-white'
                                                : 'bg-slate-200 text-slate-500'
                                            }`}
                                    >
                                        {currentStep > step.number ? (
                                            <CheckCircle className="w-5 h-5" />
                                        ) : (
                                            step.number
                                        )}
                                    </div>
                                    <span className="text-xs font-medium text-slate-600 mt-2 hidden sm:block">
                                        {step.title}
                                    </span>
                                </div>
                                {idx < steps.length - 1 && (
                                    <div
                                        className={`w-16 sm:w-24 h-1 rounded-full transition-all ${currentStep > step.number ? 'bg-green-500' : 'bg-slate-200'
                                            }`}
                                    />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Form Card */}
                <Card className="shadow-xl">
                    <CardContent className="p-8">
                        <div className="mb-6">
                            <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                                {React.createElement(steps[currentStep - 1].icon, { className: 'w-5 h-5 text-indigo-600' })}
                                {steps[currentStep - 1].title}
                            </h2>
                            <p className="text-sm text-slate-500 mt-1">
                                Step {currentStep} of 3 • Fields marked with * are required
                            </p>
                        </div>

                        {/* Step 1: Store Profile */}
                        {currentStep === 1 && (
                            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">
                                            Store Display Name <span className="text-red-500">*</span>
                                        </label>
                                        <Input
                                            value={formData.storeName}
                                            onChange={(e) => handleChange('storeName', e.target.value)}
                                            placeholder="My Store"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Legal Business Name <span className="text-red-500">*</span></label>
                                        <Input
                                            value={formData.legalName}
                                            onChange={(e) => handleChange('legalName', e.target.value)}
                                            placeholder="As per GST Certificate"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Business Type <span className="text-red-500">*</span></label>
                                        <select
                                            className="w-full h-10 rounded-md border border-slate-200 px-3 bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            value={formData.businessType}
                                            onChange={(e) => handleChange('businessType', e.target.value)}
                                        >
                                            <option value="Proprietorship">Proprietorship</option>
                                            <option value="Partnership">Partnership</option>
                                            <option value="LLP">LLP</option>
                                            <option value="Private Limited">Private Limited</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">
                                            Contact Number <span className="text-red-500">*</span>
                                        </label>
                                        <Input
                                            value={formData.contact}
                                            onChange={(e) => handleChange('contact', e.target.value)}
                                            placeholder="+91 98765 43210"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Email Address <span className="text-red-500">*</span></label>
                                        <Input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => handleChange('email', e.target.value)}
                                            placeholder="store@example.com"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Website</label>
                                        <Input
                                            value={formData.website}
                                            onChange={(e) => handleChange('website', e.target.value)}
                                            placeholder="www.example.com"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Address & Tax */}
                        {currentStep === 2 && (
                            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Street Address <span className="text-red-500">*</span></label>
                                        <Input
                                            value={formData.street}
                                            onChange={(e) => handleChange('street', e.target.value)}
                                            placeholder="Building name, street"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">Area / Locality <span className="text-red-500">*</span></label>
                                            <Input
                                                value={formData.area}
                                                onChange={(e) => handleChange('area', e.target.value)}
                                                placeholder="Locality"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">
                                                City <span className="text-red-500">*</span>
                                            </label>
                                            <Input
                                                value={formData.city}
                                                onChange={(e) => handleChange('city', e.target.value)}
                                                placeholder="City"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">
                                                State <span className="text-red-500">*</span>
                                            </label>
                                            <Input
                                                value={formData.state}
                                                onChange={(e) => handleChange('state', e.target.value)}
                                                placeholder="State"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">Pincode <span className="text-red-500">*</span></label>
                                            <Input
                                                value={formData.pincode}
                                                onChange={(e) => handleChange('pincode', e.target.value)}
                                                placeholder="123456"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t pt-4 mt-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-sm font-semibold text-slate-800">GST Enabled</h3>
                                            <p className="text-xs text-slate-500">Enable tax calculations for your store</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={formData.gstEnabled}
                                                onChange={(e) => handleChange('gstEnabled', e.target.checked)}
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                        </label>
                                    </div>

                                    {formData.gstEnabled && (
                                        <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                                            <label className="text-sm font-medium text-slate-700">GSTIN <span className="text-red-500">*</span></label>
                                            <Input
                                                value={formData.gstin}
                                                onChange={(e) => handleChange('gstin', e.target.value.toUpperCase())}
                                                placeholder="22AAAAA0000A1Z5"
                                                className="uppercase font-mono"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Step 3: Owner/User Info */}
                        {currentStep === 3 && (
                            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
                                    <p className="text-sm text-blue-800">
                                        👤 This information is about <strong>you</strong>, the person using this software, not the store.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">
                                            Full Name <span className="text-red-500">*</span>
                                        </label>
                                        <Input
                                            value={formData.fullName}
                                            onChange={(e) => handleChange('fullName', e.target.value)}
                                            placeholder="John Doe"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">
                                            Mobile Number <span className="text-red-500">*</span>
                                        </label>
                                        <Input
                                            value={formData.mobile}
                                            onChange={(e) => handleChange('mobile', e.target.value)}
                                            placeholder="+91 98765 43210"
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-sm font-medium text-slate-700">Email Address <span className="text-red-500">*</span></label>
                                        <Input
                                            type="email"
                                            value={formData.userEmail}
                                            onChange={(e) => handleChange('userEmail', e.target.value)}
                                            placeholder="your.email@example.com"
                                        />
                                    </div>
                                </div>

                                <div className="border-t pt-4 mt-6 space-y-3">
                                    <div className="flex items-start gap-3">
                                        <input
                                            type="checkbox"
                                            id="consent-analytics"
                                            checked={formData.consentAnalytics}
                                            onChange={(e) => handleChange('consentAnalytics', e.target.checked)}
                                            className="mt-1 w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                        />
                                        <label htmlFor="consent-analytics" className="text-sm text-slate-700 cursor-pointer">
                                            I agree to share anonymous usage data for support & improvements
                                        </label>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <input
                                            type="checkbox"
                                            id="consent-contact"
                                            checked={formData.consentContact}
                                            onChange={(e) => handleChange('consentContact', e.target.checked)}
                                            className="mt-1 w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                        />
                                        <label htmlFor="consent-contact" className="text-sm text-slate-700 cursor-pointer">
                                            I agree to receive important updates and notifications
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Navigation Buttons */}
                        <div className="flex justify-between mt-8 pt-6 border-t">
                            <Button
                                variant="ghost"
                                onClick={handleBack}
                                disabled={currentStep === 1}
                                className="flex items-center gap-2"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Back
                            </Button>

                            {currentStep < 3 ? (
                                <Button
                                    onClick={handleNext}
                                    disabled={!canProceed()}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
                                >
                                    Next
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleComplete}
                                    disabled={!canProceed() || saving}
                                    className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                                >
                                    {saving ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="w-4 h-4" />
                                            Complete Setup
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Footer */}
                <div className="text-center mt-6 text-sm text-slate-500">
                    Your data is stored locally and securely on this device
                </div>
            </div>
        </div>
    );
};

export default CompleteProfile;
