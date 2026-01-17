const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../database');

// Get all episodes for a project
router.get('/project/:projectId', (req, res) => {
  try {
    const db = getDatabase();
    const episodes = db.prepare(`
      SELECT e.*,
        (SELECT COUNT(*) FROM sets WHERE episode_id = e.id) as set_count,
        (SELECT COALESCE(SUM(budget_loc_fees + budget_security + budget_fire + budget_rentals + budget_permits + budget_police), 0)
         FROM sets WHERE episode_id = e.id) as total_budget,
        (SELECT COALESCE(SUM(ce.amount), 0)
         FROM cost_entries ce
         JOIN sets s ON ce.set_id = s.id
         WHERE s.episode_id = e.id) as total_actual
      FROM episodes e
      WHERE e.project_id = ?
      ORDER BY e.sort_order, e.name
    `).all(req.params.projectId);

    res.json(episodes.map(ep => ({
      ...ep,
      variance: ep.total_budget - ep.total_actual
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single episode with sets
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const episode = db.prepare('SELECT * FROM episodes WHERE id = ?').get(req.params.id);

    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    // Get sets for this episode
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
    `).all(req.params.id);

    res.json({
      ...episode,
      sets: sets.map(s => ({
        ...s,
        total_budget: s.budget_loc_fees + s.budget_security + s.budget_fire + s.budget_rentals + s.budget_permits + s.budget_police,
        total_actual: s.actual_loc_fees + s.actual_security + s.actual_fire + s.actual_rentals + s.actual_permits + s.actual_police
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create episode
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const id = uuidv4();
    const { project_id, name, episode_number, type, sort_order, notes } = req.body;

    // Get max sort order if not provided
    let order = sort_order;
    if (order === undefined) {
      const maxOrder = db.prepare(`
        SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order
        FROM episodes WHERE project_id = ?
      `).get(project_id);
      order = maxOrder.next_order;
    }

    db.prepare(`
      INSERT INTO episodes (id, project_id, name, episode_number, type, sort_order, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, project_id, name, episode_number, type || 'episode', order, notes);

    const episode = db.prepare('SELECT * FROM episodes WHERE id = ?').get(id);
    res.status(201).json(episode);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update episode
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { name, episode_number, type, sort_order, notes } = req.body;

    db.prepare(`
      UPDATE episodes
      SET name = ?, episode_number = ?, type = ?, sort_order = ?, notes = ?
      WHERE id = ?
    `).run(name, episode_number, type, sort_order, notes, req.params.id);

    const episode = db.prepare('SELECT * FROM episodes WHERE id = ?').get(req.params.id);
    res.json(episode);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete episode
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    db.prepare('DELETE FROM episodes WHERE id = ?').run(req.params.id);
    res.json({ message: 'Episode deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reorder episodes
router.post('/reorder', (req, res) => {
  try {
    const db = getDatabase();
    const { episodes } = req.body; // Array of { id, sort_order }

    const update = db.prepare('UPDATE episodes SET sort_order = ? WHERE id = ?');
    const reorder = db.transaction((items) => {
      for (const item of items) {
        update.run(item.sort_order, item.id);
      }
    });

    reorder(episodes);
    res.json({ message: 'Episodes reordered successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
