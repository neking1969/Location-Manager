const express = require('express');
const router = express.Router();
const { getDatabase, findById, findAll, COST_CATEGORIES } = require('../database');

// Get full comparison report - Budget vs Actual by category
router.get('/comparison/:projectId', (req, res) => {
  try {
    const db = getDatabase();
    const projectId = req.params.projectId;

    // Get all sets for project
    const projectSets = db.sets.filter(s => s.project_id === projectId);
    const setIds = projectSets.map(s => s.id);

    // Calculate budget totals by category
    const budgetColumnMap = {
      'Loc Fees': projectSets.reduce((sum, s) => sum + (s.budget_loc_fees || 0), 0),
      'Security': projectSets.reduce((sum, s) => sum + (s.budget_security || 0), 0),
      'Fire': projectSets.reduce((sum, s) => sum + (s.budget_fire || 0), 0),
      'Rentals': projectSets.reduce((sum, s) => sum + (s.budget_rentals || 0), 0),
      'Permits': projectSets.reduce((sum, s) => sum + (s.budget_permits || 0), 0),
      'Police': projectSets.reduce((sum, s) => sum + (s.budget_police || 0), 0)
    };

    // Get actual totals by category from cost_entries
    const projectEntries = db.cost_entries.filter(ce => setIds.includes(ce.set_id));
    const actualMap = {};
    for (const entry of projectEntries) {
      actualMap[entry.category] = (actualMap[entry.category] || 0) + (entry.amount || 0);
    }

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
    const project = findById('projects', projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get episodes
    const episodes = findAll('episodes', { project_id: projectId })
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    // Get all sets for project
    const projectSets = db.sets.filter(s => s.project_id === projectId);
    const setIds = projectSets.map(s => s.id);

    // Budget total from sets
    const budgetTotal = projectSets.reduce((sum, s) =>
      sum + (s.budget_loc_fees || 0) + (s.budget_security || 0) + (s.budget_fire || 0) +
      (s.budget_rentals || 0) + (s.budget_permits || 0) + (s.budget_police || 0), 0);

    // Actual total from cost_entries
    const projectEntries = db.cost_entries.filter(ce => setIds.includes(ce.set_id));
    const actualTotal = projectEntries.reduce((sum, ce) => sum + (ce.amount || 0), 0);

    // Recent entries
    const recentEntries = projectEntries
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      .slice(0, 10)
      .map(ce => {
        const set = db.sets.find(s => s.id === ce.set_id);
        return { ...ce, set_name: set?.set_name || 'Unknown' };
      });

    // Sets over budget
    const setsOverBudget = projectSets
      .map(s => {
        const totalBudget = (s.budget_loc_fees || 0) + (s.budget_security || 0) + (s.budget_fire || 0) +
          (s.budget_rentals || 0) + (s.budget_permits || 0) + (s.budget_police || 0);
        const totalActual = db.cost_entries
          .filter(ce => ce.set_id === s.id)
          .reduce((sum, ce) => sum + (ce.amount || 0), 0);
        return {
          id: s.id,
          set_name: s.set_name,
          total_budget: totalBudget,
          total_actual: totalActual
        };
      })
      .filter(s => s.total_actual > s.total_budget && s.total_budget > 0)
      .map(s => ({
        ...s,
        over_by: s.total_actual - s.total_budget,
        over_percent: Math.round(((s.total_actual - s.total_budget) / s.total_budget * 100) * 100) / 100
      }));

    const variance = budgetTotal - actualTotal;

    res.json({
      project,
      episodes,
      summary: {
        total_budget: budgetTotal,
        total_actual: actualTotal,
        variance,
        variance_percent: budgetTotal > 0
          ? Math.round(((variance / budgetTotal) * 100) * 100) / 100
          : 0,
        status: variance >= 0 ? 'under_budget' : 'over_budget',
        set_count: projectSets.length,
        entry_count: projectEntries.length
      },
      sets_over_budget: setsOverBudget,
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

    const projectSets = db.sets.filter(s => s.project_id === req.params.projectId);

    const result = projectSets.map(s => {
      const episode = s.episode_id ? db.episodes.find(e => e.id === s.episode_id) : null;
      const totalBudget = (s.budget_loc_fees || 0) + (s.budget_security || 0) + (s.budget_fire || 0) +
        (s.budget_rentals || 0) + (s.budget_permits || 0) + (s.budget_police || 0);
      const totalActual = db.cost_entries
        .filter(ce => ce.set_id === s.id)
        .reduce((sum, ce) => sum + (ce.amount || 0), 0);

      return {
        id: s.id,
        set_name: s.set_name,
        location: s.location,
        episode_name: episode?.name || null,
        total_budget: totalBudget,
        total_actual: totalActual,
        variance: totalBudget - totalActual,
        status: totalActual > totalBudget ? 'over_budget' : 'under_budget'
      };
    }).sort((a, b) => {
      const epA = db.episodes.find(e => e.name === a.episode_name);
      const epB = db.episodes.find(e => e.name === b.episode_name);
      const orderA = epA?.sort_order || 0;
      const orderB = epB?.sort_order || 0;
      if (orderA !== orderB) return orderA - orderB;
      return (a.set_name || '').localeCompare(b.set_name || '');
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get spending by episode
router.get('/by-episode/:projectId', (req, res) => {
  try {
    const db = getDatabase();

    const episodes = findAll('episodes', { project_id: req.params.projectId })
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    const result = episodes.map(ep => {
      const episodeSets = db.sets.filter(s => s.episode_id === ep.id);
      const setIds = episodeSets.map(s => s.id);

      const totalBudget = episodeSets.reduce((sum, s) =>
        sum + (s.budget_loc_fees || 0) + (s.budget_security || 0) + (s.budget_fire || 0) +
        (s.budget_rentals || 0) + (s.budget_permits || 0) + (s.budget_police || 0), 0);

      const totalActual = db.cost_entries
        .filter(ce => setIds.includes(ce.set_id))
        .reduce((sum, ce) => sum + (ce.amount || 0), 0);

      return {
        id: ep.id,
        name: ep.name,
        episode_number: ep.episode_number,
        type: ep.type,
        total_budget: totalBudget,
        total_actual: totalActual,
        variance: totalBudget - totalActual,
        status: totalActual > totalBudget ? 'over_budget' : 'under_budget',
        set_count: episodeSets.length
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get detailed report for a specific set
router.get('/set/:setId', (req, res) => {
  try {
    const db = getDatabase();

    const set = findById('sets', req.params.setId);
    if (!set) {
      return res.status(404).json({ error: 'Set not found' });
    }

    const episode = set.episode_id ? db.episodes.find(e => e.id === set.episode_id) : null;

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

      const entries = db.cost_entries
        .filter(ce => ce.set_id === req.params.setId && ce.category === category)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      const actual = entries.reduce((sum, e) => sum + (e.amount || 0), 0);
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
      set: { ...set, episode_name: episode?.name || null },
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
