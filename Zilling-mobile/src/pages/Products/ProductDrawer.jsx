import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Plus, ChevronDown, Trash2, Package, Tag, Layers, Barcode, TrendingUp, AlertCircle, Printer, Scan } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSettings } from '../../context/SettingsContext';
import { printBarcode } from '../../utils/printUtils';
import { validateBarcodeFormat, detectDuplicateBarcodes, sanitizeBarcode } from '../../utils/barcodeUtils';
import { useNavBarColor } from '../../hooks/useNavBarColor';

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
  const insets = useSafeAreaInsets();
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

  // ── Laser Animation ──────────────────────────────────────────
  const scanAnim = useRef(new Animated.Value(0)).current;

  // Unified Scanner State
  // scannerConfig: { active: boolean, type: 'product' | 'variant', target: any }
  const [scannerConfig, setScannerConfig] = useState({ active: false, type: null, target: null });
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (scannerConfig.active) {
      setScanned(false);
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scanAnim.stopAnimation();
      scanAnim.setValue(0);
    }
  }, [scannerConfig.active]);

  useNavBarColor(
    scannerConfig.active ? '#000000' : '#ffffff', 
    scannerConfig.active ? 'light' : 'dark', 
    visible
  );

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
              barcode: String(v.barcode || v.sku || '').trim(),
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
        tax_rate: product.tax_rate !== undefined ? parseFloat(product.tax_rate) : (parseFloat(product.taxRate) || 0),
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
    setScanned(false);
    setScannerConfig({ active: true, type: 'variant', target: target });
    
    // Request permission in background if not already granted
    if (!permission?.granted) {
      requestPermission();
    }
  };

  const openProductScanner = async () => {
    setScanned(false);
    setScannerConfig({ active: true, type: 'product', target: null });

    // Request permission in background if not already granted
    if (!permission?.granted) {
      requestPermission();
    }
  };


  const handleScannerResult = useCallback(({ data }) => {
    if (scanned) return;
    setScanned(true);
    Vibration.vibrate();

    const safeData = sanitizeBarcode(data);
    if (!safeData) {
      Alert.alert('Invalid Barcode', 'The scanned barcode value is not valid.');
      setScanned(false);
      return;
    }

    if (scannerConfig.type === 'variant') {
      if (scannerConfig.target === 'new') {
        setNewVariantBarcode(safeData);
      } else if (typeof scannerConfig.target === 'number') {
        handleVariantChange(scannerConfig.target, 'barcode', safeData);
      }
    } else {
      handleChange('barcode', safeData);
    }

    setScannerConfig({ active: false, type: null, target: null });
  }, [scanned, scannerConfig, handleVariantChange, handleChange]);


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
              <Text style={styles.variantFieldLabel}>SELL PRICE</Text>
              <View style={styles.amountInputRowSmall}>
                <Text style={styles.currencyLabelSmall}>₹</Text>
                <TextInput
                  style={styles.variantFieldInputNoBorder}
                  value={v.price !== undefined && v.price !== null ? String(v.price) : ''}
                  onChangeText={(val) => handleVariantChange(index, 'price', val)}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#cbd5e1"
                />
              </View>
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

          {/* Barcode row */}
          <View style={{ marginTop: 12 }}>
            <Text style={styles.variantFieldLabel}>VARIANT BARCODE / SKU</Text>
            <View style={styles.variantBarcodeRow}>
              <View style={styles.variantBarcodeField}>
                <TextInput
                  style={styles.variantFieldInputNoBorder}
                  value={v.barcode || v.sku || ''}
                  onChangeText={(val) => handleVariantChange(index, 'barcode', val)}
                  placeholder="Enter or scan barcode"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="characters"
                  maxLength={128}
                />
              </View>
              {hasBarcode && (
                <TouchableOpacity
                  style={styles.variantActionBtn}
                  onPress={() => printBarcode(`${form.name} - ${displayName}`, v.barcode || v.sku, settings)}
                  accessibilityLabel={`Print barcode for variant ${displayName}`}
                >
                  <Printer size={16} color="#000" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.variantActionBtn, { backgroundColor: '#000' }]}
                onPress={() => openVariantScanner(index)}
                accessibilityLabel={`Scan barcode for variant ${displayName}`}
              >
                <Scan size={16} color="#fff" />
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
          <Trash2 size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >

      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kavWrapper}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={[styles.sheet, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{product ? 'Edit Product' : 'Add New Product'}</Text>
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
              {/* Section: General Information */}
              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIcon}>
                    <Package size={14} color="#000" />
                  </View>
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

                <View style={[styles.row, { marginBottom: 0 }]}>
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
              </View>

              {/* Section: Pricing & Tax */}
              <View style={[styles.card, { marginTop: 16 }]}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIcon}>
                    <TrendingUp size={14} color="#000" />
                  </View>
                  <Text style={styles.sectionLabel}>Pricing & Tax</Text>
                </View>

                <View style={styles.row}>
                  <View style={styles.col}>
                    <Text style={styles.label}>COST PRICE</Text>
                    <View style={styles.amountInputRow}>
                      <Text style={styles.currencyLabel}>₹</Text>
                      <TextInput
                        style={styles.amountInputNoBorder}
                        keyboardType="numeric"
                        value={form.costPrice.toString()}
                        onChangeText={(v) => handleChange('costPrice', v)}
                        placeholder="0.00"
                        placeholderTextColor="#cbd5e1"
                      />
                    </View>
                  </View>
                  <View style={styles.col}>
                    <Text style={styles.label}>SELLING PRICE</Text>
                    <View style={styles.amountInputRow}>
                      <Text style={styles.currencyLabel}>₹</Text>
                      <TextInput
                        style={styles.amountInputNoBorder}
                        keyboardType="numeric"
                        value={form.price.toString()}
                        onChangeText={(v) => handleChange('price', v)}
                        placeholder="0.00"
                        placeholderTextColor="#cbd5e1"
                      />
                    </View>
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

                <View style={[styles.inputGroup, { marginBottom: 0 }]}>
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
              </View>

              {/* Section: Stock Management */}
              <View style={[styles.card, { marginTop: 16 }]}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIcon}>
                    <Layers size={14} color="#000" />
                  </View>
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

                {/* SKU / Product Barcode */}
                <View style={[styles.inputGroup, { marginBottom: 0 }]}>
                  <Text style={styles.label}>PRODUCT SKU / BARCODE</Text>
                  <View style={styles.barcodeWrapper}>
                    <TextInput
                      style={[styles.premiumInput, { flex: 1, marginBottom: 0 }]}
                      value={form.barcode}
                      onChangeText={(v) => handleChange('barcode', v)}
                      autoCapitalize="characters"
                      maxLength={128}
                    />
                    {form.barcode?.length > 4 && (
                      <TouchableOpacity
                        style={styles.scanAction}
                        onPress={() => printBarcode(form.name || 'Product', form.barcode, settings)}
                      >
                        <Printer size={20} color="#fff" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.scanAction, { backgroundColor: '#000' }]}
                      onPress={openProductScanner}
                    >
                      <Scan size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Section: Product Variants */}
              <View style={[styles.card, { marginTop: 16 }]}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIcon}>
                    <Tag size={14} color="#000" />
                  </View>
                  <Text style={styles.sectionLabel}>Product Variants</Text>
                </View>
                <Text style={styles.sectionHint}>
                  Create multiple options like Sizes (L, XL) or Colors (Red, Blue). Each variant can have a unique barcode.
                </Text>

                {/* New Variant Form */}
                <View style={styles.variantForm}>
                  <View style={styles.variantLabelRow}>
                    <Text style={[styles.microLabel, { flex: 2 }]}>VARIANT DETAIL</Text>
                    <Text style={[styles.microLabel, { flex: 1.2 }]}>SELL PRICE</Text>
                    <View style={{ width: 44 }} />
                  </View>
                  <View style={styles.variantRow}>
                    <TextInput
                      style={[styles.variantInput, { flex: 2 }]}
                      placeholder="Red, XL, 1kg"
                      value={newVariant}
                      onChangeText={setNewVariant}
                      placeholderTextColor="#94a3b8"
                    />
                    <View style={[styles.amountInputRowSmall, { flex: 1.2 }]}>
                      <Text style={styles.currencyLabelSmall}>₹</Text>
                      <TextInput
                        style={styles.variantFieldInputNoBorder}
                        placeholder="0.00"
                        keyboardType="numeric"
                        value={newVariantPrice}
                        onChangeText={setNewVariantPrice}
                        placeholderTextColor="#94a3b8"
                      />
                    </View>
                    <View style={{ width: 44 }} />
                  </View>

                  <View style={[styles.variantLabelRow, { marginTop: 14 }]}>
                    <Text style={[styles.microLabel, { flex: 1 }]}>COST PRICE</Text>
                    <Text style={[styles.microLabel, { flex: 1 }]}>STOCK QTY</Text>
                    <View style={{ width: 44 }} />
                  </View>
                  <View style={styles.variantRow}>
                    <View style={[styles.amountInputRowSmall, { flex: 1 }]}>
                      <Text style={styles.currencyLabelSmall}>₹</Text>
                      <TextInput
                        style={styles.variantFieldInputNoBorder}
                        placeholder="0.00"
                        keyboardType="numeric"
                        value={newVariantCostPrice}
                        onChangeText={setNewVariantCostPrice}
                        placeholderTextColor="#94a3b8"
                      />
                    </View>
                    <TextInput
                      style={[styles.variantInput, { flex: 1 }]}
                      placeholder="0"
                      keyboardType="numeric"
                      value={newVariantStock}
                      onChangeText={setNewVariantStock}
                      placeholderTextColor="#94a3b8"
                    />
                    <View style={{ width: 44 }} />
                  </View>

                  <View style={[styles.variantLabelRow, { marginTop: 14 }]}>
                    <Text style={styles.microLabel}>VARIANT BARCODE / SKU</Text>
                  </View>
                  <View style={styles.variantRow}>
                    <TextInput
                      style={[styles.variantInput, { flex: 1 }]}
                      placeholder="Enter or scan barcode"
                      value={newVariantBarcode}
                      onChangeText={setNewVariantBarcode}
                      placeholderTextColor="#94a3b8"
                      autoCapitalize="characters"
                      maxLength={128}
                    />
                    <TouchableOpacity
                      style={[styles.variantActionBtn, { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' }]}
                      onPress={() => openVariantScanner('new')}
                    >
                      <Scan size={18} color="#000" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleAddVariant}
                      style={[styles.variantActionBtn, { backgroundColor: '#000' }]}
                    >
                      <Plus size={20} color="#fff" strokeWidth={3} />
                    </TouchableOpacity>
                  </View>
                </View>

              {/* Existing Variant Cards */}
              <View style={styles.variantsContainer}>
                {form.variants.map((v, index) => renderVariantCard(v, index))}
              </View>
              </View>

              <View style={{ height: 120 }} />
            </ScrollView>

            {/* Footer */}
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
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

            {/* Tax Picker Modal */}
            <Modal visible={showTaxPicker} transparent animationType="slide" onRequestClose={() => setShowTaxPicker(false)}>
              <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowTaxPicker(false)}>
                <View style={styles.pickerContent}>
                  <View style={styles.pickerHeader}>
                    <View>
                      <Text style={styles.pickerTitle}>Select Tax Rate</Text>
                      <Text style={styles.pickerSub}>Select applicable GST/IGST percentage</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowTaxPicker(false)} style={styles.pickerClose}>
                      <X size={20} color="#000" />
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.taxSummary}>
                    <Text style={styles.taxSummaryLabel}>CURRENTLY SELECTED</Text>
                    <Text style={styles.taxSummaryValue}>
                      {TAX_OPTIONS.find(o => o.value === form.tax_rate)?.label || `${form.tax_rate}%`}
                    </Text>
                  </View>

                  <FlatList
                    data={TAX_OPTIONS}
                    keyExtractor={(item, index) => index.toString()}
                    numColumns={2}
                    columnWrapperStyle={{ gap: 10 }}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[styles.taxOption, form.tax_rate === item.value && styles.taxOptionActive]}
                        onPress={() => { handleChange('tax_rate', item.value); setShowTaxPicker(false); }}
                      >
                        <Text style={[styles.taxOptionText, form.tax_rate === item.value && styles.taxOptionTextActive]}>
                          {item.label}
                        </Text>
                        {form.tax_rate === item.value && <View style={styles.taxActiveDot} />}
                      </TouchableOpacity>
                    )}
                    style={{ maxHeight: 400 }}
                    contentContainerStyle={{ paddingBottom: 20 }}
                  />
                </View>
              </TouchableOpacity>
            </Modal>

          </View>
        </KeyboardAvoidingView>

        {/* Unified Camera Scanner Overlay (Minimalist Float Design) */}
        {scannerConfig.active && (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, justifyContent: 'center', alignItems: 'center' }]}>
            <View style={styles.minimalScannerScale}>
              <View style={styles.minimalScannerBox}>
                <View style={styles.popupScannerContainer}>
                  <View style={styles.cameraClipWrapper}>
                    <CameraView
                      style={styles.popupCamera}
                      facing="back"
                      onBarcodeScanned={scanned ? undefined : handleScannerResult}
                      barcodeScannerSettings={{
                        barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'],
                      }}
                    />
                    
                    {/* Viewfinder Frame */}
                    <View style={styles.scannerOverlayMask} pointerEvents="none">
                       <View style={styles.maskDimmed} />
                       <View style={styles.maskRow}>
                          <View style={styles.maskDimmed} />
                          <View style={styles.viewfinderCenter}>
                             <View style={[styles.scanCorner, styles.tl]} />
                             <View style={[styles.scanCorner, styles.tr]} />
                             <View style={[styles.scanCorner, styles.bl]} />
                             <View style={[styles.scanCorner, styles.br]} />
                             
                             <Animated.View 
                               style={[
                                 styles.popupLaserLine,
                                 {
                                   transform: [{
                                     translateY: scanAnim.interpolate({
                                       inputRange: [0, 1],
                                       outputRange: [-60, 60],
                                     })
                                   }]
                                 }
                               ]} 
                             />
                          </View>
                          <View style={styles.maskDimmed} />
                       </View>
                       <View style={styles.maskDimmed} />
                    </View>
                  </View>
                </View>

                {/* Float Close Button */}
                <TouchableOpacity 
                  onPress={() => setScannerConfig({ active: false, type: null, target: null })} 
                  style={styles.minimalCloseBtn}
                >
                  <X size={20} color="#fff" strokeWidth={3} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};



