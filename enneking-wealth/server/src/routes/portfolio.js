const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.LAMBDA_TASK_ROOT ? '/tmp' : path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'portfolio.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Default portfolio config
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

function loadPortfolio() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading portfolio:', err.message);
  }
  return { ...defaultPortfolio };
}

function savePortfolio(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Get full portfolio config
router.get('/config', (req, res) => {
  res.json(loadPortfolio());
});

// Update portfolio config
router.put('/config', (req, res) => {
  const current = loadPortfolio();
  const updated = { ...current, ...req.body, updatedAt: new Date().toISOString() };
  savePortfolio(updated);
  res.json(updated);
});

// Get/update goals
router.get('/goals', (req, res) => {
  const portfolio = loadPortfolio();
  res.json(portfolio.goals);
});

router.put('/goals', (req, res) => {
  const portfolio = loadPortfolio();
  portfolio.goals = { ...portfolio.goals, ...req.body };
  savePortfolio(portfolio);
  res.json(portfolio.goals);
});

// Manual assets (home equity, etc.)
router.get('/manual-assets', (req, res) => {
  const portfolio = loadPortfolio();
  res.json(portfolio.manualAssets || []);
});

router.post('/manual-assets', (req, res) => {
  const portfolio = loadPortfolio();
  const asset = {
    id: `manual-${Date.now()}`,
    ...req.body,
    updatedAt: new Date().toISOString(),
  };
  portfolio.manualAssets = portfolio.manualAssets || [];
  portfolio.manualAssets.push(asset);
  savePortfolio(portfolio);
  res.json(asset);
});

router.put('/manual-assets/:id', (req, res) => {
  const portfolio = loadPortfolio();
  const idx = (portfolio.manualAssets || []).findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Asset not found' });
  portfolio.manualAssets[idx] = {
    ...portfolio.manualAssets[idx],
    ...req.body,
    updatedAt: new Date().toISOString(),
  };
  savePortfolio(portfolio);
  res.json(portfolio.manualAssets[idx]);
});

router.delete('/manual-assets/:id', (req, res) => {
  const portfolio = loadPortfolio();
  portfolio.manualAssets = (portfolio.manualAssets || []).filter(a => a.id !== req.params.id);
  savePortfolio(portfolio);
  res.json({ success: true });
});

// RSU Awards
router.get('/rsu-awards', (req, res) => {
  const portfolio = loadPortfolio();
  res.json(portfolio.rsuAwards || []);
});

router.post('/rsu-awards', (req, res) => {
  const portfolio = loadPortfolio();
  const award = {
    id: `rsu-${Date.now()}`,
    ...req.body,
    createdAt: new Date().toISOString(),
  };
  portfolio.rsuAwards = portfolio.rsuAwards || [];
  portfolio.rsuAwards.push(award);
  savePortfolio(portfolio);
  res.json(award);
});

router.put('/rsu-awards/:id', (req, res) => {
  const portfolio = loadPortfolio();
  const idx = (portfolio.rsuAwards || []).findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'RSU award not found' });
  portfolio.rsuAwards[idx] = { ...portfolio.rsuAwards[idx], ...req.body };
  savePortfolio(portfolio);
  res.json(portfolio.rsuAwards[idx]);
});

router.delete('/rsu-awards/:id', (req, res) => {
  const portfolio = loadPortfolio();
  portfolio.rsuAwards = (portfolio.rsuAwards || []).filter(a => a.id !== req.params.id);
  savePortfolio(portfolio);
  res.json({ success: true });
});

// Pension config
router.get('/pension', (req, res) => {
  const portfolio = loadPortfolio();
  res.json(portfolio.pensionConfig || {});
});

router.put('/pension', (req, res) => {
  const portfolio = loadPortfolio();
  portfolio.pensionConfig = { ...portfolio.pensionConfig, ...req.body };
  savePortfolio(portfolio);
  res.json(portfolio.pensionConfig);
});

module.exports = router;
