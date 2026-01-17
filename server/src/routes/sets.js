const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDatabase, COST_CATEGORIES } = require('../database');

// Get all sets for a project
router.get('/project/:projectId', (req, res) => {
  try {
    const db = getDatabase();
    const sets = db.prepare(`
      SELECT s.*,
        e.name as episode_name,
        (SELECT COALESCE(SUM(amount), 0) FROM cost_entries WHERE set_id = s.id AND category = 'Loc Fees') as actual_loc_fees,
        (SELECT COALESCE(SUM(amount), 0) FROM cost_entries WHERE set_id = s.id AND category = 'Security') as actual_security,
        (SELECT COALESCE(SUM(amount), 0) FROM cost_entries WHERE set_id = s.id AND category = 'Fire') as actual_fire,
        (SELECT COALESCE(SUM(amount), 0) FROM cost_entries WHERE set_id = s.id AND category = 'Rentals') as actual_rentals,
        (SELECT COALESCE(SUM(amount), 0) FROM cost_entries WHERE set_id = s.id AND category = 'Permits') as actual_permits,
        (SELECT COALESCE(SUM(amount), 0) FROM cost_entries WHERE set_id = s.id AND category = 'Police') as actual_police
      FROM sets s
      LEFT JOIN episodes e ON s.episode_id = e.id
      WHERE s.project_id = ?
      ORDER BY e.sort_order, s.set_name
    `).all(req.params.projectId);

    res.json(sets.map(s => ({
      ...s,
      total_budget: s.budget_loc_fees + s.budget_security + s.budget_fire + s.budget_rentals + s.budget_permits + s.budget_police,
      total_actual: s.actual_loc_fees + s.actual_security + s.actual_fire + s.actual_rentals + s.actual_permits + s.actual_police
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get sets for a specific episode
router.get('/episode/:episodeId', (req, res) => {
  try {
    const db = getDatabase();
    const sets = db.prepare(`
      SELECT s.*,
        (SELECT COALESCE(SUM(amount), 0) FROM cost_entries WHERE set_id = s.id AND category = 'Loc Fees') as actual_loc_fees,
        (SELECT COALESCE(SUM(amount), 0) FROM cost_entries WHERE set_id = s.id AND category = 'Security') as actual_security,
        (SELECT COALESCE(SUM(amount), 0) FROM cost_entries WHERE set_id = s.id AND category = 'Fire') as actual_fire,
        (SELECT COALESCE(SUM(amount), 0) FROM cost_entries WHERE set_id = s.id AND category = 'Rentals') as actual_rentals,
        (SELECT COALESCE(SUM(amount), 0) FROM cost_entries WHERE set_id = s.id AND category = 'Permits') as actual_permits,
        (SELECT COALESCE(SUM(amount), 0) FROM cost_entries WHERE set_id = s.id AND category = 'Police') as actual_police
      FROM sets s
      WHERE s.episode_id = ?
      ORDER BY s.set_name
    `).all(req.params.episodeId);

    res.json(sets.map(s => ({
      ...s,
      total_budget: s.budget_loc_fees + s.budget_security + s.budget_fire + s.budget_rentals + s.budget_permits + s.budget_police,
      total_actual: s.actual_loc_fees + s.actual_security + s.actual_fire + s.actual_rentals + s.actual_permits + s.actual_police
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single set with cost entries
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const set = db.prepare(`
      SELECT s.*,
        e.name as episode_name,
        (SELECT COALESCE(SUM(amount), 0) FROM cost_entries WHERE set_id = s.id AND category = 'Loc Fees') as actual_loc_fees,
        (SELECT COALESCE(SUM(amount), 0) FROM cost_entries WHERE set_id = s.id AND category = 'Security') as actual_security,
        (SELECT COALESCE(SUM(amount), 0) FROM cost_entries WHERE set_id = s.id AND category = 'Fire') as actual_fire,
        (SELECT COALESCE(SUM(amount), 0) FROM cost_entries WHERE set_id = s.id AND category = 'Rentals') as actual_rentals,
        (SELECT COALESCE(SUM(amount), 0) FROM cost_entries WHERE set_id = s.id AND category = 'Permits') as actual_permits,
        (SELECT COALESCE(SUM(amount), 0) FROM cost_entries WHERE set_id = s.id AND category = 'Police') as actual_police
      FROM sets s
      LEFT JOIN episodes e ON s.episode_id = e.id
      WHERE s.id = ?
    `).get(req.params.id);

    if (!set) {
      return res.status(404).json({ error: 'Set not found' });
    }

    // Get cost entries
    const costEntries = db.prepare(`
      SELECT * FROM cost_entries
      WHERE set_id = ?
      ORDER BY category, date DESC
    `).all(req.params.id);

    res.json({
      ...set,
      total_budget: set.budget_loc_fees + set.budget_security + set.budget_fire + set.budget_rentals + set.budget_permits + set.budget_police,
      total_actual: set.actual_loc_fees + set.actual_security + set.actual_fire + set.actual_rentals + set.actual_permits + set.actual_police,
      cost_entries: costEntries
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create set
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const id = uuidv4();
    const {
      project_id, episode_id, set_name, location,
      budget_loc_fees, budget_security, budget_fire,
      budget_rentals, budget_permits, budget_police, notes
    } = req.body;

    db.prepare(`
      INSERT INTO sets (id, project_id, episode_id, set_name, location,
        budget_loc_fees, budget_security, budget_fire,
        budget_rentals, budget_permits, budget_police, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, project_id, episode_id, set_name, location,
      budget_loc_fees || 0, budget_security || 0, budget_fire || 0,
      budget_rentals || 0, budget_permits || 0, budget_police || 0, notes
    );

    const newSet = db.prepare('SELECT * FROM sets WHERE id = ?').get(id);
    res.status(201).json(newSet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update set
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const {
      episode_id, set_name, location,
      budget_loc_fees, budget_security, budget_fire,
      budget_rentals, budget_permits, budget_police, notes
    } = req.body;

    db.prepare(`
      UPDATE sets
      SET episode_id = ?, set_name = ?, location = ?,
          budget_loc_fees = ?, budget_security = ?, budget_fire = ?,
          budget_rentals = ?, budget_permits = ?, budget_police = ?,
          notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      episode_id, set_name, location,
      budget_loc_fees || 0, budget_security || 0, budget_fire || 0,
      budget_rentals || 0, budget_permits || 0, budget_police || 0,
      notes, req.params.id
    );

    const updatedSet = db.prepare('SELECT * FROM sets WHERE id = ?').get(req.params.id);
    res.json(updatedSet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete set
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    db.prepare('DELETE FROM sets WHERE id = ?').run(req.params.id);
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
