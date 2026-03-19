/**
 * barcodeUtils.js
 *
 * Centralized barcode resolution utility for Kwiq Bill.
 *
 * SECURITY HARDENING:
 * - All inputs are sanitized (trimmed, length-capped, non-string coerced).
 * - Lookups are purely in-memory (no SQL, no eval, no dynamic execution).
 * - Barcode comparisons are case-insensitive but otherwise exact — no regex
 *   injection surface since we use direct string equality.
 * - Variant JSON parsing is wrapped in try/catch to prevent crashes from
 *   malformed stored data (e.g. corrupted Drive sync payloads).
 * - No data is written by this module — it is purely read-only.
 */

// ─────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────

/**
 * Maximum barcode length we accept.
 * Real-world barcodes (EAN-13, Code128, QR) are <= 128 chars.
 * Anything longer is treated as invalid to prevent memory/log abuse.
 */
const MAX_BARCODE_LENGTH = 128;

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────

/**
 * Sanitizes a raw barcode string.
 *  - Coerces non-strings safely.
 *  - Trims whitespace.
 *  - Caps length at MAX_BARCODE_LENGTH.
 *  - Returns null for empty/invalid input.
 *
 * @param {*} raw
 * @returns {string|null}
 */
export const sanitizeBarcode = (raw) => {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (str.length === 0) return null;
  if (str.length > MAX_BARCODE_LENGTH) return null; // refuse oversized input
  return str;
};

/**
 * Safely parse a product's variants field.
 * Handles: string JSON, already-parsed arrays, null/undefined.
 *
 * @param {*} raw
 * @returns {Array}
 */
const safeParseVariants = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  return [];
};

// ─────────────────────────────────────────────────────
// Core API
// ─────────────────────────────────────────────────────

/**
 * resolveBarcode
 *
 * Resolves a scanned barcode string to a product and optionally a specific
 * variant using a 5-level priority lookup (most specific → least specific).
 *
 * Priority:
 *   1. variant.barcode  — dedicated barcode per variant (new system)
 *   2. variant.sku      — older SKU-per-variant fallback
 *   3. product.sku      — product-level SKU (DB column, most reliable)
 *   4. product.barcode  — product-level barcode alias
 *   5. product.id       — last resort ID match
 *
 * @param {string}  barcodeData  Raw string from scanner or text input.
 * @param {Array}   products     Full products array from ProductContext.
 *
 * @returns {{
 *   product:  Object | null,
 *   variant:  Object | null,
 *   source:   'variant.barcode' | 'variant.sku' | 'product.sku' |
 *             'product.barcode' | 'product.id' | 'none'
 * }}
 */
export const resolveBarcode = (barcodeData, products) => {
  const NOT_FOUND = { product: null, variant: null, source: 'none' };

  // ── Input Guards ─────────────────────────────────────
  const data = sanitizeBarcode(barcodeData);
  if (!data) return NOT_FOUND;

  if (!Array.isArray(products) || products.length === 0) return NOT_FOUND;

  const dataLower = data.toLowerCase();

  // ── Single-pass lookup ───────────────────────────────
  // We track candidate product hits from steps 3-5 in the same pass
  // so we don't iterate the array twice.
  let productSkuMatch = null;
  let productBarcodeMatch = null;
  let productIdMatch = null;

  for (const product of products) {
    // Safety: skip garbage entries
    if (!product || typeof product !== 'object' || !product.id) continue;

    const variants = safeParseVariants(product.variants);

    // ── Priority 1: variant.barcode ─────────────────
    for (const v of variants) {
      if (!v || typeof v !== 'object') continue;
      const vBarcode = sanitizeBarcode(v.barcode);
      if (vBarcode && vBarcode.toLowerCase() === dataLower) {
        return { product, variant: v, source: 'variant.barcode' };
      }
    }

    // ── Priority 2: variant.sku ─────────────────────
    for (const v of variants) {
      if (!v || typeof v !== 'object') continue;
      const vSku = sanitizeBarcode(v.sku);
      if (vSku && vSku.toLowerCase() === dataLower) {
        return { product, variant: v, source: 'variant.sku' };
      }
    }

    // ── Priority 3-5: product-level (collect, don't return yet) ──
    if (!productSkuMatch) {
      const pSku = sanitizeBarcode(product.sku);
      if (pSku && pSku.toLowerCase() === dataLower) {
        productSkuMatch = product;
      }
    }

    if (!productBarcodeMatch) {
      const pBarcode = sanitizeBarcode(product.barcode);
      if (pBarcode && pBarcode.toLowerCase() === dataLower) {
        productBarcodeMatch = product;
      }
    }

    if (!productIdMatch) {
      // ID comparison is exact (IDs are system-generated, not user-scanned)
      if (String(product.id) === data) {
        productIdMatch = product;
      }
    }
  }

  // Return best product-level match in priority order
  if (productSkuMatch)    return { product: productSkuMatch,    variant: null, source: 'product.sku' };
  if (productBarcodeMatch) return { product: productBarcodeMatch, variant: null, source: 'product.barcode' };
  if (productIdMatch)     return { product: productIdMatch,     variant: null, source: 'product.id' };

  return NOT_FOUND;
};

