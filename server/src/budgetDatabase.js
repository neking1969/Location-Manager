const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '../data/budget-app.json');

const COST_CATEGORIES = [
  'Location Fees',
  'Security',
  'Fire Safety',
  'Equipment Rentals',
  'Permits',
  'Police',
  'Catering',
  'Transportation',
  'Parking',
  'Miscellaneous'
];

const PO_STATUSES = ['Draft', 'Submitted', 'Approved', 'Paid', 'Cancelled'];
const INVOICE_STATUSES = ['Pending', 'Approved', 'Paid', 'Overdue', 'Cancelled'];
const CHECK_STATUSES = ['Requested', 'Approved', 'Issued', 'Cleared', 'Voided'];
const BUDGET_STATUSES = ['Draft', 'Active', 'Locked', 'Closed'];
const LOCATION_STATUSES = ['Scouting', 'Confirmed', 'Active', 'Wrapped', 'Cancelled'];

let db = {
  budgets: [],
  budgetLineItems: [],
  locations: [],
  purchaseOrders: [],
  invoices: [],
  checkRequests: []
};

function loadBudgetDatabase() {
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(dbPath)) {
    try {
      const data = fs.readFileSync(dbPath, 'utf8');
      db = JSON.parse(data);
      return;
    } catch (error) {
      console.error('Error loading budget database:', error);
    }
  }

  // Seed with sample data if no database exists
  seedDatabase();
}

function saveBudgetDatabase() {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  } catch (error) {
    console.error('Error saving budget database:', error);
  }
}

