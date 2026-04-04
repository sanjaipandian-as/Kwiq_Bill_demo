import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Modal, Dimensions, TouchableOpacity, Image, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronRight, AlertTriangle, Clock, TrendingUp, IndianRupee, Menu,
  Package, ArrowUpRight, Users, Settings, FileText, BarChart3, Scan, Check, CheckCircle2, ChevronDown, Trophy, Percent
} from 'lucide-react-native';

import SideMenu from '../components/SideMenu';
import BroadcastOverlay from '../components/BroadcastOverlay';
import SyncOverlay from '../components/SyncOverlay';
import ExpenseModal from './Expenses/ExpenseModal';
import { useProducts } from '../context/ProductContext';
import { useTransactions } from '../context/TransactionContext';
import { useAuth } from '../context/AuthContext';
import { useExpenses } from '../context/ExpenseContext';
import { useCustomers } from '../context/CustomerContext';
import ScanBarcodeModal from '../components/ScanBarcodeModal';
import { useSettings } from '../context/SettingsContext';
import { APP_VERSION } from '../config/version';
import { useSmartSync } from '../hooks/useSmartSync';
import { InteractionManager } from 'react-native';
import BankBanner from '../components/BankBanner';

// Optimized Sub-components
import DashboardHeader from '../components/dashboard/DashboardHeader';
import ActionGrid from '../components/dashboard/ActionGrid';
import FinancialSummary from '../components/dashboard/FinancialSummary';
import PerformanceList from '../components/dashboard/PerformanceList';
import DashboardFAB from '../components/dashboard/DashboardFAB';


const { width } = Dimensions.get('window');

const getStartOfWeek = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day; // Start week on Sunday
  d.setDate(diff);
  return d;
};

const StatTile = React.memo(({ title, value, sub }) => (
  <View style={styles.statTile}>
    <Text style={styles.statTileTitle}>{title}</Text>
    <Text style={styles.statTileValue}>{value}</Text>
    <Text style={styles.statTileSub}>{sub}</Text>
  </View>
));

const IconButton = React.memo(({ icon: Icon, label, color, onPress }) => (
  <Pressable style={styles.iconBtnWrapper} onPress={onPress}>
    <LinearGradient
      colors={color === '#22c55e' ? ['#22c55e', '#16a34a'] : ['#ef4444', '#dc2626']}
      style={styles.iconSquare}
    >
      <Icon size={24} color="#fff" />
    </LinearGradient>
    <Text style={styles.iconLabel}>{label}</Text>
  </Pressable>
));

const FinancialCard = React.memo(({ title, value, icon: Icon, isPositive }) => (
  <View style={styles.finCard}>
    <View style={[styles.finIcon, { backgroundColor: isPositive ? '#22c55e' : '#ef4444' }]}>
      <Icon size={20} color="#fff" />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.finLabel}>{title}</Text>
      <Text style={[styles.finValue, { color: isPositive ? '#22c55e' : '#ef4444' }]}>{value}</Text>
    </View>
  </View>
));

import { debouncedNavigate } from '../utils/navigationUtils';

