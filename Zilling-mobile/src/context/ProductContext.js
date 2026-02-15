import React, { createContext, useContext, useState, useEffect } from 'react';
import { triggerAutoSave } from '../services/autosaveService';
import { db } from '../services/database';

const ProductContext = createContext();
export const useProducts = () => useContext(ProductContext);

export const ProductProvider = ({ children }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Initial load from SQLite
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const data = db.getAllSync('SELECT * FROM products ORDER BY name ASC');
        setProducts(data || []);
      } catch (err) {
        console.error('Failed to load products:', err);
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const data = db.getAllSync('SELECT * FROM products ORDER BY name ASC');
      setProducts(data || []);
    } finally {
      setLoading(false);
    }
  };

  const addProduct = async (data) => {
    try {
      const id = data.id || Date.now().toString();
      const sku = data.sku || data.barcode || "";

      db.runSync(
        `INSERT OR REPLACE INTO products (id, name, sku, category, price, cost_price, stock, min_stock, unit, tax_rate, variants, variant, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.name, sku, data.category, data.price, data.costPrice || 0, data.stock || 0, data.minStock || 0, data.unit, data.tax_rate, JSON.stringify(data.variants || []), data.variant || null, new Date().toISOString()]
      );

      const newProduct = {
        ...data,
        id,
        sku,
        cost_price: data.costPrice || 0,
        tax_rate: data.tax_rate || 0
      };
      setProducts(prev => [newProduct, ...prev]);

      // [AutoSave]
      triggerAutoSave();

      // [Sync]
      let synced = false;
      try {
        const { SyncService, EventTypes } = require('../services/OneWaySyncService');
        synced = await SyncService.createAndUploadEvent(EventTypes.PRODUCT_CREATED, newProduct);
      } catch (e) {
        console.log('Sync Add Product Error:', e);
      }

      return { ...newProduct, synced };
    } catch (err) {
      console.error('Add Product SQL Error:', err);
      throw err;
    }
  };

  const updateProduct = async (id, data) => {
    try {
      const sku = data.barcode || data.sku || ""; // Priority to barcode field from edit form
      console.log(`[ProductContext] Update Product ID: ${id}, SKU: ${sku}`);

      db.runSync(
        `UPDATE products SET name = ?, sku = ?, category = ?, price = ?, cost_price = ?, stock = ?, min_stock = ?, unit = ?, tax_rate = ?, variants = ?, variant = ?, updated_at = ? WHERE id = ?`,
        [
          data.name,
          sku,
          data.category,
          data.price,
          data.costPrice || 0,
          data.stock,
          data.minStock || 0,
          data.unit,
          data.tax_rate || 0,
          JSON.stringify(data.variants || []),
          data.variant || null,
          new Date().toISOString(),
          id
        ]
      );

      setProducts(prev => prev.map(p => p.id === id ? {
        ...p,
        ...data,
        sku,
        cost_price: data.costPrice !== undefined ? data.costPrice : p.cost_price
      } : p));

      // [AutoSave]
      triggerAutoSave();

      // [Sync]
      let synced = false;
      try {
        const { SyncService, EventTypes } = require('../services/OneWaySyncService');
        // Construct full updated object
        const oldProduct = products.find(p => p.id === id);
        if (oldProduct) {
          const finalProduct = { ...oldProduct, ...data, sku };
          synced = await SyncService.createAndUploadEvent(EventTypes.PRODUCT_UPDATED, finalProduct);
        }
      } catch (e) {
        console.log('Sync Update Product Error:', e);
      }
      return synced;
    } catch (err) {
      console.error('Update Product SQL Error:', err);
      throw err;
    }
  };

  const deleteProduct = async (id) => {
    try {
      db.runSync('DELETE FROM products WHERE id = ?', [id]);
      setProducts(prev => prev.filter(p => p.id !== id));

      // [AutoSave]
      triggerAutoSave();

      // [Sync]
      try {
        const { SyncService, EventTypes } = require('../services/OneWaySyncService');
        SyncService.createAndUploadEvent(EventTypes.PRODUCT_DELETED, { id });
      } catch (e) {
        console.log('Sync Delete Product Error:', e);
      }
    } catch (err) {
      console.error('Delete Product SQL Error:', err);
      throw err;
    }
  };

  const bulkDeleteProducts = async (ids) => {
    if (!ids || ids.length === 0) return;
    try {
      const placeholders = ids.map(() => '?').join(',');
      db.runSync(`DELETE FROM products WHERE id IN (${placeholders})`, ids);

      setProducts(prev => prev.filter(p => !ids.includes(p.id)));

      // [AutoSave]
      triggerAutoSave();

      // [Sync]
      try {
        const { SyncService, EventTypes } = require('../services/OneWaySyncService');
        ids.forEach(id => {
          SyncService.createAndUploadEvent(EventTypes.PRODUCT_DELETED, { id });
        });
      } catch (e) {
        console.log('Sync Bulk Delete Product Error:', e);
      }
    } catch (err) {
      console.error('Bulk Delete Product SQL Error:', err);
      throw err;
    }
  };

  const updateStock = async (id, newStock, newMinStock = null) => {
    try {
      if (newMinStock !== null) {
        db.runSync('UPDATE products SET stock = ?, min_stock = ? WHERE id = ?', [newStock, newMinStock, id]);
        setProducts(prev => prev.map(p => p.id === id ? { ...p, stock: newStock, minStock: newMinStock, min_stock: newMinStock } : p));
      } else {
        db.runSync('UPDATE products SET stock = ? WHERE id = ?', [newStock, id]);
        setProducts(prev => prev.map(p => p.id === id ? { ...p, stock: newStock } : p));
      }

      // [AutoSave]
      triggerAutoSave();

      // [Sync]
      try {
        const { SyncService, EventTypes } = require('../services/OneWaySyncService');
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
  };

  const importProducts = async (productsArray) => {
    setLoading(true);
    try {
      const productsToInsert = [];
      const { SyncService, EventTypes } = require('../services/OneWaySyncService');

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
          unit: p.unit || 'pcs',
          tax_rate: parseFloat(p.taxRate || p.tax_rate || 0),
          variants: p.variants || [],
          variant: p.variant || null,
          created_at: new Date().toISOString()
        };
        productsToInsert.push(productObj);
      }

      // 2. Transaction Insert
      await db.withTransactionAsync(async () => {
        for (const p of productsToInsert) {
          await db.runAsync(
            `INSERT OR REPLACE INTO products (id, name, sku, category, price, cost_price, stock, min_stock, unit, tax_rate, variants, variant, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              p.id, p.name, p.sku, p.category, p.price, p.cost_price, p.stock, p.min_stock || 0, p.unit, p.tax_rate,
              JSON.stringify(p.variants), p.variant, p.created_at
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
      const data = await db.getAllAsync('SELECT * FROM products ORDER BY name ASC');
      setProducts(data || []);

      triggerAutoSave();
      return true;
    } catch (err) {
      console.error('Import Products Error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProductContext.Provider value={{
      products,
      loading,
      fetchProducts,
      addProduct,
      updateProduct,
      deleteProduct,
      bulkDeleteProducts,
      updateStock,
      importProducts
    }}>
      {children}
    </ProductContext.Provider>
  );
};