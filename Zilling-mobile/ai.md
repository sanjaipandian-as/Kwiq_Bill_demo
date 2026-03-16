# Kwiq Bill: Comprehensive System Architecture & Working Structure

**Target Audience**: AI Agents, System Architects, and Lead Developers.

---

## 1. 🏗️ High-Level Architecture
Kwiq Bill follows a **Local-First, Cloud-Synced** architecture. It is designed to work offline in retail environments while providing multi-device synchronization via Google Drive.

- **Primary Storage**: Local SQLite (via `expo-sqlite`).
- **Sync Method**: Event Sourcing (Incremental) + Baselining (Snapshots).
- **Communication**: REST API for Auth; Google Drive V3 API for data persistence.
- **Isolation**: Each user has their own physical `.db` file for complete data separation.

---

## 2. 📂 Working Structure (Directory Map)

| Directory | Purpose |
| :--- | :--- |
| `src/context/` | Central nervous system. Manages state (Transactions, Products, Auth) and coordinates DB/Sync activities. |
| `src/services/` | Heavy lifters. `database.js` handles schema/PRAGMAs; `OneWaySyncService.js` handles cloud logic. |
| `src/pages/` | UI views. `Invoices/` and `Billing/` are the core business modules. |
| `src/components/` | Reusable UI atoms and specialized renderers like `IndianScriptRenderer.jsx`. |
| `src/utils/` | Formatting, Date helpers, and Crypto utilities. |

---

## 3. 💾 Data Layer Deep Dive

### SQLite Schema (`src/services/database.js`)
The system uses **SQLite** with WAL (Write-Ahead Logging) enabled.

- **User Partitioning**: Databases are named `zilling_{safe_email}.db`. Switching users switches the file.
- **Automatic Migrations**: `initializeDB` checks for missing columns on boot and uses `ALTER TABLE` to patch schemas dynamically.
- **Primary Tables**:
  - `invoices`: Stores JSON blobs for `items` and `payments`. Uses `weekly_sequence` for receipt numbering.
  - `products`: Tracks global `stock`. Complex variants are stored as a JSON array in the `variants` column.
  - `customers`: Tracks `outstanding` (debt), `amountPaid` (lifetime), and `loyaltyPoints`.

---

## 4. 🔄 Sync Engine: The "One-Way" Protocol

The system uses **One-Way Sync Service** (`src/services/OneWaySyncService.js`) to mirror state to Google Drive.

### Event Sourcing Flow
1. **Trigger**: Any CRUD operation in a Context (e.g., `addTransaction`) calls `SyncService.createAndUploadEvent`.
2. **Envelope**: Data is wrapped in a meta-envelope: `timestamp`, `deviceId`, `type`, and `payload`.
3. **Queueing**: Events are saved to a local `pending_upload_queue` in `AsyncStorage` to survive crashes.
4. **Networking**: Uploaded to `Kwiqbill/kwiq bill backup/` folder on Google Drive.
5. **Deduplication**: `processed_events_ids` tracker prevents duplicate processing on sync-down.

### Data Integrity Features
- **Smart Parsing**: Strips MIME/Multipart artifacts common in Drive API responses.
- **Decryption**: Uses AES-256 with the user's email as a hash key.
- **Snapshots**: Every 50 events, a `Global Snapshot` is generated. It's a baseline of the entire database, signed with **SHA-256** to detect tampering.

---

## 5. ⚖️ The Ledger Engine: `adjustInvoiceEffects`

This is the most critical logic block in `src/context/TransactionContext.js`. It ensures the "Holy Trinity" (Stock, Ledger, Loyalty) stays in sync.

### The Delta Rule
The engine works on **Directions**:
- `direction = 1`: Applying a new invoice (Stock ⬇️, Debt ⬆️).
- `direction = -1`: Reverting an invoice (Stock ⬆️, Debt ⬇️).

### Step-by-Step Logic:
1. **Main Product Stock**: Updates total count for the product ID.
2. **Variant Stock**: Iterates through the `variants` JSON array. Matches by name, parses current stock, and performs floating-point math.
3. **Customer Balance**:
   - `outstanding += (Total - Received) * direction`
   - `amountPaid += Received * direction`
   - `loyaltyPoints += (Earned - Redeemed) * direction`

---

## 6. 🧾 Billing & Tax Logic

### Calculation Flow (`BillingGrid.jsx` & `InvoicesPage.jsx`):
- **Tax Types**:
  - `intra`: Splits `tax_rate` into 50/50 CGST and SGST.
  - `inter`: Applies full rate as IGST.
- **Discounts**:
  - `Item Level`: Reduces individual row total.
  - `Bill Level`: Reduces the subtotal (pre-tax).
  - `Loyalty Discount`: Applied as a final deduction before `roundOff`.

---

## 7. 🎨 UI & Workflow Orchestration

### Invoices & Search (`InvoicesPage.jsx`)
- **State Management**: Uses local `useState` for filter toggles but pulls data from `TransactionContext`.
- **Search Optimization**: Uses a 300ms debounce on the search query. Filtering happens in a `useMemo` block to keep the UI at 60fps even with 1000+ invoices.
- **Date Filtering**: Handles `Today`, `Yesterday`, `This Week`, and `Custom` ranges via ISO string comparisons.

### The Printing Engine
1. **Component**: `IndianScriptRenderer.jsx`
2. **Process**:
   - UI renders a hidden view containing the receipt HTML/SVG.
   - `react-native-view-shot` captures the view as a high-res PNG.
   - The PNG is sent to the printer service via Bluetooth/Network.
3. **Multi-Language Support**: Supports rendering Indian scripts (Hindi, Tamil, etc.) correctly by converting text to high-fidelity images before printing.

---

## 🔒 Security Architecture
- **Auth**: JWT-based. Tokens stored in `SecureStore`.
- **Interceptors**: Axios interceptors (`src/services/api.js`) automatically attach Bearer tokens and handle 401/Unauthorized by purging the DB session.
- **Privacy**: QR codes for UPI payments are generated **offline** using SVGs. No customer data leaves the device except to the user's private Google Drive.

---

## ⚠️ Common Pitfalls for Developers
1. **JSON Stringification**: SQLite doesn't support native JSON types. Always `JSON.parse` columns like `items`, `payments`, and `variants` when reading.
2. **Circular Dependencies**: Importing `TransactionContext` inside `SyncService` is forbidden. Use `require()` for DB references inside sync methods.
3. **Float Precision**: Always use `.toFixed(2)` for currency display, but keep raw Numbers for database storage to avoid compounding errors.
4. **Sequence Resets**: `weekly_sequence` resets every Sunday at midnight.
