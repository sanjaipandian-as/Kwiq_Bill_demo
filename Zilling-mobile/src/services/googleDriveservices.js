import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './database';

/**
 * Helper: Get valid access token
 */
// Mutex for token refresh to prevent "previous promise did not settle" error
let tokenRefreshPromise = null;

/**
 * Helper: Fetch with Timeout to prevent hanging connections
 */
export const fetchWithTimeout = async (url, options = {}, timeout = 10000) => {
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
    mimeType: 'application/json',
    parents: [folderId] // Important: Set parent folder
  };

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

  return uploadRes.json();
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
export const restoreUserDataFromDrive = async (user) => {
  console.log('[Restore] Starting restore for user:', user?.id);
  if (!user || !user.id) return;

  try {
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

    // Helper to fetch and parse JSON file
    const fetchFile = async (baseName) => {
      try {
        console.log(`[Restore] Searching for ${baseName}...`);
        const fileQuery = `name='${baseName}' and '${folderId}' in parents and trashed=false`;
        const fRes = await fetchWithTimeout(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(fileQuery)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const fData = await fRes.json();

        if (fData.files && fData.files.length > 0) {
          console.log(`[Restore] Found ${baseName} (ID: ${fData.files[0].id}), downloading...`);
          const contentRes = await fetchWithTimeout(
            `https://www.googleapis.com/drive/v3/files/${fData.files[0].id}?alt=media`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const json = await contentRes.json();
          console.log(`[Restore] Successfully downloaded ${baseName}`);
          return json;
        } else {
          console.log(`[Restore] File ${baseName} not found in folder.`);
        }
      } catch (e) {
        console.log(`[Restore] Error fetching ${baseName}:`, e);
      }
      return null;
    };

    // Parallel Fetch All Data
    console.log('[Restore] Fetching all backup files in parallel...');
    const [settings, products, customers, expenses, invoices] = await Promise.all([
      fetchFile('settings.json'),
      fetchFile('products.json'),
      fetchFile('customers.json'),
      fetchFile('expenses.json'),
      fetchFile('invoices.json')
    ]);

    // 1. Restore Settings
    if (settings && Array.isArray(settings) && settings.length > 0) {
      await AsyncStorage.setItem('app_settings', JSON.stringify(settings[0]));
      console.log('[Restore] Settings restored.');
    }

    // 2. Restore Products
    if (products && Array.isArray(products)) {
      await db.withTransactionAsync(async () => {
        for (const p of products) {
          await db.runAsync(
            `INSERT OR REPLACE INTO products (id, name, sku, category, price, stock, unit, tax_rate, variants, variant, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [p.id, p.name, p.sku, p.category, p.price, p.stock, p.unit, p.tax_rate, p.variants, p.variant, p.created_at, p.updated_at]
          );
        }
      });
      console.log(`[Restore] Restored ${products.length} products.`);
    }

    // 3. Restore Customers
    if (customers && Array.isArray(customers)) {
      await db.withTransactionAsync(async () => {
        for (const c of customers) {
          await db.runAsync(
            `INSERT OR REPLACE INTO customers (id, name, phone, email, type, gstin, address, source, tags, loyaltyPoints, notes, created_at, updated_at, amountPaid, whatsappOptIn, smsOptIn)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [c.id, c.name, c.phone, c.email, c.type, c.gstin, c.address, c.source, c.tags, c.loyaltyPoints, c.notes, c.created_at, c.updated_at, c.amountPaid, c.whatsappOptIn, c.smsOptIn]
          );
        }
      });
      console.log(`[Restore] Restored ${customers.length} customers.`);
    }

    // 4. Restore Expenses
    if (expenses && Array.isArray(expenses)) {
      await db.withTransactionAsync(async () => {
        for (const e of expenses) {
          await db.runAsync(
            `INSERT OR REPLACE INTO expenses (id, title, amount, category, date, payment_method, tags, receipt_url, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [e.id, e.title, e.amount, e.category, e.date, e.payment_method, e.tags, e.receipt_url, e.created_at, e.updated_at]
          );
        }
      });
      console.log(`[Restore] Restored ${expenses.length} expenses.`);
    }

    // 5. Restore Invoices
    if (invoices && Array.isArray(invoices)) {
      await db.withTransactionAsync(async () => {
        for (const i of invoices) {
          await db.runAsync(
            `INSERT OR REPLACE INTO invoices (id, customer_id, customer_name, date, type, items, subtotal, tax, discount, total, status, payments, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [i.id, i.customer_id, i.customer_name, i.date, i.type, i.items, i.subtotal, i.tax, i.discount, i.total, i.status, i.payments, i.created_at, i.updated_at]
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

    // 2. Prepare content (Wrap in array to match restore expectation)
    const content = JSON.stringify([settings], null, 2);

    // 3. Upload
    await uploadFileToFolder(accessToken, folderId, 'settings.json', content);

    // 4. Also upload explicit user_details.json as requested for cross-platform ease
    const userDetails = {
      store: settings.store,
      user: settings.user,
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
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${JSON.stringify(userDetails)}\r\n` +
      `--${boundary}--`;

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