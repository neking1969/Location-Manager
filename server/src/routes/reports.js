const express = require('express');
const router = express.Router();
const { getDatabase, COST_CATEGORIES } = require('../database');

// Get full comparison report - Budget vs Actual by category
router.get('/comparison/:projectId', (req, res) => {
  try {
    const db = getDatabase();

    // Get budget totals by category
    const budgetByCategory = db.prepare(`
      SELECT category, SUM(budgeted_amount) as budgeted
      FROM budget_items
      WHERE project_id = ?
      GROUP BY category
    `).all(req.params.projectId);

    // Get actual totals by category
    const actualByCategory = db.prepare(`
      SELECT category, SUM(amount) as actual
      FROM ledger_entries
      WHERE project_id = ?
      GROUP BY category
    `).all(req.params.projectId);

    // Build comparison map
    const budgetMap = {};
    budgetByCategory.forEach(item => {
      budgetMap[item.category] = item.budgeted;
    });

    const actualMap = {};
    actualByCategory.forEach(item => {
      actualMap[item.category] = item.actual;
    });

    // Create comparison for all categories
    const comparison = COST_CATEGORIES.map(category => {
      const budgeted = budgetMap[category] || 0;
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

// Get detailed variance report with line items
router.get('/variance/:projectId', (req, res) => {
  try {
    const db = getDatabase();
    const category = req.query.category;

    let budgetItems, ledgerEntries;

    if (category) {
      budgetItems = db.prepare(`
        SELECT * FROM budget_items
        WHERE project_id = ? AND category = ?
        ORDER BY description
      `).all(req.params.projectId, category);

      ledgerEntries = db.prepare(`
        SELECT * FROM ledger_entries
        WHERE project_id = ? AND category = ?
        ORDER BY date DESC
      `).all(req.params.projectId, category);
    } else {
      budgetItems = db.prepare(`
        SELECT * FROM budget_items
        WHERE project_id = ?
        ORDER BY category, description
      `).all(req.params.projectId);

      ledgerEntries = db.prepare(`
        SELECT * FROM ledger_entries
        WHERE project_id = ?
        ORDER BY category, date DESC
      `).all(req.params.projectId);
    }

    res.json({
      budget_items: budgetItems,
      ledger_entries: ledgerEntries,
      budget_total: budgetItems.reduce((sum, item) => sum + item.budgeted_amount, 0),
      actual_total: ledgerEntries.reduce((sum, entry) => sum + entry.amount, 0)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get summary dashboard data
router.get('/dashboard/:projectId', (req, res) => {
  try {
    const db = getDatabase();

    // Project info
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Budget total
    const budgetTotal = db.prepare(`
      SELECT COALESCE(SUM(budgeted_amount), 0) as total
      FROM budget_items WHERE project_id = ?
    `).get(req.params.projectId);

    // Actual total
    const actualTotal = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM ledger_entries WHERE project_id = ?
    `).get(req.params.projectId);

    // Recent entries
    const recentEntries = db.prepare(`
      SELECT * FROM ledger_entries
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(req.params.projectId);

    // Categories over budget
    const overBudget = db.prepare(`
      SELECT
        b.category,
        SUM(b.budgeted_amount) as budgeted,
        COALESCE((
          SELECT SUM(amount) FROM ledger_entries
          WHERE project_id = ? AND category = b.category
        ), 0) as actual
      FROM budget_items b
      WHERE b.project_id = ?
      GROUP BY b.category
      HAVING actual > budgeted
    `).all(req.params.projectId, req.params.projectId);

    // Entry counts
    const budgetCount = db.prepare('SELECT COUNT(*) as count FROM budget_items WHERE project_id = ?')
      .get(req.params.projectId);
    const ledgerCount = db.prepare('SELECT COUNT(*) as count FROM ledger_entries WHERE project_id = ?')
      .get(req.params.projectId);

    const variance = budgetTotal.total - actualTotal.total;

    res.json({
      project,
      summary: {
        total_budgeted: budgetTotal.total,
        total_actual: actualTotal.total,
        variance,
        variance_percent: budgetTotal.total > 0
          ? Math.round(((variance / budgetTotal.total) * 100) * 100) / 100
          : 0,
        status: variance >= 0 ? 'under_budget' : 'over_budget',
        budget_item_count: budgetCount.count,
        ledger_entry_count: ledgerCount.count
      },
      over_budget_categories: overBudget.map(c => ({
        ...c,
        over_by: c.actual - c.budgeted,
        over_percent: Math.round(((c.actual - c.budgeted) / c.budgeted * 100) * 100) / 100
      })),
      recent_entries: recentEntries
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get spending by location
router.get('/by-location/:projectId', (req, res) => {
  try {
    const db = getDatabase();

    const byLocation = db.prepare(`
      SELECT
        COALESCE(location_name, 'Unspecified') as location_name,
        SUM(amount) as total_spent,
        COUNT(*) as entry_count
      FROM ledger_entries
      WHERE project_id = ?
      GROUP BY location_name
      ORDER BY total_spent DESC
    `).all(req.params.projectId);

    const budgetByLocation = db.prepare(`
      SELECT
        COALESCE(location_name, 'Unspecified') as location_name,
        SUM(budgeted_amount) as total_budgeted
      FROM budget_items
      WHERE project_id = ?
      GROUP BY location_name
    `).all(req.params.projectId);

    const budgetMap = {};
    budgetByLocation.forEach(item => {
      budgetMap[item.location_name] = item.total_budgeted;
    });

    const locationReport = byLocation.map(loc => ({
      ...loc,
      budgeted: budgetMap[loc.location_name] || 0,
      variance: (budgetMap[loc.location_name] || 0) - loc.total_spent
    }));

    res.json(locationReport);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get spending by episode
router.get('/by-episode/:projectId', (req, res) => {
  try {
    const db = getDatabase();

    const byEpisode = db.prepare(`
      SELECT
        COALESCE(episode, 'Unspecified') as episode,
        SUM(amount) as total_spent,
        COUNT(*) as entry_count
      FROM ledger_entries
      WHERE project_id = ?
      GROUP BY episode
      ORDER BY episode
    `).all(req.params.projectId);

    const budgetByEpisode = db.prepare(`
      SELECT
        COALESCE(episode, 'Unspecified') as episode,
        SUM(budgeted_amount) as total_budgeted
      FROM budget_items
      WHERE project_id = ?
      GROUP BY episode
    `).all(req.params.projectId);

    const budgetMap = {};
    budgetByEpisode.forEach(item => {
      budgetMap[item.episode] = item.total_budgeted;
    });

    const episodeReport = byEpisode.map(ep => ({
      ...ep,
      budgeted: budgetMap[ep.episode] || 0,
      variance: (budgetMap[ep.episode] || 0) - ep.total_spent
    }));

    res.json(episodeReport);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
