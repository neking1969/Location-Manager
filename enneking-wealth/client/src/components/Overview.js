import React, { useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { formatCurrency, formatPercent } from '../hooks/usePortfolioData';
import LinkAccount from './LinkAccount';

const CHART_COLORS = {
  'Disney Equity': '#a855f7',
  'Fidelity': '#3b82f6',
  'Home Equity': '#22c55e',
  'MPIPHP IAP': '#14b8a6',
  'Merrill Lynch': '#f59e0b',
  'SPAXX Cash': '#6366f1',
  'Other': '#64748b',
};

export default function Overview({ data }) {
  const {
    portfolio,
    stockQuotes,
    config,
    rsuAwards,
    holdings,
    loading,
    refresh,
  } = data;

  const primaryStock = config?.primaryStock || 'DIS';
  const primaryQuote = stockQuotes[primaryStock];

  // Daily change from all positions with live quotes
  const dailyChange = (portfolio.allPositions || []).reduce((sum, p) => {
    const quote = stockQuotes[p.ticker];
    if (quote && p.type !== 'money_market') {
      return sum + (quote.change || 0) * (p.shares || 0);
    }
    return sum;
  }, 0);

  // Build chart data
  const chartData = Object.entries(portfolio.holdingsByCategory || {})
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const onAccountLinked = useCallback(() => {
    refresh();
  }, [refresh]);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading portfolio...
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <header className="header">
        <h1>Enneking Wealth</h1>
        <div className="header-values">
          <span className="header-net-worth">
            {formatCurrency(portfolio.netWorth)}
          </span>
          {dailyChange !== 0 && (
            <span className={`header-change ${dailyChange >= 0 ? 'positive' : 'negative'}`}>
              {dailyChange >= 0 ? '+' : ''}{formatCurrency(dailyChange)}
            </span>
          )}
          <span className="header-goal">
            {formatPercent(portfolio.goalProgress)} to goal
          </span>
        </div>

        {/* Stock ticker pill */}
        {primaryQuote && (
          <div className="stock-ticker">
            <span className="stock-ticker-logo">Disney</span>
            <span className="stock-ticker-price">
              ${primaryQuote.price?.toFixed(2)}
            </span>
            <span className={`stock-ticker-change ${primaryQuote.changePercent >= 0 ? 'positive' : 'negative'}`}>
              {primaryQuote.changePercent >= 0 ? '\u25B2' : '\u25BC'} {Math.abs(primaryQuote.changePercent || 0).toFixed(2)}%
            </span>
          </div>
        )}
      </header>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-label">Net Worth</span>
            <span className="summary-card-icon">$</span>
          </div>
          <div className="summary-card-value">{formatCurrency(portfolio.netWorth)}</div>
          <div className="summary-card-sub">Total assets</div>
        </div>

        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-label">Goal Progress</span>
            <span className="summary-card-icon">{'\u25CE'}</span>
          </div>
          <div className="summary-card-value">{formatPercent(portfolio.goalProgress)}</div>
          <div className="summary-card-sub">{formatCurrency(portfolio.goalRemaining)} to go</div>
        </div>

        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-label">Investable</span>
            <span className="summary-card-icon">{'\u2197'}</span>
          </div>
          <div className="summary-card-value">{formatCurrency(portfolio.investable)}</div>
          <div className="summary-card-sub">Liquid assets</div>
        </div>

        <div className={`summary-card ${portfolio.spaxxCash > portfolio.spaxxThreshold ? 'alert' : ''}`}>
          <div className="summary-card-header">
            <span className="summary-card-label">SPAXX Cash</span>
            {portfolio.spaxxCash > portfolio.spaxxThreshold && (
              <span className="alert-icon">{'\u26A0'}</span>
            )}
          </div>
          <div className="summary-card-value">{formatCurrency(portfolio.spaxxCash)}</div>
          <div className="summary-card-sub">
            {portfolio.spaxxCash > portfolio.spaxxThreshold ? 'Needs investing' : 'Money market'}
          </div>
        </div>
      </div>

      {/* Net Worth Breakdown Chart */}
      {chartData.length > 0 && (
        <div className="chart-section">
          <h2>Net Worth Breakdown</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={CHART_COLORS[entry.name] || CHART_COLORS.Other}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend">
            {chartData.map(entry => (
              <div key={entry.name} className="legend-item">
                <div
                  className="legend-dot"
                  style={{ backgroundColor: CHART_COLORS[entry.name] || CHART_COLORS.Other }}
                />
                {entry.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RSU Awards */}
      {rsuAwards.length > 0 && (
        <div className="rsu-section">
          <h2>RSU Awards</h2>
          <table className="rsu-table">
            <thead>
              <tr>
                <th>Grant Date</th>
                <th>Shares</th>
                <th>Vested</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {rsuAwards.map(award => {
                const price = primaryQuote?.price || 0;
                const vestedValue = (award.vestedShares || 0) * price;
                return (
                  <tr key={award.id}>
                    <td>{award.grantDate || '-'}</td>
                    <td>{award.totalShares || 0}</td>
                    <td className={award.vestedShares > 0 ? 'rsu-vested' : 'rsu-unvested'}>
                      {award.vestedShares || 0}
                    </td>
                    <td>{formatCurrency(vestedValue)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Holdings Detail */}
      {(portfolio.allPositions || []).length > 0 && (
        <div className="holdings-section">
          <h2>Holdings</h2>
          {(portfolio.allPositions || []).map((p, i) => {
            const quote = p.ticker ? stockQuotes[p.ticker] : null;
            return (
              <div className="holding-card" key={p.id || i}>
                <div className="holding-info">
                  <h3>{p.ticker || p.name}</h3>
                  <p>{p.shares} shares &middot; {p.institution}</p>
                </div>
                <div className="holding-value">
                  <div className="price">{formatCurrency(p.currentValue)}</div>
                  {quote && (
                    <div className={`change ${quote.changePercent >= 0 ? 'positive' : 'negative'}`}>
                      {quote.changePercent >= 0 ? '+' : ''}{quote.changePercent?.toFixed(2)}%
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Accounts & Import */}
      <div className="accounts-section">
        <h2>Accounts</h2>
        {(holdings.accounts || []).map(acct => (
          <div className="account-item" key={acct.id}>
            <div>
              <div className="account-name">{acct.name}</div>
              <div className="account-type">
                {acct.institution} &middot; {(acct.positions || []).length} positions
              </div>
            </div>
          </div>
        ))}
        <LinkAccount onSuccess={onAccountLinked} />
      </div>
    </div>
  );
}
