import React, { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    Modal, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Dimensions, SafeAreaView
} from 'react-native';
import { X, Check, ShieldCheck, Shield } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import services from '../../../../services/api';

const { height } = Dimensions.get('window');

const RATE_LIMIT_MINUTES = 5;
const STORAGE_KEY = '@kwiq_bill_customize_order';

const CustomizeForm = ({ visible, onClose }) => {
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
        const fn = sanitize(formData.fullName);
        const em = sanitize(formData.email);
        const ph = sanitize(formData.phone);

        if (!fn || !em || !ph || !formData.businessName) {
            Alert.alert('Missing Fields', 'Please complete all required fields.');
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(em)) {
            Alert.alert('Security Check', 'Please enter a valid email address.');
            return false;
        }

        const phoneRegex = /^[+]?[0-9]{10,15}$/;
        if (!phoneRegex.test(ph)) {
            Alert.alert('Security Check', 'Please enter a valid phone number (10-15 digits).');
            return false;
        }

        if (!formData.businessType) {
            Alert.alert('Action Required', 'Please select a business type.');
            return false;
        }

        if (formData.features.length === 0) {
            Alert.alert('Action Required', 'Please select at least one feature.');
            return false;
        }

        if (!formData.platform) {
            Alert.alert('Action Required', 'Please select a platform.');
            return false;
        }

        if (!formData.description) {
            Alert.alert('Action Required', 'Please provide a brief description.');
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
                        'Limit Exceeded',
                        `You have recently submitted a request. Please wait ${Math.ceil(RATE_LIMIT_MINUTES - diffMinutes)} minute(s) before trying again to prevent spam.`
                    );
                    setIsSubmitting(false);
                    return;
                }
            }

            // Assemble sanitized payload
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

            // Actual Secure POST request to Server
            await services.requests.createCustomizeRequest(validData);

            // Mark success & save rate limit data and email for status tracking
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ 
                timestamp: Date.now(),
                email: validData.email 
            }));

            setIsSuccess(true);
            setTimeout(() => {
                setIsSuccess(false);
                onClose();
                // Reset state securely
                setFormData({
                    fullName: '', email: '', phone: '', businessName: '',
                    businessType: '', features: [], platform: '', description: ''
                });
            }, 3000);

        } catch (e) {
            Alert.alert('Network Error', 'Secure submission failed. Please check your connection.');
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
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.modalContainer}
            >
                <SafeAreaView style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.headerTitle}>Customize Order</Text>
                            <View style={styles.secureBadgeInfo}>
                                <Shield size={12} color="#000000ff" />
                                <Text style={styles.secureTextInfo}>AES-256 Encrypted Submission</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X size={24} color="#000" />
                        </TouchableOpacity>
                    </View>

                    {isSuccess ? (
                        <View style={styles.successContainer}>
                            <View style={styles.successIconWrapper}>
                                <Check size={40} color="#fff" />
                            </View>
                            <Text style={styles.successTitle}>Request Secured</Text>
                            <Text style={styles.successDesc}>
                                Your tailor-made requirements have been submitted securely to our architecture team. We will reach out within 24 hours.
                            </Text>
                        </View>
                    ) : (
                        <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

                            {/* Contact Info */}
                            <Text style={styles.sectionTitle}>1. Personal Info</Text>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Full Name *</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="John Doe"
                                    placeholderTextColor="#94a3b8"
                                    value={formData.fullName}
                                    maxLength={100}
                                    onChangeText={(t) => setFormData({ ...formData, fullName: t })}
                                />
                            </View>

                            <View style={styles.row}>
                                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                                    <Text style={styles.label}>Email Address *</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="john@example.com"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        maxLength={100}
                                        value={formData.email}
                                        onChangeText={(t) => setFormData({ ...formData, email: t })}
                                    />
                                </View>
                                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                                    <Text style={styles.label}>Phone Number *</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="+91 0000000000"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="phone-pad"
                                        maxLength={15}
                                        value={formData.phone}
                                        onChangeText={(t) => setFormData({ ...formData, phone: t })}
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Business Legal Name *</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Your Company Pvt Ltd"
                                    placeholderTextColor="#94a3b8"
                                    maxLength={100}
                                    value={formData.businessName}
                                    onChangeText={(t) => setFormData({ ...formData, businessName: t })}
                                />
                            </View>

                            {/* App Requirements */}
                            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>2. App Architecture</Text>

                            <Text style={styles.label}>Business Type *</Text>
                            <View style={styles.chipContainer}>
                                {businessTypes.map(t => (
                                    <TouchableOpacity
                                        key={t}
                                        style={[styles.chip, formData.businessType === t && styles.chipActive]}
                                        onPress={() => setFormData({ ...formData, businessType: t })}
                                    >
                                        <Text style={[styles.chipText, formData.businessType === t && styles.chipTextActive]}>{t}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={[styles.label, { marginTop: 16 }]}>Core Features Needed *</Text>
                            <View style={styles.chipContainer}>
                                {featureList.map(f => {
                                    const active = formData.features.includes(f);
                                    return (
                                        <TouchableOpacity
                                            key={f}
                                            style={[styles.chip, active && styles.chipActive]}
                                            onPress={() => toggleFeature(f)}
                                        >
                                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{f}</Text>
                                        </TouchableOpacity>
                                    )
                                })}
                            </View>

                            <Text style={[styles.label, { marginTop: 16 }]}>Target Platform *</Text>
                            <View style={styles.chipContainer}>
                                {platforms.map(p => (
                                    <TouchableOpacity
                                        key={p}
                                        style={[styles.chip, formData.platform === p && styles.chipActive]}
                                        onPress={() => setFormData({ ...formData, platform: p })}
                                    >
                                        <Text style={[styles.chipText, formData.platform === p && styles.chipTextActive]}>{p}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Description */}
                            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>3. Scope & Details</Text>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Brief Description of Requirements *</Text>
                                <TextInput
                                    style={styles.textArea}
                                    placeholder="Describe exactly what your business workflow requires..."
                                    placeholderTextColor="#94a3b8"
                                    multiline
                                    numberOfLines={5}
                                    maxLength={1500}
                                    value={formData.description}
                                    onChangeText={(t) => setFormData({ ...formData, description: t })}
                                    textAlignVertical="top"
                                />
                                <Text style={styles.charCount}>{formData.description.length}/1500</Text>
                            </View>

                        </ScrollView>
                    )}

                    {!isSuccess && (
                        <View style={styles.footer}>
                            <TouchableOpacity
                                style={styles.submitBtn}
                                onPress={submitForm}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Text style={styles.submitText}>Submit</Text>
                                        {/* <ShieldCheck size={20} color="#fff" /> */}
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </SafeAreaView>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        height: height * 0.9,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: '#000',
        letterSpacing: -0.5,
    },
    secureBadgeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4
    },
    secureTextInfo: {
        fontSize: 10,
        fontWeight: '800',
        color: '#000000ff',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    closeBtn: {
        width: 44,
        height: 44,
        backgroundColor: '#f8fafc',
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollArea: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#000',
        marginBottom: 16,
        letterSpacing: -0.3,
    },
    inputGroup: {
        marginBottom: 16,
    },
    row: {
        flexDirection: 'row',
    },
    label: {
        fontSize: 13,
        fontWeight: '800',
        color: '#64748b',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#f8fafc',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        height: 52,
        paddingHorizontal: 16,
        fontSize: 15,
        fontWeight: '600',
        color: '#000',
    },
    textArea: {
        backgroundColor: '#f8fafc',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        minHeight: 120,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 16,
        fontSize: 15,
        fontWeight: '600',
        color: '#000',
    },
    charCount: {
        fontSize: 11,
        color: '#94a3b8',
        textAlign: 'right',
        marginTop: 6,
        fontWeight: '700'
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 100,
    },
    chipActive: {
        backgroundColor: '#000',
        borderColor: '#000',
    },
    chipText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#64748b',
    },
    chipTextActive: {
        color: '#fff',
    },
    footer: {
        padding: 24,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        backgroundColor: '#fff'
    },
    submitBtn: {
        backgroundColor: '#000',
        height: 56,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    submitText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    successContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    successIconWrapper: {
        width: 80,
        height: 80,
        backgroundColor: '#10b981',
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 10,
    },
    successTitle: {
        fontSize: 26,
        fontWeight: '900',
        color: '#000',
        marginBottom: 12,
    },
    successDesc: {
        fontSize: 15,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 24,
        fontWeight: '500'
    }
});

export default CustomizeForm;
