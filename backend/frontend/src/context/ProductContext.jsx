import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import services from '../services/api';
import { useAuth } from './AuthContext';
import { syncService } from '../services/syncService';

export const ProductContext = createContext();

export const useProducts = () => {
    const context = useContext(ProductContext);
    if (!context) {
        throw new Error('useProducts must be used within a ProductProvider');
    }
    return context;
};

export const ProductProvider = ({ children }) => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isImporting, setIsImporting] = useState(false);
    const { user, isLoading: authLoading } = useAuth();

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        try {
            const response = await services.products.getAll();
            setProducts((response.data || []).filter(Boolean));
        } catch (error) {
            console.error("Failed to fetch products", error);
            setProducts([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Only fetch if user is authenticated and auth is not loading
        if (authLoading || !user) {
            setLoading(false);
            if (!user) {
                setProducts([]);
            }
            return;
        }

        fetchProducts();
    }, [user, authLoading]);

    const addProduct = useCallback(async (productData) => {
        try {
            // Ensure sku is present for backend compatibility (it requires unique sku)
            // Strip UI-only fields like 'hasVariants'
            const { hasVariants, ...rest } = productData;

            const payload = {
                ...rest,
                price: parseFloat(productData.price) || 0,
                stock: parseInt(productData.stock) || 0,
                sku: productData.barcode || `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                expiryDate: productData.expiryDate || null
            };

            const response = await services.products.create(payload);
            const newProduct = response.data;
            setProducts(prev => [...prev, newProduct]);
            return newProduct;
        } catch (error) {
            console.error("Failed to add product", error);
            throw error;
        }
    }, []);

    const addManyProducts = useCallback(async (productsArray) => {
        setIsImporting(true);
        try {
            const addedProductsData = [];
            let skippedCount = 0;
            const currentProducts = products;

            // Helper for safe number conversion
            const safeFloat = (val) => {
                const num = parseFloat(val);
                return isNaN(num) ? 0 : num;
            };

            const safeInt = (val) => {
                const num = parseInt(val, 10);
                return isNaN(num) ? 0 : num;
            };

            let i = 0;
            for (const rawP of productsArray) {
                i++;
                // Normalize keys: trim and lowercase
                const p = {};
                Object.keys(rawP).forEach(key => {
                    p[key.trim().toLowerCase()] = rawP[key];
                });

                const getVal = (keys) => {
                    for (let k of keys) {
                        if (p[k] !== undefined) return p[k];
                    }
                    return undefined;
                };

                const nameVal = getVal(['name', 'product name', 'productname', 'item', 'item name', 'title', 'description', 'desc', 'particulars', 'model', 'product description']);
                const name = (nameVal && nameVal.toString().trim()) ? nameVal.toString().trim() : 'Imported Product';

                // Check for duplicates
                const barcodeVal = getVal(['barcode', 'code', 'upc', 'ean', 'sku']);
                const barcode = barcodeVal || `GEN-${Date.now()}-${Math.floor(Math.random() * 100000)}-${i}`;

                // Duplicate Check: Check against current products AND items already added to array
                const isDuplicate = currentProducts.some(existing => {
                    const sName = String(name).toLowerCase();
                    const sBarcode = String(barcode).toLowerCase();

                    if (barcodeVal && existing.barcode && String(existing.barcode).toLowerCase() === sBarcode) return true;
                    if (!barcodeVal && existing.name && String(existing.name).toLowerCase() === sName) return true;

                    return false;
                }) || addedProductsData.some(existing => {
                    if (barcodeVal && existing.barcode && String(existing.barcode).toLowerCase() === String(barcode).toLowerCase()) return true;
                    if (!barcodeVal && existing.name && String(existing.name).toLowerCase() === String(name).toLowerCase()) return true;
                    return false;
                });

                if (isDuplicate) {
                    console.log("Skipping duplicate:", name, barcode);
                    skippedCount++;
                    continue;
                }

                const price = safeFloat(getVal(['price', 'mrp', 'rate', 'cost', 'amount', 'selling price', 'sp', 'unit price']));

                const productData = {
                    name: name,
                    category: getVal(['category', 'group', 'type']) || 'Uncategorized',
                    brand: getVal(['brand', 'company', 'make']) || '',
                    price: price, // Selling Price
                    stock: safeInt(getVal(['stock', 'current stock', 'qty', 'quantity'])),
                    barcode: barcode,
                    sku: barcode,
                    unit: getVal(['unit', 'uom', 'measure']) || 'pc',
                    description: getVal(['description', 'desc', 'details']) || '',
                    minStock: safeInt(getVal(['min stock', 'minimum stock', 'alert', 'low stock', 'min. stock alert'])),
                    costPrice: safeFloat(getVal(['cost', 'cost price', 'buying price', 'cp'])),
                    taxRate: safeFloat(getVal(['tax', 'tax rate', 'gst', 'tax rate (%)'])),
                    variants: []
                };

                addedProductsData.push(productData);
            }

            let actualAddedCount = 0;
            if (addedProductsData.length > 0) {
                // Call BULK API
                const resp = await services.products.createMany(addedProductsData);
                actualAddedCount = resp?.data?.addedCount || addedProductsData.length;

                // If backend added fewer than we sent, add the difference to skipped
                if (actualAddedCount < addedProductsData.length) {
                    skippedCount += (addedProductsData.length - actualAddedCount);
                }

                // Refresh list completely from backend since we don't return all models directly from bulk
                await fetchProducts();

                // Fire off a silent background data push to update snapshots on Drive since this is a heavy operation
                syncService.pushAllData(false).catch(err => console.error("Background snapshot push failed:", err));
            }

            return { added: actualAddedCount, skipped: skippedCount };
        } catch (error) {
            console.error("Bulk import failed:", error);
            throw error;
        } finally {
            setIsImporting(false);
        }
    }, [products, fetchProducts]);

    const updateProduct = useCallback(async (id, updatedData) => {
        try {
            const { hasVariants, ...rest } = updatedData;
            const payload = {
                ...rest,
                price: parseFloat(updatedData.price) || 0,
                stock: parseInt(updatedData.stock) || 0,
                costPrice: parseFloat(updatedData.costPrice) || 0,
                taxRate: parseFloat(updatedData.taxRate) || 0,
                minStock: parseInt(updatedData.minStock) || 0,
                expiryDate: updatedData.expiryDate || null
            };
            const response = await services.products.update(id, payload);
            const updatedProduct = response.data;
            setProducts(prev => prev.map(p => p.id === id ? updatedProduct : p).filter(Boolean));
            return updatedProduct;
        } catch (error) {
            console.error("Failed to update product", error);
            throw error;
        }
    }, []);

    const deleteProduct = useCallback(async (id) => {
        try {
            await services.products.delete(id);
            setProducts(prev => prev.filter(p => p.id !== id));

            // Emit sync events for backups
            syncService.uploadEvent('PRODUCT_DELETED', { productId: id }).catch(console.error);
        } catch (error) {
            console.error("Failed to delete product", error);
            throw error;
        }
    }, []);

    const updateStock = useCallback(async (id, quantityChange) => {
        // Use functional update to access current product without dependency
        let product = null;
        setProducts(prev => {
            product = prev.find(p => p.id === id);
            return prev;
        });

        if (product) {
            const newStock = Math.max(0, product.stock + quantityChange);
            await updateProduct(id, { stock: newStock });
        }
    }, [updateProduct]); // Only depend on updateProduct which is stable

    const bulkDeleteProducts = useCallback(async (idsArray) => {
        if (!idsArray || idsArray.length === 0) return;
        setIsImporting(true); // Using same loader state for simplicity
        try {
            await services.products.bulkDelete(idsArray);
            setProducts(prev => prev.filter(p => !idsArray.includes(p.id)));

            // Since this is a massive bulk change, doing individual events is too heavy. Refresh the snapshots.
            syncService.pushAllData(false).catch(err => console.error("Background snapshot push failed:", err));
        } catch (error) {
            console.error("Failed to bulk delete products", error);
            throw error;
        } finally {
            setIsImporting(false);
        }
    }, []);

    const getProductByBarcode = useCallback((code) => {
        return products.find(p => p.barcode === code);
    }, [products]);

    const value = useMemo(() => ({
        products,
        addProduct,
        addManyProducts,
        updateProduct,
        deleteProduct,
        bulkDeleteProducts,
        updateStock,
        getProductByBarcode,
        refreshProducts: fetchProducts,
        loading,
        isImporting
    }), [
        products,
        addProduct,
        addManyProducts,
        updateProduct,
        deleteProduct,
        bulkDeleteProducts,
        updateStock,
        getProductByBarcode,
        fetchProducts,
        loading,
        isImporting
    ]);

    return (
        <ProductContext.Provider value={value}>
            {children}
        </ProductContext.Provider>
    );
};
