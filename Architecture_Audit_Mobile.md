# Production Architecture Audit: KwiqBill Mobile (React Native)

This document provides a deep-dive technical analysis of the React Native mobile application's architecture, focuses on offline-first data handling, cloud synchronization, and state integrity.

---

## 1️⃣ Overall Architecture Pattern: **Hybrid Event-Sourced Snapshot Replication**

The application follows a **Hybrid Event Sourcing** paradigm with **CQRS-like** characteristics. It is not a pure "Event Store only" system; rather, it uses a dual-write strategy:

*   **Command Side (Local)**: Mutations are applied immediately to a local **SQLite** database (the "Read Model") for optimistic UI.
*   **Event Side (Cloud)**: Every mutation is encapsulated into an **Event Envelope** and dispatched to **Google Drive**, which acts as the global **Append-Only Event Store**.
*   **Query Side**: The UI reads directly from the local SQLite DB, which is kept in sync with the cloud event stream.

**Code Reference:**
*   `OneWaySyncService.js`: Defines `EventTypes` and `createAndUploadEvent`.
*   `TransactionContext.js`: Implements the dual-write logic (DB update followed by Event dispatch).

---

## 2️⃣ Local Storage Layer: **Relational SQLite with Document Blobs**

The mobile app utilizes **SQLite** (via `expo-sqlite`) as its primary persistent storage.

*   **Structure**: Relational tables (`customers`, `products`, `invoices`, `expenses`).
*   **Data Format**: A hybrid of strict schema and JSON documents. Fields like `items`, `payments`, and `variants` are stored as **JSON strings** inside table columns, effectively treating segments of the relational DB as a document store.
*   **Initialization & Migrations**: Handled in `database.js` using `PRAGMA table_info` checks. It performs safe migrations by adding columns at runtime if they are missing.
*   **Indexing**: Relies on `PRIMARY KEY` (UUIDs) and `UNIQUE` constraints (e.g., `sku` in products).
*   **Normalization**: The data is **denormalized** at the point of storage for performance. For example, `customer_name` is often stored directly in the `invoices` table to avoid joins during list rendering.

---

## 3️⃣ Mutation Flow: **Optimistic UI with Background Resiliency**

Traces the lifecycle of a mutation (e.g., `addTransaction`):

1.  **Local SQL Transaction**: The data is written to the SQLite `invoices` table immediately.
2.  **Local Side-Effects**: Logic calculates stock deductions and loyalty points updates, applying them to `products` and `customers` tables in the same flow.
3.  **State Update**: The React context (`TransactionContext`) state is updated, ensuring zero-latency UI responsiveness.
4.  **AutoSave Trigger**: Triggers a local backup check.
5.  **Event Generation**: An event (e.g., `INVOICE_CREATED`) is generated with a unique `eventId` and timestamp.
6.  **Queue & Upload**:
    *   The event is added to a `pending_upload_queue` in `AsyncStorage`.
    *   An immediate upload attempt to Google Drive is made with an **8-second racing timeout**.
    *   If the upload fails (offline), the event remains in the queue for a future `retryQueue` call.

---

## 4️⃣ Event System: **Google Drive as a Serverless Event Store**

The application treats Google Drive as its "Backend DB."

*   **Event Envelope**:
    ```json
    {
      "eventId": "UUID",
      "type": "INVOICE_CREATED",
      "createdAt": "ISO8601-Timestamp",
      "deviceId": "mobile-XXXX",
      "payload": { ... }
    }
    ```
*   **Storage Strategy**: Each event is a single `.json` file in a dedicated `events` folder.
*   **Retrieval (Sync Down)**:
    *   Uses **Incremental Sync**: Queries Google Drive for files `createdTime > lastSyncedTimestamp`.
    *   **Parallel Fetching**: Downloads event content in batches of 100 using `Promise.all`.
    *   **Idempotency**: Before applying, it checks `processed_events_ids` in `AsyncStorage` to prevent duplicate processing.
*   **Ordering**: Events are sorted lexically by filename: `event_TIMESTAMP_TYPE_EVENTID.json`. This ensures deterministic ordering across different devices based on the creation time.

---

## 5️⃣ Snapshot / Force Push System: **The "Golden State" Backup**

Beyond the event log, the app supports **Full Table Snapshots**.

*   **Structure**: Flat JSON arrays per table (`products.json`, `invoices.json`, etc.).
*   **Sync Logic**: `syncUserDataToDrive` periodically uploads the entire local DB state to the cloud.
*   **Restore Logic**: `restoreUserDataFromDrive` performs a "Force Restore" by downloading these snapshots and executing `INSERT OR REPLACE` statements, merging cloud state into local storage.
*   **Role**: Snapshots act as a checkpoint to prevent re-processing thousands of tiny event files on a new device.

---

## 6️⃣ Background Sync Engine: **Event Replay & Batched Transactions**

*   **Triggers**: Sync is triggered on App Launch and manually via UI.
*   **Queue Management**: `AsyncStorage` maintains a persistent queue of events that failed to upload.
*   **Race Conditions**: Handled by **Last-Write-Wins** at the event level (via timestamps) and **Deterministic Replay** (the order of events applied locally matches the cloud sequence).
*   **Performance**: `syncDown` uses `db.withTransactionSync` to apply 100+ events at once, drastically reducing disk I/O overhead compared to individual `INSERT`s.

