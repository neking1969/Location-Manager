const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDatabase, findById, findAll, insert, update, remove, removeWhere, DEFAULT_GROUPS } = require('../database');

// Get all projects
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const projects = db.projects.map(p => ({
      ...p,
      episode_count: db.episodes.filter(e => e.project_id === p.id).length,
      set_count: db.sets.filter(s => s.project_id === p.id).length
    }));
    projects.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single project with summary
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const project = findById('projects', req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get episodes
    const episodes = findAll('episodes', { project_id: req.params.id })
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    // Calculate totals
    const sets = findAll('sets', { project_id: req.params.id });
    const total_budget = sets.reduce((sum, s) =>
      sum + (s.budget_loc_fees || 0) + (s.budget_security || 0) + (s.budget_fire || 0) +
      (s.budget_rentals || 0) + (s.budget_permits || 0) + (s.budget_police || 0), 0);

    const setIds = sets.map(s => s.id);
    const total_actual = db.cost_entries
      .filter(ce => setIds.includes(ce.set_id))
      .reduce((sum, ce) => sum + (ce.amount || 0), 0);

    res.json({
      ...project,
      episodes,
      total_budget,
      total_actual,
      variance: total_budget - total_actual
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create project
router.post('/', (req, res) => {
  try {
    const id = uuidv4();
    const { name, production_company, start_date, end_date, notes } = req.body;

    const project = insert('projects', {
      id,
      name,
      production_company,
      start_date,
      end_date,
      notes
    });

    // Create default groups (Backlot, Amort)
    DEFAULT_GROUPS.forEach((group, index) => {
      insert('episodes', {
        id: uuidv4(),
        project_id: id,
        name: group.name,
        type: group.type,
        sort_order: index
      });
    });

    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update project
router.put('/:id', (req, res) => {
  try {
    const { name, production_company, start_date, end_date, notes } = req.body;
    const project = update('projects', req.params.id, {
      name,
      production_company,
      start_date,
      end_date,
      notes
    });
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete project
router.delete('/:id', (req, res) => {
  try {
    // Delete related data
    const sets = findAll('sets', { project_id: req.params.id });
    sets.forEach(s => removeWhere('cost_entries', { set_id: s.id }));
    removeWhere('sets', { project_id: req.params.id });
    removeWhere('episodes', { project_id: req.params.id });
    remove('projects', req.params.id);
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
