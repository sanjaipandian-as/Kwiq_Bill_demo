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

// ── Pure-JS Calendar Picker ─────────────────────────────────────────────────
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function CalendarPicker({ visible, onClose, onSelect, selectedDate, markedDates = [] }) {
    const today = new Date();
    const [viewYear, setViewYear] = useState((selectedDate || today).getFullYear());
    const [viewMonth, setViewMonth] = useState((selectedDate || today).getMonth());

    const markedSet = useMemo(() => {
        const s = new Set();
        markedDates.forEach(d => s.add(new Date(d).toDateString()));
        return s;
    }, [markedDates]);

    const goMonth = (delta) => {
        let m = viewMonth + delta;
        let y = viewYear;
        if (m < 0) { m = 11; y--; }
        if (m > 11) { m = 0; y++; }
        setViewMonth(m); setViewYear(y);
    };

    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    if (!visible) return null;
    return (
        <View style={calStyles.overlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
            <View style={calStyles.sheet}>
                <View style={calStyles.header}>
                    <TouchableOpacity style={calStyles.navBtn} onPress={() => goMonth(-1)}>
                        <Text style={calStyles.navArrow}>‹</Text>
                    </TouchableOpacity>
                    <Text style={calStyles.monthTitle}>{MONTHS[viewMonth]} {viewYear}</Text>
                    <TouchableOpacity style={calStyles.navBtn} onPress={() => goMonth(1)}>
                        <Text style={calStyles.navArrow}>›</Text>
                    </TouchableOpacity>
                </View>
                <View style={calStyles.dayRow}>
                    {DAYS.map(d => <Text key={d} style={calStyles.dayLabel}>{d}</Text>)}
                </View>
                {weeks.map((week, wi) => (
                    <View key={wi} style={calStyles.weekRow}>
                        {week.map((day, di) => {
                            if (!day) return <View key={di} style={calStyles.dayCell} />;
                            const dt = new Date(viewYear, viewMonth, day);
                            const isToday = dt.toDateString() === today.toDateString();
                            const isSelected = selectedDate && dt.toDateString() === selectedDate.toDateString();
                            const hasInv = markedSet.has(dt.toDateString());
                            const isFuture = dt > today;
                            return (
                                <TouchableOpacity
                                    key={di}
                                    style={[calStyles.dayCell, isSelected && calStyles.dayCellSelected, isToday && !isSelected && calStyles.dayCellToday]}
                                    onPress={() => { if (!isFuture) { onSelect(dt); onClose(); } }}
                                    disabled={isFuture}
                                >
                                    <Text style={[calStyles.dayNum, isSelected && calStyles.dayNumSelected, isFuture && calStyles.dayNumFuture]}>{day}</Text>
                                    {hasInv && <View style={[calStyles.dot, isSelected && calStyles.dotSelected]} />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ))}
                <TouchableOpacity style={calStyles.clearBtn} onPress={() => { onSelect(null); onClose(); }}>
                    <Text style={calStyles.clearBtnText}>Clear — Show All</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function CustomerModal({ isOpen, onClose, customer, onSave, onDelete, initialTab = 'details' }) {
    const { transactions } = useTransactions();
    const [activeTab, setActiveTab] = useState(initialTab);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [pickedDate, setPickedDate] = useState(null); // null = show all

    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab);
            setPickedDate(null);
            setShowDatePicker(false);
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

    // Filter history by the picked date (exact day match)
    const filteredHistory = useMemo(() => {
        if (!pickedDate) return history;
        const pd = pickedDate.toDateString();
        return history.filter(t => new Date(t.date).toDateString() === pd);
    }, [history, pickedDate]);


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
        const due = Math.max(0, (parseFloat(tx.total) || 0) - (parseFloat(tx.amountReceived) || 0));
        const items = tx.items || [];
        const dateStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });

        return (
            <Pressable style={styles.ledgerCard} onPress={() => shareReceiptPDF(tx)}>
                {/* ── Invoice header row ── */}
                <View style={styles.ledgerHeader}>
                    <View style={styles.ledgerInvBlock}>
                        <Text style={styles.ledgerInvNum}>INV-#{(tx.id || '').substring(0, 6).toUpperCase()}</Text>
                        <View style={styles.ledgerDateRow}>
                            <Calendar size={10} color="#999" />
                            <Text style={styles.ledgerDateText}>{dateStr}</Text>
                        </View>
                    </View>

                    <View style={styles.ledgerRightBlock}>
                        <Text style={styles.ledgerAmount}>₹{(tx.total || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                        <View style={[styles.statusBadge, isPaid ? styles.statusPaid : styles.statusDue]}>
                            <Text style={[styles.statusBadgeText, isPaid ? styles.statusPaidText : styles.statusDueText]}>
                                {isPaid ? 'PAID' : `DUE ₹${due.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ── Products list ── */}
                {items.length > 0 && (
                    <View style={styles.ledgerItemsBlock}>
                        {items.map((item, idx) => {
                            const qty = item.quantity || item.qty || 1;
                            const rate = parseFloat(item.price || item.rate || 0);
                            const lineTotal = qty * rate;
                            return (
                                <View key={idx} style={[styles.ledgerItemRow, idx < items.length - 1 && styles.ledgerItemRowBorder]}>
                                    <View style={styles.ledgerItemQtyBox}>
                                        <Text style={styles.ledgerItemQty}>{qty}</Text>
                                    </View>
                                    <Text style={styles.ledgerItemName} numberOfLines={1}>{item.name || 'Item'}</Text>
                                    <Text style={styles.ledgerItemTotal}>
                                        ₹{lineTotal > 0 ? lineTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '—'}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* ── Tap to share hint ── */}
                <View style={styles.ledgerTapRow}>
                    <ChevronRight size={12} color="#bbb" />
                    <Text style={styles.ledgerTapHint}>Tap to share receipt</Text>
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
                        <User size={18} color="#777" />
                        <TextInput
                            style={styles.fieldInput}
                            value={formData.fullName}
                            onChangeText={(text) => setFormData({ ...formData, fullName: text })}
                            placeholder="e.g. Rahul Sharma"
                            placeholderTextColor="#bbb"
                        />
                    </View>
                </View>

                <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>CONTACT NUMBER <Text style={styles.reqText}>*</Text></Text>
                    <View style={styles.inputWrapper}>
                        <Phone size={18} color="#777" />
                        <TextInput
                            style={styles.fieldInput}
                            value={formData.phone}
                            onChangeText={(text) => setFormData({ ...formData, phone: text })}
                            placeholder="10-digit mobile number"
                            placeholderTextColor="#bbb"
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
                        <Mail size={18} color="#777" />
                        <TextInput
                            style={styles.fieldInput}
                            value={formData.email}
                            onChangeText={(text) => setFormData({ ...formData, email: text })}
                            placeholder="client@mail.com"
                            placeholderTextColor="#bbb"
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>
                </View>

                {formData.customerType === 'Business' && (
                    <View style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>GST IDENTIFICATION NUMBER</Text>
                        <View style={styles.inputWrapper}>
                            <Building size={18} color="#777" />
                            <TextInput
                                style={styles.fieldInput}
                                value={formData.gstin}
                                onChangeText={(text) => setFormData({ ...formData, gstin: text })}
                                placeholder="22AAAAA0000A1Z5"
                                placeholderTextColor="#bbb"
                                autoCapitalize="characters"
                            />
                        </View>
                    </View>
                )}

                <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>LEAD SOURCE</Text>
                    <TouchableOpacity style={styles.dropdownInput} onPress={() => openPicker("Select Lead Source", SOURCE_OPTIONS, 'source')}>
                        <LayoutGrid size={18} color="#777" />
                        <Text style={[styles.dropdownValue, !formData.source && styles.placeholder]}>
                            {formData.source || "Select Source"}
                        </Text>
                        <ChevronDown size={18} color="#777" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.groupTitle}>Work / Shipping Address</Text>

                <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>STREET / BUILDING</Text>
                    <View style={styles.inputWrapper}>
                        <MapPin size={18} color="#777" />
                        <TextInput
                            style={styles.fieldInput}
                            value={formData.address.street}
                            onChangeText={(text) => setFormData({ ...formData, address: { ...formData.address, street: text } })}
                            placeholder="Unit No, Building Name"
                            placeholderTextColor="#bbb"
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
                            placeholderTextColor="#bbb"
                        />
                    </View>
                    <View style={[styles.fieldContainer, { flex: 1 }]}>
                        <Text style={styles.fieldLabel}>PINCODE</Text>
                        <TextInput
                            style={styles.simpleInput}
                            value={formData.address.pincode}
                            onChangeText={(text) => setFormData({ ...formData, address: { ...formData.address, pincode: text } })}
                            placeholder="400001"
                            placeholderTextColor="#bbb"
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
                    placeholderTextColor="#bbb"
                    multiline
                    numberOfLines={4}
                />
            </View>

            <View style={{ height: 80 }} />
        </ScrollView>
    );

    return (
        <RNModal visible={isOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.container}>
                <View style={styles.topHeader}>
                    <View style={styles.dragHandle} />
                    <View style={styles.headerTitleRow}>
                        <View style={styles.titleContent}>
                            <Text style={styles.mainTitle}>{customer ? 'Edit Party' : 'Register Party'}</Text>
                            <Text style={styles.subTitle}>{customer ? 'Update profile & ledger details' : 'Add a new client or business contact'}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.headerX}>
                            <X size={20} color="#000" />
                        </TouchableOpacity>
                    </View>

                    {customer && (
                        <View style={styles.tabToggleWrap}>
                            <TouchableOpacity
                                style={[styles.tabToggleBtn, activeTab === 'details' && styles.tabToggleBtnActive]}
                                onPress={() => setActiveTab('details')}
                            >
                                <User size={15} color={activeTab === 'details' ? '#fff' : '#888'} />
                                <Text style={[styles.tabToggleText, activeTab === 'details' && styles.tabToggleTextActive]}>Profile</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.tabToggleBtn, activeTab === 'history' && styles.tabToggleBtnActive]}
                                onPress={() => setActiveTab('history')}
                            >
                                <CreditCard size={15} color={activeTab === 'history' ? '#fff' : '#888'} />
                                <Text style={[styles.tabToggleText, activeTab === 'history' && styles.tabToggleTextActive]}>Ledger</Text>
                                {history.length > 0 && (
                                    <View style={[styles.tabCountBadge, activeTab === 'history' && styles.tabCountBadgeActive]}>
                                        <Text style={[styles.tabCountText, activeTab === 'history' && styles.tabCountTextActive]}>{history.length}</Text>
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
                                    {/* Combined Stats + Date Filter Card */}
                                    <View style={styles.ledgerTopCard}>
                                        <View style={styles.ledgerTopRow}>

                                            {/* LEFT: 3 stats — narrower */}
                                            <View style={styles.ledgerStatsSection}>
                                                <View style={styles.statMiniCard}>
                                                    <Text style={styles.miniLabel}>Outstanding</Text>
                                                    <Text style={[styles.miniValue, stats.pending > 0 && { color: '#ef4444' }]}>
                                                        ₹{stats.pending.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                                    </Text>
                                                </View>
                                                <View style={styles.statMiniDivider} />
                                                <View style={styles.statMiniCard}>
                                                    <Text style={styles.miniLabel}>Lifetime</Text>
                                                    <Text style={styles.miniValue}>₹{stats.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                                                </View>
                                                <View style={styles.statMiniDivider} />
                                                <View style={styles.statMiniCard}>
                                                    <Text style={styles.miniLabel}>Invoices</Text>
                                                    <Text style={styles.miniValue}>{stats.count}</Text>
                                                </View>
                                            </View>

                                            {/* Vertical divider */}
                                            <View style={styles.cardVertDivider} />

                                            {/* RIGHT: All + Date picker buttons */}
                                            <View style={styles.filterControlCol}>
                                                <TouchableOpacity
                                                    style={[styles.filterBtn, !pickedDate && styles.filterBtnActive]}
                                                    onPress={() => setPickedDate(null)}
                                                >
                                                    <Text style={[styles.filterBtnText, !pickedDate && styles.filterBtnTextActive]}>All</Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={[styles.filterBtn, pickedDate && styles.filterBtnActive]}
                                                    onPress={() => setShowDatePicker(true)}
                                                >
                                                    <Calendar size={11} color={pickedDate ? '#fff' : '#555'} />
                                                    <Text style={[styles.filterBtnText, pickedDate && styles.filterBtnTextActive]}>
                                                        {pickedDate
                                                            ? pickedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                                                            : 'Date'}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        {/* Active date banner */}
                                        {pickedDate && (
                                            <View style={styles.activeDateBanner}>
                                                <Calendar size={11} color="#fff" />
                                                <Text style={styles.activeDateText}>
                                                    {pickedDate.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                                                </Text>
                                                <TouchableOpacity onPress={() => setPickedDate(null)}>
                                                    <X size={13} color="#fff" />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>

                                    {/* JS Calendar Picker */}
                                    <CalendarPicker
                                        visible={showDatePicker}
                                        onClose={() => setShowDatePicker(false)}
                                        onSelect={(date) => setPickedDate(date)}
                                        selectedDate={pickedDate}
                                        markedDates={history.map(t => t.date)}
                                    />

                                    <FlatList
                                        data={filteredHistory}
                                        keyExtractor={item => item.id.toString()}
                                        renderItem={renderHistoryItem}
                                        contentContainerStyle={styles.ledgerList}
                                        showsVerticalScrollIndicator={false}
                                        ListEmptyComponent={
                                            <View style={styles.filterEmptyBox}>
                                                <Calendar size={28} color="#ddd" />
                                                <Text style={styles.filterEmptyTitle}>No invoices found</Text>
                                                <Text style={styles.filterEmptyText}>
                                                    {pickedDate
                                                        ? `No transactions on ${pickedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                                                        : 'No transactions yet'}
                                                </Text>
                                            </View>
                                        }
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
    topHeader: { backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#efefef' },
    dragHandle: { width: 36, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
    headerTitleRow: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, alignItems: 'center', justifyContent: 'space-between' },
    titleContent: { gap: 2 },
    mainTitle: { fontSize: 22, fontWeight: '900', color: '#000', letterSpacing: -0.5 },
    subTitle: { fontSize: 13, fontWeight: '600', color: '#999' },
    headerX: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#f3f3f3', alignItems: 'center', justifyContent: 'center' },

    // 50/50 pill tab toggle
    tabToggleWrap: {
        flexDirection: 'row',
        marginHorizontal: 20,
        marginBottom: 14,
        backgroundColor: '#f0f0f0',
        borderRadius: 14,
        padding: 4,
        gap: 0,
    },
    tabToggleBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 7, paddingVertical: 10, borderRadius: 11,
    },
    tabToggleBtnActive: { backgroundColor: '#000' },
    tabToggleText: { fontSize: 13, fontWeight: '800', color: '#888' },
    tabToggleTextActive: { color: '#fff' },
    tabCountBadge: {
        backgroundColor: '#ddd', borderRadius: 8,
        paddingHorizontal: 6, paddingVertical: 2,
    },
    tabCountBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
    tabCountText: { fontSize: 10, fontWeight: '900', color: '#555' },
    tabCountTextActive: { color: '#fff' },

    // Legacy tab styles kept for safety
    tabContainer: { flexDirection: 'row', paddingHorizontal: 24, gap: 12, paddingBottom: 0 },
    tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 12, borderBottomWidth: 2, borderColor: 'transparent' },
    tabBtnActive: { borderColor: '#000' },
    tabText: { fontSize: 11, fontWeight: '900', color: '#94a3b8', letterSpacing: 0.5 },
    tabTextActive: { color: '#000' },
    ledgerCount: { backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    ledgerCountText: { fontSize: 9, fontWeight: '900', color: '#64748b' },

    mainBody: { flex: 1, backgroundColor: '#f5f5f5' },
    formScroll: { flex: 1 },
    formContent: { padding: 18, paddingTop: 20, gap: 16 },
    formHero: { flexDirection: 'row', backgroundColor: '#000', borderRadius: 20, padding: 18, marginBottom: 4 },
    heroStatItem: { flex: 1, alignItems: 'center' },
    heroStatLabel: { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 4 },
    heroStatValue: { fontSize: 18, fontWeight: '900', color: '#fff' },
    heroStatDivider: { width: 1, height: '80%', backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'center' },

    inputGroup: {
        gap: 12,
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: '#ededed',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    groupTitle: {
        fontSize: 11, fontWeight: '900', color: '#888',
        letterSpacing: 1.2, textTransform: 'uppercase',
    },
    vipBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#f1f5f9' },
    vipBadgeOn: { backgroundColor: '#000', borderColor: '#000' },
    vipBadgeText: { fontSize: 10, fontWeight: '900', color: '#64748b' },
    vipBadgeTextOn: { color: '#fff' },

    fieldContainer: { gap: 6 },
    fieldLabel: { fontSize: 12, fontWeight: '800', color: '#333', letterSpacing: 0.3 },
    reqText: { color: '#ef4444' },
    inputWrapper: {
        flexDirection: 'row', height: 50,
        backgroundColor: '#fff',
        borderRadius: 12, paddingHorizontal: 14,
        alignItems: 'center', gap: 10,
        borderWidth: 1.5, borderColor: '#c9c9c9',
    },
    fieldInput: { flex: 1, fontSize: 15, fontWeight: '600', color: '#000' },
    simpleInput: {
        height: 50,
        backgroundColor: '#fff',
        borderRadius: 12, paddingHorizontal: 14,
        fontSize: 15, fontWeight: '600', color: '#000',
        borderWidth: 1.5, borderColor: '#c9c9c9',
    },

    typeSelectorRow: { flexDirection: 'row', gap: 10 },
    typeOption: {
        flex: 1, height: 50, flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14,
        borderWidth: 1.5, borderColor: '#c9c9c9',
    },
    typeOptionActive: { borderColor: '#000', backgroundColor: '#000' },
    typeRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#c9c9c9', alignItems: 'center', justifyContent: 'center' },
    typeRadioActive: { borderColor: '#fff' },
    radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
    typeOptionText: { fontSize: 14, fontWeight: '800', color: '#555' },
    typeOptionTextActive: { color: '#fff' },

    dropdownInput: {
        flexDirection: 'row', height: 50,
        backgroundColor: '#fff',
        borderRadius: 12, paddingHorizontal: 14,
        alignItems: 'center', justifyContent: 'space-between', gap: 10,
        borderWidth: 1.5, borderColor: '#c9c9c9',
    },
    dropdownValue: { flex: 1, fontSize: 15, fontWeight: '600', color: '#000' },
    placeholder: { color: '#bbb' },

    gridRow: { flexDirection: 'row', gap: 10 },
    textArea: {
        minHeight: 90,
        backgroundColor: '#fff',
        borderRadius: 12, padding: 14,
        fontSize: 14, fontWeight: '600', color: '#000',
        textAlignVertical: 'top',
        borderWidth: 1.5, borderColor: '#c9c9c9',
    },

    ledgerContainer: { flex: 1, backgroundColor: '#f5f5f5' },

    // Combined stats + filter card
    ledgerTopCard: {
        marginHorizontal: 14, marginTop: 14,
        backgroundColor: '#fff',
        borderRadius: 18,
        borderWidth: 1, borderColor: '#e8e8e8',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
        overflow: 'hidden',
    },
    ledgerTopRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
    },
    // Stats — takes ~65% of width
    ledgerStatsSection: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 6,
    },
    cardVertDivider: {
        width: 1, backgroundColor: '#efefef',
        marginVertical: 10,
    },
    // Filter col — takes ~35% of width
    filterControlCol: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        paddingVertical: 12,
        paddingHorizontal: 8,
    },
    filterBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 10, paddingVertical: 7,
        borderRadius: 22,
        backgroundColor: '#f3f3f3',
        borderWidth: 1.5, borderColor: '#dedede',
        alignSelf: 'stretch', justifyContent: 'center',
    },
    filterBtnActive: { backgroundColor: '#000', borderColor: '#000' },
    filterBtnText: { fontSize: 12, fontWeight: '800', color: '#444' },
    filterBtnTextActive: { color: '#fff' },

    // Active date banner
    activeDateBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#000',
        paddingHorizontal: 14, paddingVertical: 8,
    },
    activeDateText: { flex: 1, fontSize: 11, fontWeight: '700', color: '#fff' },

    // Legacy — kept
    ledgerStatsOverlay: {
        flexDirection: 'row', backgroundColor: '#fff',
        marginHorizontal: 14, marginTop: 14, marginBottom: 0,
        borderRadius: 16, padding: 14,
        borderWidth: 1, borderColor: '#e8e8e8',
    },
    ledgerStatsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 10 },
    filterCardDivider: { height: 1, backgroundColor: '#f0f0f0' },
    filterInlineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, gap: 10 },
    filterLabelBox: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingRight: 10, borderRightWidth: 1, borderRightColor: '#ebebeb' },
    filterLabelText: { fontSize: 12, fontWeight: '800', color: '#555' },
    filterChipScroll: { gap: 8, paddingRight: 4, flexDirection: 'row' },

    statMiniCard: { flex: 1, alignItems: 'center', gap: 3 },
    miniLabel: { fontSize: 9, fontWeight: '800', color: '#999', letterSpacing: 0.4, textTransform: 'uppercase' },
    miniValue: { fontSize: 14, fontWeight: '900', color: '#000' },
    statMiniDivider: { width: 1, height: 26, backgroundColor: '#e8e8e8', alignSelf: 'center' },

    ledgerList: { padding: 14, paddingTop: 12, gap: 10 },

    // ── Ledger card ──────────────────────────────────
    ledgerCard: {
        backgroundColor: '#fff', borderRadius: 16,
        borderWidth: 1, borderColor: '#e8e8e8',
        overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },

    // Header row: inv number + date | amount + status
    ledgerHeader: {
        flexDirection: 'row', alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10,
        gap: 12,
    },
    ledgerInvBlock: { gap: 4 },
    ledgerInvNum: { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 0.3 },
    ledgerDateRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    ledgerDateText: { fontSize: 12, fontWeight: '600', color: '#888' },

    ledgerRightBlock: { alignItems: 'flex-end', gap: 5 },
    ledgerAmount: { fontSize: 16, fontWeight: '900', color: '#000' },
    statusBadge: {
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7,
        borderWidth: 1,
    },
    statusPaid: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
    statusDue: { backgroundColor: '#fff1f2', borderColor: '#fecdd3' },
    statusBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },
    statusPaidText: { color: '#16a34a' },
    statusDueText: { color: '#ef4444' },

    // Products block
    ledgerItemsBlock: {
        borderTopWidth: 1, borderTopColor: '#f0f0f0',
        marginHorizontal: 14, paddingTop: 8, paddingBottom: 4,
    },
    ledgerItemRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 7, gap: 10,
    },
    ledgerItemRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
    ledgerItemQtyBox: {
        width: 26, height: 26, borderRadius: 8,
        backgroundColor: '#f3f3f3', borderWidth: 1, borderColor: '#e8e8e8',
        alignItems: 'center', justifyContent: 'center',
    },
    ledgerItemQty: { fontSize: 11, fontWeight: '900', color: '#555' },
    ledgerItemName: { flex: 1, fontSize: 13, fontWeight: '700', color: '#222' },
    ledgerItemTotal: { fontSize: 13, fontWeight: '800', color: '#000' },

    // Tap hint
    ledgerTapRow: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 14, paddingBottom: 10, paddingTop: 2,
    },
    ledgerTapHint: { fontSize: 11, fontWeight: '600', color: '#bbb' },

    // Legacy — kept for safety
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
    emptyArt: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e8e8e8' },
    emptyHeading: { fontSize: 17, fontWeight: '900', color: '#000' },
    emptyText: { fontSize: 13, fontWeight: '600', color: '#999', textAlign: 'center' },

    // Month filter chips
    monthChip: {
        paddingHorizontal: 12, paddingVertical: 5,
        borderRadius: 20, backgroundColor: '#f3f3f3',
        borderWidth: 1.5, borderColor: '#e0e0e0',
    },
    monthChipActive: { backgroundColor: '#000', borderColor: '#000' },
    monthChipText: { fontSize: 12, fontWeight: '800', color: '#555' },
    monthChipTextActive: { color: '#fff' },

    filterEmptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 8 },
    filterEmptyTitle: { fontSize: 15, fontWeight: '900', color: '#333' },
    filterEmptyText: { fontSize: 13, fontWeight: '600', color: '#bbb', textAlign: 'center' },

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