// ─────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────

const { height: SCREEN_HEIGHT } = Dimensions.get('screen');

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'transparent' },
  kavWrapper: { flex: 1 },
  sheet: { backgroundColor: '#fff', width: '100%', height: SCREEN_HEIGHT, overflow: 'hidden', position: 'absolute', bottom: 0 },

  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16, alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#f1f5f9' },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#000', letterSpacing: -0.5 },
  modalSub: { fontSize: 13, color: '#000', fontWeight: '800', marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100, backgroundColor: '#f8fafc' },
  
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  sectionIcon: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: 12, fontWeight: '900', color: '#000', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionHint: { fontSize: 12, color: '#1e293b', fontWeight: '700', marginBottom: 16, lineHeight: 18 },
  label: { fontSize: 10, fontWeight: '900', color: '#0f172a', marginBottom: 6, letterSpacing: 0.5 },
  inputGroup: { marginBottom: 16 },
  
  premiumInput: { height: 48, backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 14, fontSize: 14, fontWeight: '700', color: '#000', borderWidth: 1, borderColor: '#f1f5f9' },
  
  amountInputRow: { height: 50, backgroundColor: '#fff', borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderWidth: 1.5, borderColor: '#f1f5f9' },
  amountInputRowSmall: { height: 40, backgroundColor: '#f8fafc', borderRadius: 6, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  currencyLabel: { fontSize: 18, fontWeight: '900', color: '#0f172a', marginRight: 6 },
  currencyLabelSmall: { fontSize: 14, fontWeight: '900', color: '#0f172a', marginRight: 4 },
  amountInputNoBorder: { flex: 1, height: 50, fontSize: 18, fontWeight: '900', color: '#000' },
  
  row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  col: { flex: 1 },
  
  marginBanner: { backgroundColor: '#000', padding: 14, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  marginLabel: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  marginDesc: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', marginTop: 2 },
  marginValue: { color: '#fff', fontSize: 18, fontWeight: '900' },
  
  selectTrigger: { height: 48, backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  selectText: { fontSize: 14, fontWeight: '700', color: '#000' },
  barcodeWrapper: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  scanAction: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },

  // Variant section
  variantForm: { backgroundColor: '#f8fafc', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#f1f5f9', marginBottom: 12 },
  variantLabelRow: { flexDirection: 'row', gap: 10, marginBottom: 4, paddingHorizontal: 4 },
  microLabel: { fontSize: 9, fontWeight: '900', color: '#0f172a', letterSpacing: 0.5 },
  variantRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  variantInput: { height: 40, backgroundColor: '#fff', borderRadius: 6, paddingHorizontal: 10, fontSize: 13, fontWeight: '700', color: '#000', borderWidth: 1, borderColor: '#e2e8f0' },
  variantActionBtn: { width: 40, height: 40, borderRadius: 6, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },

  variantsContainer: { gap: 10, marginTop: 12 },
  variantCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#f1f5f9', marginBottom: 8 },
  variantHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  variantName: { fontSize: 11, fontWeight: '900', color: '#0f172a', letterSpacing: 0.5 },
  variantFieldsRow: { flexDirection: 'row', gap: 10 },
  variantFieldLabel: { fontSize: 8, fontWeight: '900', color: '#1e293b', marginBottom: 4, letterSpacing: 0.5 },
  variantBarcodeField: { flex: 1, height: 36, backgroundColor: '#f8fafc', borderRadius: 6, paddingHorizontal: 10, justifyContent: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  variantFieldInputNoBorder: { height: 40, fontSize: 13, fontWeight: '700', color: '#000', flex: 1 },
  variantFieldInput: { height: 40, backgroundColor: '#f8fafc', borderRadius: 6, paddingHorizontal: 10, fontSize: 13, fontWeight: '700', color: '#000', borderWidth: 1, borderColor: '#f1f5f9' },
  variantBarcodeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  variantMarginBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  variantMarginBadgeText: { fontSize: 9, fontWeight: '800', color: '#0f172a' },
  noBarcodeTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fffbeb', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  noBarcodeTagText: { fontSize: 8, fontWeight: '800', color: '#92400e' },
  deleteVarBtn: { width: 30, height: 30, borderRadius: 6, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginLeft: 8 },

  // Footer
  footer: { flexDirection: 'row', paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1, borderColor: '#f1f5f9', gap: 10, backgroundColor: '#fff' },
  ghostBtn: { flex: 1, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#f1f5f9', backgroundColor: '#fff' },
  ghostBtnText: { color: '#334155', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  primaryBtn: { flex: 2, height: 50, backgroundColor: '#000', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },

  // Tax picker
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  pickerTitle: { fontSize: 18, fontWeight: '900', color: '#000' },
  pickerSub: { fontSize: 13, color: '#334155', fontWeight: '700' },
  pickerClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  taxSummary: { backgroundColor: '#f8fafc', padding: 14, borderRadius: 10, marginBottom: 16, borderWidth: 1, borderColor: '#f1f5f9' },
  taxSummaryLabel: { fontSize: 9, fontWeight: '900', color: '#334155', marginBottom: 4 },
  taxSummaryValue: { fontSize: 16, fontWeight: '900', color: '#000' },
  taxOption: { flex: 1, height: 54, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  taxOptionActive: { backgroundColor: '#000', borderColor: '#000' },
  taxOptionText: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  taxOptionTextActive: { color: '#fff', fontWeight: '900' },
  taxActiveDot: { position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },

  // Minimal Floating Scanner
  minimalScannerScale: { width: '85%', maxWidth: 320 },
  minimalScannerBox: { position: 'relative', borderRadius: 16, overflow: 'hidden', backgroundColor: '#000', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', elevation: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 16 },
  minimalCloseBtn: { position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', zIndex: 10 },
  
  popupScannerContainer: { width: '100%', height: 260, backgroundColor: '#000' },
  cameraClipWrapper: { flex: 1, overflow: 'hidden', position: 'relative' },
  popupCamera: { ...StyleSheet.absoluteFillObject },
  
  scannerOverlayMask: { ...StyleSheet.absoluteFillObject },
  maskDimmed: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  maskRow: { flexDirection: 'row', height: 160 },
  viewfinderCenter: { width: 220, height: 160, position: 'relative', overflow: 'hidden' },
  
  scanCorner: { position: 'absolute', width: 20, height: 20, borderColor: '#22c55e', borderStyle: 'solid' },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 8 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 8 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 8 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 8 },
  
  popupLaserLine: { width: '100%', height: 2, backgroundColor: '#22c55e', shadowColor: '#22c55e', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8, elevation: 10, position: 'absolute', top: '50%' },
});

export default memo(ProductDrawer);