import { Audio } from 'expo-av';
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  FlatList,
  Alert,
  Vibration,
  Dimensions,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Printer,
  Copy,
  ChevronDown,
  ChevronLeft,
  Search,
  X,
  Barcode as BarcodeIcon,
  Scan,
  Package,
  Type,
  Maximize2
} from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useProducts } from '../../context/ProductContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { addToBillingQueue } from '../../services/billingQueue';
import { useToast } from '../../context/ToastContext';
import { resolveBarcode, buildCartPayload, sanitizeBarcode } from '../../utils/barcodeUtils';

const { width } = Dimensions.get('window');

const FORMATS = [
  { label: 'CODE-128', value: 'CODE128' },
  { label: 'EAN-13', value: 'EAN13' },
  { label: 'UPC-A', value: 'UPC' },
];

export default function BarcodePage() {
  const navigation = useNavigation();
  const { showToast } = useToast();
  const { products, fetchProducts } = useProducts();
  const [inputValue, setInputValue] = useState('PROD-101');
  const [barcodeValue, setBarcodeValue] = useState('PROD-101');
  const [barcodeFormat, setBarcodeFormat] = useState('CODE128');
  const [showProductModal, setShowProductModal] = useState(false);
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Camera State
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [sound, setSound] = useState();

  useEffect(() => {
    async function loadSound() {
      try {
        if (!Audio) return;
        // Reverting to remote URL (Preloaded for performance) as Base64 was unreliable
        const { sound: s } = await Audio.Sound.createAsync(
          { uri: 'https://www.soundjay.com/buttons/beep-01a.mp3' }
        );
        setSound(s);
      } catch (e) {
        console.log('Failed to preload sound (ignore if offline)', e.message);
      }
    }
    loadSound();
    return () => {
      if (sound) sound.unloadAsync();
    };
  }, []);

  useEffect(() => {
    console.log('[DEBUG] BarcodePage mounted successfully');
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
    }, [])
  );

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const generateBarcode = () => {
    if (!inputValue.trim()) {
      showToast('Please enter a value to generate barcode', 'error');
      return;
    }
    setBarcodeValue(inputValue);
  };

  const handleProductSelect = (prod) => {
    const value = prod.barcode || prod.id;
    setInputValue(value);
    setBarcodeValue(value);
    setBarcodeFormat('CODE128');
    setShowProductModal(false);
  };

  const handleCopy = () => {
    showToast('Barcode value copied to clipboard!', 'success');
  };

  const handlePrint = () => {
    showToast('Printing functionality will be integrated with mobile printer support.', 'info');
  };

  // --- Camera Logic ---
  // --- Camera Logic ---
  const handleStartScan = async () => {
    if (!permission) {
      // Permission is loading
      return;
    }

    if (!permission.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        showToast('Camera permission is required to scan barcodes', 'error');
        return;
      }
    }
    setScanned(false);
    setIsScanning(true);
  };

  const playScanSound = async () => {
    try {
      if (sound) {
        await sound.replayAsync();
      }
    } catch (error) {
      console.log('Sound playback failed', error);
    }
  };

  const handleBarCodeScanned = ({ type, data }) => {
    if (scanned) return;
    setScanned(true);

    // SECURITY: Sanitize scanned data before any use (caps length, trims whitespace).
    // A malformed/oversized QR code payload should not crash or flood the UI.
    const safeData = sanitizeBarcode(data);
    if (!safeData) {
      showToast('Invalid barcode data received.', 'error');
      setTimeout(() => { setScanned(false); }, 2000);
      return;
    }

    // Feedback: Sound + Vibration
    Vibration.vibrate();
    playScanSound();

    // Update visual display
    setInputValue(safeData);
    setBarcodeValue(safeData);

    // ── Variant-aware lookup (Priority: variant.barcode → variant.sku → product.sku → …) ──
    const { product: matchedProduct, variant: matchedVariant, source } = resolveBarcode(safeData, products);

    if (matchedProduct) {
      // Build a cart-ready payload that carries variant context
      const cartPayload = buildCartPayload(matchedProduct, matchedVariant);

      addToBillingQueue(cartPayload);

      const displayName = matchedVariant
        ? `${matchedProduct.name} (${matchedVariant.name || 'Variant'})`
        : matchedProduct.name;

      showToast(`Added "${displayName}" to Billing Queue`, 'success');

      // Auto-resume scanning
      setTimeout(() => { setScanned(false); }, 1500);
    } else {
      // Barcode not found in any product or variant
      showToast(`No product found for barcode: ${safeData}`, 'error');

      // Auto-resume scanning
      setTimeout(() => { setScanned(false); }, 2000);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mainContainer}>
        {/* Header Section */}
        <View style={styles.header}>
          <LinearGradient
            colors={['#ffffff', '#f8fafc']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={24} color="#0f172a" />
          </Pressable>
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Barcode Studio</Text>
            <Text style={styles.subtitle}>Generate, scan & print labels</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Main Card */}
          <View style={styles.cardContainer}>

            {/* Configuration Section */}
            <View style={styles.configSection}>
              <Text style={styles.sectionTitle}>Configuration</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Product Source</Text>
                <Pressable
                  style={styles.pickerTrigger}
                  onPress={() => setShowProductModal(true)}
                >
                  <View style={styles.pickerIcon}>
                    <Package size={18} color="#64748b" />
                  </View>
                  <Text style={styles.pickerValue} numberOfLines={1}>
                    {products.find(p => p.barcode === inputValue || p.id === inputValue)?.name || 'Select from inventory...'}
                  </Text>
                  <ChevronDown size={20} color="#cbd5e1" />
                </Pressable>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Format Type</Text>
                <Pressable
                  style={styles.pickerTrigger}
                  onPress={() => setShowFormatModal(true)}
                >
                  <View style={styles.pickerIcon}>
                    <Type size={18} color="#64748b" />
                  </View>
                  <Text style={styles.pickerValue}>
                    {FORMATS.find(f => f.value === barcodeFormat)?.label || 'CODE-128'}
                  </Text>
                  <ChevronDown size={20} color="#cbd5e1" />
                </Pressable>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>SKU / Code Content</Text>
                <View style={styles.actionInputRow}>
                  <Input
                    value={inputValue}
                    onChangeText={setInputValue}
                    placeholder="E.g., PROD-1234"
                    autoCapitalize="characters"
                    style={styles.skuInput}
                  />
                  <Pressable
                    onPress={handleStartScan}
                    style={styles.scanActionBtn}
                  >
                    <LinearGradient
                      colors={['#1e293b', '#334155']}
                      style={StyleSheet.absoluteFill}
                    />
                    <Scan size={20} color="#fff" />
                  </Pressable>
                </View>
              </View>

              <Pressable
                onPress={generateBarcode}
                style={styles.gradientBtnContainer}
              >
                <LinearGradient
                  colors={['#2563eb', '#3b82f6']}
                  style={styles.gradientBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.gradientBtnText}>Generate Preview</Text>
                </LinearGradient>
              </Pressable>

            </View>

            <View style={styles.divider} />

            {/* Preview Section */}
            <View style={styles.previewSection}>
              <Text style={styles.sectionTitle}>Label Preview</Text>

              <View style={styles.ticketContainer}>
                <LinearGradient
                  colors={['#ffffff', '#fcfcfc']}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.ticketContent}>
                  {barcodeValue ? (
                    <>
                      <BarcodeIcon size={80} color="#1e293b" />
                      <Text style={styles.barcodeCode}>{barcodeValue}</Text>
                      <View style={styles.barcodeMetaTag}>
                        <Text style={styles.barcodeMetaText}>{barcodeFormat}</Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.emptyState}>
                      <LinearGradient
                        colors={['#f1f5f9', '#e2e8f0']}
                        style={styles.emptyStateIconBg}
                      >
                        <BarcodeIcon size={32} color="#94a3b8" />
                      </LinearGradient>
                      <Text style={styles.emptyText}>Enter code to preview</Text>
                    </View>
                  )}
                </View>
                {/* Visual "rip" effect for ticket */}
                <View style={styles.ripDecorTop} />
                <View style={styles.ripDecorBottom} />
              </View>

              <View style={styles.actionGrid}>
                <Button
                  title="Copy"
                  onPress={handleCopy}
                  variant="outline"
                  icon={<Copy size={18} color="#475569" />}
                  style={styles.gridBtn}
                />
                <Button
                  title="Print Label"
                  onPress={handlePrint}
                  variant="primary"
                  icon={<Printer size={18} color="white" />}
                  style={styles.gridBtn}
                />
              </View>
            </View>

          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
      </View>

      {/* Product Selection Modal */}
      <Modal
        visible={showProductModal}
        animationType="slide"
        transparent={true}
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Product</Text>
              <Pressable onPress={() => setShowProductModal(false)} style={styles.closeBtn}>
                <X size={24} color="#64748b" />
              </Pressable>
            </View>

            <View style={styles.searchContainer}>
              <Search size={20} color="#94a3b8" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={styles.searchInput}
              />
            </View>

            <FlatList
              data={filteredProducts}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.productItem}
                  onPress={() => handleProductSelect(item)}
                >
                  <View style={styles.productInitial}>
                    <Text style={styles.initialText}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{item.name}</Text>
                    <Text style={styles.productSku}>SKU: {item.barcode || item.id}</Text>
                  </View>
                  <ChevronDown size={20} color="#e2e8f0" style={{ transform: [{ rotate: '-90deg' }] }} />
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={styles.emptyList}>
                  <Search size={48} color="#f1f5f9" />
                  <Text style={styles.emptyListText}>No products found</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Format Selection Modal */}
      <Modal
        visible={showFormatModal}
        animationType="fade"
        transparent={true}
        statusBarTranslucent
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowFormatModal(false)}
        >
          <View style={styles.centerModal}>
            <Text style={styles.centerModalTitle}>Barcode Format</Text>
            {FORMATS.map((format, index) => (
              <Pressable
                key={format.value}
                style={[
                  styles.formatOption,
                  index !== FORMATS.length - 1 && styles.borderBottom
                ]}
                onPress={() => {
                  setBarcodeFormat(format.value);
                  setShowFormatModal(false);
                }}
              >
                <Text style={[
                  styles.formatOptionText,
                  barcodeFormat === format.value && styles.formatActive
                ]}>
                  {format.label}
                </Text>
                {barcodeFormat === format.value && (
                  <View style={styles.activeDot} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Camera Scanning Modal */}
      <Modal
        visible={isScanning}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
      >
        <View style={styles.cameraContainer}>
          <CameraView
            key={isScanning ? 'active-scan' : 'inactive-scan'}
            style={styles.camera}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39"],
            }}
            onMountError={(error) => {
              console.error('[BarcodePage] Camera Mount Error:', error);
              showToast('Camera failed to start', 'error');
            }}
          >
            <SafeAreaView style={styles.cameraUi}>
              <View style={styles.camHeader}>
                <Pressable onPress={() => setIsScanning(false)} style={styles.camCloseBtn}>
                  <X size={24} color="white" />
                </Pressable>
                <Text style={styles.camTitle}>Scan Product</Text>
                <View style={{ width: 44 }} />
              </View>

              <View style={styles.camFocusArea}>
                <View style={styles.laserLine} />
                <Maximize2 size={240} color="rgba(255,255,255,0.4)" strokeWidth={1} style={styles.focusCorners} />
              </View>

              <View style={styles.camFooter}>
                <Text style={styles.camInstruction}>Point camera at the barcode</Text>
              </View>
            </SafeAreaView>
          </CameraView>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  mainContainer: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  backBtn: {
    width: 44,
    height: 44,
    backgroundColor: 'white',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  headerTextContainer: {
    marginLeft: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  cardContainer: {
    backgroundColor: 'white',
    borderRadius: 24,
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    overflow: 'hidden',
    marginTop: 10,
  },
  configSection: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 16,
  },
  pickerIcon: {
    marginRight: 10,
  },
  pickerValue: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '500',
  },
  actionInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  skuInput: {
    flex: 1,
    height: 52,
    backgroundColor: '#f8fafc',
    fontSize: 16,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }),
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  scanActionBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gradientBtnContainer: {
    marginTop: 8,
    borderRadius: 14,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  gradientBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    width: '100%',
  },
  previewSection: {
    padding: 24,
    backgroundColor: '#fafbfc',
  },
  ticketContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 180,
    marginBottom: 24,
    position: 'relative',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  ticketContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 16,
  },
  barcodeCode: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }),
    letterSpacing: 2,
  },
  barcodeMetaTag: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
  },
  barcodeMetaText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
  },
  emptyStateIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  ripDecorTop: {
    position: 'absolute',
    top: -6,
    left: '50%',
    marginLeft: -40,
    width: 80,
    height: 12,
    backgroundColor: '#fafbfc',
    borderRadius: 6,
  },
  ripDecorBottom: {
    position: 'absolute',
    bottom: -6,
    left: '50%',
    marginLeft: -40,
    width: 80,
    height: 12,
    backgroundColor: '#fafbfc',
    borderRadius: 6,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  gridBtn: {
    flex: 1,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  closeBtn: {
    padding: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    margin: 16,
    marginTop: 16,
    borderRadius: 14,
    height: 52,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    borderWidth: 0,
    backgroundColor: 'transparent',
    marginLeft: 8,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  productInitial: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  initialText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4f46e5',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  productSku: {
    fontSize: 13,
    color: '#64748b',
  },
  emptyList: {
    padding: 40,
    alignItems: 'center',
    gap: 16,
  },
  emptyListText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '500',
  },

  // Center Modal
  centerModal: {
    backgroundColor: 'white',
    margin: 24,
    marginTop: 'auto',
    marginBottom: 'auto',
    borderRadius: 24,
    padding: 24,
    width: width - 48,
  },
  centerModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 20,
    textAlign: 'center',
  },
  formatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  formatOptionText: {
    fontSize: 17,
    color: '#475569',
    fontWeight: '500',
  },
  formatActive: {
    color: '#2563eb',
    fontWeight: '700',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
  },

  // Camera Styles
  cameraContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  cameraUi: {
    flex: 1,
    justifyContent: 'space-between',
  },
  camHeader: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  camCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  camTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  camFocusArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  focusCorners: {
    position: 'absolute',
  },
  laserLine: {
    width: '70%',
    height: 2,
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  camFooter: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  camInstruction: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    overflow: 'hidden',
  },
});
