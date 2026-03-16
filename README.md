# Kwiq_Bill

Overview
- Kwiq Bill is a Local-First, Cloud-Synced retail invoicing and ledger system designed for offline robustness in retail environments with multi-device synchronization via Google Drive.
- Each user operates on an isolated local SQLite database file, enabling strong data separation and resilience to network outages.
- Data flow is built around Event Sourcing, Baselining (snapshots), and a one-way sync pipeline to the cloud.

Key Design Principles
- Local-first: operate offline with deterministic local state and seamless online sync.
- Strong data isolation: per-user database files to prevent cross-user data leakage.
- One-way, append-only sync with deduplication to maintain data integrity during cloud sync.
- End-to-end data integrity: signed snapshots, encrypted envelopes, and robust parsing of Drive responses.
- Clear domain separation: Stock (inventory), Ledger (debt), and Loyalty (points) stay in lockstep via a single delta engine.
- Performance-minded UI: memoized filters and debounced search to keep a smooth experience on large datasets.

Architecture at a Glance
- Local data layer: SQLite with WAL enabled (expo-sqlite).
- Data model: invoices, products, customers; complex fields stored as JSON strings (items, variants, payments).
- Sync: OneWaySyncService.js handles event envelopes, queues, and cloud uploads to Google Drive.
- Security: JWT authentication, secure token storage, and offline-capable payment artefacts (SVG UPI QR codes).
- Domain logic: adjustInvoiceEffects coordinates stock, debt, and loyalty using a unified delta rule.
- UI & printing: React Native-based UI with Indian-script rendering support; printing via captured PNGs and printer service.

Directory Map (from the mobile app)
- src/context/              # Central state management and orchestration
- src/services/             # Core services (DB schema, sync service)
- src/pages/                # UI views (Invoices, Billing)
- src/components/           # Reusable UI atoms and specialized renderers
- src/utils/                # Helpers (formatting, dates, crypto)

Core Data Model (SQLite)
- Database files: zilling_{safe_email}.db (per-user database file)
- Tables:
  - invoices: stores JSON blobs for items and payments; weekly_sequence for receipt numbering
  - products: tracks global stock; variants stored as a JSON array in a single column
  - customers: tracks outstanding debt, lifetime amount paid, loyalty points
- Migrations: initializeDB performs dynamic ALTER TABLE patches when new columns are detected

Sync Engine: One-Way Sync
- Location: src/services/OneWaySyncService.js
- Flow:
  1) CRUD in Context triggers SyncService.createAndUploadEvent
  2) Envelope: { timestamp, deviceId, type, payload }
  3) Queue: events saved to AsyncStorage as pending_upload_queue
  4) Network: uploaded to Google Drive folder Kwiqbill/kwiq bill backup/
  5) Dedup: processed_events_ids prevents duplicate processing on sync-down
- Data integrity:
  - Smart parsing of Drive responses to remove MIME artifacts from Drive responses
  - AES-256 encryption using the user’s email as the key hash
  - Snapshots: every 50 events, a Global Snapshot baseline is created and SHA-256 signed

Ledger Engine: adjustInvoiceEffects
- Location: src/context/TransactionContext.js
- Concept: the Holy Trinity (Stock, Ledger, Loyalty) stays in sync
- Direction:
  - 1: applying an invoice (Stock down, Debt up)
  - -1: reverting an invoice (Stock up, Debt down)
- Steps:
  1) Main Product Stock: update total per productId
  2) Variant Stock: iterate variants JSON array; match by name; perform precise floating-point math
  3) Customer Balance:
     - outstanding += (Total - Received) * direction
     - amountPaid += Received * direction
     - loyaltyPoints += (Earned - Redeemed) * direction

Billing, Tax & Discounts
- Files: BillingGrid.jsx and InvoicesPage.jsx
- Tax types:
  - intra: split tax_rate into CGST/SGST (50/50)
  - inter: full rate applied as IGST
- Discounts:
  - Item Level: reduces row total
  - Bill Level: reduces subtotal pre-tax
  - Loyalty Discount: final deduction before rounding

