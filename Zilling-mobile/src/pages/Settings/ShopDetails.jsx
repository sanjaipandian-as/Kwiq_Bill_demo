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
import { Store, MapPin, User, CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react-native';
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

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const isStep1Valid = () => {
        return formData.storeName?.trim() && formData.contact?.trim();
    };

    const isStep2Valid = () => {
        return formData.city?.trim() && formData.state?.trim();
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
        if (currentStep < 3) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleComplete = async () => {
        if (!isStep3Valid()) {
            Alert.alert('Required Fields', 'Please fill in your name and mobile number.');
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
        { number: 1, title: 'Store', icon: Store },
        { number: 2, title: 'Address', icon: MapPin },
        { number: 3, title: 'Owner', icon: User },
    ];

    const renderStep1 = () => (
        <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Store Display Name *</Text>
            <TextInput
                style={styles.input}
                value={formData.storeName}
                onChangeText={(v) => handleChange('storeName', v)}
                placeholder="e.g. My Awesome Shop"
                placeholderTextColor="#94a3b8"
            />

            <Text style={styles.inputLabel}>Legal Business Name</Text>
            <TextInput
                style={styles.input}
                value={formData.legalName}
                onChangeText={(v) => handleChange('legalName', v)}
                placeholder="As per GST Certificate"
                placeholderTextColor="#94a3b8"
            />

            <Text style={styles.inputLabel}>Contact Number *</Text>
            <TextInput
                style={styles.input}
                value={formData.contact}
                onChangeText={(v) => handleChange('contact', v)}
                placeholder="+91 98765 43210"
                keyboardType="phone-pad"
                placeholderTextColor="#94a3b8"
            />

            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
                style={styles.input}
                value={formData.email}
                onChangeText={(v) => handleChange('email', v)}
                placeholder="store@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#94a3b8"
            />

            <Text style={styles.inputLabel}>Website</Text>
            <TextInput
                style={styles.input}
                value={formData.website}
                onChangeText={(v) => handleChange('website', v)}
                placeholder="www.example.com"
                autoCapitalize="none"
                placeholderTextColor="#94a3b8"
            />
        </View>
    );

    const renderStep2 = () => (
        <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Street Address</Text>
            <TextInput
                style={styles.input}
                value={formData.street}
                onChangeText={(v) => handleChange('street', v)}
                placeholder="Building name, street"
                placeholderTextColor="#94a3b8"
            />

            <View style={styles.row}>
                <View style={styles.col}>
                    <Text style={styles.inputLabel}>City *</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.city}
                        onChangeText={(v) => handleChange('city', v)}
                        placeholder="City"
                        placeholderTextColor="#94a3b8"
                    />
                </View>
                <View style={styles.col}>
                    <Text style={styles.inputLabel}>State *</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.state}
                        onChangeText={(v) => handleChange('state', v)}
                        placeholder="State"
                        placeholderTextColor="#94a3b8"
                    />
                </View>
            </View>

            <Text style={styles.inputLabel}>Pincode</Text>
            <TextInput
                style={styles.input}
                value={formData.pincode}
                onChangeText={(v) => handleChange('pincode', v)}
                placeholder="123456"
                keyboardType="numeric"
                placeholderTextColor="#94a3b8"
            />

            <View style={styles.gstHeader}>
                <View>
                    <Text style={styles.gstTitle}>GST Enabled</Text>
                    <Text style={styles.gstSub}>Enable tax calculations</Text>
                </View>
                <TouchableOpacity
                    style={[styles.toggle, formData.gstEnabled ? styles.toggleOn : styles.toggleOff]}
                    onPress={() => handleChange('gstEnabled', !formData.gstEnabled)}
                >
                    <View style={[styles.toggleDot, formData.gstEnabled ? styles.dotOn : styles.dotOff]} />
                </TouchableOpacity>
            </View>

            {formData.gstEnabled && (
                <View>
                    <Text style={styles.inputLabel}>GSTIN</Text>
                    <TextInput
                        style={[styles.input, styles.monoInput]}
                        value={formData.gstin}
                        onChangeText={(v) => handleChange('gstin', v.toUpperCase())}
                        placeholder="22AAAAA0000A1Z5"
                        autoCapitalize="characters"
                        placeholderTextColor="#94a3b8"
                    />
                </View>
            )}
        </View>
    );

    const renderStep3 = () => (
        <View style={styles.formContainer}>
            <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                    👤 This info is about <Text style={{ fontWeight: 'bold' }}>you</Text> (the owner), not the store address.
                </Text>
            </View>

            <Text style={styles.inputLabel}>Full Name *</Text>
            <TextInput
                style={styles.input}
                value={formData.fullName}
                onChangeText={(v) => handleChange('fullName', v)}
                placeholder="John Doe"
                placeholderTextColor="#94a3b8"
            />

            <Text style={styles.inputLabel}>Mobile Number *</Text>
            <TextInput
                style={styles.input}
                value={formData.mobile}
                onChangeText={(v) => handleChange('mobile', v)}
                placeholder="+91 98765 43210"
                keyboardType="phone-pad"
                placeholderTextColor="#94a3b8"
            />

            <Text style={styles.inputLabel}>Personal Email</Text>
            <TextInput
                style={styles.input}
                value={formData.userEmail}
                onChangeText={(v) => handleChange('userEmail', v)}
                placeholder="your.email@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#94a3b8"
            />

            <View style={styles.consentRow}>
                <TouchableOpacity
                    style={[styles.checkbox, formData.consentAnalytics && styles.checkboxActive]}
                    onPress={() => handleChange('consentAnalytics', !formData.consentAnalytics)}
                >
                    {formData.consentAnalytics && <CheckCircle2 size={14} color="#10b981" />}
                </TouchableOpacity>
                <Text style={styles.consentLabel}>Share anonymous usage data for app improvements</Text>
            </View>

            <View style={styles.consentRow}>
                <TouchableOpacity
                    style={[styles.checkbox, formData.consentContact && styles.checkboxActive]}
                    onPress={() => handleChange('consentContact', !formData.consentContact)}
                >
                    {formData.consentContact && <CheckCircle2 size={14} color="#10b981" />}
                </TouchableOpacity>
                <Text style={styles.consentLabel}>Get important updates & notifications</Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <LinearGradient
                    colors={['#ffffff', '#ffffff']}
                    style={styles.gradient}
                >
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.iconCircle}>
                                <Store color="#fff" size={32} />
                            </View>
                            <Text style={styles.title}>Complete Profile</Text>
                            <Text style={styles.subtitle}>Set up your store details to begin</Text>
                        </View>

                        {/* Progress */}
                        <View style={styles.stepsContainer}>
                            {steps.map((step, idx) => (
                                <View key={step.number} style={styles.stepWrapper}>
                                    <View style={styles.stepGroup}>
                                        <View style={[
                                            styles.stepCircle,
                                            currentStep === step.number ? styles.activeStep : (currentStep > step.number ? styles.completedStep : styles.inactiveStep)
                                        ]}>
                                            {currentStep > step.number ? (
                                                <CheckCircle2 color="#fff" size={20} />
                                            ) : (
                                                <Text style={[styles.stepNum, currentStep === step.number && styles.activeStepNum]}>{step.number}</Text>
                                            )}
                                        </View>
                                        <Text style={styles.stepTitle}>{step.title}</Text>
                                    </View>
                                    {idx < steps.length - 1 && (
                                        <View style={[styles.stepLine, currentStep > step.number && styles.completedLine]} />
                                    )}
                                </View>
                            ))}
                        </View>

                        {/* Card */}
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <View style={styles.cardHeaderLeft}>
                                    {React.createElement(steps[currentStep - 1].icon, { size: 20, color: '#000' })}
                                    <Text style={styles.cardTitle}>{steps[currentStep - 1].title}</Text>
                                </View>
                                <Text style={styles.stepCount}>Step {currentStep}/3</Text>
                            </View>

                            {currentStep === 1 && renderStep1()}
                            {currentStep === 2 && renderStep2()}
                            {currentStep === 3 && renderStep3()}

                            {/* Navigation */}
                            <View style={styles.footer}>
                                <TouchableOpacity
                                    style={[styles.backBtn, currentStep === 1 && { opacity: 0 }]}
                                    onPress={handleBack}
                                    disabled={currentStep === 1}
                                >
                                    <ChevronLeft size={20} color="#64748b" />
                                    <Text style={styles.backText}>Back</Text>
                                </TouchableOpacity>

                                {currentStep < 3 ? (
                                    <TouchableOpacity
                                        style={[styles.nextBtn, !canProceed() && styles.disabledBtn]}
                                        onPress={handleNext}
                                        disabled={!canProceed()}
                                    >
                                        <Text style={styles.nextText}>Next</Text>
                                        <ChevronRight size={20} color="#fff" />
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        style={[styles.completeBtn, (!canProceed() || saving) && styles.disabledBtn]}
                                        onPress={handleComplete}
                                        disabled={!canProceed() || saving}
                                    >
                                        {saving ? (
                                            <>
                                                <ActivityIndicator size="small" color="#fff" />
                                                <Text style={styles.nextText}>Uploading to Database...</Text>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 size={20} color="#10b981" />
                                                <Text style={styles.nextText}>Finish</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        <Text style={styles.secureText}>Your data is stored locally and securely on this device</Text>

                    </ScrollView>
                </LinearGradient>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#ffffff' },
    gradient: { flex: 1 },
    scrollContent: { padding: 24, paddingBottom: 60 },
    header: { alignItems: 'center', marginBottom: 40 },
    iconCircle: { width: 72, height: 72, borderRadius: 20, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 30, fontWeight: '900', color: '#000', marginBottom: 8, letterSpacing: -0.5 },
    subtitle: { fontSize: 15, color: '#64748b', fontWeight: '600' },

    stepsContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
    stepWrapper: { flexDirection: 'row', alignItems: 'center' },
    stepGroup: { alignItems: 'center', width: 70 },
    stepCircle: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    activeStep: { backgroundColor: '#10b981' },
    completedStep: { backgroundColor: '#000' },
    inactiveStep: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
    stepNum: { fontSize: 16, fontWeight: '800', color: '#64748b' },
    activeStepNum: { color: '#fff' },
    stepTitle: { fontSize: 11, fontWeight: '700', color: '#000', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
    stepLine: { width: 30, height: 3, borderRadius: 2, backgroundColor: '#f1f5f9', marginHorizontal: 0, marginTop: -20 },
    completedLine: { backgroundColor: '#000' },

    card: { backgroundColor: '#fff', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#000' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottomWidth: 1.5, borderBottomColor: '#f1f5f9', paddingBottom: 20 },
    cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    cardTitle: { fontSize: 20, fontWeight: '900', color: '#000' },
    stepCount: { fontSize: 12, color: '#64748b', fontWeight: '800' },

    formContainer: { gap: 20 },
    inputLabel: { fontSize: 13, fontWeight: '800', color: '#000', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 14, padding: 14, fontSize: 16, color: '#000' },
    row: { flexDirection: 'row', gap: 12 },
    col: { flex: 1 },
    monoInput: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', letterSpacing: 1 },

    gstHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 8, padding: 18, backgroundColor: '#f8fafc', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
    gstTitle: { fontSize: 15, fontWeight: '800', color: '#000' },
    gstSub: { fontSize: 12, color: '#64748b', fontWeight: '600' },
    toggle: { width: 50, height: 28, borderRadius: 14, padding: 2 },
    toggleOn: { backgroundColor: '#000' },
    toggleOff: { backgroundColor: '#f1f5f9' },
    toggleDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
    dotOn: { alignSelf: 'flex-end' },
    dotOff: { alignSelf: 'flex-start' },

    infoBox: { backgroundColor: '#fafafa', padding: 14, borderRadius: 14, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
    infoText: { fontSize: 13, color: '#000', lineHeight: 20, fontWeight: '600' },

    consentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
    checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#000', justifyContent: 'center', alignItems: 'center' },
    checkboxActive: { backgroundColor: '#000', borderColor: '#000' },
    consentLabel: { flex: 1, fontSize: 13, color: '#475569', lineHeight: 18, fontWeight: '500' },

    footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, borderTopWidth: 1.5, borderTopColor: '#f1f5f9', paddingTop: 24 },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 10 },
    backText: { color: '#64748b', fontWeight: '800', fontSize: 15 },
    nextBtn: { backgroundColor: '#10b981', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
    completeBtn: { backgroundColor: '#000', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
    nextText: { color: '#fff', fontWeight: '800', fontSize: 16 },
    disabledBtn: { backgroundColor: '#e2e8f0' },

    secureText: { textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 24, fontWeight: '600' }
});


export default ShopDetails;