function seedDatabase() {
  // Create budgets (by episode)
  const budgets = [
    { id: uuidv4(), name: 'Episode 101 - Pilot', episodeNumber: '101', totalBudget: 185000, status: 'Active', notes: 'Pilot episode - expanded budget' },
    { id: uuidv4(), name: 'Episode 102 - The Fracture', episodeNumber: '102', totalBudget: 145000, status: 'Active', notes: '' },
    { id: uuidv4(), name: 'Episode 103 - Resonance', episodeNumber: '103', totalBudget: 140000, status: 'Active', notes: '' },
    { id: uuidv4(), name: 'Episode 104 - Deep Echoes', episodeNumber: '104', totalBudget: 138000, status: 'Draft', notes: 'Pending location confirmations' },
    { id: uuidv4(), name: 'Episode 105 - Convergence', episodeNumber: '105', totalBudget: 152000, status: 'Draft', notes: 'Multiple night shoots' },
    { id: uuidv4(), name: 'Backlot', episodeNumber: 'BL', totalBudget: 95000, status: 'Active', notes: 'Standing sets' },
    { id: uuidv4(), name: 'Amortization', episodeNumber: 'AMORT', totalBudget: 75000, status: 'Active', notes: 'Shared costs across episodes' },
  ];
  budgets.forEach(b => {
    b.created_at = new Date().toISOString();
    b.updated_at = new Date().toISOString();
  });

  // Create locations
  const locations = [
    { id: uuidv4(), name: 'Griffith Observatory', address: '2800 E Observatory Rd, Los Angeles, CA 90027', type: 'Exterior', status: 'Confirmed', contactName: 'Park Services', contactPhone: '(323) 555-0101', notes: 'Night shoot permit required', dailyRate: 8500 },
    { id: uuidv4(), name: 'Union Station', address: '800 N Alameda St, Los Angeles, CA 90012', type: 'Interior/Exterior', status: 'Active', contactName: 'Metro Film Office', contactPhone: '(213) 555-0202', notes: 'After hours access only', dailyRate: 12000 },
    { id: uuidv4(), name: 'Venice Beach Boardwalk', address: 'Ocean Front Walk, Venice, CA 90291', type: 'Exterior', status: 'Confirmed', contactName: 'LA Parks Dept', contactPhone: '(310) 555-0303', notes: 'Dawn shoots preferred', dailyRate: 5000 },
    { id: uuidv4(), name: 'Bradbury Building', address: '304 S Broadway, Los Angeles, CA 90013', type: 'Interior', status: 'Active', contactName: 'Building Management', contactPhone: '(213) 555-0404', notes: 'Historic landmark - limited crew size', dailyRate: 15000 },
    { id: uuidv4(), name: 'Angels Flight Railway', address: '350 S Grand Ave, Los Angeles, CA 90071', type: 'Exterior', status: 'Scouting', contactName: 'Angels Flight Foundation', contactPhone: '(213) 555-0505', notes: 'Operational hours restrict filming', dailyRate: 6000 },
    { id: uuidv4(), name: 'Bronson Caves', address: 'Bronson Canyon, Griffith Park, CA 90068', type: 'Exterior', status: 'Confirmed', contactName: 'Film LA', contactPhone: '(323) 555-0606', notes: 'Popular location - book early', dailyRate: 3500 },
    { id: uuidv4(), name: 'The Last Bookstore', address: '453 S Spring St, Los Angeles, CA 90013', type: 'Interior', status: 'Active', contactName: 'Store Manager', contactPhone: '(213) 555-0707', notes: 'Available Mondays only', dailyRate: 7500 },
    { id: uuidv4(), name: '6th Street Bridge', address: '6th Street Viaduct, Los Angeles, CA 90023', type: 'Exterior', status: 'Confirmed', contactName: 'City Film Permits', contactPhone: '(213) 555-0808', notes: 'Lane closures required', dailyRate: 4500 },
    { id: uuidv4(), name: 'Vasquez Rocks', address: '10700 Escondido Canyon Rd, Agua Dulce, CA 91390', type: 'Exterior', status: 'Scouting', contactName: 'LA County Parks', contactPhone: '(661) 555-0909', notes: 'Remote location - base camp needed', dailyRate: 2500 },
    { id: uuidv4(), name: 'Paramount Studios - Stage 5', address: '5555 Melrose Ave, Los Angeles, CA 90038', type: 'Stage', status: 'Active', contactName: 'Studio Operations', contactPhone: '(323) 555-1010', notes: 'Standing set - main apartment', dailyRate: 18000 },
    { id: uuidv4(), name: 'LA River - Sepulveda Basin', address: 'Sepulveda Basin, Encino, CA 91316', type: 'Exterior', status: 'Confirmed', contactName: 'Army Corps of Engineers', contactPhone: '(818) 555-1111', notes: 'Water level dependent', dailyRate: 3000 },
    { id: uuidv4(), name: 'Millennium Biltmore Hotel', address: '506 S Grand Ave, Los Angeles, CA 90071', type: 'Interior', status: 'Active', contactName: 'Events Director', contactPhone: '(213) 555-1212', notes: 'Lobby and ballroom access', dailyRate: 20000 },
  ];
  locations.forEach(l => {
    l.created_at = new Date().toISOString();
    l.updated_at = new Date().toISOString();
  });

  // Create budget line items (linking budgets to locations with category breakdowns)
  const lineItems = [];
  const addLineItem = (budgetId, locationName, category, amount, description) => {
    lineItems.push({
      id: uuidv4(),
      budgetId,
      locationName,
      category,
      amount,
      description,
      notes: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  };

  // Ep 101 line items
  addLineItem(budgets[0].id, 'Griffith Observatory', 'Location Fees', 17000, '2 day shoot');
  addLineItem(budgets[0].id, 'Griffith Observatory', 'Security', 4800, 'Overnight security');
  addLineItem(budgets[0].id, 'Griffith Observatory', 'Permits', 2500, 'FilmLA night permit');
  addLineItem(budgets[0].id, 'Griffith Observatory', 'Police', 3200, 'Traffic control');
  addLineItem(budgets[0].id, 'Union Station', 'Location Fees', 24000, '2 day interior/exterior');
  addLineItem(budgets[0].id, 'Union Station', 'Security', 6000, 'Metro security supplement');
  addLineItem(budgets[0].id, 'Union Station', 'Fire Safety', 2800, 'Fire watch - interior');
  addLineItem(budgets[0].id, 'Union Station', 'Permits', 3500, 'Metro filming permit');
  addLineItem(budgets[0].id, 'Bradbury Building', 'Location Fees', 30000, '2 day interior');
  addLineItem(budgets[0].id, 'Bradbury Building', 'Security', 4500, 'Building security');
  addLineItem(budgets[0].id, 'Bradbury Building', 'Fire Safety', 3500, 'Fire marshal required');
  addLineItem(budgets[0].id, 'Bradbury Building', 'Equipment Rentals', 8500, 'Lighting rig');
  addLineItem(budgets[0].id, 'Paramount Studios - Stage 5', 'Location Fees', 36000, '2 day stage');
  addLineItem(budgets[0].id, 'Paramount Studios - Stage 5', 'Equipment Rentals', 12000, 'Set construction');
  addLineItem(budgets[0].id, 'Catering', 'Catering', 15000, 'Full crew catering - 4 days');
  addLineItem(budgets[0].id, 'Transportation', 'Transportation', 9500, 'Crew shuttles + equipment trucks');
  addLineItem(budgets[0].id, 'Miscellaneous', 'Miscellaneous', 3200, 'Contingency');

  // Ep 102 line items
  addLineItem(budgets[1].id, 'Venice Beach Boardwalk', 'Location Fees', 10000, '2 day exterior');
  addLineItem(budgets[1].id, 'Venice Beach Boardwalk', 'Security', 5500, 'Crowd control');
  addLineItem(budgets[1].id, 'Venice Beach Boardwalk', 'Permits', 3000, 'Beach filming permit');
  addLineItem(budgets[1].id, 'Venice Beach Boardwalk', 'Police', 4200, '2 officers x 2 days');
  addLineItem(budgets[1].id, '6th Street Bridge', 'Location Fees', 9000, '2 day exterior');
  addLineItem(budgets[1].id, '6th Street Bridge', 'Permits', 4500, 'Lane closure permit');
  addLineItem(budgets[1].id, '6th Street Bridge', 'Police', 6800, 'Traffic control team');
  addLineItem(budgets[1].id, 'The Last Bookstore', 'Location Fees', 15000, '2 day interior');
  addLineItem(budgets[1].id, 'The Last Bookstore', 'Security', 3000, 'Store security');
  addLineItem(budgets[1].id, 'The Last Bookstore', 'Equipment Rentals', 5500, 'Lighting package');
  addLineItem(budgets[1].id, 'Paramount Studios - Stage 5', 'Location Fees', 36000, '2 day stage');
  addLineItem(budgets[1].id, 'Paramount Studios - Stage 5', 'Equipment Rentals', 10000, 'Set modifications');
  addLineItem(budgets[1].id, 'Catering', 'Catering', 13000, 'Full crew - 4 days');
  addLineItem(budgets[1].id, 'Transportation', 'Transportation', 8500, 'Standard transport');
  addLineItem(budgets[1].id, 'Parking', 'Parking', 6500, 'Venice + DTLA parking');
  addLineItem(budgets[1].id, 'Miscellaneous', 'Miscellaneous', 10500, 'Weather contingency');

  // Ep 103 line items
  addLineItem(budgets[2].id, 'Bronson Caves', 'Location Fees', 7000, '2 day exterior');
  addLineItem(budgets[2].id, 'Bronson Caves', 'Security', 2500, 'Park security');
  addLineItem(budgets[2].id, 'Bronson Caves', 'Permits', 1800, 'Park filming permit');
  addLineItem(budgets[2].id, 'LA River - Sepulveda Basin', 'Location Fees', 6000, '2 day exterior');
  addLineItem(budgets[2].id, 'LA River - Sepulveda Basin', 'Security', 3500, 'River basin security');
  addLineItem(budgets[2].id, 'LA River - Sepulveda Basin', 'Permits', 4000, 'Army Corps permit');
  addLineItem(budgets[2].id, 'LA River - Sepulveda Basin', 'Fire Safety', 2000, 'Pyrotechnics supervision');
  addLineItem(budgets[2].id, 'Millennium Biltmore Hotel', 'Location Fees', 40000, '2 day interior');
  addLineItem(budgets[2].id, 'Millennium Biltmore Hotel', 'Security', 5000, 'Hotel security');
  addLineItem(budgets[2].id, 'Millennium Biltmore Hotel', 'Fire Safety', 3000, 'Fire watch');
  addLineItem(budgets[2].id, 'Paramount Studios - Stage 5', 'Location Fees', 36000, '2 day stage');
  addLineItem(budgets[2].id, 'Catering', 'Catering', 12500, 'Full crew - 4 days');
  addLineItem(budgets[2].id, 'Transportation', 'Transportation', 8200, 'Standard transport');
  addLineItem(budgets[2].id, 'Miscellaneous', 'Miscellaneous', 8500, 'Contingency');

  // Backlot items
  addLineItem(budgets[5].id, 'Paramount Studios - Stage 5', 'Location Fees', 54000, '3 day standing set');
  addLineItem(budgets[5].id, 'Paramount Studios - Stage 5', 'Equipment Rentals', 18000, 'Set maintenance + builds');
  addLineItem(budgets[5].id, 'Paramount Studios - Stage 5', 'Security', 7500, 'Studio lot security');
  addLineItem(budgets[5].id, 'Parking', 'Parking', 8000, 'Studio parking passes');
  addLineItem(budgets[5].id, 'Miscellaneous', 'Miscellaneous', 7500, 'Backlot contingency');

  // Amort items
  addLineItem(budgets[6].id, 'Transportation', 'Transportation', 25000, 'Season transport package');
  addLineItem(budgets[6].id, 'Equipment Rentals', 'Equipment Rentals', 22000, 'Season equipment package');
  addLineItem(budgets[6].id, 'Permits', 'Permits', 15000, 'Season master permits');
  addLineItem(budgets[6].id, 'Miscellaneous', 'Miscellaneous', 13000, 'Season contingency');

  // Create purchase orders
  const purchaseOrders = [
    { id: uuidv4(), locationName: 'Griffith Observatory', poNumber: 'PO-2026-001', vendor: 'Griffith Observatory Foundation', description: 'Location fee - 2 days filming', amount: 17000, date: '2026-02-01', status: 'Approved', category: 'Location Fees' },
    { id: uuidv4(), locationName: 'Griffith Observatory', poNumber: 'PO-2026-002', vendor: 'SecureSet Inc.', description: 'Overnight security detail', amount: 5200, date: '2026-02-01', status: 'Paid', category: 'Security' },
    { id: uuidv4(), locationName: 'Union Station', poNumber: 'PO-2026-003', vendor: 'Metro Filming Services', description: 'Station access fee - 2 days', amount: 24000, date: '2026-02-03', status: 'Approved', category: 'Location Fees' },
    { id: uuidv4(), locationName: 'Union Station', poNumber: 'PO-2026-004', vendor: 'Metro Security Division', description: 'Security supplement - 2 days', amount: 6500, date: '2026-02-03', status: 'Submitted', category: 'Security' },
    { id: uuidv4(), locationName: 'Bradbury Building', poNumber: 'PO-2026-005', vendor: 'Bradbury Building LLC', description: 'Interior filming fee', amount: 30000, date: '2026-02-05', status: 'Paid', category: 'Location Fees' },
    { id: uuidv4(), locationName: 'Bradbury Building', poNumber: 'PO-2026-006', vendor: 'LAFD Film Unit', description: 'Fire marshal on set', amount: 3800, date: '2026-02-05', status: 'Approved', category: 'Fire Safety' },
    { id: uuidv4(), locationName: 'Paramount Studios - Stage 5', poNumber: 'PO-2026-007', vendor: 'Paramount Pictures Corp.', description: 'Stage rental - Ep 101', amount: 36000, date: '2026-01-28', status: 'Paid', category: 'Location Fees' },
    { id: uuidv4(), locationName: 'Paramount Studios - Stage 5', poNumber: 'PO-2026-008', vendor: 'Set Builders Local 44', description: 'Set construction - main apartment', amount: 14500, date: '2026-01-25', status: 'Paid', category: 'Equipment Rentals' },
    { id: uuidv4(), locationName: 'Venice Beach Boardwalk', poNumber: 'PO-2026-009', vendor: 'LA Parks & Recreation', description: 'Beach filming permit + fees', amount: 10000, date: '2026-02-08', status: 'Approved', category: 'Location Fees' },
    { id: uuidv4(), locationName: 'Venice Beach Boardwalk', poNumber: 'PO-2026-010', vendor: 'Pacific Security Group', description: 'Crowd control - 2 days', amount: 6200, date: '2026-02-08', status: 'Submitted', category: 'Security' },
    { id: uuidv4(), locationName: 'The Last Bookstore', poNumber: 'PO-2026-011', vendor: 'The Last Bookstore LLC', description: 'Interior filming - 2 Mondays', amount: 15000, date: '2026-02-10', status: 'Approved', category: 'Location Fees' },
    { id: uuidv4(), locationName: '6th Street Bridge', poNumber: 'PO-2026-012', vendor: 'City of LA DOT', description: 'Lane closure + filming permit', amount: 14200, date: '2026-02-10', status: 'Draft', category: 'Permits' },
    { id: uuidv4(), locationName: 'Catering', poNumber: 'PO-2026-013', vendor: 'Craft Services Plus', description: 'Crew catering - Ep 101 (4 days)', amount: 15800, date: '2026-01-28', status: 'Paid', category: 'Catering' },
    { id: uuidv4(), locationName: 'Transportation', poNumber: 'PO-2026-014', vendor: 'Studio Transportation Inc.', description: 'Crew shuttles + trucks - Ep 101', amount: 9800, date: '2026-01-28', status: 'Paid', category: 'Transportation' },
    { id: uuidv4(), locationName: 'Bronson Caves', poNumber: 'PO-2026-015', vendor: 'LA County Parks', description: 'Filming access - 2 days', amount: 7000, date: '2026-02-15', status: 'Draft', category: 'Location Fees' },
    { id: uuidv4(), locationName: 'Millennium Biltmore Hotel', poNumber: 'PO-2026-016', vendor: 'Millennium Biltmore Hotel', description: 'Lobby + ballroom - 2 days', amount: 42000, date: '2026-02-15', status: 'Submitted', category: 'Location Fees' },
  ];
  purchaseOrders.forEach(po => {
    po.notes = '';
    po.created_at = new Date().toISOString();
    po.updated_at = new Date().toISOString();
  });

  // Create invoices
  const invoices = [
    { id: uuidv4(), locationName: 'Griffith Observatory', invoiceNumber: 'INV-GOF-2026-001', vendor: 'Griffith Observatory Foundation', description: 'Location fee balance', amount: 17000, date: '2026-02-10', dueDate: '2026-03-10', status: 'Paid', category: 'Location Fees' },
    { id: uuidv4(), locationName: 'Griffith Observatory', invoiceNumber: 'INV-SSI-2026-001', vendor: 'SecureSet Inc.', description: 'Security services rendered', amount: 5200, date: '2026-02-10', dueDate: '2026-03-10', status: 'Paid', category: 'Security' },
    { id: uuidv4(), locationName: 'Union Station', invoiceNumber: 'INV-MFS-2026-001', vendor: 'Metro Filming Services', description: 'Station access - final invoice', amount: 24000, date: '2026-02-12', dueDate: '2026-03-12', status: 'Pending', category: 'Location Fees' },
    { id: uuidv4(), locationName: 'Bradbury Building', invoiceNumber: 'INV-BBL-2026-001', vendor: 'Bradbury Building LLC', description: 'Interior filming - final', amount: 30000, date: '2026-02-12', dueDate: '2026-03-12', status: 'Paid', category: 'Location Fees' },
    { id: uuidv4(), locationName: 'Bradbury Building', invoiceNumber: 'INV-LAFD-2026-001', vendor: 'LAFD Film Unit', description: 'Fire marshal services', amount: 3800, date: '2026-02-12', dueDate: '2026-03-12', status: 'Approved', category: 'Fire Safety' },
    { id: uuidv4(), locationName: 'Paramount Studios - Stage 5', invoiceNumber: 'INV-PPC-2026-001', vendor: 'Paramount Pictures Corp.', description: 'Stage rental - Ep 101', amount: 36000, date: '2026-02-05', dueDate: '2026-03-05', status: 'Paid', category: 'Location Fees' },
    { id: uuidv4(), locationName: 'Paramount Studios - Stage 5', invoiceNumber: 'INV-SBL-2026-001', vendor: 'Set Builders Local 44', description: 'Set construction', amount: 14500, date: '2026-02-05', dueDate: '2026-03-05', status: 'Paid', category: 'Equipment Rentals' },
    { id: uuidv4(), locationName: 'Catering', invoiceNumber: 'INV-CSP-2026-001', vendor: 'Craft Services Plus', description: 'Ep 101 catering - 4 days', amount: 15800, date: '2026-02-08', dueDate: '2026-03-08', status: 'Paid', category: 'Catering' },
    { id: uuidv4(), locationName: 'Transportation', invoiceNumber: 'INV-STI-2026-001', vendor: 'Studio Transportation Inc.', description: 'Ep 101 transport services', amount: 9800, date: '2026-02-08', dueDate: '2026-03-08', status: 'Paid', category: 'Transportation' },
    { id: uuidv4(), locationName: 'FilmLA', invoiceNumber: 'INV-FLA-2026-001', vendor: 'FilmLA Inc.', description: 'Master filming permits - Q1', amount: 8500, date: '2026-01-15', dueDate: '2026-02-15', status: 'Overdue', category: 'Permits' },
  ];
  invoices.forEach(inv => {
    inv.notes = '';
    inv.created_at = new Date().toISOString();
    inv.updated_at = new Date().toISOString();
  });

  // Create check requests
  const checkRequests = [
    { id: uuidv4(), locationName: 'Griffith Observatory', checkNumber: 'CHK-001', payee: 'LAPD Film Unit', description: 'Traffic control - observatory shoot', amount: 3200, date: '2026-02-01', status: 'Cleared', category: 'Police' },
    { id: uuidv4(), locationName: 'Venice Beach Boardwalk', checkNumber: 'CHK-002', payee: 'LAPD Venice Division', description: 'Officer detail - beach shoot', amount: 4200, date: '2026-02-08', status: 'Issued', category: 'Police' },
    { id: uuidv4(), locationName: '6th Street Bridge', checkNumber: 'CHK-003', payee: 'LAPD Central Division', description: 'Traffic control - bridge shoot', amount: 6800, date: '2026-02-10', status: 'Requested', category: 'Police' },
    { id: uuidv4(), locationName: 'Paramount Studios - Stage 5', checkNumber: 'CHK-004', payee: 'Petty Cash - Stage 5', description: 'Misc supplies and expendables', amount: 2500, date: '2026-01-30', status: 'Cleared', category: 'Miscellaneous' },
    { id: uuidv4(), locationName: 'Union Station', checkNumber: 'CHK-005', payee: 'LAFD Film Unit', description: 'Fire watch - station interior', amount: 2800, date: '2026-02-03', status: 'Issued', category: 'Fire Safety' },
    { id: uuidv4(), locationName: 'Parking', checkNumber: 'CHK-006', payee: 'LA DOT Parking', description: 'Crew parking permits - DTLA', amount: 3500, date: '2026-02-01', status: 'Cleared', category: 'Parking' },
  ];
  checkRequests.forEach(cr => {
    cr.notes = '';
    cr.created_at = new Date().toISOString();
    cr.updated_at = new Date().toISOString();
  });

  db = {
    budgets,
    budgetLineItems: lineItems,
    locations,
    purchaseOrders,
    invoices,
    checkRequests
  };

  saveBudgetDatabase();
  console.log('Budget database seeded with sample data');
}

function getBudgetDatabase() {
  return db;
}

function initBudgetDatabase() {
  loadBudgetDatabase();
  console.log(`Budget database initialized: ${db.budgets.length} budgets, ${db.locations.length} locations, ${db.purchaseOrders.length} POs`);
}

// Generic CRUD helpers
function budgetFindById(collection, id) {
  return db[collection]?.find(item => item.id === id) || null;
}

function budgetFindAll(collection, filter = {}) {
  let results = db[collection] || [];
  for (const [key, value] of Object.entries(filter)) {
    results = results.filter(item => item[key] === value);
  }
  return results;
}

function budgetInsert(collection, item) {
  item.id = item.id || uuidv4();
  item.created_at = new Date().toISOString();
  item.updated_at = new Date().toISOString();
  db[collection].push(item);
  saveBudgetDatabase();
  return item;
}

function budgetUpdate(collection, id, updates) {
  const index = db[collection].findIndex(item => item.id === id);
  if (index !== -1) {
    db[collection][index] = { ...db[collection][index], ...updates, updated_at: new Date().toISOString() };
    saveBudgetDatabase();
    return db[collection][index];
  }
  return null;
}

function budgetRemove(collection, id) {
  const index = db[collection].findIndex(item => item.id === id);
  if (index !== -1) {
    db[collection].splice(index, 1);
    saveBudgetDatabase();
    return true;
  }
  return false;
}

module.exports = {
  getBudgetDatabase,
  initBudgetDatabase,
  budgetFindById,
  budgetFindAll,
  budgetInsert,
  budgetUpdate,
  budgetRemove,
  saveBudgetDatabase,
  COST_CATEGORIES,
  PO_STATUSES,
  INVOICE_STATUSES,
  CHECK_STATUSES,
  BUDGET_STATUSES,
  LOCATION_STATUSES
};
