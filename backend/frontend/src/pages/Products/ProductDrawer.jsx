import { syncService } from '../../services/syncService';
import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import { Drawer } from '../../components/ui/Drawer';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Search, Loader2, Plus, X, ChevronDown, ChevronRight, Calculator, AlertTriangle, Save, Trash } from 'lucide-react';
import { fetchProductMetadata } from '../../services/barcodeService';
import { Badge } from '../../components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { useSettings } from '../../context/SettingsContext';
import { formatCappedPercentage } from '../../utils/formatUtils';

const AutocompleteInput = ({ label, name, value, onChange, suggestions = [], placeholder }) => {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [filtered, setFiltered] = useState([]);
    const wrapperRef = useRef(null);

    useEffect(() => {
        if (value && typeof value === 'string') {
            setFiltered(suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase())));
        } else {
            setFiltered(suggestions);
        }
    }, [value, suggestions]);

    const handleSelect = (item) => {
        onChange({ target: { name, value: item } });
        setShowSuggestions(false);
    };

    return (
        <div className="relative space-y-2" ref={wrapperRef}>
            <label className="text-sm font-medium text-slate-700">{label} <span className="text-black font-bold">*</span></label>
            <div className="relative">
                <Input
                    name={name}
                    placeholder={placeholder}
                    value={value || ''}
                    onChange={onChange}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={(e) => {
                        setTimeout(() => setShowSuggestions(false), 200);
                    }}
                    autoComplete="off"
                />
                {showSuggestions && filtered.length > 0 && (
                    <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded-md shadow-xl max-h-40 overflow-y-auto mt-1 no-scrollbar text-left">
                        {filtered.map((item, idx) => (
                            <li
                                key={`${item}-${idx}`}
                                className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-sm text-slate-700 hover:text-black transition-colors"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelect(item);
                                }}
                            >
                                {item}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

const initialState = {
    name: '',
    category: '',
    brand: '',
    price: '',
    stock: '',
    barcode: '',
    barcodeType: 'CODE128',
    taxRate: '', // Changed to empty string to avoid default 0
    costPrice: '',
    minStock: 10,
    unit: '',
    description: '',
    expiryDate: '',
    isActive: true,
    hasVariants: false,
    variants: []
};

// Predefined Lists
const UNIT_OPTIONS = ['pc', 'kg', 'g', 'l', 'ml', 'box', 'pack', 'meter', 'sq.ft', 'dozen', 'set'];
// const GST_RATES = [0, 3, 5, 12, 18, 28]; // Moved to dynamic settings

const ProductDrawer = ({ isOpen, onClose, product, onSave, existingUnits, existingCategories, existingBrands }) => {
    const title = product ? 'Edit Product' : 'Add New Product';

    const [formData, setFormData] = useState(initialState);
    const [isLookingUp, setIsLookingUp] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showUnitSuggestions, setShowUnitSuggestions] = useState(false);
    const priceInputRef = useRef(null);
    const toast = useToast();
    const { settings } = useSettings();

    // Compute Tax Options from Settings or Fallback
    const taxOptions = React.useMemo(() => {
        if (settings?.tax?.taxGroups && settings.tax.taxGroups.length > 0) {
            return settings.tax.taxGroups.map(g => ({ label: `${g.name} (${g.rate}%)`, value: g.rate }));
        }
        return [0, 3, 5, 12, 18, 28].map(r => ({ label: `${r}%`, value: r }));
    }, [settings]);

    // Reset or Populate Form
    useEffect(() => {
        if (isOpen) {
            setIsSaving(false);
            if (product) {
                setFormData({
                    ...initialState,
                    ...product,
                    isActive: product.isActive !== undefined ? product.isActive : true,
                    hasVariants: product.variants && product.variants.length > 0,
                    variants: (product.variants || []).map(v => ({
                        ...v,
                        options: v.options || (v.option ? [v.option] : ['']),
                        costPrice: v.costPrice || '',
                        price: v.price || '',
                        stock: v.stock || ''
                    })),
                    barcode: product.barcode || product.sku || '',
                    taxRate: product.taxRate !== undefined ? product.taxRate : (product.tax_rate !== undefined ? product.tax_rate : ''),
                    unit: product.unit || '',
                    price: product.price || '',
                    stock: product.stock || '',
                    costPrice: product.costPrice || ''
                });
            } else {
                setFormData(initialState);
            }
        }
    }, [product, isOpen]);

    // Handle standard inputs with validation
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;

        // Prevent negative numbers
        if (type === 'number' && parseFloat(value) < 0) {
            return;
        }

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // Calculate Margin for Simple Product
    const calculateMargin = (cp, sp) => {
        const cost = parseFloat(cp) || 0;
        const selling = parseFloat(sp) || 0;
        if (selling === 0) return { amount: 0, percent: 0, color: 'text-slate-500', bg: 'bg-slate-100' };

        const marginInfo = selling - cost;
        const percent = ((marginInfo / selling) * 100).toFixed(1);

        let color = 'text-black';
        let bg = 'bg-neutral-100';

        if (percent < 15) {
            color = 'text-black';
            bg = 'bg-neutral-200';
        } else if (percent < 30) {
            color = 'text-black';
            bg = 'bg-slate-100';
        }

        return { amount: marginInfo.toFixed(2), percent, color, bg };
    };

    const margin = calculateMargin(formData.costPrice, formData.price);

    // Variant Helpers
    const handleAddVariant = () => {
        setFormData(prev => ({
            ...prev,
            variants: [
                ...prev.variants,
                {
                    name: 'Variant',
                    options: [''],
                    price: prev.price || '',
                    costPrice: prev.costPrice || '',
                    stock: ''
                }
            ]
        }));
    };

    const handleRemoveVariant = (index) => {
        setFormData(prev => ({
            ...prev,
            variants: prev.variants.filter((_, i) => i !== index)
        }));
    };

    const handleVariantChange = (index, field, value) => {
        // Prevent negative
        if ((field === 'price' || field === 'stock' || field === 'costPrice') && parseFloat(value) < 0) return;

        setFormData(prev => {
            const newVariants = prev.variants.map((v, i) => {
                if (i === index) {
                    const updatedVariant = { ...v };
                    if (field === 'option') {
                        updatedVariant.options = [value];
                    } else {
                        updatedVariant[field] = value;
                    }
                    return updatedVariant;
                }
                return v;
            });
            return { ...prev, variants: newVariants };
        });
    };

    const handleSave = async (addAnother = false) => {
        if (isSaving) return;

        // Mandatory Field Validation
        const requiredFields = [
            { key: 'name', label: 'Product Name' },
            { key: 'category', label: 'Category' },
            { key: 'barcode', label: 'Barcode/SKU' },
            { key: 'unit', label: 'Unit' },
            { key: 'taxRate', label: 'Tax Rate' }
        ];

        for (const field of requiredFields) {
            if (!formData[field.key] && formData[field.key] !== 0) {
                toast.warning(`${field.label} is required.`);
                return;
            }
        }

        if (!formData.hasVariants) {
            if (!formData.costPrice && formData.costPrice !== 0) { toast.warning('Cost Price is required.'); return; }
            if (!formData.price && formData.price !== 0) { toast.warning('Selling Price is required.'); return; }
            if (!formData.stock && formData.stock !== 0) { toast.warning('Current Stock is required.'); return; }
        }

        // Basic validation for variants
        if (formData.hasVariants) {
            if (formData.variants.length === 0) {
                toast.warning('Please add at least one variant or disable variants.');
                return;
            }
            // Check for empty names or missing price/stock/cost
            const invalidVariant = formData.variants.find(v =>
                !v.options[0] || v.options[0].trim() === '' ||
                v.price === '' || v.price === undefined ||
                v.costPrice === '' || v.costPrice === undefined ||
                v.stock === '' || v.stock === undefined
            );
            if (invalidVariant) {
                toast.warning('All variants must have Name, Cost Price, Selling Price, and Stock.');
                return;
            }
        }

        const payload = { ...formData };
        payload.sku = payload.barcode;

        if (!payload.hasVariants) {
            payload.variants = [];
            payload.price = parseFloat(payload.price);
            payload.costPrice = parseFloat(payload.costPrice);
            payload.stock = parseInt(payload.stock);
            payload.taxRate = parseFloat(payload.taxRate);
        } else {
            // Clean variants
            payload.variants = payload.variants.map(v => ({
                ...v,
                options: v.options,
                price: parseFloat(v.price) || 0,
                costPrice: parseFloat(v.costPrice) || 0,
                stock: parseInt(v.stock) || 0
            }));

            payload.stock = payload.variants.reduce((acc, v) => acc + v.stock, 0);
            payload.taxRate = parseFloat(payload.taxRate);
        }

        delete payload.hasVariants;

        setIsSaving(true);

        try {
            const savedProduct = await onSave(payload);

            try {
                const eventType = product ? 'PRODUCT_UPDATED' : 'PRODUCT_CREATED';
                const finalPayload = savedProduct || payload;
                await syncService.uploadEvent(eventType, finalPayload);
            } catch (syncError) {
                console.error("Failed to upload sync event:", syncError);
            }

            if (addAnother) {
                setFormData(prev => ({
                    ...initialState,
                    category: prev.category,
                    brand: prev.brand,
                    unit: prev.unit,
                    taxRate: prev.taxRate
                }));
                setTimeout(() => {
                    const nameInput = document.querySelector('input[name="name"]');
                    if (nameInput) nameInput.focus();
                }, 0);
            } else {
                onClose();
            }
        } catch (error) {
            console.error("Error saving product:", error);
            toast.error("Failed to save product.");
        } finally {
            setIsSaving(false);
        }
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                handleSave(true);
                return;
            }
            if (e.key === 'Enter') {
                if (document.activeElement.tagName.toLowerCase() === 'textarea') return;
                if (document.activeElement.name === 'barcode') return;
                e.preventDefault();
                handleSave(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, formData]);


    const handleBarcodeLookup = async () => {
        const code = formData.barcode;
        if (!code) return;
        setIsLookingUp(true);
        try {
            const metadata = await fetchProductMetadata(code);
            if (metadata) {
                setFormData(prev => ({
                    ...prev,
                    name: metadata.name || prev.name,
                    brand: metadata.brand || prev.brand,
                    category: metadata.category || prev.category,
                    barcodeType: code.length === 13 ? 'EAN13' : code.length === 12 ? 'UPC' : prev.barcodeType
                }));
                setTimeout(() => priceInputRef.current?.focus(), 100);
            } else {
                toast.warning('Product details not found.');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLookingUp(false);
        }
    };

    const stockPresets = [0, 5, 10, 25];

    return (
        <Drawer isOpen={isOpen} onClose={onClose} title={title} width="max-w-4xl">
            <div className="space-y-6 h-full flex flex-col relative">

                <div className="flex-1 space-y-6 overflow-y-auto pb-4 pr-1">

                    <div className="space-y-4">
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex-1 space-y-2">
                                <label className="text-sm font-medium text-slate-700">Product Name <span className="text-black font-bold">*</span></label>
                                <Input
                                    name="name"
                                    placeholder="e.g. Premium Cotton Shirt"
                                    value={formData.name}
                                    onChange={handleChange}
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-2 flex flex-col items-end">
                                <label className="text-sm font-medium text-slate-700">Status</label>
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
                                    className={`relative inline-flex h-9 w-24 items-center rounded-full transition-colors ${formData.isActive ? 'bg-black' : 'bg-slate-100'} border ${formData.isActive ? 'border-black' : 'border-slate-200'}`}
                                >
                                    <span className={`inline-block h-7 w-7 transform rounded-full bg-white shadow transition-transform ${formData.isActive ? 'translate-x-[60px] bg-white' : 'translate-x-1 bg-slate-400'}`} />
                                    <span className={`absolute text-xs font-semibold ${formData.isActive ? 'left-3 text-white' : 'right-3 text-slate-500'}`}>
                                        {formData.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <AutocompleteInput
                                label="Category"
                                name="category"
                                value={formData.category}
                                onChange={handleChange}
                                suggestions={existingCategories}
                                placeholder="Select or Type Category"
                            />
                            <AutocompleteInput
                                label="Brand"
                                name="brand"
                                value={formData.brand}
                                onChange={handleChange}
                                suggestions={existingBrands}
                                placeholder="Brand Name"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Description</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="Add product details, size info, or notes..."
                                className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
                            />
                        </div>
                    </div>

                    <div className="h-px bg-slate-100" />

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-semibold text-sm text-slate-900">Pricing & Inventory</h4>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-600">Has Variants?</span>
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-slate-300 text-black focus:ring-black"
                                    checked={formData.hasVariants}
                                    onChange={(e) => setFormData(prev => ({ ...prev, hasVariants: e.target.checked }))}
                                />
                            </div>
                        </div>

                        {!formData.hasVariants && (
                            <>
                                <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Cost Price <span className="text-black font-bold">*</span></label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                                            <Input
                                                name="costPrice"
                                                type="number"
                                                placeholder=""
                                                value={formData.costPrice}
                                                onChange={handleChange}
                                                className="pl-7"
                                                min="0"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Selling Price <span className="text-black font-bold">*</span></label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                                            <Input
                                                name="price"
                                                type="number"
                                                placeholder=""
                                                value={formData.price}
                                                onChange={handleChange}
                                                className="pl-7"
                                                ref={priceInputRef}
                                                min="0"
                                            />
                                        </div>
                                    </div>

                                    <div className="col-span-2 flex justify-end">
                                        <div className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 animate-in fade-in duration-300 ${margin.bg} ${margin.color}`}>
                                            <Calculator size={14} />
                                            Margin: ₹{margin.amount} ({margin.percent}%)
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Current Stock <span className="text-black font-bold">*</span></label>
                                        <Input
                                            name="stock"
                                            type="number"
                                            placeholder=""
                                            value={formData.stock}
                                            onChange={handleChange}
                                            min="0"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Min. Stock Alert</label>
                                        <div className="space-y-2">
                                            <Input
                                                name="minStock"
                                                type="number"
                                                placeholder="10"
                                                value={formData.minStock}
                                                onChange={handleChange}
                                                min="0"
                                            />
                                            <div className="flex gap-2">
                                                {stockPresets.map(preset => (
                                                    <button
                                                        key={preset}
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({ ...prev, minStock: preset }))}
                                                        className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors"
                                                    >
                                                        {preset}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {formData.hasVariants && (
                            <div className="space-y-3">
                                <div className="flex justify-end">
                                    <Button size="sm" variant="outline" onClick={handleAddVariant}>
                                        <Plus className="h-4 w-4 mr-2" /> Add Variant
                                    </Button>
                                </div>
                                <div className="rounded-md border border-slate-200 overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Variant Name</TableHead>
                                                <TableHead>Cost Price</TableHead>
                                                <TableHead>Selling Price</TableHead>
                                                <TableHead>Margin</TableHead>
                                                <TableHead>Stock</TableHead>
                                                <TableHead className="w-[50px]"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {formData.variants.map((variant, index) => {
                                                const vMargin = calculateMargin(variant.costPrice, variant.price);
                                                return (
                                                    <TableRow key={index}>
                                                        <TableCell>
                                                            <Input
                                                                placeholder="Small, Red, etc."
                                                                value={variant.options[0] || ''}
                                                                onChange={(e) => handleVariantChange(index, 'option', e.target.value)}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number"
                                                                placeholder=""
                                                                value={variant.costPrice}
                                                                onChange={(e) => handleVariantChange(index, 'costPrice', e.target.value)}
                                                                min="0"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number"
                                                                placeholder=""
                                                                value={variant.price}
                                                                onChange={(e) => handleVariantChange(index, 'price', e.target.value)}
                                                                min="0"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className={`text-xs font-medium ${vMargin.color}`}>
                                                                {formatCappedPercentage(vMargin.percent)}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number"
                                                                placeholder=""
                                                                value={variant.stock}
                                                                onChange={(e) => handleVariantChange(index, 'stock', e.target.value)}
                                                                min="0"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="text-slate-500 hover:text-black hover:bg-slate-100"
                                                                onClick={() => handleRemoveVariant(index)}
                                                            >
                                                                <Trash size={16} />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                            {formData.variants.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                                                        No variants added. Click "Add Variant" to start.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Common Details (Unit, Barcode, etc) */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                        <div className="relative">
                            <label className="text-sm font-medium text-slate-700">Unit <span className="text-black font-bold">*</span></label>
                            {/* Replaced Input with Select/Autocomplete Logic wrapper or simple select */}
                            {/* Using Autocomplete behavior logic but with predefined list only */}
                            <div className="relative">
                                <select
                                    name="unit"
                                    value={formData.unit}
                                    onChange={handleChange}
                                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                                >
                                    <option value="" disabled>Select Unit</option>
                                    {UNIT_OPTIONS.map(u => (
                                        <option key={u} value={u}>{u}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Tax Rate (%) <span className="text-black font-bold">*</span></label>
                            <select
                                name="taxRate"
                                value={formData.taxRate}
                                onChange={handleChange}
                                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                            >
                                <option value="" disabled>Select Tax Rate</option>
                                {taxOptions.map(opt => (
                                    <option key={opt.value + opt.label} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Barcode Section */}
                        <div className="space-y-2 col-span-2">
                            <div className="flex justify-between">
                                <label className="text-sm font-medium text-slate-700">Barcode / SKU <span className="text-black font-bold">*</span></label>
                                <label className="text-sm font-medium text-slate-700">Type</label>
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1 relative">
                                    <Input
                                        name="barcode"
                                        placeholder="Scan or enter"
                                        value={formData.barcode}
                                        onChange={handleChange}
                                        autoComplete="off"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleBarcodeLookup();
                                            }
                                        }}
                                        className="pr-20"
                                    />
                                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            className="h-7 w-7 p-0 text-slate-400 hover:text-black"
                                            onClick={() => {
                                                const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
                                                const random = Math.random().toString(36).substring(2, 6).toUpperCase();
                                                const newSku = `SKU-${timestamp}${random}`;
                                                setFormData(prev => ({ ...prev, barcode: newSku }));
                                            }}
                                            title="Generate Random SKU"
                                        >
                                            <Calculator className="h-4 w-4" />
                                        </Button>
                                        <div className="w-px h-4 bg-slate-200 mx-1"></div>
                                        <Button
                                            variant="ghost"
                                            className="h-7 w-7 p-0 text-slate-400 hover:text-black"
                                            onClick={handleBarcodeLookup}
                                            disabled={!formData.barcode || isLookingUp}
                                            title="Lookup Product Details"
                                        >
                                            {isLookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                                <select
                                    name="barcodeType"
                                    value={formData.barcodeType}
                                    onChange={handleChange}
                                    className="w-32 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                                >
                                    <option value="CODE128">CODE-128</option>
                                    <option value="EAN13">EAN-13</option>
                                    <option value="UPC">UPC-A</option>
                                </select>
                            </div>
                            <p className="text-xs text-slate-500">
                                Click the <Calculator className="inline h-3 w-3 mx-0.5" /> icon to generate a unique SKU if the product has no barcode.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Expiry Date</label>
                            <Input
                                name="expiryDate"
                                type="date"
                                value={formData.expiryDate ? new Date(formData.expiryDate).toISOString().split('T')[0] : ''}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-4 flex flex-col gap-3 border-t border-slate-100 bg-white z-10">
                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={onClose} disabled={isSaving}>
                            Cancel <span className="ml-2 text-xs text-slate-400 font-normal">Esc</span>
                        </Button>
                        <Button variant="secondary" className="flex-1" onClick={() => handleSave(true)} disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save & Add Another'} <span className="ml-2 text-xs text-slate-500 font-normal">Ctrl+S</span>
                        </Button>
                        <Button className="flex-1 bg-black hover:bg-neutral-800 text-white" onClick={() => handleSave(false)} disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save & Close'} <span className="ml-2 text-xs text-white/50 font-normal">Enter</span>
                        </Button>
                    </div>
                </div>
            </div>
        </Drawer>
    );
};

export default ProductDrawer;
