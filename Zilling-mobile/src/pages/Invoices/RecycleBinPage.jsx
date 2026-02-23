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
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
    Search,
    RotateCcw,
    Trash2,
    ChevronLeft,
    X,
    History
} from 'lucide-react-native';
import { Input } from '../../components/ui/Input';
import { useTransactions } from '../../context/TransactionContext';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { useToast } from '../../context/ToastContext';

export default function RecycleBinPage() {
    const navigation = useNavigation();
    const { fetchDeletedTransactions, restoreTransaction, permanentlyDeleteTransaction, restoreAllInvoices, emptyRecycleBin } = useTransactions();
    const { showToast } = useToast();
    const [deletedInvoices, setDeletedInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

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
            StatusBar.setBarStyle('dark-content');
            if (Platform.OS === 'android') StatusBar.setBackgroundColor('#ffffff');
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

    const filteredInvoices = deletedInvoices.filter(inv => {
        const invId = inv.id || '';
        const weeklyNo = inv.weekly_sequence?.toString() || '';
        const customer = inv.customer_name || inv.customerName || '';
        return invId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            weeklyNo.includes(searchTerm) ||
            customer.toLowerCase().includes(searchTerm.toLowerCase());
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
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <ChevronLeft size={32} color="#000" strokeWidth={2} />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.title}>Recycle Bin</Text>
                        <Text style={styles.subtitle}>{deletedInvoices.length} items in trash</Text>
                    </View>
                </View>

                <View style={styles.actionHeader}>
                    {deletedInvoices.length > 0 && (
                        <>
                            <TouchableOpacity onPress={handleRestoreAll} style={styles.pillBtn}>
                                <RotateCcw size={14} color="#000" />
                                <Text style={styles.pillText}>Restore All</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleEmptyBin} style={[styles.pillBtn, styles.pillDanger]}>
                                <Trash2 size={14} color="#ef4444" />
                                <Text style={[styles.pillText, { color: '#ef4444' }]}>Empty Bin</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                {/* Search */}
                <View style={styles.searchWrapper}>
                    <Search size={20} color="#000" strokeWidth={2} />
                    <Input
                        style={styles.searchInput}
                        placeholder="Search deleted invoices..."
                        placeholderTextColor="#666"
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                        selectionColor="#000"
                    />
                    {searchTerm.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchTerm('')}>
                            <X size={18} color="#000" />
                        </TouchableOpacity>
                    )}
                </View>

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
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#ffffff' },
    container: { flex: 1, paddingHorizontal: 20 },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 24,
        gap: 16
    },
    backBtn: {
        padding: 0,
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: '#000',
        letterSpacing: -1,
        lineHeight: 32
    },
    subtitle: {
        fontSize: 13,
        color: '#666',
        fontWeight: '600',
        marginTop: 2
    },
    actionHeader: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    pillBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
        borderWidth: 1,
        borderColor: '#e5e7eb'
    },
    pillDanger: {
        backgroundColor: '#fef2f2',
        borderColor: '#fee2e2'
    },
    pillText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#000'
    },

    // Search
    searchWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 52,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#e5e7eb'
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
        paddingHorizontal: 10,
        height: '100%',
        borderWidth: 0,
        backgroundColor: 'transparent'
    },

    // Lists
    listPadding: { paddingBottom: 40 },
    invoiceCard: {
        marginBottom: 16,
        borderRadius: 16,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        // Subtle shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
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
