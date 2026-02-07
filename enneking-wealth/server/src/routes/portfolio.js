const express = require('express');
const router = express.Router();
const { loadJSON, saveJSON } = require('../storage');

const PORTFOLIO_FILE = 'portfolio.json';

const defaultPortfolio = {
  goals: {
    targetNetWorth: 5595590,
    targetDate: '2035-12-31',
    label: 'Financial Independence',
  },
  manualAssets: [
    {
      id: 'home-equity',
      name: 'Home Equity',
      category: 'Home Equity',
      value: 0,
      updatedAt: null,
    },
  ],
  manualLiabilities: [],
  rsuAwards: [],
  pensionConfig: {
    plan: 'MPIPHP IAP',
    estimatedMonthly: 0,
    vestingDate: null,
  },
  watchlist: ['DIS'],
  primaryStock: 'DIS',
  spaxxThreshold: 50000,
};

async function loadPortfolio() {
  return loadJSON(PORTFOLIO_FILE, defaultPortfolio);
}

async function savePortfolio(data) {
  await saveJSON(PORTFOLIO_FILE, data);
}

// Get full portfolio config
router.get('/config', async (req, res) => {
  try {
    res.json(await loadPortfolio());
  } catch (err) {
    console.error('GET /portfolio/config error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update portfolio config
router.put('/config', async (req, res) => {
  try {
    const current = await loadPortfolio();
    const updated = { ...current, ...req.body, updatedAt: new Date().toISOString() };
    await savePortfolio(updated);
    res.json(updated);
  } catch (err) {
    console.error('PUT /portfolio/config error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get/update goals
router.get('/goals', async (req, res) => {
  try {
    const portfolio = await loadPortfolio();
    res.json(portfolio.goals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/goals', async (req, res) => {
  try {
    const portfolio = await loadPortfolio();
    portfolio.goals = { ...portfolio.goals, ...req.body };
    await savePortfolio(portfolio);
    res.json(portfolio.goals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual assets (home equity, etc.)
router.get('/manual-assets', async (req, res) => {
  try {
    const portfolio = await loadPortfolio();
    res.json(portfolio.manualAssets || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/manual-assets', async (req, res) => {
  try {
    const portfolio = await loadPortfolio();
    const asset = {
      id: `manual-${Date.now()}`,
      ...req.body,
      updatedAt: new Date().toISOString(),
    };
    portfolio.manualAssets = portfolio.manualAssets || [];
    portfolio.manualAssets.push(asset);
    await savePortfolio(portfolio);
    res.json(asset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/manual-assets/:id', async (req, res) => {
  try {
    const portfolio = await loadPortfolio();
    const idx = (portfolio.manualAssets || []).findIndex(a => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Asset not found' });
    portfolio.manualAssets[idx] = {
      ...portfolio.manualAssets[idx],
      ...req.body,
      updatedAt: new Date().toISOString(),
    };
    await savePortfolio(portfolio);
    res.json(portfolio.manualAssets[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/manual-assets/:id', async (req, res) => {
  try {
    const portfolio = await loadPortfolio();
    portfolio.manualAssets = (portfolio.manualAssets || []).filter(a => a.id !== req.params.id);
    await savePortfolio(portfolio);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// RSU Awards
router.get('/rsu-awards', async (req, res) => {
  try {
    const portfolio = await loadPortfolio();
    res.json(portfolio.rsuAwards || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/rsu-awards', async (req, res) => {
  try {
    const portfolio = await loadPortfolio();
    const award = {
      id: `rsu-${Date.now()}`,
      ...req.body,
      createdAt: new Date().toISOString(),
    };
    portfolio.rsuAwards = portfolio.rsuAwards || [];
    portfolio.rsuAwards.push(award);
    await savePortfolio(portfolio);
    res.json(award);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/rsu-awards/:id', async (req, res) => {
  try {
    const portfolio = await loadPortfolio();
    const idx = (portfolio.rsuAwards || []).findIndex(a => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'RSU award not found' });
    portfolio.rsuAwards[idx] = { ...portfolio.rsuAwards[idx], ...req.body };
    await savePortfolio(portfolio);
    res.json(portfolio.rsuAwards[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/rsu-awards/:id', async (req, res) => {
  try {
    const portfolio = await loadPortfolio();
    portfolio.rsuAwards = (portfolio.rsuAwards || []).filter(a => a.id !== req.params.id);
    await savePortfolio(portfolio);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pension config
router.get('/pension', async (req, res) => {
  try {
    const portfolio = await loadPortfolio();
    res.json(portfolio.pensionConfig || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/pension', async (req, res) => {
  try {
    const portfolio = await loadPortfolio();
    portfolio.pensionConfig = { ...portfolio.pensionConfig, ...req.body };
    await savePortfolio(portfolio);
    res.json(portfolio.pensionConfig);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
