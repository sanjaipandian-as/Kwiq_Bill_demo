import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  FlatList
} from 'react-native';
import { X, Save, Search, Plus, ChevronDown, Trash2, Package, Tag, Layers, Barcode, TrendingUp, AlertCircle, Printer } from 'lucide-react-native';
import { db } from '../../services/database';
import { useSettings } from '../../context/SettingsContext';
import { printBarcode } from '../../utils/printUtils';

const TAX_OPTIONS = [
  { label: 'None', value: 0 },
  { label: 'Exempt', value: 0 },
  { label: 'GST@0%', value: 0 },
  { label: 'IGST@0%', value: 0 },
  { label: 'GST@0.25%', value: 0.25 },
  { label: 'IGST@0.25%', value: 0.25 },
  { label: 'GST@3%', value: 3 },
  { label: 'IGST@3%', value: 3 },
  { label: 'GST@5%', value: 5 },
  { label: 'IGST@5%', value: 5 },
  { label: 'GST@12%', value: 12 },
  { label: 'IGST@12%', value: 12 },
  { label: 'GST@18%', value: 18 },
  { label: 'IGST@18%', value: 18 },
  { label: 'GST@28%', value: 28 },
  { label: 'IGST@28%', value: 28 },
  { label: 'GST@40%', value: 40 },
  { label: 'IGST@40%', value: 40 },
];

