import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  TextInput,
  StatusBar,
  TouchableOpacity,
  LayoutAnimation,
  UIManager,
  Switch,
  InteractionManager,
} from 'react-native';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  ChevronRight as ChevronRightIcon,
  LayoutGrid,
  ChevronLeftIcon,
  Printer,
  AlertCircle,
  PieChart,
  Info,
  UserX,
  Landmark,
} from 'lucide-react-native';
import { useNavBarColor } from '../../hooks/useNavBarColor';


import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useSettings } from '../../context/SettingsContext';
import { APP_VERSION } from '../../config/version';
import {
  printReceipt,
  shareReceiptPDF,
  printMultipleReceipts,
  saveReceiptPDF,
  shareCombinedReceiptPDF,
  saveCombinedReceiptPDF
} from '../../utils/printUtils';
import { useTransactions } from '../../context/TransactionContext';
import { Card } from '../../components/ui/Card';
import DetailedInvoiceTemplate from '../Settings/DetailedInvoiceTemplate';
import ClassicInvoiceTemplate from '../Settings/ClassicInvoiceTemplate';
import CompactInvoiceTemplate from '../Settings/CompactInvoiceTemplate';
import MinimalInvoiceTemplate from '../Settings/MinimalInvoiceTemplate';
import ThermalInvoiceTemplate from '../Settings/ThermalInvoiceTemplate';
import ProfessionalThermalTemplate from '../Settings/ProfessionalThermalTemplate';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { useToast } from '../../context/ToastContext';
import InvoiceItem from '../../components/invoices/InvoiceItem';

import { LinearGradient } from 'expo-linear-gradient';
import { debouncedNavigate } from '../../utils/navigationUtils';

const safeTax = (val) => Number(val) || 0;
const safeDateDisplay = (dateStr) => {
  if (!dateStr) return 'Invalid Date';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? 'Invalid Date' : d.toLocaleDateString('en-GB');
};

