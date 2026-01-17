const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDatabase, COST_CATEGORIES } = require('../database');

// Get cost entries for a set
router.get('/set/:setId', (req, res) => {
  try {
    const db = getDatabase();
    const entries = db.prepare(`
      SELECT * FROM cost_entries
      WHERE set_id = ?
      ORDER BY category, date DESC, created_at DESC
    `).all(req.params.setId);
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get cost entries by category for a set
router.get('/set/:setId/category/:category', (req, res) => {
  try {
    const db = getDatabase();
    const entries = db.prepare(`
      SELECT * FROM cost_entries
      WHERE set_id = ? AND category = ?
      ORDER BY date DESC, created_at DESC
    `).all(req.params.setId, req.params.category);
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single cost entry
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const entry = db.prepare('SELECT * FROM cost_entries WHERE id = ?').get(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Cost entry not found' });
    }
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create cost entry
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const id = uuidv4();
    const {
      set_id, category, description, amount, vendor,
      invoice_number, po_number, check_number, date,
      payment_status, notes
    } = req.body;

    db.prepare(`
      INSERT INTO cost_entries (id, set_id, category, description, amount, vendor,
        invoice_number, po_number, check_number, date, payment_status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, set_id, category, description, amount || 0, vendor,
      invoice_number, po_number, check_number, date,
      payment_status || 'pending', notes
    );

    const entry = db.prepare('SELECT * FROM cost_entries WHERE id = ?').get(id);
    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk create cost entries
router.post('/bulk', (req, res) => {
  try {
    const db = getDatabase();
    const { set_id, entries } = req.body;

    const insert = db.prepare(`
      INSERT INTO cost_entries (id, set_id, category, description, amount, vendor,
        invoice_number, po_number, check_number, date, payment_status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((entries) => {
      const created = [];
      for (const entry of entries) {
        const id = uuidv4();
        insert.run(
          id, set_id, entry.category, entry.description, entry.amount || 0,
          entry.vendor, entry.invoice_number, entry.po_number, entry.check_number,
          entry.date, entry.payment_status || 'pending', entry.notes
        );
        created.push(id);
      }
      return created;
    });

    const createdIds = insertMany(entries);
    res.status(201).json({ created: createdIds.length, ids: createdIds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update cost entry
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const {
      category, description, amount, vendor, invoice_number,
      po_number, check_number, date, payment_status, notes
    } = req.body;

    db.prepare(`
      UPDATE cost_entries
      SET category = ?, description = ?, amount = ?, vendor = ?,
          invoice_number = ?, po_number = ?, check_number = ?,
          date = ?, payment_status = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      category, description, amount, vendor, invoice_number,
      po_number, check_number, date, payment_status, notes, req.params.id
    );

    const entry = db.prepare('SELECT * FROM cost_entries WHERE id = ?').get(req.params.id);
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete cost entry
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    db.prepare('DELETE FROM cost_entries WHERE id = ?').run(req.params.id);
    res.json({ message: 'Cost entry deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get summary for a project
router.get('/summary/project/:projectId', (req, res) => {
  try {
    const db = getDatabase();

    // Get totals by category across all sets
    const byCategory = db.prepare(`
      SELECT ce.category,
        SUM(ce.amount) as total_actual,
        (SELECT SUM(
          CASE ce.category
            WHEN 'Loc Fees' THEN budget_loc_fees
            WHEN 'Security' THEN budget_security
            WHEN 'Fire' THEN budget_fire
            WHEN 'Rentals' THEN budget_rentals
            WHEN 'Permits' THEN budget_permits
            WHEN 'Police' THEN budget_police
          END
        ) FROM sets WHERE project_id = ?) as total_budget
      FROM cost_entries ce
      JOIN sets s ON ce.set_id = s.id
      WHERE s.project_id = ?
      GROUP BY ce.category
    `).all(req.params.projectId, req.params.projectId);

    // Build complete category summary
    const summary = COST_CATEGORIES.map(cat => {
      const found = byCategory.find(c => c.category === cat);
      const budgetQuery = db.prepare(`
        SELECT SUM(
          CASE ?
            WHEN 'Loc Fees' THEN budget_loc_fees
            WHEN 'Security' THEN budget_security
            WHEN 'Fire' THEN budget_fire
            WHEN 'Rentals' THEN budget_rentals
            WHEN 'Permits' THEN budget_permits
            WHEN 'Police' THEN budget_police
          END
        ) as total FROM sets WHERE project_id = ?
      `).get(cat, req.params.projectId);

      const budget = budgetQuery.total || 0;
      const actual = found?.total_actual || 0;

      return {
        category: cat,
        budget,
        actual,
        variance: budget - actual,
        status: actual > budget ? 'over_budget' : 'under_budget'
      };
    });

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
