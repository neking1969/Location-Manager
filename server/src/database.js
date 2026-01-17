const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/cost_tracker.db');
let db;

// Location Manager specific cost categories
const COST_CATEGORIES = [
  'Location Fees',
  'Permits & Licenses',
  'Security',
  'Parking',
  'Site Preparation',
  'Site Restoration',
  'Catering/Craft Services',
  'Crew Accommodations',
  'Transportation',
  'Equipment Rentals',
  'Insurance',
  'Utilities',
  'Communication',
  'Office Supplies',
  'Petty Cash',
  'Miscellaneous'
];

function getDatabase() {
  if (!db) {
    const fs = require('fs');
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

function initializeDatabase() {
  const db = getDatabase();

  // Projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      production_company TEXT,
      start_date TEXT,
      end_date TEXT,
      total_budget REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Cost categories table
  db.exec(`
    CREATE TABLE IF NOT EXISTS cost_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      sort_order INTEGER DEFAULT 0
    )
  `);

  // Budget items table - planned costs
  db.exec(`
    CREATE TABLE IF NOT EXISTS budget_items (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      budgeted_amount REAL NOT NULL DEFAULT 0,
      episode TEXT,
      location_name TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Ledger entries table - actual costs
  db.exec(`
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL DEFAULT 0,
      vendor TEXT,
      invoice_number TEXT,
      date TEXT,
      episode TEXT,
      location_name TEXT,
      payment_status TEXT DEFAULT 'pending',
      po_number TEXT,
      notes TEXT,
      source_file TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Uploaded files tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS uploaded_files (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER,
      parsed_data TEXT,
      upload_type TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Seed default categories
  const insertCategory = db.prepare(`
    INSERT OR IGNORE INTO cost_categories (name, sort_order) VALUES (?, ?)
  `);

  COST_CATEGORIES.forEach((cat, index) => {
    insertCategory.run(cat, index);
  });

  console.log('Database initialized successfully');
}

module.exports = {
  getDatabase,
  initializeDatabase,
  COST_CATEGORIES
};
