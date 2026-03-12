import React, { useMemo, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  StatusBar,
  Platform,
} from 'react-native';
import { useProducts } from '../context/ProductContext';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ArrowLeft, 
  Package, 
  AlertTriangle, 
  Search, 
  Filter, 
  TrendingDown, 
  AlertCircle,
  ChevronRight,
  Info
} from 'lucide-react-native';

const LowStockPage = ({ navigation }) => {
  const { products, loading, fetchProducts } = useProducts();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const lowStockItems = useMemo(() => {
    return products.filter(item => {
      const minStock = parseFloat(item.min_stock) || parseFloat(item.minStock) || 0;
      const stock = parseFloat(item.stock) || 0;
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()));
      return minStock > 0 && stock <= minStock && matchesSearch;
    }).sort((a, b) => {
      // Sort by critical status first (lowest percentage of min_stock)
      const getPercent = (i) => (parseFloat(i.stock) || 0) / (parseFloat(i.min_stock || i.minStock) || 1);
      return getPercent(a) - getPercent(b);
    });
  }, [products, searchTerm]);

  const renderItem = ({ item }) => {
    const stock = parseFloat(item.stock) || 0;
    const minStock = parseFloat(item.min_stock) || parseFloat(item.minStock) || 1;
    const ratio = stock / minStock;
    
    // Determine status
    let statusColor = '#f59e0b'; // Low (Orange)
    let statusLabel = 'Low Stock';
    let statusBg = '#fffbeb';
    
    if (stock === 0) {
      statusColor = '#ef4444'; // Out (Red)
      statusLabel = 'Out of Stock';
      statusBg = '#fef2f2';
    } else if (ratio <= 0.3) {
      statusColor = '#dc2626'; // Critical (Dark Red)
      statusLabel = 'Critical';
      statusBg = '#fef2f2';
    }

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => navigation.navigate('ProductDetails', { product: item })}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <View style={[styles.iconBox, { backgroundColor: statusBg }]}>
              {stock === 0 ? (
                <AlertCircle size={20} color={statusColor} strokeWidth={2.5} />
              ) : (
                <AlertTriangle size={20} color={statusColor} strokeWidth={2.5} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.category}>{item.category || 'Standard Product'}</Text>
            </View>
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusBg, borderColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.stockInfoRow}>
            <View>
              <Text style={styles.stockLabel}>CURRENT STOCK</Text>
              <Text style={[styles.stockValue, { color: statusColor }]}>
                {stock} <Text style={styles.unitText}>units</Text>
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.stockLabel}>MIN. THRESHOLD</Text>
              <Text style={styles.thresholdValue}>{minStock} units</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBg}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { 
                    width: `${Math.min(ratio * 100, 100)}%`, 
                    backgroundColor: statusColor 
                  }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {Math.round(ratio * 100)}% of threshold
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <TouchableOpacity 
            style={styles.actionBtn}
            onPress={() => navigation.navigate('Billing')} // Assuming they might want to sell or adjust
          >
            <Text style={styles.actionBtnText}>Restock Inventory</Text>
            <ChevronRight size={14} color="#64748b" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Header Gradient */}
      <LinearGradient
        colors={['#000', '#111']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']} style={styles.safeHeader}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <ArrowLeft size={22} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerTitleBox}>
              <Text style={styles.headerTitle}>Inventory Alerts</Text>
              <Text style={styles.headerSubtitle}>{lowStockItems.length} items need attention</Text>
            </View>
            <TouchableOpacity style={styles.filterBtn}>
              <Filter size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBox}>
              <Search size={18} color="rgba(255,255,255,0.4)" />
              <TextInput 
                placeholder="Search products..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={styles.searchInput}
                value={searchTerm}
                onChangeText={setSearchTerm}
              />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Quick Stats Strip */}
      <View style={styles.statsStrip}>
        <View style={styles.statItem}>
            <TrendingDown size={14} color="#ef4444" />
            <Text style={styles.statValue}>{lowStockItems.filter(i => (parseFloat(i.stock) || 0) === 0).length}</Text>
            <Text style={styles.statLabel}>Out of Stock</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
            <AlertTriangle size={14} color="#f59e0b" />
            <Text style={styles.statValue}>{lowStockItems.filter(i => (parseFloat(i.stock) || 0) > 0).length}</Text>
            <Text style={styles.statLabel}>Running Low</Text>
        </View>
      </View>

      {/* Product List */}
      <FlatList
        data={lowStockItems}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#000" />
              <Text style={styles.loadingText}>Analyzing inventory...</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Package size={48} color="#94a3b8" strokeWidth={1.5} />
              </View>
              <Text style={styles.emptyText}>Stock levels are healthy!</Text>
              <Text style={styles.emptySub}>All items are currently above their minimum threshold level.</Text>
              <TouchableOpacity 
                style={styles.refreshBtn}
                onPress={() => fetchProducts()}
              >
                <Text style={styles.refreshText}>Check Again</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />
      
      <View style={styles.infoBanner}>
        <Info size={14} color="#475569" />
        <Text style={styles.infoBannerText}>
          Thresholds can be adjusted in the Product Settings.
        </Text>
      </View>
    </View>
  );
};

