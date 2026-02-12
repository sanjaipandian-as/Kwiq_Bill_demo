import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    ScrollView
} from 'react-native';
import { Check, X, UserPlus, Phone } from 'lucide-react-native';
import { useCustomers } from '../../../context/CustomerContext';
import { Input } from '../../../components/ui/Input';

const CustomerCaptureModal = ({ isOpen, onClose, onSelect, initialValue = '' }) => {
    const { customers, addCustomer, fetchCustomers } = useCustomers();

    const [mobile, setMobile] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [step, setStep] = useState(1);
    const [customerName, setCustomerName] = useState('');
    const [optInWhatsapp, setOptInWhatsapp] = useState(false);
    const [optInSms, setOptInSms] = useState(false);
    const [existingCustomer, setExistingCustomer] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setOptInWhatsapp(false);
            setOptInSms(false);
            setExistingCustomer(null);

            const isNumeric = /^\d+$/.test(initialValue);

            if (!initialValue) {
                setMobile('');
                setCustomerName('');
                setStep(1);
            } else if (isNumeric) {
                setMobile(initialValue);
                setCustomerName('');

                if (initialValue.length === 10) {
                    // Check directly here to ensure state consistency
                    const found = customers.find(c => c.phone === initialValue);
                    if (found) {
                        setExistingCustomer(found);
                        setStep(1);
                    } else {
                        setExistingCustomer(null);
                        setStep(2); // Go to create mode immediately for new number
                    }
                } else {
                    setStep(1);
                }
            } else {
                // Name provided
                setMobile('');
                setCustomerName(initialValue);
                setStep(2);
            }
        }
    }, [isOpen, initialValue, customers]);

    const handleMobileChange = (text) => {
        const cleaned = text.replace(/[^0-9]/g, '');
        setMobile(cleaned);
        if (cleaned.length === 10) checkCustomer(cleaned);
        else if (cleaned.length < 10) {
            setExistingCustomer(null);
            setStep(1);
        }
    };

    const checkCustomer = (phone) => {
        setIsChecking(true);
        const found = customers.find(c => c.phone === phone);
        if (found) {
            setExistingCustomer(found);
            setStep(1);
        } else {
            setExistingCustomer(null);
            setStep(2);
        }
        setIsChecking(false);
    };

    const handleSaveNew = async () => {
        if (!customerName.trim()) {
            Alert.alert("Required Details", "Please provide the customer name.");
            return;
        }

        try {
            const newCust = { name: customerName, phone: mobile, whatsappOptIn: optInWhatsapp, smsOptIn: optInSms, source: 'POS', type: 'Individual' };
            const created = await addCustomer(newCust);
            if (created) onSelect(created);
            else onSelect({ ...newCust, id: Date.now().toString() });
            onClose();
        } catch (e) {
            Alert.alert("Error", "Failed to create customer");
        }
    };

    const handleConfirmExisting = () => {
        if (existingCustomer) {
            onSelect(existingCustomer);
            onClose();
        }
    };

    return (
        <Modal visible={isOpen} animationType="fade" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "padding"}
                    style={{ width: '100%', flex: 1, justifyContent: 'center' }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                    <View style={styles.modalContent}>
                        <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                            <View style={styles.header}>
                                <View>
                                    <Text style={styles.title}>Customer</Text>
                                    <Text style={styles.subtitle}>{existingCustomer ? 'Member Found' : 'Identify Guest'}</Text>
                                </View>
                                <TouchableOpacity onPress={onClose} style={styles.closeBtn}><X size={20} color="#000" /></TouchableOpacity>
                            </View>

                            <View style={styles.body}>
                                <View style={styles.inputCard}>
                                    <Text style={styles.labelSmall}>MOBILE NUMBER</Text>
                                    <View style={styles.rowCenter}>
                                        <Phone size={18} color="#94a3b8" />
                                        <TextInput
                                            style={styles.mainInput}
                                            value={mobile}
                                            onChangeText={handleMobileChange}
                                            placeholder="00000 00000"
                                            keyboardType="number-pad"
                                            maxLength={10}
                                            placeholderTextColor="#cbd5e1"
                                        />
                                        {isChecking ? <ActivityIndicator size="small" color="#000" /> :
                                            existingCustomer && <Check size={20} color="#22c55e" />}
                                    </View>
                                </View>

                                {!existingCustomer && step === 2 && (
                                    <View style={styles.detailFade}>
                                        <View style={[styles.inputCard, { marginTop: 12 }]}>
                                            <Text style={styles.labelSmall}>CUSTOMER NAME</Text>
                                            <TextInput
                                                value={customerName}
                                                onChangeText={setCustomerName}
                                                placeholder="John Doe"
                                                style={styles.mainInput}
                                                placeholderTextColor="#cbd5e1"
                                            />
                                        </View>

                                        <TouchableOpacity
                                            style={styles.optSwitch}
                                            onPress={() => setOptInWhatsapp(!optInWhatsapp)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={[styles.customCheck, optInWhatsapp && styles.customCheckActive]}>
                                                {optInWhatsapp && <Check size={12} color="#fff" />}
                                            </View>
                                            <Text style={styles.optText}>Enable WhatsApp Receipts</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {existingCustomer && (
                                    <View>
                                        <View style={styles.inputCard}>
                                            <Text style={styles.labelSmall}>MEMBER DETAILS</Text>
                                            <View style={styles.memberInfoRow}>
                                                <View style={styles.memberAvatarLarge}>
                                                    <Text style={styles.avatarTextLarge}>{(existingCustomer.name || 'U')[0]}</Text>
                                                </View>
                                                <View style={{ flex: 1, gap: 4 }}>
                                                    <Text style={styles.memberNameLarge}>{existingCustomer.name}</Text>
                                                    <Text style={styles.memberPhoneLarge}>{existingCustomer.phone}</Text>
                                                    <View style={styles.loyaltyBadge}>
                                                        <Text style={styles.loyaltyText}>{existingCustomer.loyaltyPoints || 0} LOYALTY POINTS</Text>
                                                    </View>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                )}
                            </View>

                            <View style={styles.footer}>
                                {step === 2 && !existingCustomer ? (
                                    <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveNew}>
                                        <Text style={styles.primaryBtnText}>Proceed with Guest</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        style={[styles.primaryBtn, !existingCustomer && { opacity: 0.5 }]}
                                        onPress={handleConfirmExisting}
                                        disabled={!existingCustomer}
                                    >
                                        <Text style={styles.primaryBtnText}>Confirm Membership</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modalContent: { backgroundColor: 'white', borderRadius: 40, width: '100%', overflow: 'hidden', padding: 8 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingBottom: 12 },
    title: { fontSize: 24, fontWeight: '900', color: '#000' },
    subtitle: { fontSize: 13, fontWeight: '700', color: '#94a3b8', marginTop: 2 },
    closeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
    body: { paddingHorizontal: 24, paddingVertical: 12 },

    labelSmall: { fontSize: 10, fontWeight: '900', color: '#cbd5e1', letterSpacing: 1, marginBottom: 8 },
    inputCard: { backgroundColor: '#f8fafc', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#f1f5f9' },
    rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    mainInput: { flex: 1, fontSize: 18, fontWeight: '800', color: '#000', padding: 0 },

    detailFade: { marginTop: 12 },
    optSwitch: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, paddingHorizontal: 4 },
    customCheck: { width: 22, height: 22, borderRadius: 8, borderWidth: 2, borderColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
    customCheckActive: { backgroundColor: '#000', borderColor: '#000' },
    optText: { fontSize: 14, fontWeight: '700', color: '#64748b' },

    memberBanner: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#f0fdf4', padding: 20, borderRadius: 24, marginTop: 12, borderWidth: 1, borderColor: '#dcfce7' },
    memberAvatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontWeight: '900', fontSize: 20 },
    memberName: { fontSize: 18, fontWeight: '900', color: '#065f46' },
    memberStats: { fontSize: 11, fontWeight: '900', color: '#059669', letterSpacing: 1, marginTop: 2 },

    footer: { padding: 24 },
    primaryBtn: { backgroundColor: '#000', height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    primaryBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },

    // Member Details Styles
    memberInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
    memberAvatarLarge: { width: 64, height: 64, borderRadius: 24, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
    avatarTextLarge: { fontSize: 28, fontWeight: '900', color: '#fff' },
    memberNameLarge: { fontSize: 20, fontWeight: '800', color: '#000' },
    memberPhoneLarge: { fontSize: 16, fontWeight: '600', color: '#64748b' },
    loyaltyBadge: { backgroundColor: '#f0fdf4', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#dcfce7' },
    loyaltyText: { fontSize: 11, fontWeight: '800', color: '#16a34a', letterSpacing: 0.5 }
});

export default CustomerCaptureModal;
