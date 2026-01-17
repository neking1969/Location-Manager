const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/cost_tracker.db');
let db;

// Cost categories matching the actual spreadsheet
const COST_CATEGORIES = [
  'Loc Fees',
  'Security',
  'Fire',
  'Rentals',
  'Permits',
  'Police'
];

// Default episode/tab types
const DEFAULT_GROUPS = [
  { name: 'Backlot', type: 'location_group' },
  { name: 'Amort', type: 'amortization' }
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

  // Projects table (productions like "Shards")
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      production_company TEXT,
      start_date TEXT,
      end_date TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Episodes/Groups table (101, 102, Backlot, Amort, etc.)
  db.exec(`
    CREATE TABLE IF NOT EXISTS episodes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      episode_number TEXT,
      type TEXT DEFAULT 'episode',
      sort_order INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Sets table (specific filming locations)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      episode_id TEXT,
      set_name TEXT NOT NULL,
      location TEXT,
      budget_loc_fees REAL DEFAULT 0,
      budget_security REAL DEFAULT 0,
      budget_fire REAL DEFAULT 0,
      budget_rentals REAL DEFAULT 0,
      budget_permits REAL DEFAULT 0,
      budget_police REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE SET NULL
    )
  `);

  // Cost entries table (actual costs for each set)
  db.exec(`
    CREATE TABLE IF NOT EXISTS cost_entries (
      id TEXT PRIMARY KEY,
      set_id TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL DEFAULT 0,
      vendor TEXT,
      invoice_number TEXT,
      po_number TEXT,
      check_number TEXT,
      date TEXT,
      payment_status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (set_id) REFERENCES sets(id) ON DELETE CASCADE
    )
  `);

  // Check requests table
  db.exec(`
    CREATE TABLE IF NOT EXISTS check_requests (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      set_id TEXT,
      payee TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT,
      description TEXT,
      date_needed TEXT,
      date_submitted TEXT,
      status TEXT DEFAULT 'pending',
      check_number TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (set_id) REFERENCES sets(id) ON DELETE SET NULL
    )
  `);

  // Permit tracker table
  db.exec(`
    CREATE TABLE IF NOT EXISTS permits (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      set_id TEXT,
      permit_type TEXT NOT NULL,
      location TEXT,
      jurisdiction TEXT,
      application_date TEXT,
      approval_date TEXT,
      expiration_date TEXT,
      cost REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      permit_number TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (set_id) REFERENCES sets(id) ON DELETE SET NULL
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

  console.log('Database initialized successfully');
}

module.exports = {
  getDatabase,
  initializeDatabase,
  COST_CATEGORIES,
  DEFAULT_GROUPS
};
