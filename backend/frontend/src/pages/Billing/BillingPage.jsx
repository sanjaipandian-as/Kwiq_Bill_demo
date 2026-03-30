import { syncService } from '../../services/syncService';
import React, { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback, useDeferredValue } from 'react';
import { calculateTotals } from '../../utils/billingUtils';
import { printReceipt } from '../../utils/printReceipt';
import { normalizeSearchText } from '../../utils/searchUtils';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Search, X, Settings, Minus, Plus, RefreshCcw } from 'lucide-react';
import { useTransactions } from '../../context/TransactionContext';
import { useProducts } from '../../context/ProductContext';
import { useCustomers } from '../../context/CustomerContext';
import { useToast } from '../../context/ToastContext';
import BillingGrid from './components/BillingGrid';
import { buildSavePayload } from './components/sidebar/billingReducer';
import BillingSidebar from './components/sidebar/BillingSidebar';
import BottomFunctionBar from './components/BottomFunctionBar';
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts';
import InvoicePreviewModal from '../Invoices/InvoicePreviewModal';
import { DiscountModal } from './components/modals/DiscountModal';
import { RemarksModal } from './components/modals/RemarksModal';
import { AdditionalChargesModal } from './components/modals/AdditionalChargesModal';
import { LoyaltyPointsModal } from './components/modals/LoyaltyPointsModal';
import CustomerSearchModal from './components/CustomerSearchModal';
import QuantityModal from './components/QuantityModal';
import VariantSelectionModal from './components/VariantSelectionModal';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import UnitModal from './components/UnitModal';
import PriceModal from './components/PriceModal';

// Update: Add F5 shortcut
import { useSettings } from '../../context/SettingsContext';

