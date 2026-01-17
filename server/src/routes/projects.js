const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDatabase, DEFAULT_GROUPS } = require('../database');

// Get all projects
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const projects = db.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM episodes WHERE project_id = p.id) as episode_count,
        (SELECT COUNT(*) FROM sets WHERE project_id = p.id) as set_count
      FROM projects p
      ORDER BY p.created_at DESC
    `).all();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single project with summary
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get episodes
    const episodes = db.prepare(`
      SELECT * FROM episodes WHERE project_id = ? ORDER BY sort_order, name
    `).all(req.params.id);

    // Get total budget and actual
    const totals = db.prepare(`
      SELECT
        COALESCE(SUM(budget_loc_fees + budget_security + budget_fire + budget_rentals + budget_permits + budget_police), 0) as total_budget
      FROM sets WHERE project_id = ?
    `).get(req.params.id);

    const actualTotals = db.prepare(`
      SELECT COALESCE(SUM(ce.amount), 0) as total_actual
      FROM cost_entries ce
      JOIN sets s ON ce.set_id = s.id
      WHERE s.project_id = ?
    `).get(req.params.id);

    res.json({
      ...project,
      episodes,
      total_budget: totals.total_budget,
      total_actual: actualTotals.total_actual,
      variance: totals.total_budget - actualTotals.total_actual
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create project
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const id = uuidv4();
    const { name, production_company, start_date, end_date, notes } = req.body;

    db.prepare(`
      INSERT INTO projects (id, name, production_company, start_date, end_date, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, production_company, start_date, end_date, notes);

    // Create default groups (Backlot, Amort)
    const insertEpisode = db.prepare(`
      INSERT INTO episodes (id, project_id, name, type, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);

    DEFAULT_GROUPS.forEach((group, index) => {
      insertEpisode.run(uuidv4(), id, group.name, group.type, index);
    });

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update project
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { name, production_company, start_date, end_date, notes } = req.body;

    db.prepare(`
      UPDATE projects
      SET name = ?, production_company = ?, start_date = ?, end_date = ?,
          notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(name, production_company, start_date, end_date, notes, req.params.id);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete project
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