// ─────────────────────────────────────────────────────
// Validation Helpers (used by ProductDrawer)
// ─────────────────────────────────────────────────────

/**
 * Checks whether a barcode value is a valid format.
 * Accepts alphanumeric characters, hyphens, and underscores.
 * Max 128 characters.
 *
 * SECURITY: Prevents special characters that could cause issues in
 * display, storage encoding, or future label-printing contexts.
 *
 * @param {string} barcode
 * @returns {{ valid: boolean, reason: string | null }}
 */
export const validateBarcodeFormat = (barcode) => {
  const cleaned = sanitizeBarcode(barcode);
  if (!cleaned) return { valid: false, reason: 'Barcode cannot be empty.' };
  // Allow: letters, numbers, hyphens, underscores, dots, forward-slashes
  // (covers SKU-001, EAN-13, QR-style codes, etc.)
  const SAFE_PATTERN = /^[A-Za-z0-9\-_.\/]+$/;
  if (!SAFE_PATTERN.test(cleaned)) {
    return {
      valid: false,
      reason: 'Barcode contains invalid characters. Only letters, numbers, hyphens ( - ), underscores ( _ ), dots ( . ) and slashes ( / ) are allowed.'
    };
  }
  return { valid: true, reason: null };
};

/**
 * Detects duplicate barcodes within a set of variant barcodes.
 * Works across the product-level barcode and all variant barcodes.
 *
 * @param {string}   productBarcode  The product-level barcode/sku
 * @param {Array}    variants        Array of variant objects
 * @returns {{ hasDuplicates: boolean, duplicates: string[] }}
 */
export const detectDuplicateBarcodes = (productBarcode, variants) => {
  const seen = new Map(); // barcode_lower → label
  const duplicates = [];

  const register = (raw, label) => {
    const bc = sanitizeBarcode(raw);
    if (!bc) return;
    const key = bc.toLowerCase();
    if (seen.has(key)) {
      duplicates.push(`"${bc}" (${label} and ${seen.get(key)})`);
    } else {
      seen.set(key, label);
    }
  };

  // Register product-level barcode
  if (productBarcode) register(productBarcode, 'Product SKU');

  // Register each variant barcode
  if (Array.isArray(variants)) {
    variants.forEach((v, i) => {
      if (!v || typeof v !== 'object') return;
      const label = `Variant "${v.name || `#${i + 1}`}"`;
      const bc = v.barcode || v.sku;
      if (bc) register(bc, label);
    });
  }

  return { hasDuplicates: duplicates.length > 0, duplicates };
};

/**
 * Builds a cart-ready payload from a resolved barcode match.
 * Merges product and variant data cleanly so that BillingPage
 * and billingQueue receive a consistent, predictable shape.
 *
 * @param {Object} product   Resolved product from resolveBarcode()
 * @param {Object|null} variant  Resolved variant (may be null)
 * @returns {Object}  Cart-ready product payload
 */
export const buildCartPayload = (product, variant) => {
  if (!product) return null;

  if (!variant) {
    // Plain product — no variant context needed
    return { ...product };
  }

  return {
    ...product,
    // Override price and stock with variant-specific values
    price: (variant.price !== null && variant.price !== undefined && variant.price !== '')
      ? parseFloat(variant.price)
      : parseFloat(product.price || 0),
    stock: (variant.stock !== null && variant.stock !== undefined && variant.stock !== '')
      ? parseInt(variant.stock, 10)
      : parseInt(product.stock || 0, 10),
    // Variant identification fields (consumed by BillingPage.addItemToCart)
    _resolvedVariant: variant,
    variantName: variant.name || (variant.options && variant.options[0]) || null,
    // Preserve the original DB product ID for stock updates
    _dbProductId: product.id,
  };
};
