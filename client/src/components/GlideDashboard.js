import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function GlideDashboard() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    fetchGlideData();
  }, []);

  const fetchGlideData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_BASE}/api/glide/locations`);
      setData(response.data);
      setLastSync(new Date().toLocaleString());
    } catch (err) {
      console.error('Error fetching Glide data:', err);
      setError(err.message || 'Failed to fetch data from Glide');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    await fetchGlideData();
    setSyncing(false);
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem', color: 'var(--muted)' }}>Loading from Glide...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
        <button className="btn btn-primary" onClick={handleSync}>
          Retry
        </button>
      </div>
    );
  }

  const { locations, summary } = data || { locations: [], summary: {} };
  const overBudgetLocations = locations.filter(l => l.isOverBudget);
  const underBudgetLocations = locations.filter(l => !l.isOverBudget);

  return (
    <div>
      {/* Header with Sync Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '0.25rem' }}>Dashboard</h2>
          <p style={{ color: 'var(--muted)' }}>Budget reconciliation overview</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {lastSync && (
            <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
              Last synced: {lastSync}
            </span>
          )}
          <button
            className="btn btn-primary"
            onClick={handleSync}
            disabled={syncing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {syncing ? (
              <>
                <div className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }}></div>
                Syncing...
              </>
            ) : (
              <>
                🔄 Sync from Glide
              </>
            )}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-label">Total Budget</div>
          <div className="summary-value">{formatCurrency(summary.totalBudget || 0)}</div>
          <div className="summary-detail">{summary.totalLocations || 0} locations</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Total Actual</div>
          <div className="summary-value">{formatCurrency(summary.totalActual || 0)}</div>
          <div className="summary-detail">From POs & Invoices</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Variance</div>
          <div className={`summary-value ${(summary.totalBudget - summary.totalActual) >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency((summary.totalBudget || 0) - (summary.totalActual || 0))}
          </div>
          <div className="summary-detail">
            {(summary.totalBudget - summary.totalActual) >= 0 ? 'Under budget' : 'Over budget'}
          </div>
        </div>
        <div className={`summary-card ${summary.overBudgetCount > 0 ? 'over-budget' : 'under-budget'}`}>
          <div className="summary-label">Over Budget</div>
          <div className={`summary-value ${summary.overBudgetCount > 0 ? 'negative' : ''}`}>
            {summary.overBudgetCount || 0}
          </div>
          <div className="summary-detail">locations need attention</div>
        </div>
      </div>

      {/* Over Budget Locations */}
      {overBudgetLocations.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="card-header">
            <h3 className="card-title" style={{ color: 'var(--danger)' }}>
              ⚠️ Over Budget Locations ({overBudgetLocations.length})
            </h3>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Location</th>
                  <th style={{ textAlign: 'right' }}>Budget</th>
                  <th style={{ textAlign: 'right' }}>Actual</th>
                  <th style={{ textAlign: 'right' }}>Variance</th>
                  <th style={{ textAlign: 'right' }}>% Over</th>
                </tr>
              </thead>
              <tbody>
                {overBudgetLocations.map(loc => {
                  const percentOver = loc.budget > 0
                    ? Math.abs(((loc.actual - loc.budget) / loc.budget) * 100).toFixed(1)
                    : 'N/A';
                  return (
                    <tr key={loc.id} className="comparison-row over-budget">
                      <td><strong>{loc.name}</strong></td>
                      <td className="amount" style={{ textAlign: 'right' }}>{formatCurrency(loc.budget)}</td>
                      <td className="amount" style={{ textAlign: 'right' }}>{formatCurrency(loc.actual)}</td>
                      <td className="amount negative" style={{ textAlign: 'right' }}>{formatCurrency(loc.variance)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="badge badge-danger">{percentOver}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All Locations */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">All Locations ({locations.length})</h3>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Location</th>
                <th style={{ textAlign: 'right' }}>Budget</th>
                <th style={{ textAlign: 'right' }}>Actual</th>
                <th style={{ textAlign: 'right' }}>Variance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {locations.map(loc => (
                <tr key={loc.id} className={loc.isOverBudget ? 'comparison-row over-budget' : ''}>
                  <td><strong>{loc.name}</strong></td>
                  <td className="amount" style={{ textAlign: 'right' }}>{formatCurrency(loc.budget)}</td>
                  <td className="amount" style={{ textAlign: 'right' }}>{formatCurrency(loc.actual)}</td>
                  <td className={`amount ${loc.variance >= 0 ? 'positive' : 'negative'}`} style={{ textAlign: 'right' }}>
                    {loc.variance >= 0 ? '+' : ''}{formatCurrency(loc.variance)}
                  </td>
                  <td>
                    {loc.isOverBudget ? (
                      <span className="badge badge-danger">Over</span>
                    ) : (
                      <span className="badge badge-success">Under</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default GlideDashboard;
