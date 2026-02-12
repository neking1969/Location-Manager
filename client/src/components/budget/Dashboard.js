import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || '';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
}

function Dashboard({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/api/budget-app/dashboard`);
      setData(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="screen-loading">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="screen-error">
        <p>Failed to load dashboard</p>
        <button className="btn btn-primary" onClick={fetchDashboard}>Retry</button>
      </div>
    );
  }

  const { summary, overBudgetLocations, recentTransactions, budgetByCategory } = data;
  const spentPercent = summary.totalBudget > 0
    ? Math.min(100, (summary.totalActual / summary.totalBudget) * 100)
    : 0;

  return (
    <div className="screen">
      <div className="screen-header">
        <h1 className="screen-title">The Shards S1</h1>
        <p className="screen-subtitle">Budget Overview</p>
      </div>

      {/* Summary Cards */}
      <div className="dash-cards">
        <div className="dash-card dash-card-primary">
          <div className="dash-card-label">Total Budget</div>
          <div className="dash-card-value">{formatCurrency(summary.totalBudget)}</div>
          <div className="dash-card-sub">{summary.totalBudgets} episodes</div>
        </div>

        <div className="dash-card">
          <div className="dash-card-label">Spent</div>
          <div className="dash-card-value">{formatCurrency(summary.totalActual)}</div>
          <div className="progress-bar" style={{ marginTop: '0.5rem' }}>
            <div
              className={`progress-fill ${spentPercent > 100 ? 'over' : spentPercent > 80 ? 'warning' : 'under'}`}
              style={{ width: `${Math.min(spentPercent, 100)}%` }}
            />
          </div>
          <div className="dash-card-sub">{spentPercent.toFixed(0)}% of budget</div>
        </div>

        <div className={`dash-card ${summary.variance >= 0 ? 'dash-card-success' : 'dash-card-danger'}`}>
          <div className="dash-card-label">Variance</div>
          <div className="dash-card-value">
            {summary.variance >= 0 ? '+' : ''}{formatCurrency(summary.variance)}
          </div>
          <div className="dash-card-sub">{summary.variance >= 0 ? 'Under budget' : 'Over budget'}</div>
        </div>

        <div className="dash-card">
          <div className="dash-card-label">Open Items</div>
          <div className="dash-card-value">{summary.activePOs + summary.pendingInvoices}</div>
          <div className="dash-card-sub">{summary.activePOs} POs, {summary.pendingInvoices} invoices</div>
        </div>
      </div>

      {/* Over Budget Alert */}
      {overBudgetLocations.length > 0 && (
        <div className="section">
          <div className="section-header">
            <h3 className="section-title danger-text">Over Budget ({overBudgetLocations.length})</h3>
          </div>
          <div className="list-items">
            {overBudgetLocations.map((loc, i) => (
              <div key={i} className="list-item list-item-danger">
                <div className="list-item-content">
                  <div className="list-item-title">{loc.name}</div>
                  <div className="list-item-subtitle">
                    Budget: {formatCurrency(loc.budget)} | Actual: {formatCurrency(loc.actual)}
                  </div>
                </div>
                <div className="list-item-value danger-text">
                  {formatCurrency(loc.variance)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spending by Category */}
      <div className="section">
        <div className="section-header">
          <h3 className="section-title">By Category</h3>
        </div>
        <div className="list-items">
          {Object.entries(budgetByCategory || {})
            .sort((a, b) => b[1] - a[1])
            .map(([category, amount]) => (
              <div key={category} className="list-item">
                <div className="list-item-content">
                  <div className="list-item-title">{category}</div>
                </div>
                <div className="list-item-value">{formatCurrency(amount)}</div>
              </div>
            ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="section">
        <div className="section-header">
          <h3 className="section-title">Recent Activity</h3>
        </div>
        <div className="list-items">
          {recentTransactions.map((tx, i) => (
            <div key={i} className="list-item">
              <div className="list-item-content">
                <div className="list-item-title">{tx.vendor || tx.payee || tx.description}</div>
                <div className="list-item-subtitle">
                  <span className={`inline-badge inline-badge-${tx.type === 'PO' ? 'info' : tx.type === 'Invoice' ? 'warning' : 'default'}`}>
                    {tx.type}
                  </span>
                  {' '}{tx.locationName} {tx.date ? `- ${tx.date}` : ''}
                </div>
              </div>
              <div className="list-item-value">{formatCurrency(tx.amount)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
