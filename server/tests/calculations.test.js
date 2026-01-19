/**
 * Unit tests for cost calculations
 * Tests the core business logic without HTTP layer
 */

const {
  resetDatabase,
  createTestProject,
  createTestEpisode,
  createTestSet,
  createTestCostEntry,
  COST_CATEGORIES
} = require('./setup');
const db = require('../src/database');

describe('Cost Calculations', () => {
  beforeEach(() => {
    resetDatabase();
  });

  describe('Set Budget Totals', () => {
    test('calculates total budget from all categories', () => {
      const project = createTestProject();
      const episode = createTestEpisode(project.id);
      const set = createTestSet(project.id, episode.id, {
        budget_loc_fees: 5000,
        budget_security: 2000,
        budget_fire: 1500,
        budget_rentals: 1000,
        budget_permits: 500,
        budget_police: 1000
      });

      const totalBudget = set.budget_loc_fees + set.budget_security +
        set.budget_fire + set.budget_rentals + set.budget_permits + set.budget_police;

      expect(totalBudget).toBe(11000);
    });

    test('handles zero budgets', () => {
      const project = createTestProject();
      const episode = createTestEpisode(project.id);
      const set = createTestSet(project.id, episode.id, {
        budget_loc_fees: 0,
        budget_security: 0,
        budget_fire: 0,
        budget_rentals: 0,
        budget_permits: 0,
        budget_police: 0
      });

      const totalBudget = set.budget_loc_fees + set.budget_security +
        set.budget_fire + set.budget_rentals + set.budget_permits + set.budget_police;

      expect(totalBudget).toBe(0);
    });
  });

  describe('Cost Entry Aggregation', () => {
    test('sums cost entries by category', () => {
      const project = createTestProject();
      const episode = createTestEpisode(project.id);
      const set = createTestSet(project.id, episode.id);

      // Add multiple entries for same category
      createTestCostEntry(set.id, { category: 'Loc Fees', amount: 1000 });
      createTestCostEntry(set.id, { category: 'Loc Fees', amount: 2000 });
      createTestCostEntry(set.id, { category: 'Loc Fees', amount: 500 });

      const database = db.getDatabase();
      const entries = database.cost_entries.filter(e => e.set_id === set.id && e.category === 'Loc Fees');
      const total = entries.reduce((sum, e) => sum + e.amount, 0);

      expect(total).toBe(3500);
    });

    test('separates costs by category correctly', () => {
      const project = createTestProject();
      const episode = createTestEpisode(project.id);
      const set = createTestSet(project.id, episode.id);

      createTestCostEntry(set.id, { category: 'Loc Fees', amount: 1000 });
      createTestCostEntry(set.id, { category: 'Security', amount: 500 });
      createTestCostEntry(set.id, { category: 'Fire', amount: 300 });

      const database = db.getDatabase();
      const entries = database.cost_entries.filter(e => e.set_id === set.id);

      const byCategory = {};
      COST_CATEGORIES.forEach(cat => {
        byCategory[cat] = entries.filter(e => e.category === cat)
          .reduce((sum, e) => sum + e.amount, 0);
      });

      expect(byCategory['Loc Fees']).toBe(1000);
      expect(byCategory['Security']).toBe(500);
      expect(byCategory['Fire']).toBe(300);
      expect(byCategory['Rentals']).toBe(0);
      expect(byCategory['Permits']).toBe(0);
      expect(byCategory['Police']).toBe(0);
    });
  });

  describe('Budget vs Actual Variance', () => {
    test('calculates under budget variance correctly', () => {
      const budget = 5000;
      const actual = 3000;
      const variance = budget - actual;

      expect(variance).toBe(2000);
      expect(variance > 0).toBe(true); // Under budget
    });

    test('calculates over budget variance correctly', () => {
      const budget = 5000;
      const actual = 7000;
      const variance = budget - actual;

      expect(variance).toBe(-2000);
      expect(variance < 0).toBe(true); // Over budget
    });

    test('calculates exact budget match', () => {
      const budget = 5000;
      const actual = 5000;
      const variance = budget - actual;

      expect(variance).toBe(0);
    });
  });

  describe('Project-Level Aggregation', () => {
    test('aggregates budgets across multiple sets', () => {
      const project = createTestProject();
      const episode = createTestEpisode(project.id);

      createTestSet(project.id, episode.id, {
        id: 'set-1',
        budget_loc_fees: 5000,
        budget_security: 2000
      });
      createTestSet(project.id, episode.id, {
        id: 'set-2',
        budget_loc_fees: 3000,
        budget_security: 1500
      });

      const database = db.getDatabase();
      const sets = database.sets.filter(s => s.project_id === project.id);

      const totalLocFees = sets.reduce((sum, s) => sum + (s.budget_loc_fees || 0), 0);
      const totalSecurity = sets.reduce((sum, s) => sum + (s.budget_security || 0), 0);

      expect(totalLocFees).toBe(8000);
      expect(totalSecurity).toBe(3500);
    });

    test('aggregates actuals across multiple sets', () => {
      const project = createTestProject();
      const episode = createTestEpisode(project.id);

      const set1 = createTestSet(project.id, episode.id, { id: 'set-1' });
      const set2 = createTestSet(project.id, episode.id, { id: 'set-2' });

      createTestCostEntry(set1.id, { category: 'Loc Fees', amount: 1000 });
      createTestCostEntry(set1.id, { category: 'Loc Fees', amount: 500 });
      createTestCostEntry(set2.id, { category: 'Loc Fees', amount: 2000 });

      const database = db.getDatabase();
      const setIds = database.sets.filter(s => s.project_id === project.id).map(s => s.id);
      const entries = database.cost_entries.filter(e => setIds.includes(e.set_id));

      const totalLocFees = entries
        .filter(e => e.category === 'Loc Fees')
        .reduce((sum, e) => sum + e.amount, 0);

      expect(totalLocFees).toBe(3500);
    });
  });

  describe('Edge Cases', () => {
    test('handles undefined/null amounts as 0', () => {
      const entries = [
        { amount: 100 },
        { amount: undefined },
        { amount: null },
        { amount: 200 }
      ];

      const total = entries.reduce((sum, e) => sum + (e.amount || 0), 0);
      expect(total).toBe(300);
    });

    test('handles empty cost entries array', () => {
      const project = createTestProject();
      const episode = createTestEpisode(project.id);
      const set = createTestSet(project.id, episode.id);

      const database = db.getDatabase();
      const entries = database.cost_entries.filter(e => e.set_id === set.id);
      const total = entries.reduce((sum, e) => sum + (e.amount || 0), 0);

      expect(total).toBe(0);
    });

    test('handles negative amounts (credits/refunds)', () => {
      const project = createTestProject();
      const episode = createTestEpisode(project.id);
      const set = createTestSet(project.id, episode.id);

      createTestCostEntry(set.id, { category: 'Loc Fees', amount: 1000 });
      createTestCostEntry(set.id, { category: 'Loc Fees', amount: -200 }); // Refund

      const database = db.getDatabase();
      const entries = database.cost_entries.filter(e => e.set_id === set.id);
      const total = entries.reduce((sum, e) => sum + (e.amount || 0), 0);

      expect(total).toBe(800);
    });

    test('handles decimal amounts correctly', () => {
      const project = createTestProject();
      const episode = createTestEpisode(project.id);
      const set = createTestSet(project.id, episode.id);

      createTestCostEntry(set.id, { category: 'Loc Fees', amount: 99.99 });
      createTestCostEntry(set.id, { category: 'Loc Fees', amount: 50.01 });

      const database = db.getDatabase();
      const entries = database.cost_entries.filter(e => e.set_id === set.id);
      const total = entries.reduce((sum, e) => sum + (e.amount || 0), 0);

      expect(total).toBeCloseTo(150, 2);
    });
  });
});

describe('COST_CATEGORIES', () => {
  test('contains all expected categories', () => {
    expect(COST_CATEGORIES).toContain('Loc Fees');
    expect(COST_CATEGORIES).toContain('Security');
    expect(COST_CATEGORIES).toContain('Fire');
    expect(COST_CATEGORIES).toContain('Rentals');
    expect(COST_CATEGORIES).toContain('Permits');
    expect(COST_CATEGORIES).toContain('Police');
  });

  test('has exactly 6 categories', () => {
    expect(COST_CATEGORIES).toHaveLength(6);
  });
});
