import { useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';

export function usePortfolioData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [config, setConfig] = useState(null);
  const [stockQuotes, setStockQuotes] = useState({});
  const [rsuAwards, setRSUAwards] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [acctData, holdData, instData, configData, rsuData] = await Promise.all([
        api.getAccounts().catch(() => ({ accounts: [] })),
        api.getHoldings().catch(() => ({ holdings: [] })),
        api.getInstitutions().catch(() => ({ institutions: [] })),
        api.getPortfolioConfig().catch(() => null),
        api.getRSUAwards().catch(() => []),
      ]);

      setAccounts(acctData.accounts || []);
      setHoldings(holdData.holdings || []);
      setInstitutions(instData.institutions || []);
      setConfig(configData);
      setRSUAwards(rsuData);

      // Collect all stock symbols from holdings + watchlist
      const symbols = new Set();
      if (configData?.primaryStock) symbols.add(configData.primaryStock);
      if (configData?.watchlist) configData.watchlist.forEach(s => symbols.add(s));
      (holdData.holdings || []).forEach(inst => {
        (inst.holdings || []).forEach(h => {
          if (h.ticker) symbols.add(h.ticker);
        });
      });

      if (symbols.size > 0) {
        const quoteData = await api.getQuotes([...symbols]).catch(() => ({ quotes: {} }));
        setStockQuotes(quoteData.quotes || {});
      }

      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Refresh quotes every 30 seconds
    const interval = setInterval(async () => {
      const symbols = Object.keys(stockQuotes);
      if (symbols.length > 0) {
        try {
          const quoteData = await api.getQuotes(symbols);
          setStockQuotes(quoteData.quotes || {});
        } catch (err) {
          // Silently fail quote refresh
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line
  }, []);

  // Compute aggregated values
  const computePortfolio = useCallback(() => {
    let investmentValue = 0;
    let spaxxCash = 0;
    const holdingsByCategory = {};

    // Sum investment holdings
    holdings.forEach(inst => {
      (inst.holdings || []).forEach(h => {
        const value = h.value || (h.quantity * h.price) || 0;
        investmentValue += value;

        // Identify SPAXX (Fidelity money market)
        if (h.ticker === 'SPAXX' || (h.name && h.name.includes('GOVERNMENT MONEY'))) {
          spaxxCash += value;
        }

        // Categorize
        const category = categorizeHolding(h, inst.institution);
        holdingsByCategory[category] = (holdingsByCategory[category] || 0) + value;
      });
    });

    // Add manual assets
    let manualTotal = 0;
    (config?.manualAssets || []).forEach(asset => {
      manualTotal += asset.value || 0;
      holdingsByCategory[asset.category || asset.name] =
        (holdingsByCategory[asset.category || asset.name] || 0) + (asset.value || 0);
    });

    const netWorth = investmentValue + manualTotal;
    const goalTarget = config?.goals?.targetNetWorth || 5595590;
    const goalProgress = goalTarget > 0 ? (netWorth / goalTarget) * 100 : 0;
    const goalRemaining = Math.max(0, goalTarget - netWorth);

    // Investable = liquid assets (investments minus home equity and other illiquid)
    const illiquidCategories = ['Home Equity'];
    const investable = Object.entries(holdingsByCategory)
      .filter(([cat]) => !illiquidCategories.includes(cat))
      .reduce((sum, [, val]) => sum + val, 0);

    return {
      netWorth,
      goalProgress,
      goalRemaining,
      goalTarget,
      investable,
      spaxxCash,
      spaxxThreshold: config?.spaxxThreshold || 50000,
      holdingsByCategory,
      totalInvestments: investmentValue,
    };
  }, [holdings, config]);

  return {
    loading,
    error,
    accounts,
    holdings,
    institutions,
    config,
    stockQuotes,
    rsuAwards,
    lastUpdated,
    portfolio: computePortfolio(),
    refresh,
  };
}

function categorizeHolding(holding, institution) {
  const ticker = (holding.ticker || '').toUpperCase();
  const name = (holding.name || '').toUpperCase();

  if (ticker === 'DIS' || name.includes('DISNEY')) return 'Disney Equity';
  if (ticker === 'SPAXX' || name.includes('GOVERNMENT MONEY')) return 'SPAXX Cash';
  if (institution?.toLowerCase().includes('fidelity')) return 'Fidelity';
  if (institution?.toLowerCase().includes('merrill')) return 'Merrill Lynch';
  return institution || 'Other';
}

export function formatCurrency(value, decimals = 0) {
  if (value == null || isNaN(value)) return '$0';
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
}

export function formatPercent(value, decimals = 1) {
  if (value == null || isNaN(value)) return '0%';
  return `${value.toFixed(decimals)}%`;
}