const ProductDrawer = ({ visible, onClose, onSave, product }) => {
  const { settings } = useSettings();
  const initialState = {
    name: '',
    category: '',
    brand: '',
    price: '',
    costPrice: '',
    stock: '',
    minStock: '',
    unit: '',
    barcode: `SKU-`,
    isActive: true,
    variants: [],
    variant: '',
    tax_rate: 0
  };

  const [form, setForm] = useState(initialState);
  const [newVariant, setNewVariant] = useState('');
  const [newVariantPrice, setNewVariantPrice] = useState('');
  const [newVariantStock, setNewVariantStock] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [newVariantSku, setNewVariantSku] = useState('');
  const [showTaxPicker, setShowTaxPicker] = useState(false);

  useEffect(() => {
    setIsSaving(false);
    if (product) {
      let loadedVariants = [];
      try {
        let rawVariants = typeof product.variants === 'string' ? JSON.parse(product.variants) : (product.variants || []);
        if (Array.isArray(rawVariants)) {
          loadedVariants = rawVariants.map(v => {
            if (!v || typeof v !== 'object') return { name: String(v || ''), price: '', options: [] };
            return {
              ...v,
              name: v.name || '',
              price: v.price !== undefined && v.price !== null ? String(v.price) : '',
              options: Array.isArray(v.options) ? v.options : [],
              stock: v.stock !== undefined && v.stock !== null ? String(v.stock) : '',
              sku: v.sku || ''
            };
          });
        }
      } catch (e) {
        loadedVariants = [];
      }
      setForm({
        ...initialState,
        ...product,
        costPrice: product.cost_price !== undefined ? String(product.cost_price) : (product.costPrice || ''),
        minStock: product.min_stock !== undefined ? String(product.min_stock) : (product.minStock || ''),
        barcode: product.sku || product.barcode || initialState.barcode,
        variants: loadedVariants,
        variant: product.variant || '',
        tax_rate: product.tax_rate !== undefined ? product.tax_rate : (product.taxRate || 0)
      });
    } else {
      setForm(initialState);
    }
  }, [product, visible]);

  const margin = useMemo(() =>
    form.price && form.costPrice
      ? ((parseFloat(form.price) - parseFloat(form.costPrice)) / parseFloat(form.price)) * 100
      : 0,
    [form.price, form.costPrice]
  );

  const handleChange = useCallback((key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleAddVariant = useCallback(() => {
    if (newVariant.trim()) {
      const variantObj = {
        name: newVariant.trim(),
        options: [newVariant.trim()],
        price: newVariantPrice.trim() !== '' ? parseFloat(newVariantPrice) : null,
        stock: newVariantStock.trim() !== '' ? parseInt(newVariantStock) : 0,
        sku: newVariantSku.trim() || `SKU-${Date.now()}`
      };

      setForm(prev => ({
        ...prev,
        variants: [...prev.variants, variantObj]
      }));
      setNewVariant('');
      setNewVariantPrice('');
      setNewVariantStock('');
      setNewVariantSku('');
    }
  }, [newVariant, newVariantPrice, newVariantStock, newVariantSku]);

  const handleRemoveVariant = useCallback((index) => {
    setForm(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }));
  }, []);

  const handleVariantChange = useCallback((index, field, value) => {
    setForm(prev => {
      const newVariants = [...prev.variants];
      newVariants[index] = { ...newVariants[index], [field]: value };
      return { ...prev, variants: newVariants };
    });
  }, []);

  const handleLocalSave = () => {
    const skuValue = form.barcode?.trim();
    const nameValue = form.name?.trim() || "New Product";

    if (!skuValue) {
      Alert.alert("Required Field", "Barcode/SKU is mandatory.");
      return;
    }

    const performSave = async () => {
      try {
        setIsSaving(true);
        await onSave({
          ...form,
          id: product?.id || Date.now().toString(),
          name: nameValue,
          sku: skuValue,
          barcode: skuValue,
          variants: form.variants,
          variant: form.variant,
          tax_rate: parseFloat(form.tax_rate) || 0
        });
        onClose();
      } catch (err) {
        setIsSaving(false);
      }
    };

    const missingPrices = form.variants.some(v => !v.price);
    if (missingPrices) {
      Alert.alert(
        "Missing Prices",
        "Some variants don't have a price. Save anyway?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Confirm", onPress: performSave }
        ]
      );
    } else {
      performSave();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <View style={styles.sheet}>
            <View style={styles.modalIndicator} />

            <View style={styles.header}>
              <View>
                <Text style={styles.modalTitle}>{product ? 'Edit Product' : 'Add New Item'}</Text>
                <Text style={styles.modalSub}>{product ? 'Modify product details' : 'Create a new catalog entry'}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color="#000" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={true}
            >
              <View style={styles.sectionHeader}>
                <Package size={16} color="#64748b" />
                <Text style={styles.sectionLabel}>General Information</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>PRODUCT NAME</Text>
                <TextInput
                  style={styles.premiumInput}
                  value={form.name}
                  onChangeText={(v) => handleChange('name', v)}
                  placeholder="e.g. Premium Basmati Rice"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.label}>CATEGORY</Text>
                  <TextInput
                    style={styles.premiumInput}
                    value={form.category}
                    onChangeText={(v) => handleChange('category', v)}
                    placeholder="e.g. Groceries"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View style={styles.col}>
                  <Text style={styles.label}>BRAND</Text>
                  <TextInput
                    style={styles.premiumInput}
                    value={form.brand}
                    onChangeText={(v) => handleChange('brand', v)}
                    placeholder="e.g. Tata"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              <View style={[styles.sectionHeader, { marginTop: 24 }]}>
                <TrendingUp size={16} color="#64748b" />
                <Text style={styles.sectionLabel}>Pricing & Tax</Text>
              </View>

              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.label}>COST PRICE (₹)</Text>
                  <TextInput
                    style={styles.amountInput}
                    keyboardType="numeric"
                    value={form.costPrice.toString()}
                    onChangeText={(v) => handleChange('costPrice', v)}
                    placeholder="0.00"
                  />
                </View>
                <View style={styles.col}>
                  <Text style={styles.label}>SELLING PRICE (₹)</Text>
                  <TextInput
                    style={[styles.amountInput, { color: '#000' }]}
                    keyboardType="numeric"
                    value={form.price.toString()}
                    onChangeText={(v) => handleChange('price', v)}
                    placeholder="0.00"
                  />
                </View>
              </View>

              <View style={styles.marginBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.marginLabel}>PROJECTED MARGIN</Text>
                  <Text style={styles.marginDesc}>{margin > 0 ? 'Profitable margin' : 'Low or negative margin'}</Text>
                </View>
                <Text style={[styles.marginValue, { color: margin > 0 ? '#10b981' : '#ef4444' }]}>
                  {isNaN(margin) ? '0' : margin.toFixed(1)}%
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>APPLICABLE TAX RATE</Text>
                <TouchableOpacity
                  style={styles.selectTrigger}
                  onPress={() => setShowTaxPicker(true)}
                >
                  <Text style={styles.selectText}>
                    {TAX_OPTIONS.find(o => o.value === form.tax_rate)?.label || `${form.tax_rate}%`}
                  </Text>
                  <ChevronDown size={18} color="#000" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              <View style={[styles.sectionHeader, { marginTop: 24 }]}>
                <Layers size={16} color="#64748b" />
                <Text style={styles.sectionLabel}>Stock Management</Text>
              </View>

              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.label}>CURRENT STOCK</Text>
                  <TextInput
                    style={styles.premiumInput}
                    keyboardType="numeric"
                    value={form.stock.toString()}
                    onChangeText={(v) => handleChange('stock', v.replace(/[^0-9]/g, ''))}
                    placeholder="0"
                  />
                </View>
                <View style={styles.col}>
                  <Text style={styles.label}>LOW STOCK LEVEL</Text>
                  <TextInput
                    style={styles.premiumInput}
                    keyboardType="numeric"
                    value={form.minStock.toString()}
                    onChangeText={(v) => handleChange('minStock', v.replace(/[^0-9]/g, ''))}
                    placeholder="0"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>SKU / BARCODE</Text>
                <View style={styles.barcodeWrapper}>
                  <TextInput
                    style={[styles.premiumInput, { flex: 1, marginBottom: 0 }]}
                    value={form.barcode}
                    onChangeText={(v) => handleChange('barcode', v)}
                  />
                  {form.barcode?.length > 4 && (
                    <TouchableOpacity
                      style={[styles.scanAction, { backgroundColor: '#3b82f6' }]}
                      onPress={() => printBarcode(form.name || 'Product', form.barcode, settings)}
                    >
                      <Printer size={20} color="#fff" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.scanAction}>
                    <Barcode size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.sectionHeader, { marginTop: 24, marginBottom: 8 }]}>
                <Tag size={16} color="#64748b" />
                <Text style={styles.sectionLabel}>Product Variants</Text>
              </View>
              <Text style={styles.sectionHint}>Create multiple options for this product like different Sizes (L, XL, XXL) or Colors (Red, Blue, Green).</Text>

              <View style={styles.variantForm}>
                <View style={styles.variantLabelRow}>
                  <Text style={[styles.microLabel, { flex: 2 }]}>VARIANT DETAIL</Text>
                  <Text style={[styles.microLabel, { flex: 1 }]}>PRICE (₹)</Text>
                </View>
                <View style={styles.variantRow}>
                  <TextInput
                    style={[styles.variantInput, { flex: 2 }]}
                    placeholder="e.g. Red, XL, 1kg"
                    value={newVariant}
                    onChangeText={setNewVariant}
                    placeholderTextColor="#cbd5e1"
                  />
                  <TextInput
                    style={[styles.variantInput, { flex: 1 }]}
                    placeholder="e.g. 499"
                    keyboardType="numeric"
                    value={newVariantPrice}
                    onChangeText={setNewVariantPrice}
                    placeholderTextColor="#cbd5e1"
                  />
                </View>

                <View style={[styles.variantLabelRow, { marginTop: 14 }]}>
                  <Text style={[styles.microLabel, { flex: 1 }]}>STOCK QTY</Text>
                  <View style={{ width: 60 }} />
                </View>
                <View style={styles.variantRow}>
                  <TextInput
                    style={[styles.variantInput, { flex: 1 }]}
                    placeholder="e.g. 50"
                    keyboardType="numeric"
                    value={newVariantStock}
                    onChangeText={setNewVariantStock}
                    placeholderTextColor="#cbd5e1"
                  />
                  <TouchableOpacity onPress={handleAddVariant} style={styles.addIconBtn}>
                    <Plus size={20} color="#fff" strokeWidth={3} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.variantsContainer}>
                {form.variants.map((v, index) => {
                  const displayName = v.name || (v.options && v.options[0]) || 'Variant';
                  return (
                    <View key={index} style={[styles.variantCard, { alignItems: 'flex-start' }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.variantName, { marginBottom: 12 }]}>{displayName.toUpperCase()}</Text>

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 9, fontWeight: '800', color: '#94a3b8', marginBottom: 6, letterSpacing: 0.5 }}>PRICE (₹)</Text>
                            <TextInput
                              style={{ height: 44, backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 12, fontSize: 13, fontWeight: '700', color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0' }}
                              value={v.price !== undefined && v.price !== null ? String(v.price) : ''}
                              onChangeText={(val) => handleVariantChange(index, 'price', val)}
                              keyboardType="numeric"
                              placeholder="0"
                              placeholderTextColor="#cbd5e1"
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 9, fontWeight: '800', color: '#94a3b8', marginBottom: 6, letterSpacing: 0.5 }}>STOCK</Text>
                            <TextInput
                              style={{ height: 44, backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 12, fontSize: 13, fontWeight: '700', color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0' }}
                              value={v.stock !== undefined && v.stock !== null ? String(v.stock) : ''}
                              onChangeText={(val) => handleVariantChange(index, 'stock', val)}
                              keyboardType="numeric"
                              placeholder="0"
                              placeholderTextColor="#cbd5e1"
                            />
                          </View>
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => handleRemoveVariant(index)} style={[styles.deleteVarBtn, { marginTop: 0, alignSelf: 'center', marginLeft: 16 }]}>
                        <Trash2 size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>

              <View style={{ height: 120 }} />
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.ghostBtn, isSaving && { opacity: 0.5 }]}
                onPress={onClose}
                disabled={isSaving}
              >
                <Text style={styles.ghostBtnText}>DISCARD</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, isSaving && { opacity: 0.7, backgroundColor: '#94a3b8' }]}
                onPress={handleLocalSave}
                disabled={isSaving}
              >
                <Text style={styles.primaryBtnText}>
                  {isSaving ? 'UPLOADING...' : (product ? 'UPDATE ITEM' : 'SAVE PRODUCT')}
                </Text>
              </TouchableOpacity>
            </View>

            <Modal visible={showTaxPicker} transparent animationType="slide" onRequestClose={() => setShowTaxPicker(false)}>
              <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowTaxPicker(false)}>
                <View style={styles.pickerContent}>
                  <View style={styles.pickerHeader}>
                    <Text style={styles.pickerTitle}>Select Tax Rate</Text>
                    <View style={styles.pickerIndicator} />
                  </View>
                  <FlatList
                    data={TAX_OPTIONS}
                    keyExtractor={(item, index) => index.toString()}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[styles.pickerItem, form.tax_rate === item.value && styles.pickerItemActive]}
                        onPress={() => {
                          handleChange('tax_rate', item.value);
                          setShowTaxPicker(false);
                        }}
                      >
                        <Text style={[styles.pickerItemText, form.tax_rate === item.value && styles.pickerItemTextActive]}>
                          {item.label}
                        </Text>
                        {form.tax_rate === item.value && <View style={styles.activeDot} />}
                      </TouchableOpacity>
                    )}
                    style={{ maxHeight: 400 }}
                  />
                </View>
              </TouchableOpacity>
            </Modal>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 36, borderTopRightRadius: 36, width: '100%', maxHeight: '94%' },
  modalIndicator: { width: 40, height: 5, backgroundColor: '#e2e8f0', borderRadius: 5, alignSelf: 'center', marginTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 28, paddingTop: 20, paddingBottom: 24, alignItems: 'center' },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#000', letterSpacing: -0.5 },
  modalSub: { fontSize: 13, color: '#64748b', fontWeight: '600', marginTop: 2 },
  closeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#f1f5f9' },
  content: { paddingHorizontal: 28, paddingBottom: 60 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 },
  sectionHint: { fontSize: 13, color: '#94a3b8', fontWeight: '500', marginBottom: 20, lineHeight: 18 },
  label: { fontSize: 10, fontWeight: '900', color: '#94a3b8', marginBottom: 8, letterSpacing: 0.8 },
  inputGroup: { marginBottom: 20 },
  premiumInput: { height: 54, backgroundColor: '#f8fafc', borderRadius: 16, paddingHorizontal: 16, fontSize: 15, fontWeight: '700', color: '#000', borderWidth: 1.5, borderColor: '#f1f5f9' },
  amountInput: { height: 64, backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 20, fontSize: 24, fontWeight: '900', color: '#64748b', borderWidth: 2, borderColor: '#f1f5f9', textAlign: 'center' },
  row: { flexDirection: 'row', gap: 14, marginBottom: 20 },
  col: { flex: 1 },
  marginBanner: { backgroundColor: '#000', padding: 20, borderRadius: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  marginLabel: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  marginDesc: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  marginValue: { color: '#fff', fontSize: 24, fontWeight: '900' },
  selectTrigger: { height: 54, backgroundColor: '#f8fafc', borderRadius: 16, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1.5, borderColor: '#f1f5f9' },
  selectText: { fontSize: 15, fontWeight: '700', color: '#000' },
  barcodeWrapper: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  scanAction: { width: 54, height: 54, borderRadius: 16, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  variantForm: { backgroundColor: '#f8fafc', padding: 20, borderRadius: 24, borderWidth: 1.5, borderColor: '#f1f5f9', marginBottom: 16 },
  variantLabelRow: { flexDirection: 'row', gap: 10, marginBottom: 6, paddingHorizontal: 4 },
  microLabel: { fontSize: 9, fontWeight: '900', color: '#94a3b8', letterSpacing: 0.5 },
  variantRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  variantInput: { height: 50, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, fontSize: 14, fontWeight: '700', color: '#000', borderWidth: 1.5, borderColor: '#e2e8f0' },
  addIconBtn: { width: 50, height: 50, borderRadius: 14, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', shadowColor: '#10b981', shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },
  variantsContainer: { gap: 10 },
  variantCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 18, borderWidth: 1.5, borderColor: '#000' },
  variantName: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 0.5 },
  variantMeta: { fontSize: 12, fontWeight: '600', color: '#64748b', marginTop: 2 },
  deleteVarBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fef2f2' },
  footer: { flexDirection: 'row', paddingHorizontal: 24, paddingTop: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24, borderTopWidth: 1.5, borderColor: '#f1f5f9', gap: 12, backgroundColor: '#fff' },
  ghostBtn: {
    flex: 1,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#fee2e2',
    backgroundColor: '#fff'
  },
  ghostBtnText: { color: '#ef4444', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  primaryBtn: { flex: 2, height: 56, backgroundColor: '#10b981', borderRadius: 18, alignItems: 'center', justifyContent: 'center', shadowColor: '#10b981', shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  pickerContent: { backgroundColor: '#fff', borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, paddingBottom: 60 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  pickerTitle: { fontSize: 20, fontWeight: '900', color: '#000', letterSpacing: -0.5 },
  pickerIndicator: { width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2 },
  pickerItem: { paddingVertical: 18, borderBottomWidth: 1.5, borderColor: '#f8fafc', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10 },
  pickerItemActive: { backgroundColor: '#f8fafc', borderRadius: 16, borderColor: 'transparent' },
  pickerItemText: { fontSize: 16, color: '#64748b', fontWeight: '700' },
  pickerItemTextActive: { color: '#000', fontWeight: '900' },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#000' }
});

export default memo(ProductDrawer);