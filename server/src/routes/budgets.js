const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDatabase, COST_CATEGORIES } = require('../database');

// Get cost categories
router.get('/categories', (req, res) => {
  res.json(COST_CATEGORIES);
});

// Get all budget items for a project
router.get('/project/:projectId', (req, res) => {
  try {
    const db = getDatabase();
    const items = db.prepare(`
      SELECT * FROM budget_items
      WHERE project_id = ?
      ORDER BY category, created_at
    `).all(req.params.projectId);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get budget summary by category for a project
router.get('/summary/:projectId', (req, res) => {
  try {
    const db = getDatabase();
    const summary = db.prepare(`
      SELECT
        category,
        SUM(budgeted_amount) as total_budgeted,
        COUNT(*) as item_count
      FROM budget_items
      WHERE project_id = ?
      GROUP BY category
      ORDER BY category
    `).all(req.params.projectId);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single budget item
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const item = db.prepare('SELECT * FROM budget_items WHERE id = ?').get(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Budget item not found' });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create budget item
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const id = uuidv4();
    const { project_id, category, description, budgeted_amount, episode, location_name, notes } = req.body;

    db.prepare(`
      INSERT INTO budget_items (id, project_id, category, description, budgeted_amount, episode, location_name, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, project_id, category, description, budgeted_amount || 0, episode, location_name, notes);

    const item = db.prepare('SELECT * FROM budget_items WHERE id = ?').get(id);
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk create budget items
router.post('/bulk', (req, res) => {
  try {
    const db = getDatabase();
    const { project_id, items } = req.body;

    const insert = db.prepare(`
      INSERT INTO budget_items (id, project_id, category, description, budgeted_amount, episode, location_name, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items) => {
      const created = [];
      for (const item of items) {
        const id = uuidv4();
        insert.run(
          id,
          project_id,
          item.category,
          item.description,
          item.budgeted_amount || 0,
          item.episode,
          item.location_name,
          item.notes
        );
        created.push(id);
      }
      return created;
    });

    const createdIds = insertMany(items);
    res.status(201).json({ created: createdIds.length, ids: createdIds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update budget item
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { category, description, budgeted_amount, episode, location_name, notes } = req.body;

    db.prepare(`
      UPDATE budget_items
      SET category = ?, description = ?, budgeted_amount = ?,
          episode = ?, location_name = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(category, description, budgeted_amount, episode, location_name, notes, req.params.id);

    const item = db.prepare('SELECT * FROM budget_items WHERE id = ?').get(req.params.id);
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete budget item
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    db.prepare('DELETE FROM budget_items WHERE id = ?').run(req.params.id);
    res.json({ message: 'Budget item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete all budget items for a project
router.delete('/project/:projectId', (req, res) => {
  try {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM budget_items WHERE project_id = ?').run(req.params.projectId);
    res.json({ message: 'Budget items deleted', count: result.changes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
