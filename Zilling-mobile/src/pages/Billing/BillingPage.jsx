import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, StatusBar, ScrollView, ActivityIndicator, InteractionManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, X, Upload, Save, Share2, Scan, ChevronDown } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { printReceipt } from '../../utils/printUtils';
import { exportToDeviceFolders } from '../../services/backupservices';
import { fetchAllTableData } from '../../services/database';
import { useTransactions } from '../../context/TransactionContext';
import { useProducts } from '../../context/ProductContext';
import { useCustomers } from '../../context/CustomerContext';
import { useSettings } from '../../context/SettingsContext';
import { getBillingQueue, clearBillingQueue } from '../../services/billingQueue';
import { useToast } from '../../context/ToastContext';
import * as Print from 'expo-print';
import ScanBarcodeModal from '../../components/ScanBarcodeModal';
import { resolveBarcode, buildCartPayload, sanitizeBarcode } from '../../utils/barcodeUtils';
import { debouncedNavigate } from '../../utils/navigationUtils';

// Components
import BillingGrid from './components/BillingGrid';
import BillingSidebar from './components/BillingSidebar';
import BottomFunctionBar from './components/BottomFunctionBar';
import { DiscountModal, RemarksModal, AdditionalChargesModal, LoyaltyPointsModal } from './components/ActionModals';
import CustomerCaptureModal from './components/CustomerCaptureModal';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import ReceptionistSelectionModal from './components/ReceptionistSelectionModal';



// Wizard Steps (Optional/Mobile Flow)
import ProductStep from './components/steps/ProductStep';
import CustomerStep from './components/steps/CustomerStep';
import PaymentStep from './components/steps/PaymentStep';