// ── CalendarPicker styles ─────────────────────────────────────────────────────
const calStyles = StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 2000 },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: 20, paddingBottom: 32,
    },
    header: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 16,
    },
    navBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    navArrow: { fontSize: 28, fontWeight: '300', color: '#000', lineHeight: 32 },
    monthTitle: { fontSize: 17, fontWeight: '900', color: '#000' },
    dayRow: {
        flexDirection: 'row', marginBottom: 6,
    },
    dayLabel: {
        flex: 1, textAlign: 'center',
        fontSize: 11, fontWeight: '800', color: '#aaa',
    },
    weekRow: { flexDirection: 'row', marginBottom: 4 },
    dayCell: {
        flex: 1, aspectRatio: 1,
        alignItems: 'center', justifyContent: 'center',
        borderRadius: 12,
    },
    dayCellSelected: { backgroundColor: '#000' },
    dayCellToday: { backgroundColor: '#f3f3f3' },
    dayNum: { fontSize: 14, fontWeight: '700', color: '#111' },
    dayNumSelected: { color: '#fff' },
    dayNumFuture: { color: '#ddd' },
    dot: {
        width: 4, height: 4, borderRadius: 2,
        backgroundColor: '#000', marginTop: 2,
    },
    dotSelected: { backgroundColor: '#fff' },
    clearBtn: {
        marginTop: 16, alignItems: 'center',
        paddingVertical: 14, borderRadius: 16,
        backgroundColor: '#f3f3f3',
    },
    clearBtnText: { fontSize: 14, fontWeight: '800', color: '#555' },
});