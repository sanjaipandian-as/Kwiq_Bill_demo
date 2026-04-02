import React, { useState, useEffect, useMemo } from 'react';
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
    ScrollView,
    Keyboard,
    FlatList,
    Dimensions,
    Switch
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, X, Search, UserPlus, Phone, User, ChevronRight, Briefcase, Star } from 'lucide-react-native';
import { useCustomers } from '../../../context/CustomerContext';

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

const CustomerCaptureModal = ({ isOpen, onClose, onSelect, initialValue = '' }) => {
    const { customers, addCustomer } = useCustomers();
    const insets = useSafeAreaInsets();
    const isKeyboardVisible = useKeyboard();


    const [searchTerm, setSearchTerm] = useState('');
    const [mobile, setMobile] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerType, setCustomerType] = useState('Individual'); // Individual or Business
    const [isVip, setIsVip] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [isChecking, setIsChecking] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSearchTerm(initialValue || '');
            setIsCreating(false);
            setCustomerType('Individual');
            setIsVip(false);
            if (initialValue && /^\d+$/.test(initialValue)) {
                setMobile(initialValue);
                setCustomerName('');
            } else {
                setMobile('');
                setCustomerName(initialValue || '');
            }
        }
    }, [isOpen, initialValue]);

    const filteredCustomers = useMemo(() => {
        if (!searchTerm.trim()) return customers.slice(0, 10);
        return customers.filter(c =>
            (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.phone || '').includes(searchTerm)
        ).slice(0, 10);
    }, [searchTerm, customers]);

    const handleSearchChange = (text) => {
        setSearchTerm(text);
        if (/^\d+$/.test(text)) {
            setMobile(text);
            setCustomerName('');
        } else {
            setMobile('');
            setCustomerName(text || '');
        }
    };

    const handleSaveNew = async () => {
        if (!customerName.trim() || !mobile.trim()) {
            Alert.alert("Required Details", "Please provide name and mobile number.");
            return;
        }

        try {
            setIsChecking(true);
            const newCust = {
                name: customerName,
                phone: mobile,
                source: 'POS',
                type: customerType,
                tags: isVip ? 'VIP' : ''
            };
            const created = await addCustomer(newCust);
            onSelect(created || { ...newCust, id: Date.now().toString() });
            onClose();
        } catch (e) {
            Alert.alert("Error", "Failed to create customer");
        } finally {
            setIsChecking(false);
        }
    };

    const renderCustomerItem = ({ item }) => {
        const isMemberVIP = (item.tags || '').includes('VIP');
        const isSingle = filteredCustomers.length === 1;

        return (
            <TouchableOpacity
                style={[
                    styles.searchResultRow,
                    !isSingle && styles.searchResultGridItem
                ]}
                onPress={() => {
                    onSelect(item);
                    onClose();
                }}
            >
                <View style={[styles.searchResultAvatar, isMemberVIP && { backgroundColor: '#facc15' }]}>
                    <Text style={[styles.searchResultAvatarText, isMemberVIP && { color: '#000' }]}>{(item.name || 'U')[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.searchResultName} numberOfLines={1}>{item.name}</Text>
                        {isMemberVIP && (
                            <View style={styles.vipBadge}>
                                <Text style={styles.vipBadgeText}>VIP</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.searchResultPhone}>{item.phone}</Text>
                </View>
                {isSingle && (
                    <View style={styles.loyaltyPill}>
                        <Text style={styles.loyaltyPillText}>{item.loyaltyPoints || 0} pts</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <Modal visible={isOpen} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                {/* Dismiss Trigger */}
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />

                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : null}
                    style={{ flex: 1, width: '100%', justifyContent: 'flex-end' }}
                >
                    <View style={[styles.modalContent, { paddingBottom: isKeyboardVisible ? 0 : insets.bottom }]}>

                        {!isKeyboardVisible && <View key="drag-handle-cc" style={styles.dragHandle} />}

                        {!isKeyboardVisible && (
                            <View key="header-cc" style={styles.header}>
                                <View>
                                    <Text style={styles.subtitle}>{isCreating ? 'Create New Member' : 'Select or Search Customer'}</Text>
                                </View>
                                <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
                                    <X size={16} color="#000" strokeWidth={3} />
                                </TouchableOpacity>
                            </View>
                        )}


                        <View style={styles.searchBoxContainer}>
                            <View style={styles.searchBox}>
                                <Search size={18} color="#94a3b8" />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search by phone/name..."
                                    value={searchTerm}
                                    onChangeText={handleSearchChange}
                                    placeholderTextColor="#cbd5e1"
                                />
                                {searchTerm.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearchTerm('')}>
                                        <X size={16} color="#94a3b8" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        <View style={{ flex: 1 }}>
                            {!isCreating ? (
                                <>
                                    <FlatList
                                        data={filteredCustomers}
                                        renderItem={renderCustomerItem}
                                        keyExtractor={item => (item.id || item._id || Math.random().toString())}
                                        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
                                        columnWrapperStyle={filteredCustomers.length > 1 ? { gap: 10 } : null}
                                        numColumns={filteredCustomers.length > 1 ? 2 : 1}
                                        key={filteredCustomers.length > 1 ? 'grid' : 'list'}
                                        keyboardShouldPersistTaps="handled"
                                        ListHeaderComponent={
                                            <View style={styles.listHeaderRow}>
                                                <Text style={styles.formSectionLabel}>Suggested Members</Text>
                                            </View>
                                        }
                                        ListEmptyComponent={
                                            <View style={styles.emptyState}>
                                                <View style={styles.emptyIconBox}>
                                                    <UserPlus size={28} color="#cbd5e1" />
                                                </View>
                                                <Text style={styles.emptyText}>No matches found</Text>
                                            </View>
                                        }
                                    />

                                    {/* Sticky Bottom Trigger */}
                                    <View style={styles.stickyFooter}>
                                        <TouchableOpacity
                                            style={styles.fullWidthActionBtn}
                                            onPress={() => setIsCreating(true)}
                                            activeOpacity={0.9}
                                        >
                                            <UserPlus size={20} color="#fff" />
                                            <Text style={styles.fullWidthActionBtnText}>CREATE NEW PROFILE</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            ) : (
                                <ScrollView
                                    style={styles.formContent}
                                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
                                    keyboardShouldPersistTaps="handled"
                                >
                                    <View style={styles.listHeaderRow}>
                                        <Text style={styles.formSectionLabel}>New Member Details</Text>
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <View style={styles.inputIconBox}>
                                            <Phone size={16} color="#94a3b8" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.inputMiniLabel}>MOBILE NUMBER</Text>
                                            <TextInput
                                                style={styles.formInput}
                                                value={mobile}
                                                onChangeText={setMobile}
                                                placeholder="00000 00000"
                                                keyboardType="number-pad"
                                                maxLength={10}
                                                placeholderTextColor="#cbd5e1"
                                            />
                                        </View>
                                    </View>

                                    <View style={[styles.inputGroup, { marginTop: 12 }]}>
                                        <View style={styles.inputIconBox}>
                                            <User size={16} color="#94a3b8" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.inputMiniLabel}>FULL NAME</Text>
                                            <TextInput
                                                style={styles.formInput}
                                                value={customerName}
                                                onChangeText={setCustomerName}
                                                placeholder="Enter full name"
                                                autoCapitalize="words"
                                                placeholderTextColor="#cbd5e1"
                                            />
                                        </View>
                                    </View>

                                    <View style={styles.typeSelectorRow}>
                                        <TouchableOpacity
                                            style={[styles.typePill, customerType === 'Individual' && styles.typePillActive]}
                                            onPress={() => setCustomerType('Individual')}
                                        >
                                            <User size={14} color={customerType === 'Individual' ? '#fff' : '#64748b'} />
                                            <Text style={[styles.typePillText, customerType === 'Individual' && styles.typePillTextActive]}>Individual</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.typePill, customerType === 'Business' && styles.typePillActive]}
                                            onPress={() => setCustomerType('Business')}
                                        >
                                            <Briefcase size={14} color={customerType === 'Business' ? '#fff' : '#64748b'} />
                                            <Text style={[styles.typePillText, customerType === 'Business' && styles.typePillTextActive]}>Business</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.typePill, isVip && { backgroundColor: '#facc15', borderColor: '#facc15' }]}
                                            onPress={() => setIsVip(!isVip)}
                                        >
                                            <Star size={14} color={isVip ? '#000' : '#64748b'} fill={isVip ? '#000' : 'none'} />
                                            <Text style={[styles.typePillText, isVip && { color: '#000' }]}>VIP</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.formActionsRow}>
                                        <TouchableOpacity
                                            style={styles.cancelBtnMinimal}
                                            onPress={() => setIsCreating(false)}
                                        >
                                            <X size={20} color="#ef4444" strokeWidth={3} />
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.primaryBtn, (!mobile || !customerName) && styles.primaryBtnDisabled]}
                                            onPress={handleSaveNew}
                                            disabled={!mobile || !customerName || isChecking}
                                        >
                                            {isChecking ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save & Proceed</Text>}
                                        </TouchableOpacity>
                                    </View>
                                </ScrollView>
                            )}
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        width: '100%',
        height: '70%',
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
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 10
    },
    subtitle: { fontSize: 16, fontWeight: '800', color: '#000', marginTop: 1 },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#f1f5f9'
    },

    searchBoxContainer: { paddingHorizontal: 20, marginBottom: 8 },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#f8fafc',
        paddingHorizontal: 12,
        height: 48,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#f1f5f9'
    },
    searchInput: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0f172a', padding: 0 },

    listHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    formSectionLabel: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase' },

    searchResultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 16,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        marginBottom: 10
    },
    searchResultGridItem: {
        flex: 1,
        marginBottom: 0
    },
    searchResultAvatar: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center'
    },
    searchResultAvatarText: { color: '#fff', fontWeight: '900', fontSize: 14 },
    searchResultName: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
    searchResultPhone: { fontSize: 11, fontWeight: '600', color: '#94a3b8', marginTop: 1 },
    vipBadge: { backgroundColor: '#facc15', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
    vipBadgeText: { color: '#000', fontSize: 7, fontWeight: '900' },
    loyaltyPill: { backgroundColor: '#f0fdf4', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
    loyaltyPillText: { fontSize: 10, fontWeight: '800', color: '#16a34a' },

    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
    emptyIconBox: { width: 56, height: 56, borderRadius: 20, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    emptyText: { fontSize: 13, fontWeight: '700', color: '#94a3b8' },

    stickyFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingBottom: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9'
    },
    fullWidthActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#000',
        height: 56,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5
    },
    fullWidthActionBtnText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },

    formContent: { marginTop: 8 },
    inputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1.5,
        borderColor: '#f1f5f9'
    },
    inputIconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
    inputMiniLabel: { fontSize: 8, fontWeight: '900', color: '#94a3b8', letterSpacing: 1, marginBottom: 2 },
    formInput: { fontSize: 14, fontWeight: '800', color: '#0f172a', padding: 0 },

    typeSelectorRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
    typePill: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        backgroundColor: '#fff'
    },
    typePillActive: { backgroundColor: '#000', borderColor: '#000' },
    typePillText: { fontSize: 11, fontWeight: '800', color: '#64748b' },
    typePillTextActive: { color: '#fff' },

    formActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 20
    },
    cancelBtnMinimal: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: '#fef2f2',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#fee2e2'
    },
    primaryBtn: {
        flex: 1,
        backgroundColor: '#000',
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center'
    },
    primaryBtnDisabled: { opacity: 0.5 },
    primaryBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' }
});

export default CustomerCaptureModal;
