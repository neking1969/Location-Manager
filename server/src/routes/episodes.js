const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDatabase, findById, findAll, insert, update, remove, removeWhere } = require('../database');

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

// Get all episodes for a project
router.get('/project/:projectId', (req, res) => {
  try {
    const db = getDatabase();
    const episodes = findAll('episodes', { project_id: req.params.projectId })
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    const result = episodes.map(ep => {
      const sets = db.sets.filter(s => s.episode_id === ep.id);
      const total_budget = sets.reduce((sum, s) =>
        sum + (s.budget_loc_fees || 0) + (s.budget_security || 0) + (s.budget_fire || 0) +
        (s.budget_rentals || 0) + (s.budget_permits || 0) + (s.budget_police || 0), 0);

      const setIds = sets.map(s => s.id);
      const total_actual = db.cost_entries
        .filter(ce => setIds.includes(ce.set_id))
        .reduce((sum, ce) => sum + (ce.amount || 0), 0);

      return {
        ...ep,
        set_count: sets.length,
        total_budget,
        total_actual,
        variance: total_budget - total_actual
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single episode with sets
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const episode = findById('episodes', req.params.id);

    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const sets = db.sets
      .filter(s => s.episode_id === req.params.id)
      .map(s => {
        const actuals = getSetActuals(db, s.id);
        return {
          ...s,
          ...actuals,
          total_budget: (s.budget_loc_fees || 0) + (s.budget_security || 0) + (s.budget_fire || 0) +
            (s.budget_rentals || 0) + (s.budget_permits || 0) + (s.budget_police || 0),
          total_actual: actuals.actual_loc_fees + actuals.actual_security + actuals.actual_fire +
            actuals.actual_rentals + actuals.actual_permits + actuals.actual_police
        };
      })
      .sort((a, b) => (a.set_name || '').localeCompare(b.set_name || ''));

    res.json({ ...episode, sets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create episode
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const { project_id, name, episode_number, type, sort_order, notes } = req.body;

    let order = sort_order;
    if (order === undefined) {
      const episodes = findAll('episodes', { project_id });
      order = episodes.length > 0 ? Math.max(...episodes.map(e => e.sort_order || 0)) + 1 : 0;
    }

    const episode = insert('episodes', {
      id: uuidv4(),
      project_id,
      name,
      episode_number,
      type: type || 'episode',
      sort_order: order,
      notes
    });

    res.status(201).json(episode);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update episode
router.put('/:id', (req, res) => {
  try {
    const { name, episode_number, type, sort_order, notes } = req.body;
    const episode = update('episodes', req.params.id, {
      name, episode_number, type, sort_order, notes
    });
    res.json(episode);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete episode
router.delete('/:id', (req, res) => {
  try {
    const sets = findAll('sets', { episode_id: req.params.id });
    sets.forEach(s => removeWhere('cost_entries', { set_id: s.id }));
    removeWhere('sets', { episode_id: req.params.id });
    remove('episodes', req.params.id);
    res.json({ message: 'Episode deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
