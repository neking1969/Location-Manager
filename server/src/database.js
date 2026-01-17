const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/database.json');

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

// In-memory database
let db = {
  projects: [],
  episodes: [],
  sets: [],
  cost_entries: [],
  uploaded_files: []
};

function loadDatabase() {
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(dbPath)) {
    try {
      const data = fs.readFileSync(dbPath, 'utf8');
      db = JSON.parse(data);
    } catch (error) {
      console.error('Error loading database:', error);
    }
  }
}

function saveDatabase() {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  } catch (error) {
    console.error('Error saving database:', error);
  }
}

function getDatabase() {
  return db;
}

function initializeDatabase() {
  loadDatabase();
  console.log('Database initialized successfully');
}

// Helper functions for CRUD operations
function findById(collection, id) {
  return db[collection].find(item => item.id === id);
}

function findAll(collection, filter = {}) {
  let results = db[collection];
  for (const [key, value] of Object.entries(filter)) {
    results = results.filter(item => item[key] === value);
  }
  return results;
}

function insert(collection, item) {
  item.created_at = new Date().toISOString();
  item.updated_at = new Date().toISOString();
  db[collection].push(item);
  saveDatabase();
  return item;
}

function update(collection, id, updates) {
  const index = db[collection].findIndex(item => item.id === id);
  if (index !== -1) {
    db[collection][index] = { ...db[collection][index], ...updates, updated_at: new Date().toISOString() };
    saveDatabase();
    return db[collection][index];
  }
  return null;
}

function remove(collection, id) {
  const index = db[collection].findIndex(item => item.id === id);
  if (index !== -1) {
    db[collection].splice(index, 1);
    saveDatabase();
    return true;
  }
  return false;
}

function removeWhere(collection, filter) {
  const before = db[collection].length;
  db[collection] = db[collection].filter(item => {
    for (const [key, value] of Object.entries(filter)) {
      if (item[key] === value) return false;
    }
    return true;
  });
  saveDatabase();
  return before - db[collection].length;
}

module.exports = {
  getDatabase,
  initializeDatabase,
  findById,
  findAll,
  insert,
  update,
  remove,
  removeWhere,
  saveDatabase,
  COST_CATEGORIES,
  DEFAULT_GROUPS
};
