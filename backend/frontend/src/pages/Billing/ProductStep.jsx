import React, { useState, useEffect } from 'react';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Search, ScanBarcode, ShoppingCart, Plus, Minus, Trash2, Package, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { useProducts } from '../../context/ProductContext';
import { cn } from '../../lib/utils';
import { isSearchMatch } from '../../utils/searchUtils';

const ProductStep = ({ billingData, setBillingData }) => {
    const { products, getProductByBarcode } = useProducts();
    const [searchTerm, setSearchTerm] = useState('');
    const [barcode, setBarcode] = useState('');
    const [showVariantModal, setShowVariantModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const barcodeInputRef = React.useRef(null);

    // ESC key closes variant modal
    useEffect(() => {
        if (!showVariantModal) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowVariantModal(false);
                setSelectedProduct(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [showVariantModal]);

    // Log on mount
    useEffect(() => {
        console.log('🚀 ProductStep LOADED - Variant Modal Version');
        console.log('Total products:', products.length);
        const withVariants = products.filter(p => p.variants && p.variants.length > 0);
        console.log('Products with variants:', withVariants.length);
    }, [products]);

    // Filter products based on search
    const filteredProducts = products.filter(p =>
        p && p.name && (
            isSearchMatch(p.name, searchTerm) ||
            isSearchMatch(p.barcode, searchTerm)
        )
    );

    // Add Item to Cart (with optional variant)
    const addToCart = (product, variant = null) => {
        console.log('Adding to cart:', product.name, variant ? `- ${variant.options[0]}` : '');

        const stockToCheck = variant ? variant.stock : product.stock;
        const priceToUse = variant ? variant.price : product.price;
        const nameToUse = variant ? `${product.name} - ${variant.options[0]}` : product.name;
        const cartItemId = variant ? `${product.id}-${variant.sku || variant.barcode || variant.options[0]}` : product.id;

        if (stockToCheck <= 0) {
            alert('Item is out of stock!');
            // Refocus just in case
            setTimeout(() => {
                if (barcodeInputRef.current) barcodeInputRef.current.focus();
            }, 0);
            return;
        }

        setBillingData(prev => {
            const existingItem = prev.cart.find(item => item.cartItemId === cartItemId);
            let newCart;

            if (existingItem) {
                if (existingItem.quantity >= stockToCheck) {
                    alert(`Cannot add more. Only ${stockToCheck} in stock.`);
                    return prev;
                }
                newCart = prev.cart.map(item =>
                    item.cartItemId === cartItemId ? { ...item, quantity: item.quantity + 1 } : item
                );
            } else {
                newCart = [...prev.cart, {
                    cartItemId,
                    id: product.id,
                    variantId: variant ? (variant._id || variant.id) : null,
                    variantName: variant ? variant.options[0] : null,
                    name: nameToUse,
                    price: priceToUse,
                    stock: stockToCheck,
                    quantity: 1,
                    discount: 0,
                    tax: 0,
                    unit: product.unit,
                    taxRate: product.taxRate || 0
                }];
            }

            return calculateTotals(newCart, prev);
        });

        // Close modal after adding
        setShowVariantModal(false);
        setSelectedProduct(null);
        setTimeout(() => {
            if (barcodeInputRef.current) barcodeInputRef.current.focus();
        }, 0);
    };

    // Handle product card click
    const handleProductClick = (product) => {
        console.log('Product clicked:', product.name);
        const hasVariants = product.variants && product.variants.length > 0;
        console.log('Has variants:', hasVariants, product.variants);

        if (product.stock <= 0) {
            alert('Product is out of stock!');
            return;
        }

        if (hasVariants) {
            console.log('Opening variant modal...');
            setSelectedProduct(product);
            setShowVariantModal(true);
        } else {
            addToCart(product);
            // Re-focus barcode input if present
            setTimeout(() => {
                if (barcodeInputRef.current) barcodeInputRef.current.focus();
            }, 0);
        }
    };

    // Remove Item from Cart
    const removeFromCart = (cartItemId) => {
        setBillingData(prev => {
            const newCart = prev.cart.filter(item => item.cartItemId !== cartItemId);
            return calculateTotals(newCart, prev);
        });
    };

    // Update Quantity
    const updateQuantity = (cartItemId, change) => {
        setBillingData(prev => {
            const newCart = prev.cart.map(item => {
                if (item.cartItemId === cartItemId) {
                    const newQty = item.quantity + change;
                    if (newQty < 1) return item;
                    if (change > 0 && newQty > item.stock) {
                        alert(`Cannot add more. Only ${item.stock} in stock.`);
                        return item;
                    }
                    return { ...item, quantity: newQty };
                }
                return item;
            });
            return calculateTotals(newCart, prev);
        });
    };

    // Helper to recalculate totals
    const calculateTotals = (cart, prevState) => {
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = 0;
        const total = subtotal + tax;

        return {
            ...prevState,
            cart,
            totals: { ...prevState.totals, subtotal, tax, total }
        };
    };

    // Handle Barcode Scan
    const handleBarcodeSubmit = (e) => {
        e.preventDefault();
        const product = getProductByBarcode(barcode);
        if (product) {
            handleProductClick(product);
            setBarcode(''); // Clear barcode input
            // Focus barcode input after successful scan
            setTimeout(() => {
                if (barcodeInputRef.current) barcodeInputRef.current.focus();
            }, 0);
        } else {
            alert('Product not found!');
        }
    };

    return (
        <div className="flex h-full gap-6">
            {/* LEFT: Product Selection (60%) */}
            <div className="w-[60%] flex flex-col gap-4">
                {/* Search Bar */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                            placeholder="Search products..."
                            className="pl-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <form onSubmit={handleBarcodeSubmit} className="flex gap-2 w-1/3">
                        <div className="relative flex-1">
                            <ScanBarcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                                placeholder="Scan Barcode"
                                className="pl-9"
                                value={barcode}
                                ref={barcodeInputRef}
                                onChange={(e) => setBarcode(e.target.value)}
                            />
                        </div>
                    </form>
                </div>

                {/* Product Grid */}
                <div className="flex-1 overflow-y-auto pr-2">
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredProducts.map(product => {
                            const hasVariants = product.variants && product.variants.length > 0;
                            const isLowStock = product.stock < 10;
                            const isOut = product.stock <= 0;

                            return (
                                <div
                                    key={product.id}
                                    onClick={() => handleProductClick(product)}
                                    className={cn(
                                        "group cursor-pointer rounded-lg border border-slate-200 bg-white p-4 transition-all hover:border-blue-400 hover:shadow-md relative",
                                        isOut && "opacity-60 cursor-not-allowed hover:border-slate-200"
                                    )}
                                >
                                    {hasVariants && (
                                        <div className="absolute top-2 right-2 bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                            <Package size={12} />
                                            {product.variants.length}
                                        </div>
                                    )}
                                    <div className="mb-2 h-24 rounded-md bg-slate-100 flex items-center justify-center text-slate-300">
                                        <ShoppingCart size={32} />
                                    </div>
                                    <h4 className="font-semibold text-slate-900 line-clamp-1">{product.name}</h4>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="font-bold text-blue-600">₹{product.price.toFixed(2)}</span>
                                        <span className={cn(
                                            "text-xs",
                                            isOut ? "text-red-500 font-bold" : isLowStock ? "text-orange-500 font-medium" : "text-slate-500"
                                        )}>
                                            {isOut ? 'Out of Stock' : `${product.stock} in stock`}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    {filteredProducts.length === 0 && (
                        <div className="flex h-40 items-center justify-center text-slate-500">
                            No products found.
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT: Cart (40%) */}
            <div className="w-[40%] flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                        <ShoppingCart size={18} /> Current Cart
                    </h3>
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">
                        {billingData.cart.length} items
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto p-0">
                    {billingData.cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                            <ShoppingCart size={48} className="opacity-20" />
                            <p>Cart is empty</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-white sticky top-0">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-[40%]">Item</TableHead>
                                    <TableHead className="text-center">Qty</TableHead>
                                    <TableHead className="text-right">Price</TableHead>
                                    <TableHead className="w-[30px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {billingData.cart.map((item) => (
                                    <TableRow key={item.cartItemId}>
                                        <TableCell className="py-3">
                                            <p className="font-medium text-slate-900 line-clamp-1">{item.name}</p>
                                            <p className="text-xs text-slate-500">₹{item.price}</p>
                                        </TableCell>
                                        <TableCell className="text-center py-3">
                                            <div className="flex items-center justify-center gap-1 bg-slate-100 rounded-lg p-1 w-fit mx-auto">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); updateQuantity(item.cartItemId, -1); }}
                                                    className="h-6 w-6 flex items-center justify-center rounded-md bg-white text-slate-600 shadow-sm hover:text-blue-600"
                                                >
                                                    <Minus size={12} />
                                                </button>
                                                <span className="w-6 text-center text-xs font-semibold">{item.quantity}</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); updateQuantity(item.cartItemId, 1); }}
                                                    className="h-6 w-6 flex items-center justify-center rounded-md bg-white text-slate-600 shadow-sm hover:text-blue-600"
                                                >
                                                    <Plus size={12} />
                                                </button>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-medium py-3">
                                            ₹{(item.price * item.quantity).toFixed(2)}
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeFromCart(item.cartItemId); }}
                                                className="text-slate-400 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>

                {/* Cart Total footer */}
                <div className="bg-slate-50 p-4 border-t border-slate-200 space-y-2">
                    <div className="flex justify-between text-sm text-slate-600">
                        <span>Subtotal</span>
                        <span>₹{billingData.totals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t border-slate-200 mt-2">
                        <span>Subtotal</span>
                        <span>₹{billingData.totals.subtotal.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* VARIANT SELECTION MODAL */}
            {showVariantModal && selectedProduct && (
                <div
                    className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
                    onClick={() => {
                        setShowVariantModal(false);
                        setSelectedProduct(null);
                    }}
                >
                    <div
                        className="bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[85vh] overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-purple-50">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                        <Package className="text-purple-600" size={24} />
                                        {selectedProduct.name}
                                    </h3>
                                    <p className="text-sm text-slate-600 mt-1">
                                        Choose a variant to add to cart
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowVariantModal(false);
                                        setSelectedProduct(null);
                                    }}
                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body - Variants List */}
                        <div className="p-6 overflow-y-auto max-h-[calc(85vh-180px)]">
                            <div className="space-y-3">
                                {selectedProduct.variants && selectedProduct.variants.map((variant, index) => {
                                    const isOut = variant.stock <= 0;
                                    const isLow = variant.stock < 10 && variant.stock > 0;

                                    return (
                                        <div
                                            key={index}
                                            className={cn(
                                                "flex items-center justify-between p-4 rounded-lg border-2 transition-all cursor-pointer",
                                                isOut ? "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed" : "border-slate-200 hover:border-blue-500 hover:shadow-md"
                                            )}
                                            onClick={() => !isOut && addToCart(selectedProduct, variant)}
                                        >
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-lg text-slate-900">
                                                    {variant.options[0]}
                                                </h4>
                                                {variant.sku && (
                                                    <p className="text-xs text-slate-500 mt-1">SKU: {variant.sku}</p>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <div className="text-2xl font-bold text-blue-600">
                                                        ₹{variant.price.toFixed(2)}
                                                    </div>
                                                    <div className={cn(
                                                        "text-sm font-medium",
                                                        isOut ? "text-red-500" : isLow ? "text-orange-500" : "text-green-600"
                                                    )}>
                                                        {isOut ? 'Out of Stock' : `${variant.stock} in stock`}
                                                    </div>
                                                </div>

                                                <Button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        addToCart(selectedProduct, variant);
                                                    }}
                                                    disabled={isOut}
                                                    className={cn(
                                                        "gap-2",
                                                        isOut && "opacity-50 cursor-not-allowed"
                                                    )}
                                                >
                                                    <Plus size={16} />
                                                    Add to Cart
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-slate-200 bg-slate-50">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowVariantModal(false);
                                    setSelectedProduct(null);
                                    setTimeout(() => {
                                        if (barcodeInputRef.current) barcodeInputRef.current.focus();
                                    }, 0);
                                }}
                                className="w-full"
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductStep;