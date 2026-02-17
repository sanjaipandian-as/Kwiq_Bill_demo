import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { db } from './database';

/**
 * Helper: Get valid access token
 */
// Mutex for token refresh to prevent "previous promise did not settle" error
let tokenRefreshPromise = null;

/**
 * Helper: Fetch with Timeout to prevent hanging connections
 */
export const fetchWithTimeout = async (url, options = {}, timeout = 30000) => {
  const controller = new AbortController();
  const id = setTimeout(() => {
    console.warn(`[Drive] Fetch timeout reached for: ${url}`);
    controller.abort();
  }, timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('Connection timed out. Please check your internet.');
    }
    throw error;
  }
};

export const getAccessToken = async () => {
  if (tokenRefreshPromise) {
    return tokenRefreshPromise;
  }

  tokenRefreshPromise = (async () => {
    const driveScope = 'https://www.googleapis.com/auth/drive.file';

    try {
      console.log('[Sync] Getting access token...');
      let currentUser = await GoogleSignin.getCurrentUser();

      // Attempt silent sign-in if no user is found
      if (!currentUser) {
        try {
          currentUser = await GoogleSignin.signInSilently();
        } catch (error) {
          console.log('[Sync] Silent sign-in failed:', error);
        }
      }

      if (!currentUser) {
        console.log('[Sync] No user signed in, aborting token fetch.');
        return null;
      }

      const hasScope = currentUser?.scopes?.includes(driveScope);
      if (!hasScope) {
        console.log('[Sync] Drive scope missing, requesting...');
        await GoogleSignin.addScopes({ scopes: [driveScope] });
      }

      // Get tokens safely
      const tokens = await GoogleSignin.getTokens();
      if (!tokens || !tokens.accessToken) {
        console.error('[Sync] getTokens returned empty or no access token');
        return null;
      }
      return tokens.accessToken;

    } catch (error) {
      if (error.message && error.message.includes('requires a user to be signed in')) {
        console.warn('[Sync] User session expired or not signed in. Refresh required.');
      }
      console.error('[Sync] getAccessToken Error:', error);
      return null;
    } finally {
      tokenRefreshPromise = null;
    }
  })();

  return tokenRefreshPromise;
};

/**
 * DEBUG: Check if Store Branding (Logo) exists in Drive
 */
export const checkStoreBrandingStatus = async (user) => {
  if (!user || !user.id) return { error: 'No user ID' };
  try {
    const accessToken = await getAccessToken();
    const folderName = `KwiqBilling-${user.id}`;

    // 1. Find folder
    const folderQuery = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const folderRes = await fetchWithTimeout(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(folderQuery)}&fields=files(id)`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const folderData = await folderRes.json();
    const folderId = folderData.files?.[0]?.id;

    if (!folderId) return { folderExists: false, logoExists: false };

    // 2. Find logo
    const logoQuery = `name='store_logo.jpg' and '${folderId}' in parents and trashed=false`;
    const logoRes = await fetchWithTimeout(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(logoQuery)}&fields=files(id, modifiedTime, size)`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const logoData = await logoRes.json();
    const logoFile = logoData.files?.[0];

    // 3. Find settings.json
    const settingsQuery = `name='settings.json' and '${folderId}' in parents and trashed=false`;
    const settingsRes = await fetchWithTimeout(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(settingsQuery)}&fields=files(id, modifiedTime)`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const settingsData = await settingsRes.json();

    return {
      folderExists: true,
      folderId,
      logoExists: !!logoFile,
      logoId: logoFile?.id,
      logoModified: logoFile?.modifiedTime,
      logoSize: logoFile?.size,
      settingsExists: !!settingsData.files?.[0],
      settingsId: settingsData.files?.[0]?.id,
      settingsModified: settingsData.files?.[0]?.modifiedTime
    };
  } catch (error) {
    console.error('[Debug] Branding Check Error:', error);
    return { error: error.message };
  }
};

/**
 * Helper: Find or Create Folder
 */
export const getOrCreateFolder = async (accessToken, folderName, parentId = null) => {
  // 1. Search for folder
  let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const searchRes = await fetchWithTimeout(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id; // Return existing folder ID
  }

  // 2. Create folder if not found
  const metadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  const createRes = await fetchWithTimeout(
    'https://www.googleapis.com/drive/v3/files',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    }
  );
  const createData = await createRes.json();
  return createData.id;
};

/**
 * Helper: Upload or Update File in Folder
 */
export const uploadFileToFolder = async (accessToken, folderId, fileName, content) => {
  // 1. Search for file in specific folder
  const searchRes = await fetchWithTimeout(
    `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and '${folderId}' in parents and trashed=false`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();
  const existingFile = searchData.files && searchData.files.length > 0 ? searchData.files[0] : null;

  // 2. Prepare Body
  const boundary = 'foo_bar_baz';
  const metadata = {
    name: fileName,
    mimeType: 'application/json'
  };

  // Only include parents for NEW files (POST)
  if (!existingFile) {
    metadata.parents = [folderId];
  }

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  // 3. Upload (PATCH if exists, POST if new)
  const url = existingFile
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const method = existingFile ? 'PATCH' : 'POST';

  const uploadRes = await fetchWithTimeout(url, {
    method: method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: body,
  });

  const responseText = await uploadRes.text();
  let data = {};
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    // Not JSON or empty
  }

  if (!uploadRes.ok) {
    console.error(`[Sync] File Upload Failed (${fileName}): ${uploadRes.status}`, data);
  }

  return data;
};

/**
 * Helper: Upload Image to Folder
 */
export const uploadImageToFolder = async (accessToken, folderId, fileName, localUri, mimeType = 'image/jpeg') => {
  try {
    // Read file as base64 or extract from data URL
    let base64;
    if (localUri.startsWith('data:image')) {
      base64 = localUri.split(',')[1];
    } else {
      base64 = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' });
    }

    // Search for existing file
    const searchRes = await fetchWithTimeout(
      `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and '${folderId}' in parents and trashed=false`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const searchData = await searchRes.json();
    const existingFile = searchData.files && searchData.files.length > 0 ? searchData.files[0] : null;

    // Metadata
    const metadata = {
      name: fileName,
      mimeType: mimeType
    };

    // Only include parents for NEW files (POST)
    if (!existingFile) {
      metadata.parents = [folderId];
    }

    const boundary = 'foo_bar_baz_image';
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n` +
      `Content-Transfer-Encoding: base64\r\n\r\n` +
      `${base64}\r\n` +
      `--${boundary}--`;

    const url = existingFile
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

    const method = existingFile ? 'PATCH' : 'POST';

    const uploadRes = await fetchWithTimeout(url, {
      method: method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: body,
    });

    const responseText = await uploadRes.text();
    let data = {};
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error(`[Sync] Failed to parse Drive response as JSON: ${responseText}`);
    }

    if (!uploadRes.ok) {
      console.error(`[Sync] Drive Upload Failed: ${uploadRes.status} ${uploadRes.statusText}`, data);
      return null;
    }

    if (!data.id) {
      console.warn(`[Sync] Drive Upload Success but no ID returned. Response:`, data);
    } else {
      console.log(`[Sync] Image ${fileName} ${existingFile ? 'updated' : 'uploaded'}. ID: ${data.id}`);
    }
    return data;
  } catch (e) {
    console.error(`[Sync] Failed to upload image ${fileName}:`, e);
    return null;
  }
};

/**
 * Main: Sync User Data to User-Specific Folder
 */
export const syncUserDataToDrive = async (user, allData) => {
  if (!user || !user.id || !allData) return;

  try {
    const accessToken = await getAccessToken();
    const folderName = `KwiqBilling-${user.id}`;

    // 1. Ensure Folder Exists
    const folderId = await getOrCreateFolder(accessToken, folderName);
    console.log(`Syncing to Drive Folder: ${folderName} (${folderId})`);

    // 2. Upload each data category as a separate file
    const tables = Object.keys(allData); // ['products', 'customers', 'settings', etc.]

    for (const table of tables) {
      if (allData[table] && allData[table].length > 0) { // Only save non-empty
        const fileName = `${table}.json`;
        const content = JSON.stringify(allData[table], null, 2);
        await uploadFileToFolder(accessToken, folderId, fileName, content);
        console.log(`Uploaded ${fileName} to Drive.`);
      }
    }

    // 3. Generate and Upload Tax Report (GST Details)
    if (allData.invoices && Array.isArray(allData.invoices)) {
      try {
        let totalSales = 0;
        let totalGST = 0;
        let totalSGST = 0;
        let totalCGST = 0;
        let totalIGST = 0;

        const taxDetails = allData.invoices.map(inv => {
          const tax = inv.tax || 0;
          const amount = inv.total || 0;

          // Basic estimation logic if tax breakdown isn't stored explicitly
          // In a real scenario, this should come from inv.taxDetails or similar
          let sgst = 0, cgst = 0, igst = 0;

          // Check if explicit details exist (assuming they might be stored in a 'taxDetails' column or parsed)
          // For now, using the same logic as GSTPage for consistency
          if (inv.taxType === 'inter') {
            igst = tax;
          } else {
            sgst = tax / 2;
            cgst = tax / 2;
          }

          totalSales += amount;
          totalGST += tax;
          totalSGST += sgst;
          totalCGST += cgst;
          totalIGST += igst;

          return {
            id: inv.id,
            invoiceNumber: inv.invoiceNumber || inv.id,
            date: inv.date,
            customerName: inv.customer_name,
            totalAmount: amount,
            totalTax: tax,
            sgst,
            cgst,
            igst
          };
        });

        const taxReport = {
          generatedAt: new Date().toISOString(),
          summary: {
            totalSales,
            totalGST,
            totalSGST,
            totalCGST,
            totalIGST
          },
          details: taxDetails
        };

        await uploadFileToFolder(accessToken, folderId, 'tax_report.json', JSON.stringify(taxReport, null, 2));
        console.log('Uploaded tax_report.json to Drive.');

      } catch (e) {
        console.warn('Error generating tax report for Drive:', e);
      }
    }

    // Also save User Details in the same folder for reference
    await uploadFileToFolder(accessToken, folderId, 'user_profile.json', JSON.stringify(user, null, 2));

    return true;
  } catch (error) {
    console.error("Drive Sync Error:", error);
    return false;
  }
};

/**
 * Main: Restore Data from Drive (Snapshot Restore)
 */
