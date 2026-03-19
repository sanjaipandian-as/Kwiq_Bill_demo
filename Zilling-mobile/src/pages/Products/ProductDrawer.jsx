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
  FlatList,
  Vibration,
  Dimensions,
} from 'react-native';
import { X, Plus, ChevronDown, Trash2, Package, Tag, Layers, Barcode, TrendingUp, AlertCircle, Printer, Scan } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSettings } from '../../context/SettingsContext';
import { printBarcode } from '../../utils/printUtils';
import { validateBarcodeFormat, detectDuplicateBarcodes, sanitizeBarcode } from '../../utils/barcodeUtils';

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

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
    tax_rate: 0,
  };

  // ── Form State ────────────────────────────────────────────────
  const [form, setForm] = useState(initialState);
  const [isSaving, setIsSaving] = useState(false);
  const [showTaxPicker, setShowTaxPicker] = useState(false);

  // ── New-Variant Row State ──────────────────────────────────────
  const [newVariant, setNewVariant] = useState('');
  const [newVariantPrice, setNewVariantPrice] = useState('');
  const [newVariantCostPrice, setNewVariantCostPrice] = useState('');
  const [newVariantStock, setNewVariantStock] = useState('');
  const [newVariantSku, setNewVariantSku] = useState('');
  const [newVariantBarcode, setNewVariantBarcode] = useState(''); // ← NEW

  // ── Inline Camera Scanner State ───────────────────────────────
  // variantScanTarget: null (closed) | 'new' (new-variant row) | number (index of existing variant)
  // productScanActive: true when scanning for the product-level barcode
  const [permission, requestPermission] = useCameraPermissions();
  const [variantScanTarget, setVariantScanTarget] = useState(null);
  const [isVariantScanning, setIsVariantScanning] = useState(false);
  const [variantScanned, setVariantScanned] = useState(false);
  const [productScanActive, setProductScanActive] = useState(false);
  const [productScanned, setProductScanned] = useState(false);

  // ─────────────────────────────────────────────────────────────
  // Load product data into form
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    setIsSaving(false);
    resetNewVariantRow();

    if (product) {
      let loadedVariants = [];
      try {
        let rawVariants =
          typeof product.variants === 'string'
            ? JSON.parse(product.variants)
            : product.variants || [];

        if (Array.isArray(rawVariants)) {
          loadedVariants = rawVariants
            .filter(v => v && typeof v === 'object') // skip corrupted entries
            .map(v => ({
              ...v,
              name: String(v.name || '').trim(),
              price: v.price !== undefined && v.price !== null ? String(v.price) : '',
              cost_price: resolveStringField(v, ['cost_price', 'costPrice']),
              options: Array.isArray(v.options) ? v.options : [],
              stock: resolveStringField(v, ['stock', 'qty', 'quantity']),
              sku: String(v.sku || '').trim(),
              barcode: String(v.barcode || v.sku || '').trim(), // ← NEW: load barcode
            }));
        }
      } catch (_e) {
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
        tax_rate: product.tax_rate !== undefined ? product.tax_rate : (product.taxRate || 0),
      });
    } else {
      setForm(initialState);
    }
  }, [product, visible]);

  // Helper: safely resolve a string value from multiple candidate fields
  const resolveStringField = (obj, keys) => {
    for (const key of keys) {
      const val = obj[key];
      if (val !== undefined && val !== null && val !== '') return String(val);
    }
    return '';
  };

  // Helper: clear new-variant row inputs
  const resetNewVariantRow = () => {
    setNewVariant('');
    setNewVariantPrice('');
    setNewVariantCostPrice('');
    setNewVariantStock('');
    setNewVariantSku('');
    setNewVariantBarcode('');
  };

  // ─────────────────────────────────────────────────────────────
  // Derived values
  // ─────────────────────────────────────────────────────────────

  const margin = useMemo(() =>
    form.price && form.costPrice
      ? ((parseFloat(form.price) - parseFloat(form.costPrice)) / parseFloat(form.price)) * 100
      : 0,
    [form.price, form.costPrice]
  );

  // ─────────────────────────────────────────────────────────────
  // Form Handlers
  // ─────────────────────────────────────────────────────────────

  const handleChange = useCallback((key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleAddVariant = useCallback(() => {
    const nameClean = newVariant.trim();
    if (!nameClean) return;

    // Auto-generate a barcode if neither barcode nor sku provided
    const autoSku = `SKU-${Date.now()}`;
    const barcodeVal = sanitizeBarcode(newVariantBarcode) || sanitizeBarcode(newVariantSku) || autoSku;

    const variantObj = {
      name: nameClean,
      options: [nameClean],
      cost_price: newVariantCostPrice.trim() !== '' ? parseFloat(newVariantCostPrice) : 0,
      price: newVariantPrice.trim() !== '' ? parseFloat(newVariantPrice) : null,
      stock: newVariantStock.trim() !== '' ? parseInt(newVariantStock, 10) : 0,
      sku: sanitizeBarcode(newVariantSku) || autoSku,
      barcode: barcodeVal, // ← NEW
    };

    setForm(prev => ({ ...prev, variants: [...prev.variants, variantObj] }));
    resetNewVariantRow();
  }, [newVariant, newVariantPrice, newVariantCostPrice, newVariantStock, newVariantSku, newVariantBarcode]);

  const handleRemoveVariant = useCallback((index) => {
    setForm(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  }, []);

  const handleVariantChange = useCallback((index, field, value) => {
    setForm(prev => {
      const updated = [...prev.variants];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, variants: updated };
    });
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Camera / Scanner
  // ─────────────────────────────────────────────────────────────

  const openVariantScanner = async (target) => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera access is needed to scan barcodes.');
        return;
      }
    }
    setVariantScanned(false);
    setVariantScanTarget(target);
    setIsVariantScanning(true);
  };

  const openProductScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera access is needed to scan barcodes.');
        return;
      }
    }
    setProductScanned(false);
    setProductScanActive(true);
  };

  const handleVariantBarcodeScanned = useCallback(({ data }) => {
    if (variantScanned) return;
    setVariantScanned(true);
    Vibration.vibrate(200);

    const safe = sanitizeBarcode(data);
    if (!safe) {
      Alert.alert('Invalid Barcode', 'The scanned barcode value is not valid.');
      setIsVariantScanning(false);
      setVariantScanTarget(null);
      return;
    }

    if (variantScanTarget === 'new') {
      setNewVariantBarcode(safe);
    } else if (typeof variantScanTarget === 'number') {
      handleVariantChange(variantScanTarget, 'barcode', safe);
    }

    setIsVariantScanning(false);
    setVariantScanTarget(null);
  }, [variantScanned, variantScanTarget, handleVariantChange]);

  const handleProductBarcodeScanned = useCallback(({ data }) => {
    if (productScanned) return;
    setProductScanned(true);
    Vibration.vibrate(200);

    const safe = sanitizeBarcode(data);
    if (!safe) {
      Alert.alert('Invalid Barcode', 'The scanned barcode value is not valid.');
      setProductScanActive(false);
      return;
    }

    handleChange('barcode', safe);
    setProductScanActive(false);
  }, [productScanned, handleChange]);

  // ─────────────────────────────────────────────────────────────
  // Save Validation & Action
  // ─────────────────────────────────────────────────────────────

  const handleLocalSave = () => {
    const skuValue = sanitizeBarcode(form.barcode);
    const nameValue = form.name?.trim() || 'New Product';

    // ── Guard 1: Product SKU is mandatory ──────────────────────
    if (!skuValue) {
      Alert.alert('Required Field', 'Barcode/SKU is mandatory.');
      return;
    }

    // ── Guard 2: Validate product barcode format ───────────────
    const productBarcodeCheck = validateBarcodeFormat(skuValue);
    if (!productBarcodeCheck.valid) {
      Alert.alert('Invalid Barcode', productBarcodeCheck.reason);
      return;
    }

    // ── Guard 3: Validate per-variant barcodes format ──────────
    for (let i = 0; i < form.variants.length; i++) {
      const v = form.variants[i];
      const vbc = v.barcode || v.sku;
      if (vbc) {
        const vCheck = validateBarcodeFormat(vbc);
        if (!vCheck.valid) {
          Alert.alert(
            'Invalid Variant Barcode',
            `Variant "${v.name || `#${i + 1}`}": ${vCheck.reason}`
          );
          return;
        }
      }
    }

    // ── Guard 4: Detect duplicate barcodes (hard block) ────────
    const { hasDuplicates, duplicates } = detectDuplicateBarcodes(skuValue, form.variants);
    if (hasDuplicates) {
      Alert.alert(
        'Duplicate Barcodes Detected',
        `Each variant must have a unique barcode. Duplicates found:\n\n• ${duplicates.join('\n• ')}\n\nPlease fix before saving.`
      );
      return;
    }

    // ── Proceed with save ──────────────────────────────────────
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
          tax_rate: parseFloat(form.tax_rate) || 0,
        });
        onClose();
      } catch (err) {
        console.error('[ProductDrawer] Save failed:', err);
        setIsSaving(false);
      }
    };

    // ── Soft warning: missing variant price ────────────────────
    const missingPrices = form.variants.some(v => !v.price && v.price !== 0);
    // ── Soft warning: missing variant barcode ──────────────────
    const missingBarcodes = form.variants.some(v => !v.barcode && !v.sku);

    const warnings = [];
    if (missingPrices) warnings.push('Some variants are missing a selling price.');
    if (missingBarcodes) warnings.push('Some variants have no barcode — they won\'t be scannable.');

    if (warnings.length > 0) {
      Alert.alert(
        'Review Before Saving',
        warnings.join('\n\n') + '\n\nSave anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save Anyway', onPress: performSave },
        ]
      );
    } else {
      performSave();
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Render Helpers
  // ─────────────────────────────────────────────────────────────

  const renderVariantCard = (v, index) => {
    const displayName = v.name || (v.options && v.options[0]) || 'Variant';
    const costVal = resolveStringField(v, ['cost_price', 'costPrice']);
    const priceVal = parseFloat(v.price || 0) || 0;
    const costNum = parseFloat(costVal || 0) || 0;
    const vMargin = priceVal > 0 ? (((priceVal - costNum) / priceVal) * 100).toFixed(1) : null;
    const hasBarcode = !!(v.barcode || v.sku);

    return (
      <View key={index} style={styles.variantCard}>
        <View style={{ flex: 1 }}>
          {/* Variant header row */}
          <View style={styles.variantHeaderRow}>
            <Text style={styles.variantName}>{displayName.toUpperCase()}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {!hasBarcode && (
                <View style={styles.noBarcodeTag}>
                  <AlertCircle size={10} color="#f59e0b" />
                  <Text style={styles.noBarcodeTagText}>No Barcode</Text>
                </View>
              )}
              {vMargin !== null && (
                <View style={styles.variantMarginBadge}>
                  <Text style={styles.variantMarginBadgeText}>{vMargin}% margin</Text>
                </View>
              )}
            </View>
          </View>

          {/* Price / Cost / Stock row */}
          <View style={styles.variantFieldsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.variantFieldLabel}>COST PRICE (₹)</Text>
              <TextInput
                style={styles.variantFieldInput}
                value={costVal}
                onChangeText={(val) => handleVariantChange(index, 'cost_price', val)}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#cbd5e1"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.variantFieldLabel}>SELL PRICE (₹)</Text>
              <TextInput
                style={styles.variantFieldInput}
                value={v.price !== undefined && v.price !== null ? String(v.price) : ''}
                onChangeText={(val) => handleVariantChange(index, 'price', val)}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#cbd5e1"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.variantFieldLabel}>STOCK</Text>
              <TextInput
                style={styles.variantFieldInput}
                value={String(v.stock ?? v.qty ?? v.quantity ?? '')}
                onChangeText={(val) => handleVariantChange(index, 'stock', val)}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#cbd5e1"
              />
            </View>
          </View>

          {/* ── Barcode row (NEW) ── */}
          <View style={{ marginTop: 12 }}>
            <Text style={styles.variantFieldLabel}>VARIANT BARCODE / SKU</Text>
            <View style={styles.variantBarcodeRow}>
              <TextInput
                style={[styles.variantFieldInput, { flex: 1, marginBottom: 0 }]}
                value={v.barcode || v.sku || ''}
                onChangeText={(val) => handleVariantChange(index, 'barcode', val)}
                placeholder="Enter or scan barcode"
                placeholderTextColor="#000000ff"
                autoCapitalize="characters"
                maxLength={128}
              />
              {/* Print label for this variant */}
              {hasBarcode && (
                <TouchableOpacity
                  style={styles.variantBarcodeBtn}
                  onPress={() => printBarcode(`${form.name} - ${displayName}`, v.barcode || v.sku, settings)}
                  accessibilityLabel={`Print barcode for variant ${displayName}`}
                >
                  <Printer size={15} color="#fff" />
                </TouchableOpacity>
              )}
              {/* Scan camera for this variant */}
              <TouchableOpacity
                style={[styles.variantBarcodeBtn, { backgroundColor: '#000000ff' }]}
                onPress={() => openVariantScanner(index)}
                accessibilityLabel={`Scan barcode for variant ${displayName}`}
              >
                <Scan size={15} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Delete variant */}
        <TouchableOpacity
          onPress={() => handleRemoveVariant(index)}
          style={styles.deleteVarBtn}
          accessibilityLabel={`Remove variant ${displayName}`}
        >
          <Trash2 size={18} color="#000" />
        </TouchableOpacity>
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kavWrapper}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={styles.sheet}>
            <View style={styles.modalIndicator} />

            {/* Header */}
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
              style={{ flex: 1 }}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={true}
            >
              {/* ── Section: General Information ── */}
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

              {/* ── Section: Pricing & Tax ── */}
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
                <Text style={[styles.marginValue, { color: '#fff' }]}>
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

              {/* ── Section: Stock Management ── */}
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

              {/* ── SKU / Product Barcode ── */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>PRODUCT SKU / BARCODE</Text>
                <View style={styles.barcodeWrapper}>
                  <TextInput
                    style={[styles.premiumInput, { flex: 1, marginBottom: 0 }]}
                    value={form.barcode}
                    onChangeText={(v) => handleChange('barcode', v)}
                    autoCapitalize="characters"
                    maxLength={128}
                  />
                  {/* Print product barcode */}
                  {form.barcode?.length > 4 && (
                    <TouchableOpacity
                      style={styles.scanAction}
                      onPress={() => printBarcode(form.name || 'Product', form.barcode, settings)}
                      accessibilityLabel="Print product barcode"
                    >
                      <Printer size={20} color="#fff" />
                    </TouchableOpacity>
                  )}
                  {/* Scan camera for product barcode */}
                  <TouchableOpacity
                    style={[styles.scanAction, { backgroundColor: '#000' }]}
                    onPress={openProductScanner}
                    accessibilityLabel="Scan product barcode"
                  >
                    <Scan size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* ── Section: Product Variants ── */}
              <View style={[styles.sectionHeader, { marginTop: 24, marginBottom: 8 }]}>
                <Tag size={16} color="#64748b" />
                <Text style={styles.sectionLabel}>Product Variants</Text>
              </View>
              <Text style={styles.sectionHint}>
                Create multiple options for this product like Sizes (L, XL, XXL) or Colors (Red, Blue, Green).
                Each variant can have its own barcode for accurate scanning.
              </Text>

              {/* ── New Variant Form ── */}
              <View style={styles.variantForm}>
                {/* Row 1: Name + Sell Price */}
                <View style={styles.variantLabelRow}>
                  <Text style={[styles.microLabel, { flex: 2 }]}>VARIANT DETAIL</Text>
                  <Text style={[styles.microLabel, { flex: 1 }]}>SELL PRICE (₹)</Text>
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

                {/* Row 2: Cost + Stock */}
                <View style={[styles.variantLabelRow, { marginTop: 14 }]}>
                  <Text style={[styles.microLabel, { flex: 1 }]}>COST PRICE (₹)</Text>
                  <Text style={[styles.microLabel, { flex: 1 }]}>STOCK QTY</Text>
                  <View style={{ width: 50 }} />
                </View>
                <View style={styles.variantRow}>
                  <TextInput
                    style={[styles.variantInput, { flex: 1 }]}
                    placeholder="e.g. 400"
                    keyboardType="numeric"
                    value={newVariantCostPrice}
                    onChangeText={setNewVariantCostPrice}
                    placeholderTextColor="#cbd5e1"
                  />
                  <TextInput
                    style={[styles.variantInput, { flex: 1 }]}
                    placeholder="e.g. 50"
                    keyboardType="numeric"
                    value={newVariantStock}
                    onChangeText={setNewVariantStock}
                    placeholderTextColor="#cbd5e1"
                  />
                  <View style={{ width: 50 }} />
                </View>

                {/* Row 3: Barcode (NEW) */}
                <View style={[styles.variantLabelRow, { marginTop: 14 }]}>
                  <Text style={[styles.microLabel, { flex: 1 }]}>VARIANT BARCODE / SKU</Text>
                </View>
                <View style={styles.variantRow}>
                  <TextInput
                    style={[styles.variantInput, { flex: 1 }]}
                    placeholder="e.g. SKU-VAR-001 or scan ↓"
                    value={newVariantBarcode}
                    onChangeText={setNewVariantBarcode}
                    placeholderTextColor="#cbd5e1"
                    autoCapitalize="characters"
                    maxLength={128}
                  />
                  {/* Camera scan for new variant barcode */}
                  <TouchableOpacity
                    style={[styles.addIconBtn, { backgroundColor: '#000', marginLeft: 8 }]}
                    onPress={() => openVariantScanner('new')}
                    accessibilityLabel="Scan barcode for new variant"
                  >
                    <Scan size={18} color="#fff" />
                  </TouchableOpacity>
                  {/* Add variant button */}
                  <TouchableOpacity
                    onPress={handleAddVariant}
                    style={styles.addIconBtn}
                    accessibilityLabel="Add variant"
                  >
                    <Plus size={20} color="#fff" strokeWidth={3} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* ── Existing Variant Cards ── */}
              <View style={styles.variantsContainer}>
                {form.variants.map((v, index) => renderVariantCard(v, index))}
              </View>

              <View style={{ height: 120 }} />
            </ScrollView>

            {/* Footer */}
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

            {/* ── Tax Picker Modal ── */}
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
                        onPress={() => { handleChange('tax_rate', item.value); setShowTaxPicker(false); }}
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

            {/* ── Variant Barcode Camera Scanner Modal ── */}
            <Modal
              visible={isVariantScanning}
              animationType="fade"
              presentationStyle="fullScreen"
              statusBarTranslucent
              onRequestClose={() => { setIsVariantScanning(false); setVariantScanTarget(null); }}
            >
              <View style={styles.cameraContainer}>
                <CameraView
                  key={isVariantScanning ? 'variant-scan-active' : 'variant-scan-inactive'}
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  onBarcodeScanned={variantScanned ? undefined : handleVariantBarcodeScanned}
                  barcodeScannerSettings={{
                    barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'],
                  }}
                  onMountError={(err) => {
                    console.error('[ProductDrawer] Camera mount error:', err);
                    setIsVariantScanning(false);
                  }}
                >
                  <View style={styles.cameraUi}>
                    {/* Camera header */}
                    <View style={styles.camHeader}>
                      <TouchableOpacity
                        onPress={() => { setIsVariantScanning(false); setVariantScanTarget(null); }}
                        style={styles.camCloseBtn}
                      >
                        <X size={24} color="#fff" />
                      </TouchableOpacity>
                      <Text style={styles.camTitle}>
                        {variantScanTarget === 'new'
                          ? 'Scan New Variant Barcode'
                          : `Scan Variant ${typeof variantScanTarget === 'number' ? `#${variantScanTarget + 1}` : ''} Barcode`}
                      </Text>
                      <View style={{ width: 44 }} />
                    </View>

                    {/* Focus reticle */}
                    <View style={styles.camFocusArea}>
                      <View style={styles.camCornerTL} />
                      <View style={styles.camCornerTR} />
                      <View style={styles.camCornerBL} />
                      <View style={styles.camCornerBR} />
                      <View style={styles.laserLine} />
                    </View>

                    {/* Instruction */}
                    <View style={styles.camFooter}>
                      <Text style={styles.camInstruction}>Point camera at the barcode</Text>
                    </View>
                  </View>
                </CameraView>
              </View>
            </Modal>

            {/* ── Product Barcode Camera Scanner Modal ── */}
            <Modal
              visible={productScanActive}
              animationType="fade"
              presentationStyle="fullScreen"
              statusBarTranslucent
              onRequestClose={() => setProductScanActive(false)}
            >
              <View style={styles.cameraContainer}>
                <CameraView
                  key={productScanActive ? 'product-scan-active' : 'product-scan-inactive'}
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  onBarcodeScanned={productScanned ? undefined : handleProductBarcodeScanned}
                  barcodeScannerSettings={{
                    barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'],
                  }}
                  onMountError={(err) => {
                    console.error('[ProductDrawer] Camera mount error:', err);
                    setProductScanActive(false);
                  }}
                >
                  <View style={styles.cameraUi}>
                    <View style={styles.camHeader}>
                      <TouchableOpacity onPress={() => setProductScanActive(false)} style={styles.camCloseBtn}>
                        <X size={24} color="#fff" />
                      </TouchableOpacity>
                      <Text style={styles.camTitle}>Scan Product Barcode</Text>
                      <View style={{ width: 44 }} />
                    </View>
                    <View style={styles.camFocusArea}>
                      <View style={styles.camCornerTL} />
                      <View style={styles.camCornerTR} />
                      <View style={styles.camCornerBL} />
                      <View style={styles.camCornerBR} />
                      <View style={styles.laserLine} />
                    </View>
                    <View style={styles.camFooter}>
                      <Text style={styles.camInstruction}>Point camera at the product barcode</Text>
                    </View>
                  </View>
                </CameraView>
              </View>
            </Modal>

          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' },
  kavWrapper: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 36, borderTopRightRadius: 36, width: '100%', height: SCREEN_HEIGHT * 0.92 },
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

  // Variant form
  variantForm: { backgroundColor: '#f8fafc', padding: 20, borderRadius: 24, borderWidth: 1.5, borderColor: '#f1f5f9', marginBottom: 16 },
  variantLabelRow: { flexDirection: 'row', gap: 10, marginBottom: 6, paddingHorizontal: 4 },
  microLabel: { fontSize: 9, fontWeight: '900', color: '#94a3b8', letterSpacing: 0.5 },
  variantRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  variantInput: { height: 50, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, fontSize: 14, fontWeight: '700', color: '#000', borderWidth: 1.5, borderColor: '#e2e8f0' },
  addIconBtn: { width: 50, height: 50, borderRadius: 14, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },

  // Variant cards
  variantsContainer: { gap: 12 },
  variantCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff', padding: 16, borderRadius: 18, borderWidth: 1.5, borderColor: '#e5e5e5' },
  variantHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  variantName: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 0.5 },
  variantFieldsRow: { flexDirection: 'row', gap: 10 },
  variantFieldLabel: { fontSize: 9, fontWeight: '800', color: '#94a3b8', marginBottom: 6, letterSpacing: 0.5 },
  variantFieldInput: { height: 44, backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 12, fontSize: 13, fontWeight: '700', color: '#000', borderWidth: 1.5, borderColor: '#000' },
  variantBarcodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  variantBarcodeBtn: { width: 36, height: 44, borderRadius: 10, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  variantMarginBadge: { backgroundColor: '#000', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  variantMarginBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  noBarcodeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  noBarcodeTagText: { fontSize: 9, fontWeight: '800', color: '#f59e0b' },
  deleteVarBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginLeft: 10 },

  // Footer
  footer: { flexDirection: 'row', paddingHorizontal: 24, paddingTop: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24, borderTopWidth: 1.5, borderColor: '#eee', gap: 12, backgroundColor: '#fff' },
  ghostBtn: { flex: 1, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 2, borderColor: '#ddd', backgroundColor: '#fff' },
  ghostBtnText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  primaryBtn: { flex: 2, height: 56, backgroundColor: '#000', borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },

  // Tax picker
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  pickerContent: { backgroundColor: '#fff', borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, paddingBottom: 60 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  pickerTitle: { fontSize: 20, fontWeight: '900', color: '#000', letterSpacing: -0.5 },
  pickerIndicator: { width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2 },
  pickerItem: { paddingVertical: 18, borderBottomWidth: 1.5, borderColor: '#f8fafc', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10 },
  pickerItemActive: { backgroundColor: '#f8fafc', borderRadius: 16, borderColor: 'transparent' },
  pickerItemText: { fontSize: 16, color: '#64748b', fontWeight: '700' },
  pickerItemTextActive: { color: '#000', fontWeight: '900' },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#000' },

  // Camera scanner
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraUi: { flex: 1, justifyContent: 'space-between' },
  camHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 20 },
  camCloseBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  camTitle: { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: 0.3, flex: 1, textAlign: 'center' },
  camFocusArea: { alignSelf: 'center', width: 260, height: 160, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  laserLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: 'rgba(59, 130, 246, 0.8)', borderRadius: 2 },
  camCornerTL: { position: 'absolute', top: 0, left: 0, width: 30, height: 30, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#fff', borderTopLeftRadius: 8 },
  camCornerTR: { position: 'absolute', top: 0, right: 0, width: 30, height: 30, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#fff', borderTopRightRadius: 8 },
  camCornerBL: { position: 'absolute', bottom: 0, left: 0, width: 30, height: 30, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: '#fff', borderBottomLeftRadius: 8 },
  camCornerBR: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#fff', borderBottomRightRadius: 8 },
  camFooter: { paddingBottom: Platform.OS === 'ios' ? 60 : 40, alignItems: 'center' },
  camInstruction: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600', letterSpacing: 0.3 },
});

export default memo(ProductDrawer);