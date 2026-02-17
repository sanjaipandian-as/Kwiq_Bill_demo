import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Modal,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  Search,
  FileText,
  TrendingUp,
  Clock,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Download,
  Share2,
  Plus,
  X,
  Trash2,
  Recycle,
  Eye,
  Calendar,
  CalendarDays,
  ChevronDown,
  Filter,
  Globe,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  LayoutGrid
} from 'lucide-react-native';

import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useSettings } from '../../context/SettingsContext';
import { printReceipt, shareReceiptPDF } from '../../utils/printUtils';
import { useTransactions } from '../../context/TransactionContext';
import { Card } from '../../components/ui/Card';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { useToast } from '../../context/ToastContext';

import { LinearGradient } from 'expo-linear-gradient';

export default function InvoicesPage() {
  const navigation = useNavigation();
  const { transactions, loading, fetchTransactions, updateTransaction, addTransaction, deleteTransaction, clearAllTransactions } = useTransactions();
  const { showToast } = useToast();
  // Using direct DB access for customer lookup to avoid context overhead or circular deps if any
  const { db } = require('../../services/database');
  const { settings } = useSettings(); // Get settings for print/share
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  // Date Filter State - GST Analytics Style
  const [period, setPeriod] = useState('All Time');
  const [selectedCustomDate, setSelectedCustomDate] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Calendar State
  const [currentCalView, setCurrentCalView] = useState(new Date());

  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [isDetailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    variant: 'danger',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel'
  });

  useFocusEffect(
    useCallback(() => {
      fetchTransactions();
    }, [])
  );

  const handlePreview = async (invoice) => {
    try {
      const billData = {
        ...invoice,
        id: invoice.id,
        weekly_sequence: invoice.weekly_sequence,
        cart: invoice.items || [],
        totals: {
          total: invoice.total || 0,
          subtotal: invoice.subtotal || 0,
          tax: invoice.tax || 0,
          discount: invoice.discount || 0,
          additionalCharges: invoice.additionalCharges || 0,
          roundOff: invoice.roundOff || 0
        },
        customer: {
          name: invoice.customerName
        },
        date: invoice.date
      };

      // Force A4 for System Preview (Invoice Mode)
      // This ensures we see the "Invoice Template" view, not the Thermal Bill view
      await printReceipt(billData, 'A4', settings);
    } catch (error) {
      console.error("Preview Error:", error);
      showToast("Failed to preview invoice", "error");
    }
  };

  const handleShare = async (invoice) => {
    try {
      // Map for print utility
      const billData = {
        ...invoice,
        id: invoice.id,
        weekly_sequence: invoice.weekly_sequence,
        cart: invoice.items || [],
        totals: {
          total: invoice.total || 0,
          subtotal: invoice.subtotal || 0,
          tax: invoice.tax || 0,
          discount: invoice.discount || 0,
          additionalCharges: invoice.additionalCharges || 0,
          roundOff: invoice.roundOff || 0
        },
        customer: {
          name: invoice.customerName
        },
        date: invoice.date
      };

      // Force A4/Template for Invoice Share (Internal Record)
      const invoiceSettings = {
        ...settings,
        invoice: {
          ...settings.invoice,
          paperSize: 'A4' // Force A4 to use the selected Template (Classic, GST, etc.)
        }
      };

      await shareReceiptPDF(billData, invoiceSettings);
    } catch (error) {
      console.error("Share Error:", error);
      showToast("Failed to share invoice", "error");
    }
  };

  const handleDelete = (invoice) => {
    setConfirmModal({
      isOpen: true,
      title: "MOVE TO RECYCLE BIN",
      message: `Are you sure you want to delete Invoice #${invoice.invoiceNumber || invoice.id}?\n\n` +
        "• Inventory stock will be automatically RESTORED.\n" +
        "• You can recover this invoice from the Recycle Bin later.",
      variant: 'danger',
      confirmLabel: 'MOVE TO BIN',
      cancelLabel: 'KEEP',
      onConfirm: async () => {
        try {
          await deleteTransaction(invoice.id);
          setDetailModalVisible(false);
          showToast("Moved to Recycle Bin", "success");
        } catch (err) {
          showToast("Delete failed", "error");
        }
      }
    });
  };

  const handleClearAll = () => {
    setConfirmModal({
      isOpen: true,
      title: "☢️ WIPE ALL DATA?",
      message: "Are you absolutely certain? This will PERMANENTLY delete every single invoice from this device.\n\n" +
        "⚠️ NOTE: Bulk clearing invoices does NOT automatically restore stock for all items. Use individual deletes if you need stock restoration.\n\n" +
        "This action cannot be undone.",
      variant: 'danger',
      confirmLabel: 'WIPE ALL DATA',
      cancelLabel: 'Cancel',
      onConfirm: async () => {
        try {
          await clearAllTransactions();
          showToast("All invoices cleared successfully", "success");
        } catch (err) {
          showToast("Failed to clear invoices", "error");
        }
      }
    });
  };

  // Date Filter Functions - GST Analytics Style
  const changePeriod = (p) => {
    setPeriod(p);
    setIsFilterOpen(false);
  };

  const handleCustomDateSelect = (date) => {
    setSelectedCustomDate(date);
    setPeriod('Custom');
    setIsCalendarOpen(false);
  };

  const getPeriodLabel = () => {
    if (period === 'Custom' && selectedCustomDate) {
      const d = new Date(selectedCustomDate);
      return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
    }
    return period;
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

  const handleAddPress = () => {
    setEditingInvoice({
      id: `NEW-${Date.now()}`,
      customerName: '',
      total: 0,
      status: 'PAID',
      date: new Date().toISOString()
    });
    setEditModalVisible(true);
  };

  const handleInvoicePress = (invoice) => {
    // Lookup customer details if not present
    let fullCustomer = null;
    try {
      if (invoice.customerId) {
        const res = db.getAllSync('SELECT * FROM customers WHERE id = ?', [invoice.customerId]);
        if (res && res.length > 0) fullCustomer = res[0];
      } else if (invoice.customerName && invoice.customerName !== 'Guest') {
        // Fallback by name
        const res = db.getAllSync('SELECT * FROM customers WHERE name = ?', [invoice.customerName]);
        if (res && res.length > 0) fullCustomer = res[0];
      }
    } catch (e) { console.log("Cust Lookup Error", e); }

    setSelectedInvoice({ ...invoice, fullCustomer });
    setDetailModalVisible(true);
  };

  const handleEditPress = (invoice) => {
    // If coming from details modal, close it first or keep it? 
    // Usually editing replaces details.
    setDetailModalVisible(false);
    setEditingInvoice({ ...invoice });
    setEditModalVisible(true);
  };

  // ... (handleSaveEdit remains same)
  const handleSaveEdit = async () => {
    try {
      const targetId = editingInvoice.id || editingInvoice._id;
      const isNew = !targetId || targetId.toString().startsWith('NEW-');

      // Ensure we have a clean string for the name
      const finalName = editingInvoice.customerName && editingInvoice.customerName.trim() !== ''
        ? editingInvoice.customerName
        : 'Guest';

      if (isNew) {
        await addTransaction({
          ...editingInvoice,
          id: undefined, // Let DB generate ID
          customerName: finalName,
          date: new Date().toISOString()
        });
      } else {
        // Pass the object exactly as the Context expects it
        await updateTransaction({
          ...editingInvoice,
          id: targetId,
          customerName: finalName
        });
      }

      setEditModalVisible(false);
      fetchTransactions();
    } catch (error) {
      console.error("Save Error:", error);
      alert("Error saving: " + error.message);
    }
  };

  // Date filtering logic - GST Analytics Style
  const filteredInvoices = transactions.filter(inv => {
    const invId = inv.id || '';
    const weeklyNo = inv.weekly_sequence?.toString() || '';
    const customer = inv.customerName || inv.customer || '';
    const matchesSearch = invId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      weeklyNo.includes(searchTerm) ||
      customer.toLowerCase().includes(searchTerm.toLowerCase());
    const status = inv.status ? (inv.status.charAt(0) + inv.status.slice(1).toLowerCase()) : 'Pending';
    const matchesStatusFilter = activeFilter === 'All' || status === activeFilter;

    // Date filtering - GST Analytics Style
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

    return matchesSearch && matchesStatusFilter && matchesDateFilter;
  });

  const getStatusStyle = (status) => {
    switch (status?.toUpperCase()) {
      case 'PAID': return { bg: '#dcfce7', border: '#dcfce7', text: '#15803d', icon: CheckCircle2, label: 'PAID' };
      case 'UNPAID': return { bg: '#fee2e2', border: '#fee2e2', text: '#b91c1c', icon: Clock, label: 'UNPAID' };
      default: return { bg: '#f1f5f9', border: '#f1f5f9', text: '#475569', icon: FileText, label: (status || 'Unknown').toUpperCase() };
    }
  };

  const stats = [
    { label: 'Total Revenue', value: `₹${transactions.reduce((sum, t) => sum + (t.total || 0), 0).toLocaleString()}`, icon: TrendingUp, color: '#000000', bg: '#f8fafc' },
    { label: 'Unpaid', value: `₹${transactions.filter(t => t.status !== 'PAID').reduce((sum, t) => sum + (t.balance || 0), 0).toLocaleString()}`, icon: Clock, color: '#ef4444', bg: '#fffafa' },
    { label: 'Paid', value: `₹${transactions.filter(t => t.status === 'PAID').reduce((sum, t) => sum + (t.total || 0), 0).toLocaleString()}`, icon: CheckCircle2, color: '#15803d', bg: '#dcfce7' },
  ];

  const handlePrint = async (invoice) => {
    try {
      // Adapt invoice data for print templates
      const billData = {
        ...invoice,
        id: invoice.id,
        weekly_sequence: invoice.weekly_sequence,
        items: invoice.items || [], // IMPORTANT
        customerName: invoice.customerName || 'Guest',
        date: invoice.date,
        total: invoice.total,
        subtotal: invoice.subtotal || 0,
        tax: invoice.tax || 0,
        discount: invoice.discount || 0,
        additionalCharges: invoice.additionalCharges || 0,
        roundOff: invoice.roundOff || 0,
        internalNotes: invoice.internalNotes || '',
      };

      await printReceipt(billData, settings);
    } catch (err) {
      console.error('Print error', err);
      alert('Failed to print invoice');
    }
  };


  const renderInvoiceItem = ({ item }) => {
    const status = getStatusStyle(item.status);

    return (
      <Pressable
        style={styles.invoiceCard}
        onPress={() => handleInvoicePress(item)}
        onLongPress={() => handleDelete(item)}
        delayLongPress={600} // Slightly faster response
      >
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.customerName} numberOfLines={1}>{item.customerName || 'Guest'}</Text>
            <Text style={styles.invoiceMeta}>
              #{item.invoiceNumber || item.id?.toString().slice(-6).toUpperCase() || 'TEMP'}  •  {new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amount}>₹{(item.total || 0).toLocaleString()}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardFooterRow}>
          <View style={[styles.statusPill, { backgroundColor: status.bg, borderColor: status.border }]}>
            <View style={[styles.statusDot, { backgroundColor: status.text }]} />
            <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity onPress={() => handlePrint(item)} style={styles.actionIconBtn}>
              <Download size={18} color="#475569" strokeWidth={2} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => handleShare(item)} style={styles.actionIconBtn}>
              <Share2 size={18} color="#475569" strokeWidth={2} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handlePreview(item)}
              style={styles.previewBtn}
            >
              <Text style={styles.previewBtnText}>Open</Text>
              <ChevronRight size={14} color="#fff" strokeWidth={3} />
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <View style={styles.headerWrapper}>
        <LinearGradient
          colors={['#000000', '#0a0a0a']} // Black gradient for curved header
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={['top']}>
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtnWrapper}>
                  <ChevronLeft size={24} color="#fff" />
                </Pressable>
                <Text style={styles.title}>Invoices</Text>
              </View>
            <View style={styles.headerActions}>
                <Pressable
                  style={[styles.iconBtnDark, period === 'Custom' && styles.iconBtnDarkActive]}
                  onPress={() => setIsCalendarOpen(true)}
                >
                  <Calendar size={18} color={period === 'Custom' ? '#fff' : '#0f172a'} />
                </Pressable>
                <Pressable style={styles.iconBtnDark} onPress={() => setIsFilterOpen(true)}>
                  <Filter size={18} color="#0f172a" />
                </Pressable>
                <Pressable style={styles.iconBtnDark} onPress={handleAddPress}>
                  <Plus size={20} color="#0f172a" />
                </Pressable>
              </View>
            </View>

            <View style={styles.searchContainer}>
              <View style={styles.searchBar}>
                <Search size={18} color="#64748b" />
                <Input
                  style={styles.searchInputCustom}
                  placeholder="Search invoices..."
                  placeholderTextColor="#94a3b8"
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                />
              </View>
            </View>

            {/* Status Filter Row */}
            <View style={styles.filterRow}>
              {['All', 'Paid', 'Unpaid'].map(status => {
                const isActive = activeFilter === status;
                return (
                  <Pressable
                    key={status}
                    style={[styles.filterBtn, isActive ? styles.filterBtnActive : styles.filterBtnInactive]}
                    onPress={() => setActiveFilter(status)}
                  >
                    <Text style={[styles.filterText, isActive ? styles.filterTextActive : styles.filterTextInactive]}>{status}</Text>
                  </Pressable>
                );
              })}

              <Pressable
                style={[styles.filterBtn, styles.recycleBtn]}
                onPress={() => navigation.navigate('RecycleBin')}
              >
                <Recycle size={14} color="#ef4444" />
                <Text style={styles.recycleText}>Recycle Bin</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>

      <FlatList
        data={filteredInvoices}
        keyExtractor={(item, index) => item.id ? item.id.toString() : `inv-${index}`}
        renderItem={renderInvoiceItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* --- DETAILS MODAL --- */}
      <Modal visible={isDetailModalVisible} animationType="slide" transparent={true} onRequestClose={() => setDetailModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIndicator} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invoice Summary</Text>
              <Pressable onPress={() => setDetailModalVisible(false)}><X size={24} color="#000" /></Pressable>
            </View>

            {selectedInvoice && (
              <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
                {/* Status & ID Header */}
                <View style={styles.summaryTopCard}>
                  <View style={styles.summaryTopMain}>
                    <View>
                      <Text style={styles.summaryIdLabel}>INVOICE NO</Text>
                      <Text style={styles.summaryIdValue}>{selectedInvoice.invoiceNumber || selectedInvoice.id}</Text>
                    </View>
                    <View style={[
                      styles.modernStatusBadge,
                      { backgroundColor: selectedInvoice.status === 'PAID' ? '#ecfdf5' : '#fef2f2' }
                    ]}>
                      <View style={[
                        styles.statusDot,
                        { backgroundColor: selectedInvoice.status === 'PAID' ? '#10b981' : '#ef4444' }
                      ]} />
                      <Text style={[
                        styles.modernStatusText,
                        { color: selectedInvoice.status === 'PAID' ? '#059669' : '#dc2626' }
                      ]}>{selectedInvoice.status}</Text>
                    </View>
                  </View>

                  <View style={styles.summaryMetaRow}>
                    <View style={styles.metaItem}>
                      <Clock size={14} color="#64748b" />
                      <Text style={styles.metaText}>{new Date(selectedInvoice.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <TrendingUp size={14} color="#64748b" />
                      <Text style={styles.metaText}>Sales Category</Text>
                    </View>
                  </View>
                </View>

                {/* Customer Info */}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Customer Details</Text>
                </View>
                <View style={styles.customerCard}>
                  <View style={styles.customerAvatar}>
                    <Text style={styles.avatarText}>{(selectedInvoice.customerName || 'N').charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.customerInfo}>
                    <Text style={styles.customerNameMain}>{selectedInvoice.customerName || 'Guest'}</Text>
                    {selectedInvoice.fullCustomer ? (
                      <View style={styles.customerMeta}>
                        <Text style={styles.customerSubText}>{selectedInvoice.fullCustomer.phone}</Text>
                        {selectedInvoice.fullCustomer.email && <Text style={styles.customerSubText}> • {selectedInvoice.fullCustomer.email}</Text>}
                      </View>
                    ) : (
                      <Text style={styles.customerSubText}>Standard Billing</Text>
                    )}
                  </View>
                </View>

                {/* Bill Items */}
                <View style={[styles.sectionHeader, { marginTop: 32 }]}>
                  <Text style={styles.sectionTitle}>Bill Items</Text>
                  <Text style={styles.itemCountText}>{selectedInvoice.items?.length || 0} Items</Text>
                </View>

                <View style={styles.itemsContainer}>
                  {selectedInvoice.items && selectedInvoice.items.map((item, index) => (
                    <View key={index} style={[styles.modernItemRow, index === selectedInvoice.items.length - 1 && { borderBottomWidth: 0 }]}>
                      <View style={styles.itemMainInfo}>
                        <Text style={styles.modernItemName}>{item.name}</Text>
                        <Text style={styles.modernItemPricePer}>₹{item.price?.toFixed(2)} × {item.quantity}</Text>
                      </View>
                      <Text style={styles.modernItemTotal}>₹{(item.price * item.quantity).toFixed(2)}</Text>
                    </View>
                  ))}
                </View>

                {/* Calculation Details */}
                <View style={styles.modernTotalCard}>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Subtotal</Text>
                    <Text style={styles.calcValue}>₹{selectedInvoice.subtotal?.toFixed(2) || '0.00'}</Text>
                  </View>

                  {selectedInvoice.tax > 0 && (
                    <View style={styles.calcRow}>
                      <Text style={styles.calcLabel}>Tax (Included)</Text>
                      <Text style={styles.calcValue}>₹{selectedInvoice.tax.toFixed(2)}</Text>
                    </View>
                  )}

                  {selectedInvoice.discount > 0 && (
                    <View style={styles.calcRow}>
                      <Text style={styles.calcLabel}>Discount Saved</Text>
                      <Text style={[styles.calcValue, { color: '#ef4444' }]}>-₹{selectedInvoice.discount.toFixed(2)}</Text>
                    </View>
                  )}

                  {selectedInvoice.additionalCharges > 0 && (
                    <View style={styles.calcRow}>
                      <Text style={styles.calcLabel}>Extra Charges</Text>
                      <Text style={styles.calcValue}>+₹{selectedInvoice.additionalCharges.toFixed(2)}</Text>
                    </View>
                  )}

                  <View style={styles.modernNetTotalRow}>
                    <View>
                      <Text style={styles.netTotalLabel}>NET TOTAL</Text>
                      <Text style={styles.netTotalSub}>Inclusive of all taxes</Text>
                    </View>
                    <Text style={styles.netTotalValue}>₹{selectedInvoice.total?.toFixed(2)}</Text>
                  </View>
                </View>

                {selectedInvoice.internalNotes && selectedInvoice.internalNotes.trim() !== '' && (
                  <View style={styles.remarksBox}>
                    <View style={styles.remarksHeader}>
                      <FileText size={16} color="#854d0e" />
                      <Text style={styles.remarksTitle}>REMARKS</Text>
                    </View>
                    <Text style={styles.remarksText}>{selectedInvoice.internalNotes}</Text>
                  </View>
                )}

                <View style={styles.modernActionGrid}>
                  <TouchableOpacity style={styles.modernActionBtn} onPress={() => handleEditPress(selectedInvoice)}>
                    <View style={[styles.actionIconContainer, { backgroundColor: '#f1f5f9' }]}>
                      <FileText size={20} color="#000" />
                    </View>
                    <Text style={styles.modernActionText}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.modernActionBtn} onPress={() => handlePrint(selectedInvoice)}>
                    <View style={[styles.actionIconContainer, { backgroundColor: '#f1f5f9' }]}>
                      <Download size={20} color="#000" />
                    </View>
                    <Text style={styles.modernActionText}>Save PDF</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modernActionBtn}
                    onPress={() => handleDelete(selectedInvoice)}
                  >
                    <View style={[styles.actionIconContainer, { backgroundColor: '#fef2f2' }]}>
                      <Trash2 size={20} color="#ef4444" />
                    </View>
                    <Text style={[styles.modernActionText, { color: '#ef4444' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={isEditModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIndicator} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modify Invoice</Text>
              <Pressable onPress={() => setEditModalVisible(false)}><X size={24} color="#000" /></Pressable>
            </View>

            {editingInvoice && (
              <>
                <ScrollView style={styles.editForm} showsVerticalScrollIndicator={false}>
                  <Text style={styles.inputLabel}>Customer Name</Text>
                  <Input
                    value={editingInvoice.customerName}
                    onChangeText={(val) => setEditingInvoice({ ...editingInvoice, customerName: val })}
                    style={{ marginBottom: 20 }}
                    placeholder="e.g. John Doe"
                  />

                  <Text style={styles.inputLabel}>Total Amount (₹)</Text>
                  <Input
                    keyboardType="numeric"
                    value={editingInvoice.total?.toString()}
                    onChangeText={(val) => setEditingInvoice({ ...editingInvoice, total: parseFloat(val) || 0 })}
                    style={{ marginBottom: 20 }}
                  />

                  <Text style={styles.inputLabel}>Payment Status</Text>
                  <View style={styles.statusSelector}>
                    {['PAID', 'UNPAID'].map(status => (
                      <TouchableOpacity
                        key={status}
                        style={[
                          styles.statusOption,
                          editingInvoice.status === status && styles.statusOptionActive
                        ]}
                        onPress={() => setEditingInvoice({ ...editingInvoice, status })}
                      >
                        <Text style={[
                          styles.statusOptionText,
                          editingInvoice.status === status && styles.statusOptionTextActive
                        ]}>
                          {status === 'PAID' ? 'PAID' : 'UNPAID'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={{ height: 30 }} />
                </ScrollView>

                <View style={styles.modalFooter}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
                    <Text style={{ color: '#000', fontWeight: '800' }}>DISCARD</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit}>
                    <Text style={styles.savetxt}>
                      {editingInvoice?.id?.toString().startsWith('NEW-') ? "CREATE INVOICE" : "UPDATE INVOICE"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

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

      {/* Filter Drawer - GST Analytics Style */}
      <Modal
        visible={isFilterOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFilterOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsFilterOpen(false)}>
          <View style={styles.filterModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Invoices</Text>
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
              ].map(item => (
                <Pressable
                  key={item.id}
                  style={[styles.filterItem, period === item.id && styles.activeFilterItem]}
                  onPress={() => changePeriod(item.id)}
                >
                  <View style={styles.filterItemLeft}>
                    <item.icon size={18} color={period === item.id ? '#000' : '#94a3b8'} />
                    <Text style={[styles.filterItemLabel, period === item.id && styles.activeFilterItemLabel]}>{item.label}</Text>
                  </View>
                  <ChevronRight size={16} color="#cbd5e1" />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Premium Calendar Picker Modal - GST Analytics Style */}
      <Modal
        visible={isCalendarOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCalendarOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsCalendarOpen(false)}>
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
                    onPress={() => handleCustomDateSelect(new Date(currentCalView.getFullYear(), currentCalView.getMonth(), day))}
                  >
                    <Text style={[styles.calDayText, isSelected && styles.calDayTextActive]}>{day}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={styles.calTodayBtn}
              onPress={() => handleCustomDateSelect(new Date())}
            >
              <Text style={styles.calTodayText}>Go to Today</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#f8fafc' },
  headerWrapper: { backgroundColor: '#f8fafc', zIndex: 10 },
  headerGradient: {
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 6
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  backBtnWrapper: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtnDark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  iconBtnDarkActive: {
    backgroundColor: '#000',
  },

  searchContainer: { marginBottom: 20, paddingHorizontal: 24, marginTop: 20 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInputCustom: {
    flex: 1,
    fontSize: 15,
    color: '#000000',
    fontWeight: '500',
    paddingLeft: 12,
    height: '100%'
  },

  // Status Filter Row
  filterRow: { 
    flexDirection: 'row', 
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterBtnInactive: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0'
  },
  filterBtnActive: {
    backgroundColor: '#000',
    borderColor: '#000'
  },
  filterText: { fontSize: 13, fontWeight: '700' },
  filterTextInactive: { color: '#64748b' },
  filterTextActive: { color: '#fff' },

  recycleBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    paddingHorizontal: 12
  },
  recycleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ef4444'
  },

  listContainer: { padding: 20, paddingBottom: 100 },
  invoiceCard: {
    marginBottom: 16,
    borderRadius: 24,
    backgroundColor: '#fff',
    padding: 20,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  customerName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
    marginBottom: 4
  },
  invoiceMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: 0.2
  },
  amount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginBottom: 16
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
    gap: 6,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },

  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 12,
    gap: 6,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3
  },
  previewBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)', // Slightly lighter overlay
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 36, // Softer roundness
    borderTopRightRadius: 36,
    width: '100%',
    maxHeight: '92%',
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20
  },
  modalIndicator: {
    width: 48,
    height: 5,
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    alignSelf: 'center',
    marginBottom: 8
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },

  detailScroll: { paddingHorizontal: 24 },

  summaryTopCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    padding: 20,
    marginTop: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  summaryTopMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  summaryIdLabel: { fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, marginBottom: 4 },
  summaryIdValue: { fontSize: 18, fontWeight: '900', color: '#0f172a' },

  modernStatusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 8 },
  modernStatusText: { fontSize: 12, fontWeight: '800' },

  summaryMetaRow: { flexDirection: 'row', gap: 20 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, fontWeight: '600', color: '#64748b' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  itemCountText: { fontSize: 13, fontWeight: '600', color: '#64748b' },

  customerCard: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#f1f5f9', gap: 16 },
  customerAvatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  customerInfo: { flex: 1 },
  customerNameMain: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 2 },
  customerSubText: { fontSize: 13, fontWeight: '500', color: '#64748b' },

  itemsContainer: { backgroundColor: '#f8fafc', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  modernItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  itemMainInfo: { flex: 1 },
  modernItemName: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  modernItemPricePer: { fontSize: 12, fontWeight: '500', color: '#64748b' },
  modernItemTotal: { fontSize: 14, fontWeight: '800', color: '#0f172a' },

  modernTotalCard: { marginTop: 24, padding: 20, backgroundColor: '#0f172a', borderRadius: 24 },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  calcLabel: { fontSize: 14, fontWeight: '500', color: '#94a3b8' },
  calcValue: { fontSize: 14, fontWeight: '600', color: '#fff' },
  modernNetTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  netTotalLabel: { fontSize: 12, fontWeight: '800', color: '#94a3b8', letterSpacing: 1 },
  netTotalSub: { fontSize: 10, fontWeight: '500', color: '#64748b', marginTop: 2 },
  netTotalValue: { fontSize: 24, fontWeight: '900', color: '#fff' },

  remarksBox: { marginTop: 24, padding: 16, backgroundColor: '#fffbeb', borderRadius: 20, borderWidth: 1, borderColor: '#fef3c7' },
  remarksHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  remarksTitle: { fontSize: 10, fontWeight: '800', color: '#854d0e', letterSpacing: 1 },
  remarksText: { fontSize: 14, fontWeight: '600', color: '#92400e', lineHeight: 20, fontStyle: 'italic' },

  modernActionGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 32, gap: 12 },
  modernActionBtn: { flex: 1, alignItems: 'center', gap: 10 },
  actionIconContainer: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#f1f5f9' },
  modernActionText: { fontSize: 12, fontWeight: '800', color: '#000' },

  statusSelector: { flexDirection: 'row', gap: 12, marginTop: 10 },
  statusOption: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#e2e8f0' },
  statusOptionActive: { backgroundColor: '#000', borderColor: '#000' },
  statusOptionText: { fontSize: 14, fontWeight: '800', color: '#64748b' },
  statusOptionTextActive: { color: '#fff' },

  editForm: { padding: 24 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#64748b', marginBottom: 8, marginLeft: 4 },
  modalFooter: { padding: 24, borderTopWidth: 1, borderTopColor: '#f1f5f9', flexDirection: 'row', gap: 16 },
  cancelBtn: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#f1f5f9' },
  saveBtn: { flex: 2, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#0f172a' },
  savetxt: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },


  dateFilterScroll: {
    paddingHorizontal: 22,
    gap: 8,
  },
  dateFilterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  dateFilterChipActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  calendarChip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateFilterChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
  },
  dateFilterChipTextActive: {
    color: '#000',
  },

  // Date Picker Modal Styles
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  datePickerModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  datePickerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  datePickerContent: {
    padding: 24,
  },
  datePickerSection: {
    marginBottom: 24,
  },
  datePickerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  yearMonthBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
  },
  yearMonthBtnActive: {
    backgroundColor: '#000',
  },
  yearMonthBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  yearMonthBtnTextActive: {
    color: '#fff',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthBtn: {
    width: '23%',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  monthBtnActive: {
    backgroundColor: '#000',
  },
  monthBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  monthBtnTextActive: {
    color: '#fff',
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayBtn: {
    width: '13%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBtnActive: {
    backgroundColor: '#000',
  },
  dayBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  dayBtnTextActive: {
    color: '#fff',
  },
  selectedDateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  selectedDateText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  datePickerFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  datePickerCancelBtn: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  datePickerCancelText: {
    color: '#64748b',
    fontWeight: '800',
    fontSize: 14,
  },
  datePickerConfirmBtn: {
    flex: 2,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#000',
  },
  // Modal Styles - GST Analytics Style
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  filterModal: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#000' },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  modalScroll: { marginBottom: 10 },
  filterItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: '#f8fafc' },
  activeFilterItem: { backgroundColor: '#f8fafc', paddingHorizontal: 12, borderRadius: 16, borderColor: 'transparent' },
  filterItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  filterItemLabel: { fontSize: 15, fontWeight: '700', color: '#475569' },
  activeFilterItemLabel: { color: '#000', fontWeight: '900' },

  // Premium Calendar Styles - GST Analytics Style
  premiumCal: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  calTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  calNav: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  calNavBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderRadius: 8 },
  calMonthLabel: { fontSize: 17, fontWeight: '900', color: '#000' },
  calClose: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },

  calWeekRow: { flexDirection: 'row', marginBottom: 15 },
  calWeekText: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '900', color: '#cbd5e1' },

  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDayCell: { width: 45, height: 45, margin: 2, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  calDayActive: { backgroundColor: '#000' },
  calDayText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  calDayTextActive: { color: '#fff', fontWeight: '900' },

  calTodayBtn: { marginTop: 25, height: 50, borderRadius: 16, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  calTodayText: { fontSize: 14, fontWeight: '800', color: '#000' }
});