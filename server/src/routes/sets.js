const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDatabase, findById, findAll, insert, update, remove, removeWhere, COST_CATEGORIES } = require('../database');

// Helper to calculate set actuals
function getSetActuals(db, setId) {
  const entries = db.cost_entries.filter(ce => ce.set_id === setId);
  return {
    actual_loc_fees: entries.filter(e => e.category === 'Loc Fees').reduce((s, e) => s + (e.amount || 0), 0),
    actual_security: entries.filter(e => e.category === 'Security').reduce((s, e) => s + (e.amount || 0), 0),
    actual_fire: entries.filter(e => e.category === 'Fire').reduce((s, e) => s + (e.amount || 0), 0),
    actual_rentals: entries.filter(e => e.category === 'Rentals').reduce((s, e) => s + (e.amount || 0), 0),
    actual_permits: entries.filter(e => e.category === 'Permits').reduce((s, e) => s + (e.amount || 0), 0),
    actual_police: entries.filter(e => e.category === 'Police').reduce((s, e) => s + (e.amount || 0), 0)
  };
}

// Get all sets for a project
router.get('/project/:projectId', (req, res) => {
  try {
    const db = getDatabase();
    const sets = findAll('sets', { project_id: req.params.projectId });

    const result = sets.map(s => {
      const episode = s.episode_id ? db.episodes.find(e => e.id === s.episode_id) : null;
      const actuals = getSetActuals(db, s.id);

      return {
        ...s,
        episode_name: episode?.name || null,
        ...actuals,
        total_budget: (s.budget_loc_fees || 0) + (s.budget_security || 0) + (s.budget_fire || 0) +
          (s.budget_rentals || 0) + (s.budget_permits || 0) + (s.budget_police || 0),
        total_actual: actuals.actual_loc_fees + actuals.actual_security + actuals.actual_fire +
          actuals.actual_rentals + actuals.actual_permits + actuals.actual_police
      };
    }).sort((a, b) => {
      const epA = db.episodes.find(e => e.id === a.episode_id);
      const epB = db.episodes.find(e => e.id === b.episode_id);
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

// Get sets for a specific episode
router.get('/episode/:episodeId', (req, res) => {
  try {
    const db = getDatabase();
    const sets = findAll('sets', { episode_id: req.params.episodeId });

    const result = sets.map(s => {
      const actuals = getSetActuals(db, s.id);
      return {
        ...s,
        ...actuals,
        total_budget: (s.budget_loc_fees || 0) + (s.budget_security || 0) + (s.budget_fire || 0) +
          (s.budget_rentals || 0) + (s.budget_permits || 0) + (s.budget_police || 0),
        total_actual: actuals.actual_loc_fees + actuals.actual_security + actuals.actual_fire +
          actuals.actual_rentals + actuals.actual_permits + actuals.actual_police
      };
    }).sort((a, b) => (a.set_name || '').localeCompare(b.set_name || ''));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single set with cost entries
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const set = findById('sets', req.params.id);

    if (!set) {
      return res.status(404).json({ error: 'Set not found' });
    }

    const episode = set.episode_id ? db.episodes.find(e => e.id === set.episode_id) : null;
    const actuals = getSetActuals(db, set.id);
    const costEntries = db.cost_entries
      .filter(ce => ce.set_id === req.params.id)
      .sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return (b.date || '').localeCompare(a.date || '');
      });

    res.json({
      ...set,
      episode_name: episode?.name || null,
      ...actuals,
      total_budget: (set.budget_loc_fees || 0) + (set.budget_security || 0) + (set.budget_fire || 0) +
        (set.budget_rentals || 0) + (set.budget_permits || 0) + (set.budget_police || 0),
      total_actual: actuals.actual_loc_fees + actuals.actual_security + actuals.actual_fire +
        actuals.actual_rentals + actuals.actual_permits + actuals.actual_police,
      cost_entries: costEntries
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create set
router.post('/', (req, res) => {
  try {
    const {
      project_id, episode_id, set_name, location,
      budget_loc_fees, budget_security, budget_fire,
      budget_rentals, budget_permits, budget_police, notes
    } = req.body;

    const newSet = insert('sets', {
      id: uuidv4(),
      project_id,
      episode_id,
      set_name,
      location,
      budget_loc_fees: budget_loc_fees || 0,
      budget_security: budget_security || 0,
      budget_fire: budget_fire || 0,
      budget_rentals: budget_rentals || 0,
      budget_permits: budget_permits || 0,
      budget_police: budget_police || 0,
      notes
    });

    res.status(201).json(newSet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update set
router.put('/:id', (req, res) => {
  try {
    const {
      episode_id, set_name, location,
      budget_loc_fees, budget_security, budget_fire,
      budget_rentals, budget_permits, budget_police, notes
    } = req.body;

    const updatedSet = update('sets', req.params.id, {
      episode_id,
      set_name,
      location,
      budget_loc_fees: budget_loc_fees || 0,
      budget_security: budget_security || 0,
      budget_fire: budget_fire || 0,
      budget_rentals: budget_rentals || 0,
      budget_permits: budget_permits || 0,
      budget_police: budget_police || 0,
      notes
    });

    res.json(updatedSet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete set
router.delete('/:id', (req, res) => {
  try {
    removeWhere('cost_entries', { set_id: req.params.id });
    remove('sets', req.params.id);
    res.json({ message: 'Set deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get cost categories
router.get('/meta/categories', (req, res) => {
  res.json(COST_CATEGORIES);
});

module.exports = router;