export default LowStockPage;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  headerGradient: { 
    paddingBottom: 20, 
    borderBottomLeftRadius: 32, 
    borderBottomRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8
  },
  safeHeader: { paddingTop: Platform.OS === 'ios' ? 0 : 10 },
  headerTop: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 22,
    marginBottom: 20
  },
  backBtn: { 
    width: 44, 
    height: 44, 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: 'rgba(255,255,255,0.08)', 
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  headerTitleBox: { flex: 1, marginLeft: 16 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginTop: 2 },
  filterBtn: {
    width: 44, 
    height: 44, 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
  },
  searchContainer: {
    paddingHorizontal: 22,
    marginBottom: 5,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },

  statsStrip: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 22,
    marginTop: -20,
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 5,
    alignItems: 'center',
    zIndex: 10,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statValue: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  statLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, height: 20, backgroundColor: '#f1f5f9', mx: 15 },

  listContent: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 100 },

  card: { 
    backgroundColor: '#fff', 
    borderRadius: 24, 
    marginBottom: 16, 
    padding: 20, 
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
    shadowColor: '#94a3b8', 
    shadowOpacity: 0.08, 
    shadowRadius: 12, 
    elevation: 4 
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  name: { fontSize: 17, fontWeight: '800', color: '#0f172a', letterSpacing: -0.3 },
  category: { fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: '600' },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },

  cardBody: { marginBottom: 18 },
  stockInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  stockLabel: { fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, marginBottom: 4 },
  stockValue: { fontSize: 24, fontWeight: '900' },
  unitText: { fontSize: 14, color: '#94a3b8', fontWeight: '700' },
  thresholdValue: { fontSize: 16, fontWeight: '800', color: '#475569' },

  progressContainer: { gap: 6 },
  progressBarBg: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  progressText: { fontSize: 11, color: '#94a3b8', fontWeight: '700', alignSelf: 'flex-end' },

  cardFooter: { borderTopWidth: 1, borderTopColor: '#f8fafc', paddingTop: 15 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  actionBtnText: { fontSize: 13, fontWeight: '700', color: '#64748b' },

  loadingContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  loadingText: { marginTop: 16, fontSize: 15, color: '#64748b', fontWeight: '600' },

  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 30 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyText: { fontSize: 20, color: '#0f172a', fontWeight: '900', textAlign: 'center' },
  emptySub: { fontSize: 14, color: '#64748b', marginTop: 10, textAlign: 'center', lineHeight: 22, fontWeight: '500' },
  refreshBtn: { marginTop: 30, backgroundColor: '#000', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16 },
  refreshText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  infoBanner: { 
    position: 'absolute', 
    bottom: 24, 
    left: 22, 
    right: 22, 
    backgroundColor: '#f1f5f9', 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 14, 
    borderRadius: 16, 
    gap: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  infoBannerText: { fontSize: 12, color: '#475569', fontWeight: '600', flex: 1 }
});

