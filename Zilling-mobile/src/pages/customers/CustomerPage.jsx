import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  TrendingUp,
  ChevronLeft,
  ChevronDown,
  History,
  UserCog,
  Star,
  IndianRupee,
  Trash2,
  X,
  Trophy,
  Clock,
  LayoutGrid,
  ArrowRight
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useCustomers } from '../../context/CustomerContext';
import { useTransactions } from '../../context/TransactionContext';
import CustomerModal from './CustomerModal';

import { useToast } from '../../context/ToastContext';
import ConfirmationModal from '../../components/ui/ConfirmationModal';

const { width } = Dimensions.get('window');

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
  const [expandedId, setExpandedId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    variant: 'danger'
  });

  useEffect(() => {
    refreshCustomers();
  }, []);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor('#000');
      }
    }, [])
  );

  useEffect(() => {
    if (route?.params?.editId && customers.length > 0) {
      const target = customers.find(c => c.id === route.params.editId || c._id === route.params.editId);
      if (target) {
        handleEdit(target);
        navigation.setParams({ editId: null });
      }
    }
  }, [route?.params?.editId, customers]);

  const getCustomerStats = useCallback((customerId) => {
    if (!transactions || !customerId) return { totalSpent: 0, totalVisits: 0, due: 0, lastVisit: null };

    const customerTx = transactions.filter(t =>
      t.customerId === customerId ||
      String(t.customerId) === String(customerId)
    );

    const totalSpent = customerTx.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);
    const totalVisits = customerTx.length;

    const due = customerTx.reduce((sum, t) => {
      const total = parseFloat(t.total || 0);
      const received = parseFloat(t.amountReceived || 0);
      const d = Math.max(0, total - received);
      return sum + d;
    }, 0);

    const lastVisit = customerTx.length > 0 ? customerTx[0].date : null;

    return { totalSpent, totalVisits, due, lastVisit };
  }, [transactions]);

  const stats = useMemo(() => {
    let revenue = 0;
    let due = 0;
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
        await updateCustomer(selectedCustomer.id, data);
        showToast("Customer updated successfully", "success");
      } else {
        await addCustomer(data);
        showToast("Customer added successfully", "success");
      }
      setIsModalOpen(false);
    } catch (error) {
      showToast("Failed to save customer", "error");
    }
  };

  const handleDelete = (id) => {
    const customer = customers.find(c => c.id === id);
    setConfirmModal({
      isOpen: true,
      title: "Delete Customer?",
      message: `Are you sure you want to remove ${customer?.name || 'this customer'}?\nThis will permanently delete their profile and loyalty points.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteCustomer(id);
          setIsModalOpen(false);
          showToast("Customer deleted successfully", "success");
        } catch (err) {
          showToast("Failed to delete customer", "error");
        }
      }
    });
  };

  const renderCustomerItem = ({ item }) => {
    const isExpanded = expandedId === item.id;
    const isVIP = (item.tags || '').includes('VIP');
    const points = item.loyaltyPoints || 0;

    return (
      <TouchableOpacity
        style={[styles.premiumCard, isExpanded && styles.premiumCardActive]}
        activeOpacity={0.9}
        onPress={() => isExpanded ? setExpandedId(null) : handleEdit(item)}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.avatarContainer, { backgroundColor: '#f8fafc' }]}>
            <Text style={styles.avatarText}>{(item.name || 'U').charAt(0).toUpperCase()}</Text>
          </View>

          <View style={styles.headerCore}>
            <View style={styles.nameRow}>
              <Text style={styles.customerName} numberOfLines={1}>{item.name}</Text>
              {isVIP && (
                <View style={styles.vipStripe}>
                  <Star size={10} color="#000" fill="#000" />
                  <Text style={styles.vipText}>VIP</Text>
                </View>
              )}
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.phoneText}>{item.phone || 'No phone'}</Text>
              <View style={styles.dot} />
              <Text style={styles.typeText}>{item.type || 'Individual'}</Text>
            </View>
          </View>

          <View style={styles.loyaltyBadge}>
            <Trophy size={14} color="#000" strokeWidth={2.5} />
            <Text style={styles.loyaltyPointsText}>{points}</Text>
            <Text style={styles.loyaltyLabel}>PTS</Text>
          </View>
        </View>

        <View style={styles.cardStatsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>TOTAL SPENT</Text>
            <Text style={styles.statValue}>₹{(item.totalSpent || 0).toLocaleString()}</Text>
          </View>
          <View style={styles.statSeparator} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>OUTSTANDING</Text>
            <Text style={[styles.statValue, item.due > 0 && styles.redText]}>
              ₹{(item.due || 0).toLocaleString()}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.visitBox}>
            <Clock size={12} color="#94a3b8" />
            <Text style={styles.visitText}>{item.totalVisits || 0} Visits</Text>
          </View>

          <View style={styles.footerActions}>
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); handleEdit(item, 'history'); }}
              style={styles.historyBtn}
            >
              <History size={16} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : item.id); }}
              style={[styles.expandToggle, isExpanded && styles.expandToggleActive]}
            >
              <ChevronDown size={20} color={isExpanded ? "#fff" : "#000"} style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }} />
            </TouchableOpacity>
          </View>
        </View>

        {isExpanded && (
          <View style={styles.actionDrawer}>
            <TouchableOpacity style={styles.drawerBtn} onPress={() => handleEdit(item, 'details')}>
              <UserCog size={18} color="#000" />
              <Text style={styles.drawerBtnText}>Manage Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.drawerBtn, styles.deleteAction]} onPress={() => handleDelete(item.id)}>
              <Trash2 size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Curved Mesh Header Wrapper */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={['#000', '#1a1a1a']}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={['top']}>
            <View style={styles.topNav}>
              <Pressable onPress={() => navigation.goBack()} style={styles.navIcon}>
                <ChevronLeft size={24} color="#fff" />
              </Pressable>
              <View style={styles.navTitleBox}>
                <Text style={styles.navTitle}>Customers</Text>
                <Text style={styles.navSubtitle}>{customers.length} Contacts Saved</Text>
              </View>
              <TouchableOpacity style={styles.primaryAddBtn} onPress={handleAddNew}>
                <UserPlus size={22} color="#000" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchAndFilter}>
              <View style={styles.searchWrapper}>
                <Search size={20} color="rgba(255,255,255,0.4)" />
                <TextInput
                  placeholder="Search by name or mobile..."
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  style={styles.searchField}
                  placeholderTextColor="rgba(255,255,255,0.4)"
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
                <Filter size={20} color={showFilters ? "#000" : "#fff"} />
              </TouchableOpacity>
            </View>

            <View style={styles.heroCard}>
              <View style={styles.heroHeader}>
                <View>
                  <Text style={styles.heroLabel}>Portfolio Value</Text>
                  <Text style={styles.heroAmount}>₹{stats.revenue}</Text>
                </View>
                <View style={styles.heroIconBox}>
                  <IndianRupee size={24} color="#000" />
                </View>
              </View>
              <View style={styles.heroFooter}>
                <View style={styles.heroStatItem}>
                  <Text style={styles.heroStatLabel}>PENDING DUE</Text>
                  <Text style={styles.heroStatValue}>₹{stats.due}</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItem}>
                  <Text style={styles.heroStatLabel}>VIP CLIENTS</Text>
                  <Text style={styles.heroStatValue}>{stats.vips}</Text>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>

      <FlatList
        data={filteredCustomers}
        keyExtractor={item => item.id}
        renderItem={renderCustomerItem}
        contentContainerStyle={styles.listPadding}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={refreshCustomers}
        ListHeaderComponent={() => (
          <View style={styles.dashboard}>
            {showFilters && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                {['All', 'Individual', 'Business', 'VIP'].map(f => (
                  <TouchableOpacity
                    key={f}
                    onPress={() => setFilterType(f)}
                    style={[styles.filterChip, filterType === f && styles.filterChipOn]}
                  >
                    <Text style={[styles.filterChipLabel, filterType === f && styles.filterChipLabelOn]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <View style={styles.sectionHeadRow}>
              <Text style={styles.sectionTitleHeader}>Customer Directory</Text>
              <LayoutGrid size={14} color="#cbd5e1" />
            </View>
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#000" style={{ marginTop: 60 }} />
          ) : (
            <View style={styles.emptyState}>
              <Users size={60} color="#cbd5e1" strokeWidth={1} />
              <Text style={styles.emptyTitle}>No Customers Found</Text>
              <Text style={styles.emptyDesc}>Try searching for someone else or add a new customer.</Text>
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
  container: { flex: 1, backgroundColor: '#fff' },

  headerContainer: { backgroundColor: '#fff' },
  headerGradient: { borderBottomLeftRadius: 32, borderBottomRightRadius: 32, paddingBottom: 5 },

  topNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 10, gap: 15 },
  navIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  navTitleBox: { flex: 1 },
  navTitle: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.8 },
  navSubtitle: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', marginTop: -2 },
  primaryAddBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },

  searchAndFilter: { flexDirection: 'row', paddingHorizontal: 24, gap: 10, paddingBottom: 8 },
  searchWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingHorizontal: 12, gap: 8, height: 46 },
  searchField: { flex: 1, fontSize: 14, fontWeight: '700', color: '#fff' },
  filterBtn: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  filterBtnActive: { backgroundColor: '#fff' },

  heroCard: {
    marginHorizontal: 24,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 15, elevation: 6,
    marginVertical: 14
  },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  heroLabel: { fontSize: 11, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 },
  heroAmount: { fontSize: 28, fontWeight: '900', color: '#000', marginTop: 2 },
  heroIconBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  heroFooter: { flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 16, padding: 14, alignItems: 'center' },
  heroStatItem: { flex: 1 },
  heroStatLabel: { fontSize: 8, fontWeight: '800', color: '#94a3b8', marginBottom: 2, textTransform: 'uppercase' },
  heroStatValue: { fontSize: 14, fontWeight: '900', color: '#000' },
  heroStatDivider: { width: 1, height: 16, backgroundColor: '#e2e8f0', marginHorizontal: 12 },

  chipScroll: { paddingHorizontal: 24, paddingVertical: 12, gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 10, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#f1f5f9' },
  filterChipOn: { backgroundColor: '#000', borderColor: '#000' },
  filterChipLabel: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  filterChipLabelOn: { color: '#fff' },

  listPadding: { paddingBottom: 50 },
  dashboard: { paddingBottom: 10 },

  sectionHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 24, marginBottom: 16, marginTop: 4 },
  sectionTitleHeader: { fontSize: 11, fontWeight: '900', color: '#cbd5e1', letterSpacing: 1.2, textTransform: 'uppercase' },

  premiumCard: { backgroundColor: '#fff', marginHorizontal: 24, borderRadius: 24, marginBottom: 16, borderWidth: 1, borderColor: '#f1f5f9', overflow: 'hidden' },
  premiumCardActive: { borderColor: '#000', borderWidth: 1.2 },

  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14 },
  avatarContainer: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  avatarText: { fontSize: 20, fontWeight: '900', color: '#000' },
  headerCore: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  customerName: { fontSize: 18, fontWeight: '900', color: '#000' },
  vipStripe: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#000', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  vipText: { fontSize: 10, fontWeight: '900', color: '#fff' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  phoneText: { fontSize: 13, fontWeight: '700', color: '#94a3b8' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#cbd5e1', marginHorizontal: 8 },
  typeText: { fontSize: 11, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' },

  loyaltyBadge: { alignItems: 'center', backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, minWidth: 55, borderWidth: 1, borderColor: '#f1f5f9' },
  loyaltyPointsText: { fontSize: 16, fontWeight: '900', color: '#000', marginTop: 2 },
  loyaltyLabel: { fontSize: 8, fontWeight: '900', color: '#64748b' },

  cardStatsGrid: { flexDirection: 'row', backgroundColor: '#f8fafc', marginHorizontal: 16, borderRadius: 18, padding: 16, marginBottom: 4 },
  statBox: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 9, fontWeight: '900', color: '#94a3b8', letterSpacing: 0.5 },
  statValue: { fontSize: 16, fontWeight: '900', color: '#000', marginTop: 4 },
  statSeparator: { width: 1, height: '70%', backgroundColor: '#e2e8f0', alignSelf: 'center' },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, paddingTop: 12 },
  visitBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  visitText: { fontSize: 12, fontWeight: '800', color: '#94a3b8' },
  footerActions: { flexDirection: 'row', gap: 8 },
  historyBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  expandToggle: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  expandToggleActive: { backgroundColor: '#000', borderColor: '#000' },

  actionDrawer: { flexDirection: 'row', padding: 18, paddingTop: 0, gap: 10 },
  drawerBtn: { flex: 1, flexDirection: 'row', height: 48, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  drawerBtnText: { fontSize: 13, fontWeight: '800', color: '#000' },
  deleteAction: { flex: 0, width: 48, backgroundColor: '#fff1f2', borderColor: '#ffe4e6' },

  emptyState: { alignItems: 'center', marginTop: 80, gap: 15 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#000' },
  emptyDesc: { fontSize: 14, fontWeight: '600', color: '#94a3b8', textAlign: 'center', paddingHorizontal: 50 },

  redText: { color: '#ef4444' }
});
