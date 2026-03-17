import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    SafeAreaView,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Dimensions,
    ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSettings } from '../../context/SettingsContext';
import { Store, MapPin, User, CheckCircle2, ChevronRight, ChevronLeft, Building2, ShieldCheck, Mail, Phone, Globe, Layout } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';


const { width } = Dimensions.get('window');

const ShopDetails = () => {
    const navigation = useNavigation();
    const { settings, saveFullSettings } = useSettings();

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
        role: settings?.user?.role || 'Owner',
        consentAnalytics: settings?.user?.consent?.analytics ?? true,
        consentContact: settings?.user?.consent?.contact ?? true,
    });

    const [saving, setSaving] = useState(false);
    const [showErrors, setShowErrors] = useState(false);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        // Clear error for this field if user starts typing
        if (showErrors) setShowErrors(false);
    };

    const isStep1Valid = () => {
        return (
            formData.storeName?.trim() &&
            formData.legalName?.trim() &&
            formData.contact?.trim() &&
            formData.email?.trim()
        );
    };

    const isStep2Valid = () => {
        const baseValid = (
            formData.street?.trim() &&
            formData.city?.trim() &&
            formData.state?.trim() &&
            formData.pincode?.trim()
        );
        if (formData.gstEnabled) {
            return baseValid && formData.gstin?.trim();
        }
        return baseValid;
    };

    const isStep3Valid = () => {
        return formData.fullName?.trim() && formData.mobile?.trim();
    };

    const canProceed = () => {
        if (currentStep === 1) return isStep1Valid();
        if (currentStep === 2) return isStep2Valid();
        if (currentStep === 3) return isStep3Valid();
        return false;
    };

    const handleNext = () => {
        if (canProceed()) {
            setCurrentStep(currentStep + 1);
            setShowErrors(false);
        } else {
            setShowErrors(true);
            Alert.alert('Incomplete Form', 'Please fill in all mandatory fields before proceeding.');
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleComplete = async () => {
        if (!isStep3Valid()) {
            setShowErrors(true);
            Alert.alert('Required Fields', 'Please fill in all mandatory fields marked with * before finalizing.');
            return;
        }

        setSaving(true);
        try {
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
                tax: {
                    ...settings.tax,
                    gstEnabled: formData.gstEnabled,
                },
                user: {
                    fullName: formData.fullName,
                    mobile: formData.mobile,
                    email: formData.userEmail,
                    role: formData.role,
                    consent: {
                        analytics: formData.consentAnalytics,
                        contact: formData.consentContact,
                    },
                },
                onboardingCompletedAt: new Date().toISOString(),
            };

            await saveFullSettings(finalSettings);

            // If we are using AppNavigator gatekeeper, this update will cause re-render
            // and redirect to Main.
        } catch (error) {
            console.error('Failed to complete onboarding:', error);
            Alert.alert('Error', 'Failed to save profile. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const steps = [
        { number: 1, title: 'Identity', icon: Store },
        { number: 2, title: 'Location', icon: MapPin },
        { number: 3, title: 'Profile', icon: User },
    ];

    const renderStep1 = () => (
        <View style={styles.formContainer}>
            <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Store Display Name *</Text>
                <View style={[styles.inputFieldContainer, showErrors && !formData.storeName?.trim() && styles.errorInput]}>
                    <Store size={20} color="#000" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        value={formData.storeName}
                        onChangeText={(v) => handleChange('storeName', v)}
                        placeholder="e.g. Kwiq Billing Store"
                        placeholderTextColor="#94a3b8"
                    />
                </View>
                {showErrors && !formData.storeName?.trim() && <Text style={styles.errorText}>Store name is required</Text>}
            </View>

            <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Legal Business Name *</Text>
                <View style={[styles.inputFieldContainer, showErrors && !formData.legalName?.trim() && styles.errorInput]}>
                    <Building2 size={20} color="#000" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        value={formData.legalName}
                        onChangeText={(v) => handleChange('legalName', v)}
                        placeholder="As per GST Certificate"
                        placeholderTextColor="#94a3b8"
                    />
                </View>
                {showErrors && !formData.legalName?.trim() && <Text style={styles.errorText}>Legal business name is required</Text>}
            </View>

            <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Contact Number *</Text>
                <View style={[styles.inputFieldContainer, showErrors && !formData.contact?.trim() && styles.errorInput]}>
                    <Phone size={20} color="#000" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        value={formData.contact}
                        onChangeText={(v) => handleChange('contact', v)}
                        placeholder="+91 98765 43210"
                        keyboardType="phone-pad"
                        placeholderTextColor="#94a3b8"
                    />
                </View>
                {showErrors && !formData.contact?.trim() && <Text style={styles.errorText}>Contact number is required</Text>}
            </View>

            <View style={styles.row}>
                <View style={[styles.col, styles.inputWrapper]}>
                    <Text style={styles.inputLabel}>Email Address *</Text>
                    <View style={[styles.inputFieldContainer, showErrors && !formData.email?.trim() && styles.errorInput]}>
                        <Mail size={18} color="#000" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            value={formData.email}
                            onChangeText={(v) => handleChange('email', v)}
                            placeholder="store@mail.com"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            placeholderTextColor="#94a3b8"
                        />
                    </View>
                    {showErrors && !formData.email?.trim() && <Text style={styles.errorText}>Email address is required</Text>}
                </View>
            </View>
        </View>
    );

    const renderStep2 = () => (
        <View style={styles.formContainer}>
            <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Street Address *</Text>
                <View style={[styles.inputFieldContainer, showErrors && !formData.street?.trim() && styles.errorInput]}>
                    <MapPin size={20} color="#000" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        value={formData.street}
                        onChangeText={(v) => handleChange('street', v)}
                        placeholder="Building name, street"
                        placeholderTextColor="#94a3b8"
                    />
                </View>
                {showErrors && !formData.street?.trim() && <Text style={styles.errorText}>Street address is required</Text>}
            </View>

            <View style={styles.row}>
                <View style={styles.col}>
                    <Text style={styles.inputLabel}>City *</Text>
                    <TextInput
                        style={[styles.input, styles.standaloneInput, showErrors && !formData.city?.trim() && styles.errorInput]}
                        value={formData.city}
                        onChangeText={(v) => handleChange('city', v)}
                        placeholder="City"
                        placeholderTextColor="#94a3b8"
                    />
                    {showErrors && !formData.city?.trim() && <Text style={styles.errorText}>City is required</Text>}
                </View>
                <View style={styles.col}>
                    <Text style={styles.inputLabel}>State *</Text>
                    <TextInput
                        style={[styles.input, styles.standaloneInput, showErrors && !formData.state?.trim() && styles.errorInput]}
                        value={formData.state}
                        onChangeText={(v) => handleChange('state', v)}
                        placeholder="State"
                        placeholderTextColor="#94a3b8"
                    />
                    {showErrors && !formData.state?.trim() && <Text style={styles.errorText}>State is required</Text>}
                </View>
            </View>

            <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Pincode *</Text>
                <TextInput
                    style={[styles.input, styles.standaloneInput, showErrors && !formData.pincode?.trim() && styles.errorInput]}
                    value={formData.pincode}
                    onChangeText={(v) => handleChange('pincode', v)}
                    placeholder="123456"
                    keyboardType="numeric"
                    placeholderTextColor="#94a3b8"
                />
                {showErrors && !formData.pincode?.trim() && <Text style={styles.errorText}>Pincode is required</Text>}
            </View>

            <View style={styles.gstSection}>
                <View style={styles.gstHeader}>
                    <View>
                        <Text style={styles.gstTitle}>GST Compliance</Text>
                        <Text style={styles.gstSub}>Enable tax modules</Text>
                    </View>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        style={[styles.toggle, formData.gstEnabled ? styles.toggleOn : styles.toggleOff]}
                        onPress={() => handleChange('gstEnabled', !formData.gstEnabled)}
                    >
                        <View style={[styles.toggleDot, formData.gstEnabled ? styles.dotOn : styles.dotOff]} />
                    </TouchableOpacity>
                </View>

                {formData.gstEnabled && (
                    <View style={styles.gstInputContainer}>
                        <Text style={styles.inputLabel}>GSTIN Number *</Text>
                        <TextInput
                            style={[styles.input, styles.standaloneInput, styles.monoInput, showErrors && !formData.gstin?.trim() && styles.errorInput]}
                            value={formData.gstin}
                            onChangeText={(v) => handleChange('gstin', v.toUpperCase())}
                            placeholder="22AAAAA0000A1Z5"
                            autoCapitalize="characters"
                            placeholderTextColor="#94a3b8"
                        />
                        {showErrors && !formData.gstin?.trim() && <Text style={styles.errorText}>GSTIN is required when tax is enabled</Text>}
                    </View>
                )}
            </View>
        </View>
    );

    const renderStep3 = () => (
        <View style={styles.formContainer}>
            <View style={styles.infoBox}>
                <ShieldCheck size={20} color="#000" />
                <Text style={styles.infoText}>
                    Personal details are AES-256 encrypted and used only for synchronization and security verification.
                </Text>
            </View>

            <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Account Owner Name *</Text>
                <TextInput
                    style={[styles.input, styles.standaloneInput, showErrors && !formData.fullName?.trim() && styles.errorInput]}
                    value={formData.fullName}
                    onChangeText={(v) => handleChange('fullName', v)}
                    placeholder="e.g. John Doe"
                    placeholderTextColor="#94a3b8"
                />
                {showErrors && !formData.fullName?.trim() && <Text style={styles.errorText}>Owner name is required</Text>}
            </View>

            <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Owner Mobile Number *</Text>
                <TextInput
                    style={[styles.input, styles.standaloneInput, showErrors && !formData.mobile?.trim() && styles.errorInput]}
                    value={formData.mobile}
                    onChangeText={(v) => handleChange('mobile', v)}
                    placeholder="+91 98765 43210"
                    keyboardType="phone-pad"
                    placeholderTextColor="#94a3b8"
                />
                {showErrors && !formData.mobile?.trim() && <Text style={styles.errorText}>Mobile number is required</Text>}
            </View>

            <View style={styles.consentContainer}>
                <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.consentRow}
                    onPress={() => handleChange('consentAnalytics', !formData.consentAnalytics)}
                >
                    <View style={[styles.checkbox, formData.consentAnalytics && styles.checkboxActive]}>
                        {formData.consentAnalytics && <CheckCircle2 size={14} color="#fff" />}
                    </View>
                    <Text style={styles.consentLabel}>Anonymous analytics to improve app</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.consentRow}
                    onPress={() => handleChange('consentContact', !formData.consentContact)}
                >
                    <View style={[styles.checkbox, formData.consentContact && styles.checkboxActive]}>
                        {formData.consentContact && <CheckCircle2 size={14} color="#fff" />}
                    </View>
                    <Text style={styles.consentLabel}>Receive critical security & feature updates</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.iconCircle}>
                            <Building2 color="#fff" size={32} />
                        </View>
                        <Text style={styles.title}>Business Profile</Text>
                        <Text style={styles.subtitle}>Set up your digital store presence</Text>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressContainer}>
                        {steps.map((step, idx) => (
                            <View key={step.number} style={styles.stepItem}>
                                <View style={styles.stepIconWrapper}>
                                    <View style={[
                                        styles.stepCircle,
                                        currentStep === step.number ? styles.activeStep : (currentStep > step.number ? styles.completedStep : styles.inactiveStep)
                                    ]}>
                                        {currentStep > step.number ? (
                                            <CheckCircle2 color="#fff" size={18} />
                                        ) : (
                                            <Text style={[styles.stepNum, currentStep === step.number && styles.activeStepNum]}>{step.number}</Text>
                                        )}
                                    </View>
                                    <Text style={[styles.stepLabel, currentStep === step.number && styles.activeStepLabel]}>{step.title}</Text>
                                </View>
                                {idx < steps.length - 1 && (
                                    <View style={[styles.progressLine, currentStep > step.number && styles.completedLine]} />
                                )}
                            </View>
                        ))}
                    </View>

                    {/* Form Card */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={styles.cardHeaderLeft}>
                                <Layout size={18} color="#000" />
                                <Text style={styles.cardTitle}>{steps[currentStep - 1].title} Details</Text>
                            </View>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{currentStep} OF 3</Text>
                            </View>
                        </View>

                        {currentStep === 1 && renderStep1()}
                        {currentStep === 2 && renderStep2()}
                        {currentStep === 3 && renderStep3()}

                        {/* Navigation Footer */}
                        <View style={styles.footer}>
                            <TouchableOpacity
                                style={[styles.backBtn, currentStep === 1 && { opacity: 0 }]}
                                onPress={handleBack}
                                disabled={currentStep === 1}
                            >
                                <ChevronLeft size={20} color="#64748b" />
                                <Text style={styles.backText}>Back</Text>
                            </TouchableOpacity>

                            <View style={{ flex: 1 }} />

                            {currentStep < 3 ? (
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    style={[styles.nextBtn]}
                                    onPress={handleNext}
                                >
                                    <Text style={styles.nextText}>Continue</Text>
                                    <ChevronRight size={20} color="#fff" />
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    style={[styles.completeBtn, saving && styles.disabledBtn]}
                                    onPress={handleComplete}
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <>
                                            <Text style={styles.nextText}>Finalize Profile</Text>
                                            <CheckCircle2 size={20} color="#fff" />
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    <Text style={styles.securityNote}>
                        🔒 AES-256 Encrypted Local Storage
                    </Text>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#ffffff' },
    scrollContent: { padding: 24, paddingBottom: 60 },
    header: { alignItems: 'center', marginBottom: 32, marginTop: 10 },
    iconCircle: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    title: { fontSize: 32, fontWeight: '900', color: '#000', letterSpacing: -1 },
    subtitle: { fontSize: 14, color: '#64748b', fontWeight: '500', marginTop: 4 },

    progressContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 36, paddingHorizontal: 10 },
    stepItem: { flexDirection: 'row', alignItems: 'center' },
    stepIconWrapper: { alignItems: 'center', width: 60 },
    stepCircle: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    activeStep: { backgroundColor: '#000', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
    completedStep: { backgroundColor: '#000' },
    inactiveStep: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#e2e8f0' },
    stepNum: { fontSize: 14, fontWeight: '900', color: '#94a3b8' },
    activeStepNum: { color: '#fff' },
    stepLabel: { fontSize: 10, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
    activeStepLabel: { color: '#000' },
    progressLine: { width: 40, height: 2, backgroundColor: '#e2e8f0', marginHorizontal: 4, marginTop: -18 },
    completedLine: { backgroundColor: '#000' },

    card: { backgroundColor: '#fff', borderRadius: 32, padding: 24, borderWidth: 2, borderColor: '#000', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 5 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
    cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    cardTitle: { fontSize: 18, fontWeight: '900', color: '#000' },
    badge: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontSize: 10, fontWeight: '900', color: '#64748b' },

    formContainer: { gap: 20 },
    inputWrapper: { width: '100%' },
    inputLabel: { fontSize: 12, fontWeight: '900', color: '#000', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
    inputFieldContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 16, paddingHorizontal: 16, height: 56 },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, fontSize: 16, color: '#000', fontWeight: '700' },
    standaloneInput: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 16, paddingHorizontal: 16, height: 56, backgroundColor: '#fff' },
    row: { flexDirection: 'row', gap: 12 },
    col: { flex: 1 },
    monoInput: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', letterSpacing: 1 },

    gstSection: { marginTop: 10, backgroundColor: '#f8fafc', padding: 20, borderRadius: 20, borderWidth: 1.5, borderColor: '#e2e8f0' },
    gstHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    gstTitle: { fontSize: 15, fontWeight: '900', color: '#000' },
    gstSub: { fontSize: 12, color: '#64748b', fontWeight: '500' },
    toggle: { width: 52, height: 28, borderRadius: 14, padding: 2 },
    toggleOn: { backgroundColor: '#000' },
    toggleOff: { backgroundColor: '#e2e8f0' },
    toggleDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
    dotOn: { alignSelf: 'flex-end' },
    dotOff: { alignSelf: 'flex-start' },
    gstInputContainer: { marginTop: 20 },

    infoBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fafafa', padding: 16, borderRadius: 16, marginBottom: 8, borderWidth: 1.5, borderColor: '#e2e8f0' },
    infoText: { flex: 1, fontSize: 12, color: '#475569', fontWeight: '600', lineHeight: 18 },

    consentContainer: { gap: 12, marginTop: 10 },
    consentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
    checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: '#000', justifyContent: 'center', alignItems: 'center' },
    checkboxActive: { backgroundColor: '#000', borderColor: '#000' },
    consentLabel: { fontSize: 13, color: '#475569', fontWeight: '600' },

    footer: { flexDirection: 'row', alignItems: 'center', marginTop: 36, paddingTop: 24, borderTopWidth: 1.5, borderTopColor: '#f1f5f9' },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
    backText: { color: '#64748b', fontWeight: '800', fontSize: 15 },
    nextBtn: { backgroundColor: '#000', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
    completeBtn: { backgroundColor: '#000', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
    nextText: { color: '#fff', fontWeight: '900', fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
    disabledBtn: { backgroundColor: '#e2e8f0', shadowOpacity: 0, elevation: 0 },

    errorText: { color: '#ef4444', fontSize: 11, fontWeight: '700', marginTop: 4, marginLeft: 2 },
    errorInput: { borderColor: '#ef4444' },

    securityNote: { textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 32, fontWeight: '800', letterSpacing: 0.5 }
});

export default ShopDetails;
