CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firstName TEXT NOT NULL,
  lastName TEXT,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  customerType TEXT,
  gstin TEXT,
  address TEXT,
  source TEXT,
  tags TEXT,
  loyaltyPoints INTEGER DEFAULT 0,
  notes TEXT,
  createdAt TEXT
);




CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  category TEXT,
  brand TEXT,
  price REAL,
  stock INTEGER,
  unit TEXT,
  tax_rate REAL,
  variants JSON,
  is_active INTEGER DEFAULT 1,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE (sku)
);
 


 CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  customer_name TEXT,
  date TEXT,
  type TEXT,
  items JSON,
  subtotal REAL,
  tax REAL,
  discount REAL,
  round_off REAL,
  total_cost REAL,
  total REAL,
  status TEXT,
  payments JSON,
  delivery_status TEXT DEFAULT 'pending',
  bill_number INTEGER,
  remarks TEXT,
  bill_discount REAL DEFAULT 0,
  loyalty_points_discount REAL DEFAULT 0,
  additional_charges REAL DEFAULT 0,
  balance REAL DEFAULT 0,
  amount_received REAL DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);


CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  title TEXT,
  amount REAL,
  category TEXT,
  date TEXT,
  payment_method TEXT,
  tags JSON,
  receipt_url TEXT,
  created_at TEXT,
  updated_at TEXT
);
 

 CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  data JSON,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS expense_adjustments (
  id TEXT PRIMARY KEY,
  expense_id TEXT NOT NULL,
  delta_amount REAL,
  reason TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (expense_id) REFERENCES expenses(id)
);
