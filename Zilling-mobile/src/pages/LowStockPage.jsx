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
  TrendingDown, 
  AlertCircle,
  ChevronRight,
  Info,
  Clock,
  Layers
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
    
    // Determine status - Boutique Noir style
    let statusLabel = 'LOW STOCK';
    let isCritical = false;
    let isOut = false;
    
    if (stock === 0) {
      statusLabel = 'OUT OF STOCK';
      isOut = true;
    } else if (ratio <= 0.3) {
      statusLabel = 'CRITICAL LEVEL';
      isCritical = true;
    }

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => navigation.navigate('Main', { 
          screen: 'Products', 
          params: { searchTerm: item.name } 
        })}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <View style={[styles.iconBox, (isCritical || isOut) && styles.iconBoxCritical]}>
              {isOut ? (
                <AlertCircle size={22} color={isOut ? "#fff" : "#000"} strokeWidth={2.5} />
              ) : isCritical ? (
                <AlertTriangle size={22} color="#fff" strokeWidth={2.5} />
              ) : (
                <Clock size={22} color="#000" strokeWidth={2} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <View style={styles.categoryBadge}>
                <Layers size={10} color="#64748b" />
                <Text style={styles.category}>{item.category?.toUpperCase() || 'STANDARD PRODUCT'}</Text>
              </View>
            </View>
          </View>
          <View style={[styles.statusPill, (isCritical || isOut) && styles.statusPillDark]}>
            <Text style={[styles.statusText, (isCritical || isOut) && styles.statusTextWhite]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.stockInfoRow}>
            <View>
              <Text style={styles.stockLabel}>REMAINING UNITS</Text>
              <View style={styles.valueRow}>
                <Text style={[styles.stockValue, (isCritical || isOut) && styles.stockValueAlert]}>
                  {stock}
                </Text>
                <Text style={styles.unitText}>PCS</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={{ alignItems: 'flex-end', flex: 1 }}>
              <Text style={styles.stockLabel}>MIN. LIMIT</Text>
              <Text style={styles.thresholdValue}>{minStock} PCS</Text>
            </View>
          </View>

          {/* Progress Bar - Noir Style */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBg}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { width: `${Math.min(ratio * 100, 100)}%` },
                  (isCritical || isOut) && { backgroundColor: '#000' }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {Math.round(ratio * 100)}% CAPACITY
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.footerAction}>
            <Text style={styles.actionPrompt}>ACTION REQUIRED</Text>
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => navigation.navigate('Billing')}
            >
              <Text style={styles.actionBtnText}>RESTOCK NOW</Text>
              <ChevronRight size={16} color="#000" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Premium Noir Header */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={['#000', '#1a1a1a']}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={['top']} style={styles.safeHeader}>
            <View style={styles.headerTop}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <ArrowLeft size={20} color="#fff" />
              </TouchableOpacity>
              <View style={styles.headerTitleBox}>
                <Text style={styles.headerTitle}>INVENTORY ALERTS</Text>
                <Text style={styles.headerSubtitle}>STOCK MANAGEMENT PROTOCOL</Text>
              </View>
              <View style={styles.headerCounter}>
                <Text style={styles.counterValue}>{lowStockItems.length}</Text>
                <Text style={styles.counterLabel}>ACTIVE</Text>
              </View>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <View style={styles.searchBox}>
                <Search size={18} color="rgba(255,255,255,0.3)" />
                <TextInput 
                  placeholder="SEARCH PRODUCTS..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={styles.searchInput}
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  autoCapitalize="characters"
                />
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>

      {/* Modern Stats Strip */}
      <View style={styles.statsStrip}>
        <View style={styles.statItem}>
            <View style={styles.statDotOut} />
            <Text style={styles.statValue}>{lowStockItems.filter(i => (parseFloat(i.stock) || 0) === 0).length}</Text>
            <Text style={styles.statLabel}>VACANT</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
            <View style={styles.statDotLow} />
            <Text style={styles.statValue}>{lowStockItems.filter(i => (parseFloat(i.stock) || 0) > 0).length}</Text>
            <Text style={styles.statLabel}>DEPLETING</Text>
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
              <ActivityIndicator size="small" color="#000" />
              <Text style={styles.loadingText}>SYNCHRONIZING INVENTORY...</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Package size={40} color="#000" strokeWidth={1.5} />
              </View>
              <Text style={styles.emptyText}>OPTIMUM LEVELS</Text>
              <Text style={styles.emptySub}>ALL INVENTORY ASSETS ARE CURRENTLY ABOVE THEIR DEFINED THRESHOLDS.</Text>
              <TouchableOpacity 
                style={styles.refreshBtn}
                onPress={() => fetchProducts()}
              >
                <Text style={styles.refreshText}>REFRESH CACHE</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />
      
      <View style={styles.infoBanner}>
        <Info size={14} color="#000" />
        <Text style={styles.infoBannerText}>
          THRESHOLDS CAN BE CONFIGURED IN PRODUCT CONFIGURATION SETTINGS.
        </Text>
      </View>
    </View>
  );
};

