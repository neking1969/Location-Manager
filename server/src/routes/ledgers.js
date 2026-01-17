const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../database');

// Get all ledger entries for a project
router.get('/project/:projectId', (req, res) => {
  try {
    const db = getDatabase();
    const entries = db.prepare(`
      SELECT * FROM ledger_entries
      WHERE project_id = ?
      ORDER BY date DESC, created_at DESC
    `).all(req.params.projectId);
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get ledger summary by category for a project
router.get('/summary/:projectId', (req, res) => {
  try {
    const db = getDatabase();
    const summary = db.prepare(`
      SELECT
        category,
        SUM(amount) as total_spent,
        COUNT(*) as entry_count
      FROM ledger_entries
      WHERE project_id = ?
      GROUP BY category
      ORDER BY category
    `).all(req.params.projectId);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get ledger entries by category
router.get('/project/:projectId/category/:category', (req, res) => {
  try {
    const db = getDatabase();
    const entries = db.prepare(`
      SELECT * FROM ledger_entries
      WHERE project_id = ? AND category = ?
      ORDER BY date DESC
    `).all(req.params.projectId, req.params.category);
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single ledger entry
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const entry = db.prepare('SELECT * FROM ledger_entries WHERE id = ?').get(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Ledger entry not found' });
    }
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create ledger entry
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const id = uuidv4();
    const {
      project_id, category, description, amount, vendor,
      invoice_number, date, episode, location_name,
      payment_status, po_number, notes, source_file
    } = req.body;

    db.prepare(`
      INSERT INTO ledger_entries
      (id, project_id, category, description, amount, vendor, invoice_number,
       date, episode, location_name, payment_status, po_number, notes, source_file)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, project_id, category, description, amount || 0, vendor,
      invoice_number, date, episode, location_name,
      payment_status || 'pending', po_number, notes, source_file
    );

    const entry = db.prepare('SELECT * FROM ledger_entries WHERE id = ?').get(id);
    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk create ledger entries
router.post('/bulk', (req, res) => {
  try {
    const db = getDatabase();
    const { project_id, entries } = req.body;

    const insert = db.prepare(`
      INSERT INTO ledger_entries
      (id, project_id, category, description, amount, vendor, invoice_number,
       date, episode, location_name, payment_status, po_number, notes, source_file)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((entries) => {
      const created = [];
      for (const entry of entries) {
        const id = uuidv4();
        insert.run(
          id,
          project_id,
          entry.category,
          entry.description,
          entry.amount || 0,
          entry.vendor,
          entry.invoice_number,
          entry.date,
          entry.episode,
          entry.location_name,
          entry.payment_status || 'pending',
          entry.po_number,
          entry.notes,
          entry.source_file
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

// Update ledger entry
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const {
      category, description, amount, vendor, invoice_number,
      date, episode, location_name, payment_status, po_number, notes
    } = req.body;

    db.prepare(`
      UPDATE ledger_entries
      SET category = ?, description = ?, amount = ?, vendor = ?,
          invoice_number = ?, date = ?, episode = ?, location_name = ?,
          payment_status = ?, po_number = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      category, description, amount, vendor, invoice_number,
      date, episode, location_name, payment_status, po_number, notes, req.params.id
    );

    const entry = db.prepare('SELECT * FROM ledger_entries WHERE id = ?').get(req.params.id);
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete ledger entry
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    db.prepare('DELETE FROM ledger_entries WHERE id = ?').run(req.params.id);
    res.json({ message: 'Ledger entry deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete all ledger entries for a project
router.delete('/project/:projectId', (req, res) => {
  try {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM ledger_entries WHERE project_id = ?').run(req.params.projectId);
    res.json({ message: 'Ledger entries deleted', count: result.changes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
