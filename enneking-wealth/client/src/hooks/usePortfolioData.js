import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../services/api';

export function usePortfolioData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [holdings, setHoldings] = useState({ accounts: [] });
  const [config, setConfig] = useState(null);
  const [stockQuotes, setStockQuotes] = useState({});
  const [rsuAwards, setRSUAwards] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const quotesRef = useRef({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [holdData, configData, rsuData] = await Promise.all([
        api.getHoldings().catch(() => ({ accounts: [] })),
        api.getPortfolioConfig().catch(() => null),
        api.getRSUAwards().catch(() => []),
      ]);

      setHoldings(holdData);
      setConfig(configData);
      setRSUAwards(rsuData);

      // Collect all tickers for live price updates
      const symbols = new Set();
      if (configData?.primaryStock) symbols.add(configData.primaryStock);
      if (configData?.watchlist) configData.watchlist.forEach(s => symbols.add(s));
      (holdData.accounts || []).forEach(acct => {
        (acct.positions || []).forEach(p => {
          if (p.ticker && p.type !== 'money_market') symbols.add(p.ticker);
        });
      });

      if (symbols.size > 0) {
        const quoteData = await api.getQuotes([...symbols]).catch(() => ({ quotes: {} }));
        const quotes = quoteData.quotes || {};
        setStockQuotes(quotes);
        quotesRef.current = quotes;
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
    const interval = setInterval(async () => {
      const symbols = Object.keys(quotesRef.current);
      if (symbols.length > 0) {
        try {
          const quoteData = await api.getQuotes(symbols);
          const quotes = quoteData.quotes || {};
          setStockQuotes(quotes);
          quotesRef.current = quotes;
        } catch (err) {
          // silent
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const computePortfolio = useCallback(() => {
    let totalValue = 0;
    let spaxxCash = 0;
    const holdingsByCategory = {};
    const allPositions = [];

    (holdings.accounts || []).forEach(acct => {
      (acct.positions || []).forEach(p => {
        const quote = p.ticker ? stockQuotes[p.ticker] : null;
        const price = quote?.price || p.lastPrice || 0;
        let value;
        if (p.type === 'money_market') {
          value = p.shares || p.currentValue || 0;
        } else if (p.ticker && p.shares > 0) {
          value = p.shares * price;
        } else {
          value = p.currentValue || 0;
        }

        totalValue += value;

        if (p.ticker === 'SPAXX' || p.type === 'money_market') {
          spaxxCash += value;
        }

        const category = categorizePosition(p, acct.institution);
        holdingsByCategory[category] = (holdingsByCategory[category] || 0) + value;

        allPositions.push({
          ...p,
          currentPrice: price,
          currentValue: value,
          gain: value - (p.costBasis || 0),
          institution: acct.institution,
          accountName: acct.name,
        });
      });
    });

    let manualTotal = 0;
    (config?.manualAssets || []).forEach(asset => {
      manualTotal += asset.value || 0;
      holdingsByCategory[asset.category || asset.name] =
        (holdingsByCategory[asset.category || asset.name] || 0) + (asset.value || 0);
    });

    const netWorth = totalValue + manualTotal;
    const goalTarget = config?.goals?.targetNetWorth || 5595590;
    const goalProgress = goalTarget > 0 ? (netWorth / goalTarget) * 100 : 0;
    const goalRemaining = Math.max(0, goalTarget - netWorth);

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
      allPositions,
      totalInvestments: totalValue,
    };
  }, [holdings, config, stockQuotes]);

  return {
    loading,
    error,
    holdings,
    config,
    stockQuotes,
    rsuAwards,
    lastUpdated,
    portfolio: computePortfolio(),
    refresh,
  };
}

function categorizePosition(position, institution) {
  const ticker = (position.ticker || '').toUpperCase();
  const name = (position.name || '').toUpperCase();

  if (ticker === 'DIS' || name.includes('DISNEY')) return 'Disney Equity';
  if (ticker === 'SPAXX' || position.type === 'money_market') return 'SPAXX Cash';
  if ((institution || '').toLowerCase().includes('fidelity')) return 'Fidelity';
  if ((institution || '').toLowerCase().includes('merrill')) return 'Merrill Lynch';
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
