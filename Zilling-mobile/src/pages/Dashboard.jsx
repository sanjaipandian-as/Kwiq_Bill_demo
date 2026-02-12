import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Modal, Dimensions, TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Receipt, ChevronRight, AlertTriangle, Clock, TrendingUp, IndianRupee, Menu,
  Package, ArrowUpRight, Users, Settings, FileText, BarChart3, Scan, Check, CheckCircle2, ChevronDown, Trophy
} from 'lucide-react-native';

import SideMenu from '../components/SideMenu';
import ExpenseModal from './Expenses/ExpenseModal';
import { useProducts } from '../context/ProductContext';
import { useTransactions } from '../context/TransactionContext';
import { useAuth } from '../context/AuthContext';
import { useExpenses } from '../context/ExpenseContext';
import { useCustomers } from '../context/CustomerContext';
import ScanBarcodeModal from '../components/ScanBarcodeModal';

const { width } = Dimensions.get('window');

const getStartOfWeek = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
};

const StatTile = ({ title, value, sub }) => (
  <View style={styles.statTile}>
    <Text style={styles.statTileTitle}>{title}</Text>
    <Text style={styles.statTileValue}>{value}</Text>
    <Text style={styles.statTileSub}>{sub}</Text>
  </View>
);

const IconButton = ({ icon: Icon, label, color, onPress }) => (
  <Pressable style={styles.iconBtnWrapper} onPress={onPress}>
    <LinearGradient
      colors={color === '#22c55e' ? ['#22c55e', '#16a34a'] : ['#ef4444', '#dc2626']}
      style={styles.iconSquare}
    >
      <Icon size={24} color="#fff" />
    </LinearGradient>
    <Text style={styles.iconLabel}>{label}</Text>
  </Pressable>
);

const FinancialCard = ({ title, value, icon: Icon, isPositive }) => (
  <View style={styles.finCard}>
    <View style={[styles.finIcon, { backgroundColor: isPositive ? '#22c55e' : '#ef4444' }]}>
      <Icon size={20} color="#fff" />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.finLabel}>{title}</Text>
      <Text style={[styles.finValue, { color: isPositive ? '#22c55e' : '#ef4444' }]}>{value}</Text>
    </View>
  </View>
);

