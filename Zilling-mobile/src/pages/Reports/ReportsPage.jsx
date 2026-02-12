import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Pressable,
  Modal,
  TouchableOpacity,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient'; // Added for Header
import {
  TrendingUp,
  CreditCard,
  ShoppingBag,
  ChevronLeft,
  Calendar,
  Wallet,
  Trophy,
  Package,
  Check,
  ArrowDownToLine,
  ChevronDown // Added
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop, Circle, G } from 'react-native-svg';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { generateBusinessReportHTML } from '../../utils/printUtils';
import { Button } from '../../components/ui/Button';

// Contexts
import { useTransactions } from '../../context/TransactionContext';
import { useProducts } from '../../context/ProductContext';
import { useCustomers } from '../../context/CustomerContext';
import { useExpenses } from '../../context/ExpenseContext';

const { width } = Dimensions.get('window');

// Date Helpers
const isSameDay = (d1, d2) => {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
};

const getStartOfWeek = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  d.setDate(diff);
  return d;
};

// Custom Sparkline Component
const Sparkline = ({ data, height = 180 }) => {
  const chartWidth = width - 64; // Account for padding
  if (!data || data.length === 0) {
    return (
      <View style={{ height, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#94a3b8' }}>No data for this period</Text>
      </View>
    );
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1; // Avoid division by zero

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * chartWidth;
    const y = height - ((val - min) / range) * (height * 0.7) - 20;
    return `${x},${y}`;
  });

  const pathData = points.length > 1 ? `M ${points.join(' L ')}` : `M 0,${height / 2} L ${chartWidth},${height / 2}`;

  return (
    <View style={{ height }}>
      <Svg width={chartWidth} height={height}>
        <Defs>
          <SvgLinearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
            <Stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>
        {/* Fill Area */}
        {points.length > 1 && (
          <Path
            d={`${pathData} L ${chartWidth},${height} L 0,${height} Z`}
            fill="url(#gradient)"
          />
        )}
        {/* Line */}
        <Path
          d={pathData}
          fill="none"
          stroke="#10b981"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};

const DonutChart = ({ percentage, color, radius = 45, strokeWidth = 10, label, subLabel }) => {
  const size = (radius + strokeWidth) * 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
            {/* Track */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#f1f5f9"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Indicator */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              fill="transparent"
              strokeLinecap="round"
            />
          </G>
        </Svg>
        <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>{percentage}%</Text>
        </View>
      </View>
      {label && <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a', marginTop: 10 }}>{label}</Text>}
      {subLabel && <Text style={{ fontSize: 11, fontWeight: '500', color: '#64748b', marginTop: 2 }}>{subLabel}</Text>}
    </View>
  );
};

export default function ReportsPage() {
  const navigation = useNavigation();
  const { transactions } = useTransactions();
  const { products } = useProducts();
  const { customers } = useCustomers();
  const { expenses } = useExpenses();

  const [dateFilter, setDateFilter] = useState('This Week');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(true);

  // Simulate initial load
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // --- Analytics Logic ---
  const analyticsData = useMemo(() => {
    if (!transactions) return null;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let filteredTx = [];
    let prevTx = [];
    let filteredExp = [];
    let prevExp = [];
    let labels = [];

    // Filter Logic for Current and Previous Periods
    switch (dateFilter) {
      case 'Today':
        filteredTx = transactions.filter(t => new Date(t.date) >= todayStart);
        filteredExp = expenses.filter(e => new Date(e.date) >= todayStart);

        const yestStart = new Date(todayStart);
        yestStart.setDate(todayStart.getDate() - 1);
        prevTx = transactions.filter(t => {
          const d = new Date(t.date);
          return d >= yestStart && d < todayStart;
        });
        prevExp = expenses.filter(e => {
          const d = new Date(e.date);
          return d >= yestStart && d < todayStart;
        });
        labels = ['Morning', 'Noon', 'Evening'];
        break;
      case 'Yesterday':
        const yest = new Date(todayStart);
        yest.setDate(todayStart.getDate() - 1);
        const dayBeforeYest = new Date(yest);
        dayBeforeYest.setDate(yest.getDate() - 1);

        filteredTx = transactions.filter(t => {
          const d = new Date(t.date);
          return d >= yest && d < todayStart;
        });
        filteredExp = expenses.filter(e => {
          const d = new Date(e.date);
          return d >= yest && d < todayStart;
        });

        prevTx = transactions.filter(t => {
          const d = new Date(t.date);
          return d >= dayBeforeYest && d < yest;
        });
        prevExp = expenses.filter(e => {
          const d = new Date(e.date);
          return d >= dayBeforeYest && d < yest;
        });
        labels = ['Morning', 'Noon', 'Evening'];
        break;
      case 'This Week':
        const weekStart = getStartOfWeek(now);
        const lastWeekStart = new Date(weekStart);
        lastWeekStart.setDate(weekStart.getDate() - 7);

        filteredTx = transactions.filter(t => new Date(t.date) >= weekStart);
        filteredExp = expenses.filter(e => new Date(e.date) >= weekStart);

        prevTx = transactions.filter(t => {
          const d = new Date(t.date);
          return d >= lastWeekStart && d < weekStart;
        });
        prevExp = expenses.filter(e => {
          const d = new Date(e.date);
          return d >= lastWeekStart && d < weekStart;
        });
        labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        break;
      case 'This Month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        filteredTx = transactions.filter(t => new Date(t.date) >= monthStart);
        filteredExp = expenses.filter(e => new Date(e.date) >= monthStart);

        prevTx = transactions.filter(t => {
          const d = new Date(t.date);
          return d >= lastMonthStart && d < monthStart;
        });
        prevExp = expenses.filter(e => {
          const d = new Date(e.date);
          return d >= lastMonthStart && d < monthStart;
        });
        labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
        break;
      case 'Last Month':
        const lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        const prevLmStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);

        filteredTx = transactions.filter(t => {
          const d = new Date(t.date);
          return d >= lmStart && d <= lmEnd;
        });
        filteredExp = expenses.filter(e => {
          const d = new Date(e.date);
          return d >= lmStart && d <= lmEnd;
        });

        prevTx = transactions.filter(t => {
          const d = new Date(t.date);
          return d >= prevLmStart && d < lmStart;
        });
        prevExp = expenses.filter(e => {
          const d = new Date(e.date);
          return d >= prevLmStart && d < lmStart;
        });
        labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
        break;
      default:
        const sevenDaysAgo = new Date(todayStart);
        sevenDaysAgo.setDate(todayStart.getDate() - 7);
        filteredTx = transactions.filter(t => new Date(t.date) >= sevenDaysAgo);
        filteredExp = expenses.filter(e => new Date(e.date) >= sevenDaysAgo);
        labels = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];
    }

    // --- Current Values ---
    const totalSales = filteredTx.reduce((sum, t) => sum + (t.total || 0), 0);
    const orderCount = filteredTx.length;
    const totalExpenses = filteredExp.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const netProfit = totalSales - totalExpenses;

    // --- Previous Values ---
    const prevSales = prevTx.reduce((sum, t) => sum + (t.total || 0), 0);
    const prevOrderCount = prevTx.length;
    const prevExpenses = prevExp.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const prevProfit = prevSales - prevExpenses;

    // Comparison for report
    const comparison = {
      sales: { current: totalSales, previous: prevSales },
      orders: { current: orderCount, previous: prevOrderCount },
      expenses: { current: totalExpenses, previous: prevExpenses },
      profit: { current: netProfit, previous: prevProfit }
    };

    // Date checker for manual filtering if needed
    const isInPeriod = (dateStr) => {
      // ... same logic if needed or skipped ...
      return true;
    };

    // 1. Metrics
    const averageOrderValue = orderCount > 0 ? (totalSales / orderCount) : 0;

    // Unique customers in this period
    const uniqueCustIds = new Set(filteredTx.map(t => t.customerId).filter(Boolean));
    const activeCustomers = uniqueCustIds.size;

    // Inventory Value
    const inventoryValue = products.reduce((sum, p) => sum + ((p.price || 0) * (p.stock || 0)), 0);

    // 2. Sales Trend
    let trendData = labels.map(() => 0);
    if (filteredTx.length > 0) {
      if (dateFilter === 'This Week') {
        const buckets = [0, 0, 0, 0, 0, 0, 0];
        filteredTx.forEach(t => {
          const d = new Date(t.date);
          const day = d.getDay();
          const idx = day === 0 ? 6 : day - 1;
          buckets[idx] += (t.total || 0);
        });
        trendData = buckets;
      } else {
        const avg = totalSales / labels.length;
        trendData = labels.map(() => avg);
      }
    }

    // 3. Top Products
    const productSales = {};
    filteredTx.forEach(t => {
      (t.items || []).forEach(item => {
        const id = item.productId || item.id || item.name;
        if (!productSales[id]) {
          const productRef = products.find(p => p.id === id) || {};
          productSales[id] = {
            name: item.name,
            sales: 0,
            total: 0,
            costPrice: productRef.costPrice || (item.price * 0.5) // Fallback to 50% margin if costPrice unavailable
          };
        }
        productSales[id].sales += (item.quantity || 0);
        productSales[id].total += (item.total || 0);
      });
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5)
      .map((p, i) => {
        const profit = p.total - (p.costPrice * p.sales);
        const margin = p.total > 0 ? (profit / p.total) * 100 : 0;
        return {
          ...p,
          margin: margin.toFixed(1),
          // Gradient of blacks/greys for a sleek look
          color: ['#0f172a', '#334155', '#475569', '#64748b', '#94a3b8'][i % 5]
        };
      });

    // 4. Payment Methods
    const paymentStats = {};
    filteredTx.forEach(t => {
      const method = t.paymentMethod || 'Cash';
      if (!paymentStats[method]) paymentStats[method] = { count: 0, revenue: 0 };
      paymentStats[method].count += 1;
      paymentStats[method].revenue += (t.total || 0);
    });

    const totalTxCount = filteredTx.length || 1;
    const paymentMethods = Object.keys(paymentStats).map((key, i) => ({
      name: key,
      revenue: paymentStats[key].revenue,
      percentage: Math.round((paymentStats[key].count / totalTxCount) * 100),
      color: ['#000000', '#10b981', '#ef4444', '#cbd5e1'][i % 4]
    }));

    return {
      totalSales,
      orderCount,
      averageOrderValue,
      totalExpenses,
      netProfit,
      activeCustomers,
      inventoryValue,
      comparison,
      trendData,
      topProducts,
      paymentMethods,
      labels
    };

  }, [transactions, products, expenses, dateFilter]);

  const handleExport = async () => {
    if (!analyticsData) return;
    try {
      const html = generateBusinessReportHTML(analyticsData, dateFilter);
      const { uri } = await Print.printToFileAsync({ html });
      await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (e) {
      console.error("Export Failed", e);
      alert("Failed to export report");
    }
  };

  if (loading || !analyticsData) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  const { totalSales, orderCount, averageOrderValue, totalExpenses, netProfit, activeCustomers, inventoryValue, trendData, topProducts, paymentMethods, labels } = analyticsData;
  const dateOptions = ['Today', 'Yesterday', 'This Week', 'This Month', 'Last Month'];

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" />

      {/* 1. Header Wrapper (Gradient) */}
      <View style={styles.headerWrapper}>
        <LinearGradient
          colors={['#000000', '#1a1a1a']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={['top']}>
            <View style={styles.topBar}>
              <View style={styles.headerLeft}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                  <ChevronLeft size={24} color="#fff" />
                </Pressable>
                <View>
                  <Text style={styles.headerTitle}>Analytics</Text>
                  <Text style={styles.headerSubtitle}>Business Performance</Text>
                </View>
              </View>

              <Pressable style={styles.exportBtn} onPress={handleExport}>
                <ArrowDownToLine size={20} color="#000" />
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
          </SafeAreaView>
        </LinearGradient>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Key Performance Indicators (KPIs) */}
        <View style={styles.kpiGrid}>
          {/* Total Sales */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <View style={[styles.iconCircle, { backgroundColor: '#f1f5f9' }]}>
                <TrendingUp size={18} color="#0f172a" />
              </View>
              <Text style={styles.kpiLabel}>TOTAL REVENUE</Text>
            </View>
            <Text style={styles.kpiValue}>₹{totalSales.toLocaleString()}</Text>
          </View>

          {/* Net Profit */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <View style={[styles.iconCircle, { backgroundColor: netProfit >= 0 ? '#dcfce7' : '#fee2e2' }]}>
                <Wallet size={18} color={netProfit >= 0 ? '#16a34a' : '#ef4444'} />
              </View>
              <Text style={styles.kpiLabel}>NET PROFIT</Text>
            </View>
            <Text style={[styles.kpiValue, { color: netProfit >= 0 ? '#16a34a' : '#ef4444' }]}>
              {netProfit >= 0 ? '+' : '-'}₹{Math.abs(netProfit).toLocaleString()}
            </Text>
          </View>

          {/* Orders */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <View style={[styles.iconCircle, { backgroundColor: '#f1f5f9' }]}>
                <ShoppingBag size={18} color="#0f172a" />
              </View>
              <Text style={styles.kpiLabel}>ORDERS</Text>
            </View>
            <Text style={styles.kpiValue}>{orderCount}</Text>
          </View>

          {/* Expenses */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <View style={[styles.iconCircle, { backgroundColor: '#fee2e2' }]}>
                <CreditCard size={18} color="#ef4444" />
              </View>
              <Text style={styles.kpiLabel}>EXPENSES</Text>
            </View>
            <Text style={[styles.kpiValue, { color: '#ef4444' }]}>₹{totalExpenses.toLocaleString()}</Text>
          </View>
        </View>


        {/* Budget Overview (Donut Charts) */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Budget Overview</Text>
            {/* Contextual Pill */}
            <View style={{ backgroundColor: netProfit > 0 ? '#dcfce7' : '#fee2e2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: netProfit > 0 ? '#16a34a' : '#ef4444' }}>
                {netProfit > 0 ? 'HEALTHY' : 'ATTENTION'}
              </Text>
            </View>
          </View>

          <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 20 }}>
            {netProfit > 0
              ? 'Your business is profitable. Keep monitoring expenses to maximize margins.'
              : 'Expenses are exceeding revenue. Review your spending.'}
          </Text>

          <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 10 }}>
            <DonutChart
              percentage={totalSales > 0 ? Math.round((totalExpenses / totalSales) * 100) : 0}
              color="#ef4444"
              label="Expense Ratio"
              subLabel="of Revenue"
              radius={55}
            />
            <DonutChart
              percentage={totalSales > 0 ? Math.round((netProfit / totalSales) * 100) : 0}
              color="#10b981"
              label="Profit Margin"
              subLabel="of Revenue"
              radius={55}
            />
          </View>
        </View>

        {/* Charts & Trends */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Revenue Trend</Text>
            <Text style={styles.sectionSub}>{dateFilter}</Text>
          </View>
          <View style={styles.chartContainer}>
            <Sparkline data={trendData} height={160} />
            <View style={styles.chartLabels}>
              {labels.map((l, i) => (
                <Text key={i} style={styles.chartLabelText}>{l}</Text>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.rowContainer}>
          {/* Top Products */}
          <View style={[styles.sectionContainer, { flex: 1 }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Top Performers</Text>
            </View>
            <View style={styles.listContainer}>
              {topProducts.length === 0 ? (
                <Text style={styles.emptyText}>No sales data available.</Text>
              ) : topProducts.map((item, idx) => (
                <View key={idx} style={styles.listItem}>
                  {/* Rank Badge */}
                  <View style={[styles.rankBadge, { backgroundColor: idx === 0 ? '#fefce8' : '#f8fafc' }]}>
                    {idx === 0 ? <Trophy size={16} color="#ca8a04" /> : <Text style={styles.rankText}>{idx + 1}</Text>}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Package size={12} color="#94a3b8" />
                      <Text style={styles.itemSub}> {item.sales} sold</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.itemValue}>₹{item.total.toLocaleString()}</Text>
                    <Text style={{ fontSize: 10, color: '#16a34a', fontWeight: '600' }}>{item.margin}% margin</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Payment Methods */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Payment Distribution</Text>
          </View>
          {paymentMethods.length === 0 ? (
            <Text style={styles.emptyText}>No transactions recorded.</Text>
          ) : (
            <View style={styles.paymentContainer}>
              <View style={styles.distributionBar}>
                {paymentMethods.map((method, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.distSegment,
                      { flex: method.percentage || 1, backgroundColor: method.color }
                    ]}
                  />
                ))}
              </View>
              <View style={styles.legendGrid}>
                {paymentMethods.map((method, idx) => (
                  <View key={idx} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: method.color }]} />
                    <Text style={styles.legendLabel}>{method.name}</Text>
                    <Text style={styles.legendValue}>{method.percentage}%</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Secondary Metrics */}
        <View style={styles.kpiGrid}>
          <View style={styles.secondaryCard}>
            <Text style={styles.secondaryLabel}>Active Customers</Text>
            <Text style={styles.secondaryValue}>{activeCustomers}</Text>
          </View>
          <View style={styles.secondaryCard}>
            <Text style={styles.secondaryLabel}>Avg. Order Value</Text>
            <Text style={styles.secondaryValue}>₹{averageOrderValue.toFixed(0)}</Text>
          </View>
          <View style={styles.secondaryCard}>
            <Text style={styles.secondaryLabel}>Inventory Value</Text>
            <Text style={styles.secondaryValue}>₹{(inventoryValue / 100000).toFixed(2)}L</Text>
          </View>
        </View>

      </ScrollView>

      {/* Date Picker Modal */}
      <Modal visible={showDatePicker} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeaderTitle}>Select Period</Text>
            {dateOptions.map(opt => (
              <TouchableOpacity
                key={opt}
                style={styles.optionRow}
                onPress={() => { setDateFilter(opt); setShowDatePicker(false); }}
              >
                <Text style={[styles.optionText, dateFilter === opt && styles.selectedOptionText]}>{opt}</Text>
                {dateFilter === opt && <Check size={18} color="#10b981" />}
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
  headerGradient: { paddingBottom: 25, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, marginBottom: 20 },

  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600', marginTop: 2 },

  exportBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4
  },

  // Date Filter - Full Width (Dashboard Style)
  dateFilterSection: {
    marginHorizontal: 20,
    marginBottom: 5,
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
    fontWeight: '700',
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

  container: { padding: 20, paddingBottom: 60, paddingTop: 25 },

  // Key Performance Indicators
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  kpiCard: {
    width: '48%', // Adjusted for 2-column
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
    flex: 1,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
  },

  // Sections (Charts/Lists)
  sectionContainer: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a', letterSpacing: -0.3 },
  sectionSub: { fontSize: 12, fontWeight: '600', color: '#64748b', backgroundColor: '#f8fafc', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },

  chartContainer: { alignItems: 'center' },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
    paddingHorizontal: 8,
  },
  chartLabelText: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },

  // List Items
  rowContainer: { flexDirection: 'row', marginBottom: 20 },
  listContainer: { gap: 0 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    backgroundColor: '#f8fafc',
  },
  rankText: { fontSize: 12, fontWeight: '800', color: '#94a3b8' },
  itemName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  itemSub: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  itemValue: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  emptyText: { textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', marginVertical: 24 },

  // Payment Distribution
  paymentContainer: { marginTop: 8 },
  distributionBar: {
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    flexDirection: 'row',
    marginBottom: 24,
  },
  distSegment: { height: '100%' },
  legendGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  legendValue: { fontSize: 13, fontWeight: '800', color: '#0f172a' },

  // Secondary Cards
  secondaryCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#64748b',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  secondaryLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', marginBottom: 6, textAlign: 'center', letterSpacing: 0.3 },
  secondaryValue: { fontSize: 16, fontWeight: '800', color: '#0f172a' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, paddingBottom: 40 },
  modalHeaderTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', marginBottom: 24, letterSpacing: 0.5 },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  optionText: { fontSize: 16, fontWeight: '600', color: '#334155' },
  selectedOptionText: { color: '#0f172a', fontWeight: '800' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
});