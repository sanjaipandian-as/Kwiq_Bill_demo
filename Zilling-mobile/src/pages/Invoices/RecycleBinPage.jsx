import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Pressable,
    ActivityIndicator,
    TouchableOpacity,
    StatusBar,
    Platform,
    Modal,
    ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
    Search,
    RotateCcw,
    Trash2,
    ChevronLeft,
    X,
    History,
    Filter,
    Calendar,
    Clock,
    Globe,
    ChevronRight,
    ChevronLeft as ChevronLeftIcon,
    ChevronRight as ChevronRightIcon
} from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { useTransactions } from '../../context/TransactionContext';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { useToast } from '../../context/ToastContext';
import { LinearGradient } from 'expo-linear-gradient';

export default function RecycleBinPage() {
    const navigation = useNavigation();
    const { fetchDeletedTransactions, restoreTransaction, permanentlyDeleteTransaction, restoreAllInvoices, emptyRecycleBin } = useTransactions();
    const { showToast } = useToast();
    const [deletedInvoices, setDeletedInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Date Filter State - GST Analytics Style
    const [period, setPeriod] = useState('All Time');
    const [selectedCustomDate, setSelectedCustomDate] = useState(null);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [currentCalView, setCurrentCalView] = useState(new Date());

    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        variant: 'danger',
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel'
    });

    const loadDeleted = async () => {
        setLoading(true);
        try {
            const data = await fetchDeletedTransactions();
            setDeletedInvoices(data);
        } catch (err) {
            showToast("Failed to load deleted invoices", "error");
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadDeleted();
            StatusBar.setBarStyle('light-content');
            if (Platform.OS === 'android') StatusBar.setBackgroundColor('#000000');
        }, [])
    );

    const handleRestore = (invoice) => {
        setConfirmModal({
            isOpen: true,
            title: "RESTORE INVOICE",
            message: `Restore Invoice #${invoice.invoiceNumber || invoice.id}?\n\nInventory stock will be deducted again upon restoration.`,
            variant: 'info',
            confirmLabel: 'RESTORE',
            cancelLabel: 'CANCEL',
            onConfirm: async () => {
                try {
                    await restoreTransaction(invoice.id);
                    showToast("Invoice restored", "success");
                    loadDeleted();
                } catch (err) {
                    showToast("Restoration failed", "error");
                }
            }
        });
    };

    const handlePermanentDelete = (invoice) => {
        setConfirmModal({
            isOpen: true,
            title: "DELETE PERMANENTLY",
            message: `This action cannot be undone. Invoice #${invoice.invoiceNumber || invoice.id} will be lost forever.`,
            variant: 'danger',
            confirmLabel: 'DELETE FOREVER',
            cancelLabel: 'CANCEL',
            onConfirm: async () => {
                try {
                    await permanentlyDeleteTransaction(invoice.id);
                    showToast("Invoice deleted permanently", "success");
                    loadDeleted();
                } catch (err) {
                    showToast("Deletion failed", "error");
                }
            }
        });
    };

    const handleRestoreAll = () => {
        if (deletedInvoices.length === 0) return;
        setConfirmModal({
            isOpen: true,
            title: "RESTORE ALL",
            message: `Are you sure you want to restore all ${deletedInvoices.length} invoices?`,
            variant: 'info',
            confirmLabel: 'RESTORE ALL',
            cancelLabel: 'CANCEL',
            onConfirm: async () => {
                try {
                    await restoreAllInvoices();
                    showToast("All invoices restored", "success");
                    loadDeleted();
                } catch (err) {
                    showToast("Restoration failed", "error");
                }
            }
        });
    };

    const handleEmptyBin = () => {
        if (deletedInvoices.length === 0) return;
        setConfirmModal({
            isOpen: true,
            title: "EMPTY RECYCLE BIN",
            message: "WARNING: This will permanently delete all items in the trash. This action cannot be undone.",
            variant: 'danger',
            confirmLabel: 'EMPTY BIN',
            cancelLabel: 'CANCEL',
            onConfirm: async () => {
                try {
                    await emptyRecycleBin();
                    showToast("Recycle bin cleared", "success");
                    loadDeleted();
                } catch (err) {
                    showToast("Failed to empty bin", "error");
                }
            }
        });
    };

    // Date Filter Functions
    const changePeriod = (p) => {
        setPeriod(p);
        setIsFilterOpen(false);
    };

    const handleCustomDateSelect = (date) => {
        setSelectedCustomDate(date);
        setPeriod('Custom');
        setIsCalendarOpen(false);
    };

    // Calendar Helpers
    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const calendarHeader = currentCalView.toLocaleString('default', { month: 'long', year: 'numeric' });
    const daysArr = Array.from({ length: getDaysInMonth(currentCalView.getFullYear(), currentCalView.getMonth()) }, (_, i) => i + 1);
    const startPadding = Array.from({ length: getFirstDayOfMonth(currentCalView.getFullYear(), currentCalView.getMonth()) });

    const shiftMonth = (offset) => {
        const newDate = new Date(currentCalView.getFullYear(), currentCalView.getMonth() + offset, 1);
        setCurrentCalView(newDate);
    };

    const filteredInvoices = deletedInvoices.filter(inv => {
        const invId = inv.id || '';
        const weeklyNo = inv.weekly_sequence?.toString() || '';
        const customer = inv.customer_name || inv.customerName || '';
        const matchesSearch = invId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            weeklyNo.includes(searchTerm) ||
            customer.toLowerCase().includes(searchTerm.toLowerCase());

        // Date filtering
        let matchesDateFilter = true;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const invDate = new Date(inv.date);

        if (period === 'Today') {
            matchesDateFilter = invDate >= startOfToday;
        } else if (period === 'Yesterday') {
            const yesterday = new Date(startOfToday);
            yesterday.setDate(yesterday.getDate() - 1);
            matchesDateFilter = invDate >= yesterday && invDate < startOfToday;
        } else if (period === 'This Week') {
            const startOfWeek = new Date(startOfToday);
            startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
            matchesDateFilter = invDate >= startOfWeek;
        } else if (period === 'This Month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            matchesDateFilter = invDate >= startOfMonth;
        } else if (period === 'This Year') {
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            matchesDateFilter = invDate >= startOfYear;
        } else if (period === 'All Time') {
            matchesDateFilter = true;
        } else if (period === 'Custom' && selectedCustomDate) {
            const targetDate = new Date(selectedCustomDate);
            targetDate.setHours(0, 0, 0, 0);
            const endDate = new Date(targetDate);
            endDate.setDate(targetDate.getDate() + 1);
            matchesDateFilter = invDate >= targetDate && invDate < endDate;
        }

        return matchesSearch && matchesDateFilter;
    });

    const renderInvoiceItem = ({ item }) => (
        <View style={styles.invoiceCard}>
            <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={styles.invoiceId}>{item.invoiceNumber || item.id?.toString().slice(-6).toUpperCase() || 'INV-TEMP'}</Text>
                        <Text style={styles.customerName} numberOfLines={1}>{item.customer_name || item.customerName || 'Guest'}</Text>
                        <Text style={styles.dateText}>{new Date(item.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                    </View>
                    <View>
                        <Text style={styles.amount}>₹{(item.total || 0).toLocaleString()}</Text>
                    </View>
                </View>

                <View style={styles.actionRow}>
                    <TouchableOpacity
                        onPress={() => handleRestore(item)}
                        style={styles.restoreBtn}
                        activeOpacity={0.8}
                    >
                        <RotateCcw size={16} color="#fff" strokeWidth={2.5} />
                        <Text style={styles.restoreText}>RESTORE</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => handlePermanentDelete(item)}
                        style={styles.deleteBtn}
                        activeOpacity={0.6}
                    >
                        <Trash2 size={16} color="#000" strokeWidth={2.5} />
                        <Text style={styles.deleteText}>DELETE</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    return (
        <View style={styles.safeArea}>
            <LinearGradient colors={['#000', '#111']} style={styles.headerGradient}>
                <SafeAreaView edges={['top']}>
                    {/* Top Navigation */}
                    <View style={styles.topNav}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navIcon}>
                            <ChevronLeft size={24} color="#fff" strokeWidth={2.5} />
                        </TouchableOpacity>
                        <View style={styles.navTitleBox}>
                            <Text style={styles.navTitle}>Recycle Bin</Text>
                            <Text style={styles.navSubtitle}>{deletedInvoices.length} items found</Text>
                        </View>
                    </View>

                    {/* Search Row */}
                    <View style={styles.searchRow}>
                        <View style={styles.searchBox}>
                            <Search size={18} color="rgba(255,255,255,0.45)" strokeWidth={2.5} />
                            <Input
                                style={styles.searchInputPremium}
                                placeholder="Search deleted invoices..."
                                placeholderTextColor="rgba(255,255,255,0.35)"
                                value={searchTerm}
                                onChangeText={setSearchTerm}
                                selectionColor="#fff"
                            />
                            {searchTerm.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchTerm('')} style={styles.clearIcon}>
                                    <X size={18} color="#fff" />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={styles.filterTrigger}
                                onPress={() => setIsFilterOpen(true)}
                            >
                                <Filter size={24} color={period !== 'All Time' ? '#fff' : 'rgba(255,255,255,0.6)'} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Bulk Action Strip - With Horizontal Scroll for better UX */}
                    {deletedInvoices.length > 0 && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.actionHeaderPremium}
                        >
                            <TouchableOpacity onPress={handleRestoreAll} style={styles.premiumPill}>
                                <RotateCcw size={14} color="#fff" strokeWidth={2.5} />
                                <Text style={styles.premiumPillText}>Restore All</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleEmptyBin} style={[styles.premiumPill, styles.premiumPillDanger]}>
                                <Trash2 size={14} color="#ef4444" strokeWidth={2.5} />
                                <Text style={[styles.premiumPillText, { color: '#ef4444' }]}>Empty Trash</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setIsCalendarOpen(true)}
                                style={[styles.premiumPill, period === 'Custom' && { borderColor: '#fff' }]}
                            >
                                <Calendar size={20} color="#fff" strokeWidth={2.5} />
                            </TouchableOpacity>
                        </ScrollView>
                    )}
                </SafeAreaView>
            </LinearGradient>

            <View style={styles.container}>
                {/* Content */}
                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color="#000" />
                    </View>
                ) : filteredInvoices.length === 0 ? (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconCircle}>
                            <Trash2 size={40} color="#000" />
                        </View>
                        <Text style={styles.emptyTitle}>Bin is Empty</Text>
                        <Text style={styles.emptySub}>Items moved to trash will appear here.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={filteredInvoices}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={renderInvoiceItem}
                        contentContainerStyle={styles.listPadding}
                        showsVerticalScrollIndicator={false}
                    />
                )}

                <ConfirmationModal
                    isOpen={confirmModal.isOpen}
                    onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    variant={confirmModal.variant}
                    confirmLabel={confirmModal.confirmLabel}
                    cancelLabel={confirmModal.cancelLabel}
                    onConfirm={confirmModal.onConfirm}
                />

                {/* Filter Drawer - Theme Style */}
                <Modal
                    visible={isFilterOpen}
                    transparent
                    animationType="fade"
                    statusBarTranslucent
                    onRequestClose={() => setIsFilterOpen(false)}
                >
                    <Pressable style={styles.modalOverlay} onPress={() => setIsFilterOpen(false)}>
                        <View style={styles.filterModal}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Filter Trash</Text>
                                <Pressable onPress={() => setIsFilterOpen(false)} style={styles.modalCloseBtn}>
                                    <X size={18} color="#64748b" />
                                </Pressable>
                            </View>

                            <ScrollView style={styles.modalScroll}>
                                {[
                                    { id: 'Today', label: 'Today', icon: Clock },
                                    { id: 'Yesterday', label: 'Yesterday', icon: Clock },
                                    { id: 'This Week', label: 'This Week', icon: Calendar },
                                    { id: 'This Month', label: 'This Month', icon: Calendar },
                                    { id: 'This Year', label: 'This Year', icon: Calendar },
                                    { id: 'All Time', label: 'All Time', icon: Globe },
                                ].map(item => {
                                    const IconComp = item.icon;
                                    return (
                                        <Pressable
                                            key={item.id}
                                            style={[styles.filterItem, period === item.id && styles.activeFilterItem]}
                                            onPress={() => changePeriod(item.id)}
                                        >
                                            <View style={styles.filterItemLeft}>
                                                <IconComp size={18} color={period === item.id ? '#000' : '#94a3b8'} />
                                                <Text style={[styles.filterItemLabel, period === item.id && styles.activeFilterItemLabel]}>{item.label}</Text>
                                            </View>
                                            <ChevronRight size={16} color="#cbd5e1" />
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    </Pressable>
                </Modal>

                {/* Premium Calendar Picker Modal */}
                <Modal
                    visible={isCalendarOpen}
                    transparent
                    animationType="fade"
                    statusBarTranslucent
                    onRequestClose={() => setIsCalendarOpen(false)}
                >
                    <Pressable style={styles.modalOverlay} onPress={() => setIsCalendarOpen(false)}>
                        <View style={styles.calendarModalContainer}>
                            <View style={styles.premiumCal}>
                                <View style={styles.calTop}>
                                    <View style={styles.calNav}>
                                        <Pressable onPress={() => shiftMonth(-1)} style={styles.calNavBtn}>
                                            <ChevronLeftIcon size={20} color="#000" />
                                        </Pressable>
                                        <Text style={styles.calMonthLabel}>{calendarHeader}</Text>
                                        <Pressable onPress={() => shiftMonth(1)} style={styles.calNavBtn}>
                                            <ChevronRightIcon size={20} color="#000" />
                                        </Pressable>
                                    </View>
                                    <Pressable onPress={() => setIsCalendarOpen(false)} style={styles.calClose}>
                                        <X size={20} color="#94a3b8" />
                                    </Pressable>
                                </View>

                                <View style={styles.calWeekRow}>
                                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                                        <Text key={i} style={styles.calWeekText}>{d}</Text>
                                    ))}
                                </View>

                                <View style={styles.calGrid}>
                                    {startPadding.map((_, i) => (
                                        <View key={`p-${i}`} style={styles.calDayCell} />
                                    ))}
                                    {daysArr.map(day => {
                                        const isSelected = selectedCustomDate &&
                                            selectedCustomDate.getDate() === day &&
                                            selectedCustomDate.getMonth() === currentCalView.getMonth() &&
                                            selectedCustomDate.getFullYear() === currentCalView.getFullYear();
                                        return (
                                            <Pressable
                                                key={day}
                                                style={[styles.calDayCell, isSelected && styles.calDayActive]}
                                                onPress={() => {
                                                    const d = new Date(currentCalView.getFullYear(), currentCalView.getMonth(), day);
                                                    handleCustomDateSelect(d);
                                                }}
                                            >
                                                <Text style={[styles.calDayText, isSelected && styles.calDayTextActive]}>{day}</Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </View>
                        </View>
                    </Pressable>
                </Modal>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f8fafc' },
    container: { flex: 1, paddingHorizontal: 22 },

    // Header Premium Design
    headerGradient: {
        backgroundColor: '#000',
        paddingBottom: 24,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        paddingTop: Platform.OS === 'ios' ? 0 : 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10
    },
    topNav: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 22,
        paddingTop: 16,
        paddingBottom: 12
    },
    navIcon: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    navTitleBox: {
        flex: 1,
        marginLeft: 16
    },
    navTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: -0.5
    },
    navSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '600',
        marginTop: 2
    },
    searchRow: {
        paddingHorizontal: 22,
        marginTop: 12
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 52,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)'
    },
    searchInputPremium: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
        paddingHorizontal: 10,
        height: '100%',
        backgroundColor: 'transparent',
        borderWidth: 0
    },
    clearIcon: {
        padding: 4
    },
    filterTrigger: {
        marginLeft: 12,
        padding: 4
    },
    actionHeaderPremium: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 22,
        marginTop: 16,
        paddingBottom: 4 // Space for horizontal scroll
    },
    premiumPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 14,
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    premiumPillDanger: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgba(239, 68, 68, 0.2)'
    },
    premiumPillText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#fff'
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end'
    },
    filterModal: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
        maxHeight: '70%'
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0f172a'
    },
    modalCloseBtn: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    modalScroll: {
        padding: 16
    },
    filterItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 16,
        marginBottom: 8
    },
    activeFilterItem: {
        backgroundColor: '#f8fafc'
    },
    filterItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    filterItemLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#64748b'
    },
    activeFilterItemLabel: {
        color: '#000',
        fontWeight: '800'
    },

    // Premium Calendar Styles
    calendarModalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    premiumCal: {
        backgroundColor: '#fff',
        borderRadius: 32,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.15,
        shadowRadius: 30,
        elevation: 10,
        width: '100%',
        maxWidth: 400
    },
    calTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24
    },
    calNav: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16
    },
    calMonthLabel: {
        fontSize: 16,
        fontWeight: '900',
        color: '#000',
        minWidth: 120,
        textAlign: 'center'
    },
    calNavBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9'
    },
    calClose: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center'
    },
    calWeekRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 12
    },
    calWeekText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#94a3b8',
        width: 40,
        textAlign: 'center'
    },
    calGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start'
    },
    calDayCell: {
        width: '14.28%',
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 2
    },
    calDayActive: {
        backgroundColor: '#000',
        borderRadius: 14
    },
    calDayText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#000'
    },
    calDayTextActive: {
        color: '#fff',
        fontWeight: '900'
    },

    // Lists
    listPadding: { paddingTop: 24, paddingBottom: 40 },
    invoiceCard: {
        marginBottom: 16,
        borderRadius: 24,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
    },
    cardContent: {
        padding: 20,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    invoiceId: {
        fontSize: 11,
        fontWeight: '800',
        color: '#666',
        letterSpacing: 0.5,
        marginBottom: 4,
        textTransform: 'uppercase'
    },
    customerName: {
        fontSize: 17,
        fontWeight: '800',
        color: '#000',
        marginBottom: 4,
        letterSpacing: -0.5
    },
    dateText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#9ca3af'
    },
    amount: {
        fontSize: 20,
        fontWeight: '900',
        color: '#000'
    },

    // Actions
    actionRow: {
        flexDirection: 'row',
        gap: 12,
    },
    restoreBtn: {
        flex: 1,
        height: 48,
        backgroundColor: '#000',
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    restoreText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1
    },
    deleteBtn: {
        flex: 1,
        height: 48,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#000',
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    deleteText: {
        color: '#000',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1
    },

    // Empty State
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 60
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#000',
        marginBottom: 8
    },
    emptySub: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        maxWidth: 250,
        lineHeight: 22
    }
});