---

## 7️⃣ Backup Mechanism: **Dual-Cloud & Local Redundancy**

*   **Sync vs. Backup**:
    *   **Sync**: Granular event files for multi-device collaboration.
    *   **Backup**: Multi-table JSON snapshots for total data recovery.
*   **Local Backups**: Uses Android **Storage Access Framework (SAF)** to write JSON files to user-controlled device folders.
*   **Redundancy**: Stores data in `KwiqBilling-{userId}` folder on Google Drive, including a specific `tax_report.json`.

---

## 8️⃣ Recalculation & Data Integrity: **Local Determinism**

The app performs several real-time recalculations during event ingestion:

*   **Stock Corrections**: When an `INVOICE_CREATED` event isApplied, stock is deducted. If `INVOICE_DELETED` is processed, stock is restored.
*   **Loyalty & Balances**: Customer `outstanding` balances and `loyaltyPoints` are recomputed during event application.
*   **Integrity Scripts**: The `applyEventSync` function acts as the "Truth Logic." If applying an event fails, it logs errors but continues the batch to prevent sync deadlocks.

---

## 9️⃣ Conflict Resolution Strategy: **Deterministic Event Sequencing**

*   **Strategy**: **Clock-based Determinism** (not CRDT).
*   **Simultaneous Edits**: If two devices edit the same invoice, the device that uploads second (lexically later timestamp) will effectively "win" the state of that invoice, but the historical change is preserved in the event log.
*   **Negative Stock**: The system allows negative stock if cumulative invoice quantities exceed initial stock, as it prioritizes recording the sale transaction over strict inventory block.

---

## 🔟 Security Layer: **Client-Side Auth & Scoped Storage**

*   **Authentication**: Managed via `@react-native-google-signin/google-signin`.
*   **Storage Access**: The app uses the `drive.file` scope, meaning it can **only** see files it created, protecting user privacy against other data in their Drive.
*   **Encryption**: Conditional support for `U2FsdGVkX1` (AES) strings exists in the sync parser, suggesting a layer of data-at-rest encryption for sensitive payloads.

---

## 11️⃣ Scalability & Risk Assessment

*   **Event Log Growth**: Listing thousands of files in Google Drive can become a bottleneck. The app mitigates this with `createdTime` filters and `pageSize=1000`.
*   **Memory Pressure**: Downloading large batches of events (100+) into memory before SQL insertion could pressure low-end devices.
*   **Cold Start**: A new device must download all snapshots + all events since the last snapshot, which can be bandwidth-intensive.
*   **Battery**: Intensive sync processes are currently UI-blocked or manually triggered, avoiding silent battery drain but impacting UX during large syncs.

---

## 12️⃣ End-to-End Flow Diagram (Narrative)

1.  **User action**: Creates Invoice `INV-001`.
2.  **Local storage**: SQLite saves invoice, updates Product Stock.
3.  **Event creation**: `INVOICE_CREATED` event JSON built.
4.  **Pending Queue**: Event saved to `AsyncStorage`.
5.  **Dispatch**: App calls Google Drive API `POST /files`.
6.  **Cloud storage**: `event_20240101_INC_001.json` appears in `events/` folder.
7.  **Device B Sync**: Polls Drive, finds `event_20240101_INC_001.json`.
8.  **Ingestion**: Device B downloads JSON, validates `eventId`.
9.  **Application**: Device B runs `applyEventSync`, updates its local SQLite invoice table and deducts stock.
10. **UI Update**: Device B's UI reflects the new invoice and updated stock.

---

## 13️⃣ Comparison Against Backend-Driven Architecture

| Feature | Mobile-Drive Architecture (Current) | Traditional Backend-API Architecture |
| :--- | :--- | :--- |
| **Source of Truth** | Google Drive (Event Log) | Central Database (PostgreSQL/MongoDB) |
| **Logic Location** | Client-Side (Apply Scripts) | Server-Side (Controllers/Services) |
| **Offline Support** | Native (Local DB + Local Queue) | Requires complex caching (Service Workers) |
| **Sync Latency** | High (Polling-based / File Listing) | Low (WebSockets / Push) |
| **Cost** | Zero (Client-side API usage) | High (Server hosting + Database fees) |
| **Resiliency** | Very High (No central server to crash) | Medium (Subject to server uptime) |

---

## 14️⃣ Final Architecture Classification: **Offline-First Event Sourced Delta Replication**

The KwiqBill Mobile architecture is best classified as an **Offline-First Event Sourced Delta Replication** system. 

**Justification:**
1.  **Offline-First**: It treats local SQLite as primary and cloud as secondary.
2.  **Event Sourced**: Every state change is represented as an immutable event file.
3.  **Delta Replication**: It only syncs the "deltas" (new events) rather than full database dumps for every change.
4.  **Hybrid Snapshotting**: It uses periodic full-state backups to keep "rehydration" (bootstrapping new devices) fast.
