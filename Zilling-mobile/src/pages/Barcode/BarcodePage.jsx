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
  Platform,
  StatusBar,
  TouchableOpacity,
  TextInput
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
  Maximize2,
  Sparkles,
  Zap,
  Info,
  Layers,
  ChevronRight
} from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useProducts } from '../../context/ProductContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { addToBillingQueue } from '../../services/billingQueue';
import { useToast } from '../../context/ToastContext';
import { resolveBarcode, buildCartPayload, sanitizeBarcode } from '../../utils/barcodeUtils';

const { width, height } = Dimensions.get('window');

const FORMATS = [
  { label: 'CODE-128 (Standard)', value: 'CODE128' },
  { label: 'EAN-13 (Retail)', value: 'EAN13' },
  { label: 'UPC-A (Universal)', value: 'UPC' },
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

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
    }, [])
  );

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (Array.isArray(p.variants) && p.variants.some(v => 
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (v.barcode && v.barcode.toLowerCase().includes(searchQuery.toLowerCase()))
    ))
  );

  const generateBarcode = () => {
    if (!inputValue.trim()) {
      showToast('Enter code for generation', 'error');
      return;
    }
    setBarcodeValue(inputValue);
  };

  const isUpdateDisabled = inputValue === barcodeValue;

  const handleProductSelect = (prod, variant = null) => {
    const value = variant ? (variant.barcode || variant.id) : (prod.barcode || prod.id);
    setInputValue(value);
    setBarcodeValue(value);
    setBarcodeFormat('CODE128');
    setShowProductModal(false);
  };

  const handleCopy = () => {
    showToast('Value copied to clipboard', 'success');
  };

  const handlePrint = () => {
    showToast('Initialize Printer to continue', 'info');
  };

  const handleStartScan = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        showToast('Camera permission required', 'error');
        return;
      }
    }
    setScanned(false);
    setIsScanning(true);
  };

  const playScanSound = async () => {
    try {
      if (sound) await sound.replayAsync();
    } catch (error) {
      console.log('Sound error', error);
    }
  };

  const handleBarCodeScanned = ({ data }) => {
    if (scanned) return;
    setScanned(true);

    const safeData = sanitizeBarcode(data);
    if (!safeData) {
      showToast('Invalid barcode', 'error');
      setTimeout(() => { setScanned(false); }, 2000);
      return;
    }

    Vibration.vibrate();
    playScanSound();

    setInputValue(safeData);
    setBarcodeValue(safeData);

    const { product: matchedProduct, variant: matchedVariant } = resolveBarcode(safeData, products);

    if (matchedProduct) {
      const cartPayload = buildCartPayload(matchedProduct, matchedVariant);
      addToBillingQueue(cartPayload);
      const displayName = matchedVariant ? `${matchedProduct.name} (${matchedVariant.name})` : matchedProduct.name;
      showToast(`Logged: ${displayName}`, 'success');
      setTimeout(() => { setScanned(false); }, 1500);
    } else {
      showToast(`Unrecognized: ${safeData}`, 'error');
      setTimeout(() => { setScanned(false); }, 2000);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.headerWrapper}>
        <LinearGradient colors={['#000', '#1a1a1a']} style={styles.header}>
          <SafeAreaView edges={['top']}>
            <View style={styles.navBar}>
              <Pressable onPress={() => navigation.goBack()} style={styles.navBtn}>
                <ChevronLeft size={24} color="#fff" />
              </Pressable>
              <View style={styles.headerInfo}>
                <Text style={styles.brand}>KWIQ STUDIO</Text>
                <Text style={styles.title}>Barcode Lab</Text>
              </View>
              <Pressable style={styles.navBtn} onPress={handleStartScan}>
                 <Maximize2 size={22} color="#fff" strokeWidth={1.5} />
              </Pressable>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Zap size={16} color="#000" />
            <Text style={styles.sectionLabel}>IDENTITY & SOURCE</Text>
          </View>
          
          <View style={styles.card}>
            <Text style={styles.label}>Select Product</Text>
            <Pressable style={styles.selector} onPress={() => setShowProductModal(true)}>
              <Package size={20} color="#000" style={styles.selIcon} />
              <Text style={styles.selValue} numberOfLines={1}>
                {products.find(p => p.barcode === inputValue || p.id === inputValue)?.name || 'Search Inventory...'}
              </Text>
              <ChevronDown size={20} color="#cbd5e1" />
            </Pressable>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Label Content</Text>
                <Input
                  value={inputValue}
                  onChangeText={setInputValue}
                  placeholder="CODE"
                  autoCapitalize="characters"
                  style={styles.inputStyle}
                />
              </View>
              <View style={{ marginLeft: 15 }}>
                <Text style={styles.label}>Format</Text>
                <Pressable style={styles.formatSel} onPress={() => setShowFormatModal(true)}>
                  <Text style={styles.formatValue}>
                    {barcodeFormat === 'CODE128' ? 'C-128' : barcodeFormat}
                  </Text>
                  <ChevronDown size={16} color="#000" />
                </Pressable>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.actionBtn, isUpdateDisabled && styles.actionBtnDisabled]} 
              onPress={generateBarcode} 
              activeOpacity={0.9}
              disabled={isUpdateDisabled}
            >
              <Text style={[styles.actionBtnText, isUpdateDisabled && styles.actionBtnTextDisabled]}>Update Lab Preview</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Sparkles size={16} color="#000" />
            <Text style={styles.sectionLabel}>LAB PREVIEW</Text>
          </View>

          <View style={styles.previewContainer}>
             <View style={styles.ticket}>
                <View style={[styles.punch, { top: -11 }]} />
                <View style={[styles.punch, { bottom: -11 }]} />
                
                <View style={styles.ticketContent}>
                   {barcodeValue ? (
                     <>
                       <BarcodeIcon size={100} color="#000" />
                       <Text style={styles.barcodeText}>{barcodeValue}</Text>
                       <View style={styles.metaRow}>
                          <Text style={styles.metaLabel}>FORMAT</Text>
                          <Text style={styles.metaVal}>{barcodeFormat}</Text>
                       </View>
                     </>
                   ) : (
                     <View style={styles.emptyState}>
                        <Info size={40} color="#e2e8f0" />
                        <Text style={styles.emptyPrompt}>Ready for Identity</Text>
                     </View>
                   )}
                </View>
             </View>

             <View style={styles.footerActions}>
                <TouchableOpacity style={[styles.footerBtn, styles.btnOutline]} onPress={handleCopy}>
                  <Copy size={20} color="#000" />
                  <Text style={[styles.footerBtnText, { color: '#000' }]}>Copy Text</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.footerBtn, styles.btnBlack]} onPress={handlePrint}>
                  <Printer size={20} color="#fff" />
                  <Text style={[styles.footerBtnText, { color: '#fff' }]}>Print Label</Text>
                </TouchableOpacity>
             </View>
          </View>
        </View>

        <View style={styles.tipBox}>
           <Text style={styles.tipText}>Tip: Use standard retail formats like EAN-13 for better scanner compatibility across mobile devices.</Text>
        </View>
        
        <View style={{ height: 50 }} />
      </ScrollView>

      {/* Modern Product Modal */}
      <Modal visible={showProductModal} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalBackdrop}>
           <View style={styles.modalSheet}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                 <Text style={styles.sheetTitle}>Link Product</Text>
                 <Pressable onPress={() => setShowProductModal(false)} style={styles.sheetClose}>
                   <X size={20} color="#000" />
                 </Pressable>
              </View>
              
              <View style={styles.searchBarOuter}>
                 <View style={styles.searchBarInner}>
                    <Search size={18} color="#94a3b8" />
                    <TextInput
                      placeholder="Search inventory..."
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      style={styles.searchBarInput}
                      placeholderTextColor="#94a3b8"
                    />
                 </View>
              </View>

              <FlatList
                data={filteredProducts}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View style={styles.productNode}>
                    <Pressable style={styles.productRow} onPress={() => handleProductSelect(item)}>
                      <View style={styles.rowDot} />
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowName}>{item.name}</Text>
                        <Text style={styles.rowSku}>{item.barcode || 'Generic Code'}</Text>
                      </View>
                      <ChevronRight size={18} color="#e2e8f0" />
                    </Pressable>
                    
                    {Array.isArray(item.variants) && item.variants.length > 0 && (
                      <View style={styles.variantContainer}>
                        {item.variants.map((v, idx) => (
                           <Pressable 
                             key={v.id || idx} 
                             style={styles.variantChip}
                             onPress={() => handleProductSelect(item, v)}
                           >
                             <Layers size={14} color="#64748b" style={{ marginRight: 8 }} />
                             <Text style={styles.vName}>{v.name}</Text>
                             <Text style={styles.vCode}>{v.barcode || '---'}</Text>
                           </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              />
           </View>
        </View>
      </Modal>

      {/* Format Modal */}
      <Modal visible={showFormatModal} animationType="fade" transparent>
         <View style={styles.centerOverlay}>
            <View style={styles.centerSheet}>
               <Text style={styles.centerTitle}>Select Format</Text>
               {FORMATS.map(f => (
                 <Pressable
                   key={f.value}
                   style={styles.formatItem}
                   onPress={() => { setBarcodeFormat(f.value); setShowFormatModal(false); }}
                 >
                   <Text style={[styles.formatLabel, barcodeFormat === f.value && { fontWeight: '900' }]}>{f.label}</Text>
                   {barcodeFormat === f.value && <Zap size={14} color="#000" fill="#000" />}
                 </Pressable>
               ))}
            </View>
         </View>
      </Modal>

      {/* Scanner Modal */}
      <Modal visible={isScanning} animationType="fade" transparent presentationStyle="fullScreen">
        <View style={styles.camLayer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "code128"] }}
          >
            <SafeAreaView style={styles.camUi}>
               <View style={styles.camHeader}>
                  <Pressable onPress={() => setIsScanning(false)} style={styles.camBack}>
                    <X size={24} color="#fff" />
                  </Pressable>
                  <Text style={styles.camHeaderTitle}>LAB SCANNER</Text>
                  <View style={{ width: 44 }} />
               </View>
               <View style={styles.camCenter}>
                  <View style={styles.camBox}>
                    <View style={styles.scanLine} />
                  </View>
               </View>
               <View style={styles.camBottom}>
                  <Text style={styles.camHint}>Position code within the frame</Text>
               </View>
            </SafeAreaView>
          </CameraView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  headerWrapper: { backgroundColor: '#ffffff' },
  header: { 
    height: 130, 
    width: '100%',
    paddingHorizontal: 25, 
    justifyContent: 'flex-end', 
    paddingBottom: 30,
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
    overflow: 'hidden'
  },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 15 },
  headerInfo: { alignItems: 'center' },
  brand: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '900', letterSpacing: 4 },
  title: { color: '#ffffff', fontSize: 22, fontWeight: '900', marginTop: 2 },
  
  scrollBody: { padding: 25 },
  section: { marginBottom: 35 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: '#000', letterSpacing: 1.5 },
  
  card: { backgroundColor: '#ffffff', borderRadius: 30, padding: 25, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 4 },
  label: { fontSize: 10, fontWeight: '800', color: '#94a3b8', marginBottom: 10, letterSpacing: 1 },
  selector: { height: 60, backgroundColor: '#f8fafc', borderRadius: 18, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  selIcon: { marginRight: 12 },
  selValue: { flex: 1, fontSize: 15, fontWeight: '700', color: '#000' },
  
  row: { flexDirection: 'row', marginBottom: 25 },
  inputStyle: { flex: 1, height: 60, backgroundColor: '#f8fafc', borderRadius: 18, fontSize: 16, fontWeight: '900', paddingHorizontal: 15, color: '#000', borderWidth: 1, borderColor: '#e2e8f0' },
  formatSel: { height: 60, width: 105, backgroundColor: '#f8fafc', borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  formatValue: { fontSize: 15, fontWeight: '900', color: '#000' },
  
  actionBtn: { height: 60, backgroundColor: '#000', borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  actionBtnDisabled: { backgroundColor: '#f1f5f9', shadowOpacity: 0, elevation: 0, borderWidth: 1, borderColor: '#e2e8f0' },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  actionBtnTextDisabled: { color: '#94a3b8' },
  
  previewContainer: { alignItems: 'center' },
  ticket: { width: '100%', backgroundColor: '#fff', borderRadius: 35, borderWidth: 2, borderColor: '#000', position: 'relative', overflow: 'hidden' },
  punch: { position: 'absolute', left: '50%', marginLeft: -45, width: 90, height: 22, backgroundColor: '#fff', borderRadius: 11, borderWidth: 2, borderColor: '#000' },
  ticketContent: { paddingHorizontal: 40, paddingVertical: 50, alignItems: 'center', gap: 20 },
  barcodeText: { fontSize: 28, fontWeight: '900', letterSpacing: 6, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  metaRow: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 100 },
  metaLabel: { fontSize: 9, fontWeight: '900', color: '#64748b' },
  metaVal: { fontSize: 11, fontWeight: '800', color: '#000' },
  emptyState: { padding: 40, alignItems: 'center', gap: 15 },
  emptyPrompt: { color: '#cbd5e1', fontWeight: '900', fontSize: 16 },
  
  footerActions: { flexDirection: 'row', gap: 15, marginTop: 30, width: '100%' },
  footerBtn: { flex: 1, height: 60, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  footerBtnText: { fontSize: 15, fontWeight: '900' },
  btnOutline: { borderWidth: 2, borderColor: '#000' },
  btnBlack: { backgroundColor: '#000' },
  
  tipBox: { backgroundColor: '#f8fafc', padding: 20, borderRadius: 20, marginTop: 10 },
  tipText: { color: '#64748b', fontSize: 13, lineHeight: 18, fontWeight: '500', textAlign: 'center' },
  
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 40, borderTopRightRadius: 40, height: '85%', padding: 25 },
  sheetHandle: { width: 50, height: 5, backgroundColor: '#f1f5f9', borderRadius: 10, alignSelf: 'center', marginBottom: 25 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 24, fontWeight: '900', color: '#000' },
  sheetClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderRadius: 22 },
  
  searchBarOuter: { 
    height: 64, 
    backgroundColor: '#f1f5f9', 
    borderRadius: 22, 
    padding: 6, 
    marginBottom: 20 
  },
  searchBarInner: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    borderRadius: 18, 
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  searchBarInput: { 
    flex: 1, 
    height: '100%', 
    fontSize: 16, 
    fontWeight: '700', 
    marginLeft: 12, 
    color: '#000',
  },
  
  productNode: { borderBottomWidth: 1, borderBottomColor: '#f8fafc', paddingVertical: 5 },
  productRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18 },
  rowDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#000', marginRight: 15 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 17, fontWeight: '900', color: '#000' },
  rowSku: { fontSize: 13, fontWeight: '700', color: '#94a3b8', marginTop: 3 },
  
  variantContainer: { paddingLeft: 25, paddingBottom: 15, gap: 10 },
  variantChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 15, borderWidth: 1, borderColor: '#f1f5f9' },
  vName: { flex: 1, fontSize: 14, fontWeight: '800', color: '#475569' },
  vCode: { fontSize: 12, fontWeight: '700', color: '#94a3b8', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  centerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 30 },
  centerSheet: { backgroundColor: '#fff', borderRadius: 30, padding: 30 },
  centerTitle: { fontSize: 20, fontWeight: '900', color: '#000', marginBottom: 25, textAlign: 'center', letterSpacing: 1 },
  formatItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  formatLabel: { fontSize: 16, color: '#000', fontWeight: '500' },
  
  camLayer: { flex: 1, backgroundColor: '#000' },
  camUi: { flex: 1, justifyContent: 'space-between' },
  camHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 25 },
  camBack: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  camHeaderTitle: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 4 },
  camCenter: { alignItems: 'center', justifyContent: 'center' },
  camBox: { width: 280, height: 280, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  scanLine: { width: '80%', height: 2, backgroundColor: '#fff', position: 'absolute', top: '50%', shadowColor: '#fff', shadowOpacity: 0.8, shadowRadius: 10 },
  camBottom: { padding: 40, alignItems: 'center' },
  camHint: { color: '#fff', fontSize: 12, fontWeight: '600', opacity: 0.8, letterSpacing: 1 }
});