const BillingPage = () => {
    const { addTransaction } = useTransactions();
    const { products, refreshProducts } = useProducts();
    const { refreshCustomers, findOrCreateCustomer } = useCustomers();
    const { settings } = useSettings();
    const { addToast } = useToast();
    const searchInputRef = useRef(null);
    const suggestionsListRef = useRef(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const sidebarRef = useRef(null);

    // --- State ---
    const [activeBills, setActiveBills] = useState(() => {
        try {
            const saved = sessionStorage.getItem('billing_activeBills');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (error) { console.error(error); }
        return [{ id: 1, customer: null, cart: [], totals: { grossTotal: 0, itemDiscount: 0, subtotal: 0, tax: 0, discount: 0, additionalCharges: 0, roundOff: 0, total: 0 }, gstSummary: {}, paymentMode: null, amountReceived: '', remarks: '', billDiscount: 0, additionalCharges: 0, loyaltyPointsDiscount: 0, status: 'Pending', taxType: 'Intra-State' }];
    });
    const [activeBillId, setActiveBillId] = useState(() => {
        try {
            const saved = sessionStorage.getItem('billing_activeBillId');
            if (saved) return parseInt(saved, 10);
        } catch (error) { console.error(error); }
        return 1;
    });
    const [selectedItemId, setSelectedItemId] = useState(null);
    const [selectedItems, setSelectedItems] = useState([]);
    const [modals, setModals] = useState({ itemDiscount: false, billDiscount: false, remarks: false, additionalCharges: false, loyaltyPoints: false, customerSearch: false, quantityChange: false, variantSelection: false, invoiceDelivery: false, unitChange: false, priceChange: false, previewModal: false });
    const [previewInvoice, setPreviewInvoice] = useState(null);
    const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
    const [savedInvoiceData, setSavedInvoiceData] = useState(null);
    const [selectedProductForVariant, setSelectedProductForVariant] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const deferredSearchTerm = useDeferredValue(searchTerm);
    const [searchActiveIndex, setSearchActiveIndex] = useState(-1);
    const [focusIndex, setFocusIndex] = useState(-1);
    const [mobileTab, setMobileTab] = useState('items');

    useEffect(() => { try { sessionStorage.setItem('billing_activeBills', JSON.stringify(activeBills)); } catch (e) { } }, [activeBills]);
    useEffect(() => { try { sessionStorage.setItem('billing_activeBillId', activeBillId.toString()); } catch (e) { } }, [activeBillId]);
    
    // Handle Alt+B for printing in preview modal
    useEffect(() => {
        const handleAltB = (e) => {
            if ((e.altKey || e.metaKey) && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                // Find and click the print button in the preview modal
                const printButton = document.querySelector('[data-print-button]');
                if (printButton) {
                    printButton.click();
                }
            }
            // Enter key to confirm save in preview modal
            if (e.key === 'Enter') {
                const confirmButton = document.querySelector('[data-confirm-button]');
                if (confirmButton) {
                    confirmButton.click();
                }
            }
        };
        window.addEventListener('keydown', handleAltB);
        return () => window.removeEventListener('keydown', handleAltB);
    }, []);

    const currentBill = activeBills.find(b => b.id === activeBillId) || activeBills[0];

    // Safety check to prevent crashes if state is invalid
    if (!currentBill) {
        return <div className="flex items-center justify-center h-full">Loading Billing...</div>;
    }

    // --- Derived State (Memoized) ---
    const derivedBillingData = useMemo(() => {
        return calculateTotals(
            currentBill.cart,
            currentBill.billDiscount || 0,
            currentBill.additionalCharges || 0,
            currentBill.loyaltyPointsDiscount || 0,
            currentBill.taxType,
            settings
        );
    }, [
        currentBill.cart,
        currentBill.billDiscount,
        currentBill.additionalCharges,
        currentBill.loyaltyPointsDiscount,
        currentBill.taxType,
        settings
    ]);

    const { totals, gstSummary, enrichedCart } = derivedBillingData;

    const addNewBill = () => {
        const newId = Math.max(...activeBills.map(b => b.id)) + 1;
        setActiveBills([...activeBills, { id: newId, customer: null, cart: [], totals: { grossTotal: 0, itemDiscount: 0, subtotal: 0, tax: 0, discount: 0, additionalCharges: 0, roundOff: 0, total: 0 }, gstSummary: {}, paymentMode: null, amountReceived: '', remarks: '', billDiscount: 0, additionalCharges: 0, loyaltyPointsDiscount: 0, status: 'Pending', taxType: 'Intra-State' }]);
        setActiveBillId(newId);
        setSelectedItemId(null);
    };

    const closeBill = (id) => {
        if (activeBills.length === 1) {
            setActiveBills([{ id: 1, customer: null, cart: [], totals: { grossTotal: 0, itemDiscount: 0, subtotal: 0, tax: 0, discount: 0, additionalCharges: 0, roundOff: 0, total: 0 }, gstSummary: {}, paymentMode: null, amountReceived: '', remarks: '', billDiscount: 0, additionalCharges: 0, loyaltyPointsDiscount: 0, status: 'Pending', taxType: 'Intra-State' }]);
            setActiveBillId(1);
            setSelectedItemId(null);
            return;
        }
        const newBills = activeBills.filter(b => b.id !== id);
        setActiveBills(newBills);
        if (id === activeBillId) setActiveBillId(newBills[newBills.length - 1].id);
    };

    const updateCurrentBill = useCallback((updates) => {
        setActiveBills(prev => prev.map(bill => bill.id === activeBillId ? { ...bill, ...updates } : bill));
    }, [activeBillId]);

    const [triggerFocus, setTriggerFocus] = useState(0);

    const handleReset = () => {
        setIsResetConfirmOpen(true);
    };

    const performReset = () => {
        // 1. CLEAR STORAGE FIRST to prevent race conditions with useEffects
        try {
            sessionStorage.removeItem('billing_activeBills');
            sessionStorage.removeItem('billing_activeBillId');
        } catch (e) {
            console.error("Storage clear failed", e);
        }

        // 2. PREPARE CLEAN STATE
        const newBillId = Date.now();
        const cleanBill = {
            id: newBillId,
            customer: null,
            cart: [],
            totals: {
                grossTotal: 0, itemDiscount: 0, subtotal: 0, tax: 0, discount: 0, additionalCharges: 0, roundOff: 0, total: 0
            },
            gstSummary: {},
            paymentMode: null,
            amountReceived: '',
            remarks: '',
            billDiscount: 0,
            additionalCharges: 0,
            loyaltyPointsDiscount: 0,
            status: 'Pending',
            taxType: 'Intra-State'
        };

        // 3. BATCH STATE UPDATES
        setActiveBills([cleanBill]);
        setActiveBillId(newBillId);
        setSelectedItemId(null);
        setSearchTerm('');
        setModals({ itemDiscount: false, billDiscount: false, remarks: false, additionalCharges: false, loyaltyPoints: false, customerSearch: false, quantityChange: false, variantSelection: false, invoiceDelivery: false });
        setIsProcessing(false);
        setSavedInvoiceData(null);
        sidebarRef.current?.reset();

        addToast('Billing session reset', 'success');

        // 4. TRIGGER FOCUS
        setTriggerFocus(prev => prev + 1);
    };

    // Robust Focus Management using useLayoutEffect
    // This runs synchronously after DOM mutations but before paint, 
    // ensuring the user sees the cursor immediately.
    useLayoutEffect(() => {
        if (triggerFocus > 0) {
            const focusSearch = () => {
                const input = document.getElementById('main-search-input');
                if (input) {
                    input.focus();
                    // Optional: Select text if any
                    // input.select(); 
                } else if (searchInputRef.current) {
                    searchInputRef.current.focus();
                }
            };

            // Immediate attempt
            focusSearch();

            // Backup attempt for safety (in case of complex re-renders)
            const timer = setTimeout(focusSearch, 50);
            return () => clearTimeout(timer);
        }
    }, [triggerFocus, activeBillId]); // Re-run on bill switch too

    // Auto-focus on Mount (Navigation to this page)
    useEffect(() => {
        // Trigger the robust focus logic
        setTriggerFocus(prev => prev + 1);
    }, []);



    // Search Logic
    const filteredProducts = useMemo(() => {
        if (!deferredSearchTerm) return [];
        const terms = deferredSearchTerm.toLowerCase().split(/\s+/).filter(t => t.trim());
        if (terms.length === 0) return [];

        return products.filter(Boolean).map(p => {
            let score = 0;
            const name = p.name || ''; const sku = p.sku || ''; const barcode = p.barcode || '';

            // Normalize product text once
            const normalizedProductText = normalizeSearchText(`${name} ${sku} ${barcode} ${(p.variants || []).map(v => `${v.sku || ''} ${v.barcode || ''} ${v.name || ''}`).join(' ')}`);

            // Check if ALL terms match the normalized product text
            if (!terms.every(term => normalizedProductText.includes(normalizeSearchText(term)))) return null;

            // Scoring (Keep existing simple logic or update to normalized - keeping simple for now but using normalized for exact matches)
            const lowerTerm = deferredSearchTerm.toLowerCase();
            const normalizedTerm = normalizeSearchText(deferredSearchTerm);
            const normalizedName = normalizeSearchText(name);
            const normalizedSku = normalizeSearchText(sku);
            const normalizedBarcode = normalizeSearchText(barcode);

            if (normalizedBarcode === normalizedTerm) score += 100;
            else if (normalizedSku === normalizedTerm) score += 90;
            else if (normalizedName === normalizedTerm) score += 80;
            else if (normalizedName.startsWith(normalizedTerm)) score += 50;
            score += 10;

            return { product: p, score };
        }).filter(Boolean).sort((a, b) => b.score - a.score).map(item => item.product).slice(0, 15);
    }, [deferredSearchTerm, products]);

    useEffect(() => {
        setSearchActiveIndex(filteredProducts.length > 0 ? 0 : -1);
    }, [deferredSearchTerm, filteredProducts.length]);

    // Actions
    const addToCart = (product) => {
        // --- Stock Check ---
        // For products with variants, stock is checked at the variant level in addVariantToCart or VariantSelectionModal.
        // For simple products, we check here.
        if ((!product.variants || product.variants.length === 0) && (product.stock !== undefined && product.stock !== null)) {
            if (product.stock <= 0 && settings?.billing?.allowNegativeStock !== true) {
                addToast(`Product "${product.name}" is out of stock!`, 'error');
                return;
            }
        }

        if (product.variants && product.variants.length > 0) {
            setSelectedProductForVariant(product);
            setModals(prev => ({ ...prev, variantSelection: true }));
            setSearchTerm('');
            return;
        }
        const productId = product.id || product._id;
        const price = product.price || product.sellingPrice || 0;
        let newCart = [...currentBill.cart];
        const existingIndex = newCart.findIndex(item => (item.id || item._id) === productId && !item.variantIndex);

        if (existingIndex > -1) {
            // Check stock for increment
            if (product.stock !== undefined && product.stock !== null) {
                if (newCart[existingIndex].quantity + 1 > product.stock && settings?.billing?.allowNegativeStock !== true) {
                    addToast(`Cannot add more. Reached stock limit for "${product.name}"`, 'error');
                    return;
                }
            }
            newCart[existingIndex].quantity += 1;
            const itemPrice = newCart[existingIndex].price || newCart[existingIndex].sellingPrice || 0;
            newCart[existingIndex].total = (newCart[existingIndex].quantity * itemPrice) - (newCart[existingIndex].discount || 0);
        } else {
            const taxRate = product.taxRate !== undefined ? product.taxRate : (product.tax_rate !== undefined ? product.tax_rate : 0);
            newCart.push({ ...product, quantity: 1, total: price, discount: 0, discountPercent: 0, taxRate: parseFloat(taxRate) || 0 });
        }
        updateCurrentBill({ cart: newCart });
        setSearchTerm('');

        // Continuous scanning: refocus search
        setTimeout(() => {
            searchInputRef.current?.focus();
        }, 0);
    };

    const handleSaveReady = useCallback(({ sidebarState, customer, printFormat, payments, paymentStatus, totalPaidPaise, cart }) => {
        // Build the full payload for preview - this is the "Confirmation" step
        const payload = buildSavePayload(sidebarState, { taxType: currentBill.taxType, remarks: currentBill.remarks, billDiscount: currentBill.billDiscount, loyaltyPointsDiscount: currentBill.loyaltyPointsDiscount }, totals, enrichedCart, customer);
        
        // Show the existing InvoicePreviewModal
        setPreviewInvoice(payload);
    }, [currentBill, totals, enrichedCart]);

    const addVariantToCart = (product, variant, variantIndex, quantity = 1) => {
        // --- Stock Check for Variant ---
        if (variant.stock !== undefined && variant.stock !== null) {
            if (variant.stock <= 0 && settings?.billing?.allowNegativeStock !== true) {
                addToast(`Variant "${variant.name || variant.options.join(' ')}" is out of stock!`, 'error');
                return;
            }
        }

        const productId = product.id || product._id;
        const price = variant.price || 0;
        let newCart = [...currentBill.cart];
        const existingIndex = newCart.findIndex(item => (item.id || item._id) === productId && item.variantIndex === variantIndex);

        if (existingIndex > -1) {
            // Check stock for increment
            if (variant.stock !== undefined && variant.stock !== null) {
                if (newCart[existingIndex].quantity + quantity > variant.stock && settings?.billing?.allowNegativeStock !== true) {
                    addToast(`Cannot add more. Reached stock limit for "${variant.name || variant.options.join(' ')}"`, 'error');
                    return;
                }
            }

            newCart[existingIndex].quantity += quantity;
            const itemPrice = newCart[existingIndex].price || newCart[existingIndex].sellingPrice || 0;
            newCart[existingIndex].total = (newCart[existingIndex].quantity * itemPrice) - (newCart[existingIndex].discount || 0);
        } else {
            // Basic initial check already done above, but ensuring quantity doesn't exceed if we supported adding > 1 initially (which we do via arg)
            if (variant.stock !== undefined && variant.stock !== null) {
                if (quantity > variant.stock && settings?.billing?.allowNegativeStock !== true) {
                    addToast(`Not enough stock. Available: ${variant.stock}`, 'error');
                    return;
                }
            }

            const taxRate = product.taxRate !== undefined ? product.taxRate : (product.tax_rate !== undefined ? product.tax_rate : 0);
            newCart.push({
                ...product, variantIndex, variantId: variant.id || variant._id, variantName: variant.name || variant.options[0], variantOptions: variant.options,
                price: variant.price, sellingPrice: variant.price, stock: variant.stock, quantity, total: price * quantity, discount: 0, taxRate: parseFloat(taxRate) || 0
            });
        }
        updateCurrentBill({ cart: newCart });
    };

    const updateQuantity = useCallback((id, newQty) => {
        if (newQty < 1) return;
        
        // Find the item in cart to check stock
        const cartItem = currentBill.cart.find(item => (item.id || item._id) === id);
        if (cartItem && cartItem.stock !== undefined && cartItem.stock !== null) {
            if (newQty > cartItem.stock && settings?.billing?.allowNegativeStock !== true) {
                addToast(`Cannot set quantity to ${newQty}. Only ${cartItem.stock} available in stock.`, 'error');
                return;
            }
        }
        
        setActiveBills(prevBills => {
            return prevBills.map(bill => {
                if (bill.id === activeBillId) {
                    const newCart = bill.cart.map(item => {
                        const itemId = item.id || item._id;
                        const price = item.price || item.sellingPrice || 0;
                        let discount = item.discount || 0;
                        if (itemId === id) {
                            const baseTotal = newQty * price;
                            if (item.discountPercent > 0) discount = (baseTotal * item.discountPercent) / 100;
                            return { ...item, quantity: newQty, discount: discount, total: Math.max(0, baseTotal - discount) };
                        }
                        return item;
                    });
                    return { ...bill, cart: newCart };
                }
                return bill;
            });
        });
    }, [activeBillId, currentBill.cart, settings?.billing?.allowNegativeStock, addToast]);

    const removeItem = useCallback((id) => {
        if (!id) return;
        setActiveBills(prevBills => {
            return prevBills.map(bill => {
                if (bill.id === activeBillId) {
                    const newCart = bill.cart.filter(item => (item.id || item._id) !== id);
                    return { ...bill, cart: newCart };
                }
                return bill;
            });
        });
        if (id === selectedItemId) setSelectedItemId(null);
        // Also remove from selectedItems if present
        setSelectedItems(prev => prev.filter(itemId => itemId !== id));
        setTimeout(() => searchInputRef.current?.focus(), 300);
    }, [activeBillId, selectedItemId]);

    const handleRowClick = useCallback((id) => setSelectedItemId(id), []);
    
    // Multi-select handlers
    const handleMultiSelectToggle = useCallback((id) => {
        setSelectedItems(prev => {
            if (prev.includes(id)) {
                return prev.filter(itemId => itemId !== id);
            } else {
                return [...prev, id];
            }
        });
    }, []);
    
    const handleSelectAll = useCallback(() => {
        const allIds = currentBill.cart.map(item => item.id || item._id);
        setSelectedItems(allIds);
    }, [currentBill.cart]);
    
    const handleClearSelection = useCallback(() => {
        setSelectedItems([]);
    }, []);
    
    const handleDiscountClick = useCallback((id) => {
        setSelectedItemId(id);
        setModals(prev => ({ ...prev, itemDiscount: true }));
    }, []);

    const handleF2 = () => {
        if (selectedItemId) {
            setModals(p => ({ ...p, quantityChange: true }));
        } else {
            addToast("Please select an item first", "error");
            searchInputRef.current?.focus();
        }
    };
    const handleCustomerChange = useCallback((customerData) => {
        updateCurrentBill({ customer: customerData });
    }, [updateCurrentBill]);

    const handleTaxTypeChange = useCallback((type) => {
        updateCurrentBill({ taxType: type });
    }, [updateCurrentBill]);

    const handlePaymentChange = useCallback((field, value) => {
        if (field === 'status') {
            let updates = { status: value };
            if (value === 'Unpaid') updates.amountReceived = 0;
            if (value === 'Paid') updates.amountReceived = totals.total; // Use derived totals from closure
            updateCurrentBill(updates);
        } else {
            updateCurrentBill({
                [field === 'mode' ? 'paymentMode' : 'amountReceived']: value
            });
        }
    }, [totals.total, updateCurrentBill]);

    const handleF3 = useCallback(() => {
        if (selectedItemId) {
            setModals(p => ({ ...p, itemDiscount: true }));
        } else {
            addToast("Please select an item first", "error");
            searchInputRef.current?.focus();
        }
    }, [selectedItemId]);

    const handleF4 = useCallback(() => {
        // If multiple items are selected, delete all of them
        if (selectedItems.length > 0) {
            selectedItems.forEach(id => removeItem(id));
            setSelectedItems([]);
        } else if (selectedItemId) {
            removeItem(selectedItemId);
        } else {
            addToast("Please select an item first", "error");
            searchInputRef.current?.focus();
        }
    }, [selectedItemId, selectedItems, removeItem]);

    const handleF8 = useCallback(() => setModals(p => ({ ...p, additionalCharges: true })), []);
    const handleF9 = useCallback(() => setModals(p => ({ ...p, billDiscount: true })), []);
    const handleF10 = useCallback(() => setModals(p => ({ ...p, loyaltyPoints: true })), []);
    const handleF12 = useCallback(() => setModals(p => ({ ...p, remarks: true })), []);

    // F7 - Unit Change
    const handleF7 = useCallback(() => {
        if (selectedItemId) {
            setModals(p => ({ ...p, unitChange: true }));
        } else {
            addToast("Please select an item first", "error");
            searchInputRef.current?.focus();
        }
    }, [selectedItemId, addToast]);

    // F11 - Price Change
    const handleF11 = useCallback(() => {
        if (selectedItemId) {
            setModals(p => ({ ...p, priceChange: true }));
        } else {
            addToast("Please select an item first", "error");
            searchInputRef.current?.focus();
        }
    }, [selectedItemId, addToast]);

    // Update Unit Handler
    const handleUpdateUnit = useCallback((itemId, newUnit) => {
        setActiveBills(prevBills => {
            return prevBills.map(bill => {
                if (bill.id === activeBillId) {
                    const newCart = bill.cart.map(item => {
                        if ((item.id || item._id) === itemId) {
                            return { ...item, unit: newUnit };
                        }
                        return item;
                    });
                    return { ...bill, cart: newCart };
                }
                return bill;
            });
        });
        addToast(`Unit updated successfully`, 'success');
    }, [activeBillId, addToast]);

    // Update Price Handler
    const handleUpdatePrice = useCallback((itemIds, priceConfig) => {
        const { value, type, adjustment } = priceConfig;
        
        setActiveBills(prevBills => {
            return prevBills.map(bill => {
                if (bill.id === activeBillId) {
                    const newCart = bill.cart.map(item => {
                        if (itemIds.includes(item.id || item._id)) {
                            const currentPrice = item.price || item.sellingPrice || 0;
                            let newPrice = currentPrice;

                            if (type === 'absolute') {
                                if (adjustment === 'set') newPrice = value;
                                else if (adjustment === 'increase') newPrice = currentPrice + value;
                                else if (adjustment === 'decrease') newPrice = Math.max(0, currentPrice - value);
                            } else {
                                // percentage
                                if (adjustment === 'increase') newPrice = currentPrice * (1 + value / 100);
                                else if (adjustment === 'decrease') newPrice = currentPrice * (1 - value / 100);
                                else newPrice = currentPrice * (value / 100);
                            }

                            // Recalculate total with new price
                            const baseTotal = item.quantity * newPrice;
                            let discount = item.discount || 0;
                            if (item.discountPercent > 0) {
                                discount = (baseTotal * item.discountPercent) / 100;
                            }
                            
                            return { 
                                ...item, 
                                price: newPrice, 
                                sellingPrice: newPrice,
                                total: Math.max(0, baseTotal - discount)
                            };
                        }
                        return item;
                    });
                    return { ...bill, cart: newCart };
                }
                return bill;
            });
        });
        addToast(`Price updated for ${itemIds.length} item(s)`, 'success');
    }, [activeBillId, addToast]);

    // Handle unit click from grid
    const handleUnitClick = useCallback((itemId) => {
        setSelectedItemId(itemId);
        setModals(p => ({ ...p, unitChange: true }));
    }, []);

    // Handle price click from grid
    const handlePriceClick = useCallback((itemId) => {
        setSelectedItemId(itemId);
        setModals(p => ({ ...p, priceChange: true }));
    }, []);

    const handleApplyItemDiscount = (val, isPercent) => {
        if (!selectedItemId) return;
        const newCart = currentBill.cart.map(item => {
            if ((item.id || item._id) === selectedItemId) {
                const price = item.price || item.sellingPrice || 0;
                const baseTotal = item.quantity * price;
                let discount = isPercent ? (baseTotal * val / 100) : val;
                return { ...item, discount, discountPercent: isPercent ? val : 0, total: Math.max(0, baseTotal - discount) };
            }
            return item;
        });
        updateCurrentBill({ cart: newCart });
    };

    const handleApplyBillDiscount = (val, isPercent) => {
        const subtotal = currentBill.cart.reduce((acc, item) => acc + item.total, 0);
        updateCurrentBill({ billDiscount: isPercent ? (subtotal * val / 100) : val });
    };
    const handleApplyAdditionalCharges = (val) => updateCurrentBill({ additionalCharges: val });
    const handleApplyLoyaltyRedemption = (val) => updateCurrentBill({ loyaltyPointsDiscount: val });
    const handleSaveRemarks = (text) => updateCurrentBill({ remarks: text });

    const handleSavePrint = useCallback(async (format = '80mm', payload = null) => {
        if (isProcessing) return;
        
        const finalPayload = payload || previewInvoice;
        if (!finalPayload) {
             addToast("No valid invoice payload to save", "error");
             return;
        }

        setIsProcessing(true);
        try {
            if (finalPayload.customerMobile && !finalPayload.customerId) {
                const customer = await findOrCreateCustomer({
                    mobile: finalPayload.customerMobile, 
                    name: finalPayload.customerName, 
                    source: 'POS'
                });
                finalPayload.customerId = customer.id || customer._id;
            }

            const savedBill = await addTransaction(finalPayload);
            refreshProducts(); refreshCustomers();
            syncService.uploadEvent('INVOICE_CREATED', savedBill).catch(e => console.error(e));

            if (finalPayload.status === 'Paid') {
                printReceipt(savedBill, format, settings);
                addToast(`Bill #${savedBill.id} saved and printing...`, 'success');
            } else {
                addToast(`Invoice #${savedBill.id} saved (${finalPayload.status}). Receipt will be available after full payment.`, 'info');
            }

            sidebarRef.current?.reset();
            closeBill(activeBillId);
            setPreviewInvoice(null);
        } catch (error) {
            console.error(error);
            alert("Failed to save the bill");
        } finally { setIsProcessing(false); }
    }, [isProcessing, previewInvoice, settings, activeBillId, addTransaction, refreshProducts, refreshCustomers, addToast, closeBill, findOrCreateCustomer]);

    const handleF6 = useCallback(() => {
        if (selectedItemId) {
            setModals(p => ({ ...p, quantityChange: true }));
        } else {
            addToast("Please select an item first", "error");
            searchInputRef.current?.focus();
        }
    }, [selectedItemId]);
    
    // Handle Delete key for deleting selected items
    const handleDelete = useCallback(() => {
        if (selectedItems.length > 0) {
            selectedItems.forEach(id => removeItem(id));
            setSelectedItems([]);
        } else if (selectedItemId) {
            removeItem(selectedItemId);
        }
    }, [selectedItemId, selectedItems, removeItem]);
    
    // Handle Arrow Up/Down navigation in grid
    const handleArrowNavigation = useCallback((direction) => {
        const cart = currentBill.cart;
        if (cart.length === 0) return;
        
        const currentIndex = cart.findIndex(item => (item.id || item._id) === selectedItemId);
        
        if (direction === 'down') {
            if (currentIndex < cart.length - 1) {
                setSelectedItemId(cart[currentIndex + 1]?.id || cart[currentIndex + 1]?._id);
            } else if (currentIndex === -1) {
                setSelectedItemId(cart[0]?.id || cart[0]?._id);
            }
        } else if (direction === 'up') {
            if (currentIndex > 0) {
                setSelectedItemId(cart[currentIndex - 1]?.id || cart[currentIndex - 1]?._id);
            } else if (currentIndex === -1) {
                setSelectedItemId(cart[cart.length - 1]?.id || cart[cart.length - 1]?._id);
            }
        }
    }, [currentBill.cart, selectedItemId]);

    // Global Navigation: Grid Arrows & Pane Toggling
    useEffect(() => {
        const handleGlobalKeyNav = (e) => {
            const activeEl = document.activeElement;
            const tagName = activeEl?.tagName?.toUpperCase() || '';
            const isSidebarFocused = activeEl?.closest('#billing-sidebar');
            const isModalFocused = activeEl?.closest('.modal-container') || activeEl?.closest('[role="dialog"]');

            // 1. Pane Toggling
            if (e.shiftKey && e.key === 'ArrowRight') {
                e.preventDefault();
                document.getElementById('customer-mobile-input')?.focus();
                return;
            } else if (e.shiftKey && e.key === 'ArrowLeft') {
                e.preventDefault();
                document.getElementById('main-search-input')?.focus();
                return;
            }

            // 2. Grid Arrow Navigation (isolated from selectors)
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                if (!activeEl) return;
                
                // Let native movement happen in text inputs and selects
                if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName)) return;
                
                // Let sidebar and modals handle their own arrow keys
                if (isSidebarFocused || isModalFocused) return;
                
                e.preventDefault();
                handleArrowNavigation(e.key === 'ArrowDown' ? 'down' : 'up');
            }
        };
        window.addEventListener('keydown', handleGlobalKeyNav);
        return () => window.removeEventListener('keydown', handleGlobalKeyNav);
    }, [handleArrowNavigation]);

    useKeyboardShortcuts({ 'F2': handleF2, 'F3': handleF3, 'F4': handleF4, 'F5': handleReset, 'F6': handleF6, 'F7': handleF7, 'F8': handleF8, 'F9': handleF9, 'F10': handleF10, 'F11': handleF11, 'F12': handleF12, 'Ctrl+P': handleSavePrint, 'Delete': handleDelete });

    const handleFunctionClick = useCallback((key) => {
        switch (key) {
            case 'F2': handleF2(); break;
            case 'F3': handleF3(); break;
            case 'F4': handleF4(); break;
            case 'F5': handleReset(); break;
            case 'F6': handleF6(); break;
            case 'F7': handleF7(); break;
            case 'F8': handleF8(); break;
            case 'F9': handleF9(); break;
            case 'F10': handleF10(); break;
            case 'F11': handleF11(); break;
            case 'F12': handleF12(); break;
            default: break;
        }
    }, [handleF2, handleF3, handleF4, handleReset, handleF6, handleF7, handleF8, handleF9, handleF10, handleF11, handleF12]);

    const handleSearchKeyDown = (e) => {
        if (!filteredProducts.length) {
            // Restore grid navigation directly from search input when no suggestions
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                handleArrowNavigation('down');
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                handleArrowNavigation('up');
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSearchActiveIndex(prev => (prev + 1) % filteredProducts.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSearchActiveIndex(prev => (prev - 1 + filteredProducts.length) % filteredProducts.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (searchActiveIndex >= 0 && filteredProducts[searchActiveIndex]) {
                addToCart(filteredProducts[searchActiveIndex]);
            } else if (filteredProducts.length > 0) {
                // If no item is highlighted but Enter is pressed, select the first one
                addToCart(filteredProducts[0]);
            }
        }
    };


    // Scroll active item into view
    useEffect(() => {
        if (searchActiveIndex >= 0 && suggestionsListRef.current) {
            const activeItem = suggestionsListRef.current.children[searchActiveIndex];
            if (activeItem) {
                activeItem.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [searchActiveIndex]);

    return (
        <div className="flex flex-col h-full w-full bg-zinc-50 overflow-hidden">
            {/* Top Bar - Tabs & Tools */}
            <div className="shrink-0 flex justify-between items-center px-2 bg-white border-b shadow-sm h-10">
                <div className="flex gap-2 items-end h-full overflow-x-auto overflow-y-hidden no-scrollbar">
                    {activeBills.map(bill => (
                        <div key={bill.id} onClick={() => setActiveBillId(bill.id)} className={`flex items-center gap-2 px-4 py-2 border-t border-x rounded-t-lg text-xs font-bold cursor-pointer select-none relative top-[1px] transition-all ${bill.id === activeBillId ? 'bg-white border-zinc-200 border-b-transparent text-zinc-900 shadow-[0_-2px_10px_-5px_rgba(0,0,0,0.05)] z-10' : 'bg-zinc-100 border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700'}`}>
                            <span>#{bill.id}</span>
                            {bill.id === activeBillId && <span className="text-[10px] text-zinc-400 font-normal ml-1">Alt+W</span>}
                            <X size={12} className="text-zinc-400 hover:text-zinc-900 cursor-pointer ml-1" onClick={(e) => { e.stopPropagation(); closeBill(bill.id); }} />
                        </div>
                    ))}
                    <button onClick={addNewBill} className="flex items-center gap-1 px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-black rounded-md text-xs font-semibold my-1 transition-colors" title="New Bill (Alt+T)">
                        <Plus size={14} /> <span className="hidden sm:inline">New Bill</span>
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    {/* Minimalist Keyboard Shortcuts Info */}
                    <div className="relative group flex items-center hidden sm:flex">
                        <Button variant="ghost" size="sm" className="hidden lg:flex text-slate-500 hover:text-slate-900 h-9 font-medium px-2 z-10 transition-colors">
                            <span className="text-xs flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 rounded border bg-slate-100 font-mono text-[9px] text-slate-500 shadow-sm">?</kbd> Shortcuts</span>
                        </Button>
                        <div className="absolute top-10 right-0 w-64 bg-white border border-slate-200 shadow-xl rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none group-hover:pointer-events-auto z-50 origin-top-right transform scale-95 group-hover:scale-100">
                            <p className="text-xs font-bold mb-3 text-slate-800 border-b pb-1">Navigation Shortcuts</p>
                            <div className="grid grid-cols-[1fr_auto] gap-y-2.5 text-xs">
                                <span className="text-slate-600 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>Search</span> <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-[10px] font-mono text-slate-600">F2</kbd>
                                <span className="text-slate-600 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>Select Pane</span> <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-[10px] font-mono text-slate-600">Shift+←/→</kbd>
                                <span className="text-slate-600 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>Navigate List</span> <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-[10px] font-mono text-slate-600">↑ / ↓</kbd>
                                <span className="text-slate-600 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>Confirm / Next</span> <kbd className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] font-mono text-emerald-700">Enter</kbd>
                                <span className="text-slate-600 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>Toggle Payment</span> <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-[10px] font-mono text-slate-600">Space</kbd>
                                <span className="text-slate-600 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>Print Bill</span> <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border text-[10px] font-mono text-slate-600">Alt+B</kbd>
                            </div>
                        </div>
                    </div>

                    <button onClick={handleReset} className="flex flex-col sm:flex-row items-center justify-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 rounded-lg transition-all shadow-sm">
                        <RefreshCcw size={14} /> <span className="hidden sm:inline">Reset <span className="opacity-75 font-normal ml-0.5">(F5)</span></span>
                    </button>
                </div>
            </div>

            {/* Main Workspace - 3 Panel Layout */}
            <div className="flex-1 min-h-0 flex p-3 gap-3 overflow-hidden">
                {/* CENTER PANEL: Billing Area (Search + Grid + Shortcuts) */}
                <div className="flex-1 flex flex-col min-w-0 bg-white rounded-xl border border-zinc-200 shadow-sm h-full relative overflow-hidden">
                    {/* 1. Search Bar (Fixed Top) */}
                    <div className="shrink-0 p-3 border-b border-slate-100 bg-white z-20">
                        <div className="relative flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 h-4 w-4" />
                                <Input id="main-search-input" ref={searchInputRef} autoFocus className="pl-10 h-11 text-sm bg-zinc-50 border-zinc-200 focus:bg-white focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 shadow-sm transition-all rounded-lg" placeholder="Scan barcode or search items..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={handleSearchKeyDown} />
                            </div>
                        </div>
                        {/* Autocomplete Dropdown */}
                        {searchTerm && filteredProducts.length > 0 && (
                            <div ref={suggestionsListRef} className="absolute left-3 right-3 mt-1 bg-white border rounded-lg shadow-xl py-1 max-h-[300px] overflow-y-auto z-50">
                                {filteredProducts.map((product, index) => (
                                    <div key={product.id || product._id} className={`px-4 py-2 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-0 transition-colors ${index === searchActiveIndex ? 'bg-black' : 'hover:bg-slate-50'}`} onClick={() => addToCart(product)}>
                                        <div>
                                            <span className={`font-semibold block text-sm ${index === searchActiveIndex ? 'text-white' : 'text-slate-800'}`}>{product.name}</span>
                                            <div className={`flex items-center gap-2 text-xs ${index === searchActiveIndex ? 'text-slate-300' : 'text-slate-500'}`}>
                                                <span className={`px-1 rounded ${index === searchActiveIndex ? 'bg-zinc-800 text-white' : 'bg-slate-100'}`}>{product.sku}</span>
                                                <span className={index === searchActiveIndex ? 'text-slate-300' : 'text-slate-500'}>{product.category}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`font-bold block ${index === searchActiveIndex ? 'text-white' : 'text-black'}`}>₹{product.price || product.sellingPrice}</span>
                                            <span className={`text-xs ${product.stock < 5 ? (index === searchActiveIndex ? 'text-rose-300 font-medium' : 'text-red-600 font-medium') : (index === searchActiveIndex ? 'text-slate-300' : 'text-slate-400')}`}>Stock: {product.stock}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 2. Billing Grid (Flexible Middle) */}
                    <div className="flex-1 min-h-0 bg-slate-50/30 overflow-hidden relative flex flex-col">
                        <BillingGrid
                            cart={enrichedCart} // Use enriched cart with calculated values
                            updateQuantity={updateQuantity}
                            removeItem={removeItem}
                            selectedItemId={selectedItemId}
                            onRowClick={handleRowClick}
                            onDiscountClick={handleDiscountClick}
                            onUnitClick={handleUnitClick}
                            onPriceClick={handlePriceClick}
                            selectedItems={selectedItems}
                            onMultiSelectToggle={handleMultiSelectToggle}
                            onSelectAll={handleSelectAll}
                            onClearSelection={handleClearSelection}
                        />
                    </div>

                    {/* 3. Bottom Function Bar (Fixed Bottom) */}
                    <div className="shrink-0 border-t border-zinc-200 bg-white relative z-20">
                        <BottomFunctionBar onFunctionClick={handleFunctionClick} />
                    </div>
                </div>

                {/* RIGHT PANEL: Sidebar */}
                <div className="w-[340px] lg:w-[380px] xl:w-[400px] shrink-0 h-full flex flex-col overflow-hidden rounded-xl shadow-sm border border-zinc-200 bg-white">
                    <BillingSidebar
                        ref={sidebarRef}
                        totals={totals}
                        cart={currentBill.cart}
                        settings={settings}
                        taxType={currentBill.taxType}
                        onTaxTypeChange={handleTaxTypeChange}
                        isProcessing={isProcessing}
                        onRemoveDiscount={() => handleApplyBillDiscount(0, false)}
                        onEditDiscount={() => setModals(prev => ({ ...prev, billDiscount: true }))}
                        onSaveReady={handleSaveReady}
                        requireMobile={true}
                    />
                </div>
            </div>

            {/* Action Modals */}
            {/* Action Modals */}
            <DiscountModal
                isOpen={modals.itemDiscount}
                onClose={() => { setModals(prev => ({ ...prev, itemDiscount: false })); setTimeout(() => searchInputRef.current?.focus(), 300); }}
                onApply={handleApplyItemDiscount}
                title={`Item Discount - ${currentBill.cart.find(i => (i.id || i._id) === selectedItemId)?.name || 'Unknown'}`}
                initialValue={currentBill.cart.find(i => (i.id || i._id) === selectedItemId)?.discountPercent || currentBill.cart.find(i => (i.id || i._id) === selectedItemId)?.discount || 0}
                isPercentage={!!currentBill.cart.find(i => (i.id || i._id) === selectedItemId)?.discountPercent}
                totalAmount={(() => { const item = currentBill.cart.find(i => (i.id || i._id) === selectedItemId); if (!item) return 0; return (parseFloat(item.price || item.sellingPrice) || 0) * (parseFloat(item.quantity) || 0); })()}
            />
            <DiscountModal
                isOpen={modals.billDiscount}
                onClose={() => { setModals(prev => ({ ...prev, billDiscount: false })); setTimeout(() => searchInputRef.current?.focus(), 300); }}
                onApply={handleApplyBillDiscount}
                title="Bill Discount"
                initialValue={currentBill.billDiscount}
                totalAmount={totals.subtotal}
            />
            <AdditionalChargesModal
                isOpen={modals.additionalCharges}
                onClose={() => { setModals(prev => ({ ...prev, additionalCharges: false })); setTimeout(() => searchInputRef.current?.focus(), 300); }}
                onApply={handleApplyAdditionalCharges}
                initialValue={currentBill.additionalCharges}
            />
            <LoyaltyPointsModal
                isOpen={modals.loyaltyPoints}
                onClose={() => { setModals(prev => ({ ...prev, loyaltyPoints: false })); setTimeout(() => searchInputRef.current?.focus(), 300); }}
                onApply={handleApplyLoyaltyRedemption}
                availablePoints={250}
            />
            <RemarksModal
                isOpen={modals.remarks}
                onClose={() => { setModals(prev => ({ ...prev, remarks: false })); setTimeout(() => searchInputRef.current?.focus(), 300); }}
                onSave={handleSaveRemarks}
                initialValue={currentBill.remarks}
            />
            <CustomerSearchModal
                isOpen={modals.customerSearch}
                onClose={() => { setModals(prev => ({ ...prev, customerSearch: false })); setTimeout(() => searchInputRef.current?.focus(), 300); }}
                onSelect={(customer) => updateCurrentBill({ customer })}
            />
            <QuantityModal
                isOpen={modals.quantityChange}
                onClose={() => { setModals(prev => ({ ...prev, quantityChange: false })); setTimeout(() => searchInputRef.current?.focus(), 300); }}
                onApply={(newQty) => updateQuantity(selectedItemId, newQty)}
                item={currentBill.cart.find(i => (i.id || i._id) === selectedItemId)}
                allowNegativeStock={settings?.billing?.allowNegativeStock === true}
            />
            <VariantSelectionModal
                isOpen={modals.variantSelection}
                onClose={() => {
                    setModals(prev => ({ ...prev, variantSelection: false }));
                    setTimeout(() => searchInputRef.current?.focus(), 300);
                }}
                product={selectedProductForVariant}
                onAddToCart={(product, variant, variantIndex, quantity) => {
                    addVariantToCart(product, variant, variantIndex, quantity);
                    setModals(prev => ({ ...prev, variantSelection: false }));
                    setTimeout(() => searchInputRef.current?.focus(), 300);
                }}
            />
            <UnitModal
                isOpen={modals.unitChange}
                onClose={() => { setModals(prev => ({ ...prev, unitChange: false })); setTimeout(() => searchInputRef.current?.focus(), 300); }}
                onApply={handleUpdateUnit}
                currentItem={selectedItemId}
                cart={currentBill.cart}
            />
            <PriceModal
                isOpen={modals.priceChange}
                onClose={() => { setModals(prev => ({ ...prev, priceChange: false })); setTimeout(() => searchInputRef.current?.focus(), 300); }}
                onApply={handleUpdatePrice}
                selectedItems={selectedItemId ? [selectedItemId] : []}
                cart={currentBill.cart}
                isMultiple={false}
            />

            {/* Invoice Preview Modal - Alt+B for print, Enter for confirm */}
            {previewInvoice && (
                <InvoicePreviewModal
                    isOpen={true}
                    onClose={() => setPreviewInvoice(null)}
                    invoice={previewInvoice}
                    showConfirmButton={true}
                    onConfirm={(format) => { handleSavePrint(format, previewInvoice); }}
                    isSaved={false}
                />
            )}

            <ConfirmationModal
                isOpen={isResetConfirmOpen}
                onClose={() => setIsResetConfirmOpen(false)}
                onConfirm={performReset}
                title="Reset Session?"
                message="Are you sure you want to reset the entire billing session? This will clear all bills and unsaved changes."
                variant="danger"
            />


        </div>
    );
}

export default BillingPage;



