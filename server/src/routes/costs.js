const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDatabase, findById, findAll, insert, update, remove, saveDatabase, COST_CATEGORIES } = require('../database');

// Get cost entries for a set
router.get('/set/:setId', (req, res) => {
  try {
    const db = getDatabase();
    const entries = db.cost_entries
      .filter(ce => ce.set_id === req.params.setId)
      .sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return (b.date || '').localeCompare(a.date || '');
      });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get cost entries by category for a set
router.get('/set/:setId/category/:category', (req, res) => {
  try {
    const db = getDatabase();
    const entries = db.cost_entries
      .filter(ce => ce.set_id === req.params.setId && ce.category === req.params.category)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single cost entry
router.get('/:id', (req, res) => {
  try {
    const entry = findById('cost_entries', req.params.id);
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
    const {
      set_id, category, description, amount, vendor,
      invoice_number, po_number, check_number, date,
      payment_status, notes
    } = req.body;

    const entry = insert('cost_entries', {
      id: uuidv4(),
      set_id,
      category,
      description,
      amount: amount || 0,
      vendor,
      invoice_number,
      po_number,
      check_number,
      date,
      payment_status: payment_status || 'pending',
      notes
    });

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

    const createdIds = [];
    for (const entry of entries) {
      const id = uuidv4();
      db.cost_entries.push({
        id,
        set_id,
        category: entry.category,
        description: entry.description,
        amount: entry.amount || 0,
        vendor: entry.vendor,
        invoice_number: entry.invoice_number,
        po_number: entry.po_number,
        check_number: entry.check_number,
        date: entry.date,
        payment_status: entry.payment_status || 'pending',
        notes: entry.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      createdIds.push(id);
    }
    saveDatabase();

    res.status(201).json({ created: createdIds.length, ids: createdIds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update cost entry
router.put('/:id', (req, res) => {
  try {
    const {
      category, description, amount, vendor, invoice_number,
      po_number, check_number, date, payment_status, notes
    } = req.body;

    const entry = update('cost_entries', req.params.id, {
      category,
      description,
      amount,
      vendor,
      invoice_number,
      po_number,
      check_number,
      date,
      payment_status,
      notes
    });

    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete cost entry
router.delete('/:id', (req, res) => {
  try {
    remove('cost_entries', req.params.id);
    res.json({ message: 'Cost entry deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get summary for a project
router.get('/summary/project/:projectId', (req, res) => {
  try {
    const db = getDatabase();
    const projectId = req.params.projectId;

    // Get all sets for project
    const projectSets = db.sets.filter(s => s.project_id === projectId);
    const setIds = projectSets.map(s => s.id);

    // Calculate budget totals by category
    const budgetByCategory = {
      'Loc Fees': projectSets.reduce((sum, s) => sum + (s.budget_loc_fees || 0), 0),
      'Security': projectSets.reduce((sum, s) => sum + (s.budget_security || 0), 0),
      'Fire': projectSets.reduce((sum, s) => sum + (s.budget_fire || 0), 0),
      'Rentals': projectSets.reduce((sum, s) => sum + (s.budget_rentals || 0), 0),
      'Permits': projectSets.reduce((sum, s) => sum + (s.budget_permits || 0), 0),
      'Police': projectSets.reduce((sum, s) => sum + (s.budget_police || 0), 0)
    };

    // Calculate actual totals by category
    const projectEntries = db.cost_entries.filter(ce => setIds.includes(ce.set_id));

    const summary = COST_CATEGORIES.map(cat => {
      const budget = budgetByCategory[cat] || 0;
      const actual = projectEntries
        .filter(e => e.category === cat)
        .reduce((sum, e) => sum + (e.amount || 0), 0);

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
