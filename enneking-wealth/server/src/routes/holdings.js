const express = require('express');
const router = express.Router();
const { loadJSON, saveJSON } = require('../storage');

const HOLDINGS_FILE = 'holdings.json';
const DEFAULT_HOLDINGS = { accounts: [], lastUpdated: null };

async function loadHoldings() {
  return loadJSON(HOLDINGS_FILE, DEFAULT_HOLDINGS);
}

async function saveHoldings(data) {
  data.lastUpdated = new Date().toISOString();
  await saveJSON(HOLDINGS_FILE, data);
}

// Get all holdings
router.get('/', async (req, res) => {
  try {
    res.json(await loadHoldings());
  } catch (err) {
    console.error('GET /holdings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add/update an account manually
router.post('/account', async (req, res) => {
  try {
    const data = await loadHoldings();
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
    await saveHoldings(data);
    res.json(account);
  } catch (err) {
    console.error('POST /holdings/account error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete an account
router.delete('/account/:id', async (req, res) => {
  try {
    const data = await loadHoldings();
    data.accounts = data.accounts.filter(a => a.id !== req.params.id);
    await saveHoldings(data);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /holdings/account error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add a single position to an account
router.post('/account/:id/position', async (req, res) => {
  try {
    const data = await loadHoldings();
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
    await saveHoldings(data);
    res.json(position);
  } catch (err) {
    console.error('POST /holdings/account/:id/position error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update a position
router.put('/account/:accountId/position/:posId', async (req, res) => {
  try {
    const data = await loadHoldings();
    const account = data.accounts.find(a => a.id === req.params.accountId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const idx = account.positions.findIndex(p => p.id === req.params.posId);
    if (idx === -1) return res.status(404).json({ error: 'Position not found' });

    account.positions[idx] = { ...account.positions[idx], ...req.body, id: req.params.posId };
    account.updatedAt = new Date().toISOString();
    await saveHoldings(data);
    res.json(account.positions[idx]);
  } catch (err) {
    console.error('PUT /holdings position error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a position
router.delete('/account/:accountId/position/:posId', async (req, res) => {
  try {
    const data = await loadHoldings();
    const account = data.accounts.find(a => a.id === req.params.accountId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    account.positions = account.positions.filter(p => p.id !== req.params.posId);
    account.updatedAt = new Date().toISOString();
    await saveHoldings(data);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /holdings position error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Import CSV from Fidelity
router.post('/import/fidelity', async (req, res) => {
  try {
    const { csv, accountName } = req.body;
    if (!csv) return res.status(400).json({ error: 'CSV data required' });

    const positions = parseFidelityCSV(csv);
    const data = await loadHoldings();

    const accountId = `fidelity-${Date.now()}`;
    data.accounts.push({
      id: accountId,
      name: accountName || 'Fidelity',
      institution: 'Fidelity',
      positions,
      updatedAt: new Date().toISOString(),
    });
    await saveHoldings(data);
    res.json({ success: true, accountId, positionsImported: positions.length });
  } catch (err) {
    res.status(400).json({ error: `Failed to parse CSV: ${err.message}` });
  }
});

// Import CSV from Merrill Lynch / Merrill Edge
router.post('/import/merrill', async (req, res) => {
  try {
    const { csv, accountName } = req.body;
    if (!csv) return res.status(400).json({ error: 'CSV data required' });

    const positions = parseMerrillCSV(csv);
    const data = await loadHoldings();

    const accountId = `merrill-${Date.now()}`;
    data.accounts.push({
      id: accountId,
      name: accountName || 'Merrill Lynch',
      institution: 'Merrill Lynch',
      positions,
      updatedAt: new Date().toISOString(),
    });
    await saveHoldings(data);
    res.json({ success: true, accountId, positionsImported: positions.length });
  } catch (err) {
    res.status(400).json({ error: `Failed to parse CSV: ${err.message}` });
  }
});

// Generic CSV import
router.post('/import/generic', async (req, res) => {
  try {
    const { csv, accountName, institution } = req.body;
    if (!csv) return res.status(400).json({ error: 'CSV data required' });

    const positions = parseGenericCSV(csv);
    const data = await loadHoldings();

    const accountId = `import-${Date.now()}`;
    data.accounts.push({
      id: accountId,
      name: accountName || institution || 'Imported Account',
      institution: institution || 'Other',
      positions,
      updatedAt: new Date().toISOString(),
    });
    await saveHoldings(data);
    res.json({ success: true, accountId, positionsImported: positions.length });
  } catch (err) {
    res.status(400).json({ error: `Failed to parse CSV: ${err.message}` });
  }
});

// ---- CSV Parsers ----

function parseFidelityCSV(csv) {
  const lines = csv.trim().split('\n');
  const positions = [];

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

// Import from iOS screenshot using Claude Vision
router.post('/import/screenshot', async (req, res) => {
  try {
    const { image, accountName, institution } = req.body;
    if (!image) return res.status(400).json({ error: 'Image data required' });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Anthropic API key not configured' });

    // Strip data URL prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const mediaType = image.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64Data },
            },
            {
              type: 'text',
              text: `Extract all investment holdings from this brokerage screenshot. Return ONLY valid JSON, no other text.

Format:
{
  "institution": "Fidelity" or "Merrill Lynch" or detected institution name,
  "positions": [
    {
      "ticker": "AAPL",
      "name": "Apple Inc",
      "shares": 100,
      "lastPrice": 150.25,
      "currentValue": 15025.00,
      "costBasis": 12000.00,
      "type": "stock"
    }
  ]
}

Rules:
- For money market funds like SPAXX/FCASH, set type to "money_market" and shares to the dollar value
- If you can see ticker symbols, always include them
- If cost basis isn't visible, set to 0
- Parse all dollar amounts as numbers (no $ or commas)
- Include every position visible in the screenshot
- If this doesn't look like a brokerage/investment screenshot, return {"error": "not_a_portfolio", "message": "description of what the image shows"}`,
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Claude API error:', response.status, errBody);
      return res.status(500).json({ error: 'Failed to analyze screenshot' });
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || '';

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(400).json({ error: 'Could not parse holdings from screenshot' });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.error === 'not_a_portfolio') {
      return res.status(400).json({ error: parsed.message || 'Not a portfolio screenshot' });
    }

    // Save to holdings
    const positions = (parsed.positions || []).map((p, i) => ({
      id: `pos-${Date.now()}-${i}`,
      ticker: (p.ticker || '').toUpperCase(),
      name: p.name || p.ticker || '',
      shares: Number(p.shares) || 0,
      lastPrice: Number(p.lastPrice) || 0,
      currentValue: Number(p.currentValue) || 0,
      costBasis: Number(p.costBasis) || 0,
      type: p.type || 'stock',
      addedAt: new Date().toISOString(),
    }));

    const data = await loadHoldings();
    const accountId = `screenshot-${Date.now()}`;
    data.accounts.push({
      id: accountId,
      name: accountName || parsed.institution || institution || 'Imported',
      institution: parsed.institution || institution || 'Unknown',
      positions,
      updatedAt: new Date().toISOString(),
    });
    await saveHoldings(data);

    res.json({
      success: true,
      accountId,
      institution: parsed.institution,
      positionsImported: positions.length,
      positions,
    });
  } catch (err) {
    console.error('Screenshot import error:', err);
    res.status(500).json({ error: `Failed to process screenshot: ${err.message}` });
  }
});

module.exports = router;