UI & Printing
- Invoices & Search: InvoicesPage.jsx
- State: local toggles; data via TransactionContext
- Filtering: useMemo for performance; 300ms debounce on search; ISO-based date ranges
- Printing: IndianScriptRenderer.jsx renders receipts; hidden HTML/SVG to PNG via react-native-view-shot; sent to printer service over Bluetooth/Network; supports non-Latin scripts by pre-rendering as images

Security & Privacy
- JWT-based Auth; tokens stored in SecureStore
- API Interceptors: Axios injects Bearer token; 401 handling purges DB session
- Privacy: offline SVG-based UPI QR generation; data only leaves device to user's Google Drive

Common Developer Guidance
- JSON Columns: store as strings; JSON.parse when reading
- Circular Dependencies: avoid importing TransactionContext inside SyncService; use require for DB refs in sync methods
- Currency: display with toFixed(2); store raw numbers in DB to avoid precision drift
- Sequence: weekly_sequence resets Sunday midnight

Tech Stack (per layer)
- Mobile: React Native / Expo; SQLite via expo-sqlite
- Backend: Server-side components in backend/ (see backend/README.md)
- Cloud: Google Drive API (V3)
- Security: JWT, AES-256, SecureStore
- Printing: react-native-view-shot, native printers
- Data formats: JSON blobs for variants/items/payments

Getting Started
Prerequisites
- Node.js (LTS)
- Expo CLI
- Java JDK (for Android builds)
- Google Drive API credentials for backup folder access
- Access to a Google account for Drive backup

Quick Start (Mobile App)
1) Install dependencies
   - cd Zilling-mobile
2) Setup environment
   - Configure any necessary Google Drive credentials and token storage (as per backend/mobile docs)
3) Run
   - npm run start (or expo start)
   - Use Expo Go on device to scan the QR code; or run on Android Studio / Xcode simulators as appropriate

Notes
- The app supports offline operation; syncing is one-way to Google Drive with deduplication safeguards.
- Data integrity is protected via snapshots signed with SHA-256.
- For testing, consider focusing on the delta engine (adjustInvoiceEffects) and the sync envelope pipeline.

Directory & File References
- ai.md: Architecture overview (for reference)
- Zilling-mobile/ (mobile app)
- backend/: Server-side components (see backend/README.md)
- WebFor-Extendplan/: Documentation and patterns

Glossary
- Global Snapshot: Baseline snapshot of the entire database every 50 events, SHA-256 signed.
- Envelope: Meta wrapper around event data { timestamp, deviceId, type, payload }.
- pending_upload_queue: Local queue for events waiting to be uploaded.
- processed_events_ids: Deduplication store for events processed during sync-down.
- zilling_{safe_email}.db: Per-user local SQLite database filename.

Contributing
- This repo welcomes contributors. Please follow existing conventions for commit messages and code style, and refer to the backend/mobile docs for environment setup.

License
- See LICENSE for licensing details.

Further Reading
- ai.md (architecture reference for mobile)
- backend/README.md (server-side architecture and APIs)
- This README is designed to serve as a comprehensive, professional overview of the system, its architecture, and its design rationale. If you’d like, I can tailor it further for a specific audience (engineers, product managers, or new contributors) or generate a diagram (ASCII or PlantUML) to accompany this document.

Architecture Diagram
```mermaid
graph TD;
  L[Local SQLite: zilling_{safe_email}.db] --> C[TransactionContext / State]
  C --> S[OneWaySyncService]
  S --> E[Envelope: timestamp, deviceId, type, payload]
  E --> Q[Pending Upload Queue: AsyncStorage]
  Q --> GDrive[Google Drive: Kwiqbill backup]
  GDrive --> DEDUP[processed_events_ids (dedup)]
  DEDUP --> C
  subgraph Integrity
    GSnapshot[Global Snapshot (SHA-256)]
    PIntegrity[Smart Parsing / AES-256]
    Q --> GSnapshot
    Q --> PIntegrity
  end
  subgraph UI & Printing
    UI[InvoicesPage / BillingGrid]
    UI --> C
    Printer[IndianScriptRenderer -> Printer]
  end
```

Notes:
- This diagram shows core data flow: local state → event generation → cloud sync → dedup and integrity checks.
- One-way sync means changes flow from local to cloud; dedup handles sync-down safety.
