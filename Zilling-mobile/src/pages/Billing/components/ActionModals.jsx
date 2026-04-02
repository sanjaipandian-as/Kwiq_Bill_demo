import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Modal, ScrollView, ActivityIndicator, Dimensions, Keyboard } from 'react-native';

import { X, Tag, PlusCircle, FileText, Award, Star, ChevronRight, Check } from 'lucide-react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '../../../context/ToastContext';


const { width } = Dimensions.get('window');

// Hook to track keyboard visibility and handle layout animations
const useKeyboard = () => {
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const show = Keyboard.addListener(showEvent, () => {
            setKeyboardVisible(true);
        });
        const hide = Keyboard.addListener(hideEvent, () => {
            setKeyboardVisible(false);
        });
        return () => { show.remove(); hide.remove(); };
    }, []);
    return keyboardVisible;
};

export const DiscountModal = ({ isOpen, onClose, onApply, title = "Apply Discount", initialValue = 0, isPercentage = false }) => {
    const [value, setValue] = useState(initialValue.toString());
    const [mode, setMode] = useState(isPercentage ? 'percent' : 'amount');
    const insets = useSafeAreaInsets();

    useEffect(() => {
        if (isOpen) setValue(initialValue.toString());
    }, [isOpen, initialValue]);

    const handleSubmit = () => {
        onApply(parseFloat(value) || 0, mode === 'percent');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Modal visible={isOpen} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={() => {
                        Keyboard.dismiss();
                        onClose();
                    }}
                />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                    style={{ flex: 1, justifyContent: 'flex-end' }}
                    keyboardVerticalOffset={0}
                >
                    <View style={styles.drawerContent}>
                        <View style={styles.dragHandle} />

                        <View style={styles.drawerHeader}>
                            <Text style={styles.drawerTitle}>{title}</Text>
                            <TouchableOpacity onPress={onClose} style={styles.drawerCloseBtn}>
                                <X size={18} color="#000" strokeWidth={3} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.drawerBody} keyboardShouldPersistTaps="handled">
                            <View style={styles.segmentRow}>
                                <TouchableOpacity
                                    style={[styles.segmentItem, mode === 'amount' && styles.segmentItemActive]}
                                    onPress={() => setMode('amount')}
                                >
                                    <Text style={[styles.segmentItemText, mode === 'amount' && styles.segmentItemTextActive]}>Value (₹)</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.segmentItem, mode === 'percent' && styles.segmentItemActive]}
                                    onPress={() => setMode('percent')}
                                >
                                    <Text style={[styles.segmentItemText, mode === 'percent' && styles.segmentItemTextActive]}>Percent (%)</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.drawerInputContainer}>
                                <Text style={styles.drawerInputLabel}>DISCOUNT VALUE</Text>
                                <TextInput
                                    keyboardType="numeric"
                                    value={value}
                                    onChangeText={setValue}
                                    style={styles.drawerBigInput}
                                    placeholder="0.00"
                                    placeholderTextColor="#cbd5e1"
                                    onSubmitEditing={handleSubmit}
                                />
                            </View>

                            <View style={styles.drawerChipGrid}>
                                {(mode === 'percent' ? [5, 10, 15, 20] : [50, 100, 200, 500]).map(p => (
                                    <TouchableOpacity key={p} style={styles.drawerChip} onPress={() => setValue(p.toString())}>
                                        <Text style={styles.drawerChipText}>{mode === 'percent' ? `${p}%` : `₹${p}`}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

                        <View style={[styles.floatingFooter, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                            <View style={styles.drawerActionRow}>
                                <TouchableOpacity style={styles.drawerCancelBtn} onPress={onClose}>
                                    <X size={20} color="#ef4444" strokeWidth={3} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.drawerPrimaryBtn} onPress={handleSubmit}>
                                    <Text style={styles.drawerPrimaryBtnText}>Apply Discount</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

export const AdditionalChargesModal = ({ isOpen, onClose, onApply, initialValue = 0 }) => {
    const [value, setValue] = useState(initialValue.toString());
    const insets = useSafeAreaInsets();

    useEffect(() => {
        if (isOpen) setValue(initialValue.toString());
    }, [isOpen, initialValue]);

    const handleSubmit = () => {
        onApply(parseFloat(value) || 0);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Modal visible={isOpen} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={() => {
                        Keyboard.dismiss();
                        onClose();
                    }}
                />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                    style={{ flex: 1, justifyContent: 'flex-end' }}
                    keyboardVerticalOffset={0}
                >
                    <View style={styles.drawerContent}>
                        <View style={styles.dragHandle} />

                        <View style={styles.drawerHeader}>
                            <Text style={styles.drawerTitle}>Extra Charges</Text>
                            <TouchableOpacity onPress={onClose} style={styles.drawerCloseBtn}>
                                <X size={18} color="#000" strokeWidth={3} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.drawerBody} keyboardShouldPersistTaps="handled">
                            <View style={styles.drawerInputContainer}>
                                <Text style={styles.drawerInputLabel}>CHARGE AMOUNT (₹)</Text>
                                <TextInput
                                    keyboardType="numeric"
                                    value={value}
                                    onChangeText={setValue}
                                    style={styles.drawerBigInput}
                                    placeholder="0.00"
                                    placeholderTextColor="#cbd5e1"
                                    onSubmitEditing={handleSubmit}
                                />
                            </View>

                            <View style={styles.drawerChipGrid}>
                                {[10, 20, 50, 100].map(p => (
                                    <TouchableOpacity key={p} style={styles.drawerChip} onPress={() => setValue(p.toString())}>
                                        <Text style={styles.drawerChipText}>₹{p}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

                        <View style={[styles.floatingFooter, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                            <View style={styles.drawerActionRow}>
                                <TouchableOpacity style={styles.drawerCancelBtn} onPress={onClose}>
                                    <X size={20} color="#ef4444" strokeWidth={3} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.drawerPrimaryBtn} onPress={handleSubmit}>
                                    <Text style={styles.drawerPrimaryBtnText}>Apply Charges</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

export const LoyaltyPointsModal = ({ isOpen, onClose, onApply, availablePoints = 0, subtotal = 0 }) => {
    const [pointsToRedeem, setPointsToRedeem] = useState('');
    const insets = useSafeAreaInsets();
    const { showToast } = useToast();


    const conversionRate = 0.1;
    const minRedeem = 100;
    const multipleOf = 100;
    const maxRedeemPercent = 0.5;

    useEffect(() => {
        if (isOpen) setPointsToRedeem('');
    }, [isOpen]);

    const numAvailable = parseFloat(availablePoints) || 0;
    const numSubtotal = parseFloat(subtotal) || 0;
    const maxAllowedValue = numSubtotal * maxRedeemPercent;
    const redeemableLimit = Math.min(numAvailable, Math.floor(maxAllowedValue / conversionRate));

    const handleChipPress = (p) => {
        if (p > redeemableLimit) {
            showToast(`Rule Limit: You can redeem up to ${redeemableLimit} pts for this bill.`, 'minimal');

            return;
        }
        setPointsToRedeem(p.toString());
    };


    const handleSubmit = () => {
        const redeemValue = parseInt(pointsToRedeem) || 0;
        if (redeemValue === 0) { onApply(0, 0); onClose(); return; }
        if (redeemValue < minRedeem) { showToast(`Rule Violation: Min ${minRedeem} pts.`, 'minimal'); return; }

        if (redeemValue % multipleOf !== 0) { showToast(`Invalid Amount: Multiples of ${multipleOf}.`, 'minimal'); return; }

        if (redeemValue > numAvailable) { showToast("Balance Issue: Insufficient balance.", 'minimal'); return; }


        const discountValue = redeemValue * conversionRate;
        if (discountValue > maxAllowedValue + 0.01) { showToast("Limit Exceeded: Max 50% of bill.", 'minimal'); return; }


        onApply(discountValue, redeemValue);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Modal visible={isOpen} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={() => {
                        Keyboard.dismiss();
                        onClose();
                    }}
                />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                    style={{ flex: 1, justifyContent: 'flex-end' }}
                    keyboardVerticalOffset={0}
                >
                    <View style={styles.drawerContent}>
                        <View style={styles.dragHandle} />

                        <View style={styles.drawerHeader}>
                            <View>
                                <Text style={styles.drawerTitle}>Redeem Points</Text>
                                <Text style={styles.drawerSubtitle}>{numAvailable} available balance</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={styles.balanceBadge}>
                                    <Award size={12} color="#facc15" fill="#facc15" />
                                    <Text style={styles.balanceBadgeText}>{numAvailable} pts</Text>
                                </View>
                                <TouchableOpacity onPress={onClose} style={styles.drawerCloseBtn}>
                                    <X size={16} color="#000" strokeWidth={3} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <ScrollView style={styles.drawerBody} keyboardShouldPersistTaps="handled">
                            <View style={styles.loyaltyStatsRow}>
                                <View style={styles.statsCard}>
                                    <Text style={styles.statsLabel}>REDEEMABLE</Text>
                                    <Text style={styles.statsValue}>{redeemableLimit} <Text style={{ fontSize: 10, color: '#94a3b8' }}>PTS</Text></Text>
                                </View>
                                <View style={[styles.statsCard, { backgroundColor: '#f0fdf4', borderColor: '#dcfce7' }]}>
                                    <Text style={[styles.statsLabel, { color: '#16a34a' }]}>DISCOUNT (₹)</Text>
                                    <Text style={[styles.statsValue, { color: '#16a34a' }]}>₹{((parseInt(pointsToRedeem) || 0) * conversionRate).toFixed(0)}</Text>
                                </View>
                            </View>

                            <View style={styles.drawerInputContainer}>
                                <Text style={styles.drawerInputLabel}>POINTS TO REDEEM</Text>
                                <TextInput
                                    keyboardType="numeric"
                                    value={pointsToRedeem}
                                    onChangeText={setPointsToRedeem}
                                    style={styles.drawerBigInput}
                                    placeholder="0"
                                    placeholderTextColor="#cbd5e1"
                                    onSubmitEditing={handleSubmit}
                                />
                            </View>

                            <View style={styles.drawerChipGrid}>
                                {[100, 200, 500, 1000].map(p => (
                                    <TouchableOpacity
                                        key={p}
                                        style={[styles.drawerChip, p > redeemableLimit && { opacity: 0.3 }]}
                                        onPress={() => handleChipPress(p)}
                                    >
                                        <Text style={styles.drawerChipText}>{p} pts</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

                        <View style={[styles.floatingFooter, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                            <View style={styles.drawerActionRow}>
                                <TouchableOpacity style={styles.drawerCancelBtn} onPress={onClose}>
                                    <X size={20} color="#ef4444" strokeWidth={3} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.drawerPrimaryBtn} onPress={handleSubmit}>
                                    <Text style={styles.drawerPrimaryBtnText}>Confirm Redemption</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

export const RemarksModal = ({ isOpen, onClose, onSave, initialValue = "" }) => {
    const [text, setText] = useState(initialValue);
    const insets = useSafeAreaInsets();

    useEffect(() => {
        if (isOpen) setText(initialValue);
    }, [isOpen, initialValue]);

    const handleSubmit = () => { onSave(text); onClose(); };

    if (!isOpen) return null;

    return (
        <Modal visible={isOpen} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={() => {
                        Keyboard.dismiss();
                        onClose();
                    }}
                />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                    style={{ flex: 1, justifyContent: 'flex-end' }}
                    keyboardVerticalOffset={0}
                >
                    <View style={styles.drawerContent}>
                        <View style={styles.dragHandle} />

                        <View style={styles.drawerHeader}>
                            <Text style={styles.drawerTitle}>Add Note</Text>
                            <TouchableOpacity onPress={onClose} style={styles.drawerCloseBtn}>
                                <X size={18} color="#000" strokeWidth={3} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.drawerBody} keyboardShouldPersistTaps="handled">
                            <View style={styles.drawerInputContainer}>
                                <Text style={styles.drawerInputLabel}>BILL REMARKS</Text>
                                <TextInput
                                    value={text}
                                    onChangeText={setText}
                                    style={styles.drawerTextArea}
                                    placeholder="Enter instructions..."
                                    multiline
                                    placeholderTextColor="#cbd5e1"
                                />
                            </View>

                            <View style={styles.drawerChipGrid}>
                                {['Fragile', 'Paid', 'Gift', 'URGENT'].map(note => (
                                    <TouchableOpacity key={note} style={styles.drawerChip} onPress={() => setText(note)}>
                                        <Text style={styles.drawerChipText}>{note}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

                        <View style={[styles.floatingFooter, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                            <View style={styles.drawerActionRow}>
                                <TouchableOpacity style={styles.drawerCancelBtn} onPress={onClose}>
                                    <X size={20} color="#ef4444" strokeWidth={3} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.drawerPrimaryBtn} onPress={handleSubmit}>
                                    <Text style={styles.drawerPrimaryBtnText}>Save Remarks</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    drawerContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        width: '100%',
        minHeight: '40%',
        maxHeight: '90%',
        overflow: 'hidden'
    },
    dragHandle: {
        width: 32,
        height: 4,
        backgroundColor: '#e2e8f0',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 10
    },
    drawerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 12,
        marginBottom: 8
    },
    drawerTitle: { fontSize: 18, fontWeight: '900', color: '#000' },
    drawerSubtitle: { fontSize: 11, fontWeight: '700', color: '#94a3b8', marginTop: 1 },
    drawerCloseBtn: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#f1f5f9'
    },
    balanceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#000',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10
    },
    balanceBadgeText: { color: '#fff', fontSize: 12, fontWeight: '900' },
    drawerBody: { paddingHorizontal: 20, paddingTop: 8 },
    segmentRow: { flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 12, padding: 4, marginBottom: 16 },
    segmentItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
    segmentItemActive: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    segmentItemText: { color: '#94a3b8', fontSize: 12, fontWeight: '800' },
    segmentItemTextActive: { color: '#000' },
    drawerInputContainer: { marginBottom: 20 },
    drawerInputLabel: { fontSize: 8, fontWeight: '900', color: '#94a3b8', letterSpacing: 1, marginBottom: 6 },
    drawerBigInput: {
        backgroundColor: '#f8fafc',
        height: 60,
        borderRadius: 16,
        fontSize: 24,
        fontWeight: '900',
        color: '#000',
        paddingHorizontal: 16,
        borderWidth: 1.5,
        borderColor: '#f1f5f9'
    },
    drawerTextArea: {
        backgroundColor: '#f8fafc',
        height: 100,
        borderRadius: 16,
        fontSize: 14,
        fontWeight: '800',
        color: '#000',
        padding: 16,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        textAlignVertical: 'top'
    },
    drawerChipGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 20 },
    drawerChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#f1f5f9'
    },
    drawerChipText: { fontSize: 12, fontWeight: '900', color: '#000' },
    loyaltyStatsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    statsCard: { flex: 1, padding: 12, borderRadius: 16, backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#f1f5f9', minHeight: 56, justifyContent: 'center' },
    statsLabel: { fontSize: 8, fontWeight: '900', color: '#94a3b8', letterSpacing: 1, marginBottom: 4 },
    statsValue: { fontSize: 16, fontWeight: '900', color: '#000' },
    floatingFooter: {
        paddingHorizontal: 20,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 12
    },
    drawerActionRow: { flexDirection: 'row', gap: 12 },
    drawerCancelBtn: {
        width: 60,
        height: 60,
        borderRadius: 18,
        backgroundColor: '#fef2f2',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#fee2e2'
    },
    drawerPrimaryBtn: {
        flex: 1,
        backgroundColor: '#000',
        height: 60,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center'
    },
    drawerPrimaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' }
});
