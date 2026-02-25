import React, { useState, useEffect, useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
} from 'lucide-react-native';
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

const SummaryCard = ({ title, amount, icon: Icon, color, trend }) => (
  <View style={styles.summaryCard}>
    <View style={[styles.summaryIconContainer, { backgroundColor: color + '15' }]}>
      <Icon size={20} color={color} />
    </View>
    <View style={styles.summaryContent}>
      <Text style={styles.summaryLabel}>{title}</Text>
      <Text style={styles.summaryAmount}>₹{amount.toLocaleString()}</Text>
      {trend && (
        <View style={styles.trendRow}>
          <Text style={styles.trendText}>{trend}</Text>
        </View>
      )}
    </View>
  </View>
);

export default function ExpensesPage() {
  const navigation = useNavigation();
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
  const [receiptPreview, setReceiptPreview] = useState(null); // for full-screen receipt view

  useEffect(() => {
    fetchExpenses();
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
        Alert.alert("Success", "Expenses and business data saved to your device files!");
        setSelectedExpenses([]);
      }
    } catch (err) {
      Alert.alert('Export Error', 'Failed to save data to device folders.');
    } finally {
      setIsExporting(false);
    }
  };

  // Stats Logic
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const thisMonthTotal = expenses
      .filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      })
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const categories = {};
    expenses.forEach(e => {
      categories[e.category] = (categories[e.category] || 0) + (e.amount || 0);
    });
    const highestCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0] || ['None', 0];

    return { total, thisMonthTotal, highestCategory };
  }, [expenses]);

  // Filter Logic
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchesSearch = (e.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.category || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = !selectedCategory || e.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [expenses, searchTerm, selectedCategory]);

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingExpense(null);
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteExpense(id);
            } catch (err) {
              Alert.alert('Error', 'Failed to delete expense');
            }
          }
        }
      ]
    );
  };

  const handleMoreActions = (expense) => {
    Alert.alert(
      'Expense Actions',
      expense.title,
      [
        { text: 'Edit', onPress: () => handleEdit(expense) },
        ...(expense.receiptUrl ? [{ text: 'View Receipt', onPress: () => setReceiptPreview(expense.receiptUrl) }] : []),
        { text: 'Delete', style: 'destructive', onPress: () => handleDelete(expense.id) },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const renderExpenseItem = ({ item }) => {
    const isSelected = selectedExpenses.includes(item.id);
    const hasSelection = selectedExpenses.length > 0;
    const hasReceipt = item.receiptUrl && item.receiptUrl.length > 0;

    return (
      <Pressable
        onPress={() => hasSelection ? toggleSelectExpense(item.id) : handleEdit(item)}
        onLongPress={() => toggleSelectExpense(item.id)}
        style={[styles.expenseCard, isSelected && styles.selectedCard]}
      >
        {/* Receipt Thumbnail Row */}
        {hasReceipt && (
          <Pressable
            onPress={() => setReceiptPreview(item.receiptUrl)}
            style={styles.receiptRow}
          >
            <Image
              source={{ uri: item.receiptUrl }}
              style={styles.receiptThumbnail}
              resizeMode="cover"
            />
            <View style={styles.receiptLabel}>
              <FileText size={12} color="#888" />
              <Text style={styles.receiptLabelText}>Receipt attached • Tap to view</Text>
            </View>
          </Pressable>
        )}

        <View style={styles.cardTop}>
          <View style={styles.cardTitleInfo}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{item.category}</Text>
            </View>
            <Text style={styles.expenseTitle} numberOfLines={1}>{item.title}</Text>
          </View>
          <View style={styles.amountContainer}>
            <Text style={styles.expenseAmount}>₹{item.amount?.toLocaleString()}</Text>
            <Pressable onPress={() => handleMoreActions(item)} style={styles.cardMoreBtn}>
              <MoreVertical size={18} color="#94a3b8" />
            </Pressable>
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardBottom}>
          <View style={styles.metaItem}>
            <Calendar size={14} color="#64748b" />
            <Text style={styles.metaText}>{new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
          </View>
          <View style={styles.metaItem}>
            <Wallet size={14} color="#64748b" />
            <Text style={styles.metaText}>{item.paymentMethod || item.payment_method}</Text>
          </View>
        </View>

        {hasSelection && (
          <View style={[styles.selectionOverlay, isSelected && styles.selectionOverlaySelected]}>
            {isSelected && <Check size={16} color="#fff" />}
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.mainContainer} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => navigation.goBack()} style={styles.headerBackBtn}>
            <ChevronLeft size={24} color="#0f172a" />
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>Expenses</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Cloud size={12} color="#10b981" />
              <Text style={styles.headerSubtitle}>Cloud Synced</Text>
            </View>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Pressable onPress={() => shareExpensesPDF(filteredExpenses)} style={styles.headerActionBtn}>
            <Share2 size={20} color="#64748b" />
          </Pressable>
          <Pressable onPress={handleBulkExport} style={styles.headerActionBtn}>
            <Download size={20} color="#64748b" />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={filteredExpenses}
        keyExtractor={item => item.id}
        renderItem={renderExpenseItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchExpenses}
            tintColor="#000"
            colors={['#000']}
            progressBackgroundColor="#fff"
          />
        }
        ListHeaderComponent={
          <>
            {/* Quick Summary Cards */}
            <View style={styles.summaryGrid}>
              <SummaryCard
                title="This Month"
                amount={stats.thisMonthTotal}
                icon={TrendingDown}
                color="#0f172a"
                trend="+12%"
              />
              <SummaryCard
                title="Top Category"
                amount={stats.highestCategory[1]}
                icon={PieChart}
                color="#64748b"
                trend={stats.highestCategory[0]}
              />
            </View>

            {/* Filter & Search Section */}
            <View style={styles.filterSection}>
              <View style={styles.searchWrapper}>
                <Search size={18} color="#94a3b8" />
                <Input
                  placeholder="Search title or category..."
                  placeholderTextColor="#94a3b8"
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  style={styles.premiumSearchInput}
                />
              </View>

              <CategoryFilter
                categories={SAMPLE_CATEGORIES}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
              />
            </View>

            <View style={styles.listHeaderRow}>
              <Text style={styles.listHeaderText}>All Transactions</Text>
              <Text style={styles.listHeaderCount}>{filteredExpenses.length} records</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBg}>
              <Receipt size={48} color="#cbd5e1" />
            </View>
            <Text style={styles.emptyTitle}>No Expenses Found</Text>
            <Text style={styles.emptySubtitle}>Start by adding your first business expense.</Text>
            <Pressable onPress={handleAdd} style={styles.emptyActionBtn}>
              <Plus size={20} color="#fff" />
              <Text style={styles.emptyBtnText}>Add New Expense</Text>
            </Pressable>
          </View>
        }
      />

      {/* Floating Add Button */}
      {!selectedExpenses.length && (
        <Pressable onPress={handleAdd} style={styles.fabBtn}>
          <Plus size={28} color="#fff" />
        </Pressable>
      )}

      {/* Bulk Actions */}
      <BulkActionsToolbar
        selectedCount={selectedExpenses.length}
        onClearSelection={clearSelection}
        onCategoryChange={async (cat) => {
          try {
            await bulkUpdateExpenses(selectedExpenses, { category: cat });
            setSelectedExpenses([]);
            Alert.alert('Success', 'Updated Categories');
          } catch (e) {
            Alert.alert('Error', 'Update failed');
          }
        }}
        onMarkRecurring={() => { }}
        onExportCSV={handleBulkExport}
        onDelete={() => {
          Alert.alert('Delete', `Delete ${selectedExpenses.length} items?`, [
            { text: 'Cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                await bulkDeleteExpenses(selectedExpenses);
                setSelectedExpenses([]);
              }
            }
          ]);
        }}
        categories={SAMPLE_CATEGORIES}
      />

      <ExpenseModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingExpense(null);
          fetchExpenses(); // Refresh after modal close to show updated receipts
        }}
        expense={editingExpense}
      />

      {/* Full-Screen Receipt Preview Modal */}
      <RNModal
        visible={!!receiptPreview}
        transparent
        animationType="fade"
        onRequestClose={() => setReceiptPreview(null)}
      >
        <View style={styles.previewOverlay}>
          <TouchableOpacity
            style={styles.previewCloseBtn}
            onPress={() => setReceiptPreview(null)}
          >
            <X size={28} color="#fff" />
          </TouchableOpacity>
          {receiptPreview && (
            <Image
              source={{ uri: receiptPreview }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
        </View>
      </RNModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ─── Base ───
  mainContainer: { flex: 1, backgroundColor: '#fff' },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 12, color: '#10b981', fontWeight: '600', marginTop: 2, letterSpacing: 0.3 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerActionBtn: {
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  listContent: { paddingBottom: 100 },

  // ─── Summary Grid ───
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    marginVertical: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'flex-start',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
  },
  summaryIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryContent: { flex: 1, width: '100%' },
  summaryLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 6, letterSpacing: 0.5 },
  summaryAmount: { fontSize: 22, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start'
  },
  trendText: { fontSize: 11, fontWeight: '700', color: '#475569' },

  // ─── Filter Section ───
  filterSection: { paddingBottom: 10 },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    marginHorizontal: 24,
    paddingHorizontal: 16,
    borderRadius: 16,
    height: 52,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  premiumSearchInput: {
    flex: 1,
    fontSize: 15,
    height: '100%',
    marginLeft: 12,
    fontWeight: '500',
    color: '#0f172a',
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
  },

  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 10,
    marginBottom: 16,
  },
  listHeaderText: { fontSize: 18, fontWeight: '700', color: '#0f172a', letterSpacing: -0.5 },
  listHeaderCount: { fontSize: 13, fontWeight: '500', color: '#64748b' },

  // ─── Expense Card ───
  expenseCard: {
    backgroundColor: '#fff',
    marginHorizontal: 24,
    marginBottom: 14,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  selectedCard: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#0f172a',
  },

  // ─── Receipt in Card ───
  receiptRow: {
    marginBottom: 14,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
  },
  receiptThumbnail: {
    width: '100%',
    height: 120,
    borderRadius: 12,
  },
  receiptLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  receiptLabelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: 0.3,
  },

  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitleInfo: { flex: 1, gap: 6, paddingRight: 10 },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  expenseTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', lineHeight: 24 },
  amountContainer: { alignItems: 'flex-end', gap: 4 },
  expenseAmount: { fontSize: 18, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
  cardMoreBtn: { padding: 4, marginTop: 4 },
  cardDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 14 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, color: '#64748b', fontWeight: '500' },

  selectionOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  selectionOverlaySelected: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },

  // ─── FAB ───
  fabBtn: {
    position: 'absolute',
    bottom: 30,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },

  // ─── Empty State ───
  emptyContainer: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 24 },
  emptyActionBtn: {
    marginTop: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#0f172a',
    width: '100%',
  },
  emptyBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  // ─── Full Screen Preview ───
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCloseBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    zIndex: 10,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
  },
  previewImage: {
    width: width - 40,
    height: height * 0.7,
  },
});