export default function Dashboard() {
  const navigation = useNavigation();
  const { products } = useProducts();
  const { transactions } = useTransactions();
  const { expenses } = useExpenses();
  const { customers } = useCustomers();
  const { user } = useAuth();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState('This Week');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [productFilter, setProductFilter] = useState('All');
  const [showProductFilter, setShowProductFilter] = useState(false);

  const metrics = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let filteredTx = [];
    let filteredExp = [];

    // Filter Logic
    switch (dateFilter) {
      case 'Today':
        filteredTx = transactions.filter(t => new Date(t.date) >= todayStart);
        filteredExp = expenses.filter(e => new Date(e.date) >= todayStart);
        break;
      case 'Yesterday':
        const yestStart = new Date(todayStart);
        yestStart.setDate(todayStart.getDate() - 1);
        filteredTx = transactions.filter(t => {
          const d = new Date(t.date);
          return d >= yestStart && d < todayStart;
        });
        filteredExp = expenses.filter(e => {
          const d = new Date(e.date);
          return d >= yestStart && d < todayStart;
        });
        break;
      case 'This Week':
        const weekStart = getStartOfWeek(now);
        filteredTx = transactions.filter(t => new Date(t.date) >= weekStart);
        filteredExp = expenses.filter(e => new Date(e.date) >= weekStart);
        break;
      case 'Last Month':
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        filteredTx = transactions.filter(t => {
          const d = new Date(t.date);
          return d >= lastMonthStart && d <= lastMonthEnd;
        });
        filteredExp = expenses.filter(e => {
          const d = new Date(e.date);
          return d >= lastMonthStart && d <= lastMonthEnd;
        });
        break;
      case 'This Month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        filteredTx = transactions.filter(t => new Date(t.date) >= monthStart);
        filteredExp = expenses.filter(e => new Date(e.date) >= monthStart);
        break;
      default: // Last 7 Days (fallback)
        const sevenDaysAgo = new Date(todayStart);
        sevenDaysAgo.setDate(todayStart.getDate() - 7);
        filteredTx = transactions.filter(t => new Date(t.date) >= sevenDaysAgo);
        filteredExp = expenses.filter(e => new Date(e.date) >= sevenDaysAgo);
    }

    const totalSales = filteredTx.reduce((sum, t) => sum + (t.total || 0), 0);
    const totalExpenses = filteredExp.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netProfit = totalSales - totalExpenses;
    const pending = filteredTx.filter(t => (t.status || '').toUpperCase() !== 'PAID');
    const pendingAmount = pending.reduce((sum, t) => sum + (t.total || 0), 0);
    const paid = filteredTx.length - pending.length;

    // Low Stock (independent of date)
    const lowStock = products.filter(p => (parseFloat(p.stock) || 0) < 10);

    // Top Customers
    const custMap = {};
    filteredTx.forEach(t => {
      const name = t.customerName || 'Walk-in';
      if (!custMap[name]) custMap[name] = 0;
      custMap[name] += (t.total || 0);
    });
    const topCust = Object.entries(custMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, total]) => ({ name, total }));

    // Top Products - Separate Filter
    let productFilteredTx = [];
    switch (productFilter) {
      case 'Today':
        productFilteredTx = transactions.filter(t => new Date(t.date) >= todayStart);
        break;
      case 'Yesterday':
        const prodYestStart = new Date(todayStart);
        prodYestStart.setDate(todayStart.getDate() - 1);
        productFilteredTx = transactions.filter(t => {
          const d = new Date(t.date);
          return d >= prodYestStart && d < todayStart;
        });
        break;
      case 'This Week':
        const prodWeekStart = getStartOfWeek(now);
        productFilteredTx = transactions.filter(t => new Date(t.date) >= prodWeekStart);
        break;
      case 'This Month':
        const prodMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        productFilteredTx = transactions.filter(t => new Date(t.date) >= prodMonthStart);
        break;
      case 'Last Month':
        const prodLastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prodLastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        productFilteredTx = transactions.filter(t => {
          const d = new Date(t.date);
          return d >= prodLastMonthStart && d <= prodLastMonthEnd;
        });
        break;
      default: // All
        productFilteredTx = transactions;
    }

    const prodMap = {};
    productFilteredTx.forEach(t => {
      (t.items || []).forEach(item => {
        if (!prodMap[item.name]) prodMap[item.name] = { qty: 0, revenue: 0 };
        prodMap[item.name].qty += (item.quantity || 0);
        prodMap[item.name].revenue += (item.total || 0);
      });
    });
    const topProd = Object.entries(prodMap)
      .sort(([, a], [, b]) => b.qty - a.qty)
      .slice(0, 10)
      .map(([name, data]) => ({ name, ...data }));

    // Global Pending Due (Total Outstanding Debt - Date Independent)
    const globalPendingAmount = transactions.reduce((sum, t) => {
      const total = parseFloat(t.total || 0);
      const received = parseFloat(t.amountReceived || 0);
      const due = Math.max(0, total - received);
      return sum + due;
    }, 0);

    return {
      totalSales,
      totalExpenses,
      netProfit,
      pendingCount: pending.length,
      pendingAmount: globalPendingAmount, // Use Global Pending for the Dashboard Card
      paidCount: paid,
      lowStock,
      topCust,
      topProd,
      featuredProduct: topProd[0] || null
    };
  }, [transactions, products, expenses, dateFilter, productFilter]);

  const dateOptions = ['Today', 'Yesterday', 'This Week', 'This Month', 'Last Month', 'All'];
  const productFilterOptions = ['Today', 'Yesterday', 'This Week', 'This Month', 'Last Month', 'All'];

  return (
    <View style={styles.mainContainer}>
      <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      {/* 1. Enhanced Mesh Gradient Header */}
      <View style={styles.headerWrapper}>
        <LinearGradient
          colors={['#000000', '#1a1a1a']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={['top']}>
            <View style={styles.topBar}>
              <View style={styles.userRow}>
                <Pressable onPress={() => setIsMenuOpen(true)} style={styles.hamburger}>
                  <Menu size={24} color="#fff" />
                </Pressable>
                <View>
                  <Text style={styles.greeting}>Hello,</Text>
                  <Text style={styles.userName}>{user?.name || 'Sanjai Pandian'}</Text>
                </View>
              </View>

              <Pressable style={styles.scanBtn} onPress={() => setIsScannerOpen(true)}>
                <Scan size={20} color="#000" />
              </Pressable>
            </View>

            {/* Date Filter Section - Full Width */}
            <Pressable style={styles.dateFilterSection} onPress={() => setShowDatePicker(true)}>
              <View style={styles.dateFilterContent}>
                <Text style={styles.dateFilterLabel}>Period</Text>
                <View style={styles.dateFilterValueRow}>
                  <Text style={styles.dateFilterValue}>{dateFilter}</Text>
                  <ChevronDown size={18} color="#fff" />
                </View>
              </View>
            </Pressable>

            <View style={styles.summaryCard}>
              <StatTile title="Total Invoices" value={metrics.paidCount + metrics.pendingCount} sub={dateFilter} />
              <View style={styles.vDivider} />
              <StatTile title="Paid" value={metrics.paidCount} sub={dateFilter} />
              <View style={styles.vDivider} />
              <StatTile title="Pending" value={metrics.pendingCount} sub={dateFilter} />
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>

      <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.bodyWrapper}>

          {/* Action Grid */}
          <View style={styles.actionGrid}>
            <IconButton icon={FileText} label="Create Invoice" color="#22c55e" onPress={() => navigation.navigate('Billing')} />
            <IconButton icon={BarChart3} label="Reports" color="#22c55e" onPress={() => navigation.navigate('Reports')} />
            <IconButton icon={Users} label="Customers" color="#22c55e" onPress={() => navigation.navigate('Customers')} />
            <IconButton icon={Package} label="Products" color="#22c55e" onPress={() => navigation.navigate('Products')} />
            <IconButton icon={Receipt} label="Expenses" color="#ef4444" onPress={() => setIsExpenseModalOpen(true)} />
            <IconButton icon={Settings} label="Settings" color="#ef4444" onPress={() => navigation.navigate('Settings')} />
          </View>

          {/* Financial Cards */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.finScroll}>
            <FinancialCard title="Total Revenue" value={`₹${metrics.totalSales.toLocaleString()}`} icon={TrendingUp} isPositive={true} />
            <FinancialCard title="Total Expenses" value={`₹${metrics.totalExpenses.toLocaleString()}`} icon={IndianRupee} isPositive={false} />
            <FinancialCard title="Net Profit" value={`₹${metrics.netProfit.toLocaleString()}`} icon={IndianRupee} isPositive={metrics.netProfit >= 0} />
            <FinancialCard title="Pending Due" value={`₹${metrics.pendingAmount.toLocaleString()}`} icon={Clock} isPositive={false} />
          </ScrollView>

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

          {/* Top Selling Card - Hero Section */}
          {metrics.featuredProduct && (
            <View style={[styles.contentCard, { backgroundColor: '#000', paddingVertical: 25 }]}>
              <View style={[styles.cardHeaderRow, { marginBottom: 20 }]}>
                <Trophy size={20} color="#fbbf24" />
                <Text style={[styles.cardHeaderTitle, { color: '#fff' }]}>Best Selling Period Item</Text>
              </View>
              <View style={{ paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#fbbf24', alignItems: 'center', justifyContent: 'center', elevation: 10 }}>
                  <Text style={{ fontSize: 24, fontWeight: '900', color: '#000' }}>#1</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>{metrics.featuredProduct.name}</Text>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                    Sold {metrics.featuredProduct.qty} units • Revenue ₹{metrics.featuredProduct.revenue.toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Analytics Performance */}
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

          {/* Top Products Card */}
          <View style={styles.contentCard}>
            <View style={styles.cardHeaderWithFilter}>
              <View style={styles.cardHeaderRow}>
                <Package size={18} color="#000" />
                <Text style={styles.cardHeaderTitle}>Top 10 Selling Items</Text>
              </View>
              <Pressable style={styles.miniFilterBtn} onPress={() => setShowProductFilter(true)}>
                <Text style={styles.miniFilterText}>{productFilter}</Text>
                <ChevronDown size={14} color="#64748b" />
              </Pressable>
            </View>
            {metrics.topProd.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizList}>
                {metrics.topProd.map((p, i) => (
                  <View key={i} style={styles.productCard}>
                    <View style={styles.productRank}>
                      <Text style={styles.productRankText}>#{i + 1}</Text>
                    </View>
                    <View style={styles.productIconBg}>
                      <Package size={20} color="#22c55e" />
                    </View>
                    <Text style={styles.productName} numberOfLines={2}>{p.name}</Text>
                    <View style={styles.productStats}>
                      <Text style={styles.productQty}>{p.qty}</Text>
                      <Text style={styles.productLabel}>sold</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyState}>
                <Package size={32} color="#cbd5e1" />
                <Text style={styles.emptyStateText}>No sales data for {productFilter.toLowerCase()}</Text>
              </View>
            )}
          </View>

          {/* Top Customers Card */}
          <View style={styles.contentCard}>
            <View style={styles.cardHeaderRow}>
              <Users size={18} color="#000" />
              <Text style={styles.cardHeaderTitle}>Top Customers</Text>
            </View>
            {metrics.topCust.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizList}>
                {metrics.topCust.map((c, i) => (
                  <View key={i} style={styles.customerCard}>
                    <View style={styles.customerRank}>
                      <Text style={styles.customerRankText}>#{i + 1}</Text>
                    </View>
                    <View style={styles.customerAvatar}>
                      <Text style={styles.customerAvatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.customerName} numberOfLines={1}>{c.name}</Text>
                    <View style={styles.customerAmount}>
                      <Text style={styles.customerAmountValue}>₹{c.total.toLocaleString()}</Text>
                      <Text style={styles.customerAmountLabel}>total</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyState}>
                <Users size={32} color="#cbd5e1" />
                <Text style={styles.emptyStateText}>No customer data yet</Text>
              </View>
            )}
          </View>

          {/* Recent Expenses Card */}
          <View style={styles.contentCard}>
            <View style={styles.cardHeaderRow}>
              <Receipt size={18} color="#ef4444" />
              <Text style={styles.cardHeaderTitle}>Recent Expenses</Text>
            </View>
            {expenses.length > 0 ? (
              <View style={styles.expenseCardList}>
                {expenses.slice(0, 5).map((exp, idx) => (
                  <View key={exp.id || `exp-${idx}`} style={styles.expenseCard}>
                    <View style={styles.expenseIconWrapper}>
                      <Receipt size={18} color="#ef4444" />
                    </View>
                    <View style={styles.expenseCardInfo}>
                      <Text style={styles.expenseTitle}>{exp.title}</Text>
                      <View style={styles.expenseMetaRow}>
                        <Text style={styles.expenseCategory}>{exp.category}</Text>
                        <Text style={styles.expenseDot}>•</Text>
                        <Text style={styles.expenseDate}>{new Date(exp.date || Date.now()).toLocaleDateString()}</Text>
                      </View>
                    </View>
                    <Text style={styles.expenseAmount}>-₹{(exp.amount || 0).toLocaleString()}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Receipt size={32} color="#cbd5e1" />
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
                    <View style={[styles.txnIconWrapper, { backgroundColor: isPaid ? '#dcfce7' : '#fee2e2' }]}>
                      <Receipt size={20} color={isPaid ? '#22c55e' : '#ef4444'} />
                    </View>
                    <View style={styles.txnCardInfo}>
                      <Text style={styles.txnCardCustomer}>{tx.customerName || 'Walk-in Customer'}</Text>
                      <View style={styles.txnCardMetaRow}>
                        <Text style={styles.txnCardInvoice}>INV-{tx.invoiceNumber || '001'}</Text>
                        <Text style={styles.txnCardDot}>•</Text>
                        <Text style={styles.txnCardDate}>{new Date(tx.date || Date.now()).toLocaleDateString()}</Text>
                      </View>
                    </View>
                    <View style={styles.txnCardRight}>
                      <Text style={styles.txnCardAmount}>₹{(tx.total || 0).toLocaleString()}</Text>
                      <View style={[styles.txnStatusBadge, { backgroundColor: isPaid ? '#dcfce7' : '#fee2e2' }]}>
                        <View style={[styles.statusDot, { backgroundColor: isPaid ? '#22c55e' : '#ef4444' }]} />
                        <Text style={[styles.txnStatusText, { color: isPaid ? '#22c55e' : '#ef4444' }]}>
                          {isPaid ? 'Paid' : 'Unpaid'}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>

      <ExpenseModal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} />

      {/* Barcode Scanner Modal */}
      <ScanBarcodeModal
        visible={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
      />

      {/* Date Picker Modal */}
      <Modal visible={showDatePicker} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Period</Text>
            {dateOptions.map(opt => (
              <TouchableOpacity
                key={opt}
                style={styles.optionRow}
                onPress={() => { setDateFilter(opt); setShowDatePicker(false); }}
              >
                <Text style={[styles.optionText, dateFilter === opt && styles.selectedOptionText]}>{opt}</Text>
                {dateFilter === opt && <Check size={16} color="#22c55e" />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Product Filter Modal */}
      <Modal visible={showProductFilter} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowProductFilter(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter Products</Text>
            {productFilterOptions.map(opt => (
              <TouchableOpacity
                key={opt}
                style={styles.optionRow}
                onPress={() => { setProductFilter(opt); setShowProductFilter(false); }}
              >
                <Text style={[styles.optionText, productFilter === opt && styles.selectedOptionText]}>{opt}</Text>
                {productFilter === opt && <Check size={16} color="#22c55e" />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#f8fafc' },
  headerWrapper: { backgroundColor: '#fff' },
  headerGradient: { paddingBottom: 40, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, marginBottom: 20 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  greeting: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  userName: { fontSize: 20, fontWeight: '800', color: '#fff' },
  hamburger: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 12 },
  scanBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },

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
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, paddingTop: 25 },
  iconBtnWrapper: { width: '33.3%', alignItems: 'center', marginBottom: 25 },
  iconSquare: { width: 66, height: 66, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 10, backgroundColor: '#fff', elevation: 2 },
  iconLabel: { fontSize: 12, fontWeight: '700', color: '#475569', textAlign: 'center', marginTop: 4 },

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
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    minHeight: 36,
  },
  productStats: {
    alignItems: 'center',
    gap: 2,
  },
  productQty: {
    fontSize: 18,
    fontWeight: '800',
    color: '#22c55e',
  },
  productLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
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
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2563eb',
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
    fontWeight: '800',
    color: '#2563eb',
  },
  customerAmountLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
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
    fontSize: 12,
    fontWeight: '500',
    color: '#94a3b8',
  },
  txnCardRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  txnCardAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
  },
  txnStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  txnStatusText: {
    fontSize: 11,
    fontWeight: '700',
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

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: 'white', borderRadius: 16, padding: 20, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#0f172a' },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  optionText: { fontSize: 16, color: '#334155' },
  selectedOptionText: { color: '#2563eb', fontWeight: 'bold' }
});