import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Dimensions,
    ActivityIndicator,
    StatusBar
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useSettings } from '../../context/SettingsContext';
import { 
    Store, 
    MapPin, 
    User, 
    CheckCircle2, 
    Building2, 
    ShieldCheck, 
    Mail, 
    Phone, 
    Globe, 
    Briefcase,
    Zap,
    Lock,
    ArrowRight
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

// 🛠️ BUG FIX: Sub-components moved outside to prevent focus-loss on re-render
const StepIcon = ({ currentStep, step, icon: Icon }) => {
    const active = currentStep === step;
    const done = currentStep > step;
    return (
        <View style={styles.stepContainer}>
            <View style={[styles.stepCircle, active && styles.stepCircleActive, done && styles.stepCircleDone]}>
                <Icon size={16} color={active ? '#000' : (done ? '#fff' : '#888')} strokeWidth={active ? 2.5 : 2} />
            </View>
            <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>Step {step}</Text>
        </View>
    );
};

const InputField = ({ label, icon: Icon, value, onChange, placeholder, keyboard = 'default', error, autoCaps = 'none' }) => (
    <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{label}</Text>
        <View style={[styles.inputBox, error && styles.inputBoxError]}>
            <View style={styles.inputPrefix}>
                <Icon size={18} color="#000" strokeWidth={2.5} />
            </View>
            <TextInput
                style={styles.textInput}
                value={value}
                onChangeText={onChange}
                placeholder={placeholder}
                placeholderTextColor="#999"
                keyboardType={keyboard}
                autoCapitalize={autoCaps}
            />
        </View>
        {error && <Text style={styles.errorHint}>{error}</Text>}
    </View>
);

const ShopDetails = () => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { settings, saveFullSettings } = useSettings();

    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        storeName: settings?.store?.name || '',
        legalName: settings?.store?.legalName || '',
        businessType: settings?.store?.businessType || 'Proprietorship',
        contact: settings?.store?.contact || '',
        email: settings?.store?.email || '',
        website: settings?.store?.website || '',
        street: settings?.store?.address?.street || '',
        area: settings?.store?.address?.area || '',
        city: settings?.store?.address?.city || '',
        state: settings?.store?.address?.state || '',
        pincode: settings?.store?.address?.pincode || '',
        gstEnabled: settings?.tax?.gstEnabled ?? true,
        gstin: settings?.store?.gstin || '',
        fullName: settings?.user?.fullName || '',
        mobile: settings?.user?.mobile || '',
        userEmail: settings?.user?.email || '',
        role: settings?.user?.role || 'Owner',
        consentAnalytics: settings?.user?.consent?.analytics ?? true,
        consentContact: settings?.user?.consent?.contact ?? true,
    });

    const [saving, setSaving] = useState(false);
    const [showErrors, setShowErrors] = useState(false);

    useEffect(() => {
        if (settings?.store?.name || settings?.store?.email) {
            setFormData(prev => ({
                ...prev,
                storeName: settings?.store?.name || prev.storeName,
                legalName: settings?.store?.legalName || prev.legalName,
                businessType: settings?.store?.businessType || prev.businessType,
                contact: settings?.store?.contact || prev.contact,
                email: settings?.store?.email || prev.email,
                street: settings?.store?.address?.street || prev.street,
                city: settings?.store?.address?.city || prev.city,
                state: settings?.store?.address?.state || prev.state,
                pincode: settings?.store?.address?.pincode || prev.pincode,
                gstin: settings?.store?.gstin || prev.gstin,
                fullName: settings?.user?.fullName || prev.fullName,
                mobile: settings?.user?.mobile || prev.mobile,
            }));
        }
    }, [settings]);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (showErrors) setShowErrors(false);
    };

    const isStep1Valid = () => formData.storeName?.trim() && formData.legalName?.trim() && formData.contact?.trim() && formData.email?.trim();
    const isStep2Valid = () => {
        const baseValid = formData.street?.trim() && formData.city?.trim() && formData.state?.trim() && formData.pincode?.trim();
        return formData.gstEnabled ? (baseValid && formData.gstin?.trim()) : baseValid;
    };
    const isStep3Valid = () => formData.fullName?.trim() && formData.mobile?.trim();

    const handleNext = () => {
        const isValid = currentStep === 1 ? isStep1Valid() : (currentStep === 2 ? isStep2Valid() : isStep3Valid());
        if (isValid) {
            setCurrentStep(currentStep + 1);
            setShowErrors(false);
        } else {
            setShowErrors(true);
            Alert.alert('Incomplete Profile', 'Please provide the mandatory business details to continue.');
        }
    };

    const handleBack = () => { if (currentStep > 1) setCurrentStep(currentStep - 1); };

    const handleComplete = async () => {
        if (!isStep3Valid()) { setShowErrors(true); return; }
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
                tax: { ...settings.tax, gstEnabled: formData.gstEnabled },
                user: {
                    ...settings.user,
                    fullName: formData.fullName,
                    mobile: formData.mobile,
                    email: formData.userEmail || settings.user?.email,
                    consent: { analytics: formData.consentAnalytics, contact: formData.consentContact },
                },
                onboardingCompletedAt: new Date().toISOString(),
            };
            await saveFullSettings(finalSettings);
        } catch (error) {
            Alert.alert('Save Failed', 'Encryption service was unable to reach the cloud vault. Please retry.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            
            <LinearGradient colors={['#000', '#111']} style={[styles.header, { paddingTop: insets.top + 20 }]}>
                <View style={styles.headerContent}>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={styles.headerTitleBold}>KWIQ BILL</Text>
                    </View>
                </View>

                <View style={styles.progressRow}>
                    <StepIcon currentStep={currentStep} step={1} icon={Store} />
                    <View style={[styles.progressDivider, currentStep > 1 && styles.progressDividerDone]} />
                    <StepIcon currentStep={currentStep} step={2} icon={MapPin} />
                    <View style={[styles.progressDivider, currentStep > 2 && styles.progressDividerDone]} />
                    <StepIcon currentStep={currentStep} step={3} icon={User} />
                </View>
            </LinearGradient>

            <ScrollView 
                style={styles.body} 
                contentContainerStyle={[styles.scrollContent, { paddingBottom: 160 }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                    <View style={styles.stageHero}>
                        <View style={styles.stageIconBox}>
                            {currentStep === 1 ? <Building2 size={24} color="#fff" /> : 
                             currentStep === 2 ? <Globe size={24} color="#fff" /> : <Lock size={24} color="#fff" />}
                        </View>
                        <View>
                            <Text style={styles.stageTitle}>
                                {currentStep === 1 ? 'Business Identity' : 
                                 currentStep === 2 ? 'Store Location' : 'Global Profile'}
                            </Text>
                            <Text style={styles.stageSubtitle}>
                                {currentStep === 1 ? 'Define your professional presence' : 
                                 currentStep === 2 ? 'Configure tax and delivery zone' : 'Finalize secure account details'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.stepCard}>
                        {currentStep === 1 && (
                            <View style={styles.formGrid}>
                                <InputField label="BUSINESS DISPLAY NAME *" icon={Store} value={formData.storeName} onChange={(v) => handleChange('storeName', v)} placeholder="e.g. Noir Boutique" error={showErrors && !formData.storeName?.trim() ? 'Name required' : null} />
                                <InputField label="LEGAL FIRM NAME *" icon={Briefcase} value={formData.legalName} onChange={(v) => handleChange('legalName', v)} placeholder="As per GST/Trade file" error={showErrors && !formData.legalName?.trim() ? 'Legal name required' : null} />
                                <InputField label="OFFICIAL CONTACT *" icon={Phone} value={formData.contact} onChange={(v) => handleChange('contact', v)} placeholder="+91..." keyboard="phone-pad" error={showErrors && !formData.contact?.trim() ? 'Contact number required' : null} />
                                <InputField label="STORE EMAIL *" icon={Mail} value={formData.email} onChange={(v) => handleChange('email', v)} placeholder="mail@store.com" keyboard="email-address" error={showErrors && !formData.email?.trim() ? 'Email address required' : null} />
                            </View>
                        )}

                        {currentStep === 2 && (
                            <View style={styles.formGrid}>
                                <InputField label="STREET ADDRESS *" icon={MapPin} value={formData.street} onChange={(v) => handleChange('street', v)} placeholder="Building No, Street Name" error={showErrors && !formData.street?.trim() ? 'Address required' : null} />
                                <View style={styles.row}>
                                    <View style={{ flex: 1 }}><InputField label="CITY *" icon={Globe} value={formData.city} onChange={(v) => handleChange('city', v)} placeholder="City" error={showErrors && !formData.city?.trim() ? 'Required' : null} /></View>
                                    <View style={{ flex: 1 }}><InputField label="STATE *" icon={MapPin} value={formData.state} onChange={(v) => handleChange('state', v)} placeholder="State" error={showErrors && !formData.state?.trim() ? 'Required' : null} /></View>
                                </View>
                                <InputField label="PINCODE *" icon={Zap} value={formData.pincode} onChange={(v) => handleChange('pincode', v)} placeholder="123456" keyboard="numeric" error={showErrors && !formData.pincode?.trim() ? 'Pincode required' : null} />
                                <View style={styles.gstBox}>
                                    <View style={styles.gstHead}>
                                        <View><Text style={styles.gstTitle}>GST Compliance</Text><Text style={styles.gstSub}>Automatically apply tax on bills</Text></View>
                                        <TouchableOpacity style={[styles.tog, formData.gstEnabled ? styles.togOn : styles.togOff]} onPress={() => handleChange('gstEnabled', !formData.gstEnabled)}><View style={[styles.togDot, formData.gstEnabled && { alignSelf: 'flex-end' }]} /></TouchableOpacity>
                                    </View>
                                    {formData.gstEnabled && <View style={{ marginTop: 16 }}><InputField label="GSTIN NUMBER *" icon={ShieldCheck} value={formData.gstin} onChange={(v) => handleChange('gstin', v.toUpperCase())} placeholder="22AAAAA0000A1Z5" autoCaps="characters" error={showErrors && !formData.gstin?.trim() ? 'GSTIN required' : null} /></View>}
                                </View>
                            </View>
                        )}

                        {currentStep === 3 && (
                            <View style={styles.formGrid}>
                                <View style={styles.vaultAlert}><Lock size={16} color="#000" /><Text style={styles.vaultText}>Account details are encrypted inside your local vault.</Text></View>
                                <InputField label="ACCOUNT HOLDER NAME *" icon={User} value={formData.fullName} onChange={(v) => handleChange('fullName', v)} placeholder="Full Legal Name" error={showErrors && !formData.fullName?.trim() ? 'Name required' : null} />
                                <InputField label="PERSONAL MOBILE *" icon={Phone} value={formData.mobile} onChange={(v) => handleChange('mobile', v)} placeholder="+91..." keyboard="phone-pad" error={showErrors && !formData.mobile?.trim() ? 'Mobile required' : null} />
                                <View style={styles.optArea}>
                                    <TouchableOpacity style={styles.optRow} onPress={() => handleChange('consentAnalytics', !formData.consentAnalytics)}><View style={[styles.chk, formData.consentAnalytics && styles.chkOn]}>{formData.consentAnalytics && <CheckCircle2 size={12} color="#fff" />}</View><Text style={styles.optLabel}>Allow anonymous cloud sync for stability</Text></TouchableOpacity>
                                    <TouchableOpacity style={styles.optRow} onPress={() => handleChange('consentContact', !formData.consentContact)}><View style={[styles.chk, formData.consentContact && styles.chkOn]}>{formData.consentContact && <CheckCircle2 size={12} color="#fff" />}</View><Text style={styles.optLabel}>Critical security and backup notifications</Text></TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                {currentStep < 3 ? (
                    <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
                        <Text style={styles.nextTxt}>CONTINUE</Text>
                        <ArrowRight size={20} color="#fff" strokeWidth={2.5} />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={styles.finishBtn} onPress={handleComplete} disabled={saving}>
                        {saving ? <ActivityIndicator color="#fff" /> : (
                            <><Text style={styles.finishTxt}>INITIALIZE STORE</Text><Zap size={20} color="#fff" fill="#fff" /></>
                        )}
                    </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.backBtn, currentStep === 1 && { display: 'none' }]} disabled={currentStep === 1} onPress={handleBack}><Text style={styles.backTxt}>GO BACK TO PREVIOUS STEP</Text></TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fcfcfc' },
    header: { paddingBottom: 30, borderBottomLeftRadius: 35, borderBottomRightRadius: 35 },
    headerContent: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, marginBottom: 25 },
    headerTitleBold: { fontSize: 32, color: '#fff', fontWeight: '900', marginTop: -5, letterSpacing: -1, textAlign: 'center' },
    progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
    stepContainer: { alignItems: 'center', gap: 6 },
    stepCircle: { width: 32, height: 32, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)' },
    stepCircleActive: { backgroundColor: '#fff', borderColor: '#fff' },
    stepCircleDone: { backgroundColor: '#000', borderColor: '#444' },
    stepLabel: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' },
    stepLabelActive: { color: '#fff' },
    progressDivider: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 8, marginTop: -15 },
    progressDividerDone: { backgroundColor: '#fff' },
    body: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 30, paddingBottom: 120 },
    stageHero: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 25 },
    stageIconBox: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 10 },
    stageTitle: { fontSize: 22, fontWeight: '900', color: '#000', letterSpacing: -0.5 },
    stageSubtitle: { fontSize: 13, fontWeight: '600', color: '#777', marginTop: 2 },
    stepCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, borderWidth: 1.5, borderColor: '#eee', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    formGrid: { gap: 18 },
    inputGroup: { gap: 8 },
    inputLabel: { fontSize: 11, fontWeight: '800', color: '#000', letterSpacing: 0.5, textTransform: 'uppercase' },
    inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f8f8', borderWidth: 1.5, borderColor: '#f0f0f0', borderRadius: 14, height: 54 },
    inputBoxError: { borderColor: '#ff4b4b', backgroundColor: '#fff5f5' },
    inputPrefix: { width: 44, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#eee' },
    textInput: { flex: 1, paddingHorizontal: 14, fontSize: 15, fontWeight: '700', color: '#000' },
    row: { flexDirection: 'row', gap: 12 },
    errorHint: { fontSize: 11, fontWeight: '700', color: '#ff4b4b', marginLeft: 4 },
    gstBox: { backgroundColor: '#fafafa', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#f0f0f0' },
    gstHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    gstTitle: { fontSize: 16, fontWeight: '900', color: '#000' },
    gstSub: { fontSize: 12, fontWeight: '500', color: '#666' },
    tog: { width: 50, height: 26, borderRadius: 13, backgroundColor: '#eee', padding: 3 },
    togOn: { backgroundColor: '#000' },
    togDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
    vaultAlert: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#eee', padding: 12, borderRadius: 12, marginBottom: 5 },
    vaultText: { flex: 1, fontSize: 11, fontWeight: '700', color: '#000' },
    optArea: { gap: 12, marginTop: 5 },
    optRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    chk: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: '#000', justifyContent: 'center', alignItems: 'center' },
    chkOn: { backgroundColor: '#000' },
    optLabel: { fontSize: 13, fontWeight: '600', color: '#444' },
    footer: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#fff', alignItems: 'center', paddingHorizontal: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f0f0f0', gap: 8 },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
    backTxt: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 0.5 },
    nextBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#000', paddingHorizontal: 22, paddingVertical: 13, borderRadius: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
    nextTxt: { fontSize: 14, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
    finishBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#000', paddingHorizontal: 22, paddingVertical: 13, borderRadius: 15 },
    finishTxt: { fontSize: 14, fontWeight: '900', color: '#fff', letterSpacing: 0.5 }
});

export default ShopDetails;
