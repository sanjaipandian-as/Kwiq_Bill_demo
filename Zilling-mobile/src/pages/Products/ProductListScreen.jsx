import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Platform, Modal } from 'react-native';
import { Plus, Search, Edit, Trash2, CheckSquare, Package, Tag, Filter, Upload, AlertCircle, ChevronRight, ChevronDown, Barcode, Layers, Box, Printer, Store, X, TrendingUp } from 'lucide-react-native';
import { useProducts } from '../../context/ProductContext';
import { useSettings } from '../../context/SettingsContext';
import ProductDrawer from './ProductDrawer';
import ImportProductModal from '../Billing/components/ImportProductModal';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryFilter } from '../../components/Expenses/CategoryFilter';
import { printBarcode } from '../../utils/printUtils';
import { useToast } from '../../context/ToastContext';
import Svg, { Circle } from 'react-native-svg';

const MarginInsightModal = ({ visible, onClose, product }) => {
  if (!product) return null;
  const cost = parseFloat(product.cost_price || 0);
  const price = parseFloat(product.price || 0);
  const margin = price - cost;
  const marginPercent = price > 0 ? (margin / price) * 100 : 0;

  const radius = 80;
  const stroke = 12;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.max(0, Math.min(100, marginPercent)) / 100) * circumference;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.insightOverlay}>
        <TouchableOpacity
          style={styles.insightBackground}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.insightSheet}>
          <View style={styles.insightHandle} />
          <View style={styles.insightHeader}>
            <View>
              <Text style={styles.insightTitle}>Margin Analysis</Text>
              <Text style={styles.insightSubTitle}>Profit metrics for this item</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.insightCloseBtn}>
              <X size={20} color="#000" strokeWidth={3} />
            </TouchableOpacity>
          </View>

          <View style={styles.insightContent}>
            <View style={styles.insightProductRow}>
              <Package size={18} color="#64748b" />
              <Text style={styles.insightProductName} numberOfLines={1}>{product.name}</Text>
            </View>

            <View style={styles.chartWrapper}>
              <View style={styles.svgContainer}>
                <Svg height={radius * 2} width={radius * 2}>
                  <Circle
                    stroke="#f1f5f9"
                    fill="transparent"
                    strokeWidth={stroke}
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                  />
                  <Circle
                    stroke={marginPercent > 0 ? "#10b981" : "#ef4444"}
                    fill="transparent"
                    strokeWidth={stroke}
                    strokeDasharray={circumference + ' ' + circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                    transform={`rotate(-90 ${radius} ${radius})`}
                  />
                </Svg>
                <View style={styles.chartCenter}>
                  <Text style={[styles.chartPercent, { color: marginPercent > 0 ? '#10b981' : '#ef4444' }]}>
                    {marginPercent.toFixed(1)}%
                  </Text>
                  <Text style={styles.chartLabel}>MARGIN</Text>
                </View>
              </View>
            </View>

            <View style={styles.insightMetrics}>
              <View style={styles.metricRow}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>COST PRICE</Text>
                  <Text style={styles.metricValue}>₹{cost.toLocaleString()}</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>SELLING PRICE</Text>
                  <Text style={styles.metricValue}>₹{price.toLocaleString()}</Text>
                </View>
              </View>

              <View style={[styles.profitBanner, { backgroundColor: margin > 0 ? '#f0fdf4' : '#fef2f2', borderColor: margin > 0 ? (marginPercent > 10 ? '#10b981' : '#f59e0b') : '#ef4444' }]}>
                <View>
                  <Text style={[styles.profitLabel, { color: margin > 0 ? (marginPercent > 10 ? '#15803d' : '#854d0e') : '#b91c1c' }]}>NET PROFIT PER UNIT</Text>
                  <Text style={[styles.profitAmount, { color: margin > 0 ? (marginPercent > 10 ? '#15803d' : '#854d0e') : '#b91c1c' }]}>₹{margin.toLocaleString()}</Text>
                </View>
                <View style={[styles.profitIcon, { backgroundColor: margin > 0 ? (marginPercent > 10 ? '#10b981' : '#f59e0b') : '#ef4444' }]}>
                  <TrendingUp size={20} color="#fff" />
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.insightDoneBtn} onPress={onClose}>
              <Text style={styles.insightDoneText}>CLOSE ANALYSIS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const ProductsListScreen = ({ navigation }) => {
  const { products, loading, deleteProduct, bulkDeleteProducts, addProduct, updateProduct, fetchProducts, importProducts } = useProducts();
  const { settings } = useSettings();
  const { showToast } = useToast();

  const [savingProductId, setSavingProductId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [insightProduct, setInsightProduct] = useState(null);
  const [insightVisible, setInsightVisible] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(c => c && c.trim() !== ''));
    return Array.from(cats).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    return (products || []).filter(p => {
      const name = (p.name || '').toLowerCase();
      const sku = (p.sku || p.barcode || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      const search = searchTerm.toLowerCase();

      const matchSearch = name.includes(search) || sku.includes(search) || cat.includes(search);
      const matchCat = !selectedCategory || p.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [products, searchTerm, selectedCategory]);

  const lowStockProducts = useMemo(() => {
    let alerts = [];
    products.forEach(p => {
      const min = parseFloat(p.min_stock || p.minStock || 0);
      if (min > 0 && (p.stock || 0) <= min) {
        alerts.push({ ...p, alertLabel: `${p.stock} units left` });
      }

      // Check variants
      try {
        const variants = typeof p.variants === 'string' ? JSON.parse(p.variants) : (p.variants || []);
        if (Array.isArray(variants)) {
          variants.forEach((v, vIdx) => {
            const vStock = parseFloat(v.stock) || 0;
            if (vStock <= min) {
              const variantIdentifier = v.name || v.sku || `var-${vIdx}`;
              alerts.push({
                ...p,
                id: `${p.id}-${variantIdentifier}`, // Unique Key
                _realId: p.id,
                name: `${p.name} (${variantIdentifier})`,
                alertLabel: `${vStock} units left`
              });
            }
          });
        }
      } catch (e) { }
    });
    return alerts;
  }, [products]);

  const toggleSelect = (id) => {
    const newSet = new Set(selectedRows);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }

    if (newSet.size === 0) setSelectionMode(false);
    setSelectedRows(newSet);
  };

  const handleAddNew = () => {
    setEditingProduct(null);
    setIsDrawerOpen(true);
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setIsDrawerOpen(true);
  };

  const handleSaveProduct = async (productData) => {
    try {
      setSavingProductId(editingProduct?.id || 'new');
      showToast(editingProduct ? 'Updating product...' : 'Creating product...', 'info', 1500);

      if (editingProduct) {
        const synced = await updateProduct(editingProduct.id, productData);
        if (synced === false) {
          showToast('Product updated (Sync pending...)', 'info');
        } else {
          showToast('Product updated successfully!', 'success');
        }
      } else {
        const result = await addProduct(productData);
        if (result && result.synced === false) {
          showToast('Product added (Sync pending...)', 'info');
        } else {
          showToast('Product created successfully!', 'success');
        }
      }
      setIsDrawerOpen(false);
    } catch (err) {
      showToast('Failed to save product', 'error');
      Alert.alert('Error', 'Failed to save product');
    } finally {
      setSavingProductId(null);
    }
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Product', 'This action cannot be undone. Delete this item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteProduct(id);
          } catch (err) {
            Alert.alert('Error', 'Failed to delete product');
          }
        }
      }
    ]);
  };

  const renderItem = ({ item }) => {
    const selected = selectedRows.has(item.id);
    const inStock = item.stock > 0;
    const minThreshold = parseFloat(item.min_stock || item.minStock || 0);
    const isLowStock = minThreshold > 0 && item.stock <= minThreshold;
    const isExpanded = expandedId === item.id;

    let variants = [];
    try {
      variants = typeof item.variants === 'string' ? JSON.parse(item.variants) : (item.variants || []);
    } catch (e) {
      variants = [];
    }

    return (
      <TouchableOpacity
        style={[styles.proCard, selected && styles.proCardSelected]}
        onPress={() => selectionMode ? toggleSelect(item.id) : handleEdit(item)}
        onLongPress={() => {
          setSelectionMode(true);
          toggleSelect(item.id);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.cardMainContent}>
          <View style={styles.cardHeader}>
            <View style={styles.iconContainer}>
              {selectionMode ? (
                <View style={[styles.checkbox, selected && styles.checkboxActive]}>
                  {selected && <CheckSquare size={16} color="#fff" strokeWidth={3} />}
                </View>
              ) : (
                <View style={styles.proIconBox}>
                  <Package size={22} color="#000" strokeWidth={2} />
                </View>
              )}
            </View>

            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.proProductName} numberOfLines={1}>{item.name}</Text>
                </View>
                <View style={styles.tagRow}>
                  <View style={styles.proCategoryBadge}>
                    <Store size={10} color="#64748b" />
                    <Text style={styles.proCategoryText}>{(settings?.store?.name?.trim() || settings?.store?.legalName?.trim() || 'KWIQ BILLING')}</Text>
                  </View>
                  {item.brand && (
                    <Text style={styles.brandText}>• {item.brand}</Text>
                  )}
                </View>
              </View>

              <View style={{ alignItems: 'flex-end', gap: 10 }}>
                {/* Performance Badge */}
                <TouchableOpacity
                  style={styles.premiumHealthPill}
                  onPress={(e) => {
                    e.stopPropagation();
                    setInsightProduct(item);
                    setInsightVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.healthIndicator, {
                    backgroundColor: (((item.price - (item.cost_price || 0)) / (item.price || 1)) * 100) > 20 ? "#10b981" :
                      (((item.price - (item.cost_price || 0)) / (item.price || 1)) * 100) > 10 ? "#f59e0b" : "#ef4444"
                  }]} />
                  <Text style={styles.healthText}>
                    {item.price > 0 ? `${(((item.price - (item.cost_price || 0)) / item.price) * 100).toFixed(0)}%` : '0%'}
                  </Text>
                  <TrendingUp size={10} color="#64748b" />
                </TouchableOpacity>

                {item.sku && (
                  <View style={styles.industrialSkuBadge}>
                    <Barcode size={10} color="#64748b" />
                    <Text style={styles.industrialSkuText}>{item.sku}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>COST PRICE</Text>
              <Text style={styles.metricValue}>₹{parseFloat(item.cost_price || 0).toLocaleString()}</Text>
            </View>
            <View style={[styles.metricItem, styles.metricDivider]}>
              <Text style={styles.metricLabel}>SELLING PRICE</Text>
              <Text style={styles.metricValue}>₹{parseFloat(item.price || 0).toLocaleString()}</Text>
            </View>
            <View style={[styles.metricItem, styles.metricDivider]}>
              <Text style={styles.metricLabel}>INVENTORY</Text>
              <View style={styles.stockRow}>
                <Text style={[styles.metricValue, !inStock ? styles.redText : isLowStock ? styles.orangeText : styles.greenText]}>
                  {item.stock} {item.unit || 'pcs'}
                </Text>
                {!inStock ? (
                  <AlertCircle size={14} color="#ef4444" />
                ) : isLowStock ? (
                  <AlertCircle size={14} color="#f59e0b" />
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.proVariantsSection}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Layers size={12} color="#94a3b8" />
                <Text style={styles.variantsTitle}>{variants.length > 0 ? `${variants.length} VARIANTS AVAILABLE` : 'NO VARIANTS'}</Text>
              </View>
              <Text style={styles.actionMicroLabel}>MANAGE</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 10, gap: 12 }}>
              <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {variants.length > 0 ? (
                  variants.map((v, i) => (
                    <View key={i} style={styles.variantGridPill}>
                      <Text style={styles.variantPillText} numberOfLines={1}>
                        {v.name || 'V'}
                        {v.stock !== undefined ? ` — ${v.stock}` : ''}
                      </Text>
                    </View>
                  ))
                ) : (
                  <View style={{ height: 44, justifyContent: 'center' }}>
                    <Text style={[styles.variantPillText, { color: '#cbd5e1' }]}>Standard Product</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  setExpandedId(isExpanded ? null : item.id);
                }}
                style={styles.expandBtn}
              >
                <ChevronDown
                  size={24}
                  color="#fff"
                  strokeWidth={3}
                  style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                />
              </TouchableOpacity>
            </View>
          </View>

          {isExpanded && (
            <View style={styles.cardFooter}>
              <TouchableOpacity
                style={[styles.miniAction, { backgroundColor: '#f0f9ff', flex: 1, borderWidth: 1.5, borderColor: '#e0f2fe' }]}
                onPress={(e) => {
                  e.stopPropagation();
                  printBarcode(item.name, item.sku || item.barcode || item.id, settings);
                }}
              >
                <Printer size={16} color="#0369a1" />
                <Text style={[styles.miniActionText, { color: '#0369a1' }]}>BARCODE</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.miniAction, { backgroundColor: '#f8fafc', flex: 1, borderWidth: 1.5, borderColor: '#f1f5f9' }]}
                onPress={() => handleEdit(item)}
              >
                <Edit size={16} color="#64748b" />
                <Text style={styles.miniActionText}>EDIT</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.miniAction, { backgroundColor: '#fef2f2', borderWidth: 1.5, borderColor: '#fee2e2' }]}
                onPress={() => handleDelete(item.id)}
              >
                <Trash2 size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerWrapper}>
        <LinearGradient
          colors={['#000000', '#1a1a1a']}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={['top']}>
            <View style={styles.mainHeader}>
              <View>
                <Text style={styles.mainTitle}>Inventory</Text>
                <Text style={styles.subTitle}>{products.length} Products Tracked</Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.iconBtnDark} onPress={() => setImportModalVisible(true)}>
                  <Upload color="#fff" size={22} strokeWidth={2.5} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.addBtn} onPress={handleAddNew}>
                  <Plus color="#fff" size={24} strokeWidth={3} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.searchSection}>
              <View style={styles.searchBarDark}>
                <Search size={20} color="rgba(255,255,255,0.4)" strokeWidth={2.5} />
                <TextInput
                  placeholder="Search products, SKU or category..."
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  style={styles.searchInputDark}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                />
                {searchTerm !== '' && (
                  <TouchableOpacity onPress={() => setSearchTerm('')}>
                    <X size={18} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={[styles.filterActionDark, showFilters && styles.filterActionActive]}
                onPress={() => setShowFilters(!showFilters)}
              >
                <Filter size={20} color={showFilters ? "#000" : "#fff"} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            {showFilters && (
              <View style={styles.filtersWrapper}>
                <CategoryFilter
                  categories={categories}
                  selectedCategory={selectedCategory}
                  onCategoryChange={setSelectedCategory}
                />
              </View>
            )}
          </SafeAreaView>
        </LinearGradient>
      </View>

      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={fetchProducts}
        ListHeaderComponent={() => (
          <>
            {lowStockProducts.length > 0 && !searchTerm && !selectedCategory && (
              <View style={styles.alertSection}>
                <View style={styles.alertHeader}>
                  <AlertCircle size={16} color="#ef4444" />
                  <Text style={styles.alertTitle}>CRITICAL STOCK ALERTS</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.alertScroll}>
                  {lowStockProducts.map((p) => (
                    <TouchableOpacity key={p.id} style={styles.alertCard} onPress={() => handleEdit({ ...p, id: p._realId || p.id })}>
                      <View style={styles.alertIconInner}>
                        <Box size={18} color="#ef4444" />
                      </View>
                      <View>
                        <Text style={styles.alertProductName} numberOfLines={1}>{p.name}</Text>
                        <Text style={styles.alertStockValue}>{p.alertLabel || `${p.stock} units left`}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </>
        )}
        renderItem={renderItem}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#000" style={{ marginTop: 60 }} />
          ) : (
            <View style={styles.emptyStateContainer}>
              <Package size={64} color="#f1f5f9" strokeWidth={1} />
              <Text style={styles.emptyTitle}>NO PRODUCTS FOUND</Text>
              <Text style={styles.emptyDesc}>Start by adding a new product or importing your list.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={handleAddNew}>
                <Text style={styles.emptyBtnText}>ADD FIRST PRODUCT</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />

      {selectionMode && selectedRows.size > 0 && (
        <View style={styles.floatingActionMenu}>
          <View style={styles.selectionInfo}>
            <Text style={styles.selectionCount}>{selectedRows.size}</Text>
            <Text style={styles.selectionLabel}>Selected</Text>
          </View>
          <View style={styles.floatingActions}>
            <TouchableOpacity
              style={styles.bulkActionBtn}
              onPress={() => {
                Alert.alert("Bulk Delete", `Delete ${selectedRows.size} items?`, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete', style: 'destructive', onPress: async () => {
                      await bulkDeleteProducts(Array.from(selectedRows));
                      setSelectionMode(false);
                      setSelectedRows(new Set());
                    }
                  }
                ]);
              }}
            >
              <Trash2 size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelSelection}
              onPress={() => {
                setSelectionMode(false);
                setSelectedRows(new Set());
              }}
            >
              <Text style={styles.cancelText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ProductDrawer
        visible={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSave={handleSaveProduct}
        product={editingProduct}
      />

      <ImportProductModal
        visible={importModalVisible}
        onClose={() => setImportModalVisible(false)}
        onImport={(data) => {
          importProducts(data);
          setImportModalVisible(false);
        }}
      />

      <MarginInsightModal
        visible={insightVisible}
        onClose={() => setInsightVisible(false)}
        product={insightProduct}
      />
    </View>
  );
};

export default ProductsListScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerWrapper: { backgroundColor: '#fff' },
  headerGradient: {
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    paddingBottom: 10
  },
  mainHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 10
  },
  mainTitle: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  subTitle: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '700', marginTop: -2 },
  headerActions: { flexDirection: 'row', gap: 12 },
  iconBtnDark: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  addBtn: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', shadowColor: '#10b981', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },

  searchSection: { flexDirection: 'row', gap: 12, paddingHorizontal: 24, paddingBottom: 20 },
  searchBarDark: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', height: 54, borderRadius: 18, paddingHorizontal: 16, gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  searchInputDark: { flex: 1, fontSize: 15, fontWeight: '700', color: '#fff' },
  filterActionDark: { width: 54, height: 54, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  filterActionActive: { backgroundColor: '#fff', borderColor: '#fff' },
  filtersWrapper: { paddingBottom: 16 },

  listContainer: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 120 },

  // Pro Card Styles
  proCard: { backgroundColor: '#fff', borderRadius: 28, marginBottom: 20, borderWidth: 1.5, borderColor: '#f1f5f9', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 20, elevation: 2 },
  proCardSelected: { borderColor: '#10b981', backgroundColor: '#f0fdf4' },
  cardMainContent: { padding: 20 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  proIconBox: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#f1f5f9' },
  proProductName: { fontSize: 18, fontWeight: '900', color: '#000', letterSpacing: -0.5, flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flex: 1 },
  skuBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f8fafc', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  skuText: { fontSize: 10, fontWeight: '900', color: '#94a3b8' },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  proCategoryBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  proCategoryText: { fontSize: 9, fontWeight: '900', color: '#64748b', textTransform: 'uppercase' },
  brandText: { fontSize: 11, color: '#94a3b8', fontWeight: '700' },

  metricsGrid: { flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 20, marginTop: 18, padding: 14, borderWidth: 1, borderColor: '#f1f5f9' },
  premiumHealthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1
  },
  healthIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  healthText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.2
  },
  industrialSkuBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  industrialSkuText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.5
  },
  metricItem: { flex: 1, paddingHorizontal: 4 },
  metricDivider: { borderLeftWidth: 1.5, borderLeftColor: '#f1f5f9', paddingLeft: 16 },
  metricLabel: { fontSize: 9, fontWeight: '900', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 4 },
  metricValue: { fontSize: 16, fontWeight: '900', color: '#000' },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  proVariantsSection: { marginTop: 16, paddingHorizontal: 4 },
  variantsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  variantsTitle: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 0.5 },
  actionMicroLabel: { fontSize: 8, fontWeight: '900', color: '#94a3b8', letterSpacing: 1 },
  expandBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  variantScroll: { flexDirection: 'row' },
  variantGridPill: { flexGrow: 1, paddingHorizontal: 12, height: 40, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  variantPillText: { fontSize: 11, fontWeight: '900', color: '#475569', letterSpacing: 0.3 },

  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 10 },
  miniAction: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent' },
  miniActionText: { fontSize: 11, fontWeight: '900', color: '#64748b', letterSpacing: 0.5 },

  // Alerts Section
  alertSection: { marginBottom: 30 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  alertTitle: { fontSize: 11, fontWeight: '900', color: '#ef4444', letterSpacing: 1 },
  alertScroll: { paddingVertical: 4 },
  alertCard: { backgroundColor: '#fff', borderRadius: 20, padding: 14, marginRight: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: '#fef2f2', minWidth: 200, shadowColor: '#ef4444', shadowOpacity: 0.05, shadowRadius: 10, elevation: 1 },
  alertIconInner: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center' },
  alertProductName: { fontSize: 14, fontWeight: '900', color: '#000' },
  alertStockValue: { fontSize: 12, color: '#ef4444', fontWeight: '800' },

  // Selection & Checkbox
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: '#10b981', borderColor: '#10b981' },

  floatingActionMenu: { position: 'absolute', bottom: 30, left: 24, right: 24, height: 74, backgroundColor: '#000', borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  selectionInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectionCount: { backgroundColor: '#10b981', color: '#fff', width: 28, height: 28, borderRadius: 14, textAlign: 'center', lineHeight: 28, fontSize: 14, fontWeight: '900' },
  selectionLabel: { color: '#fff', fontWeight: '900', fontSize: 14 },
  floatingActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bulkActionBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },
  cancelSelection: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14 },
  cancelText: { color: '#fff', fontSize: 12, fontWeight: '900' },

  // Empty State
  emptyStateContainer: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#000', marginTop: 20 },
  emptyDesc: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginTop: 8, lineHeight: 22, fontWeight: '600' },
  emptyBtn: { marginTop: 24, backgroundColor: '#000', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 18 },
  emptyBtnText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },

  greenText: { color: '#10b981' },
  orangeText: { color: '#f59e0b' },
  redText: { color: '#ef4444' },

  // Margin Insight Styles
  insightOverlay: { flex: 1, justifyContent: 'flex-end' },
  insightBackground: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  insightSheet: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: Platform.OS === 'ios' ? 40 : 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 },
  insightHandle: { width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  insightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 },
  insightTitle: { fontSize: 20, fontWeight: '900', color: '#000' },
  insightSubTitle: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  insightCloseBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  insightContent: { paddingHorizontal: 24 },
  insightProductRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f8fafc', padding: 12, borderRadius: 16, marginBottom: 24 },
  insightProductName: { fontSize: 15, fontWeight: '800', color: '#0f172a', flex: 1 },
  chartWrapper: { alignItems: 'center', marginBottom: 24 },
  svgContainer: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  chartCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  chartPercent: { fontSize: 28, fontWeight: '900' },
  chartLabel: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 1 },
  insightMetrics: { gap: 16, marginBottom: 24 },
  metricRow: { flexDirection: 'row', gap: 12 },
  metricBox: { flex: 1, backgroundColor: '#f8fafc', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#f1f5f9' },
  metricLabel: { fontSize: 10, fontWeight: '900', color: '#94a3b8', marginBottom: 4, letterSpacing: 0.5 },
  metricValue: { fontSize: 18, fontWeight: '900', color: '#000' },
  profitBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderRadius: 24, borderWidth: 2 },
  profitLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 2 },
  profitAmount: { fontSize: 24, fontWeight: '900' },
  profitIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  insightDoneBtn: { height: 56, backgroundColor: '#000', borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  insightDoneText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 1 }
});
