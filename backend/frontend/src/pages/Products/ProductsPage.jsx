import React, { useState, useMemo } from 'react';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../context/ToastContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Search, Plus, Download, Upload, MoreHorizontal, Edit, Trash, Filter, ChevronDown, Copy, Eye, MoreVertical, ListChecks, Check } from 'lucide-react';
import { useProducts } from '../../context/ProductContext';
import ProductDrawer from './ProductDrawer';

import ProductStats from './components/ProductStats';
import ProductToolbar from './components/ProductToolbar';
import ProductInsights from './components/ProductInsights';
import ProductTemplateWizard from './ProductTemplateWizard'; // Import the wizard
import { read, utils, writeFile } from 'xlsx';
import { isSearchMatch } from '../../utils/searchUtils';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';

const ProductsPage = () => {
    const toast = useToast();
    const { products, addProduct, addManyProducts, updateProduct, deleteProduct, bulkDeleteProducts, loading, isImporting, refreshProducts } = useProducts();

    // UI State
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState(null); // For Drawer (Edit)

    // Derive selected product from live list so it stays fresh
    const selectedProduct = useMemo(() =>
        products.find(p => p.id === selectedProductId) || null
        , [products, selectedProductId]);
    const [focusedProduct, setFocusedProduct] = useState(null);   // For Insights Panel
    const [isCategoryWizardOpen, setIsCategoryWizardOpen] = useState(false);
    const [isTemplateWizardOpen, setIsTemplateWizardOpen] = useState(false); // New State
    const [viewMode, setViewMode] = useState('comfortable'); // 'compact' | 'comfortable'

    const [isSelectionMode, setIsSelectionMode] = useState(false);

    // Filter & Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportOptions, setExportOptions] = useState({
        type: 'all_time',
        startDate: '',
        endDate: '',
        specificMonth: ''
    });
    const [filters, setFilters] = useState({
        category: null,
        brand: null,
        status: 'all', // 'all', 'active', 'inactive', 'lowStock', 'outOfStock'
        timePeriod: 'all' // 'all', 'today', 'week', 'month'
    });

    // Selection State
    const [selectedRows, setSelectedRows] = useState(new Set());

    // Extract Unique Categories & Brands (Memoized)
    const { uniqueCategories, uniqueBrands } = useMemo(() => {
        const categories = new Set();
        const brands = new Set();
        products.forEach(p => {
            categories.add(p.category || 'Uncategorized');
            if (p.brand) brands.add(p.brand);
        });
        return {
            uniqueCategories: [...categories].filter(Boolean).sort(),
            uniqueBrands: [...brands].sort()
        };
    }, [products]);

    // Filtering Logic
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            // Search
            const matchesSearch = !searchTerm || (
                isSearchMatch(p.name, searchTerm) ||
                isSearchMatch(p.category, searchTerm) ||
                isSearchMatch(p.brand, searchTerm) ||
                isSearchMatch(p.barcode, searchTerm) ||
                isSearchMatch(p.sku, searchTerm) ||
                (p.variants && p.variants.some(v =>
                    isSearchMatch(v.option, searchTerm) ||
                    (v.options && v.options[0] && isSearchMatch(v.options[0], searchTerm))
                ))
            );

            if (!matchesSearch) return false;

            // Category
            if (filters.category && p.category !== filters.category) return false;

            // Brand
            if (filters.brand && p.brand !== filters.brand) return false;

            // Status / Stock Filters
            if (filters.status === 'active' && !p.isActive) return false;
            if (filters.status === 'inactive' && p.isActive) return false;
            if (filters.status === 'lowStock' && (p.stock > (p.minStock || 10) || p.stock === 0)) return false;
            if (filters.status === 'outOfStock' && p.stock > 0) return false;

            // Time Period Filter
            if (filters.timePeriod && filters.timePeriod !== 'all') {
                const createdDate = new Date(p.created_at || p.createdAt || p.updated_at || Date.now());
                const now = new Date();

                if (filters.timePeriod === 'today') {
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    if (createdDate < today) return false;
                } else if (filters.timePeriod === 'week') {
                    // Start of current week (Sunday)
                    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
                    startOfWeek.setHours(0, 0, 0, 0);
                    if (createdDate < startOfWeek) return false;
                } else if (filters.timePeriod === 'month') {
                    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    if (createdDate < startOfMonth) return false;
                }
            }

            return true;
        });
    }, [products, searchTerm, filters]);

    // Handlers
    const handleEdit = (product, e) => {
        e?.stopPropagation();
        setSelectedProductId(product.id);
        setIsDrawerOpen(true);
    };

    const handleAddNew = () => {
        setSelectedProductId(null);
        setIsDrawerOpen(true);
    };

    const handleDelete = async (id, e) => {
        e?.stopPropagation();
        if (window.confirm('Are you sure you want to delete this product?')) {
            try {
                await deleteProduct(id);
                if (focusedProduct?.id === id) setFocusedProduct(null);
            } catch (error) {
                toast.error('Failed to delete product');
            }
        }
    };

    const handleRowClick = (product) => {
        setFocusedProduct(product);
    };

    const handleSelectionChange = (id) => {
        const newSelected = new Set(selectedRows);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedRows(newSelected);
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedRows(new Set(filteredProducts.map(p => p.id)));
        } else {
            setSelectedRows(new Set());
        }
    };

    const handleBulkDelete = async () => {
        if (selectedRows.size === 0) return;
        if (window.confirm(`Delete ${selectedRows.size} products?`)) {
            try {
                const idsArray = Array.from(selectedRows);
                await bulkDeleteProducts(idsArray);
                setSelectedRows(new Set());
                toast.success(`Successfully deleted ${idsArray.length} products.`);
            } catch (error) {
                toast.error("Failed to delete selected products.");
            }
        }
    };

    const handleBulkStatusChange = async (isActive) => {
        // Sequential update
        for (const id of selectedRows) {
            const product = products.find(p => p.id === id);
            if (product) {
                await updateProduct(id, { ...product, isActive });
            }
        }
        setSelectedRows(new Set());
    };

    const handleBulkExport = () => {
        const selectedProducts = products.filter(p => selectedRows.has(p.id));
        const ws = utils.json_to_sheet(selectedProducts);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Selected Products");
        writeFile(wb, "selected_products.xlsx");
        setSelectedRows(new Set());
    };

    const handleConfirmExport = async () => {
        try {
            let start, end;
            const now = new Date();

            if (exportOptions.type === 'this_month') {
                const s = new Date(now.getFullYear(), now.getMonth(), 1);
                const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                start = s.getTime(); end = e.getTime();
            } else if (exportOptions.type === 'last_month') {
                const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
                start = s.getTime(); end = e.getTime();
            } else if (exportOptions.type === 'specific_month' && exportOptions.specificMonth) {
                const [year, month] = exportOptions.specificMonth.split('-');
                const s = new Date(parseInt(year), parseInt(month) - 1, 1);
                const e = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
                start = s.getTime(); end = e.getTime();
            } else if (exportOptions.type === 'date_range' && exportOptions.startDate && exportOptions.endDate) {
                const s = new Date(exportOptions.startDate);
                s.setHours(0, 0, 0, 0);
                const e = new Date(exportOptions.endDate);
                e.setHours(23, 59, 59, 999);
                start = s.getTime(); end = e.getTime();
            } else if (exportOptions.type === 'all_time') {
                start = 0;
                end = Date.now() + 100000000000;
            } else {
                alert("Please select valid dates for export.");
                return;
            }

            const exportData = products.filter(p => {
                const createdDate = new Date(p.created_at || p.createdAt || p.updated_at || Date.now()).getTime();
                return createdDate >= start && createdDate <= end;
            });

            if (exportData.length === 0) {
                toast.info("No records found in the selected date range.");
                return;
            }

            const ws = utils.json_to_sheet(exportData);
            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, "Products_Export");
            writeFile(wb, `Products_Export_${exportOptions.type}_${new Date().toISOString().split('T')[0]}.xlsx`);
            setShowExportModal(false);
        } catch (error) {
            console.error("Export failed", error);
            toast.error("Export failed: " + error.message);
        }
    };

    // Import/Export Logic
    const handleFileUpload = (e) => { /* ... Reusing existing logic ... */
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const ab = evt.target.result;
                const wb = read(ab, { type: 'array' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];

                // SMART HEADER DETECTION:
                // 1. Read first 20 rows as array of arrays
                const rawRows = utils.sheet_to_json(ws, { header: 1, range: 0, raw: false });

                // 2. Find row index that looks like a header (contains 'name' or 'item' AND 'price' or 'stock')
                let headerIndex = 0;
                for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
                    const rowStr = rawRows[i].map(c => String(c).toLowerCase());
                    const hasName = rowStr.some(c => c.includes('name') || c.includes('item') || c.includes('product') || c.includes('description'));
                    const hasPriceOrStock = rowStr.some(c => c.includes('price') || c.includes('stock') || c.includes('qty') || c.includes('amount') || c.includes('rate'));

                    if (hasName && hasPriceOrStock) {
                        headerIndex = i;
                        console.log("Found header at row:", i, rawRows[i]);
                        break;
                    }
                }

                // 3. Read JSON starting from that header index
                const data = utils.sheet_to_json(ws, { range: headerIndex });

                if (data.length > 0) {
                    if (window.confirm(`Found ${data.length} rows. Import them?`)) {
                        setIsTemplateWizardOpen(false); // Hide wizard immediately to show loader
                        const { added, skipped } = await addManyProducts(data);

                        if (added > 0) {
                            let msg = `Successfully imported ${added} products!`;
                            if (skipped > 0) msg += ` (${skipped} skipped as duplicates)`;
                            toast.success(msg);
                        } else if (skipped > 0) {
                            toast.info(`Import incomplete. All ${skipped} items were duplicates and skipped.`);
                        } else {
                            toast.info('Import finished but no products were added.');
                        }
                    }
                }
            } catch (error) {
                console.error("Import Error:", error);
                toast.error('Error processing file: ' + error.message);
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = null;
    };

    const handleSaveProduct = async (productData) => {
        try {
            if (selectedProduct) {
                await updateProduct(selectedProduct.id, productData);
            } else {
                await addProduct(productData);
            }
            await refreshProducts(); // Force refresh to ensure latest stock/variant data from backend
            setIsDrawerOpen(false);
        } catch (error) {
            const msg = error.response?.data?.message || 'Failed to save product';
            toast.error(msg);
            throw error; // Re-throw so ProductDrawer knows to stay open
        }
    };

    // Add Product Split Button Logic
    const [showAddMenu, setShowAddMenu] = useState(false);

    const handleToggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode);
        if (isSelectionMode) {
            setSelectedRows(new Set()); // Clear selection when exiting mode
        }
    };

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden ">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50">
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Header & Stats */}
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Products & Inventory</h1>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                                {/* Import Button */}
                                <Button
                                    variant="outline"
                                    onClick={() => setIsTemplateWizardOpen(true)}
                                    className="bg-white hover:bg-slate-50 border-slate-200 text-slate-600 shadow-sm w-full sm:w-auto"
                                    title="View Template / Import Products"
                                >
                                    <Upload className="mr-2 h-4 w-4" /> Import Data
                                </Button>

                                <Button
                                    variant="outline"
                                    onClick={refreshProducts}
                                    className="bg-white hover:bg-slate-50 border-slate-200 text-slate-600 shadow-sm w-full sm:w-auto"
                                    title="Force Refresh Data"
                                >
                                    <ListChecks className="mr-2 h-4 w-4" /> Refresh
                                </Button>

                                {/* Template Button */}
                                <Button
                                    variant="outline"
                                    onClick={() => setShowExportModal(true)}
                                    className="bg-white hover:bg-slate-50 border-slate-200 text-slate-600 shadow-sm w-full sm:w-auto"
                                >
                                    <Download className="mr-2 h-4 w-4" /> Export
                                </Button>

                                {/* Bulk Actions */}
                                {isSelectionMode && selectedRows.size > 0 && (
                                    <Button
                                        variant="outline"
                                        onClick={handleBulkDelete}
                                        className="bg-white hover:bg-zinc-50 border-zinc-200 hover:border-zinc-300 text-zinc-700 shadow-sm hover:shadow rounded-xl w-full sm:w-auto"
                                    >
                                        <Trash className="mr-2 h-4 w-4" />
                                        <span className="hidden sm:inline">Delete ({selectedRows.size})</span>
                                        <span className="sm:hidden">Del ({selectedRows.size})</span>
                                    </Button>
                                )}

                                {/* Selection/Export Toggle & Trigger */}
                                <Button
                                    variant={isSelectionMode ? "secondary" : "outline"}
                                    onClick={() => {
                                        if (isSelectionMode && selectedRows.size > 0) {
                                            handleBulkExport(); // Export if items selected
                                        } else {
                                            handleToggleSelectionMode(); // Toggle mode otherwise
                                        }
                                    }}
                                    className={`shadow-sm hover:shadow transition-all rounded-xl w-full sm:w-auto ${isSelectionMode ? 'bg-zinc-100 border-zinc-300 text-zinc-900' : 'bg-white border-zinc-200 hover:border-zinc-300 text-zinc-600'}`}
                                >
                                    {isSelectionMode ? (selectedRows.size > 0 ? <Download className="mr-2 h-4 w-4" /> : <ListChecks className="mr-2 h-4 w-4" />) : <ListChecks className="mr-2 h-4 w-4" />}
                                    <span className="hidden sm:inline">{isSelectionMode ? (selectedRows.size > 0 ? `Export (${selectedRows.size})` : 'Done Selecting') : 'Select / Export'}</span>
                                    <span className="sm:hidden">{isSelectionMode ? (selectedRows.size > 0 ? `Export (${selectedRows.size})` : 'Done') : 'Select'}</span>
                                </Button>

                                {/* Professional Add Product Button */}
                                <Button
                                    onClick={handleAddNew}
                                    className="bg-zinc-900 hover:bg-black text-white shadow-md hover:shadow-xl transition-all transform hover:-translate-y-0.5 rounded-xl w-full sm:w-auto font-medium"
                                >
                                    <Plus className="mr-2 h-4 w-4" /> Add Product
                                </Button>
                            </div>
                        </div>

                        <ProductStats
                            products={products}
                            currentFilter={filters.status}
                            onFilterChange={(status) => setFilters(prev => ({ ...prev, status }))}
                        />
                    </div>

                    {/* Toolbar */}
                    <ProductToolbar
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        categoryFilter={filters.category}
                        onCategoryChange={(c) => setFilters(prev => ({ ...prev, category: c }))}
                        brandFilter={filters.brand}
                        onBrandChange={(b) => setFilters(prev => ({ ...prev, brand: b }))}
                        timeFilter={filters.timePeriod}
                        onTimeFilterChange={(t) => setFilters(prev => ({ ...prev, timePeriod: t }))}
                        categories={uniqueCategories}
                        brands={uniqueBrands}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                    />

                    {/* List Area */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col flex-1 overflow-hidden min-h-[400px]">
                        <div className="flex-1 overflow-auto">
                            {loading || isImporting ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3">
                                    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
                                    <span className="font-medium text-slate-700 animate-pulse">
                                        {isImporting ? 'Importing Products...' : 'Loading inventory...'}
                                    </span>
                                </div>
                            ) : filteredProducts.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-slate-500">
                                    No products found matching your filters.
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                        <TableRow className="hover:bg-transparent border-b border-slate-200">
                                            {isSelectionMode && (
                                                <TableHead className="w-[40px] px-4">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-slate-300"
                                                        checked={filteredProducts.length > 0 && selectedRows.size === filteredProducts.length}
                                                        onChange={handleSelectAll}
                                                    />
                                                </TableHead>
                                            )}
                                            <TableHead className="min-w-[250px] px-4 font-medium text-slate-500">Product</TableHead>
                                            <TableHead className="w-[120px] px-4 hidden sm:table-cell font-medium text-slate-500">Category</TableHead>
                                            <TableHead className="w-[100px] px-4 hidden lg:table-cell font-medium text-slate-500">Brand</TableHead>
                                            <TableHead className="w-[100px] px-4 font-medium text-slate-500">Price</TableHead>
                                            <TableHead className="w-[100px] px-4 font-medium text-slate-500">Stock</TableHead>
                                            <TableHead className="w-[80px] px-4 hidden xl:table-cell font-medium text-slate-500">Unit</TableHead>
                                            <TableHead className="w-[120px] px-4 font-medium text-slate-500">Status</TableHead>
                                            <TableHead className="w-[100px] px-4 text-right font-medium text-slate-500">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredProducts.map((product) => (
                                            <ProductRow
                                                key={product.id}
                                                product={product}
                                                handlers={{ handleRowClick, handleSelectionChange, handleEdit, handleDelete }}
                                                state={{ isSelectionMode, selectedRows, focusedProduct, viewMode }}
                                            />
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {/* Right Panel: Insights */}
            {focusedProduct && (
                <ProductInsights
                    product={focusedProduct}
                    onClose={() => setFocusedProduct(null)}
                />
            )}

            {/* Drawers & Modals */}
            <ProductDrawer
                key={selectedProduct ? selectedProduct.id : 'new-product-drawer'}
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                product={selectedProduct}
                onSave={handleSaveProduct}
                existingUnits={[...new Set([...products.map(p => p.unit), 'pc', 'kg', 'g', 'l', 'ml', 'box', 'pack', 'meter', 'dozen'])].filter(Boolean).sort()}
                existingCategories={uniqueCategories}
                existingBrands={uniqueBrands}
            />

            <ProductTemplateWizard
                open={isTemplateWizardOpen}
                onClose={() => setIsTemplateWizardOpen(false)}
                onUpload={handleFileUpload}
            />

            <Modal isOpen={showExportModal} onClose={() => setShowExportModal(false)} title="Export Products" size="sm">
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1">Export Range</label>
                        <select
                            className="w-full border p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-900 border-slate-200"
                            value={exportOptions.type}
                            onChange={(e) => setExportOptions({ ...exportOptions, type: e.target.value })}
                        >
                            <option value="all_time">All Time</option>
                            <option value="this_month">This Month</option>
                            <option value="last_month">Last Month</option>
                            <option value="specific_month">Specific Month</option>
                            <option value="date_range">Custom Date Range</option>
                        </select>
                    </div>

                    {exportOptions.type === 'specific_month' && (
                        <div>
                            <label className="text-sm font-medium text-slate-700 block mb-1">Select Month</label>
                            <Input
                                type="month"
                                value={exportOptions.specificMonth}
                                onChange={(e) => setExportOptions({ ...exportOptions, specificMonth: e.target.value })}
                            />
                        </div>
                    )}

                    {exportOptions.type === 'date_range' && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-medium text-slate-700 block mb-1">Start Date</label>
                                <Input
                                    type="date"
                                    value={exportOptions.startDate}
                                    onChange={(e) => setExportOptions({ ...exportOptions, startDate: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 block mb-1">End Date</label>
                                <Input
                                    type="date"
                                    value={exportOptions.endDate}
                                    onChange={(e) => setExportOptions({ ...exportOptions, endDate: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    <div className="pt-4 flex justify-end gap-2 border-t mt-4">
                        <Button variant="outline" onClick={() => setShowExportModal(false)}>Cancel</Button>
                        <Button onClick={handleConfirmExport}>
                            Export
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Importing/Deleting Loader Overlay */}
            {isImporting && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-xl shadow-xl flex flex-col items-center max-w-sm w-full">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                        <h3 className="text-lg font-semibold text-slate-900">Processing...</h3>
                        <p className="text-sm text-slate-500 mt-2 text-center">Please wait while we process your products. This may take a moment.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

const ProductRow = React.memo(({ product, handlers, state }) => {
    const { handleRowClick, handleSelectionChange, handleEdit, handleDelete } = handlers;
    const { isSelectionMode, selectedRows, focusedProduct, viewMode } = state;
    // ... (rest of component is same, just standard memo wrap)
    const isSelected = selectedRows.has(product.id);
    const isFocused = focusedProduct?.id === product.id;
    const hasVariants = product.variants && product.variants.length > 0;
    const totalStock = hasVariants
        ? product.variants.reduce((acc, v) => acc + (v && v.stock ? (parseInt(v.stock) || 0) : 0), 0)
        : (product.stock || 0);

    const stockStatus = totalStock === 0 ? 'Out of Stock' : totalStock <= (product.minStock ?? 10) ? 'Low Stock' : 'In Stock';

    // Price Calculation
    const minPrice = hasVariants ? Math.min(...product.variants.map(v => v.price || 0)) : product.price;
    const maxPrice = hasVariants ? Math.max(...product.variants.map(v => v.price || 0)) : product.price;
    const priceDisplay = hasVariants && minPrice !== maxPrice
        ? `₹${minPrice} - ₹${maxPrice}`
        : `₹${(minPrice || 0).toFixed(2)}`;

    return (
        <TableRow
            className={`
                cursor-pointer transition-colors
                ${isSelected ? 'bg-zinc-50' : 'hover:bg-zinc-50/50'}
                ${isFocused ? 'bg-zinc-50 border-l-2 border-l-zinc-900' : ''}
            `}
            onClick={() => handleRowClick(product)}
        >
            {isSelectionMode && (
                <TableCell className="w-[40px] px-4">
                    <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        checked={isSelected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => handleSelectionChange(product.id)}
                    />
                </TableCell>
            )}
            <TableCell className="min-w-[250px] px-4">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span className={`font-medium ${!product.name ? 'text-slate-400 italic' : 'text-slate-900'} truncate`}>
                            {product.name || 'Unnamed Product'}
                        </span>
                        {hasVariants && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 h-auto bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border border-zinc-200 rounded-md shrink-0">
                                {product.variants.length} Var
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span className="font-mono bg-slate-100 px-1 rounded">{product.sku || 'NO-SKU'}</span>
                        {product.barcode && <span>• {product.barcode}</span>}
                    </div>
                </div>
            </TableCell>

            <TableCell className="w-[120px] px-4 hidden sm:table-cell">
                <Badge variant="outline" className={`font-normal truncate ${product.category ? 'bg-slate-50 text-slate-700 border-slate-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                    {product.category || 'Uncategorized'}
                </Badge>
            </TableCell>

            <TableCell className="w-[100px] px-4 hidden lg:table-cell text-sm text-slate-600 truncate">
                {product.brand || '-'}
            </TableCell>

            <TableCell className="w-[100px] px-4 font-medium">
                {priceDisplay}
            </TableCell>

            <TableCell className="w-[100px] px-4">
                <span className={`font-medium ${!totalStock ? 'text-zinc-900 font-semibold' : 'text-zinc-600'}`}>
                    {totalStock}
                </span>
            </TableCell>

            <TableCell className="w-[80px] px-4 text-sm text-slate-600 hidden xl:table-cell">
                {product.unit || '-'}
            </TableCell>

            <TableCell className="w-[120px] px-4">
                <Badge
                    variant="secondary"
                    className={`
                        ${product.isActive === false ? 'bg-slate-100 text-slate-500 border-slate-200' :
                            stockStatus === 'Out of Stock' ? 'bg-red-50 text-red-600 border-red-200' :
                                stockStatus === 'Low Stock' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    'bg-green-50 text-green-700 border-green-200'}
                        border px-2 py-0.5 rounded-full whitespace-nowrap
                    `}
                >
                    {product.isActive === false ? 'Inactive' : stockStatus}
                </Badge>
            </TableCell>

            <TableCell className="w-[100px] px-4">
                <div className="flex justify-end gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg"
                        onClick={(e) => handleEdit(product, e)}
                        title="Edit Product"
                    >
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-zinc-400 hover:text-red-700 hover:bg-red-50 rounded-lg"
                        onClick={(e) => handleDelete(product.id, e)}
                        title="Delete Product"
                    >
                        <Trash className="h-4 w-4" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
});

export default ProductsPage;