export default LowStockPage;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerContainer: {
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#000',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  headerGradient: { 
    paddingBottom: 35, 
  },
  safeHeader: { paddingTop: Platform.OS === 'ios' ? 0 : 10 },
  headerTop: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 24,
    marginBottom: 24
  },
  backBtn: { 
    width: 44, 
    height: 44, 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    borderRadius: 12,
  },
  headerTitleBox: { flex: 1, marginLeft: 16 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  headerSubtitle: { fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: '700', marginTop: 1, letterSpacing: 0.5 },
  headerCounter: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  counterValue: { fontSize: 16, fontWeight: '900', color: '#000' },
  counterLabel: { fontSize: 7, fontWeight: '800', color: '#000', letterSpacing: 0.5 },
  
  searchContainer: {
    paddingHorizontal: 24,
    marginBottom: 5,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 46,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 13,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  statsStrip: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 24,
    marginTop: -22,
    borderRadius: 15,
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statDotOut: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#000' },
  statDotLow: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#cbd5e1' },
  statValue: { fontSize: 18, fontWeight: '900', color: '#000' },
  statLabel: { fontSize: 8, fontWeight: '800', color: '#64748b', letterSpacing: 0.5 },
  statDivider: { width: 1, height: 20, backgroundColor: '#f1f5f9' },

  listContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 100 },

  card: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    marginBottom: 12, 
    padding: 16, 
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000', 
    shadowOpacity: 0.03, 
    shadowRadius: 10, 
    elevation: 2 
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#f1f5f9' },
  iconBoxCritical: { backgroundColor: '#000', borderColor: '#000' },
  name: { fontSize: 15, fontWeight: '900', color: '#000', letterSpacing: -0.3 },
  categoryBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  category: { fontSize: 9, color: '#64748b', fontWeight: '800', letterSpacing: 0.3 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, borderWidth: 1, borderColor: '#000' },
  statusPillDark: { backgroundColor: '#000' },
  statusText: { fontSize: 8, fontWeight: '900', color: '#000', letterSpacing: 0.3 },
  statusTextWhite: { color: '#fff' },

  cardBody: { marginBottom: 14 },
  stockInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  divider: { width: 1, height: 24, backgroundColor: '#f1f5f9' },
  stockLabel: { fontSize: 7, fontWeight: '900', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 2 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  stockValue: { fontSize: 20, fontWeight: '900', color: '#000' },
  stockValueAlert: { color: '#000' },
  unitText: { fontSize: 9, color: '#94a3b8', fontWeight: '800' },
  thresholdValue: { fontSize: 14, fontWeight: '900', color: '#000' },

  progressContainer: { gap: 6 },
  progressBarBg: { height: 4, backgroundColor: '#f1f5f9', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 2, backgroundColor: '#cbd5e1' },
  progressText: { fontSize: 7, color: '#94a3b8', fontWeight: '800', letterSpacing: 0.5, alignSelf: 'flex-end' },

  cardFooter: { borderTopWidth: 1, borderTopColor: '#f8fafc', paddingTop: 12 },
  footerAction: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionPrompt: { fontSize: 8, fontWeight: '800', color: '#cbd5e1', letterSpacing: 0.5 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtnText: { fontSize: 10, fontWeight: '900', color: '#000', letterSpacing: 0.3 },

  loadingContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  loadingText: { marginTop: 16, fontSize: 12, color: '#64748b', fontWeight: '800', letterSpacing: 1 },

  emptyState: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 20, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#f1f5f9' },
  emptyText: { fontSize: 18, color: '#000', fontWeight: '900', letterSpacing: 1, textAlign: 'center' },
  emptySub: { fontSize: 11, color: '#64748b', marginTop: 12, textAlign: 'center', lineHeight: 18, fontWeight: '700', letterSpacing: 0.5 },
  refreshBtn: { marginTop: 32, backgroundColor: '#000', paddingHorizontal: 40, paddingVertical: 16, borderRadius: 12 },
  refreshText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1 },

  infoBanner: { 
    position: 'absolute', 
    bottom: 24, 
    left: 24, 
    right: 24, 
    backgroundColor: '#fff', 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    borderRadius: 12, 
    gap: 12,
    borderWidth: 1,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5
  },
  infoBannerText: { fontSize: 10, color: '#000', fontWeight: '800', flex: 1, letterSpacing: 0.5 }
});


