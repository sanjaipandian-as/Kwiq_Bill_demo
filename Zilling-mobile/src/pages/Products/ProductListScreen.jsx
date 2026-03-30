import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Platform, Modal, Dimensions, InteractionManager } from 'react-native';
import { Plus, Search, Edit, Trash2, CheckSquare, Package, Tag, Filter, Upload, AlertCircle, ChevronRight, ChevronDown, Barcode, Layers, Box, Printer, Store, X, TrendingUp, ArrowUpDown, AlertTriangle, Copy, Check } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useProducts } from '../../context/ProductContext';
import { useSettings } from '../../context/SettingsContext';
import ProductDrawer from './ProductDrawer';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryFilter } from '../../components/Expenses/CategoryFilter';
import { printBarcode } from '../../utils/printUtils';
import { useToast } from '../../context/ToastContext';
import Svg, { Circle } from 'react-native-svg';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { debouncedNavigate } from '../../utils/navigationUtils';

const MarginInsightModal = ({ visible, onClose, product }) => {
  if (!product) return null;
  const cost = parseFloat(product.cost_price || 0);
  const price = parseFloat(product.price || 0);
  const margin = price - cost;
  const marginPercent = price > 0 ? (margin / price) * 100 : 0;

  const radius = 80;
  const stroke = 14;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.max(0, Math.min(100, marginPercent)) / 100) * circumference;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.insightOverlay}>
        <TouchableOpacity style={styles.insightBackground} activeOpacity={1} onPress={onClose} />
        <View style={styles.insightSheet}>
          <View style={styles.insightHandle} />
          <View style={styles.insightHeader}>
            <View>
              <Text style={styles.insightTitle}>Margin Analysis</Text>
              <Text style={styles.insightSubTitle}>Profit breakdown</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.insightCloseBtn}>
              <X size={22} color="#000" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <View style={styles.insightContent}>
            <View style={styles.insightProductRow}>
              <Package size={20} color="#666" />
              <Text style={styles.insightProductName} numberOfLines={1}>{product.name}</Text>
            </View>

            <View style={styles.chartWrapper}>
              <View style={styles.svgContainer}>
                <Svg height={radius * 2} width={radius * 2}>
                  <Circle stroke="#e5e5e5" fill="transparent" strokeWidth={stroke} r={normalizedRadius} cx={radius} cy={radius} />
                  <Circle
                    stroke={marginPercent > 0 ? "#000" : "#999"}
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
                  <Text style={styles.chartPercent}>{marginPercent.toFixed(1)}%</Text>
                  <Text style={styles.chartLabel}>MARGIN</Text>
                </View>
              </View>
            </View>

            <View style={styles.insightMetrics}>
              <View style={styles.metricRow}>
                <View style={styles.metricBox}>
                  <Text style={styles.insMetricLabel}>COST PRICE</Text>
                  <Text style={styles.insMetricValue}>₹{cost.toLocaleString()}</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.insMetricLabel}>SELLING PRICE</Text>
                  <Text style={styles.insMetricValue}>₹{price.toLocaleString()}</Text>
                </View>
              </View>

              <View style={styles.profitBanner}>
                <View>
                  <Text style={styles.profitLabel}>NET PROFIT PER UNIT</Text>
                  <Text style={styles.profitAmount}>₹{margin.toLocaleString()}</Text>
                </View>
                <View style={styles.profitIcon}>
                  <TrendingUp size={22} color="#fff" />
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.insightDoneBtn} onPress={onClose}>
              <Text style={styles.insightDoneText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const SortChip = ({ label, active, onPress }) => (
  <TouchableOpacity onPress={onPress} style={[styles.sortChip, active && styles.sortChipActive]} activeOpacity={0.7}>
    <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>{label}</Text>
  </TouchableOpacity>
);

// ─── Barcode Selection Modal ─────────────────────────────────────────────────────────
const BarcodeSelectionModal = ({ visible, onClose, data, settings }) => {
  if (!visible || !data) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={vstyles.overlay}>
        <TouchableOpacity style={vstyles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={vstyles.sheet}>
          <View style={vstyles.handle} />

          <View style={vstyles.header}>
            <View>
              <Text style={vstyles.title}>Select Barcode</Text>
              <Text style={vstyles.subtitle} numberOfLines={1}>{data.product.name}</Text>
            </View>
            <TouchableOpacity style={vstyles.closeBtn} onPress={onClose}>
              <X size={22} color="#000" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <ScrollView style={vstyles.body} showsVerticalScrollIndicator={false}>
            {data.options.map((option, index) => (
              <TouchableOpacity key={index} style={styles.barcodeOptionCard} onPress={() => {
                printBarcode(option.name, option.barcode, settings);
                onClose();
              }}>
                <View style={styles.barcodeOptionIcon}>
                  <Printer size={22} color="#000" strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.barcodeOptionName} numberOfLines={1}>{option.name}</Text>
                  <Text style={styles.barcodeOptionVal}>{option.barcode}</Text>
                </View>
                <ChevronRight size={18} color="#ccc" />
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={[styles.insightDoneBtn, { marginTop: 10 }]} onPress={onClose}>
              <Text style={styles.insightDoneText}>CANCEL</Text>
            </TouchableOpacity>
            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ─── Variants Modal ─────────────────────────────────────────────────────────
const VariantsModal = ({ visible, onClose, product, onSave }) => {
  const [variants, setVariants] = useState([]);
  const [editing, setEditing] = useState(null); // {index, data} or null
  const [form, setForm] = useState({ name: '', sku: '', cost_price: '', price: '', stock: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      let v = [];
      try { v = typeof product.variants === 'string' ? JSON.parse(product.variants) : (product.variants || []); } catch (e) { }
      setVariants(v);
    }
    setEditing(null);
    setForm({ name: '', sku: '', cost_price: '', price: '', stock: '' });
  }, [product, visible]);

  if (!product) return null;

  const openAdd = () => { setEditing(null); setForm({ name: '', sku: '', cost_price: '', price: '', stock: '' }); };
  const openEdit = (idx) => {
    const v = variants[idx];
    setEditing(idx);
    setForm({
      name: v.name || '',
      sku: v.sku || '',
      cost_price: (v.cost_price !== undefined && v.cost_price !== null && v.cost_price !== '') ? String(v.cost_price) : ((v.costPrice !== undefined && v.costPrice !== null && v.costPrice !== '') ? String(v.costPrice) : ''),
      price: v.price != null ? String(v.price) : '',
      stock: (v.stock !== undefined && v.stock !== null && v.stock !== '') ? String(v.stock) : ((v.qty !== undefined && v.qty !== null && v.qty !== '') ? String(v.qty) : ((v.quantity !== undefined && v.quantity !== null && v.quantity !== '') ? String(v.quantity) : '')),
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Required', 'Variant name is required.'); return; }
    setSaving(true);
    const existing = editing !== null ? variants[editing] : {};
    const newVariant = {
      ...existing,
      name: form.name.trim(),
      sku: form.sku.trim(),
      cost_price: parseFloat(form.cost_price) || 0,
      price: parseFloat(form.price) || 0,
      stock: parseFloat(form.stock) || 0
    };

    let updated;
    if (editing !== null) {
      updated = variants.map((v, i) => i === editing ? newVariant : v);
    } else {
      updated = [...variants, { ...newVariant, options: [newVariant.name] }];
    }
    try {
      await onSave(product, updated);
      setVariants(updated);
      setEditing(null);
      setForm({ name: '', sku: '', cost_price: '', price: '', stock: '' });
    } catch (e) { }
    setSaving(false);
  };

  const handleDelete = (idx) => {
    Alert.alert('Delete Variant', `Delete "${variants[idx].name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, Delete', style: 'destructive', onPress: async () => {
          const updated = variants.filter((_, i) => i !== idx);
          await onSave(product, updated);
          setVariants(updated);
        }
      }
    ]);
  };

  const isFormOpen = editing !== null || (editing === null && form.name !== '' || form.sku !== '' || form.price !== '' || form.stock !== '');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={vstyles.overlay}>
        <TouchableOpacity style={vstyles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={vstyles.sheet}>
          <View style={vstyles.handle} />

          {/* Header */}
          <View style={vstyles.header}>
            <View>
              <Text style={vstyles.title}>Variants</Text>
              <Text style={vstyles.subtitle} numberOfLines={1}>{product.name}</Text>
            </View>
            <TouchableOpacity style={vstyles.closeBtn} onPress={onClose}>
              <X size={22} color="#000" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <ScrollView style={vstyles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Add / Edit Form */}
            <View style={vstyles.formCard}>
              <Text style={vstyles.formTitle}>{editing !== null ? 'Edit Variant' : 'Add New Variant'}</Text>
              <View style={vstyles.formRow}>
                <View style={[vstyles.inputWrap, { flex: 2 }]}>
                  <Text style={vstyles.inputLabel}>Variant Name *</Text>
                  <TextInput
                    style={vstyles.input}
                    placeholder="e.g. 500ml, Red, Large"
                    placeholderTextColor="#bbb"
                    value={form.name}
                    onChangeText={t => setForm(p => ({ ...p, name: t }))}
                  />
                </View>
                <View style={[vstyles.inputWrap, { flex: 1 }]}>
                  <Text style={vstyles.inputLabel}>SKU</Text>
                  <TextInput
                    style={vstyles.input}
                    placeholder="Optional"
                    placeholderTextColor="#bbb"
                    value={form.sku}
                    onChangeText={t => setForm(p => ({ ...p, sku: t }))}
                  />
                </View>
              </View>
              {/* Cost & Selling Price row */}
              <View style={vstyles.formRow}>
                <View style={[vstyles.inputWrap, { flex: 1 }]}>
                  <Text style={vstyles.inputLabel}>Cost Price (₹)</Text>
                  <TextInput
                    style={vstyles.input}
                    placeholder="0.00"
                    placeholderTextColor="#bbb"
                    keyboardType="numeric"
                    value={form.cost_price}
                    onChangeText={t => setForm(p => ({ ...p, cost_price: t }))}
                  />
                </View>
                <View style={[vstyles.inputWrap, { flex: 1 }]}>
                  <Text style={vstyles.inputLabel}>Sell Price (₹)</Text>
                  <TextInput
                    style={vstyles.input}
                    placeholder="0.00"
                    placeholderTextColor="#bbb"
                    keyboardType="numeric"
                    value={form.price}
                    onChangeText={t => setForm(p => ({ ...p, price: t }))}
                  />
                </View>
              </View>
              {/* Margin preview */}
              {(parseFloat(form.price) > 0 || parseFloat(form.cost_price) > 0) && (
                <View style={vstyles.marginPreview}>
                  <Text style={vstyles.marginPreviewText}>
                    Margin: ₹{(parseFloat(form.price || 0) - parseFloat(form.cost_price || 0)).toFixed(2)}
                    {'  '}({parseFloat(form.price) > 0 ? (((parseFloat(form.price || 0) - parseFloat(form.cost_price || 0)) / parseFloat(form.price)) * 100).toFixed(1) : '0'}%)
                  </Text>
                </View>
              )}
              {/* Stock row */}
              <View style={vstyles.formRow}>
                <View style={[vstyles.inputWrap, { flex: 1 }]}>
                  <Text style={vstyles.inputLabel}>Stock (qty)</Text>
                  <TextInput
                    style={vstyles.input}
                    placeholder="0"
                    placeholderTextColor="#bbb"
                    keyboardType="numeric"
                    value={form.stock}
                    onChangeText={t => setForm(p => ({ ...p, stock: t }))}
                  />
                </View>
                <View style={[vstyles.inputWrap, { flex: 1 }]} />
              </View>
              <View style={vstyles.formActions}>
                {editing !== null && (
                  <TouchableOpacity style={vstyles.cancelFormBtn} onPress={() => { setEditing(null); setForm({ name: '', sku: '', cost_price: '', price: '', stock: '' }); }}>
                    <Text style={vstyles.cancelFormText}>Cancel</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={vstyles.saveFormBtn} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                    <><Plus size={18} color="#fff" strokeWidth={2.5} />
                      <Text style={vstyles.saveFormText}>{editing !== null ? 'Update Variant' : 'Add Variant'}</Text></>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Variants List */}
            <Text style={vstyles.listHeader}>
              {variants.length === 0 ? 'No variants yet' : `${variants.length} Variant${variants.length > 1 ? 's' : ''}`}
            </Text>
            {variants.map((v, i) => (
              <View key={i} style={vstyles.variantRow}>
                <View style={vstyles.variantIcon}>
                  <Layers size={18} color="#000" strokeWidth={1.8} />
                </View>
                <View style={vstyles.variantInfo}>
                  <Text style={vstyles.variantName}>{v.name}</Text>
                  <View style={vstyles.variantMeta}>
                    {v.sku ? <View style={vstyles.variantTag}><Barcode size={10} color="#888" /><Text style={vstyles.variantTagText}>{v.sku}</Text></View> : null}
                    {(v.cost_price !== undefined && v.cost_price !== null && v.cost_price !== '') || (v.costPrice !== undefined && v.costPrice !== null && v.costPrice !== '') ? <View style={vstyles.variantTagCost}><Text style={vstyles.variantTagCostText}>Cost ₹{v.cost_price !== undefined && v.cost_price !== null && v.cost_price !== '' ? v.cost_price : v.costPrice}</Text></View> : null}
                    <View style={vstyles.variantTag}><Text style={vstyles.variantTagText}>Sell ₹{v.price || 0}</Text></View>
                    {v.price > 0 && <View style={vstyles.variantTagMargin}><Text style={vstyles.variantTagMarginText}>{v.price > 0 ? (((v.price - (v.cost_price !== undefined && v.cost_price !== null && v.cost_price !== '' ? v.cost_price : (v.costPrice || 0))) / v.price) * 100).toFixed(0) : 0}% margin</Text></View>}
                    <View style={vstyles.variantTag}><Text style={vstyles.variantTagText}>{v.stock || 0} pcs</Text></View>
                  </View>
                </View>
                <TouchableOpacity style={vstyles.variantEditBtn} onPress={() => openEdit(i)}>
                  <Edit size={16} color="#000" strokeWidth={2} />
                </TouchableOpacity>
                <TouchableOpacity style={vstyles.variantDelBtn} onPress={() => handleDelete(i)}>
                  <Trash2 size={16} color="#000" strokeWidth={2} />
                </TouchableOpacity>
              </View>
            ))}
            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const vstyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', paddingBottom: Platform.OS === 'ios' ? 36 : 20 },
  handle: { width: 36, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1.5, borderBottomColor: '#f0f0f0' },
  title: { fontSize: 22, fontWeight: '800', color: '#000' },
  subtitle: { fontSize: 13, color: '#888', fontWeight: '600', marginTop: 2, maxWidth: 220 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 22, paddingTop: 18 },

  formCard: { backgroundColor: '#fafafa', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#eee', marginBottom: 22 },
  formTitle: { fontSize: 15, fontWeight: '800', color: '#000', marginBottom: 14 },
  formRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  inputWrap: {},
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 6, letterSpacing: 0.3 },
  input: { height: 48, borderWidth: 1.5, borderColor: '#e5e5e5', borderRadius: 12, paddingHorizontal: 14, fontSize: 15, fontWeight: '600', color: '#000', backgroundColor: '#fff' },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  cancelFormBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: '#ddd', alignItems: 'center', justifyContent: 'center' },
  cancelFormText: { fontSize: 14, fontWeight: '700', color: '#666' },
  saveFormBtn: { flex: 2, height: 48, borderRadius: 12, backgroundColor: '#000', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveFormText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  listHeader: { fontSize: 13, fontWeight: '800', color: '#888', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 },
  variantRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#eee', padding: 14, marginBottom: 10, gap: 10 },
  variantIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  variantInfo: { flex: 1 },
  variantName: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 4 },
  variantMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  variantTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#f5f5f5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  variantTagText: { fontSize: 12, fontWeight: '600', color: '#555' },
  variantTagCost: { backgroundColor: '#f5f5f5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  variantTagCostText: { fontSize: 12, fontWeight: '600', color: '#888' },
  variantTagMargin: { backgroundColor: '#000', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  variantTagMarginText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  marginPreview: { backgroundColor: '#000', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 10, alignItems: 'center' },
  marginPreviewText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  variantEditBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  variantDelBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// ─── Multi-Variant Margin Modal ────────────────────────────────────────
// Shows the margin breakdown for ALL variants, allowing easy switching.
const MultiVariantMarginModal = ({ visible, onClose, product }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const variants = useMemo(() => {
    if (!product) return [];
    try {
      const v = typeof product.variants === 'string' ? JSON.parse(product.variants) : (product.variants || []);
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }, [product]);

  useEffect(() => {
    if (visible) setActiveIndex(0);
  }, [visible]);

  if (!product) return null;

  const currentVar = variants.length > 0 ? variants[activeIndex] : product;
  const cost = parseFloat(currentVar.cost_price ?? currentVar.costPrice ?? 0) || 0;
  const price = parseFloat(currentVar.price ?? 0) || 0;
  const margin = price - cost;
  const marginPct = price > 0 ? (margin / price) * 100 : 0;

  const radius = 80;
  const stroke = 14;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.max(0, Math.min(100, marginPct)) / 100) * circumference;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={vmStyles.overlay}>
        <TouchableOpacity style={vmStyles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={vmStyles.card}>
          <View style={vmStyles.handle} />

          <View style={vmStyles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={vmStyles.variantLabel}>Detailed Analysis</Text>
              <Text style={vmStyles.variantName} numberOfLines={1}>{product.name}</Text>
            </View>
            <TouchableOpacity style={vmStyles.closeBtn} onPress={onClose}>
              <X size={22} color="#000" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          {/* Variant Selector */}
          {variants.length > 0 && (
            <View style={vmStyles.selectorWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={vmStyles.selectorInner}>
                {variants.map((v, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[vmStyles.selectorPill, activeIndex === i && vmStyles.selectorPillActive]}
                    onPress={() => setActiveIndex(i)}
                  >
                    <Text style={[vmStyles.selectorText, activeIndex === i && vmStyles.selectorTextActive]}>
                      {v.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Chart Section */}
            <View style={vmStyles.chartContainer}>
              <View style={vmStyles.svgWrap}>
                <Svg height={radius * 2} width={radius * 2}>
                  <Circle stroke="#f1f5f9" fill="transparent" strokeWidth={stroke} r={normalizedRadius} cx={radius} cy={radius} />
                  <Circle
                    stroke="#000"
                    fill="transparent"
                    strokeWidth={stroke}
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    r={normalizedRadius} cx={radius} cy={radius}
                    transform={`rotate(-90 ${radius} ${radius})`}
                  />
                </Svg>
                <View style={vmStyles.chartCenter}>
                  <Text style={vmStyles.chartPct}>{marginPct.toFixed(1)}%</Text>
                  <Text style={vmStyles.chartSub}>MARGIN</Text>
                </View>
              </View>

              <View style={vmStyles.metricsGrid}>
                <View style={vmStyles.metricItem}>
                  <Text style={vmStyles.metricLabel}>COST PRICE</Text>
                  <Text style={vmStyles.metricValue}>₹{cost.toLocaleString()}</Text>
                </View>
                <View style={[vmStyles.metricItem, { borderTopWidth: 1, borderColor: '#f1f5f9' }]}>
                  <Text style={vmStyles.metricLabel}>SELL PRICE</Text>
                  <Text style={vmStyles.metricValue}>₹{price.toLocaleString()}</Text>
                </View>
              </View>
            </View>

            {/* Profit Potential */}
            <View style={vmStyles.profitCard}>
              <View style={{ flex: 1 }}>
                <Text style={vmStyles.profitLabel}>PROFIT PER UNIT</Text>
                <Text style={vmStyles.profitValue}>₹{margin.toLocaleString()}</Text>
                <Text style={vmStyles.profitSub}>Current stock: {currentVar.stock || 0} units</Text>
              </View>
              <View style={vmStyles.profitBadge}>
                <TrendingUp size={24} color="#fff" strokeWidth={2.5} />
              </View>
            </View>

            {/* Total Potential */}
            <View style={vmStyles.totalStrip}>
              <Text style={vmStyles.totalStripLabel}>MAX PROFIT POTENTIAL</Text>
              <Text style={vmStyles.totalStripValue}>₹{(margin * (currentVar.stock || 0)).toLocaleString()}</Text>
            </View>

            <TouchableOpacity style={vmStyles.doneBtn} onPress={onClose}>
              <Text style={vmStyles.doneBtnText}>CLOSE ANALYSIS</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const vmStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  card: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '80%', padding: 24 },
  handle: { width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  variantLabel: { fontSize: 11, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.2 },
  variantName: { fontSize: 22, fontWeight: '900', color: '#000', marginTop: 2 },
  closeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#f1f5f9' },

  selectorWrapper: { marginBottom: 24, marginHorizontal: -24 },
  selectorInner: { paddingHorizontal: 24, gap: 10 },
  selectorPill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#f1f5f9' },
  selectorPillActive: { backgroundColor: '#000', borderColor: '#000' },
  selectorText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  selectorTextActive: { color: '#fff' },

  chartContainer: { flexDirection: 'row', alignItems: 'center', gap: 24, padding: 20, backgroundColor: '#f8fafc', borderRadius: 24, marginBottom: 20, borderWidth: 1.5, borderColor: '#f1f5f9' },
  svgWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  chartCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  chartPct: { fontSize: 24, fontWeight: '900', color: '#000' },
  chartSub: { fontSize: 9, fontWeight: '900', color: '#94a3b8', letterSpacing: 1 },

  metricsGrid: { flex: 1 },
  metricItem: { paddingVertical: 10 },
  metricLabel: { fontSize: 9, fontWeight: '900', color: '#94a3b8', letterSpacing: 0.8, marginBottom: 4 },
  metricValue: { fontSize: 18, fontWeight: '900', color: '#000' },

  profitCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#000', padding: 24, borderRadius: 24, marginBottom: 12 },
  profitLabel: { fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.45)', letterSpacing: 1, marginBottom: 6 },
  profitValue: { fontSize: 28, fontWeight: '900', color: '#fff' },
  profitSub: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)', marginTop: 4 },
  profitBadge: { width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },

  totalStrip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: 18, borderRadius: 18, borderWidth: 1.5, borderColor: '#f1f5f9', marginBottom: 24 },
  totalStripLabel: { fontSize: 11, fontWeight: '900', color: '#64748b', letterSpacing: 0.5 },
  totalStripValue: { fontSize: 16, fontWeight: '900', color: '#000' },

  doneBtn: { height: 60, backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center' },
  doneBtnText: { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 1 }
});

// ─────────────────────────────────────────────────────────────────
const BarcodeViewModal = ({ isOpen, onClose, barcode, name, onCopy, isCopied }) => {
    if (!isOpen) return null;

    return (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
            <TouchableOpacity 
                activeOpacity={1} 
                onPress={onClose}
                style={styles.modalOverlay}
            >
                <TouchableOpacity activeOpacity={1} style={{ width: '100%', maxWidth: 360 }}>
                    <View style={styles.barcodeModalContent}>
                        <View style={styles.modalHeaderRow}>
                            <View style={styles.modalIconBox}>
                                <Barcode size={24} color="#000" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitleSmall}>PRODUCT BARCODE</Text>
                                <Text style={styles.modalProductName} numberOfLines={1}>{name}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtnSmall}>
                                <X size={20} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.barcodeDisplayBox}>
                            <Text style={styles.barcodeStringText}>{barcode}</Text>
                            <TouchableOpacity 
                                style={[styles.copyBtnLarge, isCopied && styles.copyBtnSuccess]} 
                                onPress={() => onCopy(barcode)}
                            >
                                {isCopied ? <Check size={20} color="#fff" /> : <Copy size={20} color="#000" />}
                                <Text style={[styles.copyBtnText, isCopied && { color: '#fff' }]}>
                                    {isCopied ? 'COPIED!' : 'COPY CODE'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={styles.modalDoneBtn} onPress={onClose}>
                            <Text style={styles.modalDoneBtnText}>CLOSE</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </View>
    );
};

const ProductsListScreen = ({ navigation }) => {
  const { products, loading, deleteProduct, bulkDeleteProducts, addProduct, updateProduct, fetchProducts, importProducts, restoreProduct } = useProducts();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const [barcodeModal, setBarcodeModal] = useState({ isOpen: false, barcode: '', name: '' });
  const [isCopied, setIsCopied] = useState(false);

    const copyToClipboard = async (text) => {
        await Clipboard.setStringAsync(text);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

  const [savingProductId, setSavingProductId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [insightProduct, setInsightProduct] = useState(null);
  const [insightVisible, setInsightVisible] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [variantsProduct, setVariantsProduct] = useState(null);
  const [variantsVisible, setVariantsVisible] = useState(false);
  const [variantMarginData, setVariantMarginData] = useState({ variant: null, productName: '' });
  const [variantMarginVisible, setVariantMarginVisible] = useState(false);
  const [barcodeActionData, setBarcodeActionData] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    variant: 'danger',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel'
  });

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      fetchProducts();
    });
    return () => task.cancel();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(c => c && c.trim() !== ''));
    return Array.from(cats).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = (products || []).filter(p => {
      const name = (p.name || '').toLowerCase();
      const sku = (p.sku || p.barcode || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      const search = searchTerm.toLowerCase();
      const matchSearch = name.includes(search) || sku.includes(search) || cat.includes(search);
      const matchCat = !selectedCategory || p.category === selectedCategory;
      return matchSearch && matchCat;
    });

    result.sort((a, b) => {
      let valA, valB;
      if (sortBy === 'name') { valA = (a.name || '').toLowerCase(); valB = (b.name || '').toLowerCase(); }
      else if (sortBy === 'price') { valA = parseFloat(a.price || 0); valB = parseFloat(b.price || 0); }
      else if (sortBy === 'stock') { valA = parseFloat(a.stock || 0); valB = parseFloat(b.stock || 0); }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [products, searchTerm, selectedCategory, sortBy, sortOrder]);

  const lowStockProducts = useMemo(() => {
    let alerts = [];
    products.forEach(p => {
      const min = parseFloat(p.min_stock || p.minStock || 0);
      if (min > 0 && (p.stock || 0) <= min) {
        alerts.push({ ...p, alertLabel: `${p.stock} left` });
      }
      try {
        const variants = typeof p.variants === 'string' ? JSON.parse(p.variants) : (p.variants || []);
        if (Array.isArray(variants)) {
          variants.forEach((v, vIdx) => {
            const vStock = parseFloat(v.stock) || 0;
            if (vStock <= min) {
              const vid = v.name || v.sku || `var-${vIdx}`;
              alerts.push({ ...p, id: `${p.id}-${vid}`, _realId: p.id, name: `${p.name} (${vid})`, alertLabel: `${vStock} left` });
            }
          });
        }
      } catch (e) { }
    });
    return alerts;
  }, [products]);

  const toggleSelect = (id) => {
    const newSet = new Set(selectedRows);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    if (newSet.size === 0) setSelectionMode(false);
    setSelectedRows(newSet);
  };

  const handleBarcodeClick = (item) => {
    let variants = [];
    try { variants = typeof item.variants === 'string' ? JSON.parse(item.variants) : (item.variants || []); } catch (e) { }

    const options = [];
    const mainBarcode = item.sku || item.barcode || item.id;
    if (mainBarcode) {
      options.push({ name: `${item.name} (Main)`, barcode: mainBarcode });
    }

    if (Array.isArray(variants)) {
      variants.forEach((v, i) => {
        const vbr = v.barcode || v.sku;
        if (vbr) {
          options.push({ name: `${item.name} - ${v.name || `Var ${i + 1}`}`, barcode: vbr });
        }
      });
    }

    if (options.length === 0) {
      showToast("No barcode available to print.", "error");
      return;
    }

    if (options.length === 1) {
      printBarcode(options[0].name, options[0].barcode, settings);
    } else {
      setBarcodeActionData({ product: item, options });
    }
  };

  const handleAddNew = () => { setEditingProduct(null); setIsDrawerOpen(true); };
  const handleEdit = (product) => { setEditingProduct(product); setIsDrawerOpen(true); };

  const handleSaveProduct = async (productData) => {
    try {
      setSavingProductId(editingProduct?.id || 'new');
      showToast(editingProduct ? 'Updating product...' : 'Creating product...', 'info', 1500);
      if (editingProduct) {
        const synced = await updateProduct(editingProduct.id, productData);
        showToast(synced === false ? 'Product updated (Sync pending...)' : 'Product updated successfully!', synced === false ? 'info' : 'success');
      } else {
        const result = await addProduct(productData);
        showToast(result?.synced === false ? 'Product added (Sync pending...)' : 'Product created successfully!', result?.synced === false ? 'info' : 'success');
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
    const item = products.find(p => p.id === id);
    setConfirmModal({
      isOpen: true,
      title: 'Delete Product',
      message: `Are you sure you want to delete ${item?.name || 'this product'}? This will move it to the Recycle Bin.`,
      variant: 'danger',
      confirmLabel: 'YES, DELETE',
      cancelLabel: 'CANCEL',
      onConfirm: async () => {
        try {
          await deleteProduct(id);
          showToast(
            `${item?.name || 'Product'} moved to Recycle Bin`,
            'trash',
            5000,
            {
              label: 'UNDO',
              onPress: async () => {
                try {
                  await restoreProduct(id);
                  showToast('Product restored successfully!', 'success');
                } catch (e) {
                  showToast('Failed to undo deletion', 'error');
                }
              }
            }
          );
        } catch (err) {
          showToast('Failed to delete product', 'error');
        }
      }
    });
  };

  const totalStockValue = useMemo(() => products.reduce((s, p) => s + (parseFloat(p.price || 0) * parseFloat(p.stock || 0)), 0), [products]);
  const totalItems = useMemo(() => products.reduce((s, p) => s + parseFloat(p.stock || 0), 0), [products]);

  const renderItem = ({ item }) => {
    const selected = selectedRows.has(item.id);
    const inStock = item.stock > 0;
    const minThreshold = parseFloat(item.min_stock || item.minStock || 0);
    const isLowStock = minThreshold > 0 && item.stock <= minThreshold;
    const isExpanded = expandedId === item.id;
    const marginPct = item.price > 0 ? ((item.price - (item.cost_price || item.costPrice || 0)) / item.price * 100) : 0;

    // Grayscale Avatar Colors for premium feel
    const avatarColors = ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155'];
    const charCode = item.name ? item.name.charCodeAt(0) : 0;
    const avatarBg = avatarColors[charCode % avatarColors.length];

    let variants = [];
    try { variants = typeof item.variants === 'string' ? JSON.parse(item.variants) : (item.variants || []); } catch (e) { variants = []; }

    return (
      <TouchableOpacity
        style={[styles.productCard, selected && styles.productCardSelected]}
        onPress={() => selectionMode ? toggleSelect(item.id) : setExpandedId(isExpanded ? null : item.id)}
        onLongPress={() => { setSelectionMode(true); toggleSelect(item.id); }}
        activeOpacity={0.9}
      >
        {/* Main Row */}
        <View style={styles.cardRow}>
          {/* Checkbox / Icon */}
          <View style={[styles.cardLeft, { alignItems: 'center' }]}>
            {selectionMode ? (
              <View style={[styles.checkbox, selected && styles.checkboxActive]}>
                {selected && <CheckSquare size={16} color="#fff" strokeWidth={3} />}
              </View>
            ) : (
              <>
                <View style={[styles.productIcon, { backgroundColor: avatarBg, borderColor: avatarBg }]}>
                  {item.name ? (
                    <Text style={{ fontSize: 24, fontWeight: '900', color: '#0f172a', opacity: 0.8 }}>{item.name.charAt(0).toUpperCase()}</Text>
                  ) : (
                    <Package size={24} color="#334155" strokeWidth={1.5} />
                  )}
                </View>
                <View style={[styles.variantBadge, { marginTop: 6, minWidth: 46 }]}>
                  <Text style={[styles.variantBadgeText, { textAlign: 'center' }]}>
                    {variants.length > 0 ? `${variants.length} Var` : 'N/A'}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Product Info */}
          <View style={styles.cardCenter}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8, paddingRight: 4 }}>
              <Text style={[styles.productName, { marginBottom: 0 }]} numberOfLines={1}>{item.name}</Text>
            </View>
            <View style={styles.tagRow}>
              {item.sku ? (
                <TouchableOpacity
                  onPress={() => setBarcodeModal({ isOpen: true, barcode: item.sku, name: item.name })}
                >
                  <View style={styles.tag}>
                    <Barcode size={11} color="#888" />
                    <Text style={styles.tagText}>
                      {item.sku.length > 10
                        ? `${item.sku.substring(0, 10)}...`
                        : item.sku}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : null}
              {item.category ? (
                <View style={styles.tag}>
                  <Tag size={11} color="#888" />
                  <Text style={styles.tagText}>{item.category}</Text>
                </View>
              ) : null}
              {isLowStock && (
                <View style={[styles.lowTag, { backgroundColor: '#000' }]}>
                  <Text style={[styles.lowTagText, { color: '#fff' }]}>LOW STOCK</Text>
                </View>
              )}
            </View>
          </View>

          {/* Price & Stock */}
          <View style={styles.cardRight}>
            <Text style={styles.priceMain}>₹{parseFloat(item.price || 0).toLocaleString()}</Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              {marginPct > 0 && (
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff', backgroundColor: '#000', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' }}>
                  {marginPct.toFixed(0)}% Margin
                </Text>
              )}
              <Text style={[styles.stockMain, !inStock && { color: '#fff', backgroundColor: '#000' }]}>
                {item.stock} {item.unit || 'pcs'}
              </Text>
            </View>
            {/* Quick Action Buttons */}
            <View style={styles.quickActions}>
              {/* Standard Margin is always shown first */}
              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  setInsightProduct(item);
                  setInsightVisible(true);
                }}
                activeOpacity={0.7}
              >
                <TrendingUp size={16} color="#000" strokeWidth={2.2} />
              </TouchableOpacity>

              {variants.length > 0 ? (
                /* Layers icon only for Multi-Variant Analysis */
                <TouchableOpacity
                  style={styles.quickActionBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    setVariantsProduct(item);
                    setVariantMarginVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Layers size={16} color="#000" strokeWidth={2.2} />
                </TouchableOpacity>
              ) : (
                /* Plus icon to quickly add variants if none exist */
                <TouchableOpacity
                  style={styles.quickActionBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    setVariantsProduct(item);
                    setVariantsVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Plus size={16} color="#000" strokeWidth={2.5} />
                </TouchableOpacity>
              )}

              <View style={[styles.quickActionBtn, styles.expandToggleBtn, isExpanded && styles.expandToggleBtnActive]}>
                <ChevronDown
                  size={16} color={isExpanded ? '#fff' : '#000'} strokeWidth={2.5}
                  style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Expanded */}
        {isExpanded && (
          <View style={styles.expandedSection}>
            {/* Detail Grid */}
            <View style={styles.detailGrid}>
              <View style={styles.detailCell}>
                <Text style={styles.detailCellLabel}>Cost Price</Text>
                <Text style={styles.detailCellValue}>₹{parseFloat(item.cost_price || 0).toLocaleString()}</Text>
              </View>
              <View style={[styles.detailCell, styles.detailCellBorder]}>
                <Text style={styles.detailCellLabel}>Sell Price</Text>
                <Text style={styles.detailCellValue}>₹{parseFloat(item.price || 0).toLocaleString()}</Text>
              </View>
              <TouchableOpacity
                style={[styles.detailCell, styles.detailCellBorder]}
                onPress={() => { setInsightProduct(item); setInsightVisible(true); }}
              >
                <Text style={styles.detailCellLabel}>Margin</Text>
                <Text style={styles.detailCellValue}>{marginPct.toFixed(1)}%</Text>
              </TouchableOpacity>
              <View style={[styles.detailCell, styles.detailCellBorder]}>
                <Text style={styles.detailCellLabel}>Variants</Text>
                <Text style={styles.detailCellValue}>{variants.length > 0 ? variants.length : '—'}</Text>
              </View>
            </View>

            {/* Variant Margin Section */}
            {variants.length > 0 && (
              <View style={styles.variantMarginSection}>
                <View style={styles.variantMarginHeader}>
                  <TrendingUp size={14} color="#000" strokeWidth={2} />
                  <Text style={styles.variantMarginTitle}>VARIANT MARGIN</Text>
                </View>
                <View style={styles.variantMarginPills}>
                  {variants.map((v, idx) => {
                    const vCost = parseFloat(v.cost_price !== undefined && v.cost_price !== null && v.cost_price !== '' ? v.cost_price : (v.costPrice || 0)) || 0;
                    const vmp = v.price > 0 ? (((v.price - vCost) / v.price) * 100) : 0;
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={styles.variantMarginPill}
                        onPress={() => {
                          setVariantMarginData({ variant: v, productName: item.name });
                          setVariantMarginVisible(true);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.variantMarginPillName} numberOfLines={1}>{v.name}</Text>
                        <View style={styles.variantMarginPillBadge}>
                          <Text style={styles.variantMarginPillPct}>{vmp.toFixed(0)}%</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Store, Brand & Variants */}
            <View style={styles.extraRow}>
              <View style={styles.storeTag}>
                <Store size={12} color="#888" />
                <Text style={styles.storeTagText}>{(settings?.store?.name?.trim() || 'STORE')}</Text>
              </View>
              {item.brand ? (
                <View style={styles.brandTag}>
                  <Text style={styles.brandTagText}>{item.brand}</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={styles.viewVariantsBtn}
                onPress={() => { setVariantsProduct(item); setVariantsVisible(true); }}
              >
                <Layers size={13} color="#fff" strokeWidth={2} />
                <Text style={styles.viewVariantsBtnText}>
                  {variants.length > 0 ? `${variants.length} Variants` : 'Add Variants'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Actions */}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleBarcodeClick(item)}>
                <Printer size={18} color="#000" />
                <Text style={styles.actionBtnText}>Barcode</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleEdit(item)}>
                <Edit size={18} color="#000" />
                <Text style={styles.actionBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDel]} onPress={() => handleDelete(item.id)}>
                <Trash2 size={18} color="#000" />
                <Text style={styles.actionBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerWrapper}>
        <LinearGradient colors={['#000000', '#000000']} style={styles.headerGradient}>
          <SafeAreaView edges={['top']}>
            <View style={styles.mainHeader}>
              <View>
                <Text style={styles.mainTitle}>Inventory</Text>
                <Text style={styles.subTitle}>{products.length} Products</Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.headerBtn} onPress={() => debouncedNavigate(navigation, 'BulkUpload')}>
                  <Upload color="#fff" size={22} strokeWidth={2} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.addBtn} onPress={handleAddNew}>
                  <Plus color="#000" size={24} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{products.length}</Text>
                <Text style={styles.statLabel}>Products</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{totalItems.toLocaleString()}</Text>
                <Text style={styles.statLabel}>Total Qty</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>₹{(totalStockValue / 1000).toFixed(0)}k</Text>
                <Text style={styles.statLabel}>Value</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{lowStockProducts.length}</Text>
                <Text style={styles.statLabel}>Low Stock</Text>
              </View>
            </View>

            {/* Search */}
            <View style={styles.searchRow}>
              <View style={styles.searchBar}>
                <Search size={20} color="rgba(255,255,255,0.35)" />
                <TextInput
                  placeholder="Search products, SKU..."
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  style={styles.searchInput}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                />
                {searchTerm !== '' && (
                  <TouchableOpacity onPress={() => setSearchTerm('')}>
                    <X size={20} color="rgba(255,255,255,0.4)" />
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

            {showFilters && (
              <View style={styles.filtersWrap}>
                <Text style={styles.filterSectionLabel}>FILTER BY CATEGORY</Text>
                <CategoryFilter categories={categories} selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory} />
              </View>
            )}

            {/* Sort & Count Bar - Integrated into Header */}
            <View style={styles.sortBar}>
              <View style={styles.sortLeft}>
                <ArrowUpDown size={14} color="rgba(255,255,255,0.4)" />
                <Text style={styles.sortBarLabel}>Sort by</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortChipsRow}>
                <SortChip label="Name" active={sortBy === 'name'} onPress={() => setSortBy('name')} />
                <SortChip label="Price" active={sortBy === 'price'} onPress={() => setSortBy('price')} />
                <SortChip label="Stock" active={sortBy === 'stock'} onPress={() => setSortBy('stock')} />
                <TouchableOpacity style={styles.sortOrderBtn} onPress={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                  <Text style={styles.sortOrderText}>{sortOrder === 'asc' ? '↑ A-Z' : '↓ Z-A'}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>

      {/* List */}
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
                  <AlertCircle size={16} color="#000" />
                  <Text style={styles.alertTitle}>LOW STOCK ALERTS</Text>
                  <View style={styles.alertBadge}><Text style={styles.alertBadgeText}>{lowStockProducts.length}</Text></View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {lowStockProducts.map((p) => (
                    <TouchableOpacity key={p.id} style={[styles.alertCard, { borderColor: '#000', backgroundColor: '#fff' }]} onPress={() => handleEdit({ ...p, id: p._realId || p.id })}>
                      <View style={[styles.alertIconBox, { backgroundColor: '#000' }]}>
                        <Box size={18} color="#fff" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.alertName, { color: '#000' }]} numberOfLines={1}>{p.name}</Text>
                        <Text style={[styles.alertStock, { color: '#000', fontWeight: '900' }]}>{p.alertLabel || `${p.stock} left`}</Text>
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
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <Package size={52} color="#ccc" strokeWidth={1.2} />
              </View>
              <Text style={styles.emptyTitle}>No Products Found</Text>
              <Text style={styles.emptyDesc}>Add your first product or import your inventory.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={handleAddNew}>
                <Plus size={20} color="#fff" />
                <Text style={styles.emptyBtnText}>Add Product</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />

      {/* Selection Bar */}
      {selectionMode && selectedRows.size > 0 && (
        <View style={styles.selectionBar}>
          <View style={styles.selectionLeft}>
            <View style={styles.selCountBox}><Text style={styles.selCountText}>{selectedRows.size}</Text></View>
            <Text style={styles.selLabel}>Selected</Text>
          </View>
          <View style={styles.selectionRight}>
            <TouchableOpacity style={styles.selDeleteBtn} onPress={() => {
              setConfirmModal({
                isOpen: true,
                title: 'Delete Items',
                message: `Are you sure you want to delete ${selectedRows.size} selected items?`,
                variant: 'danger',
                confirmLabel: 'DELETE ALL',
                cancelLabel: 'CANCEL',
                onConfirm: async () => {
                  try {
                    await bulkDeleteProducts(Array.from(selectedRows));
                    showToast(`${selectedRows.size} products moved to Recycle Bin`, 'trash');
                    setSelectionMode(false);
                    setSelectedRows(new Set());
                  } catch (e) {
                    showToast('Bulk delete failed', 'error');
                  }
                }
              });
            }}>
              <Trash2 size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.selCancelBtn} onPress={() => { setSelectionMode(false); setSelectedRows(new Set()); }}>
              <Text style={styles.selCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ProductDrawer visible={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} onSave={handleSaveProduct} product={editingProduct} />
      <MarginInsightModal visible={insightVisible} onClose={() => setInsightVisible(false)} product={insightProduct} />
      <BarcodeSelectionModal visible={!!barcodeActionData} data={barcodeActionData} onClose={() => setBarcodeActionData(null)} settings={settings} />
      <VariantsModal
        visible={variantsVisible}
        onClose={() => { setVariantsVisible(false); setVariantsProduct(null); }}
        product={variantsProduct}
        onSave={async (prod, updatedVariants) => {
          await updateProduct(prod.id, {
            ...prod,
            variants: updatedVariants,
            costPrice: prod.cost_price,
            minStock: prod.min_stock,
          });
          showToast('Variants updated & synced ✓', 'success');
        }}
      />
      <MultiVariantMarginModal
        visible={variantMarginVisible}
        onClose={() => setVariantMarginVisible(false)}
        product={variantsProduct}
      />
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmLabel={confirmModal.confirmLabel}
        cancelLabel={confirmModal.cancelLabel}
        onConfirm={confirmModal.onConfirm}
      />
      <BarcodeViewModal 
        isOpen={barcodeModal.isOpen}
        onClose={() => setBarcodeModal({ ...barcodeModal, isOpen: false })}
        barcode={barcodeModal.barcode}
        name={barcodeModal.name}
        onCopy={copyToClipboard}
        isCopied={isCopied}
      />
    </View>
  );
};

export default ProductsListScreen;

const styles = StyleSheet.create({

  // ─── CONTAINER ─────────────────────
  container: { flex: 1, backgroundColor: '#ffffff' },

  // ─── HEADER ────────────────────────
  headerWrapper: {},
  headerGradient: { 
    borderBottomLeftRadius: 32, 
    borderBottomRightRadius: 32, 
    paddingBottom: 22, // Reduced for tighter integration
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8
  },
  mainHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 10, paddingBottom: 4 },
  mainTitle: { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  subTitle: { fontSize: 14, color: 'rgba(255,255,255,0.45)', fontWeight: '600', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 10 },
  headerBtn: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },

  // ─── STATS ─────────────────────────
  statsRow: { flexDirection: 'row', marginHorizontal: 22, marginTop: 12, marginBottom: 12, gap: 8 },
  statBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },

  // ─── SEARCH ────────────────────────
  searchRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 22, paddingBottom: 8 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', height: 50, borderRadius: 14, paddingHorizontal: 14, gap: 10 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '600', color: '#fff' },
  filterBtn: { width: 50, height: 50, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  filterBtnActive: { backgroundColor: '#fff' },
  filtersWrap: { paddingBottom: 10, paddingHorizontal: 14 },
  filterSectionLabel: { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.35)', letterSpacing: 1, paddingHorizontal: 24, marginBottom: 8, textTransform: 'uppercase' },

  // ─── SORT BAR ──────────────────────
  sortBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingLeft: 24, 
    paddingRight: 12, 
    paddingVertical: 8, 
    backgroundColor: 'transparent', 
    borderBottomWidth: 0
  },
  sortLeft: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    marginRight: 10 
  },
  sortBarLabel: { fontSize: 13, color: 'rgba(255,255,255,0.3)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  sortChipsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 20 },
  sortChip: { 
    paddingHorizontal: 12, 
    paddingVertical: 7, 
    borderRadius: 8, 
    backgroundColor: 'rgba(255,255,255,0.08)', 
    borderWidth: 1.5, 
    borderColor: 'rgba(255,255,255,0.05)' 
  },
  sortChipActive: { backgroundColor: '#fff', borderColor: '#fff' },
  sortChipText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  sortChipTextActive: { color: '#000' },
  sortOrderBtn: { 
    paddingHorizontal: 10, 
    paddingVertical: 7, 
    borderRadius: 8, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    borderWidth: 1.5, 
    borderColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  sortOrderText: { fontSize: 12, fontWeight: '900', color: '#fff' },


  // ─── LIST ──────────────────────────
  listContainer: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 120 },

  // ─── PRODUCT CARD ──────────────────
  productCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: Platform.OS === 'android' ? 1 : 0,
    borderColor: '#f0f0f0',
  },
  productCardSelected: { borderColor: '#000', borderWidth: 2, shadowOpacity: 0.12 },

  cardRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 18, paddingLeft: 16, paddingRight: 14 },
  cardLeft: { marginRight: 14, minWidth: 50 },
  productIcon: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#000', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4 },
  cardCenter: { flex: 1, marginRight: 12, marginTop: 2 },
  productName: { fontSize: 17, fontWeight: '800', color: '#0f172a', marginBottom: 6, letterSpacing: -0.3 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  tagText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  lowTag: { backgroundColor: '#000', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#000' },
  lowTagText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  variantBadge: { backgroundColor: '#000', paddingHorizontal: 4, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#000' },
  variantBadgeText: { fontSize: 9, fontWeight: '900', color: '#fff' },

  cardRight: { alignItems: 'flex-end', minWidth: 90, marginTop: 2 },
  priceMain: { fontSize: 18, fontWeight: '900', color: '#000', letterSpacing: -0.5 },
  stockMain: { fontSize: 12, fontWeight: '900', color: '#000', backgroundColor: '#f5f5f5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#eee' },
  quickActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  quickActionBtn: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 3 },
  expandToggleBtn: { backgroundColor: '#fff' },
  expandToggleBtnActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },

  // ─── EXPANDED ──────────────────────
  expandedSection: { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingHorizontal: 16, paddingBottom: 16, backgroundColor: '#f8fafc', borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },

  detailGrid: { flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: 16, marginTop: 16, paddingVertical: 14, borderWidth: 1.5, borderColor: '#000', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 3 },
  detailCell: { flex: 1, alignItems: 'center' },
  detailCellBorder: { borderLeftWidth: 1, borderLeftColor: '#f1f5f9' },
  detailCellLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  detailCellValue: { fontSize: 15, fontWeight: '800', color: '#0f172a' },

  extraRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  storeTag: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#ffffff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  viewVariantsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0f172a', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, marginLeft: 'auto', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6 },
  viewVariantsBtnText: { fontSize: 12, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  storeTagText: { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  brandTag: { backgroundColor: '#ffffff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  brandTagText: { fontSize: 11, fontWeight: '800', color: '#64748b', letterSpacing: 0.5 },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 2
  },
  actionBtnDel: { borderColor: '#fca5a5', backgroundColor: '#fff5f5' },
  actionBtnText: { fontSize: 14, fontWeight: '800', color: '#334155' },

  // ─── ALERTS ────────────────────────
  alertSection: { marginBottom: 18 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, paddingHorizontal: 4 },
  alertTitle: { fontSize: 12, fontWeight: '800', color: '#000', letterSpacing: 0.5 },
  alertBadge: { backgroundColor: '#000', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  alertBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  alertCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginRight: 10, flexDirection: 'row',
    alignItems: 'center', gap: 12, borderWidth: 2, borderColor: '#000', minWidth: 200
  },
  alertIconBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  alertName: { fontSize: 14, fontWeight: '700', color: '#000' },
  alertStock: { fontSize: 13, color: '#000', fontWeight: '900', marginTop: 2 },

  // ─── CHECKBOX ──────────────────────
  checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 2.5, borderColor: '#ddd', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: '#000', borderColor: '#000' },

  // ─── SELECTION BAR ─────────────────
  selectionBar: { 
    position: 'absolute', 
    bottom: 92, // Increased from 28 to clear bottom nav
    left: 20, 
    right: 20, 
    height: 70, 
    backgroundColor: '#000', 
    borderRadius: 20, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 18, 
    shadowColor: '#000', 
    shadowOpacity: 0.4, 
    shadowRadius: 20, 
    elevation: 15 
  },
  selectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selCountBox: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  selCountText: { fontSize: 15, fontWeight: '800', color: '#000' },
  selLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },
  selectionRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selDeleteBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  selCancelBtn: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  selCancelText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // ─── EMPTY STATE ───────────────────
  emptyContainer: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyIconBox: { width: 90, height: 90, borderRadius: 24, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#eee' },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#000', marginTop: 18 },
  emptyDesc: { fontSize: 15, color: '#888', textAlign: 'center', marginTop: 8, lineHeight: 22, fontWeight: '500' },
  emptyBtn: { marginTop: 22, backgroundColor: '#000', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  greenText: { color: '#000' },
  orangeText: { color: '#666' },
  redText: { color: '#999' },

  // ─── VARIANT MARGIN SECTION ─────────────
  variantMarginSection: { marginTop: 14, backgroundColor: '#fafafa', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#eee' },
  variantMarginHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  variantMarginTitle: { fontSize: 12, fontWeight: '800', color: '#000', letterSpacing: 0.6 },
  variantMarginPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  variantMarginPill: { flexDirection: 'row', alignItems: 'center', gap: 0, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#eee', overflow: 'hidden' },
  variantMarginPillName: { fontSize: 13, fontWeight: '700', color: '#000', paddingHorizontal: 12, paddingVertical: 8 },
  variantMarginPillBadge: { backgroundColor: '#000', paddingHorizontal: 10, paddingVertical: 8 },
  variantMarginPillPct: { fontSize: 13, fontWeight: '800', color: '#fff' },

  // ─── INSIGHT MODAL ─────────────────
  insightOverlay: { flex: 1, justifyContent: 'flex-end' },
  insightBackground: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  insightSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 22 },
  insightHandle: { width: 36, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  insightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 18, paddingBottom: 14 },
  insightTitle: { fontSize: 22, fontWeight: '800', color: '#000' },
  insightSubTitle: { fontSize: 14, color: '#999', fontWeight: '600' },
  insightCloseBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  insightContent: { paddingHorizontal: 22 },
  insightProductRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f5f5f5', padding: 12, borderRadius: 12, marginBottom: 22 },
  insightProductName: { fontSize: 16, fontWeight: '700', color: '#000', flex: 1 },
  chartWrapper: { alignItems: 'center', marginBottom: 22 },
  svgContainer: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  chartCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  chartPercent: { fontSize: 28, fontWeight: '900', color: '#000' },
  chartLabel: { fontSize: 11, fontWeight: '800', color: '#999', letterSpacing: 1 },
  insightMetrics: { gap: 14, marginBottom: 22 },
  metricRow: { flexDirection: 'row', gap: 10 },
  metricBox: { flex: 1, backgroundColor: '#f5f5f5', padding: 16, borderRadius: 14 },
  insMetricLabel: { fontSize: 11, fontWeight: '800', color: '#999', marginBottom: 4, letterSpacing: 0.5 },
  insMetricValue: { fontSize: 20, fontWeight: '800', color: '#000' },
  profitBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderRadius: 14, backgroundColor: '#f5f5f5' },
  profitLabel: { fontSize: 11, fontWeight: '800', color: '#999', letterSpacing: 0.5, marginBottom: 3 },
  profitAmount: { fontSize: 24, fontWeight: '800', color: '#000' },
  profitIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  insightDoneBtn: { height: 54, backgroundColor: '#000', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  insightDoneText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  // ─── BARCODE SELECTION MODAL ─────────────
  barcodeOptionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fafafa', borderWidth: 1.5, borderColor: '#eee', borderRadius: 16, padding: 14, marginBottom: 10, gap: 14 },
  barcodeOptionIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#eee' },
  barcodeOptionName: { fontSize: 14, fontWeight: '800', color: '#000', marginBottom: 2 },
  barcodeOptionVal: { fontSize: 12, fontWeight: '600', color: '#888', letterSpacing: 0.5 },
    // Barcode Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        padding: 24,
    },
    barcodeModalContent: {
        backgroundColor: '#fff',
        borderRadius: 28,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 24,
    },
    modalIconBox: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalTitleSmall: {
        fontSize: 10,
        fontWeight: '900',
        color: '#94a3b8',
        letterSpacing: 1.5,
    },
    modalProductName: {
        fontSize: 18,
        fontWeight: '900',
        color: '#000',
    },
    modalCloseBtnSmall: {
        padding: 8,
    },
    barcodeDisplayBox: {
        backgroundColor: '#f8fafc',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        marginBottom: 24,
    },
    barcodeStringText: {
        fontSize: 22,
        fontWeight: '900',
        color: '#000',
        textAlign: 'center',
        marginBottom: 20,
        letterSpacing: 0.5,
    },
    copyBtnLarge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 14,
        width: '100%',
        borderWidth: 1.5,
        borderColor: '#000',
    },
    copyBtnSuccess: {
        backgroundColor: '#10b981',
        borderColor: '#10b981',
    },
    copyBtnText: {
        fontSize: 13,
        fontWeight: '900',
        color: '#000',
        letterSpacing: 0.5,
    },
    modalDoneBtn: {
        backgroundColor: '#000',
        height: 54,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalDoneBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 1,
    },
});
