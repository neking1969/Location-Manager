const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.LAMBDA_TASK_ROOT ? '/tmp' : path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'holdings.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadHoldings() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) { console.error('Error loading holdings:', err.message); }
  return { accounts: [], lastUpdated: null };
}

function saveHoldings(data) {
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Get all holdings
router.get('/', (req, res) => {
  res.json(loadHoldings());
});

// Add/update an account manually
router.post('/account', (req, res) => {
  const data = loadHoldings();
  const { name, institution, positions } = req.body;
  if (!name) return res.status(400).json({ error: 'Account name required' });

  const existing = data.accounts.findIndex(a => a.id === req.body.id);
  const account = {
    id: req.body.id || `acct-${Date.now()}`,
    name,
    institution: institution || '',
    positions: positions || [],
    updatedAt: new Date().toISOString(),
  };

  if (existing >= 0) {
    data.accounts[existing] = account;
  } else {
    data.accounts.push(account);
  }
  saveHoldings(data);
  res.json(account);
});

// Delete an account
router.delete('/account/:id', (req, res) => {
  const data = loadHoldings();
  data.accounts = data.accounts.filter(a => a.id !== req.params.id);
  saveHoldings(data);
  res.json({ success: true });
});

// Add a single position to an account
router.post('/account/:id/position', (req, res) => {
  const data = loadHoldings();
  const account = data.accounts.find(a => a.id === req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const position = {
    id: `pos-${Date.now()}`,
    ticker: (req.body.ticker || '').toUpperCase(),
    name: req.body.name || '',
    shares: Number(req.body.shares) || 0,
    costBasis: Number(req.body.costBasis) || 0,
    type: req.body.type || 'stock',
    addedAt: new Date().toISOString(),
  };
  account.positions.push(position);
  account.updatedAt = new Date().toISOString();
  saveHoldings(data);
  res.json(position);
});

// Update a position
router.put('/account/:accountId/position/:posId', (req, res) => {
  const data = loadHoldings();
  const account = data.accounts.find(a => a.id === req.params.accountId);
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const idx = account.positions.findIndex(p => p.id === req.params.posId);
  if (idx === -1) return res.status(404).json({ error: 'Position not found' });

  account.positions[idx] = { ...account.positions[idx], ...req.body, id: req.params.posId };
  account.updatedAt = new Date().toISOString();
  saveHoldings(data);
  res.json(account.positions[idx]);
});

// Delete a position
router.delete('/account/:accountId/position/:posId', (req, res) => {
  const data = loadHoldings();
  const account = data.accounts.find(a => a.id === req.params.accountId);
  if (!account) return res.status(404).json({ error: 'Account not found' });

  account.positions = account.positions.filter(p => p.id !== req.params.posId);
  account.updatedAt = new Date().toISOString();
  saveHoldings(data);
  res.json({ success: true });
});

// Import CSV from Fidelity
router.post('/import/fidelity', (req, res) => {
  try {
    const { csv, accountName } = req.body;
    if (!csv) return res.status(400).json({ error: 'CSV data required' });

    const positions = parseFidelityCSV(csv);
    const data = loadHoldings();

    const accountId = `fidelity-${Date.now()}`;
    data.accounts.push({
      id: accountId,
      name: accountName || 'Fidelity',
      institution: 'Fidelity',
      positions,
      updatedAt: new Date().toISOString(),
    });
    saveHoldings(data);
    res.json({ success: true, accountId, positionsImported: positions.length });
  } catch (err) {
    res.status(400).json({ error: `Failed to parse CSV: ${err.message}` });
  }
});

// Import CSV from Merrill Lynch / Merrill Edge
router.post('/import/merrill', (req, res) => {
  try {
    const { csv, accountName } = req.body;
    if (!csv) return res.status(400).json({ error: 'CSV data required' });

    const positions = parseMerrillCSV(csv);
    const data = loadHoldings();

    const accountId = `merrill-${Date.now()}`;
    data.accounts.push({
      id: accountId,
      name: accountName || 'Merrill Lynch',
      institution: 'Merrill Lynch',
      positions,
      updatedAt: new Date().toISOString(),
    });
    saveHoldings(data);
    res.json({ success: true, accountId, positionsImported: positions.length });
  } catch (err) {
    res.status(400).json({ error: `Failed to parse CSV: ${err.message}` });
  }
});

// Generic CSV import
router.post('/import/generic', (req, res) => {
  try {
    const { csv, accountName, institution } = req.body;
    if (!csv) return res.status(400).json({ error: 'CSV data required' });

    const positions = parseGenericCSV(csv);
    const data = loadHoldings();

    const accountId = `import-${Date.now()}`;
    data.accounts.push({
      id: accountId,
      name: accountName || institution || 'Imported Account',
      institution: institution || 'Other',
      positions,
      updatedAt: new Date().toISOString(),
    });
    saveHoldings(data);
    res.json({ success: true, accountId, positionsImported: positions.length });
  } catch (err) {
    res.status(400).json({ error: `Failed to parse CSV: ${err.message}` });
  }
});

// ---- CSV Parsers ----

function parseFidelityCSV(csv) {
  // Fidelity "Positions" export format:
  // Account Name/Number, Symbol, Description, Quantity, Last Price, Current Value, ...
  const lines = csv.trim().split('\n');
  const positions = [];

  // Find header row
  let headerIdx = lines.findIndex(line =>
    line.toLowerCase().includes('symbol') && line.toLowerCase().includes('quantity')
  );
  if (headerIdx === -1) headerIdx = 0;

  const headers = parseCSVLine(lines[headerIdx]).map(h => h.toLowerCase().trim());
  const symbolIdx = headers.findIndex(h => h.includes('symbol'));
  const descIdx = headers.findIndex(h => h.includes('description') || h.includes('name'));
  const qtyIdx = headers.findIndex(h => h.includes('quantity') || h.includes('shares'));
  const priceIdx = headers.findIndex(h => h.includes('last price') || h.includes('price'));
  const valueIdx = headers.findIndex(h => h.includes('current value') || h.includes('value'));
  const costIdx = headers.findIndex(h => h.includes('cost basis') || h.includes('cost'));

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 3) continue;

    const ticker = (cols[symbolIdx] || '').replace(/[^A-Z]/gi, '').toUpperCase();
    if (!ticker || ticker === 'CASHEQUIV' || ticker === 'PENDING') continue;

    const shares = parseNumber(cols[qtyIdx]);
    if (shares === 0) continue;

    positions.push({
      id: `pos-${Date.now()}-${i}`,
      ticker,
      name: cols[descIdx] || ticker,
      shares,
      costBasis: parseNumber(cols[costIdx]),
      lastPrice: parseNumber(cols[priceIdx]),
      currentValue: parseNumber(cols[valueIdx]),
      type: ticker === 'SPAXX' ? 'money_market' : 'stock',
      addedAt: new Date().toISOString(),
    });
  }

  return positions;
}

