import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';

function SetDetail() {
  const { setId } = useParams();
  const navigate = useNavigate();
  const [setData, setSetData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSetData = useCallback(async () => {
    try {
      const response = await api.get(`/api/reports/set/${setId}`);
      setSetData(response.data);
    } catch (error) {
      console.error('Error fetching set:', error);
    } finally {
      setLoading(false);
    }
  }, [setId]);

  useEffect(() => {
    fetchSetData();
  }, [fetchSetData]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  if (!setData) {
    return <div className="alert alert-error">Set not found</div>;
  }

  const { set, categories, totals } = setData;

  return (
    <div>
      <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ marginBottom: '1rem' }}>
        Back
      </button>

      <div className="card">
        <h2 style={{ marginBottom: '0.5rem' }}>{set.set_name}</h2>
        {set.location && <p style={{ color: 'var(--gray-500)' }}>{set.location}</p>}
        {set.episode_name && <p style={{ fontSize: '0.875rem' }}>Episode: {set.episode_name}</p>}
      </div>

      <div className="summary-grid" style={{ marginTop: '1.5rem' }}>
        <div className="summary-card">
          <div className="summary-label">Total Budget</div>
          <div className="summary-value">{formatCurrency(totals.budget)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Total Actual</div>
          <div className="summary-value">{formatCurrency(totals.actual)}</div>
        </div>
        <div className={`summary-card ${totals.actual > totals.budget ? 'over-budget' : 'under-budget'}`}>
          <div className="summary-label">Variance</div>
          <div className={`summary-value ${totals.actual > totals.budget ? 'negative' : 'positive'}`}>
            {formatCurrency(totals.budget - totals.actual)}
          </div>
        </div>
      </div>

      {categories.map(cat => (
        <div key={cat.category} className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h3 className="card-title">{cat.category}</h3>
            <div style={{ textAlign: 'right' }}>
              <div>Budget: {formatCurrency(cat.budget)}</div>
              <div>Actual: {formatCurrency(cat.actual)}</div>
              <div className={cat.variance < 0 ? 'negative' : 'positive'}>
                Variance: {formatCurrency(cat.variance)}
              </div>
            </div>
          </div>

          {cat.entries.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Vendor</th>
                  <th>Invoice #</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {cat.entries.map(entry => (
                  <tr key={entry.id}>
                    <td>{entry.date || '-'}</td>
                    <td>{entry.description || '-'}</td>
                    <td>{entry.vendor || '-'}</td>
                    <td>{entry.invoice_number || '-'}</td>
                    <td className="amount">{formatCurrency(entry.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: 'var(--gray-500)' }}>No entries</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default SetDetail;
