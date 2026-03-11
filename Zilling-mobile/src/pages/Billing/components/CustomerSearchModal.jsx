import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    Dimensions,
    Modal,
    KeyboardAvoidingView,
    Platform,
    TextInput
} from 'react-native';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Search, X, UserPlus, Star } from 'lucide-react-native';
import { useCustomers } from '../../../context/CustomerContext';

const CustomerSearchModal = ({ isOpen, onClose, onSelect, onAddNew }) => {
    const { customers, loading, fetchCustomers } = useCustomers();
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen && customers.length === 0) fetchCustomers();
    }, [isOpen]);

    const filteredCustomers = customers.filter(customer => {
        const name = customer.name || '';
        const phone = customer.phone || '';
        return name.toLowerCase().includes(searchTerm.toLowerCase()) || phone.includes(searchTerm);
    });

    const isVIP = (item) => item && (
        typeof item.tags === 'string'
            ? item.tags.includes('VIP')
            : (Array.isArray(item.tags) && item.tags.includes('VIP'))
    );

    const renderItem = ({ item }) => {
        const vip = isVIP(item);
        return (
            <TouchableOpacity
                style={styles.customerCard}
                onPress={() => {
                    onSelect(item);
                    onClose();
                }}
            >
                <View style={[styles.avatarCircle, vip && { backgroundColor: '#facc15' }]}>
                    {vip ? (
                        <Star size={22} color="#000" fill="#000" />
                    ) : (
                        <Text style={styles.avatarChar}>{(item.name || 'U')[0].toUpperCase()}</Text>
                    )}
                </View>
                <View style={styles.customerMeta}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.customerNameText}>{item.name}</Text>
                        {vip && (
                            <View style={styles.vipBadgeMini}>
                                <Text style={styles.vipBadgeTextMini}>VIP</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.customerPhoneText}>{item.phone}</Text>
                </View>
                <View style={styles.pointsBadge}>
                    <Text style={styles.pointsBadgeText}>{item.loyaltyPoints || 0} pts</Text>
                </View>
            </TouchableOpacity>
        );
    };

    const handleAddNew = () => {
        onClose();
        onAddNew(searchTerm);
    };

    return (
        <Modal visible={isOpen} animationType="fade" transparent onRequestClose={onClose}>
            <View style={styles.blurOverlay}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "padding"}
                    style={styles.modalBody}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                    <View style={styles.sheetTop}>
                        <View style={styles.sheetHeader}>
                            <View>
                                <Text style={styles.sheetTitle}>Select Customer</Text>
                                <Text style={styles.sheetSubtitle}>{filteredCustomers.length} matches found</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeCircle}>
                                <X size={20} color="#000" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchFrame}>
                            <Search size={20} color="#94a3b8" />
                            <TextInput
                                placeholder="Search by name or mobile..."
                                value={searchTerm}
                                onChangeText={setSearchTerm}
                                style={styles.searchInputField}
                                placeholderTextColor="#cbd5e1"
                            />
                        </View>
                    </View>

                    <FlatList
                        data={filteredCustomers}
                        keyExtractor={item => item.id || item._id}
                        renderItem={renderItem}
                        style={styles.listArea}
                        contentContainerStyle={{ padding: 24, paddingTop: 0 }}
                        keyboardShouldPersistTaps="handled"
                        ListEmptyComponent={
                            searchTerm ? (
                                <View style={styles.emptyView}>
                                    <Text style={styles.emptyViewText}>No matches found for "{searchTerm}"</Text>
                                    <TouchableOpacity style={[styles.quickAddBtn, { backgroundColor: '#000', borderWidth: 0 }]} onPress={handleAddNew}>
                                        <Text style={[styles.quickAddText, { color: '#fff' }]}>
                                            {/^\d+$/.test(searchTerm) ? `Create with Mobile: ${searchTerm}` : `Create Customer: "${searchTerm}"`}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            ) : null
                        }
                    />

                    <View style={styles.sheetFooter}>
                        <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
                            <Text style={styles.secondaryBtnText}>Close</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.primaryBtn} onPress={handleAddNew}>
                            <UserPlus size={18} color="#fff" />
                            <Text style={styles.primaryBtnText}>
                                {searchTerm && /^\d+$/.test(searchTerm) ? `Create with Mobile` : (searchTerm ? `Add "${searchTerm}"` : 'Add New Member')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    blurOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalBody: { backgroundColor: '#fff', borderRadius: 40, width: '100%', maxHeight: '80%', overflow: 'hidden' },

    sheetTop: { padding: 24, paddingBottom: 16 },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    sheetTitle: { fontSize: 22, fontWeight: '900', color: '#000' },
    sheetSubtitle: { fontSize: 12, fontWeight: '700', color: '#94a3b8', marginTop: 2 },
    closeCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },

    searchFrame: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f8fafc', paddingHorizontal: 16, height: 56, borderRadius: 20, borderWidth: 1.5, borderColor: '#f1f5f9' },
    searchInputField: { flex: 1, fontSize: 16, fontWeight: '700', color: '#000', padding: 0 },

    listArea: { width: '100%' },
    // Customer Section
    customerCard: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14, borderBottomWidth: 1.5, borderBottomColor: '#f1f5f9' },
    avatarCircle: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
    avatarChar: { color: '#fff', fontWeight: '900', fontSize: 16 },
    customerMeta: { flex: 1 },
    customerNameText: { fontSize: 16, fontWeight: '800', color: '#000' },
    customerPhoneText: { fontSize: 13, fontWeight: '600', color: '#94a3b8', marginTop: 2 },
    pointsBadge: { backgroundColor: '#f0fdf4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: '#dcfce7' },
    pointsBadgeText: { fontSize: 11, fontWeight: '900', color: '#16a34a' },

    emptyView: { padding: 40, alignItems: 'center', gap: 16 },
    emptyViewText: { fontSize: 14, fontWeight: '600', color: '#94a3b8', textAlign: 'center' },
    quickAddBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0' },
    quickAddText: { fontSize: 13, fontWeight: '800', color: '#000' },

    sheetFooter: { flexDirection: 'row', gap: 12, padding: 20, paddingBottom: 24, borderTopWidth: 1.5, borderTopColor: '#f1f5f9' },
    secondaryBtn: { flex: 1, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
    secondaryBtnText: { fontSize: 14, fontWeight: '800', color: '#475569' },
    primaryBtn: { flex: 2, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', flexDirection: 'row', gap: 10 },
    primaryBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
    vipBadgeMini: {
        backgroundColor: '#000',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    vipBadgeTextMini: {
        fontSize: 8,
        fontWeight: '900',
        color: '#facc15',
        letterSpacing: 0.5
    }
});

export default CustomerSearchModal;
