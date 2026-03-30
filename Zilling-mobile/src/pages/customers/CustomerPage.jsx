import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
  TextInput,
  Dimensions,
  Animated,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  History,
  UserCog,
  Star,
  IndianRupee,
  Trash2,
  X,
  Trophy,
  Clock,
  Phone,
  ArrowUpDown,
  Briefcase,
  Layers,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useCustomers } from '../../context/CustomerContext';
import { useTransactions } from '../../context/TransactionContext';
import CustomerModal from './CustomerModal';
import { useToast } from '../../context/ToastContext';
import ConfirmationModal from '../../components/ui/ConfirmationModal';

const { width } = Dimensions.get('window');

// Avatar is always black
const avatarBg = '#111';

const SortChip = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[styles.sortChip, active && styles.sortChipActive]}
    onPress={onPress}
  >
    <Text style={[styles.sortChipLabel, active && styles.sortChipLabelActive]}>{label}</Text>
  </TouchableOpacity>
);

// Reusable compact party row component
const PartyRow = React.memo(({ item, onPress, onHistory, onDelete }) => {
  const isVIP = (item.tags || '').includes('VIP');
  const points = item.loyaltyPoints || 0;
  const hasDue = (item.due || 0) > 0;
  const initial = (item.name || 'U').charAt(0).toUpperCase();

  // Avatar is always black
  const avatarBg = '#111';

  return (
    <TouchableOpacity
      style={styles.partyRow}
      activeOpacity={0.75}
      onPress={onPress}
    >
      {/* ── Top section: avatar + info + points ── */}
      <View style={styles.rowTop}>
        {/* Avatar */}
        <View style={[styles.rowAvatar, { backgroundColor: avatarBg }]}>
          <Text style={styles.rowAvatarText}>{initial}</Text>
        </View>

        {/* Centre info */}
        <View style={styles.rowCenter}>
          <View style={styles.rowNameLine}>
            <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
            {isVIP && (
              <View style={styles.vipPill}>
                <Star size={9} color="#fff" fill="#fff" />
                <Text style={styles.vipPillText}>VIP</Text>
              </View>
            )}
          </View>

          {/* Phone on its own line */}
          <View style={styles.rowPhoneLine}>
            <Phone size={11} color="#888" />
            <Text style={styles.rowPhone}>{item.phone || '—'}</Text>
          </View>

          {/* Type as a small pill tag */}
          <View style={styles.rowTypePill}>
            <Text style={styles.rowTypeText}>{item.type || 'Individual'}</Text>
          </View>
        </View>

        {/* Points badge + action buttons stacked */}
        <View style={styles.rowRight}>
          <View style={styles.ptsBadge}>
            <Trophy size={11} color="#000" strokeWidth={2.5} />
            <Text style={styles.ptsText}>{points}</Text>
            <Text style={styles.ptsLabel}>pts</Text>
          </View>
          <View style={styles.rowActions}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={(e) => { e.stopPropagation(); onHistory(); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <History size={15} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, styles.iconBtnDanger]}
              onPress={(e) => { e.stopPropagation(); onDelete(); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Trash2 size={15} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Bottom section: stats pill strip ── */}
      <View style={styles.statsStrip}>
        <View style={styles.statPill}>
          <Text style={styles.statPillLabel}>Spent</Text>
          <Text style={styles.statPillValue}>
            ₹{(item.totalSpent || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </Text>
        </View>

        <View style={styles.statStripDivider} />

        <View style={styles.statPill}>
          <Text style={[styles.statPillLabel, hasDue && styles.dueLabel]}>Due</Text>
          <Text style={[styles.statPillValue, hasDue && styles.dueValue]}>
            ₹{(item.due || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </Text>
        </View>

        <View style={styles.statStripDivider} />

        <View style={styles.statPill}>
          <Text style={styles.statPillLabel}>Visits</Text>
          <View style={styles.visitsRow}>
            <Clock size={11} color="#555" />
            <Text style={styles.statPillValue}>{item.totalVisits || 0}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function CustomersPage({ route }) {
  const navigation = useNavigation();
  const { customers, loading, refreshCustomers, addCustomer, updateCustomer, deleteCustomer } = useCustomers();
  const { transactions } = useTransactions();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [modalTab, setModalTab] = useState('details');
  const [filterType, setFilterType] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const searchRef = useRef(null);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false, title: '', message: '', onConfirm: () => { }, variant: 'danger'
  });

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      refreshCustomers();
    });
    return () => task.cancel();
  }, []);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      if (Platform.OS === 'android') StatusBar.setBackgroundColor('#000');
    }, [])
  );

  useEffect(() => {
    if (route?.params?.editId && customers.length > 0) {
      const target = customers.find(c => c.id === route.params.editId || c._id === route.params.editId);
      if (target) { handleEdit(target); navigation.setParams({ editId: null }); }
    }
  }, [route?.params?.editId, customers]);

  // PERFORMANCE: Pre-calculate stats for all customers in ONE pass through transactions
  const customerStatsMap = useMemo(() => {
    const map = {};
    if (!transactions) return map;

    // Fast single pass through all transactions
    transactions.forEach(t => {
      const cId = t.customerId || t.customer_id;
      if (!cId) return;

      if (!map[cId]) {
        map[cId] = { totalSpent: 0, totalVisits: 0, due: 0, lastVisit: null };
      }

      const total = parseFloat(t.total) || 0;
      const received = parseFloat(t.amountReceived) || 0;
      const dueAmount = Math.max(0, total - received);

      map[cId].totalSpent += total;
      map[cId].totalVisits += 1;
      map[cId].due += dueAmount;
      
      // Since transactions are sorted by date DESC, the first one seen is the last visit
      if (!map[cId].lastVisit) {
        map[cId].lastVisit = t.date;
      }
    });
    return map;
  }, [transactions]);

  const getCustomerStats = useCallback((customerId) => {
    return customerStatsMap[customerId] || { totalSpent: 0, totalVisits: 0, due: 0, lastVisit: null };
  }, [customerStatsMap]);

  const stats = useMemo(() => {
    let revenue = 0, due = 0;
    (customers || []).forEach(c => {
      const s = getCustomerStats(c.id);
      revenue += s.totalSpent;
      due += s.due;
    });
    const vips = (customers || []).filter(c => (c.tags || '').includes('VIP')).length;
    return {
      revenue: revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 }),
      due: due.toLocaleString('en-IN', { maximumFractionDigits: 0 }),
      vips,
      total: customers.length
    };
  }, [customers, getCustomerStats]);

  const filteredCustomers = useMemo(() => {
    return (customers || []).filter(c => {
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '');
      const search = searchTerm.toLowerCase();
      const matchesSearch = name.includes(search) || phone.includes(search);
      if (filterType === 'VIP') return matchesSearch && (c.tags || '').includes('VIP');
      if (filterType === 'Individual') return matchesSearch && c.type === 'Individual';
      if (filterType === 'Business') return matchesSearch && c.type === 'Business';
      return matchesSearch;
    }).map(c => {
      const s = getCustomerStats(c.id);
      return { ...c, ...s, due: c.due || s.due };
    });
  }, [customers, searchTerm, filterType, getCustomerStats]);

  const handleEdit = (customer, tab = 'details') => {
    setSelectedCustomer(customer);
    setModalTab(tab);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setSelectedCustomer(null);
    setModalTab('details');
    setIsModalOpen(true);
  };

  const handleSave = async (data) => {
    try {
      if (selectedCustomer) {
        const wasVIP = (selectedCustomer.tags || '').includes('VIP');
        // Handle tags as array (from modal) or string (from DB)
        const isNowVIP = Array.isArray(data.tags) ? data.tags.includes('VIP') : (data.tags || '').includes('VIP');

        await updateCustomer(selectedCustomer.id, data);

        if (!wasVIP && isNowVIP) {
          showToast(`Account successfully upgraded to VIP status.`, 'success', 4000, null, `${data.fullName || selectedCustomer.name} is Now VIP!`);
        } else {
          showToast('Customer information updated successfully.', 'success', 3000, null, 'Profile Updated');
        }
      } else {
        const savedCust = await addCustomer(data);
        const isVIP = Array.isArray(data.tags) ? data.tags.includes('VIP') : (data.tags || '').includes('VIP');

        if (isVIP) {
          showToast(`New client added with premium VIP benefits.`, 'success', 4000, null, 'New VIP Member');
        } else {
          showToast('New customer profile has been created.', 'success', 3000, null, 'Customer Added');
        }
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Save error:', err);
      showToast('We encountered an error while saving. Please try again.', 'error', 3500, null, 'Save Failed');
    }
  };

  const handleDelete = (id) => {
    const customer = customers.find(c => c.id === id);
    setConfirmModal({
      isOpen: true,
      title: 'Delete Customer?',
      message: `Are you sure you want to remove ${customer?.name || 'this customer'}?\nThis will permanently delete their profile and loyalty points.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteCustomer(id);
          setIsModalOpen(false);
          showToast('Customer deleted successfully', 'success');
        } catch {
          showToast('Failed to delete customer', 'error');
        }
      }
    });
  };

  const renderItem = ({ item, index }) => (
    <PartyRow
      item={item}
      onPress={() => handleEdit(item)}
      onHistory={() => handleEdit(item, 'history')}
      onDelete={() => handleDelete(item.id)}
    />
  );

  const FILTERS = ['All', 'Individual', 'Business', 'VIP'];

  const ListHeader = () => null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* ── Header ─────────────────────────────────── */}
      <View style={styles.headerContainer}>
        <LinearGradient colors={['#000000ff', '#000000ff']} style={styles.headerGradient}>
          <SafeAreaView edges={['top']}>
            {/* Top nav */}
            <View style={styles.mainHeader}>
              <View style={styles.headerLeft}>
                <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
                  <ChevronLeft size={22} color="#fff" />
                </TouchableOpacity>
                <View>
                  <Text style={styles.navTitle}>Parties</Text>
                  <Text style={styles.navSubtitle}>{customers.length} Contacts saved</Text>
                </View>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.addBtn} onPress={handleAddNew}>
                  <UserPlus size={22} color="#000000ff" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            </View>


            {/* Portfolio Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>₹{stats.revenue}</Text>
                <Text style={styles.statLabel}>Revenue</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNum, stats.due !== '0' && { color: '#fca5a5' }]}>₹{stats.due}</Text>
                <Text style={styles.statLabel}>Due</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{stats.vips}</Text>
                <Text style={styles.statLabel}>VIPs</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{stats.total}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
            </View>

            {/* Search row */}
            <View style={styles.searchRow}>
              <View style={styles.searchBar}>
                <Search size={18} color="rgba(255,255,255,0.35)" />
                <TextInput
                  ref={searchRef}
                  placeholder="Search name or phone..."
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  style={styles.searchInput}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                />
                {searchTerm !== '' && (
                  <TouchableOpacity onPress={() => setSearchTerm('')}>
                    <X size={18} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={[styles.filterBtn, showFilters && styles.filterBtnActive]}
                onPress={() => setShowFilters(!showFilters)}
              >
                <Filter size={20} color={showFilters ? '#000' : '#fff'} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* Sort/Filter Bar - Conditional */}
            {showFilters && (
              <View style={styles.sortBar}>
                <View style={styles.sortLeft}>
                  <ArrowUpDown size={14} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.sortBarLabel}>Filter</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortChipsRow}>
                  {FILTERS.map(f => (
                    <SortChip
                      key={f}
                      label={f}
                      active={filterType === f}
                      onPress={() => setFilterType(f)}
                    />
                  ))}
                </ScrollView>
              </View>
            )}
          </SafeAreaView>
        </LinearGradient>
      </View>

      {/* ── List ────────────────────────────────────── */}
      <FlatList
        data={filteredCustomers}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listPadding}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={refreshCustomers}
        ListHeaderComponent={ListHeader}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#1A3C34" style={{ marginTop: 60 }} />
          ) : (
            <View style={styles.emptyState}>
              <Users size={56} color="#cbd5e1" strokeWidth={1} />
              <Text style={styles.emptyTitle}>No Parties Found</Text>
              <Text style={styles.emptyDesc}>
                {searchTerm ? `No results for "${searchTerm}"` : 'Add your first customer to get started.'}
              </Text>
              {!searchTerm && (
                <TouchableOpacity style={styles.emptyAddBtn} onPress={handleAddNew}>
                  <UserPlus size={16} color="#fff" />
                  <Text style={styles.emptyAddText}>Add Party</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
      />

      <CustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        customer={selectedCustomer}
        initialTab={modalTab}
        onSave={handleSave}
        onDelete={() => handleDelete(selectedCustomer.id)}
      />

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  // ── Header ──────────────────────────────────────
  headerContainer: { backgroundColor: '#f8fafc' },
  headerGradient: {
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingBottom: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8
  },

  mainHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 4
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerActions: { flexDirection: 'row', gap: 10 },

  headerBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  navTitle: { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  navSubtitle: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  addBtn: {
    width: 46, height: 46, borderRadius: 14, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },

  // Stats Grid
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 22,
    marginTop: 12,
    marginBottom: 12,
    gap: 8
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center'
  },
  statNum: { fontSize: 16, fontWeight: '800', color: '#fff' },
  statLabel: {
    fontSize: 10, color: 'rgba(255,255,255,0.4)',
    fontWeight: '700', marginTop: 2,
    textTransform: 'uppercase', letterSpacing: 0.3
  },

  // Search
  searchRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 22, paddingBottom: 8 },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', height: 50,
    borderRadius: 14, paddingHorizontal: 14, gap: 10
  },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '600', color: '#fff' },
  filterBtn: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  filterBtnActive: { backgroundColor: '#fff' },

  // Sort Bar
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 24,
    paddingRight: 12,
    paddingVertical: 8
  },
  sortLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 10
  },
  sortBarLabel: {
    fontSize: 12, color: 'rgba(255,255,255,0.3)',
    fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5
  },
  sortChipsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 20 },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'transparent'
  },
  sortChipActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: '#fff'
  },
  sortChipLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '700' },
  sortChipLabelActive: { color: '#fff', fontWeight: '800' },

  // ── List header ─────────────────────────────────
  listHeader: { paddingTop: 14 },
  chipRow: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0',
  },
  chipActive: { backgroundColor: '#000', borderColor: '#000' },
  chipLabel: { fontSize: 14, fontWeight: '800', color: '#555' },
  chipLabelActive: { color: '#fff' },

  dirHeading: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingBottom: 8,
  },
  dirLabel: { fontSize: 12, fontWeight: '900', color: '#999', textTransform: 'uppercase', letterSpacing: 1 },
  dirCount: {
    backgroundColor: '#e2e8f0', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  dirCountText: { fontSize: 12, fontWeight: '900', color: '#555' },

  // ── Party Row ───────────────────────────────────
  listPadding: { paddingBottom: 90, paddingHorizontal: 14, paddingTop: 6 },
  separator: { height: 12, backgroundColor: 'transparent' },

  partyRow: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 16,
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },

  // Top row: avatar + info + right actions
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },

  rowAvatar: {
    width: 50, height: 50, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  rowAvatarText: { fontSize: 20, fontWeight: '900', color: '#fff' },

  rowCenter: { flex: 1, gap: 5 },

  rowNameLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowName: { fontSize: 17, fontWeight: '800', color: '#000', flexShrink: 1 },
  vipPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#000', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  vipPillText: { fontSize: 10, fontWeight: '900', color: '#fff' },

  // Phone line
  rowPhoneLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowPhone: { fontSize: 14, fontWeight: '600', color: '#444' },

  // Type pill
  rowTypePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3f3f3',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  rowTypeText: { fontSize: 11, fontWeight: '800', color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Legacy — kept for safety
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowType: { fontSize: 12, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4 },
  metaDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#cbd5e1' },

  // Right column: badge + buttons
  rowRight: { alignItems: 'center', gap: 10, flexShrink: 0 },
  ptsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#f3f3f3', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: '#e2e2e2',
  },
  ptsText: { fontSize: 13, fontWeight: '900', color: '#000' },
  ptsLabel: { fontSize: 10, fontWeight: '700', color: '#555' },

  rowActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: '#f3f3f3', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#e2e2e2',
  },
  iconBtnDanger: { backgroundColor: '#fff1f2', borderColor: '#ffe4e6' },

  // Bottom stats strip
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  statPill: { flex: 1, alignItems: 'center', gap: 3 },
  statPillLabel: { fontSize: 11, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.4 },
  statPillValue: { fontSize: 14, fontWeight: '900', color: '#000' },
  statStripDivider: { width: 1, height: 28, backgroundColor: '#e8e8e8' },
  visitsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  dueLabel: { color: '#ef4444' },
  dueValue: { color: '#ef4444' },

  // unused but kept for safety
  rowStats: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  rowStatLabel: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  rowStatValue: { fontSize: 13, fontWeight: '800', color: '#334155' },

  // ── Empty state ─────────────────────────────────
  emptyState: { alignItems: 'center', marginTop: 70, gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 19, fontWeight: '900', color: '#334155' },
  emptyDesc: { fontSize: 15, fontWeight: '600', color: '#94a3b8', textAlign: 'center' },
  emptyAddBtn: {
    marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#000', borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  emptyAddText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  redText: { color: '#ef4444' },
});
