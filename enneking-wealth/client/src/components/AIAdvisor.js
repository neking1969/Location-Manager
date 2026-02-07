import React, { useState, useMemo } from 'react';
import { formatCurrency, formatPercent } from '../hooks/usePortfolioData';

export default function AIAdvisor({ data }) {
  const { portfolio, stockQuotes, holdings, config } = data;
  const [expandedIdx, setExpandedIdx] = useState(null);

  const insights = useMemo(() => {
    const items = [];

    // SPAXX cash alert
    if (portfolio.spaxxCash > portfolio.spaxxThreshold) {
      const excess = portfolio.spaxxCash - portfolio.spaxxThreshold;
      items.push({
        type: 'warning',
        title: 'Excess Cash in SPAXX',
        summary: `${formatCurrency(portfolio.spaxxCash)} sitting in money market`,
        detail: `You have ${formatCurrency(excess)} above your ${formatCurrency(portfolio.spaxxThreshold)} cash threshold. Consider investing in index funds or your target allocation to put this money to work. At 10% annual returns, this could grow to ${formatCurrency(excess * 1.1)} in one year.`,
      });
    }

    // Goal progress
    if (portfolio.goalProgress < 50) {
      items.push({
        type: 'info',
        title: 'Goal Progress Update',
        summary: `${formatPercent(portfolio.goalProgress)} toward ${formatCurrency(portfolio.goalTarget)}`,
        detail: `You need ${formatCurrency(portfolio.goalRemaining)} more to reach your goal. At your current trajectory, consider increasing contributions or reviewing asset allocation for higher growth potential.`,
      });
    }

    // Concentration risk
    const categories = Object.entries(portfolio.holdingsByCategory || {});
    const totalValue = categories.reduce((sum, [, v]) => sum + v, 0);
    categories.forEach(([name, value]) => {
      const pct = totalValue > 0 ? (value / totalValue) * 100 : 0;
      if (pct > 40 && name !== 'Other') {
        items.push({
          type: 'warning',
          title: `High Concentration: ${name}`,
          summary: `${formatPercent(pct)} of net worth in ${name}`,
          detail: `Financial advisors typically recommend no single position exceed 20-30% of your portfolio. Consider gradually diversifying out of ${name} to reduce risk. Tax-loss harvesting or charitable giving of appreciated shares can help manage tax impact.`,
        });
      }
    });

    // Stock performance
    const primaryStock = config?.primaryStock || 'DIS';
    const quote = stockQuotes[primaryStock];
    if (quote) {
      const direction = quote.changePercent >= 0 ? 'up' : 'down';
      items.push({
        type: quote.changePercent >= 0 ? 'success' : 'info',
        title: `${primaryStock} Stock Update`,
        summary: `${direction} ${Math.abs(quote.changePercent).toFixed(2)}% today at $${quote.price?.toFixed(2)}`,
        detail: `${primaryStock} opened at $${quote.open?.toFixed(2)}, with a high of $${quote.high?.toFixed(2)} and low of $${quote.low?.toFixed(2)}. Previous close was $${quote.previousClose?.toFixed(2)}.`,
      });
    }

    // If no holdings linked yet
    if ((holdings || []).length === 0) {
      items.push({
        type: 'info',
        title: 'Link Your Accounts',
        summary: 'Connect Fidelity & Merrill Lynch for live data',
        detail: 'Go to the Overview tab and tap "Link account" to connect your brokerage accounts via Plaid. This enables real-time portfolio tracking, automated net worth calculation, and personalized insights.',
      });
    }

    if (items.length === 0) {
      items.push({
        type: 'success',
        title: 'Portfolio Looking Good',
        summary: 'No immediate action items detected',
        detail: 'Your portfolio allocation and cash levels are within recommended ranges. Continue monitoring and rebalance quarterly.',
      });
    }

    return items;
  }, [portfolio, stockQuotes, holdings, config]);

  const typeStyles = {
    warning: { border: 'var(--accent-yellow)', icon: '\u26A0\uFE0F' },
    info: { border: 'var(--accent-blue)', icon: '\u2139\uFE0F' },
    success: { border: 'var(--accent-green)', icon: '\u2705' },
  };

  return (
    <div className="page-container">
      <h1>AI Advisor</h1>
      {insights.map((insight, idx) => {
        const style = typeStyles[insight.type] || typeStyles.info;
        const expanded = expandedIdx === idx;
        return (
          <div
            key={idx}
            className="calc-card"
            style={{ borderLeftColor: style.border, borderLeftWidth: 3, cursor: 'pointer' }}
            onClick={() => setExpandedIdx(expanded ? null : idx)}
          >
            <h3>{style.icon} {insight.title}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
              {insight.summary}
            </p>
            {expanded && (
              <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6 }}>
                {insight.detail}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
