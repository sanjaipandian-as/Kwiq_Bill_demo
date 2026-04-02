import React, { useState, useEffect, useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  Dimensions,
  StatusBar,
  Image,
  Modal as RNModal,
  TouchableOpacity,
  InteractionManager,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Search,
  Plus,
  MoreVertical,
  Calendar,
  Receipt,
  FileText,
  TrendingDown,
  ChevronLeft,
  Download,
  Check,
  Share2,
  Wallet,
  PieChart,
  Cloud,
  X,
  CreditCard,
  Smartphone,
  Banknote,
  ArrowRight,
  TrendingUp,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useExpenses } from '../../context/ExpenseContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import ExpenseModal from './ExpenseModal';
import { CategoryFilter } from '../../components/Expenses/CategoryFilter';
import { BulkActionsToolbar } from '../../components/Expenses/BulkActionsToolbar';
import { SAMPLE_CATEGORIES } from '../../utils/expenseConstants';
import { shareExpensesPDF } from '../../utils/exportUtils';
import { fetchAllTableData } from '../../services/database';
import { exportToDeviceFolders } from '../../services/backupservices';

const { width, height } = Dimensions.get('window');

// --- Premium Component: Modern KPI Card ---
const KPICard = ({ label, value, subLabel, icon: Icon, isDark = false }) => (
  <View style={[styles.kpiCard, isDark && styles.kpiCardDark]}>
    <View style={[styles.kpiIconContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
      <Icon size={18} color={isDark ? '#fff' : '#000'} />
    </View>
    <View style={styles.kpiInfo}>
      <Text style={[styles.kpiLabel, isDark && styles.kpiLabelDark]}>{label}</Text>
      <Text style={[styles.kpiValue, isDark && styles.kpiValueDark]}>₹{value.toLocaleString()}</Text>
      <Text style={[styles.kpiSub, isDark && styles.kpiSubDark]}>{subLabel}</Text>
    </View>
  </View>
);

// --- Helper for Payment Icons ---
const getPaymentIcon = (method) => {
  const m = String(method || '').toLowerCase();
  if (m.includes('card')) return { icon: CreditCard, color: '#000' };
  if (m.includes('upi') || m.includes('online') || m.includes('digital')) return { icon: Smartphone, color: '#000' };
  return { icon: Banknote, color: '#000' }; // Default is Cash
};

export default function ExpensesPage() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {
    expenses,
    loading,
    fetchExpenses,
    deleteExpense,
    bulkUpdateExpenses,
    bulkDeleteExpenses,
  } = useExpenses();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedExpenses, setSelectedExpenses] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState(null);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      fetchExpenses();
    });
    return () => task.cancel();
  }, []);

  // Selection Logic
  const toggleSelectExpense = (id) => {
    setSelectedExpenses(prev =>
      prev.includes(id) ? prev.filter(eid => eid !== id) : [...prev, id]
    );
  };

  const clearSelection = () => setSelectedExpenses([]);

  const handleBulkExport = async () => {
    setIsExporting(true);
    try {
      const allData = await fetchAllTableData();
      const result = await exportToDeviceFolders(allData);
      if (result.success) {
        Alert.alert("Success", "Expenses and business data saved to library!");
        setSelectedExpenses([]);
      }
    } catch (err) {
      Alert.alert('Export Error', 'Failed to save data.');
    } finally {
      setIsExporting(false);
    }
  };

  // Stats Logic
  const stats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const totalSpent = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const monthSpent = expenses
      .filter(e => new Date(e.date) >= startOfMonth)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const todaySpent = expenses
      .filter(e => new Date(e.date) >= startOfToday)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const categories = {};
    expenses.forEach(e => {
        categories[e.category] = (categories[e.category] || 0) + (e.amount || 0);
    });
    const topCat = Object.entries(categories).sort((a,b) => b[1] - a[1])[0] || ['N/A', 0];

    return { totalSpent, monthSpent, todaySpent, topCat };
  }, [expenses]);

  // Grouping Logic
  const groupedSections = useMemo(() => {
    const filtered = expenses.filter(e => {
      const matchesSearch = (e.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.category || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !selectedCategory || e.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    const sorted = [...filtered].sort((a,b) => new Date(b.date) - new Date(a.date));
    
    const sections = {};
    sorted.forEach(e => {
      const d = new Date(e.date);
      const title = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
      if (!sections[title]) sections[title] = [];
      sections[title].push(e);
    });

    return Object.entries(sections).map(([title, data]) => ({ title, data }));
  }, [expenses, searchTerm, selectedCategory]);

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingExpense(null);
    setIsModalOpen(true);
  };

  const renderExpenseItem = ({ item }) => {
    const isSelected = selectedExpenses.includes(item.id);
    const hasSelection = selectedExpenses.length > 0;
    const { icon: PayIcon } = getPaymentIcon(item.paymentMethod || item.payment_method);

    return (
      <Pressable
        onPress={() => hasSelection ? toggleSelectExpense(item.id) : handleEdit(item)}
        onLongPress={() => toggleSelectExpense(item.id)}
        style={[styles.expenseListItem, isSelected && styles.selectedListItem]}
      >
        <View style={styles.itemLeftRow}>
            <View style={[styles.methodCircle, { backgroundColor: 'rgba(0,0,0,0.05)' }]}>
                <PayIcon size={20} color="#000" />
            </View>
            <View style={styles.itemTitleCol}>
                <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                <View style={styles.itemBadgeRow}>
                    <View style={styles.miniCategoryBadge}>
                        <Text style={styles.miniBadgeText}>{item.category}</Text>
                    </View>
                    {item.receiptUrl && (
                         <View style={styles.attachmentChip}>
                            <Receipt size={10} color="#64748b" />
                            <Text style={styles.attachmentText}>Receipt</Text>
                        </View>
                    )}
                </View>
            </View>
        </View>

        <View style={styles.itemRightCol}>
            <Text style={styles.itemAmount}>-₹{item.amount?.toLocaleString()}</Text>
            <Text style={styles.itemTime}>{new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>

        {hasSelection && (
          <View style={[styles.selectionDot, isSelected && styles.selectionDotActive]}>
            {isSelected && <Check size={12} color="#fff" />}
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.headerWrapper}>
        <View 
            style={[styles.headerGradient, { paddingTop: Math.max(insets.top, 20) + 10, backgroundColor: '#000' }]}
        >
            <View style={styles.topNav}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                    <ChevronLeft size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerTitleUnit}>
                    <Text style={styles.headerDashboardTitle}>Finance Dashboard</Text>
                    <View style={styles.syncRow}>
                        <Cloud size={10} color="#64748b" />
                        <Text style={styles.syncLabel}>Live Sync</Text>
                    </View>
                </View>
                <View style={styles.topActions}>
                    <TouchableOpacity onPress={() => shareExpensesPDF(expenses)} style={styles.iconBtn}>
                        <Share2 size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.mainBalanceUnit}>
                <Text style={styles.balanceLabel}>OPERATIONAL SPEND</Text>
                <Text style={styles.mainBalanceValue}>₹{stats.monthSpent.toLocaleString()}</Text>
                <View style={styles.monthTag}>
                    <TrendingDown size={14} color="#fff" />
                    <Text style={styles.monthTagText}>Month-to-date</Text>
                </View>
            </View>

            <View style={styles.kpiGrid}>
                <KPICard 
                    label="DAILY AVG" 
                    value={Math.round(stats.monthSpent / 30)} 
                    subLabel="Status: Neutral" 
                    icon={TrendingUp} 
                    isDark
                />
                <KPICard 
                    label="TOP AD-HOC" 
                    value={stats.topCat[1]} 
                    subLabel={stats.topCat[0]} 
                    icon={PieChart} 
                    isDark
                />
            </View>
        </View>
      </View>

      {/* Floating Search Bar */}
      <View style={styles.searchFloatWrapper}>
        <View style={styles.searchBox}>
            <Search size={18} color="#94a3b8" />
            <Input 
                placeholder="Search ledger..."
                value={searchTerm}
                onChangeText={setSearchTerm}
                style={styles.searchTextInput}
            />
        </View>
      </View>

      <SectionList
        sections={groupedSections}
        keyExtractor={item => item.id}
        renderItem={renderExpenseItem}
        renderSectionHeader={({ section: { title } }) => (
            <View style={styles.stickyHeader}>
                <Text style={styles.stickyHeaderText}>{title}</Text>
            </View>
        )}
        stickySectionHeadersEnabled={true}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchExpenses}
            tintColor="#000"
          />
        }
        ListHeaderComponent={
          <View style={styles.filterBelt}>
            <CategoryFilter
                categories={SAMPLE_CATEGORIES}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
            />
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyUnit}>
            <View style={styles.emptyIconCircle}>
                <Banknote size={40} color="#cbd5e1" />
            </View>
            <Text style={styles.emptyHead}>Clear Ledger</Text>
            <Text style={styles.emptySub}>No expenses found for this criteria.</Text>
            <Button 
                title="Add New Entry" 
                icon={Plus} 
                onPress={handleAdd}
                style={styles.emptyBtn}
            />
          </View>
        }
      />

      {/* FAB - Floating Action Button */}
      {!selectedExpenses.length && (
          <Pressable 
            onPress={handleAdd}
            style={[styles.premiumFab, { bottom: Math.max(30, insets.bottom + 10) }]}
          >
            <View style={styles.fabGradient}>
                <Plus size={32} color="#fff" />
            </View>
          </Pressable>
      )}

      {/* Bulk Toolbar */}
      <BulkActionsToolbar
        selectedCount={selectedExpenses.length}
        onClearSelection={clearSelection}
        onDelete={() => {
          Alert.alert('Purge Ledger', `Delete ${selectedExpenses.length} entries?`, [
            { text: 'Cancel' },
            { text: 'Purge', style: 'destructive', onPress: async () => {
                await bulkDeleteExpenses(selectedExpenses);
                setSelectedExpenses([]);
            }}
          ]);
        }}
        onExportCSV={handleBulkExport}
      />

      <ExpenseModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingExpense(null);
          fetchExpenses();
        }}
        expense={editingExpense}
      />

      {/* Preview Modal */}
      <RNModal
        visible={!!receiptPreview}
        transparent
        animationType="fade"
      >
        <View style={styles.previewCenter}>
            <TouchableOpacity onPress={() => setReceiptPreview(null)} style={styles.previewClose}>
                <X size={30} color="#fff" />
            </TouchableOpacity>
            <Image source={{ uri: receiptPreview }} style={styles.previewImg} resizeMode="contain" />
        </View>
      </RNModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  headerWrapper: { backgroundColor: '#000', borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden' },
  headerGradient: { paddingHorizontal: 24, paddingBottom: 30 },
  topNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  headerTitleUnit: { alignItems: 'center' },
  headerDashboardTitle: { fontSize: 12, fontWeight: '900', color: 'rgba(255,255,255,0.6)', letterSpacing: 1, textTransform: 'uppercase' },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  syncLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' },
  iconBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  topActions: { flexDirection: 'row', gap: 10 },
  mainBalanceUnit: { alignItems: 'center', marginBottom: 24 },
  balanceLabel: { fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.5)', letterSpacing: 2, marginBottom: 8 },
  mainBalanceValue: { fontSize: 48, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  monthTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 12 },
  monthTagText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  kpiGrid: { flexDirection: 'row', gap: 12 },
  kpiCard: { flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  kpiCardDark: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  kpiIconContainer: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiInfo: { flex: 1 },
  kpiLabel: { fontSize: 8, fontWeight: '900', color: '#64748b', letterSpacing: 0.5, marginBottom: 2 },
  kpiLabelDark: { color: 'rgba(255,255,255,0.5)' },
  kpiValue: { fontSize: 16, fontWeight: '900', color: '#000' },
  kpiValueDark: { color: '#fff' },
  kpiSub: { fontSize: 8, fontWeight: '700', color: '#94a3b8', marginTop: 2 },
  kpiSubDark: { color: 'rgba(255,255,255,0.3)' },
  searchFloatWrapper: { marginTop: -28, paddingHorizontal: 24, zIndex: 10 },
  searchBox: { height: 56, backgroundColor: '#fff', borderRadius: 18, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, borderWidth: 1, borderColor: '#f1f5f9' },
  searchTextInput: { flex: 1, marginLeft: 12, fontSize: 16, fontWeight: '600', color: '#000', borderWidth: 0, backgroundColor: 'transparent' },
  listContent: { paddingTop: 20 },
  stickyHeader: { backgroundColor: '#f8fafc', paddingHorizontal: 24, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  stickyHeaderText: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 1.5 },
  filterBelt: { paddingBottom: 16 },
  expenseListItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 16, marginHorizontal: 20, marginBottom: 8, borderRadius: 20, borderWidth: 1, borderColor: '#f1f5f9' },
  selectedListItem: { backgroundColor: 'rgba(0,0,0,0.03)', borderColor: '#000' },
  itemLeftRow: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  methodCircle: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  itemTitleCol: { flex: 1, gap: 4 },
  itemTitle: { fontSize: 15, fontWeight: '800', color: '#000' },
  itemBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniCategoryBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  miniBadgeText: { fontSize: 9, fontWeight: '900', color: '#64748b', textTransform: 'uppercase' },
  attachmentChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  attachmentText: { fontSize: 9, fontWeight: '700', color: '#94a3b8' },
  itemRightCol: { alignItems: 'flex-end' },
  itemAmount: { fontSize: 16, fontWeight: '900', color: '#000', letterSpacing: -0.5 },
  itemTime: { fontSize: 10, fontWeight: '600', color: '#94a3b8', marginTop: 2 },
  selectionDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#e2e8f0', marginLeft: 12, alignItems: 'center', justifyContent: 'center' },
  selectionDotActive: { backgroundColor: '#000' },
  emptyUnit: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#cbd5e1', marginBottom: 24, borderStyle: 'dashed' },
  emptyHead: { fontSize: 20, fontWeight: '900', color: '#000', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 22, marginBottom: 30 },
  emptyBtn: { width: '100%', height: 56, borderRadius: 20, backgroundColor: '#000' },
  premiumFab: { position: 'absolute', right: 24, width: 68, height: 68, borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 8 }, shadowRadius: 16, elevation: 8 },
  fabGradient: { flex: 1, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  previewCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  previewClose: { position: 'absolute', top: 50, right: 30, zIndex: 10 },
  previewImg: { width: width - 40, height: height * 0.7 },
});
