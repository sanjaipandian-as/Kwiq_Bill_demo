import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    Modal as RNModal,
    FlatList,
    Alert,
    TouchableOpacity,
    Platform,
    KeyboardAvoidingView
} from 'react-native';
import {
    X,
    User,
    Phone,
    Mail,
    MapPin,
    Building,
    Printer,
    FileText,
    CheckCircle2,
    History,
    ChevronRight,
    ChevronDown,
    Trash2,
    Briefcase,
    Calendar,
    Clock,
    Tag,
    Pencil,
    CirclePlus,
    Check
} from 'lucide-react-native';
import { useTransactions } from '../../context/TransactionContext';
import { shareReceiptPDF, shareBulkReceiptsPDF } from '../../utils/printUtils';
import { Input } from '../../components/ui/Input';

const STATE_OPTIONS = [
    "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
    "Dadra and Nagar Haveli", "Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
    "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra",
    "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim",
    "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

const SOURCE_OPTIONS = ['Walk-in', 'WhatsApp', 'Instagram', 'Referral', 'Other'];

export default function CustomerModal({ isOpen, onClose, customer, onSave, onDelete, initialTab = 'details' }) {
    const { transactions } = useTransactions();
    const [activeTab, setActiveTab] = useState(initialTab);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

    const history = useMemo(() => {
        if (!customer || !transactions) return [];
        return transactions
            .filter(t => t.customerId == (customer.id || customer._id))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [customer, transactions]);

    const [formData, setFormData] = useState({
        fullName: '',
        phone: '',
        email: '',
        customerType: 'Individual',
        gstin: '',
        address: { street: '', area: '', city: '', pincode: '', state: '' },
        source: 'Walk-in',
        tags: [],
        loyaltyPoints: 0,
        notes: '',
        amountPaid: ''
    });

    const [pickerVisible, setPickerVisible] = useState(false);
    const [pickerTitle, setPickerTitle] = useState('');
    const [pickerOptions, setPickerOptions] = useState([]);
    const [currentPickerField, setCurrentPickerField] = useState(null);

    const openPicker = (title, options, field) => {
        setPickerTitle(title);
        setPickerOptions(options);
        setCurrentPickerField(field);
        setPickerVisible(true);
    };

    const handlePickerSelect = (value) => {
        if (currentPickerField === 'state') {
            setFormData(prev => ({ ...prev, address: { ...prev.address, state: value } }));
        } else if (currentPickerField === 'source') {
            setFormData(prev => ({ ...prev, source: value }));
        }
        setPickerVisible(false);
    };

    useEffect(() => {
        if (customer) {
            let parsedAddress = { street: '', area: '', city: '', pincode: '', state: '' };
            try {
                if (typeof customer.address === 'string' && customer.address.startsWith('{')) {
                    parsedAddress = JSON.parse(customer.address);
                } else if (typeof customer.address === 'object' && customer.address !== null) {
                    parsedAddress = customer.address;
                }
            } catch (e) { }

            let parsedTags = [];
            if (Array.isArray(customer.tags)) {
                parsedTags = customer.tags;
            } else if (typeof customer.tags === 'string' && customer.tags.trim() !== "") {
                parsedTags = customer.tags.split(',');
            }

            setFormData({
                fullName: customer.name || customer.fullName || '',
                phone: customer.phone || '',
                email: customer.email || '',
                customerType: customer.type || customer.customerType || 'Individual',
                gstin: customer.gstin || '',
                address: parsedAddress,
                source: customer.source || 'Walk-in',
                tags: parsedTags,
                loyaltyPoints: customer.loyaltyPoints || 0,
                notes: customer.notes || '',
                amountPaid: customer.amountPaid ? String(customer.amountPaid) : ''
            });
        } else {
            setFormData({
                fullName: '',
                phone: '',
                email: '',
                customerType: 'Individual',
                gstin: '',
                address: { street: '', area: '', city: '', pincode: '', state: '' },
                source: 'Walk-in',
                tags: [],
                loyaltyPoints: 0,
                notes: '',
                amountPaid: ''
            });
        }
    }, [customer, isOpen]);

    const handleSaveInternal = async () => {
        // Basic validation - only require Name and Phone
        const missing = [];
        if (!formData.fullName.trim()) missing.push('Full Name');
        if (!formData.phone.trim()) missing.push('Phone Number');

        if (missing.length > 0) {
            Alert.alert('Required Fields', `Please fill in the following details:\n• ${missing.join('\n• ')}`);
            return;
        }

        if (formData.phone.length < 10) {
            Alert.alert('Invalid Phone', 'Please enter a valid 10-digit mobile number');
            return;
        }

        setIsSubmitting(true);
        try {
            await onSave(formData);
            onClose();
        } catch (error) {
            Alert.alert('Error', 'Could not save customer');
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderHistoryItem = ({ item: tx }) => {
        const date = new Date(tx.date);
        const isPaid = tx.status === 'Paid';

        return (
            <View style={styles.historyCard}>
                <View style={styles.historyCardHeader}>
                    <View style={styles.historyInfo}>
                        <View style={styles.historyDateRow}>
                            <Calendar size={12} color="#64748b" />
                            <Text style={styles.historyDateText}>{date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                        </View>
                        <Text style={styles.invoiceId}>Invoice #{tx.id}</Text>
                    </View>
                    <View style={[styles.statusBadge, isPaid ? styles.statusPaid : styles.statusUnpaid]}>
                        <Text style={[styles.statusText, isPaid ? styles.statusTextPaid : styles.statusTextUnpaid]}>
                            {isPaid ? 'PAID' : 'PENDING'}
                        </Text>
                    </View>
                </View>

                <View style={styles.historyDivider} />

                <View style={styles.historyItemsContainer}>
                    {(tx.items || []).slice(0, 3).map((item, idx) => (
                        <View key={idx} style={styles.historyItemRow}>
                            <Text style={styles.historyItemName} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.historyItemPrice}>₹{(item.total || item.price * item.quantity).toLocaleString()}</Text>
                        </View>
                    ))}
                    {(tx.items || []).length > 3 && (
                        <Text style={styles.moreItemsText}>+ {(tx.items.length - 3)} more items...</Text>
                    )}
                </View>

                <View style={styles.historyFooter}>
                    <View>
                        <Text style={styles.totalLabel}>TOTAL AMOUNT</Text>
                        <Text style={styles.totalAmount}>₹{(tx.total || 0).toLocaleString()}</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.printMiniBtn, { backgroundColor: '#10b981', borderColor: '#059669' }]}
                        onPress={() => shareReceiptPDF(tx)}
                    >
                        <Printer size={16} color="#fff" />
                        <Text style={[styles.printMiniText, { color: '#fff' }]}>RECEIPT</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderProfileForm = () => (
        <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false}>
            <View style={styles.formCard}>
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionIconBox}>
                        <User size={18} color="#0f172a" />
                    </View>
                    <Text style={styles.sectionTitle}>PERSONAL DETAILS</Text>
                </View>

                <Input
                    label="Customer Name"
                    required
                    value={formData.fullName}
                    onChangeText={(text) => setFormData({ ...formData, fullName: text })}
                    placeholder="Enter full name"
                />

                <View style={styles.rowInputs}>
                    <View style={styles.flex1}>
                        <Input
                            label="Mobile Number"
                            required
                            value={formData.phone}
                            onChangeText={(text) => setFormData({ ...formData, phone: text })}
                            placeholder="10-digit number"
                            keyboardType="phone-pad"
                            maxLength={10}
                        />
                    </View>
                    <View style={styles.flex1}>
                        <Input
                            label="Email (Optional)"
                            value={formData.email}
                            onChangeText={(text) => setFormData({ ...formData, email: text })}
                            placeholder="john@example.com"
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>
                </View>

                <View style={styles.typeSelector}>
                    {['Individual', 'Business'].map(type => (
                        <TouchableOpacity
                            key={type}
                            onPress={() => setFormData({ ...formData, customerType: type })}
                            style={[styles.typeBtn, formData.customerType === type && styles.typeBtnActive]}
                        >
                            {formData.customerType === type && <CheckCircle2 size={16} color="#000" />}
                            <Text style={[styles.typeBtnText, formData.customerType === type && styles.typeBtnTextActive]}>
                                {type}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.formCard}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIconBox, { backgroundColor: '#f0fdf4', borderColor: '#dcfce7' }]}>
                        <MapPin size={18} color="#15803d" />
                    </View>
                    <Text style={styles.sectionTitle}>ADDRESS & LOCATION</Text>
                </View>

                <Input
                    label="Street Address"
                    value={formData.address.street}
                    onChangeText={(text) => setFormData({ ...formData, address: { ...formData.address, street: text } })}
                    placeholder="House no., Building, Street"
                />

                <View style={styles.rowInputs}>
                    <View style={styles.flex1}>
                        <Input
                            label="City"
                            value={formData.address.city}
                            onChangeText={(text) => setFormData({ ...formData, address: { ...formData.address, city: text } })}
                            placeholder="City name"
                        />
                    </View>
                    <View style={styles.flex1}>
                        <Input
                            label="Pincode"
                            value={formData.address.pincode}
                            onChangeText={(text) => setFormData({ ...formData, address: { ...formData.address, pincode: text } })}
                            placeholder="000000"
                            keyboardType="numeric"
                            maxLength={6}
                        />
                    </View>
                </View>

                <View style={styles.rowInputs}>
                    <View style={styles.flex1}>
                        <Text style={styles.inputLabel}>State</Text>
                        <TouchableOpacity style={styles.premiumPicker} onPress={() => openPicker("State", STATE_OPTIONS, 'state')}>
                            <Text style={[styles.pickerText, !formData.address.state && styles.placeholderText]} numberOfLines={1}>
                                {formData.address.state || "Select State"}
                            </Text>
                            <ChevronDown size={16} color="#64748b" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.flex1}>
                        <Text style={styles.inputLabel}>Source</Text>
                        <TouchableOpacity style={styles.premiumPicker} onPress={() => openPicker("Lead Source", SOURCE_OPTIONS, 'source')}>
                            <Text style={[styles.pickerText, !formData.source && styles.placeholderText]} numberOfLines={1}>
                                {formData.source || "Select..."}
                            </Text>
                            <ChevronDown size={16} color="#64748b" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <View style={styles.formCard}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIconBox, { backgroundColor: '#fff7ed', borderColor: '#ffedd5' }]}>
                        <Briefcase size={18} color="#c2410c" />
                    </View>
                    <Text style={styles.sectionTitle}>ADDITIONAL DETAILS</Text>
                </View>

                {formData.customerType === 'Business' && (
                    <Input
                        label="GSTIN Number"
                        value={formData.gstin}
                        onChangeText={(text) => setFormData({ ...formData, gstin: text })}
                        placeholder="22AAAAA0000A1Z5"
                        autoCapitalize="characters"
                    />
                )}

                <Input
                    label="Private Notes"
                    value={formData.notes}
                    onChangeText={(text) => setFormData({ ...formData, notes: text })}
                    placeholder="Add any internal notes here..."
                    multiline
                    numberOfLines={3}
                />
            </View>
            <View style={{ height: 100 }} />
        </ScrollView>
    );

    return (
        <RNModal visible={isOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.container}>
                <View style={styles.modalHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.modalTitle}>
                            {activeTab === 'history' ? 'MANAGE HISTORY' : (customer ? 'UPDATE CUSTOMER' : 'NEW CUSTOMER')}
                        </Text>
                        <Text style={styles.modalSub}>
                            {activeTab === 'history' ? `Transactions for ${formData.fullName}` : (customer ? `Manage ${formData.fullName}` : 'Add a new member to your portfolio')}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <X size={20} color="#000" strokeWidth={3} />
                    </TouchableOpacity>
                </View>

                {customer && (
                    <View style={styles.tabsWrapper}>
                        <TouchableOpacity
                            style={[styles.tabItem, activeTab === 'details' && styles.tabItemActive]}
                            onPress={() => setActiveTab('details')}
                        >
                            <User size={16} color={activeTab === 'details' ? '#000' : '#94a3b8'} strokeWidth={activeTab === 'details' ? 3 : 2} />
                            <Text style={[styles.tabItemText, activeTab === 'details' && styles.tabItemTextActive]}>PROFILE</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tabItem, activeTab === 'history' && styles.tabItemActive]}
                            onPress={() => setActiveTab('history')}
                        >
                            <History size={16} color={activeTab === 'history' ? '#000' : '#94a3b8'} strokeWidth={activeTab === 'history' ? 3 : 2} />
                            <Text style={[styles.tabItemText, activeTab === 'history' && styles.tabItemTextActive]}>HISTORY</Text>
                            {history.length > 0 && <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{history.length}</Text></View>}
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.contentArea}>
                    {activeTab === 'details' ? (
                        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                            {renderProfileForm()}
                        </KeyboardAvoidingView>
                    ) : (
                        <View style={styles.historyContainer}>
                            {history.length === 0 ? (
                                <View style={styles.emptyHistory}>
                                    <View style={styles.emptyIconBg}>
                                        <FileText size={40} color="#cbd5e1" />
                                    </View>
                                    <Text style={styles.emptyTitle}>NO PURCHASES YET</Text>
                                    <Text style={styles.emptySub}>Transactions will appear here once recorded.</Text>
                                </View>
                            ) : (
                                <FlatList
                                    data={history}
                                    keyExtractor={item => item.id.toString()}
                                    renderItem={renderHistoryItem}
                                    contentContainerStyle={styles.historyListContent}
                                    showsVerticalScrollIndicator={false}
                                />
                            )}
                        </View>
                    )}
                </View>

                <View style={styles.stickyFooter}>
                    {activeTab === 'history' ? (
                        <TouchableOpacity
                            style={[styles.btnPrimary, { backgroundColor: '#10b981', shadowColor: '#10b981' }]}
                            onPress={async () => {
                                if (history.length === 0) return;
                                await shareBulkReceiptsPDF(history);
                            }}
                        >
                            <Printer size={20} color="#fff" />
                            <Text style={styles.btnPrimaryText}>BATCH EXPORT RECEIPTS</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.footerBtns}>
                            {customer && (
                                <TouchableOpacity onPress={onDelete} style={styles.btnDanger}>
                                    <Trash2 size={20} color="#ef4444" />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                onPress={handleSaveInternal}
                                style={[styles.btnPrimary, isSubmitting && styles.btnDisabled, { flex: 1 }]}
                                disabled={isSubmitting}
                            >
                                <Check size={20} color="#fff" strokeWidth={3} />
                                <Text style={styles.btnPrimaryText}>{isSubmitting ? 'PROCESSING...' : 'SAVE CUSTOMER'}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {pickerVisible && (
                    <View style={styles.pickerBackdrop}>
                        <Pressable style={StyleSheet.absoluteFill} onPress={() => setPickerVisible(false)} />
                        <View style={styles.pickerSheet}>
                            <View style={styles.pickerHeader}>
                                <Text style={styles.pickerTitle}>{pickerTitle.toUpperCase()}</Text>
                                <TouchableOpacity onPress={() => setPickerVisible(false)}>
                                    <X size={20} color="#000" />
                                </TouchableOpacity>
                            </View>
                            <FlatList
                                data={pickerOptions}
                                keyExtractor={(item) => item}
                                renderItem={({ item }) => (
                                    <TouchableOpacity style={styles.pickerOption} onPress={() => handlePickerSelect(item)}>
                                        <Text style={styles.pickerOptionText}>{item}</Text>
                                        {((currentPickerField === 'state' && formData.address.state === item) ||
                                            (currentPickerField === 'source' && formData.source === item)) &&
                                            <Check size={20} color="#10b981" strokeWidth={3} />
                                        }
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    </View>
                )}
            </View>
        </RNModal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f9fafb' }, // Changed bg
    modalHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 24, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
    modalSub: { fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '500' },
    closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },

    tabsWrapper: { flexDirection: 'row', padding: 16, gap: 12, backgroundColor: '#fff' },
    tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: 'transparent' },
    tabItemActive: { backgroundColor: '#f0f9ff', borderColor: '#e0f2fe' },
    tabItemText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
    tabItemTextActive: { color: '#0284c7' },
    tabBadge: { backgroundColor: '#fff', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
    tabBadgeText: { fontSize: 10, fontWeight: '800', color: '#0284c7' },

    contentArea: { flex: 1 },
    formScroll: { flex: 1 },
    formContent: { padding: 20, gap: 24 },
    formCard: { backgroundColor: '#fff', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, gap: 20 },

    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 0 },
    sectionIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
    sectionTitle: { fontSize: 13, fontWeight: '900', color: '#0f172a', letterSpacing: 0.8 },

    rowInputs: { flexDirection: 'row', gap: 16 },
    flex1: { flex: 1 },
    inputLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 8, letterSpacing: 0.5 },
    divider: { height: 1.5, backgroundColor: '#f1f5f9', marginVertical: 32 },

    typeSelector: { flexDirection: 'row', gap: 12, marginTop: 4 },
    typeBtn: { flex: 1, flexDirection: 'row', height: 48, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', gap: 8 },
    typeBtnActive: { borderColor: '#0f172a', backgroundColor: '#fff', borderWidth: 1.5 },
    typeBtnText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
    typeBtnTextActive: { color: '#0f172a', fontWeight: '800' },

    premiumPicker: { flexDirection: 'row', height: 50, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 14, alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff' },
    pickerText: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
    placeholderText: { color: '#94a3b8' },

    historyContainer: { flex: 1 },
    historyListContent: { padding: 16, gap: 16, paddingBottom: 100 },
    historyCard: { backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
    historyCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    historyInfo: { gap: 4 },
    historyDateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    historyDateText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
    invoiceId: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
    statusPaid: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
    statusUnpaid: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
    statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    statusTextPaid: { color: '#16a34a' },
    statusTextUnpaid: { color: '#ef4444' },

    historyDivider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: 14 },
    historyItemsContainer: { gap: 8, marginBottom: 16 },
    historyItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    historyItemName: { fontSize: 13, fontWeight: '500', color: '#475569', flex: 1, marginRight: 8 },
    historyItemPrice: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    moreItemsText: { fontSize: 11, fontWeight: '600', color: '#94a3b8', marginTop: 2, fontStyle: 'italic' },

    historyFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
    totalLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.5 },
    totalAmount: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
    printMiniBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
    printMiniText: { fontSize: 10, fontWeight: '800', color: '#0f172a' },

    emptyHistory: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60, paddingHorizontal: 40 },
    emptyIconBg: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
    emptySub: { fontSize: 14, color: '#64748b', marginTop: 8, textAlign: 'center' },

    stickyFooter: { padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 5 },
    footerBtns: { flexDirection: 'row', gap: 12 },
    btnPrimary: { height: 52, borderRadius: 14, backgroundColor: '#0f172a', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#0f172a', shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
    btnPrimaryText: { fontSize: 15, fontWeight: '700', color: '#fff' },
    btnDanger: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fee2e2' },
    btnDisabled: { opacity: 0.6 },

    pickerBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 1000 },
    pickerSheet: { backgroundColor: '#fff', borderTopLeftRadius: 36, borderTopRightRadius: 36, height: '60%', padding: 24 },
    pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    pickerTitle: { fontSize: 14, fontWeight: '900', color: '#94a3b8', letterSpacing: 1 },
    pickerCloseBtn: { padding: 4 },
    pickerOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 20, borderBottomWidth: 1.5, borderBottomColor: '#f1f5f9' },
    pickerOptionText: { fontSize: 16, fontWeight: '700', color: '#000' }
});