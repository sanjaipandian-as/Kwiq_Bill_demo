# Implementation Plan: Receptionist Names Management & Tracking

## 1. Objective
Add a secure, mandatory receptionist selection system to the billing workflow for accountability. Admins can manage a list of receptionists, and every bill must be linked to one. The receptionist name will only appear on authorized admin copies of the invoices.

---

## 2. Database Schema Changes

### 2.1 New Table: `receptionists`
File: `src/services/database.js`
```sql
CREATE TABLE IF NOT EXISTS receptionists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT,
    updated_at TEXT
);
```

### 2.2 Invoice Table Update
File: `src/services/database.js`
- Add column `receptionist_name` (TEXT) to tracking the creator of each invoice.
- Add column `receptionist_id` (TEXT) for direct relationship.

---

## 3. Settings Management (Admin Only)

### 3.1 UI Section in Settings
File: `src/pages/Settings/SettingsPage.jsx`
- Add a new tab or section titled **"User Access & Receptionists"**.
- **Access Control**: Use `user.role === 'Owner'` (Admin) check to hide/show the management interface.
- **CRUD Operations**: Implement a list view with "Add New Receptionist".
- **Soft Delete Policy**: Use **Deactivation** (`is_active = 0`) instead of hard deletion. This ensures that historical bills linked to a receptionist still maintain valid reference data even if that receptionist no longer works at the store.

### 3.2 Global State Integration
File: `src/context/SettingsContext.js`
- Create a `ReceptionistContext` or add `receptionists` array to `SettingsContext` for easy access across the app.
- Ensure encryption is applied to receptionist names during persistence using the existing `CryptoJS` logic.

---

## 4. Billing Workflow Enhancements

### 4.1 Mandatory Selection
File: `src/pages/Billing/BillingPage.jsx`
- **New State**: Add `selectedReceptionist` to the `activeBill` object.
- **Pre-Save Check**: In `handleSaveOnly` and `handleSavePrint`, inject a validation step.
- **UI Component**: If no receptionist is selected, show a mandatory selection modal/pop-up before allowing the "Save" or "Print" action to complete.

### 4.2 Data Persistence
File: `src/context/TransactionContext.js`
- Update `addTransaction`: Include `receptionist_name` in the payload and the SQL `INSERT` statement.
- **Bill Edit Protection**: In `editTransaction`, the `receptionist_name` field will be **locked/read-only**. Once a bill is created by a specific receptionist, that link cannot be changed during subsequent edits to prevent tampering or accountability shifts.
- Update `editTransaction`: Maintain the `receptionist_name` even during edits.

---

## 5. Security & Synchronization

### 5.1 Google Drive Sync
File: `src/services/googleDriveservices.js`
- Include `receptionists` in the `syncUserDataToDrive` list of tables.
- Ensure `receptionists.json` is encrypted before upload.

### 5.2 Event Tracking
File: `src/services/OneWaySyncService.js`
- Add `RECEPTIONIST_CREATED`, `RECEPTIONIST_UPDATED`, and `RECEPTIONIST_DELETED` to `EventTypes`.
- **Sync Reliability**: Implement a **retry queue** for Google Drive sync. If a sync fails due to network issues, the event is queued locally and retried automatically to ensure no receptionist data is silently lost.
- Ensure these events sync to the cloud immediately upon creation.

---

## 6. Template & Privacy Controls

### 6.1 Authorized Signatory Copy
File: `src/utils/printUtils.js`
- Update `printReceipt` and `printHybrid` to handle an `isAuthorized` flag.
- When `isAuthorized` is true: Render `Created By: [Receptionist Name]` in a small font near the Authorized Signatory line.

### 6.2 Customer Copy (Privacy)
File: `DetailedInvoiceTemplate.jsx`, `ThermalInvoiceTemplate.jsx`, etc.
- Explicitly exclude the `receptionist_name` from the standard customer-facing view.
- Ensure the name is only visible when the `Authorized Signatory` mode is toggled for an admin-only print/PDF.

---

## 7. Recovery & Integrity
- **Dual Storage**: Every save operation will hit the local SQLite DB first, followed by an immediate background sync to MongoDB and Google Drive.
- **Restoration**: Update `restoreUserDataFromDrive` in `googleDriveservices.js` to restore the `receptionists` table if a fresh install or data loss occurs.

---

## 8. Future Scope & Extensibility

### 8.1 Receptionist User Accounts
The current schema (using `receptionist_id` and `receptionist_name` columns) is designed to be **forward-compatible**. If the app evolves to support individual receptionist logins later, these IDs can be linked directly to user accounts without requiring a database migration.