export default function InvoicesPage() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { transactions, loading, fetchTransactions, updateTransaction, addTransaction, deleteTransaction, clearAllTransactions } = useTransactions();
  const { showToast } = useToast();
  // Using direct DB access for customer lookup to avoid context overhead or circular deps if any
  const { db } = require('../../services/database');
  const { settings } = useSettings(); // Get settings for print/share
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Date Filter State - GST Analytics Style
  const [period, setPeriod] = useState('All Time');
  const [selectedCustomDate, setSelectedCustomDate] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [showStatusFilter, setShowStatusFilter] = useState(false);

  // Calendar State
  const [currentCalView, setCurrentCalView] = useState(new Date());

  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [isDetailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);

  // Print Modal State
  const [printFormatModalVisible, setPrintFormatModalVisible] = useState(false);
  const [invoiceToPrint, setInvoiceToPrint] = useState(null);

  // Preview Modal State
  const [previewFormatModalVisible, setPreviewFormatModalVisible] = useState(false);
  const [invoiceToPreview, setInvoiceToPreview] = useState(null);

  // Download Modal State
  const [downloadFormatModalVisible, setDownloadFormatModalVisible] = useState(false);
  const [invoiceToDownload, setInvoiceToDownload] = useState(null);

  // Unified Preview State
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewFormat, setPreviewFormat] = useState('A4'); // 'A4' or 'Thermal'
  const [previewA4Template, setPreviewA4Template] = useState('Classic');
  const [previewThermalTemplate, setPreviewThermalTemplate] = useState('Professional');

  // Use custom hook to manage Android navigation bar color based on preview state
  useNavBarColor('#000000', 'light', previewVisible);

  const [showBankAndSignature, setShowBankAndSignature] = useState(false);

  const [isNonAuthorizedSignatory, setIsNonAuthorizedSignatory] = useState(false);
  const [hideAccountDetails, setHideAccountDetails] = useState(false);

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
      const task = InteractionManager.runAfterInteractions(() => {
        fetchTransactions();
      });
      return () => task.cancel();
    }, [])
  );

  const mapInvoiceToBillData = (invoice) => {
    if (!invoice) return null;
    return {
      ...invoice,
      id: invoice.id,
      invoiceNo: invoice.invoiceNumber || invoice.id,
      weekly_sequence: invoice.weekly_sequence,
      cart: invoice.items || [],
      items: (invoice.items || []).map(item => ({
        ...item,
        taxableValue: item.taxableValue || (item.price * item.quantity),
        total: item.total || (item.price * item.quantity),
        cgstAmt: (safeTax(item.taxAmount) / 2).toFixed(2),
        sgstAmt: (safeTax(item.taxAmount) / 2).toFixed(2),
        igstAmt: safeTax(item.taxAmount).toFixed(2),
        cgstRate: (parseFloat(item.taxRate || 0) / 2) + '%',
        sgstRate: (parseFloat(item.taxRate || 0) / 2) + '%',
        igstRate: (item.taxRate || '0') + '%'
      })),
      customerName: invoice.customerName || 'Guest',
      totals: {
        total: invoice.total || 0,
        subtotal: invoice.subtotal || 0,
        tax: invoice.tax || 0,
        cgst: (safeTax(invoice.tax) / 2) || 0,
        sgst: (invoice.tax / 2) || 0,
        igst: invoice.tax || 0,
        discount: invoice.discount || 0,
        additionalCharges: invoice.additionalCharges || 0,
        roundOff: invoice.roundOff || 0
      },
      customer: {
        name: invoice.customerName || 'Guest',
        address: '-',
        mobile: '-',
        gstin: '-'
      },
      date: invoice.date,
      time: new Date(invoice.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      total: invoice.total,
      subtotal: invoice.subtotal || 0,
      tax: invoice.tax || 0,
      discount: invoice.discount || 0,
      additionalCharges: invoice.additionalCharges || 0,
      roundOff: invoice.roundOff || 0,
      internalNotes: invoice.internalNotes || '',
      taxType: invoice.taxType || 'intra'
    };
  };

  const handlePreview = (invoice) => {
    setInvoiceToPreview(invoice);
    setPreviewFormatModalVisible(true);
  };

  const executePreview = async (format) => {
    try {
      setPreviewFormatModalVisible(false);
      if (!invoiceToPreview) return;
      const invoice = invoiceToPreview;

      const billData = {
        ...invoice,
        id: invoice.id,
        invoiceNo: invoice.invoiceNumber || invoice.id,
        weekly_sequence: invoice.weekly_sequence,
        cart: invoice.items || [],
        items: (invoice.items || []).map(item => ({
          ...item,
          taxableValue: item.taxableValue || (item.price * item.quantity),
          total: item.total || (item.price * item.quantity),
          cgstAmt: (safeTax(item.taxAmount) / 2).toFixed(2),
          sgstAmt: (safeTax(item.taxAmount) / 2).toFixed(2),
          igstAmt: safeTax(item.taxAmount).toFixed(2),
          cgstRate: (parseFloat(item.taxRate || 0) / 2) + '%',
          sgstRate: (parseFloat(item.taxRate || 0) / 2) + '%',
          igstRate: (item.taxRate || '0') + '%'
        })),
        customerName: invoice.customerName || 'Guest',
        totals: {
          total: invoice.total || 0,
          subtotal: invoice.subtotal || 0,
          tax: invoice.tax || 0,
          cgst: (safeTax(invoice.tax) / 2) || 0,
          sgst: (invoice.tax / 2) || 0,
          igst: invoice.tax || 0,
          discount: invoice.discount || 0,
          additionalCharges: invoice.additionalCharges || 0,
          roundOff: invoice.roundOff || 0
        },
        customer: {
          name: invoice.customerName || 'Guest',
          address: '-',
          mobile: '-',
          gstin: '-'
        },
        date: new Date(invoice.date).toLocaleDateString('en-GB'),
        time: new Date(invoice.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        total: invoice.total,
        subtotal: invoice.subtotal || 0,
        tax: invoice.tax || 0,
        discount: invoice.discount || 0,
        additionalCharges: invoice.additionalCharges || 0,
        roundOff: invoice.roundOff || 0,
        internalNotes: invoice.internalNotes || '',
        taxType: invoice.taxType || 'intra'
      };

      if (format === 'A4' || format === '80mm' || format === '58mm') {
        setPreviewData(billData);
        setPreviewFormat(format === 'A4' ? 'A4' : 'Thermal');
        setPreviewA4Template(settings?.invoice?.template || 'Classic');
        setPreviewThermalTemplate(settings?.invoice?.billTemplate || 'Professional');
        setShowBankAndSignature(settings?.invoice?.showBankAndSignature || false);
        setPreviewVisible(true);
      } else {
        await printReceipt(billData, format, settings, 'invoice');
      }
    } catch (error) {
      console.error("Preview Error:", error);
      showToast("Failed to preview template", "error");
    }
  };

  const handleShare = async (invoice) => {
    try {
      const billData = mapInvoiceToBillData(invoice);

      // Force A4/Template for Invoice Share (Internal Record)
      const invoiceSettings = {
        ...settings,
        invoice: {
          ...settings.invoice,
          paperSize: 'A4' // Force A4 to use the selected Template (Classic, GST, etc.)
        }
      };

      await shareReceiptPDF(billData, invoiceSettings, 'invoice', {
        isNonAuthorized: isNonAuthorizedSignatory,
        hideAccountDetails: hideAccountDetails
      });
    } catch (error) {
      console.error("Share Error:", error);
      showToast("Failed to share invoice", "error");
    }
  };


  const handleDownload = (invoice) => {
    setInvoiceToDownload(invoice);
    setDownloadFormatModalVisible(true);
  };

  const executeDownload = async (type) => {
    try {
      setDownloadFormatModalVisible(false);
      if (!invoiceToDownload) return;

      const billData = mapInvoiceToBillData(invoiceToDownload);
      const downloadOptions = {
        isNonAuthorized: isNonAuthorizedSignatory,
        hideAccountDetails: hideAccountDetails
      };

      if (type === 'bill') {
        // Force Thermal Mode
        await saveReceiptPDF(billData, {
          ...settings,
          invoice: { ...settings.invoice, paperSize: settings?.invoice?.billPaperSize || '80mm' }
        }, 'customer', downloadOptions);
      } else if (type === 'invoice') {
        // Force A4 Mode
        await saveReceiptPDF(billData, {
          ...settings,
          invoice: { ...settings.invoice, paperSize: 'A4' }
        }, 'invoice', downloadOptions);
      } else if (type === 'both') {
        // Combined PDF
        await saveCombinedReceiptPDF(billData, settings);
      }

    } catch (error) {
      console.error("Download Error:", error);
      showToast("Download failed", "error");
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
      date: new Date().toISOString(),
      internalNotes: '',
      customerId: ''
    });
    setEditModalVisible(true);
  };

  const handleInvoicePress = async (invoice) => {
    // Lookup customer details if not present
    let fullCustomer = null;
    try {
      if (invoice.customerId) {
        const res = await db.getAllAsync('SELECT * FROM customers WHERE id = ?', [invoice.customerId]);
        if (res && res.length > 0) fullCustomer = res[0];
      } else if (invoice.customerName && invoice.customerName !== 'Guest') {
        // Fallback by name
        const res = await db.getAllAsync('SELECT * FROM customers WHERE name = ?', [invoice.customerName]);
        if (res && res.length > 0) fullCustomer = res[0];
      }
    } catch (e) { console.log("Cust Lookup Error", e); }

    setSelectedInvoice({ ...invoice, fullCustomer });
    setDetailModalVisible(true);
  };

  const handleEditPress = (invoice) => {
    setDetailModalVisible(false);
    setEditingInvoice({
      ...invoice,
      total: invoice.total || 0,
      customerName: invoice.customerName || '',
      internalNotes: invoice.internalNotes || '',
      date: invoice.date || new Date().toISOString()
    });
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
  const filteredInvoices = useMemo(() => {
    return transactions.filter(inv => {
      const invId = inv.id || '';
      const weeklyNo = inv.weekly_sequence?.toString() || '';
      const customer = inv.customerName || inv.customer || '';
      const matchesSearch = invId.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        weeklyNo.includes(debouncedSearchTerm) ||
        customer.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      const rawStatus = inv.status || 'Pending';
      let status = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();

      // Normalize PARTIALLY PAID to just "Partial" to match the tab ID exactly
      if (status.toUpperCase() === 'PARTIALLY PAID' || status.toUpperCase() === 'PARTIAL') {
        status = 'Partial';
      }

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
  }, [transactions, debouncedSearchTerm, activeFilter, period, selectedCustomDate]);

  const getStatusStyle = (status) => {
    switch (status?.toUpperCase()) {
      case 'PAID': return { solidBg: '#000', border: '#000', text: '#fff', icon: CheckCircle2, label: 'PAID' };
      case 'PARTIAL':
      case 'PARTIALLY PAID': return { solidBg: '#fff7ed', border: '#ffedd5', text: '#ea580c', icon: PieChart, label: 'P.PAID' };
      case 'UNPAID': return { solidBg: '#fef2f2', border: '#fee2e2', text: '#ef4444', icon: AlertCircle, label: 'UNPAID' };
      default: return { solidBg: '#f8fafc', border: '#f1f5f9', text: '#64748b', icon: FileText, label: (status || 'Unknown').toUpperCase() };
    }
  };

  const stats = useMemo(() => [
    { label: 'Total Revenue', value: `₹${transactions.reduce((sum, t) => sum + (t.total || 0), 0).toLocaleString()}`, icon: TrendingUp, color: '#000000', bg: '#f8fafc' },
    { label: 'Unpaid', value: `₹${transactions.filter(t => t.status !== 'PAID').reduce((sum, t) => sum + (t.balance || 0), 0).toLocaleString()}`, icon: Clock, color: '#ef4444', bg: '#fffafa' },
    { label: 'Paid', value: `₹${transactions.filter(t => t.status === 'PAID').reduce((sum, t) => sum + (t.total || 0), 0).toLocaleString()}`, icon: CheckCircle2, color: '#15803d', bg: '#dcfce7' },
  ], [transactions]);

  const handlePrint = (invoice) => {
    setInvoiceToPrint(invoice);
    setPrintFormatModalVisible(true);
  };

  const executePrint = async (format) => {
    try {
      setPrintFormatModalVisible(false);
      if (!invoiceToPrint) return;
      const invoice = invoiceToPrint;

      // Adapt invoice data for print templates with rich mapping
      const billData = {
        ...invoice,
        id: invoice.id,
        invoiceNo: invoice.invoiceNumber || invoice.id,
        weekly_sequence: invoice.weekly_sequence,
        cart: invoice.items || [],
        items: (invoice.items || []).map(item => ({
          ...item,
          taxableValue: item.taxableValue || (item.price * item.quantity),
          total: item.total || (item.price * item.quantity),
          cgstAmt: (safeTax(item.taxAmount) / 2).toFixed(2),
          sgstAmt: (safeTax(item.taxAmount) / 2).toFixed(2),
          igstAmt: safeTax(item.taxAmount).toFixed(2),
          cgstRate: (parseFloat(item.taxRate || 0) / 2) + '%',
          sgstRate: (parseFloat(item.taxRate || 0) / 2) + '%',
          igstRate: (item.taxRate || '0') + '%'
        })),
        customerName: invoice.customerName || 'Guest',
        totals: {
          total: invoice.total || 0,
          subtotal: invoice.subtotal || 0,
          tax: invoice.tax || 0,
          cgst: (safeTax(invoice.tax) / 2) || 0,
          sgst: (invoice.tax / 2) || 0,
          igst: invoice.tax || 0,
          discount: invoice.discount || 0,
          additionalCharges: invoice.additionalCharges || 0,
          roundOff: invoice.roundOff || 0
        },
        customer: {
          name: invoice.customerName || 'Guest',
          address: '-',
          mobile: '-',
          gstin: '-'
        },
        date: new Date(invoice.date).toLocaleDateString('en-GB'),
        time: new Date(invoice.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        total: invoice.total,
        subtotal: invoice.subtotal || 0,
        tax: invoice.tax || 0,
        discount: invoice.discount || 0,
        additionalCharges: invoice.additionalCharges || 0,
        roundOff: invoice.roundOff || 0,
        internalNotes: invoice.internalNotes || '',
        taxType: invoice.taxType || 'intra'
      };

      if (format === 'A4' || format === '80mm' || format === '58mm') {
        setPreviewData(billData);
        setPreviewFormat(format === 'A4' ? 'A4' : 'Thermal');
        setPreviewA4Template(settings?.invoice?.template || 'Classic');
        setPreviewThermalTemplate(settings?.invoice?.billTemplate || 'Professional');
        setShowBankAndSignature(settings?.invoice?.showBankAndSignature || false);
        setPreviewVisible(true);
      } else {
        await printReceipt(billData, format, settings, 'invoice');
      }
    } catch (err) {
      console.error('Print error', err);
      showToast('Failed to print invoice', "error");
    }
  };

  const handlePrintAll = async () => {
    if (filteredInvoices.length === 0) {
      showToast("No invoices found to print", "info");
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: "PRINT ALL INVOICES?",
      message: `You are about to print ${filteredInvoices.length} invoices. This might take a while and consume a lot of paper. Proceed?`,
      variant: 'warning',
      confirmLabel: 'PRINT ALL',
      cancelLabel: 'CANCEL',
      onConfirm: async () => {
        try {
          const formattedBills = filteredInvoices.map(invoice => ({
            ...invoice,
            id: invoice.id,
            weekly_sequence: invoice.weekly_sequence,
            items: invoice.items || [],
            customerName: invoice.customerName || 'Guest',
            date: invoice.date,
            total: invoice.total,
            subtotal: invoice.subtotal || 0,
            tax: invoice.tax || 0,
            discount: invoice.discount || 0,
            additionalCharges: invoice.additionalCharges || 0,
            roundOff: invoice.roundOff || 0,
            internalNotes: invoice.internalNotes || '',
          }));
          await printMultipleReceipts(formattedBills, settings, 'invoice');
        } catch (err) {
          console.error('Print All error', err);
          showToast('Failed to print multiple invoices', 'error');
        }
      }
    });
  };


  const renderInvoiceItem = useCallback(({ item }) => (
    <InvoiceItem
      item={item}
      settings={settings}
      onPress={handleInvoicePress}
      onPrint={handlePrint}
      onDownload={handleDownload}
      onDelete={handleDelete}
      onPreview={handlePreview}
    />
  ), [settings, handleInvoicePress, handlePrint, handleDownload, handleDelete, handlePreview]);

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.headerContainer}>
        <LinearGradient colors={['#000', '#111']} style={styles.headerGradient}>
          <SafeAreaView edges={['top']}>
            {/* Top Navigation */}
            <View style={styles.topNav}>
              <Pressable onPress={() => navigation.goBack()} style={styles.navIcon}>
                <ChevronLeft size={22} color="#fff" />
              </Pressable>
              <View style={styles.navTitleBox}>
                <Text style={styles.navTitle}>Invoices</Text>
                <Text style={styles.navSubtitle}>{filteredInvoices.length} transactions found</Text>
              </View>
              <View style={styles.headerActionsStack}>
                <TouchableOpacity style={styles.headerActionBtnWhite} onPress={() => debouncedNavigate(navigation, 'RecycleBin')}>
                  <Recycle size={18} color="#000" strokeWidth={2.5} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerActionBtnWhite} onPress={handlePrintAll}>
                  <Printer size={18} color="#000" strokeWidth={2.5} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerActionBtnWhite} onPress={handleAddPress}>
                  <Plus size={20} color="#000" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Search and Filters Row */}
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Search size={16} color="rgba(255,255,255,0.45)" />
                <TextInput
                  placeholder="Search customer, bill #..."
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  style={styles.searchInput}
                  placeholderTextColor="rgba(255,255,255,0.35)"
                />
                <TouchableOpacity
                  style={styles.filterTrigger}
                  onPress={() => setIsFilterOpen(true)}
                >
                  <Filter size={16} color={activeFilter !== 'All' ? '#fff' : 'rgba(255,255,255,0.6)'} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Summary Statistics Strip */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 22, marginTop: 10, gap: 10 }}>
              <View style={[styles.summaryStrip, { flex: 1, marginHorizontal: 0, marginTop: 0 }]}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Revenue</Text>
                  <Text style={styles.summaryValue}>₹{filteredInvoices.reduce((s, i) => s + (i.total || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Period</Text>
                  <TouchableOpacity onPress={() => setIsCalendarOpen(true)} style={styles.periodPill}>
                    <Calendar size={10} color="#fff" />
                    <Text style={styles.periodText}>{period}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Invoices</Text>
                  <Text style={styles.summaryValue}>{filteredInvoices.length}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={{
                  width: 46,
                  height: '100%',
                  minHeight: 52,
                  backgroundColor: showStatusFilter ? '#fff' : 'rgba(255,255,255,0.05)',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: showStatusFilter ? '#fff' : 'rgba(255,255,255,0.08)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setShowStatusFilter(!showStatusFilter);
                }}
                activeOpacity={0.7}
              >
                <Filter size={18} color={showStatusFilter ? '#000' : '#fff'} />
              </TouchableOpacity>
            </View>

            {/* Filter Tabs Row */}
            <View style={{ overflow: 'hidden' }}>
              {showStatusFilter && (
                <View style={[styles.tabRowWrapper, { marginTop: 16, marginBottom: 0 }]}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
                    {[
                      { id: 'All', label: 'All', icon: LayoutGrid },
                      { id: 'Paid', label: 'Paid', icon: CheckCircle2 },
                      { id: 'Partial', label: 'Partial', icon: PieChart },
                      { id: 'Unpaid', label: 'Unpaid', icon: AlertCircle }
                    ].map(statusObj => {
                      const isActive = activeFilter === statusObj.id;
                      const IconComponent = statusObj.icon;

                      const activeBg = statusObj.id === 'Paid' ? '#000' : '#fff';
                      const activeBorder = statusObj.id === 'Paid' ? '#333' : '#fff';
                      const activeText = statusObj.id === 'Paid' ? '#fff' : '#000';

                      return (
                        <TouchableOpacity
                          key={statusObj.id}
                          style={[
                            styles.tabChip,
                            {
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              backgroundColor: isActive ? activeBg : 'rgba(255,255,255,0.08)',
                              borderWidth: 1,
                              borderColor: isActive ? activeBorder : 'rgba(255,255,255,0.1)',
                              paddingVertical: 10,
                              paddingHorizontal: 16,
                              borderRadius: 14,
                            }
                          ]}
                          onPress={() => setActiveFilter(statusObj.id)}
                          activeOpacity={0.7}
                        >
                          {statusObj.id !== 'All' && <IconComponent size={14} color={isActive ? activeText : 'rgba(255,255,255,0.7)'} strokeWidth={2.5} />}
                          <Text style={[styles.tabChipText, { color: isActive ? activeText : 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: isActive ? '800' : '600' }]}>{statusObj.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    <TouchableOpacity
                      style={[styles.recycleBinChip, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)', paddingVertical: 10 }]}
                      onPress={() => navigation.navigate('RecycleBin')}
                      activeOpacity={0.7}
                    >
                      <Recycle size={14} color="#fca5a5" />
                      <Text style={[styles.recycleBinText, { color: '#fca5a5', fontSize: 13 }]}>Recycle Bin</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              )}
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>
      {/* We moved Filter Tabs Row into the headerGradient above */}

      <FlatList
        data={filteredInvoices}
        keyExtractor={(item, index) => item.id ? item.id.toString() : `inv-${index}`}
        renderItem={renderInvoiceItem}
        contentContainerStyle={styles.listPadding}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        ListEmptyComponent={
          <View style={styles.emptyStateContainer}>
            <FileText size={64} color="#cbd5e1" strokeWidth={1} />
            <Text style={styles.emptyTitle}>No Invoices Found</Text>
            <Text style={styles.emptySubtitle}>Try adjusting your filters or search term</Text>
          </View>
        }
        ListFooterComponent={
          <View style={{ padding: 40, alignItems: 'center', opacity: 0.5 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748b', letterSpacing: 1.5 }}>KWIQ BILL • {APP_VERSION}</Text>
            <Text style={{ fontSize: 9, color: '#94a3b8', fontWeight: '700', marginTop: 4 }}>POWERED BY ZIPPY</Text>
          </View>
        }
      />



      {/* --- DETAILS MODAL --- */}
      <Modal visible={isDetailModalVisible} animationType="slide" transparent={true} onRequestClose={() => setDetailModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '100%', maxHeight: '100%', borderTopLeftRadius: 0, borderTopRightRadius: 0, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 20) }]}>

            <View style={styles.modalHeader}>
              <View style={styles.headerTextSection}>
                <Text style={styles.modalTitle}>Invoice Summary</Text>
                <Text style={styles.modalSubtitle}>Full transaction breakdown</Text>
              </View>
              <TouchableOpacity
                onPress={() => setDetailModalVisible(false)}
                style={styles.closeIconButton}
                activeOpacity={0.7}
              >
                <X size={18} color="#000" strokeWidth={3} />
              </TouchableOpacity>
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
                    {(() => {
                      const ms = getStatusStyle(selectedInvoice.status);
                      const IconComp = ms.icon;
                      return (
                        <View style={[
                          styles.modernStatusBadge,
                          { backgroundColor: ms.solidBg, borderColor: ms.border, borderWidth: 1 }
                        ]}>
                          <IconComp size={12} color={ms.text} strokeWidth={3} />
                          <Text style={[
                            styles.modernStatusText,
                            { color: ms.text }
                          ]}>{ms.label}</Text>
                        </View>
                      );
                    })()}
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
                      <Printer size={20} color="#000" />
                    </View>
                    <Text style={styles.modernActionText}>Print</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.modernActionBtn} onPress={() => handleShare(selectedInvoice)}>
                    <View style={[styles.actionIconContainer, { backgroundColor: '#f1f5f9' }]}>
                      <Download size={20} color="#000" />
                    </View>
                    <Text style={styles.modernActionText}>Export</Text>
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
                <View style={{ height: Math.max(insets.bottom, 120) }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={isEditModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '85%' }]}>
            <View style={styles.modalIndicator} />
            <View style={styles.modalHeader}>
              <View style={styles.headerTextSection}>
                <Text style={styles.modalTitle}>
                  {editingInvoice?.id?.toString().startsWith('NEW-') ? "New Invoice" : "Edit Invoice"}
                </Text>
                <Text style={styles.modalSubtitle}>Fill transaction details</Text>
              </View>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={styles.closeIconButton}
                activeOpacity={0.7}
              >
                <X size={18} color="#000" strokeWidth={3} />
              </TouchableOpacity>
            </View>

            {editingInvoice && (
              <>
                <ScrollView
                  style={styles.editForm}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 40 }}
                >
                  {/* Quick Tip for New Invoice */}
                  {editingInvoice?.id?.toString().startsWith('NEW-') && (
                    <TouchableOpacity
                      style={styles.billingTip}
                      onPress={() => {
                        setEditModalVisible(false);
                        navigation.navigate('Billing');
                      }}
                    >
                      <LayoutGrid size={18} color="#000" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tipTitle}>Use Billing Terminal instead?</Text>
                        <Text style={styles.tipSub}>Select products, apply tax, and print receipts automatically.</Text>
                      </View>
                      <ChevronRight size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  )}

                  <View style={styles.inputGroup}>
                    <Text style={styles.groupLabel}>ENTITY DETAILS</Text>
                    <View style={styles.inputBox}>
                      <Text style={styles.fieldLabel}>Customer Name</Text>
                      <Input
                        value={editingInvoice.customerName}
                        onChangeText={(val) => setEditingInvoice({ ...editingInvoice, customerName: val })}
                        placeholder="e.g. John Doe / Walk-in Customer"
                        style={styles.premiumInput}
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.groupLabel}>FINANCIALS</Text>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={[styles.inputBox, { flex: 1 }]}>
                        <Text style={styles.fieldLabel}>Date</Text>
                        <TouchableOpacity
                          style={styles.datePickerTrigger}
                          onPress={() => setIsCalendarOpen(true)}
                        >
                          <Calendar size={18} color="#000" />
                          <Text style={styles.dateText}>
                            {safeDateDisplay(editingInvoice.date)}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <View style={[styles.inputBox, { flex: 1 }]}>
                        <Text style={styles.fieldLabel}>Total Amount (₹)</Text>
                        <Input
                          keyboardType="numeric"
                          value={editingInvoice.total?.toString()}
                          onChangeText={(val) => setEditingInvoice({ ...editingInvoice, total: Math.max(0, parseFloat(val) || 0) })}
                          placeholder="0.00"
                          style={styles.premiumInput}
                        />
                      </View>
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.groupLabel}>TRANSACTION STATUS</Text>
                    <View style={styles.statusSelector}>
                      {['PAID', 'UNPAID'].map(status => (
                        <TouchableOpacity
                          key={status}
                          style={[
                            styles.statusToggleOption,
                            editingInvoice.status === status && styles.statusToggleOptionActive
                          ]}
                          onPress={() => setEditingInvoice({ ...editingInvoice, status })}
                        >
                          <Text style={[
                            styles.statusToggleText,
                            editingInvoice.status === status && styles.statusToggleTextActive
                          ]}>
                            {status === 'PAID' ? 'PAID' : 'DUE / UNPAID'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.groupLabel}>ADDITIONAL INFORMATION</Text>
                    <View style={styles.inputBox}>
                      <Text style={styles.fieldLabel}>Internal Remarks</Text>
                      <Input
                        value={editingInvoice.internalNotes}
                        onChangeText={(val) => setEditingInvoice({ ...editingInvoice, internalNotes: val })}
                        placeholder="Notes for internal record..."
                        multiline
                        style={[styles.premiumInput, { height: 80, textAlignVertical: 'top' }]}
                      />
                    </View>
                  </View>
                </ScrollView>

                <View style={[styles.footerContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                  <View style={styles.modalFooter}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
                      <Text style={{ color: '#000', fontWeight: '800' }}>DISCARD</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit}>
                      <Text style={styles.savetxt}>
                        {editingInvoice?.id?.toString().startsWith('NEW-') ? "CREATE INVOICE" : "SAVE CHANGES"}
                      </Text>
                    </TouchableOpacity>
                  </View>
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
          <View style={[styles.filterModal, { paddingBottom: Math.max(insets.bottom, 24) }]}>
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
                    onPress={() => {
                      const d = new Date(currentCalView.getFullYear(), currentCalView.getMonth(), day);
                      if (isEditModalVisible && editingInvoice) {
                        setEditingInvoice({ ...editingInvoice, date: d.toISOString() });
                        setIsCalendarOpen(false);
                      } else {
                        handleCustomDateSelect(d);
                      }
                    }}
                  >
                    <Text style={[styles.calDayText, isSelected && styles.calDayTextActive]}>{day}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={styles.calTodayBtn}
              onPress={() => {
                const d = new Date();
                if (isEditModalVisible && editingInvoice) {
                  setEditingInvoice({ ...editingInvoice, date: d.toISOString() });
                  setIsCalendarOpen(false);
                } else {
                  handleCustomDateSelect(d);
                }
              }}
            >
              <Text style={styles.calTodayText}>Go to Today</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* --- PRINT FORMAT MODAL --- */}
      <Modal visible={printFormatModalVisible} animationType="fade" transparent={true}>
        <Pressable style={styles.modalOverlay} onPress={() => setPrintFormatModalVisible(false)}>
          <View style={[styles.filterModal, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.modalHeader}>
              <View style={styles.headerTextSection}>
                <Text style={styles.modalTitle}>Choose Print Format</Text>
                <Text style={styles.modalSubtitle}>Select your preferred receipt printer type</Text>
              </View>
              <TouchableOpacity onPress={() => setPrintFormatModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={16} color="#000" strokeWidth={3} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 16, marginTop: 10 }}>
              <View style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#64748b', letterSpacing: 1.2, textTransform: 'uppercase' }}>Configuration Settings</Text>
                  <View style={{ flex: 1, height: 1.5, backgroundColor: '#f1f5f9' }} />
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setIsNonAuthorizedSignatory(!isNonAuthorizedSignatory)}
                    style={{ flex: 1, backgroundColor: isNonAuthorizedSignatory ? '#000' : '#fff', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: isNonAuthorizedSignatory ? '#000' : '#e2e8f0', elevation: isNonAuthorizedSignatory ? 2 : 0 }}
                  >
                    <UserX size={14} color={isNonAuthorizedSignatory ? '#fff' : '#64748b'} strokeWidth={2.5} />
                    <Text style={{ fontSize: 10, fontWeight: '900', color: isNonAuthorizedSignatory ? '#fff' : '#000' }}>SKIP SIGN</Text>
                    <View style={{ flex: 1 }} />
                    <View style={{ width: 14, height: 14, borderRadius: 3, borderWidth: 1.5, borderColor: isNonAuthorizedSignatory ? '#fff' : '#000', backgroundColor: isNonAuthorizedSignatory ? '#fff' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {isNonAuthorizedSignatory && <Text style={{ color: '#000', fontSize: 8, fontWeight: 'bold' }}>✓</Text>}
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setHideAccountDetails(!hideAccountDetails)}
                    style={{ flex: 1, backgroundColor: hideAccountDetails ? '#000' : '#fff', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: hideAccountDetails ? '#000' : '#e2e8f0', elevation: hideAccountDetails ? 2 : 0 }}
                  >
                    <Landmark size={14} color={hideAccountDetails ? '#fff' : '#64748b'} strokeWidth={2.5} />
                    <Text style={{ fontSize: 10, fontWeight: '900', color: hideAccountDetails ? '#fff' : '#000' }}>HIDE BANK</Text>
                    <View style={{ flex: 1 }} />
                    <View style={{ width: 14, height: 14, borderRadius: 3, borderWidth: 1.5, borderColor: hideAccountDetails ? '#fff' : '#000', backgroundColor: hideAccountDetails ? '#fff' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {hideAccountDetails && <Text style={{ color: '#000', fontSize: 8, fontWeight: 'bold' }}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                </View>
              </View>


              <TouchableOpacity style={styles.statusOption} onPress={() => executePrint(settings?.invoice?.billPaperSize || '80mm')}>
                <Printer size={20} color="#000" />
                <Text style={[styles.statusOptionText, { color: '#000' }]}>Thermal Invoice</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.statusOption} onPress={() => executePrint('A4')}>
                <FileText size={20} color="#000" />
                <Text style={[styles.statusOptionText, { color: '#000' }]}>A4 Invoice (Full Page)</Text>
              </TouchableOpacity>
            </View>


          </View>
        </Pressable>
      </Modal>

      {/* --- PREVIEW FORMAT MODAL --- */}
      <Modal visible={previewFormatModalVisible} animationType="fade" transparent={true}>
        <Pressable style={styles.modalOverlay} onPress={() => setPreviewFormatModalVisible(false)}>
          <View style={[styles.filterModal, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.modalHeader}>
              <View style={styles.headerTextSection}>
                <Text style={styles.modalTitle}>Choose Preview Type</Text>
                <Text style={styles.modalSubtitle}>How would you like to view this record?</Text>
              </View>
              <TouchableOpacity onPress={() => setPreviewFormatModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={16} color="#000" strokeWidth={3} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 16, marginTop: 10 }}>
              <View style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#64748b', letterSpacing: 1.2, textTransform: 'uppercase' }}>Configuration Settings</Text>
                  <View style={{ flex: 1, height: 1.5, backgroundColor: '#f1f5f9' }} />
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setIsNonAuthorizedSignatory(!isNonAuthorizedSignatory)}
                    style={{ flex: 1, backgroundColor: isNonAuthorizedSignatory ? '#000' : '#fff', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: isNonAuthorizedSignatory ? '#000' : '#e2e8f0', elevation: isNonAuthorizedSignatory ? 2 : 0 }}
                  >
                    <UserX size={14} color={isNonAuthorizedSignatory ? '#fff' : '#64748b'} strokeWidth={2.5} />
                    <Text style={{ fontSize: 10, fontWeight: '900', color: isNonAuthorizedSignatory ? '#fff' : '#000' }}>SKIP SIGN</Text>
                    <View style={{ flex: 1 }} />
                    <View style={{ width: 14, height: 14, borderRadius: 3, borderWidth: 1.5, borderColor: isNonAuthorizedSignatory ? '#fff' : '#000', backgroundColor: isNonAuthorizedSignatory ? '#fff' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {isNonAuthorizedSignatory && <Text style={{ color: '#000', fontSize: 8, fontWeight: 'bold' }}>✓</Text>}
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setHideAccountDetails(!hideAccountDetails)}
                    style={{ flex: 1, backgroundColor: hideAccountDetails ? '#000' : '#fff', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: hideAccountDetails ? '#000' : '#e2e8f0', elevation: hideAccountDetails ? 2 : 0 }}
                  >
                    <Landmark size={14} color={hideAccountDetails ? '#fff' : '#64748b'} strokeWidth={2.5} />
                    <Text style={{ fontSize: 10, fontWeight: '900', color: hideAccountDetails ? '#fff' : '#000' }}>HIDE BANK</Text>
                    <View style={{ flex: 1 }} />
                    <View style={{ width: 14, height: 14, borderRadius: 3, borderWidth: 1.5, borderColor: hideAccountDetails ? '#fff' : '#000', backgroundColor: hideAccountDetails ? '#fff' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {hideAccountDetails && <Text style={{ color: '#000', fontSize: 8, fontWeight: 'bold' }}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                </View>
              </View>


              <TouchableOpacity style={styles.statusOption} onPress={() => executePreview(settings?.invoice?.billPaperSize || '80mm')}>
                <Printer size={20} color="#000" />
                <Text style={[styles.statusOptionText, { color: '#000' }]}>Thermal Bill Format</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.statusOption} onPress={() => executePreview('A4')}>
                <FileText size={20} color="#000" />
                <Text style={[styles.statusOptionText, { color: '#000' }]}>A4 Invoice Format</Text>
              </TouchableOpacity>
            </View>

          </View>
        </Pressable>
      </Modal>


      {/* --- DOWNLOAD FORMAT MODAL --- */}
      <Modal visible={downloadFormatModalVisible} animationType="fade" transparent={true}>
        <Pressable style={styles.modalOverlay} onPress={() => setDownloadFormatModalVisible(false)}>
          <View style={[styles.filterModal, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.modalHeader}>
              <View style={styles.headerTextSection}>
                <Text style={styles.modalTitle}>Choose Download Content</Text>
                <Text style={styles.modalSubtitle}>What would you like to save to device?</Text>
              </View>
              <TouchableOpacity onPress={() => setDownloadFormatModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={16} color="#000" strokeWidth={3} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 16, marginTop: 10 }}>
              <TouchableOpacity style={styles.statusOption} onPress={() => executeDownload('bill')}>
                <Printer size={20} color="#000" />
                <Text style={[styles.statusOptionText, { color: '#000' }]}>Bill (Thermal Format)</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.statusOption} onPress={() => executeDownload('invoice')}>
                <FileText size={20} color="#000" />
                <Text style={[styles.statusOptionText, { color: '#000' }]}>Invoice (A4 Format)</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.statusOption} onPress={() => executeDownload('both')}>
                <LayoutGrid size={20} color="#000" />
                <Text style={[styles.statusOptionText, { color: '#000' }]}>Both Bill & Invoice</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* --- UNIFIED INVOICE PREVIEW MODAL (A4 & Thermal) --- */}
      <Modal
        visible={previewVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setPreviewVisible(false)}
      >

        <View style={styles.a4PreviewOverlay}>
          <View style={styles.a4PreviewContent}>


            {/* Header */}
            <View style={styles.a4PreviewHeader}>
              <View>
                <Text style={styles.a4PreviewTitle}>{previewFormat} Preview</Text>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#000', marginTop: 2 }}>
                  {previewFormat === 'A4'
                    ? `Template: ${previewA4Template}`
                    : `Format: ${previewThermalTemplate}`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setPreviewVisible(false)}
                style={styles.a4CloseBtn}
              >
                <X size={20} color="#000" strokeWidth={3} />
              </TouchableOpacity>
            </View>

            {/* Template Selector */}
            <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {previewFormat === 'A4' ? (
                  ['Classic', 'Detailed', 'Compact', 'Minimal'].map((tmpl) => (
                    <TouchableOpacity
                      key={tmpl}
                      onPress={() => setPreviewA4Template(tmpl)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 20,
                        backgroundColor: previewA4Template === tmpl ? '#000' : '#f1f5f9',
                        borderWidth: 1.5,
                        borderColor: previewA4Template === tmpl ? '#000' : '#e2e8f0',
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '800', color: previewA4Template === tmpl ? '#fff' : '#64748b' }}>
                        {tmpl}
                      </Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  ['Professional', 'Standard'].map((tmpl) => (
                    <TouchableOpacity
                      key={tmpl}
                      onPress={() => setPreviewThermalTemplate(tmpl)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 20,
                        backgroundColor: previewThermalTemplate === tmpl ? '#000' : '#f1f5f9',
                        borderWidth: 1.5,
                        borderColor: previewThermalTemplate === tmpl ? '#000' : '#e2e8f0',
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '800', color: previewThermalTemplate === tmpl ? '#fff' : '#64748b' }}>
                        {tmpl}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>

            {/* Quick Settings Card in Preview */}
            <View style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
              <View style={{ backgroundColor: '#f8fafc', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0' }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setIsNonAuthorizedSignatory(!isNonAuthorizedSignatory)}
                    style={{ flex: 1, backgroundColor: isNonAuthorizedSignatory ? '#000' : '#fff', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: isNonAuthorizedSignatory ? '#000' : '#cbd5e1' }}
                  >
                    <UserX size={14} color={isNonAuthorizedSignatory ? '#fff' : '#64748b'} strokeWidth={2.5} />
                    <Text style={{ fontSize: 10, fontWeight: '900', color: isNonAuthorizedSignatory ? '#fff' : '#000', letterSpacing: 0.5 }}>SKIP SIGN</Text>
                    <View style={{ flex: 1 }} />
                    <View style={{ width: 14, height: 14, borderRadius: 3, borderWidth: 1.5, borderColor: isNonAuthorizedSignatory ? '#fff' : '#000', backgroundColor: isNonAuthorizedSignatory ? '#fff' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {isNonAuthorizedSignatory && <Text style={{ color: '#000', fontSize: 8, fontWeight: 'bold' }}>✓</Text>}
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setHideAccountDetails(!hideAccountDetails)}
                    style={{ flex: 1, backgroundColor: hideAccountDetails ? '#000' : '#fff', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: hideAccountDetails ? '#000' : '#cbd5e1' }}
                  >
                    <Landmark size={14} color={hideAccountDetails ? '#fff' : '#64748b'} strokeWidth={2.5} />
                    <Text style={{ fontSize: 10, fontWeight: '900', color: hideAccountDetails ? '#fff' : '#000', letterSpacing: 0.5 }}>HIDE BANK</Text>
                    <View style={{ flex: 1 }} />
                    <View style={{ width: 14, height: 14, borderRadius: 3, borderWidth: 1.5, borderColor: hideAccountDetails ? '#fff' : '#000', backgroundColor: hideAccountDetails ? '#fff' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {hideAccountDetails && <Text style={{ color: '#000', fontSize: 8, fontWeight: 'bold' }}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>





            {/* Template Rendering */}
            <ScrollView
              style={styles.a4PreviewScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.a4PreviewScrollContent}
            >
              <View style={[styles.templateWrapper, previewFormat === 'Thermal' && { paddingVertical: 10, alignSelf: 'center', width: 'auto', minWidth: 300 }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ flexGrow: 1 }}>
                  <ScrollView showsVerticalScrollIndicator={true} maximumZoomScale={5} minimumZoomScale={0.5} bouncesZoom={true} contentContainerStyle={{ flexGrow: 1 }}>
                    <View style={{ width: '100%', minWidth: previewFormat === 'A4' ? 600 : '100%', padding: previewFormat === 'A4' ? 10 : 0 }}>
                      {(() => {
                        const overrideSettings = {
                          ...settings,
                          invoice: {
                            ...settings?.invoice,
                            template: previewA4Template,
                            billTemplate: previewThermalTemplate,
                            showBankAndSignature: showBankAndSignature
                          }
                        };

                        if (previewFormat === 'Thermal') {
                          const thermalOptions = { isNonAuthorized: isNonAuthorizedSignatory, hideAccountDetails: hideAccountDetails };
                          if (previewThermalTemplate === 'Professional') {
                            return <ProfessionalThermalTemplate settings={overrideSettings} data={previewData} taxType={previewData?.taxType || 'intra'} options={thermalOptions} />;
                          }
                          return <ThermalInvoiceTemplate settings={overrideSettings} data={previewData} taxType={previewData?.taxType || 'intra'} options={thermalOptions} />;
                        }


                        const props = { settings: overrideSettings, data: previewData };

                        switch (previewA4Template) {
                          case 'Detailed':
                            return <DetailedInvoiceTemplate {...props} options={{ isNonAuthorized: isNonAuthorizedSignatory, hideAccountDetails: hideAccountDetails }} />;
                          case 'Compact':
                            return <CompactInvoiceTemplate {...props} options={{ isNonAuthorized: isNonAuthorizedSignatory, hideAccountDetails: hideAccountDetails }} />;
                          case 'Minimal':
                            return <MinimalInvoiceTemplate {...props} options={{ isNonAuthorized: isNonAuthorizedSignatory, hideAccountDetails: hideAccountDetails }} />;
                          case 'Classic':
                          default:
                            return <ClassicInvoiceTemplate {...props} options={{ isNonAuthorized: isNonAuthorizedSignatory, hideAccountDetails: hideAccountDetails }} />;
                        }

                      })()}
                    </View>
                  </ScrollView>
                </ScrollView>
              </View>

              <View style={styles.previewFooterInfo}>
                <Info size={14} color="#64748b" />
                <Text style={styles.previewFooterText}>
                  This is a digital preview. Actual {previewFormat.toLowerCase()} print may vary based on your hardware.
                </Text>
              </View>
            </ScrollView>

            {/* Bottom Actions - Now Absolute to ensure visibility */}
            <View style={[
              styles.a4PreviewActions,
              {
                height: 70 + Math.max(insets.bottom, 16),
                paddingBottom: Math.max(insets.bottom, 16)
              }
            ]}>
              <TouchableOpacity
                onPress={() => setPreviewVisible(false)}
                style={styles.a4BackBtn}
              >
                <Text style={styles.a4BackBtnText}>Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  const format = previewFormat === 'A4' ? 'A4' : (settings?.invoice?.billPaperSize || '80mm');
                  const overrideSettings = {
                    ...settings,
                    invoice: {
                      ...settings?.invoice,
                      template: previewA4Template,
                      billTemplate: previewThermalTemplate,
                      showBankAndSignature: true
                    }
                  };

                  const options = {
                    isNonAuthorized: isNonAuthorizedSignatory,
                    hideAccountDetails: hideAccountDetails,
                    isSilent: false
                  };

                  setPreviewVisible(false);
                  await printReceipt(previewData, format, overrideSettings, 'invoice', options);

                }}
                style={styles.a4PrintBtn}
              >
                <Printer size={20} color="#fff" />
                <Text style={styles.a4PrintBtnText}>Print Bill</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#f8fafc' },
  headerContainer: { backgroundColor: '#f8fafc' },
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
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 20,
  },
  navIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  navTitleBox: {
    flex: 1,
    marginLeft: 16,
  },
  navTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
  },
  navSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
    marginTop: 2,
  },
  headerActionsStack: {
    flexDirection: 'row',
    gap: 10,
  },
  headerActionBtnWhite: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  headerActionBtnWhiteDanger: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  searchRow: {
    paddingHorizontal: 22,
    marginBottom: 20,
    marginTop: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 12,
  },
  filterTrigger: {
    padding: 8,
    marginLeft: 10,
  },
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 22,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginTop: 10,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff',
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  periodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  periodText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  tabRowWrapper: {
    marginTop: 24,
    marginBottom: 12,
  },
  tabScrollContent: {
    paddingHorizontal: 22,
    gap: 10,
    alignItems: 'center',
  },
  tabChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  tabChipActive: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  tabChipText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748b',
  },
  tabChipTextActive: {
    color: '#fff',
  },
  recycleBinChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#fff1f1',
    borderWidth: 1,
    borderColor: '#fee2e2',
    marginLeft: 10,
  },
  recycleBinText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ef4444',
  },
  listPadding: {
    paddingBottom: 100,
    paddingTop: 10,
  },
  invoiceModernCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    marginHorizontal: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarContainer: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  infoContainer: {
    flex: 1,
  },
  nameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modernCustomerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
    marginRight: 10,
  },
  modernAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  idTag: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  idTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  dateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateMetaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  cardSeparator: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 16,
  },
  cardActionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusModernPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    flexShrink: 1,
  },
  statusModernDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusModernText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modernIconAction: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modernIconActionDanger: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  modernOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#000',
    paddingHorizontal: 10,
    height: 34,
    borderRadius: 8,
    marginLeft: 2,
  },
  modernOpenText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    maxHeight: '92%',
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20
  },
  modalIndicator: {
    width: 36,
    height: 4,
    backgroundColor: '#cbd5e1',
    borderRadius: 10,
    alignSelf: 'center',
    marginVertical: 12
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingBottom: 20,
    borderBottomWidth: 1.5,
    borderBottomColor: '#f8fafc'
  },
  headerTextSection: { flex: 1 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#000', letterSpacing: -0.8 },
  modalSubtitle: { fontSize: 13, color: '#94a3b8', fontWeight: '600', marginTop: 1 },
  closeIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginLeft: 15
  },
  filterModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 24,
    paddingHorizontal: 0,
    maxHeight: '80%',
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginHorizontal: 24,
  },
  statusOptionText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a'
  },
  detailScroll: { flex: 1, paddingHorizontal: 24 },
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
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  summaryMetaRow: { flexDirection: 'row', gap: 20 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  itemCountText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  customerCard: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#f1f5f9', gap: 16 },
  customerAvatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
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
  statusToggleOption: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#e2e8f0' },
  statusToggleOptionActive: { backgroundColor: '#000', borderColor: '#000' },
  statusToggleText: { fontSize: 14, fontWeight: '800', color: '#64748b' },
  statusToggleTextActive: { color: '#fff' },
  editForm: { padding: 24 },
  modalFooter: { padding: 24, borderTopWidth: 1, borderTopColor: '#f1f5f9', flexDirection: 'row', gap: 16 },
  cancelBtn: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#f1f5f9' },
  saveBtn: { flex: 2, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#0f172a' },
  savetxt: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },

  // Filter Modal

  modalCloseBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  modalScroll: { marginBottom: 10, paddingHorizontal: 24 },
  filterItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: '#f8fafc' },
  activeFilterItem: { backgroundColor: '#f8fafc', paddingHorizontal: 12, borderRadius: 16, borderColor: 'transparent' },
  filterItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  filterItemLabel: { fontSize: 15, fontWeight: '700', color: '#475569' },
  activeFilterItemLabel: { color: '#000', fontWeight: '900' },

  // Premium Calendar
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
  calTodayText: { fontSize: 14, fontWeight: '800', color: '#000' },

  billingTip: {
    backgroundColor: '#f1f5f9',
    padding: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tipTitle: { fontSize: 14, fontWeight: '900', color: '#000' },
  tipSub: { fontSize: 11, color: '#64748b', fontWeight: '500', marginTop: 2 },
  inputGroup: { marginBottom: 24 },
  groupLabel: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 },
  inputBox: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#0f172a', marginBottom: 8, marginLeft: 2 },
  premiumInput: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#000',
    fontWeight: '600'
  },
  datePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    height: 52,
    paddingHorizontal: 16,
  },
  dateText: { fontSize: 15, fontWeight: '700', color: '#000' },
  footerContainer: {
    backgroundColor: '#fff',
  },

  // --- A4 Preview Modal Styles ---
  a4PreviewOverlay: {
    flex: 1,
    height: '100%',
    width: '100%',
    backgroundColor: '#fff',
  },

  a4PreviewContent: {
    flex: 1,
    width: '100%',
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? 0 : 40,
  },

  a4PreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1.5,
    borderBottomColor: '#e2e8f0'
  },
  a4PreviewTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000',
    letterSpacing: -0.5
  },
  a4PreviewSubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
    marginTop: 2
  },
  a4CloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  a4PreviewScroll: {
    flex: 1
  },
  a4PreviewScrollContent: {
    padding: 20,
    paddingBottom: 110
  },


  templateWrapper: {
    backgroundColor: '#fff',
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    overflow: 'hidden',
    width: '100%'
  },
  previewFooterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: 20,
    paddingHorizontal: 12
  },
  previewFooterText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    flex: 1,
    lineHeight: 16
  },
  a4PreviewActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1.5,
    borderTopColor: '#f1f5f9',
    gap: 12,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },



  a4BackBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  a4BackBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#64748b'
  },
  a4PrintBtn: {
    flex: 1.5,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  a4PrintBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#fff'
  }
});