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
    Filter,
    Calendar,
    Clock,
    Globe,
    ChevronRight,
    ChevronLeft as ChevronLeftIcon,
    ChevronRight as ChevronRightIcon,
    Package,
    FileText,
    TrendingDown,
    Layers,
    AlertCircle,
    Info
} from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { useTransactions } from '../../context/TransactionContext';
import { useProducts } from '../../context/ProductContext';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { useToast } from '../../context/ToastContext';
import { LinearGradient } from 'expo-linear-gradient';

export default function RecycleBinPage() {
    const navigation = useNavigation();
    const { fetchDeletedTransactions, restoreTransaction, permanentlyDeleteTransaction, restoreAllInvoices, emptyRecycleBin } = useTransactions();
    const { fetchDeletedProducts, restoreProduct, permanentlyDeleteProduct } = useProducts();
    const { showToast } = useToast();

    const [activeTab, setActiveTab] = useState('invoices');
    const [deletedInvoices, setDeletedInvoices] = useState([]);
    const [deletedProducts, setDeletedProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Date Filter State
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

    const stats = React.useMemo(() => {
        const invTotal = deletedInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
        return {
            invCount: deletedInvoices.length,
            invTotal,
            prodCount: deletedProducts.length,
            totalItems: deletedInvoices.length + deletedProducts.length
        };
    }, [deletedInvoices, deletedProducts]);

    const loadDeleted = async () => {
        setLoading(true);
        try {
            const [invoices, products] = await Promise.all([
                fetchDeletedTransactions(),
                fetchDeletedProducts()
            ]);
            setDeletedInvoices(invoices || []);
            setDeletedProducts(products || []);
        } catch (err) {
            showToast("Failed to load deleted items", "error");
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

    const handleRestore = (item) => {
        const isInvoice = activeTab === 'invoices';
        setConfirmModal({
            isOpen: true,
            title: isInvoice ? "RESTORE INVOICE" : "RESTORE PRODUCT",
            message: isInvoice 
                ? `Restore Invoice #${item.invoiceNumber || item.id}?\n\nInventory stock will be deducted again upon restoration.`
                : `Restore Product: ${item.name}?\n\nThis will add it back to your active inventory.`,
            variant: 'info',
            confirmLabel: 'RESTORE',
            cancelLabel: 'CANCEL',
            onConfirm: async () => {
                try {
                    if (isInvoice) {
                        await restoreTransaction(item.id);
                        showToast("Invoice restored", "success");
                    } else {
                        await restoreProduct(item.id);
                        showToast("Product restored", "success");
                    }
                    loadDeleted();
                } catch (err) {
                    showToast("Restoration failed", "error");
                }
            }
        });
    };

    const handlePermanentDelete = (item) => {
        const isInvoice = activeTab === 'invoices';
        setConfirmModal({
            isOpen: true,
            title: isInvoice ? "DELETE PERMANENTLY" : "DELETE PRODUCT",
            message: isInvoice
                ? `This action cannot be undone. Invoice #${item.invoiceNumber || item.id} will be lost forever.`
                : `Delete ${item.name} permanently?\n\nAll tracking and variants will be wiped forever!`,
            variant: 'danger',
            confirmLabel: 'DELETE FOREVER',
            cancelLabel: 'CANCEL',
            onConfirm: async () => {
                try {
                    if (isInvoice) {
                        await permanentlyDeleteTransaction(item.id);
                        showToast("Invoice deleted permanently", "trash");
                    } else {
                        await permanentlyDeleteProduct(item.id);
                        showToast(`"${item.name}" wiped forever`, "trash");
                    }
                    loadDeleted();
                } catch (err) {
                    showToast("Deletion failed", "error");
                }
            }
        });
    };

    const handleRestoreAll = () => {
        const itemsToRestore = activeTab === 'invoices' ? deletedInvoices : deletedProducts;
        if (itemsToRestore.length === 0) return;

        setConfirmModal({
            isOpen: true,
            title: `RESTORE ALL ${activeTab.toUpperCase()}`,
            message: `Are you sure you want to restore all ${itemsToRestore.length} ${activeTab}?`,
            variant: 'info',
            confirmLabel: 'RESTORE ALL',
            cancelLabel: 'CANCEL',
            onConfirm: async () => {
                try {
                    if (activeTab === 'invoices') {
                        await restoreAllInvoices();
                    } else {
                        for (const p of deletedProducts) {
                            await restoreProduct(p.id);
                        }
                    }
                    showToast(`All ${activeTab} restored`, "success");
                    loadDeleted();
                } catch (err) {
                    showToast("Restoration failed", "error");
                }
            }
        });
    };

    const handleEmptyBin = () => {
        const itemsInBin = activeTab === 'invoices' ? deletedInvoices : deletedProducts;
        if (itemsInBin.length === 0) return;

        setConfirmModal({
            isOpen: true,
            title: `EMPTY ${activeTab.toUpperCase()} BIN`,
            message: `WARNING: This will permanently delete all ${activeTab} in the trash. This action cannot be undone.`,
            variant: 'danger',
            confirmLabel: 'EMPTY BIN',
            cancelLabel: 'CANCEL',
            onConfirm: async () => {
                try {
                    if (activeTab === 'invoices') {
                        await emptyRecycleBin();
                    } else {
                        for (const p of deletedProducts) {
                            await permanentlyDeleteProduct(p.id);
                        }
                    }
                    showToast(`Recycle bin empty for ${activeTab}`, "trash");
                    loadDeleted();
                } catch (err) {
                    showToast("Failed to empty bin", "error");
                }
            }
        });
    };

    const changePeriod = (p) => {
        setPeriod(p);
        setIsFilterOpen(false);
    };

    const handleCustomDateSelect = (date) => {
        setSelectedCustomDate(date);
        setPeriod('Custom');
        setIsCalendarOpen(false);
    };

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const calendarHeader = currentCalView.toLocaleString('default', { month: 'long', year: 'numeric' });
    const daysArr = Array.from({ length: getDaysInMonth(currentCalView.getFullYear(), currentCalView.getMonth()) }, (_, i) => i + 1);
    const startPadding = Array.from({ length: getFirstDayOfMonth(currentCalView.getFullYear(), currentCalView.getMonth()) });

    const shiftMonth = (offset) => {
        const newDate = new Date(currentCalView.getFullYear(), currentCalView.getMonth() + offset, 1);
        setCurrentCalView(newDate);
    };

    const filteredItems = (activeTab === 'invoices' ? deletedInvoices : deletedProducts).filter(item => {
        let matchesSearch = false;
        if (activeTab === 'invoices') {
            const invId = item.id || '';
            const weeklyNo = item.weekly_sequence?.toString() || '';
            const customer = item.customer_name || item.customerName || '';
            matchesSearch = invId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                weeklyNo.includes(searchTerm) ||
                customer.toLowerCase().includes(searchTerm.toLowerCase());
        } else {
            const name = item.name || '';
            const sku = item.sku || '';
            matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                sku.toLowerCase().includes(searchTerm.toLowerCase());
        }

        let matchesDateFilter = true;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const itemDate = new Date(item.date || item.updated_at || item.created_at);

        if (period === 'Today') {
            matchesDateFilter = itemDate >= startOfToday;
        } else if (period === 'Yesterday') {
            const yesterday = new Date(startOfToday);
            yesterday.setDate(yesterday.getDate() - 1);
            matchesDateFilter = itemDate >= yesterday && itemDate < startOfToday;
        } else if (period === 'This Week') {
            const startOfWeek = new Date(startOfToday);
            startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
            matchesDateFilter = itemDate >= startOfWeek;
        } else if (period === 'This Month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            matchesDateFilter = itemDate >= startOfMonth;
        } else if (period === 'This Year') {
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            matchesDateFilter = itemDate >= startOfYear;
        } else if (period === 'All Time') {
            matchesDateFilter = true;
        } else if (period === 'Custom' && selectedCustomDate) {
            const targetDate = new Date(selectedCustomDate);
            targetDate.setHours(0, 0, 0, 0);
            const endDate = new Date(targetDate);
            endDate.setDate(targetDate.getDate() + 1);
            matchesDateFilter = itemDate >= targetDate && itemDate < endDate;
        }

        return matchesSearch && matchesDateFilter;
    });

    const renderRecordItem = ({ item }) => {
        const isInvoice = activeTab === 'invoices';
        const deletedDate = new Date(item.updated_at || item.created_at || Date.now());
        
        let itemCount = 0;
        if (isInvoice) {
            try {
                const items = typeof item.items === 'string' ? JSON.parse(item.items) : (item.items || []);
                itemCount = items.length;
            } catch (e) { itemCount = 0; }
        }

        return (
            <View style={styles.invoiceCard}>
                <View style={styles.cardMain}>
                    <View style={styles.cardHeader}>
                        <View style={{ flex: 1 }}>
                            <View style={styles.rowCentered}>
                                <Text style={styles.invoiceId}>{isInvoice ? (item.invoiceNumber || item.id?.toString().slice(-6).toUpperCase()) : (item.sku || 'SKU N/A')}</Text>
                                <View style={styles.metaBadge}>
                                    <Clock size={11} color="#64748b" />
                                    <Text style={styles.metaBadgeText}>{deletedDate.toLocaleDateString()}</Text>
                                </View>
                            </View>
                            <Text style={styles.recordName} numberOfLines={1}>{isInvoice ? (item.customer_name || item.customerName || 'Guest') : (item.name || 'Untitled Product')}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.amount}>₹{(isInvoice ? item.total : item.price || 0).toLocaleString()}</Text>
                            <Text style={styles.deletedAtLabel}>Trashed {deletedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                        </View>
                    </View>

                    <View style={styles.tagRow}>
                        {isInvoice ? (
                            <>
                                <View style={styles.subTag}>
                                    <Layers size={11} color="#64748b" />
                                    <Text style={styles.subTagText}>{itemCount} items</Text>
                                </View>
                                <View style={[styles.subTag, { backgroundColor: '#f0fdf4' }]}>
                                    <Text style={[styles.subTagText, { color: '#16a34a' }]}>{item.type || 'Retail'}</Text>
                                </View>
                            </>
                        ) : (
                            <>
                                <View style={styles.subTag}>
                                    <Package size={11} color="#64748b" />
                                    <Text style={styles.subTagText}>{item.category || 'General'}</Text>
                                </View>
                                <View style={[styles.subTag, item.stock <= 5 ? { backgroundColor: '#fef2f2' } : { backgroundColor: '#f8fafc' }]}>
                                    <Text style={[styles.subTagText, item.stock <= 5 && { color: '#dc2626' }]}>Stock: {item.stock || 0}</Text>
                                </View>
                            </>
                        )}
                    </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.actionRowCompact}>
                    <TouchableOpacity
                        onPress={() => handleRestore(item)}
                        style={styles.actionBtnSmall}
                        activeOpacity={0.7}
                    >
                        <RotateCcw size={16} color="#000" strokeWidth={2.5} />
                        <Text style={styles.actionBtnTextSmall}>Restore</Text>
                    </TouchableOpacity>

                    <View style={styles.verticalDivider} />

                    <TouchableOpacity
                        onPress={() => handlePermanentDelete(item)}
                        style={styles.actionBtnSmall}
                        activeOpacity={0.6}
                    >
                        <Trash2 size={16} color="#ef4444" strokeWidth={2.5} />
                        <Text style={[styles.actionBtnTextSmall, { color: '#ef4444' }]}>Delete</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.safeArea}>
            <LinearGradient colors={['#000', '#111']} style={styles.headerGradient}>
                <SafeAreaView edges={['top']}>
                    <View style={styles.headerTop}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                            <ChevronLeftIcon size={24} color="#fff" />
                        </TouchableOpacity>
                        <View style={{ flex: 1, marginLeft: 16 }}>
                            <Text style={styles.navTitle}>Recycle Bin</Text>
                            <Text style={styles.navSubtitle}>{filteredItems.length} items found</Text>
                        </View>
                        
                        {/* Header Actions */}
                        <View style={styles.headerActionsTop}>
                            <TouchableOpacity onPress={handleRestoreAll} style={styles.headerIconBtn}>
                                <RotateCcw size={20} color="#fff" strokeWidth={2.5} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleEmptyBin} style={[styles.headerIconBtn, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                                <Trash2 size={20} color="#ef4444" strokeWidth={2.5} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setIsCalendarOpen(true)} style={[styles.headerIconBtn, isCalendarOpen && { backgroundColor: '#fff' }]}>
                                <Calendar size={20} color={isCalendarOpen ? "#000" : "#fff"} strokeWidth={2.5} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Stats Highlights */}
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statVal}>{stats.totalItems}</Text>
                            <Text style={styles.statLabel}>Items</Text>
                        </View>
                        <View style={[styles.statItem, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.2)' }]}>
                            <Text style={[styles.statVal, { color: '#ef4444' }]}>
                                ₹{stats.invTotal < 1000 ? stats.invTotal.toLocaleString() : (stats.invTotal / 1000).toFixed(1) + 'k'}
                            </Text>
                            <Text style={styles.statLabel}>Value</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statVal}>{stats.prodCount}</Text>
                            <Text style={styles.statLabel}>Products</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statVal}>{stats.invCount}</Text>
                            <Text style={styles.statLabel}>Invoices</Text>
                        </View>
                    </View>

                    {/* Tab Switcher */}
                    <View style={styles.tabContainer}>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'invoices' && styles.activeTab]}
                            onPress={() => setActiveTab('invoices')}
                        >
                            <FileText size={16} color={activeTab === 'invoices' ? '#000' : '#fff'} />
                            <Text style={[styles.tabText, activeTab === 'invoices' && styles.activeTabText]}>Invoices</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'products' && styles.activeTab]}
                            onPress={() => setActiveTab('products')}
                        >
                            <Package size={16} color={activeTab === 'products' ? '#000' : '#fff'} />
                            <Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>Products</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.searchRow}>
                        <View style={styles.searchBox}>
                            <Search size={18} color="rgba(255,255,255,0.45)" strokeWidth={2.5} />
                            <Input
                                style={styles.searchInputPremium}
                                placeholder={`Search deleted ${activeTab}...`}
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

                    
                </SafeAreaView>
            </LinearGradient>

            <View style={styles.container}>
                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color="#000" />
                    </View>
                ) : filteredItems.length === 0 ? (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconCircle}>
                            <Trash2 size={40} color="#000" />
                        </View>
                        <Text style={styles.emptyTitle}>{activeTab === 'invoices' ? 'No Invoices' : 'No Products'} in Bin</Text>
                        <Text style={styles.emptySub}>Items moved to trash will appear here. Emptying the bin will permanently delete all records.</Text>
                    </View>
                ) : (
                    <>
                        {/* Info Tooltip */}
                        {/* <View style={styles.infoStrip}>
                            <Info size={18} color="#0369a1" />
                            <Text style={styles.infoStripText}>
                                Items in the bin can be restored back to your active list. Permanent deletion cannot be undone.
                            </Text>
                        </View> */}

                        <FlatList
                            data={filteredItems}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={renderRecordItem}
                            contentContainerStyle={styles.listPadding}
                            showsVerticalScrollIndicator={false}
                        />
                    </>
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
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 22,
        paddingTop: 16,
        paddingBottom: 12
    },
    backBtn: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
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
    statsRow: {
        flexDirection: 'row',
        paddingHorizontal: 22,
        marginTop: 14,
        gap: 8,
        marginBottom: 10
    },
    statItem: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 14,
        paddingVertical: 12,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.08)'
    },
    statVal: {
        fontSize: 16,
        fontWeight: '900',
        color: '#fff'
    },
    statLabel: {
        fontSize: 9,
        fontWeight: '800',
        color: 'rgba(255,255,255,0.45)',
        textTransform: 'uppercase',
        marginTop: 2,
        letterSpacing: 0.5
    },

    tabContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        marginHorizontal: 22,
        padding: 6,
        marginBottom: 16
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 12,
        gap: 8
    },
    activeTab: {
        backgroundColor: '#fff',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.6)'
    },
    activeTabText: {
        color: '#000'
    },

    searchRow: {
        paddingHorizontal: 22,
        marginTop: 0
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
        paddingBottom: 4
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
        marginBottom: 12,
    },
    invoiceId: {
        fontSize: 11,
        fontWeight: '800',
        color: '#666',
        letterSpacing: 0.5,
        marginBottom: 4,
        textTransform: 'uppercase'
    },
    recordName: {
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
    rowCentered: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4
    },
    metaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4
    },
    metaBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#64748b'
    },
    tagRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 4
    },
    subTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#f8fafc'
    },
    subTagText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b'
    },
    deletedAtLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#94a3b8',
        marginTop: 2
    },

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
    headerActionsTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerIconBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    cardMain: {
        paddingTop: 14,
        paddingBottom: 4,
        paddingHorizontal: 20
    },
    divider: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginHorizontal: 0
    },
    verticalDivider: {
        width: 1,
        height: '60%',
        backgroundColor: '#f1f5f9'
    },
    actionRowCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 48,
        backgroundColor: '#000',
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24
    },
    actionBtnSmall: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: '100%',
    },
    actionBtnTextSmall: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '800'
    },

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
    },
    infoStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f9ff',
        padding: 12,
        borderRadius: 16,
        gap: 10,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#bae6fd'
    },
    infoStripText: {
        fontSize: 12,
        color: '#0369a1',
        fontWeight: '700',
        flex: 1,
    }
});
