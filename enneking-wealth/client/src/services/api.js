const API_BASE = process.env.REACT_APP_API_URL || '';

async function fetchApi(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || 'API request failed');
  }
  return res.json();
}

// Plaid
export const createLinkToken = () => fetchApi('/api/plaid/link-token', { method: 'POST' });
export const exchangeToken = (publicToken, institution) =>
  fetchApi('/api/plaid/exchange-token', {
    method: 'POST',
    body: JSON.stringify({ public_token: publicToken, institution }),
  });
export const getAccounts = () => fetchApi('/api/plaid/accounts');
export const getHoldings = () => fetchApi('/api/plaid/holdings');
export const getInstitutions = () => fetchApi('/api/plaid/institutions');
export const removeAccount = (itemId) =>
  fetchApi(`/api/plaid/accounts/${itemId}`, { method: 'DELETE' });

// Stock prices
export const getQuote = (symbol) => fetchApi(`/api/stocks/quote/${symbol}`);
export const getQuotes = (symbols) =>
  fetchApi('/api/stocks/quotes', {
    method: 'POST',
    body: JSON.stringify({ symbols }),
  });
export const getProfile = (symbol) => fetchApi(`/api/stocks/profile/${symbol}`);
export const searchStocks = (q) => fetchApi(`/api/stocks/search?q=${encodeURIComponent(q)}`);

// Portfolio
export const getPortfolioConfig = () => fetchApi('/api/portfolio/config');
export const updatePortfolioConfig = (data) =>
  fetchApi('/api/portfolio/config', { method: 'PUT', body: JSON.stringify(data) });
export const getGoals = () => fetchApi('/api/portfolio/goals');
export const updateGoals = (data) =>
  fetchApi('/api/portfolio/goals', { method: 'PUT', body: JSON.stringify(data) });
export const getManualAssets = () => fetchApi('/api/portfolio/manual-assets');
export const addManualAsset = (data) =>
  fetchApi('/api/portfolio/manual-assets', { method: 'POST', body: JSON.stringify(data) });
export const updateManualAsset = (id, data) =>
  fetchApi(`/api/portfolio/manual-assets/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteManualAsset = (id) =>
  fetchApi(`/api/portfolio/manual-assets/${id}`, { method: 'DELETE' });
export const getRSUAwards = () => fetchApi('/api/portfolio/rsu-awards');
export const addRSUAward = (data) =>
  fetchApi('/api/portfolio/rsu-awards', { method: 'POST', body: JSON.stringify(data) });
export const updateRSUAward = (id, data) =>
  fetchApi(`/api/portfolio/rsu-awards/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteRSUAward = (id) =>
  fetchApi(`/api/portfolio/rsu-awards/${id}`, { method: 'DELETE' });
export const getPension = () => fetchApi('/api/portfolio/pension');
export const updatePension = (data) =>
  fetchApi('/api/portfolio/pension', { method: 'PUT', body: JSON.stringify(data) });
