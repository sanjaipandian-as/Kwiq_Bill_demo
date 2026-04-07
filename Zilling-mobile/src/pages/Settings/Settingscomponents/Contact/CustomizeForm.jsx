import React, { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    Modal, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Dimensions, SafeAreaView, Pressable
} from 'react-native';
import { X, Check, ShieldCheck, Shield, User, Mail, Phone, Building, LayoutGrid, FileText, Smartphone, Sparkles, Zap, ChevronDown, ArrowRight } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import services from '../../../../services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height, width } = Dimensions.get('window');

const RATE_LIMIT_MINUTES = 5;
const STORAGE_KEY = '@kwiq_bill_customize_order';

const CustomizeForm = ({ visible, onClose }) => {
    const insets = useSafeAreaInsets();
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        businessName: '',
        businessType: '',
        features: [],
        platform: '',
        description: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const businessTypes = ['Retail', 'Restaurant', 'Wholesale', 'Other'];
    const featureList = ['Billing', 'Inventory', 'Reports', 'GST', 'Multi-user', 'Other'];
    const platforms = ['Android', 'iOS', 'Both'];

    // Validation & Security Checker 
    const sanitize = (text) => text.replace(/[<>]/g, '').trim();

    const handleValidation = () => {
        if (!formData.fullName || !formData.email || !formData.phone || !formData.businessName) {
            Alert.alert('Required Fields', 'Please fill in all identity details.');
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            Alert.alert('Validation Error', 'Please enter a valid email address.');
            return false;
        }

        if (formData.phone.length < 10) {
            Alert.alert('Validation Error', 'Please enter a valid phone number.');
            return false;
        }

        if (!formData.businessType) {
            Alert.alert('Selection Required', 'Please select a business type.');
            return false;
        }

        if (formData.features.length === 0) {
            Alert.alert('Selection Required', 'Please select at least one feature.');
            return false;
        }

        if (!formData.platform) {
            Alert.alert('Selection Required', 'Please select a target platform.');
            return false;
        }

        if (!formData.description.trim()) {
            Alert.alert('Information Required', 'Please describe your custom requirements.');
            return false;
        }

        return true;
    };

    const submitForm = async () => {
        if (!handleValidation()) return;

        setIsSubmitting(true);
        try {
            // RATE LIMITING SECURITY CHECK
            const lastSubmitStr = await AsyncStorage.getItem(STORAGE_KEY);
            if (lastSubmitStr) {
                const lastSubmitInfo = JSON.parse(lastSubmitStr);
                const diffMinutes = (Date.now() - lastSubmitInfo.timestamp) / (1000 * 60);

                if (diffMinutes < RATE_LIMIT_MINUTES) {
                    Alert.alert(
                        'Recent Submission',
                        `Please wait ${Math.ceil(RATE_LIMIT_MINUTES - diffMinutes)} minute(s) before sending another request.`
                    );
                    setIsSubmitting(false);
                    return;
                }
            }

            const validData = {
                fullName: sanitize(formData.fullName),
                email: sanitize(formData.email),
                phone: sanitize(formData.phone),
                businessName: sanitize(formData.businessName),
                businessType: formData.businessType,
                features: formData.features,
                platform: formData.platform,
                description: sanitize(formData.description)
            };

            await services.requests.createCustomizeRequest(validData);

            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ 
                timestamp: Date.now(),
                email: validData.email 
            }));

            setIsSuccess(true);
            setTimeout(() => {
                setIsSuccess(false);
                onClose();
                setFormData({
                    fullName: '', email: '', phone: '', businessName: '',
                    businessType: '', features: [], platform: '', description: ''
                });
            }, 3000);

        } catch (e) {
            Alert.alert('Submission Failed', 'Check your internet connection and try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleFeature = (f) => {
        setFormData(prev => ({
            ...prev,
            features: prev.features.includes(f)
                ? prev.features.filter(item => item !== f)
                : [...prev.features, f]
        }));
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.container}>
                <View style={styles.topHeader}>
                    <View style={styles.dragHandle} />
                    <View style={styles.headerTitleRow}>
                        <View style={styles.titleContent}>
                            <Text style={styles.mainTitle}>Customize Order</Text>
                            <Text style={styles.subTitle}>Tailor Kwiq Bill to your exact workflow</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.headerClose}>
                            <X size={20} color="#000" />
                        </TouchableOpacity>
                    </View>
                </View>

                {isSuccess ? (
                    <View style={styles.successContainer}>
                        <View style={styles.successIconWrapper}>
                            <Check size={40} color="#fff" />
                        </View>
                        <Text style={styles.successTitle}>Request Received</Text>
                        <Text style={styles.successDesc}>
                            Your custom architecture requirements have been secured. Architect team will contact you within 24 hours.
                        </Text>
                    </View>
                ) : (
                    <View style={{ flex: 1 }}>
                        <ScrollView style={styles.mainBody} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                            
                            <View style={styles.inputGroup}>
                                <Text style={styles.groupTitle}>Identity & Contact</Text>
                                
                                <View style={styles.fieldItem}>
                                    <Text style={styles.fieldLabel}>FULL NAME <Text style={styles.reqText}>*</Text></Text>
                                    <View style={styles.inputWrapper}>
                                        <User size={18} color="#777" />
                                        <TextInput
                                            style={styles.fieldInput}
                                            placeholder="e.g. John Doe"
                                            placeholderTextColor="#bbb"
                                            value={formData.fullName}
                                            onChangeText={(t) => setFormData({ ...formData, fullName: t })}
                                        />
                                    </View>
                                </View>

                                <View style={styles.gridRow}>
                                    <View style={[styles.fieldItem, { flex: 1 }]}>
                                        <Text style={styles.fieldLabel}>PHONE NUMBER <Text style={styles.reqText}>*</Text></Text>
                                        <View style={styles.inputWrapper}>
                                            <Phone size={18} color="#777" />
                                            <TextInput
                                                style={styles.fieldInput}
                                                placeholder="+91..."
                                                placeholderTextColor="#bbb"
                                                keyboardType="phone-pad"
                                                value={formData.phone}
                                                onChangeText={(t) => setFormData({ ...formData, phone: t })}
                                            />
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.fieldItem}>
                                    <Text style={styles.fieldLabel}>EMAIL ADDRESS <Text style={styles.reqText}>*</Text></Text>
                                    <View style={styles.inputWrapper}>
                                        <Mail size={18} color="#777" />
                                        <TextInput
                                            style={styles.fieldInput}
                                            placeholder="contact@business.com"
                                            placeholderTextColor="#bbb"
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            value={formData.email}
                                            onChangeText={(t) => setFormData({ ...formData, email: t })}
                                        />
                                    </View>
                                </View>

                                <View style={styles.fieldItem}>
                                    <Text style={styles.fieldLabel}>BUSINESS LEGAL NAME <Text style={styles.reqText}>*</Text></Text>
                                    <View style={styles.inputWrapper}>
                                        <Building size={18} color="#777" />
                                        <TextInput
                                            style={styles.fieldInput}
                                            placeholder="Your Company Name"
                                            placeholderTextColor="#bbb"
                                            value={formData.businessName}
                                            onChangeText={(t) => setFormData({ ...formData, businessName: t })}
                                        />
                                    </View>
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.groupTitle}>System Architecture</Text>

                                <Text style={styles.fieldLabel}>BUSINESS MODEL <Text style={styles.reqText}>*</Text></Text>
                                <View style={styles.chipStack}>
                                    {businessTypes.map(t => (
                                        <TouchableOpacity
                                            key={t}
                                            style={[styles.miniChip, formData.businessType === t && styles.miniChipActive]}
                                            onPress={() => setFormData({ ...formData, businessType: t })}
                                        >
                                            <Text style={[styles.miniChipText, formData.businessType === t && styles.miniChipTextActive]}>{t}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={[styles.fieldLabel, { marginTop: 16 }]}>CORE FEATURES NEEDED <Text style={styles.reqText}>*</Text></Text>
                                <View style={styles.chipStack}>
                                    {featureList.map(f => {
                                        const active = formData.features.includes(f);
                                        return (
                                            <TouchableOpacity
                                                key={f}
                                                style={[styles.miniChip, active && styles.miniChipActive]}
                                                onPress={() => toggleFeature(f)}
                                            >
                                                <Text style={[styles.miniChipText, active && styles.miniChipTextActive]}>{f}</Text>
                                            </TouchableOpacity>
                                        )
                                    })}
                                </View>

                                <Text style={[styles.fieldLabel, { marginTop: 16 }]}>TARGET PLATFORM <Text style={styles.reqText}>*</Text></Text>
                                <View style={styles.chipStack}>
                                    {platforms.map(p => (
                                        <TouchableOpacity
                                            key={p}
                                            style={[styles.miniChip, formData.platform === p && styles.miniChipActive]}
                                            onPress={() => setFormData({ ...formData, platform: p })}
                                        >
                                            <Text style={[styles.miniChipText, formData.platform === p && styles.miniChipTextActive]}>{p}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.groupTitle}>Technical Scope</Text>
                                <View style={styles.fieldItem}>
                                    <Text style={styles.fieldLabel}>BRIEF SCOPE OF WORK <Text style={styles.reqText}>*</Text></Text>
                                    <TextInput
                                        style={styles.textArea}
                                        placeholder="Describe your specific business workflow, integrations, or hardware requirements..."
                                        placeholderTextColor="#bbb"
                                        multiline
                                        numberOfLines={5}
                                        maxLength={1500}
                                        value={formData.description}
                                        onChangeText={(t) => setFormData({ ...formData, description: t })}
                                        textAlignVertical="top"
                                    />
                                    <Text style={styles.counter}>{formData.description.length}/1500</Text>
                                </View>
                            </View>

                            <View style={styles.secureFooter}>
                                <ShieldCheck size={14} color="#64748b" />
                                <Text style={styles.secureFooterText}>ENCRYPTED SUBMISSION VIA KWIQ SECURE RELAY</Text>
                            </View>

                        </ScrollView>

                        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                            <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, 24) }]}>
                                <TouchableOpacity
                                    style={[styles.submitAction, isSubmitting && styles.btnLoading]}
                                    onPress={submitForm}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <>
                                            <ArrowRight size={18} color="#fff" />
                                            <Text style={styles.submitActionText}>SUBMIT ARCHITECTURE REQUEST</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </KeyboardAvoidingView>
                    </View>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    topHeader: { backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#efefef' },
    dragHandle: { width: 36, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
    headerTitleRow: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18, alignItems: 'center', justifyContent: 'space-between' },
    titleContent: { gap: 2 },
    mainTitle: { fontSize: 22, fontWeight: '900', color: '#000', letterSpacing: -0.5 },
    subTitle: { fontSize: 13, fontWeight: '600', color: '#999' },
    headerClose: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#f3f3f3', alignItems: 'center', justifyContent: 'center' },

    mainBody: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
    inputGroup: { marginBottom: 24 },
    groupTitle: { fontSize: 13, fontWeight: '900', color: '#000', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 18 },
    fieldItem: { marginBottom: 18 },
    fieldLabel: { fontSize: 11, fontWeight: '800', color: '#64748b', marginBottom: 8, letterSpacing: 0.5 },
    reqText: { color: '#ef4444' },

    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        paddingHorizontal: 15,
        height: 54,
    },
    fieldInput: {
        flex: 1,
        fontSize: 15,
        fontWeight: '700',
        color: '#000',
        marginLeft: 12,
    },
    gridRow: { flexDirection: 'row', gap: 12 },

    chipStack: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    miniChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 14,
    },
    miniChipActive: { backgroundColor: '#000', borderColor: '#000' },
    miniChipText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
    miniChipTextActive: { color: '#fff' },

    textArea: {
        backgroundColor: '#f8fafc',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        minHeight: 120,
        padding: 16,
        fontSize: 15,
        fontWeight: '700',
        color: '#000',
    },
    counter: { fontSize: 10, color: '#94a3b8', textAlign: 'right', marginTop: 6, fontWeight: '800' },

    modalFooter: {
        padding: 24,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        backgroundColor: '#fff'
    },
    submitAction: {
        backgroundColor: '#000',
        height: 58,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
    },
    submitActionText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
    btnLoading: { opacity: 0.8 },

    secureFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, marginBottom: 20 },
    secureFooterText: { fontSize: 9, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.5 },

    successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
    successIconWrapper: {
        width: 80, height: 80, backgroundColor: '#000', borderRadius: 40,
        justifyContent: 'center', alignItems: 'center', marginBottom: 24,
        shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 12
    },
    successTitle: { fontSize: 26, fontWeight: '900', color: '#000', marginBottom: 12, letterSpacing: -0.5 },
    successDesc: { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22, fontWeight: '600' }
});

export default CustomizeForm;