function parseMerrillCSV(csv) {
  // Merrill Edge / Merrill Lynch export format:
  // Symbol, Description, Quantity, Price, Value, ...
  const lines = csv.trim().split('\n');
  const positions = [];

  let headerIdx = lines.findIndex(line =>
    line.toLowerCase().includes('symbol') &&
    (line.toLowerCase().includes('quantity') || line.toLowerCase().includes('shares'))
  );
  if (headerIdx === -1) headerIdx = 0;

  const headers = parseCSVLine(lines[headerIdx]).map(h => h.toLowerCase().trim());
  const symbolIdx = Math.max(0, headers.findIndex(h => h.includes('symbol') || h.includes('ticker')));
  const descIdx = headers.findIndex(h => h.includes('description') || h.includes('name'));
  const qtyIdx = headers.findIndex(h => h.includes('quantity') || h.includes('shares'));
  const priceIdx = headers.findIndex(h => h.includes('price'));
  const valueIdx = headers.findIndex(h => h.includes('value') || h.includes('market'));
  const costIdx = headers.findIndex(h => h.includes('cost'));

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 3) continue;

    const ticker = (cols[symbolIdx] || '').replace(/[^A-Z]/gi, '').toUpperCase();
    if (!ticker || ticker.length > 6) continue;

    const shares = parseNumber(cols[qtyIdx]);
    if (shares === 0) continue;

    positions.push({
      id: `pos-${Date.now()}-${i}`,
      ticker,
      name: descIdx >= 0 ? (cols[descIdx] || ticker) : ticker,
      shares,
      costBasis: costIdx >= 0 ? parseNumber(cols[costIdx]) : 0,
      lastPrice: priceIdx >= 0 ? parseNumber(cols[priceIdx]) : 0,
      currentValue: valueIdx >= 0 ? parseNumber(cols[valueIdx]) : 0,
      type: 'stock',
      addedAt: new Date().toISOString(),
    });
  }

  return positions;
}

function parseGenericCSV(csv) {
  const lines = csv.trim().split('\n');
  const positions = [];
  if (lines.length < 2) return positions;

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const symbolIdx = headers.findIndex(h => h.includes('symbol') || h.includes('ticker'));
  const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('description'));
  const qtyIdx = headers.findIndex(h => h.includes('quantity') || h.includes('shares'));
  const priceIdx = headers.findIndex(h => h.includes('price'));
  const costIdx = headers.findIndex(h => h.includes('cost'));

  if (symbolIdx === -1 || qtyIdx === -1) {
    throw new Error('CSV must have Symbol/Ticker and Quantity/Shares columns');
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const ticker = (cols[symbolIdx] || '').toUpperCase().trim();
    if (!ticker) continue;

    positions.push({
      id: `pos-${Date.now()}-${i}`,
      ticker,
      name: nameIdx >= 0 ? (cols[nameIdx] || ticker) : ticker,
      shares: parseNumber(cols[qtyIdx]),
      costBasis: costIdx >= 0 ? parseNumber(cols[costIdx]) : 0,
      lastPrice: priceIdx >= 0 ? parseNumber(cols[priceIdx]) : 0,
      type: 'stock',
      addedAt: new Date().toISOString(),
    });
  }

  return positions;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseNumber(str) {
  if (!str) return 0;
  const cleaned = String(str).replace(/[$,%\s]/g, '').replace(/\((.+)\)/, '-$1');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

module.exports = router;
