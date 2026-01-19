/**
 * Test setup - creates in-memory database for testing
 * No file system operations needed
 */

const db = require('../src/database');

// Reset database to clean state before each test
function resetDatabase() {
  const database = db.getDatabase();
  database.projects = [];
  database.episodes = [];
  database.sets = [];
  database.cost_entries = [];
  database.uploaded_files = [];
}

// Create test data helpers
function createTestProject(overrides = {}) {
  return db.insert('projects', {
    id: overrides.id || `test-project-${Date.now()}`,
    name: overrides.name || 'Test Production',
    description: overrides.description || 'A test production',
    total_budget: overrides.total_budget || 100000,
    ...overrides
  });
}

function createTestEpisode(projectId, overrides = {}) {
  return db.insert('episodes', {
    id: overrides.id || `test-episode-${Date.now()}`,
    project_id: projectId,
    name: overrides.name || 'Episode 101',
    sort_order: overrides.sort_order || 1,
    ...overrides
  });
}

function createTestSet(projectId, episodeId, overrides = {}) {
  return db.insert('sets', {
    id: overrides.id || `test-set-${Date.now()}`,
    project_id: projectId,
    episode_id: episodeId,
    set_name: overrides.set_name || 'Test Location',
    location: overrides.location || '123 Main St',
    budget_loc_fees: overrides.budget_loc_fees || 5000,
    budget_security: overrides.budget_security || 2000,
    budget_fire: overrides.budget_fire || 1500,
    budget_rentals: overrides.budget_rentals || 1000,
    budget_permits: overrides.budget_permits || 500,
    budget_police: overrides.budget_police || 1000,
    ...overrides
  });
}

function createTestCostEntry(setId, overrides = {}) {
  return db.insert('cost_entries', {
    id: overrides.id || `test-cost-${Date.now()}-${Math.random()}`,
    set_id: setId,
    category: overrides.category || 'Loc Fees',
    description: overrides.description || 'Test expense',
    amount: overrides.amount || 100,
    vendor: overrides.vendor || 'Test Vendor',
    invoice_number: overrides.invoice_number || 'INV-001',
    date: overrides.date || '2024-01-15',
    payment_status: overrides.payment_status || 'pending',
    ...overrides
  });
}

module.exports = {
  resetDatabase,
  createTestProject,
  createTestEpisode,
  createTestSet,
  createTestCostEntry,
  COST_CATEGORIES: db.COST_CATEGORIES
};
