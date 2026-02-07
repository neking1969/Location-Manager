import React, { useCallback, useState } from 'react';
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

  const [selectedSlice, setSelectedSlice] = useState(null);

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
          <div className="chart-container" onClick={(e) => {
            // Close detail if tapping the container background
            if (e.target === e.currentTarget) setSelectedSlice(null);
          }}>
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
                  onClick={(_, index) => {
                    setSelectedSlice(selectedSlice === index ? null : index);
                  }}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={CHART_COLORS[entry.name] || CHART_COLORS.Other}
                      stroke={selectedSlice === index ? '#fff' : 'transparent'}
                      strokeWidth={selectedSlice === index ? 3 : 0}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Center label when slice selected */}
            {selectedSlice !== null && chartData[selectedSlice] && (
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center', pointerEvents: 'none',
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formatCurrency(chartData[selectedSlice].value)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {((chartData[selectedSlice].value / portfolio.netWorth) * 100).toFixed(1)}%
                </div>
              </div>
            )}
          </div>

          {/* Legend - tappable */}
          <div className="chart-legend">
            {chartData.map((entry, index) => (
              <div
                key={entry.name}
                className="legend-item"
                onClick={() => setSelectedSlice(selectedSlice === index ? null : index)}
                style={{
                  cursor: 'pointer',
                  opacity: selectedSlice !== null && selectedSlice !== index ? 0.4 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                <div
                  className="legend-dot"
                  style={{ backgroundColor: CHART_COLORS[entry.name] || CHART_COLORS.Other }}
                />
                {entry.name}
              </div>
            ))}
          </div>

          {/* Detail panel for selected slice */}
          {selectedSlice !== null && chartData[selectedSlice] && (() => {
            const selected = chartData[selectedSlice];
            const categoryPositions = (portfolio.allPositions || []).filter(
              p => {
                const cat = categorizeForChart(p);
                return cat === selected.name;
              }
            );
            const manualAssets = (config?.manualAssets || []).filter(
              a => (a.category || a.name) === selected.name
            );
            const pct = ((selected.value / portfolio.netWorth) * 100).toFixed(1);

            return (
              <div style={{
                background: 'var(--bg-card)', borderRadius: 12,
                padding: 16, marginTop: 12,
                border: `1px solid ${CHART_COLORS[selected.name] || CHART_COLORS.Other}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: CHART_COLORS[selected.name] || CHART_COLORS.Other }}>
                      {selected.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pct}% of net worth</div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{formatCurrency(selected.value)}</div>
                </div>

                {categoryPositions.length > 0 && categoryPositions.map((p, i) => (
                  <div key={p.id || i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 0',
                    borderTop: i === 0 ? '1px solid var(--border)' : 'none',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{p.ticker || p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {p.shares > 0 ? `${p.shares} shares` : p.accountName || p.institution}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{formatCurrency(p.currentValue)}</div>
                      {p.gain !== 0 && p.costBasis > 0 && (
                        <div style={{ fontSize: 11, color: p.gain >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                          {p.gain >= 0 ? '+' : ''}{formatCurrency(p.gain)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {manualAssets.length > 0 && manualAssets.map((a, i) => (
                  <div key={a.id || i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 0',
                    borderTop: categoryPositions.length === 0 && i === 0 ? '1px solid var(--border)' : 'none',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{a.name}</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{formatCurrency(a.value)}</div>
                  </div>
                ))}

                <button
                  onClick={() => setSelectedSlice(null)}
                  style={{
                    marginTop: 10, width: '100%', padding: 8,
                    background: 'none', border: '1px solid var(--border)',
                    borderRadius: 8, color: 'var(--text-muted)',
                    cursor: 'pointer', fontSize: 13,
                  }}
                >
                  Close
                </button>
              </div>
            );
          })()}
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
                  <p>
                    {p.shares > 0 ? `${p.shares} shares · ` : ''}
                    {p.institution}
                    {p.type === 'retirement' ? ' · Retirement' : ''}
                  </p>
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

function categorizeForChart(position) {
  const ticker = (position.ticker || '').toUpperCase();
  const name = (position.name || '').toUpperCase();
  if (ticker === 'DIS' || name.includes('DISNEY')) return 'Disney Equity';
  if (ticker === 'SPAXX' || position.type === 'money_market') return 'SPAXX Cash';
  if ((position.institution || '').toLowerCase().includes('fidelity')) return 'Fidelity';
  if ((position.institution || '').toLowerCase().includes('merrill')) return 'Merrill Lynch';
  return position.institution || 'Other';
}