export default function BillingPage({ navigation, route }) {
  const { addTransaction, editTransaction } = useTransactions();
  const { products, fetchProducts, updateStock } = useProducts();
  const { fetchCustomers, customers } = useCustomers();
  const { settings, updateSettings } = useSettings();
  const { showToast } = useToast();

  const handleRemoveAdjustment = (type) => {
    switch (type) {
      case 'discount': updateCurrentBill({ billDiscount: 0 }); break;
      case 'loyalty': updateCurrentBill({ loyaltyPointsDiscount: 0 }); break;
      case 'charges': updateCurrentBill({ additionalCharges: 0 }); break;
      case 'remarks': updateCurrentBill({ remarks: '' }); break;
    }
  };

  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Derive printer status from settings
  const isPrinterConnected = !!settings?.invoice?.selectedPrinter;

  const handleConnectPrinter = async () => {
    Alert.alert(
      "Connect Printer",
      "Which type of printer would you like to connect?",
      [
        {
          text: "Bluetooth Thermal",
          onPress: () => {
            debouncedNavigate(navigation, 'Settings', { tab: 'print' });
          }
        },
        {
          text: "Wi-Fi / Network",
          onPress: async () => {
            try {
              const printer = await Print.selectPrinterAsync();
              if (printer) {
                updateSettings('invoice', { selectedPrinter: printer });
                showToast(`Printer Connected: ${printer.name || 'Selected'}`, 'printer');
              }
            } catch (e) {
              console.error("Printer Selection Error:", e);
              Alert.alert("Printer Error", "Failed to select printer.");
            }
          }
        },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  // Refresh data on focus
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('dark-content');
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor('#ffffff');
      }

      const task = InteractionManager.runAfterInteractions(() => {
        fetchProducts();
        processBillingQueue();

        // Ensure sync pill is visible when we focus if scanner is closed
        if (isScannerOpen) {
          updateSettings('app', { isScannerActive: true });
        } else {
          updateSettings('app', { isScannerActive: false });
        }
      });

      return () => {
        task.cancel();
        // Clear scanner active state on unmount/blur
        updateSettings('app', { isScannerActive: false });
      };
    }, [activeBillId, isScannerOpen])
  );

  useEffect(() => {
    fetchCustomers();
    loadStaffSession().then(staff => {
      if (staff) {
        setActiveBills(prev => prev.map(b => ({ ...b, receptionist: staff })));
      }
    });
  }, []);

  // Sync: Handle customer deletion from other screens
  useEffect(() => {
    if (!customers) return;
    setActiveBills(prev => {
      let changed = false;
      const next = prev.map(bill => {
        if (bill.customer && !customers.find(c => String(c.id) === String(bill.customer.id))) {
          changed = true;
          return { ...bill, customer: null };
        }
        return bill;
      });
      return changed ? next : prev;
    });
  }, [customers]);

  // --- State: Tab Management ---
  const [activeBills, setActiveBills] = useState([
    {
      id: 1,
      customer: null,
      cart: [],
      totals: { grossTotal: 0, itemDiscount: 0, subtotal: 0, tax: 0, discount: 0, additionalCharges: 0, roundOff: 0, total: 0, pointsEarned: 0, totalItems: 0, totalQty: 0 },
      paymentMode: 'Cash',
      amountReceived: '',
      remarks: '',
      billDiscount: 0,
      additionalCharges: 0,
      loyaltyPointsDiscount: 0,
      loyaltyPointsRedeemed: 0,
      status: 'PAID',
      taxType: settings?.tax?.defaultTaxType || 'intra',
      receptionist: null // Populated by loadStaffSession in useEffect
    }
  ]);
  const [activeBillId, setActiveBillId] = useState(1);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);


  // --- Variant Selection State ---
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [selectedVariantProduct, setSelectedVariantProduct] = useState(null);

  // --- Modals State ---
  const [modals, setModals] = useState({
    itemDiscount: false,
    billDiscount: false,
    remarks: false,
    additionalCharges: false,
    loyaltyPoints: false,
    stockLimit: false,
    customerCapture: false,
    clearCartConfirm: false,
    receptionistSelection: false
  });

  // Stock limit message state
  const [stockLimitMessage, setStockLimitMessage] = useState('');

  // --- Session Management (Locked Staff) ---
  const [lockedStaff, setLockedStaff] = useState(null);

  const loadStaffSession = async () => {
    try {
      const sessionStr = await require('@react-native-async-storage/async-storage').default.getItem('@persistent_staff_session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        // Check expiry if it's a 'Shift' lock
        if (session.expiry && Date.now() > session.expiry) {
          await require('@react-native-async-storage/async-storage').default.removeItem('@persistent_staff_session');
          setLockedStaff(null);
          return null;
        }

        // Attach mode to staff for UI displays
        const staffWithMode = { ...session.staff, mode: session.mode };
        setLockedStaff(staffWithMode);
        return staffWithMode;
      }
    } catch (e) {
      console.warn('Failed to load staff session', e);
    }
    return null;
  };

  const saveStaffSession = async (staff, mode) => {
    try {
      if (!staff) {
        await require('@react-native-async-storage/async-storage').default.removeItem('@persistent_staff_session');
        setLockedStaff(null);
        return;
      }

      let expiry = null;
      if (mode === 'shift') {
        const midnight = new Date();
        midnight.setHours(23, 59, 59, 999);
        expiry = midnight.getTime();
      } else if (mode === 'weekly') {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        nextWeek.setHours(23, 59, 59, 999);
        expiry = nextWeek.getTime();
      } else if (mode === 'always') {
        expiry = null; // No expiry
      } else {
        // Single bill mode - don't save to persistent storage
        setLockedStaff(null);
        return;
      }

      const staffWithMode = { ...staff, mode };
      const session = { staff: staffWithMode, expiry, mode };
      await require('@react-native-async-storage/async-storage').default.setItem('@persistent_staff_session', JSON.stringify(session));
      setLockedStaff(staffWithMode);
    } catch (e) {
      console.warn('Failed to save staff session', e);
    }
  };

  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'sidebar' (on mobile)
  const [customerSearchValue, setCustomerSearchValue] = useState('');
  const [showBillSelector, setShowBillSelector] = useState(false);

  // Helper: Is any modal currently visible? (To pause the scanner)
  const isAnyModalVisible = useMemo(() => {
    return showVariantModal ||
      Object.values(modals).some(v => v === true) ||
      showBillSelector;
  }, [modals, showVariantModal, showBillSelector]);

  // Helper: Get Current Bill
  const currentBill = useMemo(() => activeBills.find(b => b.id === activeBillId) || activeBills[0], [activeBills, activeBillId]);

  // Helper: Update Current Bill
  const updateCurrentBill = useCallback((updates) => {
    setActiveBills(prev => prev.map(bill =>
      bill.id === activeBillId ? { ...bill, ...updates } : bill
    ));
  }, [activeBillId]);

  // --- Process Billing Queue (from Barcode Scanner page) ---
  // SECURITY: Items in queue are validated before being added to cart.
  const processBillingQueue = async () => {
    const queue = await getBillingQueue();
    if (!queue || queue.length === 0) return;

    setActiveBills(prevBills => {
      const targetBillId = activeBillId;
      return prevBills.map(bill => {
        if (bill.id !== targetBillId) return bill;

        let newCart = [...bill.cart];

        queue.forEach(queuedItem => {
          // Safety: skip malformed queue entries
          if (!queuedItem || !queuedItem.id) return;

          // Resolve variant context from queue payload
          const resolvedVariant = queuedItem._resolvedVariant || null;
          const variantName = resolvedVariant?.name ||
            (resolvedVariant?.options && resolvedVariant.options[0]) ||
            queuedItem.variantName ||
            null;

          const variantPrice = resolvedVariant &&
            resolvedVariant.price !== null &&
            resolvedVariant.price !== undefined
            ? parseFloat(resolvedVariant.price)
            : parseFloat(queuedItem.price || queuedItem.sellingPrice || 0);

          // Cart item ID: include variant name to allow separate line items per variant
          const cartItemId = variantName
            ? `${queuedItem._dbProductId || queuedItem.id}-${variantName}`
            : queuedItem.id;

          const displayName = variantName
            ? `${queuedItem.name.replace(/ - .*$/, '')} - ${variantName}`  // avoid double suffix
            : queuedItem.name;

          const existingIndex = newCart.findIndex(i => i.id === cartItemId);

          if (existingIndex >= 0) {
            // Increment quantity for existing cart line
            const existing = newCart[existingIndex];
            const newQty = (existing.quantity || 0) + 1;
            newCart[existingIndex] = {
              ...existing,
              quantity: newQty,
              total: newQty * (existing.price || 0) - (existing.discount || 0),
            };
          } else {
            // New cart line
            newCart.push({
              ...queuedItem,
              id: cartItemId,
              _dbId: queuedItem._dbProductId || queuedItem.id,
              name: displayName,
              variantName: variantName,
              price: variantPrice,
              quantity: 1,
              total: variantPrice,
              discount: 0,
              taxRate: parseFloat(queuedItem.tax_rate || queuedItem.taxRate || 0),
              unit: queuedItem.unit || 'pcs',
            });
          }
        });

        return { ...bill, cart: newCart };
      });
    });

    await clearBillingQueue();
    showToast(`${queue.length} item(s) added to your cart.`, 'success', 3000, null, 'Cart Updated');
  };

  // Helper: Calculation Logic (Robust Port from User Snippet)
  const calculateTotals = (cart, billDiscount = 0, additionalCharges = 0, loyaltyPointsDiscount = 0, taxType = 'intra') => {
    let aggGross = 0; // Pre-discount total
    let aggItemDisc = 0; // Total of per-item discounts
    let aggSubtotal = 0; // Taxable Value before bill-level discounts
    let totalItems = 0;
    let totalQty = 0;

    const isInclusive = settings?.tax?.defaultType === 'Inclusive' || settings?.tax?.priceMode === 'Inclusive';

    cart.forEach(item => {
      const price = parseFloat(item.price || item.sellingPrice || 0);
      const qty = parseFloat(item.quantity || 0);
      const discount = parseFloat(item.discount || 0);

      aggGross += (price * qty);
      aggItemDisc += discount;
      totalItems += 1;
      totalQty += qty;

      const effectiveAmount = Math.max(0, (price * qty) - discount);
      aggSubtotal += effectiveAmount;
    });

    // 1. Calculate Loyalty Discount (Already passed as loyaltyPointsDiscount)
    // 2. Apply Loyalty Discount to Subtotal BEFORE Tax
    const taxableAfterLoyalty = Math.max(0, aggSubtotal - loyaltyPointsDiscount);

    // 3. Calculate Tax on (Subtotal - Loyalty Discount)
    let aggTax = 0;
    cart.forEach(item => {
      const price = parseFloat(item.price || item.sellingPrice || 0);
      const qty = parseFloat(item.quantity || 0);
      const discount = parseFloat(item.discount || 0);
      const taxRate = parseFloat(item.taxRate || 0);

      // We need to proportionally distribute the loyalty discount across items for accurate tax if rates differ, 
      // but if we assume a flat tax calculation on the remaining taxable value:
      const itemTaxable = Math.max(0, (price * qty) - discount);
      const itemProportion = aggSubtotal > 0 ? (itemTaxable / aggSubtotal) : 0;
      const itemTaxableAfterLoyalty = Math.max(0, itemTaxable - (loyaltyPointsDiscount * itemProportion));

      if (isInclusive) {
        // Tax is already inside the price
        const taxable = itemTaxableAfterLoyalty / (1 + (taxRate / 100));
        aggTax += (itemTaxableAfterLoyalty - taxable);
      } else {
        aggTax += (itemTaxableAfterLoyalty * (taxRate / 100));
      }
    });

    // 4. Calculate Bill Discount
    let totalBeforeBillDiscount;
    if (isInclusive) {
      // If inclusive, the tax is already in taxableAfterLoyalty (which is derived from price * qty)
      // So we don't add aggTax again.
      totalBeforeBillDiscount = taxableAfterLoyalty + additionalCharges;
    } else {
      // If exclusive, add tax to the subtotal
      totalBeforeBillDiscount = taxableAfterLoyalty + aggTax + additionalCharges;
    }

    const total = Math.max(0, totalBeforeBillDiscount - billDiscount);

    // 5. Calculate New Points Earned on ORIGINAL Subtotal (₹1 per ₹10 spent)
    const pointsEarned = Math.floor(aggSubtotal / 10);

    // Rounding
    const roundedTotal = Math.round(total);
    const roundOff = roundedTotal - total;

    // Determine the "Taxable Subtotal" to return
    // For Exclusive: It is just taxableAfterLoyalty
    // For Inclusive: It is taxableAfterLoyalty - aggTax (Reverse calculated)
    const displaySubtotal = isInclusive ? (taxableAfterLoyalty - aggTax) : taxableAfterLoyalty;

    return {
      grossTotal: aggGross,
      itemDiscount: aggItemDisc,
      subtotal: displaySubtotal, // This is the Taxable Value
      originalSubtotal: aggSubtotal, // This is the sum of (Price * Qty)
      tax: aggTax,
      cgst: taxType === 'intra' ? aggTax / 2 : 0,
      sgst: taxType === 'intra' ? aggTax / 2 : 0,
      igst: taxType === 'inter' ? aggTax : 0,
      discount: billDiscount,
      loyaltyPointsDiscount,
      additionalCharges,
      total: roundedTotal,
      roundOff: roundOff,
      pointsEarned: pointsEarned,
      totalItems,
      totalQty
    };
  };

  // Effect: Recalculate whenever cart, discounts or charges change
  useEffect(() => {
    const newTotals = calculateTotals(
      currentBill.cart,
      currentBill.billDiscount || 0,
      currentBill.additionalCharges || 0,
      currentBill.loyaltyPointsDiscount || 0,
      currentBill.taxType || 'intra'
    );

    if (JSON.stringify(newTotals) !== JSON.stringify(currentBill.totals)) {
      updateCurrentBill({ totals: newTotals });
    }
  }, [currentBill.cart, currentBill.billDiscount, currentBill.additionalCharges, currentBill.loyaltyPointsDiscount, currentBill.taxType, settings?.tax?.priceMode, settings?.tax?.defaultType]);

  // --- Handle "Edit Invoice" Navigation Params ---
  useEffect(() => {
    if (route?.params?.editInvoice) {
      const invoiceToEdit = route.params.editInvoice;

      // Map invoice items back to cart items (ensure fields match what BillingGrid expects)
      const mappedCart = (invoiceToEdit.items || []).map(item => ({
        ...item,
        id: item.productId || item.id, // Ensure ID is preserved
        price: item.price,
        sellingPrice: item.price, // Fallback
        quantity: item.quantity,
        total: item.total,
        name: item.name
      }));

      const newBill = {
        id: Date.now(), // New session ID, but we are editing
        isEditing: true, // Flag to indicate edit mode if needed
        originalInvoiceId: invoiceToEdit.id || invoiceToEdit.invoiceNumber,
        customer: {
          id: invoiceToEdit.customerId,
          name: invoiceToEdit.customerName,
          fullName: invoiceToEdit.customerName // Normalize
        },
        cart: mappedCart,
        totals: {
          grossTotal: invoiceToEdit.subtotal || invoiceToEdit.grossTotal || 0, // Fallback logic
          tax: invoiceToEdit.tax || 0,
          discount: invoiceToEdit.discount || 0,
          total: invoiceToEdit.total || 0,
          subtotal: invoiceToEdit.subtotal || 0,
          itemDiscount: invoiceToEdit.itemDiscount || 0,
          additionalCharges: invoiceToEdit.additionalCharges || 0,
          roundOff: invoiceToEdit.roundOff || 0
        },
        paymentMode: invoiceToEdit.paymentMethod || 'Cash',
        status: invoiceToEdit.status || 'PAID',
        billDiscount: invoiceToEdit.discount || 0, // Simplified mapping
        additionalCharges: invoiceToEdit.additionalCharges || 0
      };

      // Set the active bill to this loaded invoice
      setActiveBills([newBill]);
      setActiveBillId(newBill.id);

      // Clear params so it doesn't reload on every render/focus
      navigation.setParams({ editInvoice: null });
    }
  }, [route?.params?.editInvoice]);


  // --- Actions ---
  const addNewBill = () => {
    const newId = activeBills.length > 0 ? Math.max(...activeBills.map(b => b.id)) + 1 : 1;
    const newBill = {
      id: newId,
      customer: null,
      cart: [],
      totals: { grossTotal: 0, itemDiscount: 0, subtotal: 0, tax: 0, discount: 0, additionalCharges: 0, roundOff: 0, total: 0, pointsEarned: 0, totalItems: 0, totalQty: 0 },
      paymentMode: 'Cash',
      amountReceived: '',
      remarks: '',
      billDiscount: 0,
      additionalCharges: 0,
      loyaltyPointsDiscount: 0,
      loyaltyPointsRedeemed: 0,
      status: 'PAID',
      taxType: settings?.tax?.defaultTaxType || 'intra',
      receptionist: null
    };
    setActiveBills([...activeBills, newBill]);
    setActiveBillId(newId);
    setSelectedItemId(null);
  };

  const closeBill = (id) => {
    // Template for a fresh bill
    const freshBill = {
      id: (activeBills.length === 1) ? 1 : Date.now(),
      customer: null,
      cart: [],
      totals: { grossTotal: 0, itemDiscount: 0, subtotal: 0, tax: 0, discount: 0, additionalCharges: 0, roundOff: 0, total: 0, pointsEarned: 0, totalItems: 0, totalQty: 0 },
      paymentMode: 'Cash',
      amountReceived: '',
      remarks: '',
      billDiscount: 0,
      additionalCharges: 0,
      loyaltyPointsDiscount: 0,
      loyaltyPointsRedeemed: 0,
      status: 'PAID',
      originalInvoiceId: null,
      receptionist: null
    };

    if (activeBills.length <= 1) {
      // Don't close the last tab, just reset it
      console.log('Resetting Bill to Empty State');
      setActiveBills([freshBill]);
      setActiveBillId(freshBill.id);
      setSelectedItemId(null);
      return;
    }

    const newBills = activeBills.filter(b => b.id !== id);
    setActiveBills(newBills);
    if (id === activeBillId) {
      setActiveBillId(newBills[newBills.length - 1].id);
    }
  };

  // Cart Actions (Exposed to Child)
  const updateQuantity = useCallback((id, newQty) => {
    // Allow fractional quantities (e.g. 0.5 kg), but ensure > 0
    if (parseFloat(newQty) <= 0 || isNaN(parseFloat(newQty))) return;
    const sNewQty = parseFloat(newQty); // Handle string input

    const item = currentBill.cart.find(i => i.id === id);
    if (!item) return;

    // Check Stock Limit
    const dbId = item._dbId || item.id;
    const productInDb = products.find(p => p.id === dbId);

    // If product exists in DB, check stock
    if (productInDb) {
      const availableStock = parseFloat(productInDb.stock || 0);
      if (sNewQty > availableStock) {
        setStockLimitMessage(`Stock quantity only ${availableStock}. You can't add above this.`);
        setModals(m => ({ ...m, stockLimit: true }));
        return;
      }
    }

    const newCart = currentBill.cart.map(i => i.id === id ? { ...i, quantity: sNewQty, total: sNewQty * i.price - (i.discount || 0) } : i);
    updateCurrentBill({ cart: newCart });
  }, [currentBill.cart, products, updateCurrentBill]);

  const updatePrice = useCallback((id, newPrice) => {
    if (parseFloat(newPrice) < 0 || isNaN(parseFloat(newPrice))) return;
    const sNewPrice = parseFloat(newPrice);

    const newCart = currentBill.cart.map(i => i.id === id ? { ...i, price: sNewPrice, total: i.quantity * sNewPrice - (i.discount || 0) } : i);
    updateCurrentBill({ cart: newCart });
  }, [currentBill.cart, updateCurrentBill]);

  const removeItem = useCallback((id) => {
    const newCart = currentBill.cart.filter(item => item.id !== id);
    updateCurrentBill({ cart: newCart });
    if (selectedItemId === id) setSelectedItemId(null);
  }, [currentBill.cart, updateCurrentBill, selectedItemId]);

  // Add dummy item for testing (Real app would use Search Bar or Barcode)
  // We'll hook this up to a "Demo Add" or rely on a search bar in the Header in future
  // For now, let's auto-add if cart is empty just to see UI? No, empty state is fine. 
  // Wait, the grid needs items. I should expose a way to add items. 
  // I'll add a "FAB" or Search button in the BillingPage header or use the SearchModal logic.

  // Actually, `activeBill` needs to be able to add products. 
  // I'll hijack the "F2" to add a random product for testing if no specific search UI exists yet.
  // Or better, I'll add a temporary "Add Test Item" button in the header.

  const addItemToCart = useCallback((product, variant = null) => {
    if (!product || !product.id) {
      console.warn('addItemToCart called with invalid product:', product);
      return;
    }
    // If variant is an object (new structure), extract name and provide barcode overrides
    const variantObj = (variant && typeof variant === 'object') ? {
      ...variant,
      // Barcode/SKU Overrides for Cart display
      sku: variant.barcode || variant.sku || product.sku,
      barcode: variant.barcode || variant.barcode || product.barcode,
    } : null;

    const variantName = variantObj
      ? (variantObj.name || (variantObj.options && variantObj.options[0]))
      : (typeof variant === 'string' ? variant : null);

    const variantPrice = variantObj && variantObj.price !== null && variantObj.price !== undefined
      ? parseFloat(variantObj.price)
      : parseFloat(product.price || product.sellingPrice || 0);

    const variantSuffix = variantName ? ` - ${variantName}` : '';
    // Create a unique ID for the cart item if it has a variant to allow separate entries for different variants
    const cartItemId = variantName ? `${product.id}-${variantName}` : product.id;
    const displayName = `${product.name}${variantSuffix}`;

    // STOCK CHECK BEFORE ADDING
    const currentStock = parseFloat(product.stock || 0);
    if (currentStock <= 0) {
      showToast(`${product.name} is currently unavailable.`, 'error', 3500, null, "Out of Stock");
      return;
    }

    const exists = currentBill.cart.find(i => i.id === cartItemId);

    if (exists) {
      if (exists.quantity + 1 > currentStock) {
        showToast(`Only ${currentStock} units remaining in inventory.`, 'stock', 3500, null, "Stock Limit Reached");
        return;
      }
      updateQuantity(cartItemId, exists.quantity + 1);
      setSelectedItemId(cartItemId);
    } else {
      const cartItem = {
        ...product,
        id: cartItemId, // Override ID for cart tracking
        _dbId: product.id, // PERSIST ORIGINAL DB ID FOR STOCK UPDATES
        name: displayName,
        variantName: variantName, // STORE VARIANT NAME
        sku: variantObj ? (variantObj.barcode || variantObj.sku || product.sku) : product.sku,
        barcode: variantObj ? (variantObj.barcode || variantObj.barcode || product.barcode) : product.barcode,
        quantity: 1, // Will be incremented
        price: variantPrice, // Use variant price if available
        total: variantPrice,
        discount: 0,
        taxRate: product.taxRate || 18,
        unit: product.unit || 'pcs'
      };

      // Min Stock Warning (Optional, but keep logic if stock > 0 but <= min)
      const minStock = parseFloat(product.min_stock || 0);
      if (currentStock <= minStock) {
        // Just a warning, but still allow if stock > 0
        Alert.alert(
          "Low Stock Warning",
          `${product.name} has only ${currentStock} remaining.`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Add", onPress: () => {
                const newItem = { ...cartItem, quantity: 1 };
                updateCurrentBill({ cart: [...currentBill.cart, newItem] });
                setSelectedItemId(cartItemId);
              }
            }
          ]
        );
      } else {
        const newItem = { ...cartItem, quantity: 1 };
        updateCurrentBill({ cart: [...currentBill.cart, newItem] });
        setSelectedItemId(cartItemId);
      }
    }
  }, [currentBill.cart, updateQuantity, updateCurrentBill]);

  const handleAddProduct = (product = null) => {
    if (!product || !product.id) return;

    // 1. Check for multiple products with same name (Siblings)
    const siblings = products.filter(p => p.name.trim().toLowerCase() === product.name.trim().toLowerCase());

    if (siblings.length > 1) {
      // Check if they distinguish by variant or something else
      setSelectedVariantProduct({ ...product, _siblings: siblings, _isSiblingMode: true });
      setShowVariantModal(true);
      return;
    }

    // 2. Check for internal variants array (Legacy/Single Product mode)
    let variants = [];
    try {
      if (typeof product.variants === 'string') {
        variants = JSON.parse(product.variants);
      } else if (Array.isArray(product.variants)) {
        variants = product.variants;
      }
    } catch (e) {
      variants = [];
    }

    if (variants && variants.length > 0) {
      setSelectedVariantProduct({ ...product, _internalVariants: variants, _isSiblingMode: false });
      setShowVariantModal(true);
    } else {
      addItemToCart(product);
    }
  };

  const handleVariantSelect = (selection) => {
    if (selectedVariantProduct?._isSiblingMode) {
      // Selection is a full product object from siblings
      // Use its specific variant field if available, or just add the product as is
      addItemToCart(selection, selection.variant || null);
    } else {
      // Selection is a string from internal variants array
      addItemToCart(selectedVariantProduct, selection);
    }
    setShowVariantModal(false);
    setSelectedVariantProduct(null);
  };

  // Modal Handlers
  const handleApplyItemDiscount = (val, isPercent) => {
    if (!selectedItemId) return;
    const newCart = currentBill.cart.map(item => {
      if (item.id === selectedItemId) {
        const base = item.price * item.quantity;
        const disc = isPercent ? (base * val / 100) : val;
        return { ...item, discount: disc, total: base - disc };
      }
      return item;
    });
    updateCurrentBill({ cart: newCart });
  };

  const handleFunctionClick = (key) => {
    switch (key) {
      case 'F2': // Qty (Focus or simple prompt) -> For demo, let's use it to Add Test Item
        if (products.length === 0) {
          // ADD DUMMY DATA FOR TESTING
          handleAddProduct({
            id: `test-${Date.now()}`,
            name: 'Demo Test Product',
            price: 49.99,
            sku: 'TEST-001',
            taxRate: 18
          });
        } else {
          handleAddProduct();
        }
        break;
      case 'F3':
        if (!selectedItemId) alert("Select an item first");
        else setModals(m => ({ ...m, itemDiscount: true }));
        break;
      case 'F4':
        if (currentBill.cart.length > 0) {
          setModals(m => ({ ...m, clearCartConfirm: true }));
        }
        break;
      case 'F6': // Change Unit
        if (selectedItemId) {
          const newCart = currentBill.cart.map(item => {
            if (item.id === selectedItemId) {
              const currentUnit = item.unit?.toLowerCase() || 'pcs';
              const units = ['pcs', 'kg', 'ltr', 'mtr', 'box', 'pkt'];
              const nextUnit = units[(units.indexOf(currentUnit) + 1) % units.length];
              return { ...item, unit: nextUnit };
            }
            return item;
          });
          updateCurrentBill({ cart: newCart });
        }
        break;
      case 'F7': // Staff Selection
        setModals(m => ({ ...m, receptionistSelection: true }));
        break;
      case 'F8': // Additional Charges
        setModals(m => ({ ...m, additionalCharges: true })); break;
      case 'F9': setModals(m => ({ ...m, billDiscount: true })); break;
      case 'F10': setModals(m => ({ ...m, loyaltyPoints: true })); break;
      case 'F12': setModals(m => ({ ...m, remarks: true })); break;
    }
  };

  const updateInventoryAfterSale = async (cartItems) => {
    console.log('Updating Inventory for', cartItems.length, 'items');
    for (const item of cartItems) {
      // Use preserved productId or fallback to id (if no variant suffix)
      const dbId = item.productId || item.id;

      // Find current stock from context/DB state
      const productInDb = products.find(p => p.id === dbId);

      if (productInDb) {
        const currentStock = parseFloat(productInDb.stock) || 0;
        const soldQty = parseFloat(item.quantity) || 0;
        // Don't go below 0
        const newStock = Math.max(0, currentStock - soldQty);

        console.log(`Updating stock for ${productInDb.name}: ${currentStock} -> ${newStock}`);
        await updateStock(dbId, newStock);
      } else {
        console.warn(`Product not found for stock update: ${dbId}`);
      }
    }
  };
  const handleSaveOnly = async () => {
    if (currentBill.cart.length === 0) {
      alert("Cart is empty!");
      return;
    }

    // Feature: Mandatory Customer Check
    if (!currentBill.customer || !currentBill.customer.phone) {
      showToast("Select or add a customer to save this bill.", 'customer', 5000, {
        label: 'Identify Customer',
        onPress: () => setModals(m => ({ ...m, customerCapture: true }))
      }, "Identification Required");
      return;
    }

    // Feature: Mandatory Receptionist Check
    const activeReceptionists = (settings?.receptionists || []).filter(r =>
      Number(r.is_active) === 1 || r.is_active === true
    );
    if (activeReceptionists.length > 0 && !currentBill.receptionist) {
      setModals(m => ({ ...m, receptionistSelection: true }));
      showToast("Please identify the receptionist for this transaction.", 'receptionist', 3000, null, "Accountability");
      return;
    }

    try {
      const payload = {
        customerId: currentBill.customer ? (currentBill.customer.id || currentBill.customer._id) : '',
        customerName: currentBill.customer ? (currentBill.customer.fullName || currentBill.customer.name) : '',
        date: new Date(),
        items: currentBill.cart
          .filter(item => item.id && item.quantity > 0)
          .map(item => {
            const isInclusive = settings?.tax?.defaultType === 'Inclusive' || settings?.tax?.priceMode === 'Inclusive';
            const price = parseFloat(item.price || item.sellingPrice) || 0;
            const qty = parseFloat(item.quantity) || 0;
            const taxRate = parseFloat(item.taxRate) || 0;
            // Calculate Taxable Value per item
            let taxableValue = price * qty;
            if (isInclusive) {
              taxableValue = (price * qty) / (1 + (taxRate / 100));
            }

            return {
              productId: item._dbId || item.id, // Use original DB ID for stock updates
              variantId: item.id !== (item._dbId || item.id) ? item.id : null,
              variantName: item.variantName || null,
              name: item.name,
              quantity: qty,
              price: price,
              taxableValue: taxableValue, // Explicitly send taxable value
              total: parseFloat(item.total) || 0,
              taxRate: taxRate,
              hsn: item.hsn || '',
              unit: item.unit || ''
            };
          }),
        grossTotal: parseFloat(currentBill.totals.grossTotal) || 0,
        itemDiscount: parseFloat(currentBill.totals.itemDiscount) || 0,
        subtotal: parseFloat(currentBill.totals.subtotal) || 0,
        tax: parseFloat(currentBill.totals.tax) || 0,
        discount: parseFloat(currentBill.totals.discount) || 0,
        additionalCharges: parseFloat(currentBill.totals.additionalCharges) || 0,
        roundOff: parseFloat(currentBill.totals.roundOff) || 0,
        total: parseFloat(currentBill.totals.total) || 0,
        paymentMethod: currentBill.paymentMode || 'Cash',
        status: currentBill.status || 'PAID',
        internalNotes: currentBill.remarks || '',
        amountReceived: parseFloat(currentBill.amountReceived) || 0,
        taxType: currentBill.taxType || 'intra',
        loyaltyPointsRedeemed: currentBill.loyaltyPointsRedeemed || 0,
        loyaltyPointsDiscount: currentBill.loyaltyPointsDiscount || 0,
        loyaltyPointsEarned: currentBill.totals.pointsEarned || 0,
        receptionist_name: currentBill.receptionist?.name || null,
        receptionist_id: currentBill.receptionist?.id || null,
      };

      if (currentBill.originalInvoiceId) {
        payload.id = currentBill.originalInvoiceId;
        await editTransaction(payload);
        showToast("Invoice details have been updated.", "success", 3500, null, "Invoice Updated");
      } else {
        await addTransaction(payload);
        showToast("Invoice has been saved to your records.", "success", 3500, null, "Invoice Saved");
      }

      // Refresh products to update stock
      fetchProducts();
      fetchCustomers();

      closeBill(activeBillId); // Reset/Close on save
    } catch (error) {
      console.error("Save Error:", error);
      showToast("Failed to save bill.", "error");
    }
  };

  const handleSavePrint = async (format = '80mm', copyCount = 1, isAuthorizedBill = false) => {
    if (currentBill.cart.length === 0) {
      showToast("Cart is empty!", "error");
      return;
    }

    if (!currentBill.customer || !currentBill.customer.name || !currentBill.customer.phone) {
      showToast(
        "A valid name and mobile number are required to finalize this invoice.",
        'customer',
        5000,
        {
          label: 'SELECT CUSTOMER',
          onPress: () => setModals(m => ({ ...m, customerCapture: true }))
        },
        "Customer Details Required"
      );
      return;
    }

    // Feature: Mandatory Receptionist Check
    const activeReceptionists = (settings?.receptionists || []).filter(r =>
      Number(r.is_active) === 1 || r.is_active === true
    );
    if (activeReceptionists.length > 0 && !currentBill.receptionist) {
      setModals(m => ({ ...m, receptionistSelection: true }));
      showToast("Please identify the receptionist for this transaction.", 'receptionist', 3000, null, "Accountability");
      return;
    }

    try {
      setIsProcessing(true);
      const payload = {
        customerId: currentBill.customer ? (currentBill.customer.id || currentBill.customer._id) : '',
        customerName: currentBill.customer ? (currentBill.customer.fullName || currentBill.customer.name) : '',
        date: new Date(),
        items: currentBill.cart
          .filter(item => item.id && item.quantity > 0)
          .map(item => {
            const isInclusive = settings?.tax?.defaultType === 'Inclusive' || settings?.tax?.priceMode === 'Inclusive';
            const price = parseFloat(item.price || item.sellingPrice) || 0;
            const qty = parseFloat(item.quantity) || 0;
            const taxRate = parseFloat(item.taxRate) || 0;
            let taxableValue = price * qty;
            if (isInclusive) {
              taxableValue = (price * qty) / (1 + (taxRate / 100));
            }

            return {
              productId: item._dbId || item.id,
              variantId: item.id !== (item._dbId || item.id) ? item.id : null,
              variantName: item.variantName || null,
              name: item.name,
              quantity: qty,
              price: price,
              taxableValue: taxableValue,
              total: parseFloat(item.total) || 0,
              taxRate: taxRate,
              hsn: item.hsn || '',
              unit: item.unit || ''
            };
          }),
        grossTotal: parseFloat(currentBill.totals.grossTotal) || 0,
        itemDiscount: parseFloat(currentBill.totals.itemDiscount) || 0,
        subtotal: parseFloat(currentBill.totals.subtotal) || 0,
        tax: parseFloat(currentBill.totals.tax) || 0,
        discount: parseFloat(currentBill.totals.discount) || 0,
        additionalCharges: parseFloat(currentBill.totals.additionalCharges) || 0,
        roundOff: parseFloat(currentBill.totals.roundOff) || 0,
        total: parseFloat(currentBill.totals.total) || 0,
        paymentMethod: currentBill.paymentMode || 'Cash',
        status: (() => {
          const total = parseFloat(currentBill.totals.total) || 0;
          const received = parseFloat(currentBill.amountReceived) || 0;
          if (received <= 0) return 'Unpaid';
          if (received < total) return 'Partially Paid';
          return 'Paid';
        })(),
        internalNotes: currentBill.remarks || '',
        amountReceived: parseFloat(currentBill.amountReceived) || 0,
        taxType: currentBill.taxType || 'intra',
        loyaltyPointsRedeemed: currentBill.loyaltyPointsRedeemed || 0,
        loyaltyPointsDiscount: currentBill.loyaltyPointsDiscount || 0,
        loyaltyPointsEarned: currentBill.totals.pointsEarned || 0,
        receptionist_name: currentBill.receptionist?.name || null,
        receptionist_id: currentBill.receptionist?.id || null,
      };

      let savedBill;
      if (currentBill.originalInvoiceId) {
        payload.id = currentBill.originalInvoiceId;
        savedBill = await editTransaction(payload);
      } else {
        savedBill = await addTransaction(payload);
      }

      if (!savedBill) throw new Error("Failed to save transaction.");

      const billDataToPrint = {
        ...savedBill,
        customer: currentBill.customer
      };

      const thermalFormat = settings?.invoice?.billPaperSize || '80mm';

      for (let i = 0; i < copyCount; i++) {
        try {
          await printReceipt(billDataToPrint, thermalFormat, settings, 'customer');
        } catch (printErr) {
          showToast(
            printErr?.message || "Automatic printing failed. You can retry from the bill history.",
            "printer",
            7000,
            null,
            "Printing Failed",
            require('../../../assets/animations/PrinterError.gif')
          );
        }
        if (i < copyCount - 1 || isAuthorizedBill) {
          await new Promise(r => setTimeout(r, 800));
        }
      }

      if (isAuthorizedBill) {
        try {
          await printReceipt(billDataToPrint, thermalFormat, settings, 'customer', { forceAuthorized: true });
        } catch (printErr) {
          showToast(
            printErr?.message || "Automatic printing of authorized copy failed. You can retry from the bill history.",
            "printer",
            7000,
            null,
            "Printing Failed",
            require('../../../assets/animations/PrinterError.gif')
          );
        }
        await new Promise(r => setTimeout(r, 500));
      }

      showToast("Invoice finalized and printed.", "success", 4000, null, "Invoice Completed");
      fetchProducts();
      fetchCustomers();
      closeBill(activeBillId);

    } catch (error) {
      console.error("Billing Flow Error:", error);
      Alert.alert("Billing Error", error?.message || "Failed to complete the billing process.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintCustomerBill = async (format = '80mm') => {
    if (currentBill.cart.length === 0) {
      alert("Cart is empty!");
      return;
    }
    // This just prints the B&W preview/bill for the customer without closing the tab
    const thermalFormat = settings?.invoice?.billPaperSize || '80mm';
    try {
      await printReceipt(currentBill, thermalFormat, settings, 'customer');
    } catch (error) {
      showToast(
        error?.message || "Unable to communicate with the printer. Check power and connection.",
        "printer",
        6000,
        {
          label: 'SETTINGS',
          onPress: () => navigation.navigate('Settings', { tab: 'print' })
        },
        "Printer Error",
        require('../../../assets/animations/PrinterError.gif')
      );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {isProcessing && (
          <View style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.7)',
            zIndex: 9999,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 40
          }}>
            <View style={{ backgroundColor: '#fff', padding: 30, borderRadius: 24, alignItems: 'center', width: '100%', maxWidth: 300 }}>
              <ActivityIndicator size="large" color="#000" />
              <Text style={{ marginTop: 20, fontSize: 18, fontWeight: '900', color: '#000', textAlign: 'center' }}>FINALIZING INVOICE</Text>
              <Text style={{ marginTop: 8, fontSize: 13, color: '#64748b', textAlign: 'center', fontWeight: '600' }}>Please wait while we save and print your bill...</Text>
            </View>
          </View>
        )}


        {/* Premium Header */}
        <LinearGradient
          colors={['#000000', '#1a1a1a']}
          style={[styles.headerGradient, isScannerOpen && { paddingBottom: 0 }]}
        >
          <SafeAreaView edges={['top']}>
            {isScannerOpen ? (
              <View style={{ height: 180, backgroundColor: '#000', overflow: 'hidden', borderBottomLeftRadius: 40, borderBottomRightRadius: 40 }}>
                <ScanBarcodeModal
                  visible={true}
                  isInline={true}
                  paused={isAnyModalVisible}
                  onClose={() => {
                    setIsScannerOpen(false);
                    updateSettings('app', { isScannerActive: false });
                  }}
                  onScanned={(cartPayload, variant) => {
                    if (variant) {
                      addItemToCart(cartPayload, variant);
                    } else {
                      handleAddProduct(cartPayload);
                    }
                    // showToast(`Scanned: ${cartPayload.name}`, 'success'); // Removed redundant toast

                    // Note: We no longer auto-close the scanner when hasVariants is true.
                    // The 'paused' prop handles disabling the scanner if a modal appears.
                  }}
                />
              </View>
            ) : (
              <>
                <View style={styles.topBar}>
                  <View>
                    <Text style={styles.headerTitle}>Billing Section</Text>
                    <Text style={styles.headerSubtitle}>{activeBills.length} Active Sessions</Text>
                  </View>
                  <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.headerIconBtn} onPress={() => { setIsScannerOpen(true); updateSettings('app', { isScannerActive: true }); }}>
                      <Scan size={20} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.headerIconBtn, { backgroundColor: '#22c55e' }]} onPress={addNewBill}>
                      <Plus size={22} color="#000" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Functional Tabs */}
                <View style={styles.tabsContainer}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                    {activeBills.map((bill) => (
                      <TouchableOpacity
                        key={bill.id}
                        style={[styles.tabItem, bill.id === activeBillId && styles.activeTabItem, { flexDirection: 'row', gap: 8 }]}
                        onPress={() => setActiveBillId(bill.id)}
                      >
                        <Text style={[styles.tabItemText, bill.id === activeBillId && styles.activeTabItemText]}>
                          Bill #{bill.id}
                        </Text>

                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            closeBill(bill.id);
                          }}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          style={{
                            backgroundColor: bill.id === activeBillId ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)',
                            borderRadius: 10,
                            padding: 2
                          }}
                        >
                          <X size={14} color={bill.id === activeBillId ? "#fff" : "rgba(255,255,255,0.5)"} />
                        </TouchableOpacity>

                        {bill.id === activeBillId && <View style={styles.activeIndicator} />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <TouchableOpacity
                    style={styles.billHistoryBtn}
                    onPress={() => setShowBillSelector(!showBillSelector)}
                  >
                    <ChevronDown size={20} color="rgba(255,255,255,0.6)" />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </SafeAreaView>

          <ReceptionistSelectionModal
            visible={modals.receptionistSelection}
            onClose={() => setModals(m => ({ ...m, receptionistSelection: false }))}
            onSelect={(recep) => {
              updateCurrentBill({ receptionist: recep });
              setModals(m => ({ ...m, receptionistSelection: false }));
            }}
            selectedId={currentBill.receptionist?.id}
          />
        </LinearGradient>

        {/* Mode Switcher (Floating) */}
        <View style={styles.modeSwitcher}>
          <TouchableOpacity
            style={[styles.modeBtn, viewMode === 'grid' && styles.activeModeBtn]}
            onPress={() => {

              setViewMode('grid');
            }}
          >
            <Text style={[styles.modeBtnText, viewMode === 'grid' && styles.activeModeBtnText]}>ITEMS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, viewMode === 'sidebar' && styles.activeModeBtn]}
            onPress={() => {

              setViewMode('sidebar');
            }}
          >
            <Text style={[styles.modeBtnText, viewMode === 'sidebar' && styles.activeModeBtnText]}>PAYMENT</Text>
          </TouchableOpacity>
        </View>

        {/* Bill Selector Dropdown */}
        {showBillSelector && (
          <View style={styles.billSelectorOverlay}>
            <TouchableOpacity
              style={styles.overlayClose}
              onPress={() => setShowBillSelector(false)}
            />
            <View style={styles.billDropdown}>
              <Text style={styles.dropdownHeader}>ACTIVE BILLS</Text>
              <ScrollView style={{ maxHeight: 300 }}>
                {activeBills.map((bill) => (
                  <TouchableOpacity
                    key={bill.id}
                    style={[styles.dropdownItem, bill.id === activeBillId && styles.activeDropdownItem]}
                    onPress={() => { setActiveBillId(bill.id); setShowBillSelector(false); }}
                  >
                    <View>
                      <Text style={[styles.dropdownTitle, bill.id === activeBillId && styles.activeDropdownTitle]}>Bill #{bill.id}</Text>
                      {bill.customer && <Text style={styles.dropdownSubtitle}>{bill.customer.name}</Text>}
                    </View>
                    <View style={styles.dropdownRight}>
                      <Text style={styles.dropdownTotal}>₹{bill.totals.total}</Text>
                      {activeBills.length > 1 && (
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); closeBill(bill.id); }} style={styles.closeBtnSmall}>
                          <X size={14} color="#ef4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.addNewBillCallout} onPress={() => { addNewBill(); setShowBillSelector(false); }}>
                <Plus size={16} color="#22c55e" />
                <Text style={styles.addNewText}>Start New Billing Session</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Main Content Area */}
        <View style={styles.content}>
          {viewMode === 'grid' ? (
            <BillingGrid
              products={products}
              cart={currentBill.cart}
              updateQuantity={updateQuantity}
              updatePrice={updatePrice}
              removeItem={removeItem}
              selectedItemId={selectedItemId}
              onRowClick={setSelectedItemId}
              onDiscountClick={(id) => { setSelectedItemId(id); setModals(m => ({ ...m, itemDiscount: true })); }}
              onAddQuickItem={handleAddProduct}
              onScanClick={() => {
                setIsScannerOpen(true);
                updateSettings('app', { isScannerActive: true });
              }}
              additionalCharges={currentBill.additionalCharges || 0}
              loyaltyDiscount={currentBill.loyaltyPointsDiscount || 0}
              remarks={currentBill.remarks || ''}
              onChargesClick={() => setModals(m => ({ ...m, additionalCharges: true }))}
              onLoyaltyClick={() => setModals(m => ({ ...m, loyaltyPoints: true }))}
              onRemarksClick={() => setModals(m => ({ ...m, remarks: true }))}
              onFunctionClick={handleFunctionClick}
              billDiscount={currentBill.billDiscount || 0}
              onRemoveAdjustment={handleRemoveAdjustment}
              onRemoveItemDiscount={(id) => {
                const newCart = currentBill.cart.map(item => item.id === id ? { ...item, discount: 0, total: item.price * item.quantity } : item);
                updateCurrentBill({ cart: newCart });
              }}
            />
          ) : (
            <BillingSidebar
              items={currentBill.cart}
              settings={settings}
              billId={currentBill.id}
              customer={currentBill.customer}
              onCustomerSearch={(val) => val === 'search' ? setModals(m => ({ ...m, customerCapture: true })) : updateCurrentBill({ customer: null })}
              onHelpConnect={() => navigation.navigate('Settings', { tab: 'print' })}
              totals={currentBill.totals}
              paymentMode={currentBill.paymentMode}
              paymentStatus={currentBill.status}
              amountReceived={currentBill.amountReceived}
              paymentReference={currentBill.paymentReference}
              taxType={currentBill.taxType || 'intra'}
              onTaxTypeChange={(val) => updateCurrentBill({ taxType: val })}
              onPaymentChange={(field, val) => {
                if (field === 'mode') updateCurrentBill({ paymentMode: val });
                if (field === 'amount') {
                  const received = parseFloat(val) || 0;
                  const total = parseFloat(currentBill.totals.total) || 0;
                  let newStatus = 'Paid';
                  if (received <= 0) newStatus = 'Unpaid';
                  else if (received < total) newStatus = 'Partially Paid';

                  updateCurrentBill({ amountReceived: val, status: newStatus });
                }
                if (field === 'status') {
                  const received = parseFloat(currentBill.amountReceived) || 0;
                  if (val !== 'Unpaid' && received <= 0) {
                    showToast("Please enter the amount received first.", 'error', 3000, null, "PAYMENT ACTION REQUIRED");
                    return;
                  }
                  updateCurrentBill({ status: val });
                }
                if (field === 'reference') updateCurrentBill({ paymentReference: val });
              }}
              onSavePrint={handleSavePrint}
              isPrinterConnected={isPrinterConnected}
              onConnectPrinter={handleConnectPrinter}
              remarks={currentBill.remarks || ''}
              onLoyaltyClick={() => setModals(m => ({ ...m, loyaltyPoints: true }))}
              loyaltyPointsRedeemed={currentBill.loyaltyPointsRedeemed || 0}
              receptionist={currentBill.receptionist}
              isReceptionistLocked={!!lockedStaff}
              onReceptionistClick={() => setModals(m => ({ ...m, receptionistSelection: true }))}
              onClearReceptionistLock={() => saveStaffSession(null)}
            />
          )}
        </View>

        {/* Modals */}
        <DiscountModal
          isOpen={modals.itemDiscount}
          onClose={() => setModals(m => ({ ...m, itemDiscount: false }))}
          onApply={handleApplyItemDiscount}
          title="Item Discount"
        />
        <DiscountModal
          isOpen={modals.billDiscount}
          onClose={() => setModals(m => ({ ...m, billDiscount: false }))}
          onApply={(val, isP) => updateCurrentBill({ billDiscount: isP ? (currentBill.totals.subtotal * val / 100) : val })}
          title="Bill Discount"
        />
        <AdditionalChargesModal
          isOpen={modals.additionalCharges}
          onClose={() => setModals(m => ({ ...m, additionalCharges: false }))}
          onApply={(val) => updateCurrentBill({ additionalCharges: val })}
        />
        <LoyaltyPointsModal
          isOpen={modals.loyaltyPoints}
          onClose={() => setModals(m => ({ ...m, loyaltyPoints: false }))}
          onApply={(discount, redeemedPoints) => updateCurrentBill({ loyaltyPointsDiscount: discount, loyaltyPointsRedeemed: redeemedPoints })}
          availablePoints={currentBill.customer?.loyaltyPoints || 0}
          subtotal={currentBill.totals.originalSubtotal || currentBill.totals.subtotal}
        />
        <RemarksModal
          isOpen={modals.remarks}
          onClose={() => setModals(m => ({ ...m, remarks: false }))}
          onSave={(val) => updateCurrentBill({ remarks: val })}
          initialValue={currentBill.remarks}
        />
        <CustomerCaptureModal
          isOpen={modals.customerCapture}
          onClose={() => setModals(m => ({ ...m, customerCapture: false }))}
          initialValue={customerSearchValue}
          onSelect={(cust) => {
            updateCurrentBill({ customer: cust });
          }}
        />

        <ReceptionistSelectionModal
          visible={modals.receptionistSelection}
          onClose={() => setModals(m => ({ ...m, receptionistSelection: false }))}
          onSelect={(staff, mode) => {
            updateCurrentBill({ receptionist: staff });
            if (mode) saveStaffSession(staff, mode);
            setModals(m => ({ ...m, receptionistSelection: false }));
          }}
          selectedId={currentBill.receptionist?.id}
        />



        {/* Variant Selection Modal */}
        {
          showVariantModal && selectedVariantProduct && (
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {selectedVariantProduct._isSiblingMode ? 'Select Variation' : 'Select Variant'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowVariantModal(false)}
                    style={styles.modalCloseBtn}
                  >
                    <X size={20} color="#000" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.productName}>{selectedVariantProduct.name}</Text>
                <View style={styles.variantGrid}>
                  {selectedVariantProduct._isSiblingMode ? (
                    // Render Siblings
                    selectedVariantProduct._siblings.map((sibling, index) => (
                      <TouchableOpacity
                        key={sibling.id || index}
                        style={styles.variantBtn}
                        onPress={() => handleVariantSelect(sibling)}
                      >
                        <Text style={styles.variantBtnText}>
                          {
                            sibling.variant
                              ? sibling.variant
                              : (() => {
                                // Fallback: Try to get from variants array if strictly one exists or just take first
                                try {
                                  const v = typeof sibling.variants === 'string' ? JSON.parse(sibling.variants) : sibling.variants;
                                  if (Array.isArray(v) && v.length > 0) {
                                    const firstV = v[0];
                                    return typeof firstV === 'object' ? (firstV.name || (firstV.options && firstV.options[0])) : firstV;
                                  }
                                } catch (e) { }
                                // Fallback to Price
                                return `Price: ₹${sibling.price || sibling.sellingPrice || 'N/A'}`;
                              })()
                          }
                        </Text>
                      </TouchableOpacity>
                    ))
                  ) : (
                    // Render Internal Variants
                    (selectedVariantProduct._internalVariants || []).map((variant, index) => {
                      const vName = typeof variant === 'object' ? (variant.name || (variant.options && variant.options[0]) || `Variant ${index + 1}`) : variant;
                      const vPrice = typeof variant === 'object' && variant.price ? ` (₹${variant.price})` : '';
                      return (
                        <TouchableOpacity
                          key={index}
                          style={styles.variantBtn}
                          onPress={() => handleVariantSelect(variant)}
                        >
                          <Text style={styles.variantBtnText}>{vName}{vPrice}</Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              </View>
            </View>
          )
        }

        <ConfirmationModal
          isOpen={modals.clearCartConfirm}
          onClose={() => setModals(m => ({ ...m, clearCartConfirm: false }))}
          onConfirm={() => {
            updateCurrentBill({ cart: [] });
            showToast("Cart Cleared", "info");
          }}
          title="Clear Cart"
          message="Are you sure you want to remove all items from the cart? This cannot be undone."
          variant="danger"
          confirmLabel="CLEAR ALL"
        />

        {/* Stock Limit Modal - Black & White Design */}
        {modals.stockLimit && (
          <View style={styles.stockLimitOverlay}>
            <View style={styles.stockLimitModal}>
              <View style={styles.stockLimitHeader}>
                <Text style={styles.stockLimitTitle}>Stock Limit</Text>
              </View>
              <View style={styles.stockLimitBody}>
                <Text style={styles.stockLimitMessage}>{stockLimitMessage}</Text>
              </View>
              <TouchableOpacity
                style={styles.stockLimitButton}
                onPress={() => setModals(m => ({ ...m, stockLimit: false }))}
              >
                <Text style={styles.stockLimitButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  // Header & Gradient
  headerGradient: {
    paddingTop: 0,
    paddingBottom: 25,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 15,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 10,
    marginBottom: 25,
  },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '700', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 12 },
  headerIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },

  // Premium Tabs
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabItem: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeTabItem: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  tabItemText: { fontSize: 15, fontWeight: '800', color: 'rgba(255,255,255,0.5)' },
  activeTabItemText: { color: '#fff' },
  activeIndicator: {
    position: 'absolute',
    bottom: -6,
    width: 20,
    height: 3,
    backgroundColor: '#fff',
    borderRadius: 2
  },
  billHistoryBtn: {
    padding: 12,
    marginRight: 15,
  },

  // Floating Mode Switcher
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 40,
    marginTop: -22,
    borderRadius: 20,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 10,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 15,
  },
  activeModeBtn: {
    backgroundColor: '#000',
  },
  modeBtnText: { fontSize: 12, fontWeight: '900', color: '#94a3b8', letterSpacing: 1 },
  activeModeBtnText: { color: '#fff' },

  // Content Area
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 4 },

  // Bill Selector Dropdown
  billSelectorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  overlayClose: { ...StyleSheet.absoluteFillObject },
  billDropdown: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  dropdownHeader: { fontSize: 11, fontWeight: '900', color: '#94a3b8', marginBottom: 15, letterSpacing: 1.5 },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
  },
  activeDropdownItem: {
    borderColor: '#000',
    backgroundColor: '#f8fafc',
  },
  dropdownTitle: { fontSize: 16, fontWeight: '800', color: '#475569' },
  activeDropdownTitle: { color: '#000' },
  dropdownSubtitle: { fontSize: 12, color: '#94a3b8', fontWeight: '600', marginTop: 2 },
  dropdownRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dropdownTotal: { fontSize: 15, fontWeight: '900', color: '#0f172a' },
  closeBtnSmall: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  addNewBillCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  addNewText: { color: '#16a34a', fontWeight: '800', fontSize: 14 },

  // Keep functionality for legacy styles used in Child components if needed
  viewSwitch: { padding: 10, borderRadius: 10, backgroundColor: '#f1f5f9' },
  viewSwitchText: { fontWeight: 'bold' },

  // Modal Styles (Preserved but slightly cleaned up)
  modalOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '80%', maxHeight: '60%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  productName: { fontSize: 14, color: '#64748b', marginBottom: 16 },
  variantGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  variantBtn: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#f1f5f9', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  variantBtnText: { fontSize: 14, fontWeight: '600', color: '#334155' },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  // Stock Limit Modal - Black & White Design
  stockLimitOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  stockLimitModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '85%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  stockLimitHeader: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  stockLimitTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.5,
  },
  stockLimitBody: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  stockLimitMessage: {
    fontSize: 16,
    fontWeight: '500',
    color: '#334155',
    lineHeight: 24,
  },
  stockLimitButton: {
    backgroundColor: '#000000',
    marginHorizontal: 24,
    marginBottom: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  stockLimitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
