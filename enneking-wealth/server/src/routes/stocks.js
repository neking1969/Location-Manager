const express = require('express');
const router = express.Router();
const NodeCache = require('node-cache');

// Cache stock data: quotes for 15s, daily for 5min
const quoteCache = new NodeCache({ stdTTL: 15 });
const dailyCache = new NodeCache({ stdTTL: 300 });

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const BASE_URL = 'https://finnhub.io/api/v1';

async function fetchFinnhub(endpoint, params = {}) {
  const query = new URLSearchParams({ ...params, token: FINNHUB_KEY }).toString();
  const response = await fetch(`${BASE_URL}${endpoint}?${query}`);
  if (!response.ok) throw new Error(`Finnhub API error: ${response.status}`);
  return response.json();
}

// Get real-time quote for a symbol
router.get('/quote/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const cached = quoteCache.get(symbol);
  if (cached) return res.json(cached);

  try {
    const data = await fetchFinnhub('/quote', { symbol });
    const quote = {
      symbol,
      price: data.c,
      change: data.d,
      changePercent: data.dp,
      high: data.h,
      low: data.l,
      open: data.o,
      previousClose: data.pc,
      timestamp: data.t * 1000,
    };
    quoteCache.set(symbol, quote);
    res.json(quote);
  } catch (error) {
    console.error(`Quote error for ${symbol}:`, error.message);
    res.status(500).json({ error: `Failed to fetch quote for ${symbol}` });
  }
});

// Get quotes for multiple symbols
router.post('/quotes', async (req, res) => {
  const { symbols } = req.body;
  if (!Array.isArray(symbols)) {
    return res.status(400).json({ error: 'symbols must be an array' });
  }

  const results = {};
  const fetchPromises = symbols.map(async (symbol) => {
    const sym = symbol.toUpperCase();
    const cached = quoteCache.get(sym);
    if (cached) {
      results[sym] = cached;
      return;
    }

    try {
      const data = await fetchFinnhub('/quote', { symbol: sym });
      const quote = {
        symbol: sym,
        price: data.c,
        change: data.d,
        changePercent: data.dp,
        high: data.h,
        low: data.l,
        open: data.o,
        previousClose: data.pc,
        timestamp: data.t * 1000,
      };
      quoteCache.set(sym, quote);
      results[sym] = quote;
    } catch (error) {
      results[sym] = { symbol: sym, error: error.message };
    }
  });

  await Promise.all(fetchPromises);
  res.json({ quotes: results });
});

// Get company profile
router.get('/profile/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    const data = await fetchFinnhub('/stock/profile2', { symbol });
    res.json({
      symbol,
      name: data.name,
      logo: data.logo,
      industry: data.finnhubIndustry,
      marketCap: data.marketCapitalization,
      exchange: data.exchange,
      currency: data.currency,
      weburl: data.weburl,
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch profile for ${symbol}` });
  }
});

// Search symbols
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query parameter q is required' });

  try {
    const data = await fetchFinnhub('/search', { q });
    res.json({
      results: (data.result || []).slice(0, 10).map(r => ({
        symbol: r.symbol,
        description: r.description,
        type: r.type,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
