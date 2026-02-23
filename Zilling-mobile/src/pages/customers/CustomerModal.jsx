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
    KeyboardAvoidingView,
    Dimensions,
    TextInput
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
    Clock,
    ChevronDown,
    Trash2,
    Award,
    Trophy,
    ShieldCheck,
    Save,
    Star,
    LayoutGrid,
    Calendar,
    ArrowRight,
    CircleDollarSign,
    ChevronRight,
    CreditCard
} from 'lucide-react-native';
import { useTransactions } from '../../context/TransactionContext';
import { shareReceiptPDF, shareBulkReceiptsPDF } from '../../utils/printUtils';
import { Input } from '../../components/ui/Input';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const STATE_OPTIONS = [
    "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
    "Dadra and Nagar Haveli", "Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
    "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra",
    "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim",
    "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

const SOURCE_OPTIONS = ['Direct', 'WhatsApp', 'Instagram', 'Referral', 'Other'];

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

    const stats = useMemo(() => {
        if (history.length === 0) return { total: 0, pending: 0, count: 0 };
        const total = history.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);
        const pending = history.reduce((sum, t) => {
            const due = (parseFloat(t.total) || 0) - (parseFloat(t.amountReceived) || 0);
            return sum + Math.max(0, due);
        }, 0);
        return { total, pending, count: history.length };
    }, [history]);

    const [formData, setFormData] = useState({
        fullName: '',
        phone: '',
        email: '',
        customerType: 'Individual',
        gstin: '',
        address: { street: '', area: '', city: '', pincode: '', state: '' },
        source: 'Direct',
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
                source: customer.source || 'Direct',
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
                source: 'Direct',
                tags: [],
                loyaltyPoints: 0,
                notes: '',
                amountPaid: ''
            });
        }
    }, [customer, isOpen]);

    const handleSaveInternal = async () => {
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
        const isPaid = (tx.status || '').toUpperCase() === 'PAID';
        const due = (parseFloat(tx.total) || 0) - (parseFloat(tx.amountReceived) || 0);

        return (
            <Pressable style={styles.ledgerCard} onPress={() => shareReceiptPDF(tx)}>
                <View style={styles.ledgerCardTop}>
                    <View style={styles.ledgerDateBox}>
                        <Text style={styles.ledgerDay}>{date.getDate()}</Text>
                        <Text style={styles.ledgerMonth}>{date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</Text>
                    </View>
                    <View style={styles.ledgerMainInfo}>
                        <Text style={styles.ledgerInvText}>INV-#{tx.id?.substring(0, 6).toUpperCase()}</Text>
                        <View style={styles.ledgerStatusRow}>
                            <View style={[styles.statusIndicator, { backgroundColor: isPaid ? '#22c55e' : '#ef4444' }]} />
                            <Text style={[styles.statusLabelText, { color: isPaid ? '#22c55e' : '#ef4444' }]}>
                                {isPaid ? 'PAID FULL' : `DUE ₹${due.toLocaleString()}`}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.ledgerAmountBox}>
                        <Text style={styles.ledgerTotalAmount}>₹{(tx.total || 0).toLocaleString()}</Text>
                        <ChevronRight size={16} color="#cbd5e1" />
                    </View>
                </View>

                <View style={styles.ledgerItemsList}>
                    {(tx.items || []).slice(0, 1).map((item, idx) => (
                        <Text key={idx} style={styles.ledgerItemPreview} numberOfLines={1}>
                            {item.name} {tx.items.length > 1 ? `+${tx.items.length - 1} more` : ''}
                        </Text>
                    ))}
                </View>
            </Pressable>
        );
    };

    const toggleVIP = () => {
        const isVIP = formData.tags.includes('VIP');
        const newTags = isVIP ? formData.tags.filter(t => t !== 'VIP') : [...formData.tags, 'VIP'];
        setFormData({ ...formData, tags: newTags });
    };

    const renderProfileForm = () => (
        <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false}>
            {/* Header Hero Stats for existing client */}
            {customer && (
                <View style={styles.formHero}>
                    <View style={styles.heroStatItem}>
                        <Text style={styles.heroStatLabel}>LEDGER TOTAL</Text>
                        <Text style={styles.heroStatValue}>₹{stats.total.toLocaleString()}</Text>
                    </View>
                    <View style={styles.heroStatDivider} />
                    <View style={styles.heroStatItem}>
                        <Text style={styles.heroStatLabel}>LOYALTY PTS</Text>
                        <Text style={styles.heroStatValue}>{formData.loyaltyPoints}</Text>
                    </View>
                </View>
            )}

            <View style={styles.inputGroup}>
                <View style={styles.groupHeader}>
                    <Text style={styles.groupTitle}>Primary Information</Text>
                    <TouchableOpacity
                        style={[styles.vipBadge, formData.tags.includes('VIP') && styles.vipBadgeOn]}
                        onPress={toggleVIP}
                    >
                        <Star size={12} color={formData.tags.includes('VIP') ? "#fff" : "#64748b"} fill={formData.tags.includes('VIP') ? "#fff" : "none"} />
                        <Text style={[styles.vipBadgeText, formData.tags.includes('VIP') && styles.vipBadgeTextOn]}>VIP CLIENT</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>FULL NAME <Text style={styles.reqText}>*</Text></Text>
                    <View style={styles.inputWrapper}>
                        <User size={18} color="#94a3b8" />
                        <TextInput
                            style={styles.fieldInput}
                            value={formData.fullName}
                            onChangeText={(text) => setFormData({ ...formData, fullName: text })}
                            placeholder="e.g. Rahul Sharma"
                            placeholderTextColor="#cbd5e1"
                        />
                    </View>
                </View>

                <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>CONTACT NUMBER <Text style={styles.reqText}>*</Text></Text>
                    <View style={styles.inputWrapper}>
                        <Phone size={18} color="#94a3b8" />
                        <TextInput
                            style={styles.fieldInput}
                            value={formData.phone}
                            onChangeText={(text) => setFormData({ ...formData, phone: text })}
                            placeholder="10-digit mobile number"
                            placeholderTextColor="#cbd5e1"
                            keyboardType="phone-pad"
                            maxLength={10}
                        />
                    </View>
                </View>

                <View style={styles.typeSelectorRow}>
                    {['Individual', 'Business'].map(type => (
                        <TouchableOpacity
                            key={type}
                            onPress={() => setFormData({ ...formData, customerType: type })}
                            style={[styles.typeOption, formData.customerType === type && styles.typeOptionActive]}
                        >
                            <View style={[styles.typeRadio, formData.customerType === type && styles.typeRadioActive]}>
                                {formData.customerType === type && <View style={styles.radioInner} />}
                            </View>
                            <Text style={[styles.typeOptionText, formData.customerType === type && styles.typeOptionTextActive]}>
                                {type}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.groupTitle}>Extended Details</Text>

                <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
                    <View style={styles.inputWrapper}>
                        <Mail size={18} color="#94a3b8" />
                        <TextInput
                            style={styles.fieldInput}
                            value={formData.email}
                            onChangeText={(text) => setFormData({ ...formData, email: text })}
                            placeholder="client@mail.com"
                            placeholderTextColor="#cbd5e1"
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>
                </View>

                {formData.customerType === 'Business' && (
                    <View style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>GST IDENTIFICATION NUMBER</Text>
                        <View style={styles.inputWrapper}>
                            <Building size={18} color="#94a3b8" />
                            <TextInput
                                style={styles.fieldInput}
                                value={formData.gstin}
                                onChangeText={(text) => setFormData({ ...formData, gstin: text })}
                                placeholder="22AAAAA0000A1Z5"
                                placeholderTextColor="#cbd5e1"
                                autoCapitalize="characters"
                            />
                        </View>
                    </View>
                )}

                <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>LEAD SOURCE</Text>
                    <TouchableOpacity style={styles.dropdownInput} onPress={() => openPicker("Select Lead Source", SOURCE_OPTIONS, 'source')}>
                        <LayoutGrid size={18} color="#94a3b8" />
                        <Text style={[styles.dropdownValue, !formData.source && styles.placeholder]}>
                            {formData.source || "Select Source"}
                        </Text>
                        <ChevronDown size={18} color="#94a3b8" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.groupTitle}>Work / Shipping Address</Text>

                <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>STREET / BUILDING</Text>
                    <View style={styles.inputWrapper}>
                        <MapPin size={18} color="#94a3b8" />
                        <TextInput
                            style={styles.fieldInput}
                            value={formData.address.street}
                            onChangeText={(text) => setFormData({ ...formData, address: { ...formData.address, street: text } })}
                            placeholder="Unit No, Building Name"
                            placeholderTextColor="#cbd5e1"
                        />
                    </View>
                </View>

                <View style={styles.gridRow}>
                    <View style={[styles.fieldContainer, { flex: 1 }]}>
                        <Text style={styles.fieldLabel}>CITY</Text>
                        <TextInput
                            style={styles.simpleInput}
                            value={formData.address.city}
                            onChangeText={(text) => setFormData({ ...formData, address: { ...formData.address, city: text } })}
                            placeholder="City"
                            placeholderTextColor="#cbd5e1"
                        />
                    </View>
                    <View style={[styles.fieldContainer, { flex: 1 }]}>
                        <Text style={styles.fieldLabel}>PINCODE</Text>
                        <TextInput
                            style={styles.simpleInput}
                            value={formData.address.pincode}
                            onChangeText={(text) => setFormData({ ...formData, address: { ...formData.address, pincode: text } })}
                            placeholder="400001"
                            placeholderTextColor="#cbd5e1"
                            keyboardType="numeric"
                        />
                    </View>
                </View>

                <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>STATE</Text>
                    <TouchableOpacity style={styles.dropdownInput} onPress={() => openPicker("Select State", STATE_OPTIONS, 'state')}>
                        <Text style={[styles.dropdownValue, !formData.address.state && styles.placeholder]}>
                            {formData.address.state || "Select Professional State"}
                        </Text>
                        <ChevronDown size={18} color="#94a3b8" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.groupTitle}>Internal Notes</Text>
                <TextInput
                    style={styles.textArea}
                    value={formData.notes}
                    onChangeText={(text) => setFormData({ ...formData, notes: text })}
                    placeholder="Briefly describe client preferences or specific requirements..."
                    placeholderTextColor="#cbd5e1"
                    multiline
                    numberOfLines={4}
                />
            </View>

            <View style={{ height: 120 }} />
        </ScrollView>
    );

    return (
        <RNModal visible={isOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.container}>
                <View style={styles.topHeader}>
                    <View style={styles.dragHandle} />
                    <View style={styles.headerTitleRow}>
                        <View style={styles.titleContent}>
                            <Text style={styles.mainTitle}>{customer ? 'Update Profile' : 'Add New Client'}</Text>
                            <Text style={styles.subTitle}>Business Intelligence & Ledger</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.headerX}>
                            <X size={20} color="#000" />
                        </TouchableOpacity>
                    </View>

                    {customer && (
                        <View style={styles.tabContainer}>
                            <TouchableOpacity
                                style={[styles.tabBtn, activeTab === 'details' && styles.tabBtnActive]}
                                onPress={() => setActiveTab('details')}
                            >
                                <User size={16} color={activeTab === 'details' ? '#000' : '#94a3b8'} />
                                <Text style={[styles.tabText, activeTab === 'details' && styles.tabTextActive]}>PROFILE</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
                                onPress={() => setActiveTab('history')}
                            >
                                <CreditCard size={16} color={activeTab === 'history' ? '#000' : '#94a3b8'} />
                                <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>LEDGER</Text>
                                {history.length > 0 && (
                                    <View style={styles.ledgerCount}>
                                        <Text style={styles.ledgerCountText}>{history.length}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <View style={styles.mainBody}>
                    {activeTab === 'details' ? renderProfileForm() : (
                        <View style={styles.ledgerContainer}>
                            {history.length === 0 ? (
                                <View style={styles.ledgerEmpty}>
                                    <View style={styles.emptyArt}>
                                        <CreditCard size={32} color="#cbd5e1" />
                                    </View>
                                    <Text style={styles.emptyHeading}>No Transactions Yet</Text>
                                    <Text style={styles.emptyText}>Billed invoices will automatically appear here.</Text>
                                </View>
                            ) : (
                                <View style={{ flex: 1 }}>
                                    <View style={styles.ledgerStatsOverlay}>
                                        <View style={styles.statMiniCard}>
                                            <Text style={styles.miniLabel}>OUTSTANDING</Text>
                                            <Text style={[styles.miniValue, stats.pending > 0 && { color: '#ef4444' }]}>₹{stats.pending.toLocaleString()}</Text>
                                        </View>
                                        <View style={styles.statMiniDivider} />
                                        <View style={styles.statMiniCard}>
                                            <Text style={styles.miniLabel}>LIFETIME VALUE</Text>
                                            <Text style={styles.miniValue}>₹{stats.total.toLocaleString()}</Text>
                                        </View>
                                    </View>
                                    <FlatList
                                        data={history}
                                        keyExtractor={item => item.id.toString()}
                                        renderItem={renderHistoryItem}
                                        contentContainerStyle={styles.ledgerList}
                                        showsVerticalScrollIndicator={false}
                                    />
                                </View>
                            )}
                        </View>
                    )}
                </View>

                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    <View style={styles.modalFooter}>
                        {activeTab === 'details' ? (
                            <View style={styles.footerActions}>
                                {customer && (
                                    <TouchableOpacity onPress={onDelete} style={styles.binBtn}>
                                        <Trash2 size={22} color="#ef4444" />
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    onPress={handleSaveInternal}
                                    style={[styles.saveBtn, isSubmitting && styles.loading]}
                                    disabled={isSubmitting}
                                >
                                    <Save size={18} color="#fff" />
                                    <Text style={styles.saveText}>{isSubmitting ? 'PROCESSING' : 'SAVE CHANGES'}</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={styles.exportFullBtn}
                                onPress={() => history.length > 0 && shareBulkReceiptsPDF(history)}
                            >
                                <Printer size={18} color="#fff" />
                                <Text style={styles.exportText}>EXPORT DETAILED LEDGER</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </KeyboardAvoidingView>

                {pickerVisible && (
                    <View style={styles.overlay}>
                        <Pressable style={StyleSheet.absoluteFill} onPress={() => setPickerVisible(false)} />
                        <View style={styles.sheet}>
                            <View style={styles.sheetHeader}>
                                <Text style={styles.sheetLabel}>{pickerTitle}</Text>
                                <TouchableOpacity onPress={() => setPickerVisible(false)}>
                                    <X size={20} color="#000" />
                                </TouchableOpacity>
                            </View>
                            <FlatList
                                data={pickerOptions}
                                keyExtractor={(item) => item}
                                renderItem={({ item }) => (
                                    <TouchableOpacity style={styles.option} onPress={() => handlePickerSelect(item)}>
                                        <Text style={styles.optionLabel}>{item}</Text>
                                        {((currentPickerField === 'state' && formData.address.state === item) ||
                                            (currentPickerField === 'source' && formData.source === item)) &&
                                            <ShieldCheck size={18} color="#000" />
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
    container: { flex: 1, backgroundColor: '#fff' },
    topHeader: { backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#f1f5f9' },
    dragHandle: { width: 36, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
    headerTitleRow: { flexDirection: 'row', padding: 24, paddingBottom: 16, alignItems: 'center', justifyContent: 'space-between' },
    titleContent: { gap: 2 },
    mainTitle: { fontSize: 24, fontWeight: '900', color: '#000', letterSpacing: -1 },
    subTitle: { fontSize: 13, fontWeight: '700', color: '#94a3b8' },
    headerX: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },

    tabContainer: { flexDirection: 'row', paddingHorizontal: 24, gap: 12, paddingBottom: 0 },
    tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 12, borderBottomWidth: 2, borderColor: 'transparent' },
    tabBtnActive: { borderColor: '#000' },
    tabText: { fontSize: 11, fontWeight: '900', color: '#94a3b8', letterSpacing: 0.5 },
    tabTextActive: { color: '#000' },
    ledgerCount: { backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    ledgerCountText: { fontSize: 9, fontWeight: '900', color: '#64748b' },

    mainBody: { flex: 1 },
    formScroll: { flex: 1 },
    formContent: { padding: 24, gap: 32 },
    formHero: { flexDirection: 'row', backgroundColor: '#000', borderRadius: 24, padding: 20, marginBottom: 8 },
    heroStatItem: { flex: 1, alignItems: 'center' },
    heroStatLabel: { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 4 },
    heroStatValue: { fontSize: 18, fontWeight: '900', color: '#fff' },
    heroStatDivider: { width: 1, height: '80%', backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'center' },

    inputGroup: { gap: 16 },
    groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    groupTitle: { fontSize: 11, fontWeight: '900', color: '#cbd5e1', letterSpacing: 1.2, textTransform: 'uppercase' },
    vipBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#f1f5f9' },
    vipBadgeOn: { backgroundColor: '#000', borderColor: '#000' },
    vipBadgeText: { fontSize: 10, fontWeight: '900', color: '#64748b' },
    vipBadgeTextOn: { color: '#fff' },

    fieldContainer: { gap: 8 },
    fieldLabel: { fontSize: 11, fontWeight: '800', color: '#475569', letterSpacing: 0.5 },
    reqText: { color: '#ef4444' },
    inputWrapper: { flexDirection: 'row', height: 52, backgroundColor: '#f8fafc', borderRadius: 14, paddingHorizontal: 14, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#f1f5f9' },
    fieldInput: { flex: 1, fontSize: 15, fontWeight: '700', color: '#000' },
    simpleInput: { height: 52, backgroundColor: '#f8fafc', borderRadius: 14, paddingHorizontal: 14, fontSize: 15, fontWeight: '700', color: '#000', borderWidth: 1, borderColor: '#f1f5f9' },

    typeSelectorRow: { flexDirection: 'row', gap: 12 },
    typeOption: { flex: 1, height: 52, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f8fafc', borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: '#f1f5f9' },
    typeOptionActive: { borderColor: '#000', backgroundColor: '#fff' },
    typeRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' },
    typeRadioActive: { borderColor: '#000' },
    radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#000' },
    typeOptionText: { fontSize: 14, fontWeight: '800', color: '#64748b' },
    typeOptionTextActive: { color: '#000' },

    dropdownInput: { flexDirection: 'row', height: 52, backgroundColor: '#f8fafc', borderRadius: 14, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'space-between', gap: 12, borderWidth: 1, borderColor: '#f1f5f9' },
    dropdownValue: { flex: 1, fontSize: 15, fontWeight: '700', color: '#000' },
    placeholder: { color: '#cbd5e1' },

    gridRow: { flexDirection: 'row', gap: 12 },
    textArea: { minHeight: 100, backgroundColor: '#f8fafc', borderRadius: 16, padding: 14, fontSize: 14, fontWeight: '600', color: '#000', textAlignVertical: 'top', borderWidth: 1, borderColor: '#f1f5f9' },

    ledgerContainer: { flex: 1, backgroundColor: '#f8fafc' },
    ledgerStatsOverlay: { flexDirection: 'row', backgroundColor: '#fff', margin: 24, marginBottom: 0, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#f1f5f9' },
    statMiniCard: { flex: 1, alignItems: 'center' },
    miniLabel: { fontSize: 8, fontWeight: '900', color: '#94a3b8', letterSpacing: 0.5 },
    miniValue: { fontSize: 15, fontWeight: '900', color: '#000', marginTop: 4 },
    statMiniDivider: { width: 1, height: '60%', backgroundColor: '#f1f5f9', alignSelf: 'center' },

    ledgerList: { padding: 24, gap: 12 },
    ledgerCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#f1f5f9' },
    ledgerCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    ledgerDateBox: { width: 44, height: 44, backgroundColor: '#f8fafc', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
    ledgerDay: { fontSize: 16, fontWeight: '900', color: '#000' },
    ledgerMonth: { fontSize: 9, fontWeight: '900', color: '#94a3b8' },
    ledgerMainInfo: { flex: 1, gap: 2 },
    ledgerInvText: { fontSize: 14, fontWeight: '900', color: '#000' },
    ledgerStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statusIndicator: { width: 6, height: 6, borderRadius: 3 },
    statusLabelText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
    ledgerAmountBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    ledgerTotalAmount: { fontSize: 16, fontWeight: '900', color: '#000' },
    ledgerItemsList: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f8fafc' },
    ledgerItemPreview: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },

    ledgerEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    emptyArt: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
    emptyHeading: { fontSize: 18, fontWeight: '900', color: '#000' },
    emptyText: { fontSize: 14, fontWeight: '600', color: '#94a3b8', textAlign: 'center' },

    modalFooter: { padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#f1f5f9' },
    footerActions: { flexDirection: 'row', gap: 12 },
    binBtn: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#fff1f2', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ffe4e6' },
    saveBtn: { flex: 1, height: 56, borderRadius: 16, backgroundColor: '#000', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    saveText: { fontSize: 15, fontWeight: '900', color: '#fff' },
    loading: { opacity: 0.7 },
    exportFullBtn: { height: 56, borderRadius: 16, backgroundColor: '#000', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    exportText: { fontSize: 15, fontWeight: '900', color: '#fff' },

    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', zIndex: 1000 },
    sheet: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: height * 0.7 },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    sheetLabel: { fontSize: 11, fontWeight: '900', color: '#cbd5e1', letterSpacing: 1 },
    option: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
    optionLabel: { fontSize: 15, fontWeight: '800', color: '#000' }
});