import React, { createContext, useContext, useState, useEffect } from 'react';
import { triggerAutoSave } from '../services/autosaveService';
import { db } from '../services/database';
const { SyncService, EventTypes } = require('../services/OneWaySyncService');

const ProductContext = createContext();
export const useProducts = () => useContext(ProductContext);

export const ProductProvider = ({ children }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Normalization helper for variants
  // SECURITY: All numeric fields coerced with explicit radix (parseInt base-10) to prevent
  // octal parsing bugs. Barcode is sanitized to a plain string.
  const normalizeVariants = (variants) => {
    if (!Array.isArray(variants)) return [];
    return variants.filter(v => v && typeof v === 'object').map(v => {
      const computedCost = parseFloat(
        (v.cost_price !== undefined && v.cost_price !== null && v.cost_price !== '')
          ? v.cost_price
          : ((v.costPrice !== undefined && v.costPrice !== null && v.costPrice !== '') ? v.costPrice : 0)
      ) || 0;

      // Resolve stock from whichever field is present
      const rawStock =
        (v.stock !== undefined && v.stock !== null && v.stock !== '') ? v.stock
        : (v.qty !== undefined && v.qty !== null && v.qty !== '') ? v.qty
        : (v.quantity !== undefined && v.quantity !== null && v.quantity !== '') ? v.quantity
        : 0;

      // Resolve barcode: prefer explicit barcode field, fall back to sku
      const resolvedBarcode = String(v.barcode || v.sku || '').trim();

      return {
        ...v,
        name: String(v.name || v.detail || '').trim(),
        sku: String(v.sku || '').trim(),
        barcode: resolvedBarcode,          // ← NEW: per-variant barcode
        cost_price: computedCost,
        costPrice: computedCost,
        price: (v.price !== null && v.price !== undefined && v.price !== '') ? parseFloat(v.price) : null,
        stock: parseInt(rawStock, 10) || 0, // explicit radix 10
        tax_rate: parseFloat(v.tax_rate || v.taxRate || 0) || 0,
      };
    }); // filter(Boolean) removed as we now filter before map
  };

  const auth = require('./AuthContext').useAuth();
  const user = auth ? auth.user : null;

  // Initial load from SQLite - reload when user changes
  useEffect(() => {
    const loadProducts = async () => {
      if (!user) {
        setProducts([]);
        setLoading(false);
        return;
      }
      try {
        const data = await db.getAllAsync('SELECT * FROM products WHERE is_deleted = 0 ORDER BY name ASC');
        setProducts(data || []);

      } catch (err) {
        console.error('Failed to load products:', err);
      } finally {
        setLoading(false);
      }
    };
    loadProducts();

    // ═══════════════════════════════════════════════════════════════
    // AUTOMATIC REFRESH LISTENER
    // ═══════════════════════════════════════════════════════════════
    const { DeviceEventEmitter } = require('react-native');
    const { SYNC_EVENTS } = require('../services/OneWaySyncService');
    const refreshSub = DeviceEventEmitter.addListener(SYNC_EVENTS.DATA_UPDATED, () => {
        console.log('[ProductContext] Cloud data updated, refreshing state...');
        loadProducts();
    });

    return () => {
        refreshSub.remove();
    };
  }, [user?.id]);

  const fetchProducts = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await db.getAllAsync('SELECT * FROM products WHERE is_deleted = 0 ORDER BY name ASC');
      setProducts(data || []);

    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDeletedProducts = React.useCallback(async () => {
    try {
      const data = await db.getAllAsync('SELECT * FROM products WHERE is_deleted = 1 ORDER BY name ASC');
      return data || [];
    } catch (err) {
      console.error('Fetch deleted products error:', err);
      return [];
    }
  }, []);

  const addProduct = React.useCallback(async (data) => {

    try {
      const id = data.id || Date.now().toString();
      const sku = data.sku || data.barcode || "";

      const normalizedVariants = normalizeVariants(data.variants);
      await db.runAsync(
        `INSERT OR REPLACE INTO products (id, name, sku, category, price, cost_price, stock, min_stock, unit, tax_rate, variants, variant, created_at, is_deleted) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.name, sku, data.category, data.price, data.costPrice || 0, data.stock || 0, data.minStock || 0, data.unit, data.tax_rate, JSON.stringify(normalizedVariants), data.variant || null, new Date().toISOString(), 0]
      );


      const newProduct = {
        ...data,
        id,
        sku,
        variants: normalizedVariants,
        cost_price: data.costPrice || 0,
        tax_rate: data.tax_rate || 0
      };
      setProducts(prev => [newProduct, ...prev]);

      // [AutoSave]
      triggerAutoSave();

      // [Sync]
      let synced = false;
      try {
        synced = await SyncService.createAndUploadEvent(EventTypes.PRODUCT_CREATED, newProduct);
      } catch (e) {
        console.log('Sync Add Product Error:', e);
        // Rollback on failure
        await db.runAsync(`DELETE FROM products WHERE id = ?`, [id]);
        setProducts(prev => prev.filter(p => p.id !== id));
        throw new Error('Sync failed. Product creation rolled back.');
      }

      return { ...newProduct, synced };
    } catch (err) {
      console.error('Add Product SQL Error:', err);
      throw err;
    }
  }, []);

  const updateProduct = React.useCallback(async (id, data) => {
    try {
      const sku = data.barcode || data.sku || "";
      console.log(`[ProductContext] Update Product ID: ${id}, SKU: ${sku}`);

      // ─── Normalize variants: coerce all numeric fields from strings to numbers ───
      // Form inputs (TextInput) always return strings; we must coerce before DB + Sync.
      const normalizedVariants = normalizeVariants(data.variants);

      const costPrice = parseFloat(data.cost_price || data.costPrice || 0) || 0;
      const minStock = parseInt(data.minStock ?? data.min_stock ?? 0) || 0;

      // GET OLD FOR ROLLBACK
      let oldProductData = null;
      try {
        const dbRes = await db.getAllAsync('SELECT * FROM products WHERE id = ?', [id]);
        if (dbRes && dbRes.length > 0) oldProductData = dbRes[0];
      } catch (err) {}

      await db.runAsync(
        `UPDATE products SET name = ?, sku = ?, category = ?, price = ?, cost_price = ?, stock = ?, min_stock = ?, unit = ?, tax_rate = ?, variants = ?, variant = ?, updated_at = ?, is_deleted = ? WHERE id = ?`,
        [
          data.name,
          sku,
          data.category,
          data.price,
          costPrice,
          data.stock,
          minStock,
          data.unit,
          data.tax_rate || 0,
          JSON.stringify(normalizedVariants),
          data.variant || null,
          new Date().toISOString(),
          data.is_deleted ? 1 : 0,
          id
        ]
      );


      setProducts(prev => prev.map(p => p.id === id ? {
        ...p,
        ...data,
        sku,
        variants: normalizedVariants,
        cost_price: costPrice,
        min_stock: minStock,
      } : p));

      // [AutoSave] — triggers local file + Drive snapshot sync
      triggerAutoSave();

      // [Sync Event] — build finalProduct from data directly.
      let synced = false;
      try {
        const finalProduct = {
          ...data,
          id,
          sku,
          variants: normalizedVariants,
          cost_price: costPrice,
          costPrice: costPrice,
          min_stock: minStock,
          minStock: minStock,
          tax_rate: data.tax_rate || 0,
          updated_at: new Date().toISOString(),
        };
        synced = await SyncService.createAndUploadEvent(EventTypes.PRODUCT_UPDATED, finalProduct);
      } catch (e) {
        console.log('Sync Update Product Error:', e);
        // Rollback on failure
        if (oldProductData) {
          await db.runAsync(
            `UPDATE products SET name = ?, sku = ?, category = ?, price = ?, cost_price = ?, stock = ?, min_stock = ?, unit = ?, tax_rate = ?, variants = ?, variant = ?, updated_at = ? WHERE id = ?`,
            [
              oldProductData.name, oldProductData.sku, oldProductData.category, oldProductData.price, 
              oldProductData.cost_price, oldProductData.stock, oldProductData.min_stock, oldProductData.unit, 
              oldProductData.tax_rate, oldProductData.variants, oldProductData.variant, oldProductData.updated_at, id
            ]
          );
          setProducts(prev => prev.map(p => p.id === id ? oldProductData : p));
        }
        throw new Error('Sync failed. Product update rolled back.');
      }
      return synced;
    } catch (err) {
      console.error('Update Product SQL Error:', err);
      throw err;
    }
  }, []);

  const deleteProduct = React.useCallback(async (id) => {
    try {
      await db.runAsync('UPDATE products SET is_deleted = 1, updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
      setProducts(prev => prev.filter(p => p.id !== id));

      // [AutoSave]
      triggerAutoSave();

      // [Sync]
      try {
        // We sync as an update with is_deleted=1 to ensure other devices also soft-delete
        const product = await db.getFirstAsync('SELECT * FROM products WHERE id = ?', [id]);
        if (product) {
          SyncService.createAndUploadEvent(EventTypes.PRODUCT_UPDATED, { ...product, is_deleted: 1 });
        }
      } catch (e) {
        console.log('Sync Delete Product Error:', e);
      }
    } catch (err) {
      console.error('Delete Product SQL Error:', err);
      throw err;
    }
  }, []);

  const bulkDeleteProducts = React.useCallback(async (ids) => {
    if (!ids || ids.length === 0) return;
    try {
      const placeholders = ids.map(() => '?').join(',');
      await db.runAsync(`UPDATE products SET is_deleted = 1, updated_at = ? WHERE id IN (${placeholders})`, [new Date().toISOString(), ...ids]);

      setProducts(prev => prev.filter(p => !ids.includes(p.id)));

      // [AutoSave]
      triggerAutoSave();

      // [Sync]
      try {
        for (const id of ids) {
          const product = await db.getFirstAsync('SELECT * FROM products WHERE id = ?', [id]);
          if (product) {
            SyncService.createAndUploadEvent(EventTypes.PRODUCT_UPDATED, { ...product, is_deleted: 1 });
          }
        }
      } catch (e) {
        console.log('Sync Bulk Delete Product Error:', e);
      }
    } catch (err) {
      console.error('Bulk Delete Product SQL Error:', err);
      throw err;
    }
  }, []);

  const restoreProduct = React.useCallback(async (id) => {
    try {
      await db.runAsync('UPDATE products SET is_deleted = 0, updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
      
      // Refresh local state
      const data = await db.getAllAsync('SELECT * FROM products WHERE is_deleted = 0 ORDER BY name ASC');
      setProducts(data || []);

      // [Sync]
      try {
        const product = await db.getFirstAsync('SELECT * FROM products WHERE id = ?', [id]);
        if (product) {
          SyncService.createAndUploadEvent(EventTypes.PRODUCT_UPDATED, { ...product, is_deleted: 0 });
        }
      } catch (e) { }

      triggerAutoSave();
    } catch (err) {
      console.error('Restore Product SQL Error:', err);
      throw err;
    }
  }, []);

  const permanentlyDeleteProduct = React.useCallback(async (id) => {
    try {
      await db.runAsync('DELETE FROM products WHERE id = ?', [id]);
      // [Sync]
      try {
        SyncService.createAndUploadEvent(EventTypes.PRODUCT_DELETED, { id });
      } catch (e) { }
      triggerAutoSave();
    } catch (err) {
      console.error('Permanent Delete Product SQL Error:', err);
      throw err;
    }
  }, []);


  const updateStock = React.useCallback(async (id, newStock, newMinStock = null) => {
    try {
      if (newMinStock !== null) {
        await db.runAsync('UPDATE products SET stock = ?, min_stock = ? WHERE id = ?', [newStock, newMinStock, id]);
        setProducts(prev => prev.map(p => p.id === id ? { ...p, stock: newStock, minStock: newMinStock, min_stock: newMinStock } : p));
      } else {
        await db.runAsync('UPDATE products SET stock = ? WHERE id = ?', [newStock, id]);
        setProducts(prev => prev.map(p => p.id === id ? { ...p, stock: newStock } : p));
      }

      // [AutoSave]
      triggerAutoSave();

      // [Sync]
      try {
        const payload = { id, stock: newStock };
        if (newMinStock !== null) payload.minStock = newMinStock;

        SyncService.createAndUploadEvent(EventTypes.PRODUCT_STOCK_ADJUSTED, payload);
      } catch (e) {
        console.log('Sync Stock Adjust Error:', e);
      }
    } catch (err) {
      console.error('Update Stock SQL Error:', err);
      throw err;
    }
  }, []);

  const importProducts = React.useCallback(async (productsArray) => {
    setLoading(true);
    try {
      const productsToInsert = [];

      // 1. Prepare data with IDs
      for (const p of productsArray) {
        const id = p.id || Date.now().toString() + Math.random().toString(36).substr(2, 5);
        const sku = p.sku || p.barcode || `SKU-${Math.floor(Math.random() * 100000)}`;
        const productObj = {
          id,
          name: p.name,
          sku,
          category: p.category || 'General',
          price: parseFloat(p.price || p.sellingPrice || 0),
          cost_price: parseFloat(p.costPrice || p.cost_price || 0),
          stock: parseInt(p.stock || 0),
          min_stock: parseInt(p.min_stock || p.minStock || 0),
          unit: p.unit || 'pcs',
          tax_rate: parseFloat(p.taxRate || p.tax_rate || 0),
          variants: normalizeVariants(p.variants),
          variant: p.variant || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: 0
        };
        productsToInsert.push(productObj);
      }

      // 2. Transaction Insert
      await db.withTransactionAsync(async () => {
        for (const p of productsToInsert) {
          await db.runAsync(
            `INSERT OR REPLACE INTO products (id, name, sku, category, price, cost_price, stock, min_stock, unit, tax_rate, variants, variant, created_at, updated_at, is_deleted) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              p.id, p.name, p.sku, p.category, p.price, p.cost_price, p.stock, p.min_stock || 0, p.unit, p.tax_rate,
              JSON.stringify(p.variants), p.variant, p.created_at, p.updated_at, p.is_deleted
            ]
          );
        }
      });

      // 3. Sync Events
      try {
        for (const p of productsToInsert) {
          SyncService.createAndUploadEvent(EventTypes.PRODUCT_CREATED, p);
        }
      } catch (e) {
        console.log('Sync Import Error (Events):', e);
      }

      // Refresh local state
      const data = await db.getAllAsync('SELECT * FROM products WHERE is_deleted = 0 ORDER BY name ASC');
      setProducts(data || []);


      triggerAutoSave();
      return true;
    } catch (err) {
      console.error('Import Products Error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchProducts]);

  const value = React.useMemo(() => ({
    products,
    loading,
    fetchProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    bulkDeleteProducts,
    updateStock,
    importProducts,
    fetchDeletedProducts,
    restoreProduct,
    permanentlyDeleteProduct
  }), [
    products,
    loading,
    fetchProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    bulkDeleteProducts,
    updateStock,
    importProducts,
    fetchDeletedProducts,
    restoreProduct,
    permanentlyDeleteProduct
  ]);


  return (
    <ProductContext.Provider value={value}>
      {children}
    </ProductContext.Provider>
  );
};