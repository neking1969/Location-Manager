const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../database');

// Get all projects
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const projects = db.prepare(`
      SELECT p.*,
        COALESCE(SUM(b.budgeted_amount), 0) as total_budgeted,
        COALESCE((SELECT SUM(amount) FROM ledger_entries WHERE project_id = p.id), 0) as total_spent
      FROM projects p
      LEFT JOIN budget_items b ON p.id = b.project_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single project
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const project = db.prepare(`
      SELECT p.*,
        COALESCE(SUM(b.budgeted_amount), 0) as total_budgeted,
        COALESCE((SELECT SUM(amount) FROM ledger_entries WHERE project_id = p.id), 0) as total_spent
      FROM projects p
      LEFT JOIN budget_items b ON p.id = b.project_id
      WHERE p.id = ?
      GROUP BY p.id
    `).get(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create project
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const id = uuidv4();
    const { name, production_company, start_date, end_date, total_budget, notes } = req.body;

    db.prepare(`
      INSERT INTO projects (id, name, production_company, start_date, end_date, total_budget, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, production_company, start_date, end_date, total_budget || 0, notes);

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
    const { name, production_company, start_date, end_date, total_budget, notes } = req.body;

    db.prepare(`
      UPDATE projects
      SET name = ?, production_company = ?, start_date = ?, end_date = ?,
          total_budget = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(name, production_company, start_date, end_date, total_budget, notes, req.params.id);

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