export const restoreUserDataFromDrive = async (user, onProgress) => {
  console.log('[Restore] Starting restore for user:', user?.id);
  if (!user || !user.id) return;

  try {
    if (onProgress) onProgress('Connecting to Cloud... (Est. time: 5s)', 0.35);
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.log('[Restore] No access token, skipping.');
      return;
    }

    const folderName = `KwiqBilling-${user.id}`;
    // Find folder (don't create if missing, just search)
    const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const searchRes = await fetchWithTimeout(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const searchData = await searchRes.json();

    if (!searchData.files || searchData.files.length === 0) {
      console.log('[Restore] No backup folder found on Drive.');
      return;
    }
    const folderId = searchData.files[0].id;
    console.log('[Restore] Found backup folder ID:', folderId);

    // 1. Search for specific snapshot files we need to restore
    // Optimization: query for specific filenames to avoid pagination issues when there are many event files.
    if (onProgress) onProgress('Connecting to backup engine...', 0.42);
    const targetFiles = ['settings.json', 'products.json', 'customers.json', 'expenses.json', 'invoices.json', 'user details.json', 'store_logo.jpg'];
    const namesQuery = targetFiles.map(name => `name='${name}'`).join(' or ');
    const listQuery = `(${namesQuery}) and '${folderId}' in parents and trashed=false`;

    console.log('[Restore] Querying for snapshots:', listQuery);

    const listRes = await fetchWithTimeout(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(listQuery)}&fields=files(id,name)&pageSize=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const listData = await listRes.json();
    const filesMap = {};
    if (listData.files) {
      listData.files.forEach(f => {
        filesMap[f.name] = f.id;
      });
      console.log('[Restore] Files found in cloud:', Object.keys(filesMap).join(', '));
    }

    // Helper to download JSON file using the map
    const fetchFileFromMap = async (baseName) => {
      try {
        const fileId = filesMap[baseName];
        if (fileId) {
          console.log(`[Restore] Downloading ${baseName} (ID: ${fileId})...`);
          const contentRes = await fetchWithTimeout(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          if (!contentRes.ok) throw new Error(`HTTP ${contentRes.status}`);

          const text = await contentRes.text();
          if (!text || text.trim() === "") return null;

          let cleanText = text.trim();
          if (cleanText.toLowerCase().includes('content-type:')) {
            const parts = cleanText.split(/\r?\n\r?\n/);
            if (parts.length > 1) {
              for (let part of parts) {
                const trimmed = part.trim();
                if (trimmed.toLowerCase().includes('content-type:')) continue;
                if (trimmed.length > 0) {
                  cleanText = trimmed;
                  break;
                }
              }
            }
          }

          try {
            return JSON.parse(cleanText);
          } catch (e) {
            console.error(`[Restore] JSON Parse Error for ${baseName}:`, e.message);
            return null;
          }
        }
      } catch (e) {
        console.log(`[Restore] Error fetching ${baseName}:`, e);
      }
      return null;
    };

    // Helper to download image using the map
    const downloadImageFromMap = async (baseName) => {
      try {
        const fileId = filesMap[baseName];
        if (fileId) {
          let baseUrl = FileSystem.documentDirectory || '';
          if (baseUrl && !baseUrl.endsWith('/')) baseUrl += '/';
          const destinationUri = `${baseUrl}${baseName}`;

          await FileSystem.downloadAsync(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            destinationUri,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          return destinationUri;
        }
      } catch (e) {
        console.warn(`[Restore] Failed to download image ${baseName}:`, e);
      }
      return null;
    };

    // Parallel Fetch All Data using the optimized map
    if (onProgress) onProgress('Downloading store snapshots... (Est. time: 3s)', 0.45);
    const [settings, products, customers, expenses, invoices, userDetailsFile] = await Promise.all([
      fetchFileFromMap('settings.json'),
      fetchFileFromMap('products.json'),
      fetchFileFromMap('customers.json'),
      fetchFileFromMap('expenses.json'),
      fetchFileFromMap('invoices.json'),
      fetchFileFromMap('user details.json')
    ]);

    // Restore Logo if available
    let localLogoUri = null;
    try {
      localLogoUri = await downloadImageFromMap('store_logo.jpg');
    } catch (e) {
      console.warn("[Restore] Logo restore failed", e);
    }

    // 1. Restore Settings
    if ((settings && Array.isArray(settings) && settings.length > 0) || userDetailsFile) {
      if (onProgress) onProgress('Syncing store preferences...', 0.48);
      try {
        const localSaved = await AsyncStorage.getItem('app_settings');
        const localSettings = localSaved ? JSON.parse(localSaved) : {};

        // Settings from settings.json take priority, fallback to user details.json
        const driveSettings = (settings && Array.isArray(settings) && settings.length > 0) ? settings[0] : (userDetailsFile || {});

        // Deep extraction of bank details from multiple sources
        const driveBank = driveSettings.bankDetails || userDetailsFile?.bankDetails || {};

        // Deep merge drive settings with local
        const merged = {
          ...localSettings,
          ...driveSettings,
          store: {
            ...(localSettings.store || {}),
            ...(driveSettings.store || {}),
            // FORCE localLogoUri if we have it, otherwise fallback to base64 from JSON
            logo: localLogoUri || (driveSettings.store?.logo && driveSettings.store.logo.startsWith('data:image') ? driveSettings.store.logo : (localSettings.store?.logo || null))
          },
          tax: { ...(localSettings.tax || {}), ...(driveSettings.tax || {}) },
          invoice: { ...(localSettings.invoice || {}), ...(driveSettings.invoice || {}) },
          defaults: { ...(localSettings.defaults || {}), ...(driveSettings.defaults || {}) },
          bankDetails: {
            accountName: '', accountNumber: '', ifsc: '', bankName: '', branch: '', // Default structure
            ...(localSettings.bankDetails || {}),
            ...driveBank
          }
        };

        // Final Logo Sanity Check
        if (localLogoUri) {
          merged.store.logo = localLogoUri;
        }

        await AsyncStorage.setItem('app_settings', JSON.stringify(merged));
        console.log('[Restore] Settings merged and restored. Bank details found:', !!driveBank.accountNumber);
      } catch (e) {
        console.warn('[Restore] Settings merge failed, fixing state:', e.message);
        // Minimum viable settings restore
        const fallback = (settings && settings[0]) || userDetailsFile || {};
        await AsyncStorage.setItem('app_settings', JSON.stringify(fallback));
      }
    }

    // 2. Restore Products
    if (products && Array.isArray(products)) {
      if (onProgress) onProgress(`Restoring ${products.length} products...`, 0.52);
      await db.withTransactionAsync(async () => {
        for (const p of products) {
          await db.runAsync(
            `INSERT OR REPLACE INTO products (id, name, sku, category, price, cost_price, stock, min_stock, unit, tax_rate, variants, variant, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              p.id,
              p.name,
              p.sku,
              p.category,
              p.price || 0,
              p.cost_price || p.costPrice || 0,
              p.stock || 0,
              p.min_stock || p.minStock || 0,
              p.unit || 'pc',
              p.tax_rate || 0,
              (typeof p.variants === 'string' ? p.variants : JSON.stringify(p.variants || [])),
              p.variant,
              p.created_at,
              p.updated_at
            ]
          );
        }
      });
      console.log(`[Restore] Restored ${products.length} products.`);
    }

    // 3. Restore Customers
    if (customers && Array.isArray(customers)) {
      if (onProgress) onProgress(`Restoring ${customers.length} customers...`, 0.55);
      await db.withTransactionAsync(async () => {
        for (const c of customers) {
          await db.runAsync(
            `INSERT OR REPLACE INTO customers (id, name, phone, email, type, gstin, address, source, tags, loyaltyPoints, notes, created_at, updated_at, amountPaid, whatsappOptIn, smsOptIn, outstanding)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              c.id, c.name, c.phone, c.email, c.type, c.gstin, c.address, c.source, c.tags,
              c.loyaltyPoints || 0, c.notes, c.created_at, c.updated_at, c.amountPaid || 0,
              c.whatsappOptIn ? 1 : 0, c.smsOptIn ? 1 : 0, c.outstanding || 0
            ]
          );
        }
      });
      console.log(`[Restore] Restored ${customers.length} customers.`);
    }

    // 4. Restore Expenses
    if (expenses && Array.isArray(expenses)) {
      if (onProgress) onProgress(`Restoring ${expenses.length} expenses...`, 0.57);
      await db.withTransactionAsync(async () => {
        for (const e of expenses) {
          await db.runAsync(
            `INSERT OR REPLACE INTO expenses (id, title, amount, category, date, payment_method, tags, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [e.id, e.title, e.amount, e.category, e.date, e.payment_method, (typeof e.tags === 'string' ? e.tags : JSON.stringify(e.tags || [])), e.created_at, e.updated_at]
          );
        }
      });
      console.log(`[Restore] Restored ${expenses.length} expenses.`);
    }

    // 5. Restore Invoices
    if (invoices && Array.isArray(invoices)) {
      if (onProgress) onProgress(`Restoring ${invoices.length} invoices...`, 0.59);
      await db.withTransactionAsync(async () => {
        for (const i of invoices) {
          await db.runAsync(
            `INSERT OR REPLACE INTO invoices (
                id, customer_id, customer_name, date, type, items, subtotal, tax, discount, total, status, payments, 
                grossTotal, itemDiscount, additionalCharges, roundOff, amountReceived, internalNotes, taxType, weekly_sequence,
                loyalty_points_redeemed, loyalty_points_earned, loyalty_points_discount, is_deleted, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              i.id, i.customer_id, i.customer_name, i.date, i.type,
              (typeof i.items === 'string' ? i.items : JSON.stringify(i.items || [])),
              i.subtotal || 0, i.tax || 0, i.discount || 0, i.total || 0, i.status || 'Paid',
              (typeof i.payments === 'string' ? i.payments : JSON.stringify(i.payments || [])),
              i.grossTotal || 0, i.itemDiscount || 0, i.additionalCharges || 0, i.roundOff || 0, i.amountReceived || 0,
              i.internalNotes || '', i.taxType || 'intra', i.weekly_sequence || 1,
              i.loyalty_points_redeemed || 0, i.loyalty_points_earned || 0, i.loyalty_points_discount || 0,
              i.is_deleted ? 1 : 0, i.created_at, i.updated_at
            ]
          );
        }
      });
      console.log(`[Restore] Restored ${invoices.length} invoices.`);
    }

    return true;
  } catch (error) {
    console.error('[Restore] Restoration failed:', error);
    return false;
  }
};


/**
 * Sync Settings to Drive (User-specific folder)
 */
export const syncSettingsToDrive = async (user, settings) => {
  if (!user || !user.id || !settings) return;

  try {
    const accessToken = await getAccessToken();
    const folderName = `KwiqBilling-${user.id}`;

    // 1. Ensure Folder Exists
    const folderId = await getOrCreateFolder(accessToken, folderName);

    // 2. Wrap settings in array for backwards compat
    // CLONE settings to avoid mutating state passed in
    const settingsToSave = JSON.parse(JSON.stringify(settings));

    // CHECK FOR LOGO UPLOAD
    if (settingsToSave.store && settingsToSave.store.logo) {
      let logoUri = settingsToSave.store.logo;
      let shouldUpload = false;
      let mimeType = 'image/jpeg';

      if (typeof logoUri === 'string') {
        if (logoUri.startsWith('file://')) {
          shouldUpload = true;
          if (logoUri.endsWith('.png')) mimeType = 'image/png';
        } else if (logoUri.startsWith('data:image')) {
          // Handle base64
          shouldUpload = true;
          const match = logoUri.match(/^data:(image\/\w+);base64,/);
          if (match) mimeType = match[1];
        }
      }

      if (shouldUpload) {
        console.log(`[Sync] Found new logo (${mimeType}), uploading to Drive...`);
        const uploadResult = await uploadImageToFolder(accessToken, folderId, 'store_logo.jpg', logoUri, mimeType);
        if (uploadResult && uploadResult.id) {
          console.log('[Sync] Logo uploaded successfully.');
        }

        // PORTABILITY FIX: If the logo is a local file, convert to base64 for the settings.json backup
        // This ensures that even if local file download fails on restore, the logo persists via JSON
        if (logoUri.startsWith('file://')) {
          try {
            const base64 = await FileSystem.readAsStringAsync(logoUri, { encoding: 'base64' });
            settingsToSave.store.logo = `data:${mimeType};base64,${base64}`;
          } catch (e) {
            console.warn('[Sync] Failed to convert local logo to base64 for backup:', e);
          }
        }
      } else if (typeof logoUri === 'string' && logoUri.startsWith('file://')) {
        // If it's a file path but we decided NOT to upload (maybe old logic?), 
        // we still MUST NOT save a device-specific path to settings.json
        // Let's at least null it out or try to preserve it if it was already in Drive as a file.
        // For safety, we should really ensure it's portable.
        try {
          const base64 = await FileSystem.readAsStringAsync(logoUri, { encoding: 'base64' });
          settingsToSave.store.logo = `data:image/jpeg;base64,${base64}`;
        } catch (e) {
          settingsToSave.store.logo = null;
        }
      }
    }

    const content = JSON.stringify([settingsToSave], null, 2);

    // 3. Upload
    await uploadFileToFolder(accessToken, folderId, 'settings.json', content);

    // 4. Also upload explicit user_details.json as requested for cross-platform ease
    const userDetails = {
      store: settings.store,
      user: settings.user,
      bankDetails: settings.bankDetails,
      onboardingCompletedAt: settings.onboardingCompletedAt
    };
    await uploadFileToFolder(accessToken, folderId, 'user details.json', JSON.stringify(userDetails, null, 2));

    console.log('[Sync] Settings and User Details uploaded to Drive.');
    return true;
  } catch (error) {
    console.error('[Sync] Settings upload failed:', error);
    return false;
  }
};

/**
 * Legacy: Saves user details to Google Drive Root (Kept for backward compatibility if needed)
 */
export const saveUserDetailsToDrive = async (userDetails) => {
  try {
    const accessToken = await getAccessToken();
    const filename = "user_details_backup.json";

    // 1. Check for valid user folder to keep it clean (New logic integration)
    // If we have an ID, we try to put it in the folder too? 
    // The user asked to "also save in addition to user details".
    // Let's keep this legacy function dumping to root OR update it to use the folder?
    // "inside the folder seperate files need to be saved... and also the in the google drve also it should get saved in addition to the user details"
    // I will modify this to ALSO save to the user folder if possible, but the 'syncUserDataToDrive' handles the bulk.
    // Let's keep this simple and isolated as requested: "functionality or structure nothing should not be disturbed unless needed"
    // So I leave this function mostly alone but use the helper I wrote to clean it up? 
    // Actually, I'll just leave existing logic mostly as is but refactored to use `uploadFileToFolder` if I wanted, 
    // but better to blindly paste the old logic back + my new helpers to ensure 100% no regression.

    // ... (Pasting original logic back in slightly cleaned form to coexist with new exports)

    // 3. Search for existing file
    const searchResponse = await fetchWithTimeout(
      `https://www.googleapis.com/drive/v3/files?q=name='${filename}'`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const searchData = await searchResponse.json();
    const existingFile = searchData.files && searchData.files.length > 0 ? searchData.files[0] : null;

    // 4. Prepare Multipart Body
    const boundary = 'auto_sync_boundary';
    const metadata = {
      name: filename,
      mimeType: 'application/json'
    };

    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `\r\n--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${JSON.stringify(userDetails)}\r\n` +
      `\r\n--${boundary}--`;

    const url = existingFile
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

    const method = existingFile ? 'PATCH' : 'POST';

    await fetchWithTimeout(url, {
      method: method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: body,
    });

  } catch (error) {
    console.error("Auto-sync error:", error);
  }
};