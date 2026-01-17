const express = require('express');
const router = express.Router();
const { getDatabase, COST_CATEGORIES } = require('../database');

// Get full comparison report - Budget vs Actual by category
router.get('/comparison/:projectId', (req, res) => {
  try {
    const db = getDatabase();
    const projectId = req.params.projectId;

    // Get budget totals by category from sets
    const budgetTotals = db.prepare(`
      SELECT
        SUM(budget_loc_fees) as budget_loc_fees,
        SUM(budget_security) as budget_security,
        SUM(budget_fire) as budget_fire,
        SUM(budget_rentals) as budget_rentals,
        SUM(budget_permits) as budget_permits,
        SUM(budget_police) as budget_police
      FROM sets WHERE project_id = ?
    `).get(projectId);

    // Get actual totals by category from cost_entries
    const actualTotals = db.prepare(`
      SELECT category, SUM(amount) as actual
      FROM cost_entries ce
      JOIN sets s ON ce.set_id = s.id
      WHERE s.project_id = ?
      GROUP BY category
    `).all(projectId);

    const actualMap = {};
    actualTotals.forEach(item => {
      actualMap[item.category] = item.actual;
    });

    // Map category names to budget column names
    const budgetColumnMap = {
      'Loc Fees': budgetTotals?.budget_loc_fees || 0,
      'Security': budgetTotals?.budget_security || 0,
      'Fire': budgetTotals?.budget_fire || 0,
      'Rentals': budgetTotals?.budget_rentals || 0,
      'Permits': budgetTotals?.budget_permits || 0,
      'Police': budgetTotals?.budget_police || 0
    };

    // Create comparison for all categories
    const comparison = COST_CATEGORIES.map(category => {
      const budgeted = budgetColumnMap[category] || 0;
      const actual = actualMap[category] || 0;
      const variance = budgeted - actual;
      const variancePercent = budgeted > 0 ? ((variance / budgeted) * 100) : (actual > 0 ? -100 : 0);

      return {
        category,
        budgeted,
        actual,
        variance,
        variance_percent: Math.round(variancePercent * 100) / 100,
        status: variance >= 0 ? 'under_budget' : 'over_budget'
      };
    });

    // Calculate totals
    const totals = {
      budgeted: comparison.reduce((sum, c) => sum + c.budgeted, 0),
      actual: comparison.reduce((sum, c) => sum + c.actual, 0)
    };
    totals.variance = totals.budgeted - totals.actual;
    totals.variance_percent = totals.budgeted > 0
      ? Math.round(((totals.variance / totals.budgeted) * 100) * 100) / 100
      : 0;
    totals.status = totals.variance >= 0 ? 'under_budget' : 'over_budget';

    res.json({
      categories: comparison.filter(c => c.budgeted > 0 || c.actual > 0),
      all_categories: comparison,
      totals
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get summary dashboard data
router.get('/dashboard/:projectId', (req, res) => {
  try {
    const db = getDatabase();
    const projectId = req.params.projectId;

    // Project info
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get episodes
    const episodes = db.prepare(`
      SELECT * FROM episodes WHERE project_id = ? ORDER BY sort_order, name
    `).all(projectId);

    // Budget total from sets
    const budgetTotal = db.prepare(`
      SELECT COALESCE(SUM(
        budget_loc_fees + budget_security + budget_fire +
        budget_rentals + budget_permits + budget_police
      ), 0) as total
      FROM sets WHERE project_id = ?
    `).get(projectId);

    // Actual total from cost_entries
    const actualTotal = db.prepare(`
      SELECT COALESCE(SUM(ce.amount), 0) as total
      FROM cost_entries ce
      JOIN sets s ON ce.set_id = s.id
      WHERE s.project_id = ?
    `).get(projectId);

    // Recent entries
    const recentEntries = db.prepare(`
      SELECT ce.*, s.set_name
      FROM cost_entries ce
      JOIN sets s ON ce.set_id = s.id
      WHERE s.project_id = ?
      ORDER BY ce.created_at DESC
      LIMIT 10
    `).all(projectId);

    // Sets over budget
    const setsOverBudget = db.prepare(`
      SELECT
        s.id,
        s.set_name,
        (s.budget_loc_fees + s.budget_security + s.budget_fire +
         s.budget_rentals + s.budget_permits + s.budget_police) as total_budget,
        COALESCE((SELECT SUM(amount) FROM cost_entries WHERE set_id = s.id), 0) as total_actual
      FROM sets s
      WHERE s.project_id = ?
      HAVING total_actual > total_budget AND total_budget > 0
    `).all(projectId);

    // Counts
    const setCount = db.prepare('SELECT COUNT(*) as count FROM sets WHERE project_id = ?')
      .get(projectId);
    const entryCount = db.prepare(`
      SELECT COUNT(*) as count FROM cost_entries ce
      JOIN sets s ON ce.set_id = s.id
      WHERE s.project_id = ?
    `).get(projectId);

    const variance = budgetTotal.total - actualTotal.total;

    res.json({
      project,
      episodes,
      summary: {
        total_budget: budgetTotal.total,
        total_actual: actualTotal.total,
        variance,
        variance_percent: budgetTotal.total > 0
          ? Math.round(((variance / budgetTotal.total) * 100) * 100) / 100
          : 0,
        status: variance >= 0 ? 'under_budget' : 'over_budget',
        set_count: setCount.count,
        entry_count: entryCount.count
      },
      sets_over_budget: setsOverBudget.map(s => ({
        ...s,
        over_by: s.total_actual - s.total_budget,
        over_percent: Math.round(((s.total_actual - s.total_budget) / s.total_budget * 100) * 100) / 100
      })),
      recent_entries: recentEntries
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get spending by set
router.get('/by-set/:projectId', (req, res) => {
  try {
    const db = getDatabase();

    const sets = db.prepare(`
      SELECT
        s.id,
        s.set_name,
        s.location,
        e.name as episode_name,
        (s.budget_loc_fees + s.budget_security + s.budget_fire +
         s.budget_rentals + s.budget_permits + s.budget_police) as total_budget,
        COALESCE((SELECT SUM(amount) FROM cost_entries WHERE set_id = s.id), 0) as total_actual
      FROM sets s
      LEFT JOIN episodes e ON s.episode_id = e.id
      WHERE s.project_id = ?
      ORDER BY e.sort_order, s.set_name
    `).all(req.params.projectId);

    res.json(sets.map(s => ({
      ...s,
      variance: s.total_budget - s.total_actual,
      status: s.total_actual > s.total_budget ? 'over_budget' : 'under_budget'
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get spending by episode
router.get('/by-episode/:projectId', (req, res) => {
  try {
    const db = getDatabase();

    const episodes = db.prepare(`
      SELECT
        e.id,
        e.name,
        e.episode_number,
        e.type,
        COALESCE((
          SELECT SUM(budget_loc_fees + budget_security + budget_fire +
                     budget_rentals + budget_permits + budget_police)
          FROM sets WHERE episode_id = e.id
        ), 0) as total_budget,
        COALESCE((
          SELECT SUM(ce.amount)
          FROM cost_entries ce
          JOIN sets s ON ce.set_id = s.id
          WHERE s.episode_id = e.id
        ), 0) as total_actual,
        (SELECT COUNT(*) FROM sets WHERE episode_id = e.id) as set_count
      FROM episodes e
      WHERE e.project_id = ?
      ORDER BY e.sort_order, e.name
    `).all(req.params.projectId);

    res.json(episodes.map(ep => ({
      ...ep,
      variance: ep.total_budget - ep.total_actual,
      status: ep.total_actual > ep.total_budget ? 'over_budget' : 'under_budget'
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get detailed report for a specific set
router.get('/set/:setId', (req, res) => {
  try {
    const db = getDatabase();

    const set = db.prepare(`
      SELECT s.*, e.name as episode_name
      FROM sets s
      LEFT JOIN episodes e ON s.episode_id = e.id
      WHERE s.id = ?
    `).get(req.params.setId);

    if (!set) {
      return res.status(404).json({ error: 'Set not found' });
    }

    // Get all cost entries for this set, grouped by category
    const costsByCategory = COST_CATEGORIES.map(category => {
      const budgetColumn = {
        'Loc Fees': 'budget_loc_fees',
        'Security': 'budget_security',
        'Fire': 'budget_fire',
        'Rentals': 'budget_rentals',
        'Permits': 'budget_permits',
        'Police': 'budget_police'
      }[category];

      const entries = db.prepare(`
        SELECT * FROM cost_entries
        WHERE set_id = ? AND category = ?
        ORDER BY date DESC
      `).all(req.params.setId, category);

      const actual = entries.reduce((sum, e) => sum + e.amount, 0);
      const budget = set[budgetColumn] || 0;

      return {
        category,
        budget,
        actual,
        variance: budget - actual,
        status: actual > budget ? 'over_budget' : 'under_budget',
        entries
      };
    });

    res.json({
      set,
      categories: costsByCategory,
      totals: {
        budget: costsByCategory.reduce((sum, c) => sum + c.budget, 0),
        actual: costsByCategory.reduce((sum, c) => sum + c.actual, 0)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
