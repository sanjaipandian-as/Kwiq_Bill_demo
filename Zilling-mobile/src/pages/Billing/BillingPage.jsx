import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, StatusBar, ScrollView, LayoutAnimation, UIManager } from 'react-native';
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

// Components
import BillingGrid from './components/BillingGrid';
import BillingSidebar from './components/BillingSidebar';
import BottomFunctionBar from './components/BottomFunctionBar';
import { DiscountModal, RemarksModal, AdditionalChargesModal, LoyaltyPointsModal } from './components/ActionModals';
import CustomerSearchModal from './components/CustomerSearchModal';
import CustomerCaptureModal from './components/CustomerCaptureModal';



// Wizard Steps (Optional/Mobile Flow)
import ProductStep from './components/steps/ProductStep';
import CustomerStep from './components/steps/CustomerStep';
import PaymentStep from './components/steps/PaymentStep';
import SummaryStep from './components/steps/SummaryStep';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function BillingPage({ navigation, route }) {
  const { addTransaction, editTransaction } = useTransactions();
  const { products, fetchProducts, updateStock } = useProducts();
  const { fetchCustomers } = useCustomers();
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
    try {
      const printer = await Print.selectPrinterAsync();
      if (printer) {
        updateSettings('invoice', { selectedPrinter: printer });
        showToast(`Printer Connected: ${printer.name || 'Selected'}`, 'success');
      }
    } catch (e) {
      console.error("Printer Selection Error:", e);
      Alert.alert("Printer Error", "Failed to select printer.");
    }
  };

  // Refresh data on focus
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('dark-content');
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor('#ffffff');
      }
      fetchProducts();
      processBillingQueue();
    }, [activeBillId])
  );

  useEffect(() => {
    fetchCustomers();
  }, []);

  // --- State: Tab Management ---
  const [activeBills, setActiveBills] = useState([
    {
      id: 1,
      customer: null,
      cart: [],
      totals: { grossTotal: 0, itemDiscount: 0, subtotal: 0, tax: 0, discount: 0, additionalCharges: 0, roundOff: 0, total: 0, pointsEarned: 0 },
      paymentMode: 'Cash',
      amountReceived: '',
      remarks: '',
      billDiscount: 0,
      additionalCharges: 0,
      loyaltyPointsDiscount: 0,
      loyaltyPointsRedeemed: 0,
      status: 'Paid',
      taxType: settings?.tax?.defaultTaxType || 'intra'
    }
  ]);
  const [activeBillId, setActiveBillId] = useState(1);
  const [selectedItemId, setSelectedItemId] = useState(null);


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

    customerSearch: false,
    customerCapture: false
  });

  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'sidebar' (on mobile)
  const [customerSearchValue, setCustomerSearchValue] = useState('');
  const [showBillSelector, setShowBillSelector] = useState(false);

  // Helper: Get Current Bill
  const currentBill = useMemo(() => activeBills.find(b => b.id === activeBillId) || activeBills[0], [activeBills, activeBillId]);

  // Helper: Update Current Bill
  const updateCurrentBill = (updates) => {
    setActiveBills(prev => prev.map(bill =>
      bill.id === activeBillId ? { ...bill, ...updates } : bill
    ));
  };

  // --- Process Billing Queue (from Barcode Scanner) ---
  const processBillingQueue = async () => {
    const queue = await getBillingQueue();
    if (queue && queue.length > 0) {
      console.log('[BillingPage] Processing queue:', queue.length);
      console.log('Force Refresh BillingPage'); // Debug to ensure clean reload
      // We need to add items sequentially or effectively
      // Since addItemToCart relies on current scope variables (activeBills, activeBillId), 
      // we need to be careful. However, we have access to them here.
      // But `currentBill` is a derived value from `activeBills`. 
      // We should use setActiveBills with functional update to ensure latest state if we loop.

      // Better approach: calculate new cart from current state + queue

      setActiveBills(prevBills => {
        const targetBillId = activeBillId; // Capture current ID
        return prevBills.map(bill => {
          if (bill.id === targetBillId) {
            let newCart = [...bill.cart];

            queue.forEach(product => {
              // Logic from addItemToCart, simplified for bulk
              const cartItemId = product.id;
              // Check if exists
              const existingIndex = newCart.findIndex(i => i.id === cartItemId);

              if (existingIndex >= 0) {
                const existing = newCart[existingIndex];
                const newQty = (existing.quantity || 0) + 1;
                newCart[existingIndex] = {
                  ...existing,
                  quantity: newQty,
                  total: newQty * (existing.price || 0) - (existing.discount || 0)
                };
              } else {
                newCart.push({
                  ...product,
                  id: cartItemId,
                  name: product.name,
                  quantity: 1,
                  total: parseFloat(product.price || product.sellingPrice || 0),
                  discount: 0,
                  taxRate: product.taxRate || 18,
                  unit: product.unit || 'pcs'
                });
              }
            });
            return { ...bill, cart: newCart };
          }
          return bill;
        });
      });

      await clearBillingQueue();
      showToast(`${queue.length} items added from scanner`, 'success');
    }
  };

  // Helper: Calculation Logic (Robust Port from User Snippet)
  const calculateTotals = (cart, billDiscount = 0, additionalCharges = 0, loyaltyPointsDiscount = 0, taxType = 'intra') => {
    let aggGross = 0; // Pre-discount total
    let aggItemDisc = 0; // Total of per-item discounts
    let aggSubtotal = 0; // Taxable Value before bill-level discounts

    const isInclusive = settings?.tax?.defaultType === 'Inclusive' || settings?.tax?.priceMode === 'Inclusive';

    cart.forEach(item => {
      const price = parseFloat(item.price || item.sellingPrice || 0);
      const qty = parseFloat(item.quantity || 0);
      const discount = parseFloat(item.discount || 0);

      aggGross += (price * qty);
      aggItemDisc += discount;

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
      pointsEarned: pointsEarned
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
        status: invoiceToEdit.status || 'Paid',
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
      totals: { grossTotal: 0, itemDiscount: 0, subtotal: 0, tax: 0, discount: 0, additionalCharges: 0, roundOff: 0, total: 0, pointsEarned: 0 },
      paymentMode: 'Cash',
      amountReceived: '',
      remarks: '',
      billDiscount: 0,
      additionalCharges: 0,
      loyaltyPointsDiscount: 0,
      loyaltyPointsRedeemed: 0,
      status: 'Paid',
      taxType: settings?.tax?.defaultTaxType || 'intra'
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
      totals: { grossTotal: 0, itemDiscount: 0, subtotal: 0, tax: 0, discount: 0, additionalCharges: 0, roundOff: 0, total: 0, pointsEarned: 0 },
      paymentMode: 'Cash',
      amountReceived: '',
      remarks: '',
      billDiscount: 0,
      additionalCharges: 0,
      loyaltyPointsDiscount: 0,
      loyaltyPointsRedeemed: 0,
      status: 'Paid',
      originalInvoiceId: null
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
  const updateQuantity = (id, newQty) => {
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
        Alert.alert("Stock Limit", `Stock quantity only ${availableStock}. You can't add above this.`);
        return;
      }
    }

    const newCart = currentBill.cart.map(i => i.id === id ? { ...i, quantity: sNewQty, total: sNewQty * i.price - (i.discount || 0) } : i);
    updateCurrentBill({ cart: newCart });
  };

  const removeItem = (id) => {
    const newCart = currentBill.cart.filter(item => item.id !== id);
    updateCurrentBill({ cart: newCart });
    if (selectedItemId === id) setSelectedItemId(null);
  };

  // Add dummy item for testing (Real app would use Search Bar or Barcode)
  // We'll hook this up to a "Demo Add" or rely on a search bar in the Header in future
  // For now, let's auto-add if cart is empty just to see UI? No, empty state is fine. 
  // Wait, the grid needs items. I should expose a way to add items. 
  // I'll add a "FAB" or Search button in the BillingPage header or use the SearchModal logic.

  // Actually, `activeBill` needs to be able to add products. 
  // I'll hijack the "F2" to add a random product for testing if no specific search UI exists yet.
  // Or better, I'll add a temporary "Add Test Item" button in the header.

  const addItemToCart = (product, variant = null) => {
    // If variant is an object (new structure), extract name and price
    const variantObj = (variant && typeof variant === 'object') ? variant : null;
    const variantName = variantObj ? (variantObj.name || (variantObj.options && variantObj.options[0])) : (typeof variant === 'string' ? variant : null);
    const variantPrice = variantObj && variantObj.price !== null && variantObj.price !== undefined ? parseFloat(variantObj.price) : parseFloat(product.price || product.sellingPrice || 0);

    const variantSuffix = variantName ? ` - ${variantName}` : '';
    // Create a unique ID for the cart item if it has a variant to allow separate entries for different variants
    const cartItemId = variantName ? `${product.id}-${variantName}` : product.id;
    const displayName = `${product.name}${variantSuffix}`;

    // STOCK CHECK BEFORE ADDING
    const currentStock = parseFloat(product.stock || 0);
    if (currentStock <= 0) {
      Alert.alert("Stock Limit", "Stock is empty! Cannot add this item.");
      return;
    }

    const exists = currentBill.cart.find(i => i.id === cartItemId);

    if (exists) {
      if (exists.quantity + 1 > currentStock) {
        Alert.alert("Stock Limit", `Stock quantity only ${currentStock}. You can't add above this.`);
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
  };

  const handleAddProduct = (product = null) => {
    if (!product) return;

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
          Alert.alert(
            "Clear Cart",
            "Are you sure you want to remove all items from the cart?",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Clear All", style: "destructive", onPress: () => updateCurrentBill({ cart: [] }) }
            ]
          );
        }
        break;
      case 'F6': // Change Unit
        if (selectedItemId) {
          const newCart = currentBill.cart.map(item => {
            if (item.id === selectedItemId) {
              const currentUnit = item.unit?.toLowerCase() || 'pcs';
              const newUnit = currentUnit === 'pcs' ? 'box' : 'pcs';
              return { ...item, unit: newUnit };
            }
            return item;
          });
          updateCurrentBill({ cart: newCart });
        }
        break;
      case 'F8': setModals(m => ({ ...m, additionalCharges: true })); break;
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
      setModals(m => ({ ...m, customerCapture: true }));
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
        status: currentBill.status || 'Paid',
        internalNotes: currentBill.remarks || '',
        amountReceived: parseFloat(currentBill.amountReceived) || 0,
        taxType: currentBill.taxType || 'intra',
        loyaltyPointsRedeemed: currentBill.loyaltyPointsRedeemed || 0,
        loyaltyPointsDiscount: currentBill.loyaltyPointsDiscount || 0,
        loyaltyPointsEarned: currentBill.totals.pointsEarned || 0,
      };

      if (currentBill.originalInvoiceId) {
        payload.id = currentBill.originalInvoiceId;
        savedBill = await editTransaction(payload);
        showToast("Invoice Updated Successfully", "success");
      } else {
        savedBill = await addTransaction(payload);
        showToast("Invoice Saved Successfully", "success");
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

  const handleSavePrint = async (format = '80mm') => {
    if (currentBill.cart.length === 0) {
      showToast("Cart is empty!", "error");
      return;
    }

    // Feature: Mandatory Customer Check
    if (!currentBill.customer || !currentBill.customer.phone) {
      setModals(m => ({ ...m, customerCapture: true }));
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
              productId: item._dbId || item.id,
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
      };

      // 1. Save Transaction (Drive Sync happens inside TransactionContext)
      let savedBill;
      if (currentBill.originalInvoiceId) {
        payload.id = currentBill.originalInvoiceId;
        savedBill = await editTransaction(payload);
      } else {
        savedBill = await addTransaction(payload);
      }

      // 2. Action: Immediate Bill (Thermal Layout)
      // We use 'customer' mode for the 3-inch/thermal bill style
      await printReceipt(savedBill, format, settings, 'customer');

      // 3. Action: Show Formal Invoice Preview (A4/Template Style)
      // This fulfills "show preview of the invoice" with the backend-selected template.
      // We force 'A4' or 'A5' based on template settings, and mode 'invoice'
      const invoiceFormat = settings?.invoice?.paperSize === '58mm' || settings?.invoice?.paperSize === '80mm' ? 'A4' : (settings?.invoice?.paperSize || 'A4');
      await printReceipt(savedBill, invoiceFormat, settings, 'invoice');



      showToast("Invoice Finalized Successfully", "success");
      fetchProducts();
      fetchCustomers();
      closeBill(activeBillId);

    } catch (error) {
      console.error("Billing Flow Error:", error);
      Alert.alert("Error", "Failed to complete the billing process.");
    }
  };

  const handlePrintCustomerBill = async (format = '80mm') => {
    if (currentBill.cart.length === 0) {
      alert("Cart is empty!");
      return;
    }
    // This just prints the B&W preview/bill for the customer without closing the tab
    await printReceipt(currentBill, format, settings, 'customer');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        {/* Premium Header */}
        <LinearGradient
          colors={['#000000', '#1a1a1a']}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={['top']}>
            <View style={styles.topBar}>
              <View>
                <Text style={styles.headerTitle}>Billing</Text>
                <Text style={styles.headerSubtitle}>{activeBills.length} Active Sessions</Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.headerIconBtn} onPress={() => setIsScannerOpen(true)}>
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
          </SafeAreaView>
        </LinearGradient>

        {/* Mode Switcher (Floating) */}
        <View style={styles.modeSwitcher}>
          <TouchableOpacity
            style={[styles.modeBtn, viewMode === 'grid' && styles.activeModeBtn]}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setViewMode('grid');
            }}
          >
            <Text style={[styles.modeBtnText, viewMode === 'grid' && styles.activeModeBtnText]}>ITEMS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, viewMode === 'sidebar' && styles.activeModeBtn]}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
              removeItem={removeItem}
              selectedItemId={selectedItemId}
              onRowClick={setSelectedItemId}
              onDiscountClick={(id) => { setSelectedItemId(id); setModals(m => ({ ...m, itemDiscount: true })); }}
              onAddQuickItem={handleAddProduct}
              onScanClick={() => setIsScannerOpen(true)}
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
              onCustomerSearch={(val) => val === 'search' ? setModals(m => ({ ...m, customerSearch: true })) : updateCurrentBill({ customer: null })}
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
                if (field === 'status') updateCurrentBill({ status: val });
                if (field === 'reference') updateCurrentBill({ paymentReference: val });
              }}
              onSavePrint={handleSavePrint}
              isPrinterConnected={isPrinterConnected}
              onConnectPrinter={handleConnectPrinter}
              remarks={currentBill.remarks || ''}
              onLoyaltyClick={() => setModals(m => ({ ...m, loyaltyPoints: true }))}
              loyaltyPointsRedeemed={currentBill.loyaltyPointsRedeemed || 0}
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
        <CustomerSearchModal
          isOpen={modals.customerSearch}
          onClose={() => setModals(m => ({ ...m, customerSearch: false }))}
          onSelect={(cust) => updateCurrentBill({ customer: cust })}
          onAddNew={(nameOrPhone) => {
            setCustomerSearchValue(nameOrPhone);
            setModals(m => ({ ...m, customerSearch: false, customerCapture: true }));
          }}
        />
        <CustomerCaptureModal
          isOpen={modals.customerCapture}
          onClose={() => setModals(m => ({ ...m, customerCapture: false }))}
          initialValue={customerSearchValue}
          onSelect={(cust) => {
            updateCurrentBill({ customer: cust });
          }}
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
                  <TouchableOpacity onPress={() => setShowVariantModal(false)}>
                    <X size={24} color="#64748b" />
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

        {/* Barcode Scanner Modal */}
        <ScanBarcodeModal
          visible={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScanned={(product) => {
            handleAddProduct(product);
            setIsScannerOpen(false); // Close to allow variant selection logic to proceed visible to user
            showToast(`Scanned: ${product.name}`, 'success');
          }}
        />

      </KeyboardAvoidingView >
    </View >
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
    backgroundColor: '#22c55e',
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
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 15 },

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
  variantBtnText: { fontSize: 14, fontWeight: '600', color: '#334155' }
});