export default function Dashboard() {
  const navigation = useNavigation();
  const { products } = useProducts();
  const { transactions, dashboardMetrics } = useTransactions();
  const { expenses } = useExpenses();
  const { customers } = useCustomers();
  const auth = useAuth();
  const user = auth ? auth.user : null;
  const { settings } = useSettings();
  const storeLogo = settings?.store?.logo;

  // Smart Sync Integration
  const { isSyncing } = useSmartSync(user);

  // 🚀 UX IMPROVEMENT: Force the sync handshake to show on every app launch
  // to provide a premium 'Modern Noir' security feeling.
  const [launchSync, setLaunchSync] = useState(true);
  React.useEffect(() => {
    const timer = setTimeout(() => setLaunchSync(false), 7500);
    return () => clearTimeout(timer);
  }, []);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  React.useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setIsReady(true));
    return () => task.cancel();
  }, []);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState('All');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [productFilter, setProductFilter] = useState('All');
  const [showProductFilter, setShowProductFilter] = useState(false);

  const handleAction = React.useCallback((screen) => {
    if (screen === 'Expenses') setIsExpenseModalOpen(true);
    else debouncedNavigate(navigation, screen);
  }, [navigation]);

  const handleMenuPress = React.useCallback(() => setIsMenuOpen(true), []);
  const handleDatePickerPress = React.useCallback(() => setShowDatePicker(true), []);

  const metrics = useMemo(() => {
    if (!isReady || !Array.isArray(transactions) || !Array.isArray(products) || !Array.isArray(expenses)) {
      return { totalSales: 0, totalExpenses: 0, netProfit: 0, pendingCount: 0, pendingAmount: 0, paidCount: 0, lowStock: [], topCust: [], topProd: [], featuredProduct: null, totalInvoices: 0 };
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const isGlobalFilter = dateFilter === 'All';

    const isDateInRange = (dateStr) => {
      if (isGlobalFilter) return true;
      if (!dateStr) return false;

      // Handle various date formats (ISO string, timestamp, etc.)
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;

      // Important: Use local day boundaries for comparison with todayStart
      const checkDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

      switch (dateFilter) {
        case 'Today':
          return checkDate.getTime() === todayStart.getTime();
        case 'Yesterday':
          const yesterdayStart = new Date(todayStart);
          yesterdayStart.setDate(yesterdayStart.getDate() - 1);
          return checkDate.getTime() === yesterdayStart.getTime();
        case 'This Week':
          return checkDate >= getStartOfWeek(now);
        case 'This Month':
          return checkDate >= new Date(now.getFullYear(), now.getMonth(), 1);
        case 'Last Month':
          const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          return checkDate >= lastMonthStart && checkDate < firstOfThisMonth;
        default:
          return true;
      }
    };

    let filteredTx = isGlobalFilter ? transactions : transactions.filter(t => isDateInRange(t.date));
    let filteredExp = isGlobalFilter ? expenses : expenses.filter(e => isDateInRange(e.date));

    const totalSales = isGlobalFilter && dashboardMetrics ? dashboardMetrics.totalSales : filteredTx.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);
    const totalExpenses = filteredExp.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const netProfit = totalSales - totalExpenses;

    const pendingCount = isGlobalFilter && dashboardMetrics ? dashboardMetrics.pendingCount : filteredTx.filter(t => (t.status || '').toUpperCase() !== 'PAID').length;
    // FIX: pendingAmount was hardcoded to 0 for filtered views
    const pendingAmount = isGlobalFilter && dashboardMetrics ? dashboardMetrics.pendingAmount : filteredTx.reduce((sum, t) => {
      if ((t.status || '').toUpperCase() !== 'PAID') {
        return sum + (parseFloat(t.total) - (parseFloat(t.amountReceived) || 0));
      }
      return sum;
    }, 0);

    const totalInvoices = isGlobalFilter && dashboardMetrics ? dashboardMetrics.totalCount : filteredTx.length;
    const paidCount = totalInvoices - pendingCount;

    // Low Stock (independent of date)
    const lowStock = products.filter(p => {
      if (!p) return false;
      const stock = parseFloat(p.stock) || 0;
      const minStock = parseFloat(p.min_stock) || parseFloat(p.minStock) || 0;
      return minStock > 0 && stock <= minStock;
    });

    // Top Lists (Slice early for speed)
    const prodMap = {};
    filteredTx.forEach(t => {
      (t.items || []).forEach(item => {
        if (!prodMap[item.name]) prodMap[item.name] = { qty: 0, revenue: 0 };
        prodMap[item.name].qty += (parseFloat(item.quantity) || 0);
        prodMap[item.name].revenue += (parseFloat(item.total) || 0);
      });
    });
    const topProd = Object.entries(prodMap)
      .sort(([, a], [, b]) => b.qty - a.qty)
      .slice(0, 10)
      .map(([name, data]) => ({ name, ...data }));

    const custMap = {};
    filteredTx.forEach(t => {
      const name = t.customerName || 'Guest';
      if (!custMap[name]) custMap[name] = 0;
      custMap[name] += (parseFloat(t.total) || 0);
    });
    const topCust = Object.entries(custMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, total]) => ({ name, total }));

    return {
      totalSales,
      totalExpenses,
      netProfit,
      pendingCount,
      pendingAmount,
      paidCount,
      lowStock,
      topCust,
      topProd,
      featuredProduct: topProd[0] || null,
      totalInvoices
    };
  }, [isReady, transactions, products, expenses, dateFilter, productFilter, dashboardMetrics]);



  const dateOptions = ['Today', 'Yesterday', 'This Week', 'This Month', 'Last Month', 'All'];
  const productFilterOptions = ['Today', 'Yesterday', 'This Week', 'This Month', 'Last Month', 'All'];

  return (
    <View style={styles.mainContainer}>
      <BroadcastOverlay />

      <SyncOverlay isVisible={isSyncing || launchSync} />
      <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      {/* 1. Enhanced Mesh Gradient Header */}
      <DashboardHeader
        user={user}
        storeLogo={storeLogo}
        isSyncing={isSyncing || launchSync}
        onMenuPress={handleMenuPress}
        dateFilter={dateFilter}
        onDatePickerPress={handleDatePickerPress}
        totalInvoices={metrics.totalInvoices}
        paidCount={metrics.paidCount}
        pendingCount={metrics.pendingCount}
      />

      <BankBanner />

      <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
        {!isReady ? (
          <View style={{ height: 400, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#64748b', fontWeight: 'bold' }}>Optimizing your dashboard...</Text>
          </View>
        ) : (
          <View style={styles.bodyWrapper}>
            <ActionGrid onAction={handleAction} />

            <FinancialSummary
              totalSales={metrics.totalSales}
              totalExpenses={metrics.totalExpenses}
              netProfit={metrics.netProfit}
              pendingAmount={metrics.pendingAmount}
            />

            {/* Alerts Section (Conditional) */}
            {metrics.lowStock.length > 0 ? (
              <Pressable style={styles.alertBox} onPress={() => navigation.navigate('LowStock')}>
                <View style={styles.alertIconBg}>
                  <AlertTriangle size={20} color="#dc2626" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertTitle}>Stock Warning</Text>
                  <Text style={styles.alertSub}>{metrics.lowStock.length} items are running low on stock</Text>
                </View>
                <ChevronRight size={20} color="#cbd5e1" />
              </Pressable>
            ) : (
              <View style={[styles.alertBox, { backgroundColor: '#ecfdf5', borderColor: '#d1fae5' }]}>
                <View style={styles.alertIconBg}>
                  <CheckCircle2 size={20} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.alertTitle, { color: '#047857' }]}>Inventory is Good</Text>
                  <Text style={[styles.alertSub, { color: '#059669' }]}>All products are sufficiently stocked</Text>
                </View>
              </View>
            )}

            {/* Analytics Performance (Keeping it inline for now or can be extracted) */}
            <View style={styles.analyticsCard}>
              <View style={styles.graphHeader}>
                <BarChart3 size={18} color="#000" />
                <Text style={styles.graphTitle}>Business Overview</Text>
              </View>
              <View style={styles.barItem}>
                <View style={styles.barRow}>
                  <Text style={styles.barLabel}>Total Sales</Text>
                  <Text style={styles.barVal}>₹{metrics.totalSales.toLocaleString()}</Text>
                </View>
                <View style={styles.track}><View style={[styles.fill, { width: '100%', backgroundColor: '#22c55e' }]} /></View>
              </View>
              <View style={styles.barItem}>
                <View style={styles.barRow}>
                  <Text style={styles.barLabel}>Total Expenses</Text>
                  <Text style={styles.barVal}>₹{metrics.totalExpenses.toLocaleString()}</Text>
                </View>
                <View style={styles.track}><View style={[styles.fill, { width: `${Math.min((metrics.totalExpenses / metrics.totalSales || 0.1) * 100, 100)}%`, backgroundColor: '#ef4444' }]} /></View>
              </View>
            </View>

            <PerformanceList
              title="Top 10 Selling Items"
              data={metrics.topProd}
              type="product"
              filterValue={productFilter}
              onFilterPress={() => setShowProductFilter(true)}
              emptyMessage={`No sales data for ${productFilter.toLowerCase()}`}
              icon={Package}
            />

            <PerformanceList
              title="Top Customers"
              data={metrics.topCust}
              type="customer"
              emptyMessage="No customer data yet"
              icon={Users}
            />

            {/* Recent Expenses Card */}
            <View style={styles.contentCard}>
              <View style={styles.cardHeaderRow}>
                <IndianRupee size={18} color="#ef4444" />
                <Text style={styles.cardHeaderTitle}>Recent Expenses</Text>
              </View>
              {expenses.length > 0 ? (
                <View style={styles.expenseCardList}>
                  {expenses.slice(0, 5).map((exp, idx) => (
                    <View key={exp.id || `exp-${idx}`} style={styles.expenseCard}>
                      <View style={styles.expenseIconWrapper}>
                        <IndianRupee size={18} color="#ef4444" />
                      </View>
                      <View style={styles.expenseCardInfo}>
                        <Text style={styles.expenseTitle}>{exp.title}</Text>
                        <View style={styles.expenseMetaRow}>
                          <Text style={styles.expenseCategory}>{exp.category}</Text>
                          <Text style={styles.expenseDot}>•</Text>
                          <Text style={styles.expenseDate}>
                            {new Date(exp.date || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' })} | {new Date(exp.date || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.expenseAmount}>-₹{(exp.amount || 0).toLocaleString()}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <IndianRupee size={32} color="#cbd5e1" />
                  <Text style={styles.emptyStateText}>No expenses yet</Text>
                </View>
              )}
            </View>

            {/* Recent Transactions Card */}
            <View style={[styles.contentCard, { marginBottom: 100, paddingVertical: 24 }]}>
              <View style={styles.cardHeaderRow}>
                <Clock size={18} color="#000" />
                <Text style={styles.cardHeaderTitle}>Recent Transactions</Text>
              </View>
              <View style={styles.txnCardList}>
                {transactions.slice(0, 5).map((tx, idx) => {
                  const isPaid = (tx.status || 'PAID').toUpperCase() === 'PAID';
                  return (
                    <View key={tx.id ? tx.id.toString() : `tx-${idx}`} style={styles.txnCard}>
                      <View style={[styles.txnIconWrapper, { backgroundColor: isPaid ? '#000' : '#f1f5f9' }]}>
                        <IndianRupee size={20} color={isPaid ? '#fff' : '#000'} />
                      </View>
                      <View style={styles.txnCardInfo}>
                        <Text style={styles.txnCardCustomer} numberOfLines={1}>{tx.customerName || 'Guest'}</Text>
                        <View style={styles.txnCardMetaRow}>
                          <Text style={styles.txnCardInvoice}>INV-{tx.invoiceNumber || '001'}</Text>
                          <Text style={styles.txnCardDot}>•</Text>
                          <View style={styles.timeTag}>
                             <Clock size={10} color="#94a3b8" />
                             <Text style={styles.txnCardDate} numberOfLines={1}>
                               {new Date(tx.date || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                             </Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.txnCardRight}>
                        <Text style={styles.txnCardAmount}>₹{(tx.total || 0).toLocaleString()}</Text>
                        <View style={[styles.txnStatusBadge, { 
                          backgroundColor: isPaid ? '#000' : '#fff1f1', 
                          borderColor: isPaid ? '#000' : '#fee2e2' 
                        }]}>
                          <View style={[styles.statusDot, { backgroundColor: isPaid ? '#fff' : '#ef4444' }]} />
                          <Text style={[styles.txnStatusText, { color: isPaid ? '#fff' : '#ef4444' }]}>
                            {isPaid ? 'PAID' : 'DUE'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
            <View style={{ padding: 40, alignItems: 'center', opacity: 0.5 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748b', letterSpacing: 1.5 }}>KWIQ BILL • {APP_VERSION}</Text>
              <Text style={{ fontSize: 9, color: '#94a3b8', fontWeight: '700', marginTop: 4 }}>POWERED BY ZIPPY</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <DashboardFAB onPress={() => handleAction('Billing')} />




      <ExpenseModal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} />

      {/* Barcode Scanner Modal */}
      <ScanBarcodeModal
        visible={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
      />

      {/* Date Picker Bottom Sheet */}
      <Modal visible={showDatePicker} transparent animationType="slide">
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetCloser} onPress={() => setShowDatePicker(false)} />
          <View style={styles.sheetContent}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Period</Text>
            <View style={styles.sheetOptions}>
              {dateOptions.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.sheetOptionRow, dateFilter === opt && styles.sheetOptionActive]}
                  onPress={() => { setDateFilter(opt); setShowDatePicker(false); }}
                >
                  <Text style={[styles.sheetOptionText, dateFilter === opt && styles.sheetOptionTextActive]}>{opt}</Text>
                  {dateFilter === opt && <Check size={18} color="#000" />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Product Filter Bottom Sheet */}
      <Modal visible={showProductFilter} transparent animationType="slide">
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetCloser} onPress={() => setShowProductFilter(false)} />
          <View style={styles.sheetContent}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Filter Products</Text>
            <View style={styles.sheetOptions}>
              {productFilterOptions.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.sheetOptionRow, productFilter === opt && styles.sheetOptionActive]}
                  onPress={() => { setProductFilter(opt); setShowProductFilter(false); }}
                >
                  <Text style={[styles.sheetOptionText, productFilter === opt && styles.sheetOptionTextActive]}>{opt}</Text>
                  {productFilter === opt && <Check size={18} color="#000" />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>


    </View >



  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#f8fafc' },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerWrapper: { backgroundColor: '#fff' },
  headerGradient: { paddingBottom: 40, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 25
  },
  leftSection: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  greeting: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  userName: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  rightActions: { flexDirection: 'row', alignItems: 'center' },
  hamburger: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  topLogo: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff' },
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginRight: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  syncText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

  // Date Filter Section - Full Width
  dateFilterSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  dateFilterContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateFilterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
  },
  dateFilterValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateFilterValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  // Floating Summary Tile
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  statTile: { flex: 1 },
  statTileTitle: { fontSize: 11, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: 5 },
  statTileValue: { fontSize: 22, fontWeight: '900', color: '#1e293b' },
  statTileSub: { fontSize: 9, color: '#64748b', marginTop: 4 },
  vDivider: { width: 1, backgroundColor: '#f1f5f9', marginHorizontal: 12, height: '70%', alignSelf: 'center' },

  // Action Grid
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, paddingTop: 15 },
  iconBtnWrapper: { width: '33.3%', alignItems: 'center', marginBottom: 25 },
  iconSquare: { width: 66, height: 66, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 10, backgroundColor: '#fff', elevation: 2 },
  iconLabel: { fontSize: 12, fontWeight: '700', color: '#475569', textAlign: 'center', marginTop: 4 },

  // Trial Card Styles
  trialCardContainer: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  trialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  trialIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trialTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  trialSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  trialBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  trialBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000',
  },

  // Financial Scroll
  finScroll: { paddingHorizontal: 20, marginBottom: 25 },
  finCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 160,
    padding: 16,
    borderRadius: 20,
    marginRight: 12,
    height: 90,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    gap: 12
  },
  finIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  finLabel: { fontSize: 11, color: '#64748b', fontWeight: '700', marginBottom: 4 },
  finValue: { fontSize: 16, fontWeight: '800' },

  // Alerts
  alertBox: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginBottom: 20, backgroundColor: '#fef2f2', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#fee2e2' },
  alertIconBg: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  alertTitle: { fontSize: 14, fontWeight: '800', color: '#991b1b' },
  alertSub: { fontSize: 12, color: '#b91c1c' },

  // Analytics Progress
  analyticsCard: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 25, borderWidth: 1, borderColor: '#f1f5f9' },
  graphHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  graphTitle: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  barItem: { marginBottom: 15 },
  barRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  barLabel: { fontSize: 11, color: '#64748b', fontWeight: '700', textTransform: 'uppercase' },
  barVal: { fontSize: 12, fontWeight: '800', color: '#1e293b' },
  track: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },

  // Section & Horizontal Lists
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', marginHorizontal: 20, marginBottom: 16 },
  horizList: { paddingHorizontal: 20, paddingBottom: 10 },
  itemCard: { backgroundColor: '#fff', width: 140, padding: 12, borderRadius: 16, marginRight: 12, borderWidth: 1, borderColor: '#f1f5f9', height: 100, justifyContent: 'center' },
  rankDot: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8, alignSelf: 'flex-start', marginRight: 0 },
  rankNum: { fontSize: 10, fontWeight: '900' },
  itemName: { fontSize: 13, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  itemSub: { fontSize: 11, color: '#64748b' },
  emptyTxt: { marginLeft: 20, color: '#94a3b8', fontStyle: 'italic' },

  custCard: { backgroundColor: '#fff', width: 120, padding: 12, borderRadius: 16, marginRight: 12, alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9', height: 110, justifyContent: 'center' },
  custAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0f9ff', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarTxt: { fontSize: 16, fontWeight: '800', color: '#0284c7' },

  contentCard: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 24, paddingVertical: 20, marginBottom: 20, shadowColor: '#64748b', shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, marginBottom: 15 },
  cardHeaderTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b' },

  // Card Header with Filter
  cardHeaderWithFilter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  miniFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  miniFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },

  // Product Cards - Improved Design
  productCard: {
    backgroundColor: '#fff',
    width: 140,
    padding: 14,
    borderRadius: 18,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    gap: 10,
  },
  productRank: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  productRankText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
  },
  productIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    minHeight: 36,
  },
  productStats: {
    alignItems: 'center',
    gap: 2,
  },
  productQty: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
  },
  productLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },

  // Customer Cards - Improved Design
  customerCard: {
    backgroundColor: '#fff',
    width: 130,
    padding: 14,
    borderRadius: 18,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    gap: 8,
  },
  customerRank: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  customerRankText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
  },
  customerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
  },
  customerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
  },
  customerAmount: {
    alignItems: 'center',
    gap: 2,
  },
  customerAmountValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000',
  },
  customerAmountLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },

  // Expense Cards - Modern Design
  expenseCardList: { paddingHorizontal: 20, gap: 10 },
  expenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  expenseIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseCardInfo: {
    flex: 1,
    gap: 4,
  },
  expenseTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  expenseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expenseCategory: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  expenseDot: {
    fontSize: 11,
    color: '#cbd5e1',
  },
  expenseDate: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94a3b8',
  },
  expenseAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ef4444',
  },

  // Empty States
  emptyState: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 12,
  },
  emptyStateText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    textAlign: 'center',
  },

  // Transaction Cards - Modern Design
  txnCardList: { paddingHorizontal: 20, gap: 12 },
  txnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  txnIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnCardInfo: {
    flex: 1,
    gap: 4,
  },
  txnCardCustomer: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  txnCardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  txnCardInvoice: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  txnCardDot: {
    fontSize: 12,
    color: '#cbd5e1',
  },
  txnCardDate: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  txnCardRight: {
    alignItems: 'flex-end',
    gap: 4,
    minWidth: 80,
    marginLeft: 8,
  },
  txnCardAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1e293b',
  },
  txnStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 50,
    gap: 5,
    borderWidth: 1,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  txnStatusText: {
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },

  // Old List Styles (kept for other sections)
  txnList: { paddingHorizontal: 20 },
  txnItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  txnInfo: { flex: 1 },
  txnCustomer: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  txnMeta: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  txnRight: { alignItems: 'flex-end', gap: 6 },
  txnAmount: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '800' },

  contentScroll: { flex: 1 },
  bodyWrapper: { flex: 1 },

  // Bottom Sheet Premium Styles
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetCloser: {
    flex: 1,
  },
  sheetContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 25,
    paddingTop: 12,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 25,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 25,
    letterSpacing: -0.5,
  },
  sheetOptions: {
    gap: 12,
  },
  sheetOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  sheetOptionActive: {
    backgroundColor: '#fff',
    borderColor: '#000',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  sheetOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  sheetOptionTextActive: {
    color: '#000',
    fontWeight: '800',
  },
});