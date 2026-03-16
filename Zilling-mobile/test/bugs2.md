# 🛡️ Supplementary Security & QA Audit Report (bugs2.md)

Following up on the initial audit, here is part 2 containing additional, severe issues found in the expanded codebase (`InvoicesPage.jsx` and `IndianScriptRenderer.jsx`). 

---

## 1. COMPLIANCE & DATA ISSUES

### Third-Party PII Data Leakage (GDPR/PCI-DSS Violation)
- 🔴 **Severity:** High
- 📍 **Location:** `IndianScriptRenderer.jsx` | `renderSupportQRs`, `renderSingleQR` | Lines 134, 138, 142, 149
- 📝 **Description:** The application generates QR codes by directly injecting raw, unencrypted contact and payload data (WhatsApp phone numbers, email addresses, and specific QR data) into the URL of a completely external, free third-party API: `https://api.qrserver.com/v1/create-qr-code/?data=...`.
- 💥 **Impact:** Sending sensitive business or user VPA/payment URLs via unencrypted GET parameters to external servers means those third parties (and any proxies along the way) log all PII in plain text. This explicitly violates data privacy regulations and exposes users to tracking/phishing.

---

## 2. CODE QUALITY BUGS

### React Memory Leaks & Null Reference Crashes
- 🔴 **Severity:** Medium
- 📍 **Location:** `IndianScriptRenderer.jsx` | `renderTextToImage`, `renderBillToImage` | Lines 18, 41, 64, 87
- 📝 **Description:** Asynchronous `setTimeout` closures are fired to wait for the UI to lay out before calling `viewShotRef.current.capture()`. However, the timeout IDs are never tracked, meaning there is no `clearTimeout` cleanup if the component unmounts.
- 💥 **Impact:** If the user presses "share/print" and rapidly navigates away, the timeout executes when the component is unmounted. Accessing `.capture()` on the dead/null ref causes the app to fatally crash.

### Main Thread UI Blocking (O(N) Render Cycles)
- 🔴 **Severity:** High
- 📍 **Location:** `InvoicesPage.jsx` | `filteredInvoices` evaluation | Lines 379-429
- 📝 **Description:** The array filtering logic processes the entire `transactions` list for search matching, string slicing, and complex `Date()` initializations *synchronously* inside the main component body, without `useMemo`.
- 💥 **Impact:** As the business amasses thousands of invoices, typing a single character in the search bar or toggling a filter will cause massive UI lockups, jittery animations, and severe frame drops.

---

## 3. BUSINESS LOGIC BUGS

### Negative Total Forgery (Cashier Skimming)
- 🔴 **Severity:** High
- 📍 **Location:** `InvoicesPage.jsx` | Edit Invoice Modal | Line 1064
- 📝 **Description:** When overriding the invoice total, the input parses strictly with `parseFloat(val) || 0`. There are no Math boundary restrictions (`Math.max(0, ...)`).
- 💥 **Impact:** Unscrupulous cashiers could edit any pending invoice via the UI and type a `-` prefix (e.g., `-2500`). The database accepts this negative value, destroying dashboard ledger integrity and allowing staff to skim cash while balancing the app totals out artificially.

### Fatal Print Engine Crashes (Missing Tax Guardrails)
- 🔴 **Severity:** High
- 📍 **Location:** `InvoicesPage.jsx` | `executePrint()`, `executePreview()` | Lines 153, 154, 469, 470
- 📝 **Description:** The data mapping engine directly performs arithmetic and calls `.toFixed(2)` assuming `item.taxAmount` is always a valid number (e.g., `cgstAmt: (item.taxAmount / 2).toFixed(2)`). Legacy or tax-exempt zero-rated items might yield `null` or `undefined` tax amounts.
- 💥 **Impact:** `undefined / 2` evaluates to `NaN`. Calling `NaN.toFixed(2)` immediately crashes the app with a `TypeError` right when the user tries to print or preview an invoice with malformed data.

### Date Parsing Inconsistency Bug
- 🔴 **Severity:** Medium
- 📍 **Location:** `InvoicesPage.jsx` | Input Form UI | Line 1055
- 📝 **Description:** `new Date(editingInvoice.date).toLocaleDateString('en-GB')` doesn't safety-check the initialization string.
- 💥 **Impact:** If `editingInvoice.date` from legacy SQLite migrations isn't a strict ISO structure, `new Date()` results in `Invalid Date`. This propagates up the React tree and crashes the Date Picker UI formatting block, permanently locking the user out of the Edit flow for that specific invoice.
---

## 4. NEW: CRITICAL BUSINESS LOGIC INCIDENTS (LEDGER & INVENTORY)

### Invoice Edit Inventory Desync (Delta Forgery)
- 🔴 **Severity:** Critical
- 📍 **Location:** `TransactionContext.js` | `editTransaction`
- 📝 **Description:** When an invoice is edited via the UI, the `items` array is overwritten in the database, but the underlying inventory stock is never adjusted. `addTransaction` manages stock deductions, but `editTransaction` completely omits the logic to revert old item stock and apply the new item stock.
- 💥 **Impact:** Cashiers can create an invoice for 10 expensive items (deducting stock), then immediately edit the invoice to 1 cheap item. The inventory remains permanently deducted for the 9 expensive items, decoupling physical stock from system records and enabling massive theft/loss hiding.

### Invoice Delete Variant Leak (Nested Stock Desync)
- 🔴 **Severity:** High
- 📍 **Location:** `TransactionContext.js` | `deleteTransaction`, `restoreTransaction`
- 📝 **Description:** When an invoice is deleted, the generalized `product.stock` is restored. However, the nested `variants` array (e.g., specific sizes/colors) stock is completely ignored during the restore cycle, despite being correctly decremented inside `addTransaction`.
- 💥 **Impact:** Deleting a transaction restores the main product count but permanently leaks specific variant counts. Over time, the sum of variant stock will massively diverge from the main product stock.

### Customer Ledger Phantom Debt (Edit/Delete Desync)
- 🔴 **Severity:** Critical
- 📍 **Location:** `TransactionContext.js` | `editTransaction`, `deleteTransaction`
- 📝 **Description:** Similar to the inventory desync, when an invoice is created, the customer's `outstanding` debt, `amountPaid`, and `loyaltyPoints` are instantly updated. If that invoice is later edited, paid off, or deleted, these corresponding customer ledger values are NOT recalculated or reverted.
- 💥 **Impact:** If a user deletes an unpaid invoice, the customer's profile will still show them owing the debt forever. If an invoice is deleted, the customer gets to keep the loyalty points permanently. Re-saving or editing an invoice provides no sync mechanism for financial reconciliations on the customer level.
