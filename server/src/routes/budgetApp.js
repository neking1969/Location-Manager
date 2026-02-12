const express = require('express');
const router = express.Router();
const {
  getBudgetDatabase,
  budgetFindById,
  budgetFindAll,
  budgetInsert,
  budgetUpdate,
  budgetRemove,
  COST_CATEGORIES,
  PO_STATUSES,
  INVOICE_STATUSES,
  CHECK_STATUSES,
  BUDGET_STATUSES,
  LOCATION_STATUSES
} = require('../budgetDatabase');

// ===== DASHBOARD =====

router.get('/dashboard', (req, res) => {
  try {
    const db = getBudgetDatabase();

    const totalBudget = db.budgets.reduce((sum, b) => sum + (b.totalBudget || 0), 0);

    // Calculate actual spend from POs + Invoices (deduplicated by taking max)
    const poTotal = db.purchaseOrders
      .filter(po => po.status !== 'Cancelled')
      .reduce((sum, po) => sum + (po.amount || 0), 0);

    const invoiceTotal = db.invoices
      .filter(inv => inv.status !== 'Cancelled')
      .reduce((sum, inv) => sum + (inv.amount || 0), 0);

    const checkTotal = db.checkRequests
      .filter(cr => cr.status !== 'Voided')
      .reduce((sum, cr) => sum + (cr.amount || 0), 0);

    // Use the higher of PO total or invoice total as actual (they often overlap)
    const totalActual = Math.max(poTotal, invoiceTotal) + checkTotal;
    const variance = totalBudget - totalActual;

    // Budget by category
    const budgetByCategory = {};
    db.budgetLineItems.forEach(item => {
      budgetByCategory[item.category] = (budgetByCategory[item.category] || 0) + item.amount;
    });

    // Actual by category
    const actualByCategory = {};
    db.purchaseOrders.filter(po => po.status !== 'Cancelled').forEach(po => {
      actualByCategory[po.category] = (actualByCategory[po.category] || 0) + po.amount;
    });

    // Over budget locations
    const locationBudgets = {};
    db.budgetLineItems.forEach(item => {
      locationBudgets[item.locationName] = (locationBudgets[item.locationName] || 0) + item.amount;
    });
    const locationActuals = {};
    db.purchaseOrders.filter(po => po.status !== 'Cancelled').forEach(po => {
      locationActuals[po.locationName] = (locationActuals[po.locationName] || 0) + po.amount;
    });

    const overBudgetLocations = Object.keys(locationBudgets)
      .map(name => ({
        name,
        budget: locationBudgets[name] || 0,
        actual: locationActuals[name] || 0,
        variance: (locationBudgets[name] || 0) - (locationActuals[name] || 0)
      }))
      .filter(l => l.variance < 0)
      .sort((a, b) => a.variance - b.variance);

    // Recent transactions
    const allTransactions = [
      ...db.purchaseOrders.map(po => ({ ...po, type: 'PO' })),
      ...db.invoices.map(inv => ({ ...inv, type: 'Invoice' })),
      ...db.checkRequests.map(cr => ({ ...cr, type: 'Check' }))
    ].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 10);

    res.json({
      summary: {
        totalBudget,
        totalActual,
        variance,
        variancePercent: totalBudget > 0 ? ((variance / totalBudget) * 100).toFixed(1) : 0,
        totalLocations: db.locations.length,
        totalBudgets: db.budgets.length,
        activePOs: db.purchaseOrders.filter(po => !['Paid', 'Cancelled'].includes(po.status)).length,
        pendingInvoices: db.invoices.filter(inv => !['Paid', 'Cancelled'].includes(inv.status)).length,
        overBudgetCount: overBudgetLocations.length
      },
      budgetByCategory,
      actualByCategory,
      overBudgetLocations,
      recentTransactions: allTransactions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== BUDGETS =====

router.get('/budgets', (req, res) => {
  try {
    const db = getBudgetDatabase();
    const budgets = db.budgets.map(b => {
      const lineItems = db.budgetLineItems.filter(li => li.budgetId === b.id);
      const lineItemTotal = lineItems.reduce((sum, li) => sum + (li.amount || 0), 0);

      // Calculate actual spend for this budget's locations
      const locationNames = [...new Set(lineItems.map(li => li.locationName))];
      const actualSpend = db.purchaseOrders
        .filter(po => locationNames.includes(po.locationName) && po.status !== 'Cancelled')
        .reduce((sum, po) => sum + (po.amount || 0), 0);

      return {
        ...b,
        lineItemCount: lineItems.length,
        lineItemTotal,
        actualSpend,
        variance: b.totalBudget - actualSpend
      };
    });

    res.json(budgets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/budgets/:id', (req, res) => {
  try {
    const db = getBudgetDatabase();
    const budget = budgetFindById('budgets', req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget not found' });

    const lineItems = db.budgetLineItems.filter(li => li.budgetId === budget.id);

    // Group line items by location
    const byLocation = {};
    lineItems.forEach(li => {
      if (!byLocation[li.locationName]) {
        byLocation[li.locationName] = { items: [], total: 0 };
      }
      byLocation[li.locationName].items.push(li);
      byLocation[li.locationName].total += li.amount || 0;
    });

    // Group line items by category
    const byCategory = {};
    lineItems.forEach(li => {
      if (!byCategory[li.category]) {
        byCategory[li.category] = { items: [], total: 0 };
      }
      byCategory[li.category].items.push(li);
      byCategory[li.category].total += li.amount || 0;
    });

    const lineItemTotal = lineItems.reduce((sum, li) => sum + (li.amount || 0), 0);

    res.json({
      ...budget,
      lineItems,
      lineItemTotal,
      byLocation,
      byCategory
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/budgets', (req, res) => {
  try {
    const budget = budgetInsert('budgets', req.body);
    res.status(201).json(budget);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/budgets/:id', (req, res) => {
  try {
    const budget = budgetUpdate('budgets', req.params.id, req.body);
    if (!budget) return res.status(404).json({ error: 'Budget not found' });
    res.json(budget);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/budgets/:id', (req, res) => {
  try {
    // Also remove associated line items
    const db = getBudgetDatabase();
    db.budgetLineItems = db.budgetLineItems.filter(li => li.budgetId !== req.params.id);
    const removed = budgetRemove('budgets', req.params.id);
    if (!removed) return res.status(404).json({ error: 'Budget not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== BUDGET LINE ITEMS =====

router.get('/line-items', (req, res) => {
  try {
    const { budgetId, locationName, category } = req.query;
    let items = budgetFindAll('budgetLineItems');
    if (budgetId) items = items.filter(i => i.budgetId === budgetId);
    if (locationName) items = items.filter(i => i.locationName === locationName);
    if (category) items = items.filter(i => i.category === category);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/line-items', (req, res) => {
  try {
    const item = budgetInsert('budgetLineItems', req.body);
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/line-items/:id', (req, res) => {
  try {
    const item = budgetUpdate('budgetLineItems', req.params.id, req.body);
    if (!item) return res.status(404).json({ error: 'Line item not found' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/line-items/:id', (req, res) => {
  try {
    const removed = budgetRemove('budgetLineItems', req.params.id);
    if (!removed) return res.status(404).json({ error: 'Line item not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== LOCATIONS =====

router.get('/locations', (req, res) => {
  try {
    const db = getBudgetDatabase();
    const locations = db.locations.map(loc => {
      const budget = db.budgetLineItems
        .filter(li => li.locationName === loc.name)
        .reduce((sum, li) => sum + (li.amount || 0), 0);
      const actual = db.purchaseOrders
        .filter(po => po.locationName === loc.name && po.status !== 'Cancelled')
        .reduce((sum, po) => sum + (po.amount || 0), 0);
      const poCount = db.purchaseOrders.filter(po => po.locationName === loc.name).length;
      const invoiceCount = db.invoices.filter(inv => inv.locationName === loc.name).length;

      return {
        ...loc,
        budget,
        actual,
        variance: budget - actual,
        isOverBudget: actual > budget && budget > 0,
        poCount,
        invoiceCount
      };
    });
    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/locations/:id', (req, res) => {
  try {
    const db = getBudgetDatabase();
    const location = budgetFindById('locations', req.params.id);
    if (!location) return res.status(404).json({ error: 'Location not found' });

    const budgetItems = db.budgetLineItems.filter(li => li.locationName === location.name);
    const purchaseOrders = db.purchaseOrders.filter(po => po.locationName === location.name);
    const invoices = db.invoices.filter(inv => inv.locationName === location.name);
    const checkRequests = db.checkRequests.filter(cr => cr.locationName === location.name);

    const budget = budgetItems.reduce((sum, li) => sum + (li.amount || 0), 0);
    const actual = purchaseOrders
      .filter(po => po.status !== 'Cancelled')
      .reduce((sum, po) => sum + (po.amount || 0), 0);

    res.json({
      ...location,
      budget,
      actual,
      variance: budget - actual,
      budgetItems,
      purchaseOrders,
      invoices,
      checkRequests
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/locations', (req, res) => {
  try {
    const location = budgetInsert('locations', req.body);
    res.status(201).json(location);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/locations/:id', (req, res) => {
  try {
    const location = budgetUpdate('locations', req.params.id, req.body);
    if (!location) return res.status(404).json({ error: 'Location not found' });
    res.json(location);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/locations/:id', (req, res) => {
  try {
    const removed = budgetRemove('locations', req.params.id);
    if (!removed) return res.status(404).json({ error: 'Location not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PURCHASE ORDERS =====

router.get('/purchase-orders', (req, res) => {
  try {
    const { locationName, status } = req.query;
    let pos = budgetFindAll('purchaseOrders');
    if (locationName) pos = pos.filter(po => po.locationName === locationName);
    if (status) pos = pos.filter(po => po.status === status);
    pos.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    res.json(pos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/purchase-orders/:id', (req, res) => {
  try {
    const po = budgetFindById('purchaseOrders', req.params.id);
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    res.json(po);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/purchase-orders', (req, res) => {
  try {
    const po = budgetInsert('purchaseOrders', req.body);
    res.status(201).json(po);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/purchase-orders/:id', (req, res) => {
  try {
    const po = budgetUpdate('purchaseOrders', req.params.id, req.body);
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    res.json(po);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/purchase-orders/:id', (req, res) => {
  try {
    const removed = budgetRemove('purchaseOrders', req.params.id);
    if (!removed) return res.status(404).json({ error: 'Purchase order not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== INVOICES =====

router.get('/invoices', (req, res) => {
  try {
    const { locationName, status } = req.query;
    let invoices = budgetFindAll('invoices');
    if (locationName) invoices = invoices.filter(inv => inv.locationName === locationName);
    if (status) invoices = invoices.filter(inv => inv.status === status);
    invoices.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/invoices/:id', (req, res) => {
  try {
    const invoice = budgetFindById('invoices', req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/invoices', (req, res) => {
  try {
    const invoice = budgetInsert('invoices', req.body);
    res.status(201).json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/invoices/:id', (req, res) => {
  try {
    const invoice = budgetUpdate('invoices', req.params.id, req.body);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/invoices/:id', (req, res) => {
  try {
    const removed = budgetRemove('invoices', req.params.id);
    if (!removed) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== CHECK REQUESTS =====

router.get('/check-requests', (req, res) => {
  try {
    const { locationName, status } = req.query;
    let checks = budgetFindAll('checkRequests');
    if (locationName) checks = checks.filter(cr => cr.locationName === locationName);
    if (status) checks = checks.filter(cr => cr.status === status);
    checks.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    res.json(checks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/check-requests/:id', (req, res) => {
  try {
    const cr = budgetFindById('checkRequests', req.params.id);
    if (!cr) return res.status(404).json({ error: 'Check request not found' });
    res.json(cr);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/check-requests', (req, res) => {
  try {
    const cr = budgetInsert('checkRequests', req.body);
    res.status(201).json(cr);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/check-requests/:id', (req, res) => {
  try {
    const cr = budgetUpdate('checkRequests', req.params.id, req.body);
    if (!cr) return res.status(404).json({ error: 'Check request not found' });
    res.json(cr);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/check-requests/:id', (req, res) => {
  try {
    const removed = budgetRemove('checkRequests', req.params.id);
    if (!removed) return res.status(404).json({ error: 'Check request not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== META =====

router.get('/meta/categories', (req, res) => {
  res.json({ categories: COST_CATEGORIES });
});

router.get('/meta/statuses', (req, res) => {
  res.json({
    po: PO_STATUSES,
    invoice: INVOICE_STATUSES,
    check: CHECK_STATUSES,
    budget: BUDGET_STATUSES,
    location: LOCATION_STATUSES
  });
});

module.exports = router;
