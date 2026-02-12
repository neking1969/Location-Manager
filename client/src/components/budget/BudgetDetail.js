import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || '';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(amount || 0);
}

function BudgetDetail({ budgetId, onBack, onNavigate }) {
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('location'); // 'location' or 'category'
  const [showAddLine, setShowAddLine] = useState(false);
  const [lineForm, setLineForm] = useState({
    locationName: '', category: 'Location Fees', amount: '', description: '', notes: ''
  });

  useEffect(() => {
    fetchBudget();
  }, [budgetId]);

  const fetchBudget = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/api/budget-app/budgets/${budgetId}`);
      setBudget(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLine = async () => {
    try {
      await axios.post(`${API}/api/budget-app/line-items`, {
        ...lineForm,
        budgetId,
        amount: parseFloat(lineForm.amount) || 0
      });
      setShowAddLine(false);
      setLineForm({ locationName: '', category: 'Location Fees', amount: '', description: '', notes: '' });
      fetchBudget();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteLine = async (lineId) => {
    if (!window.confirm('Delete this line item?')) return;
    try {
      await axios.delete(`${API}/api/budget-app/line-items/${lineId}`);
      fetchBudget();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="screen-loading"><div className="spinner"></div><p>Loading budget...</p></div>;
  }

  if (!budget) {
    return <div className="screen-error"><p>Budget not found</p><button className="btn btn-primary" onClick={onBack}>Go Back</button></div>;
  }

  const variance = budget.totalBudget - (budget.lineItemTotal || 0);

  return (
    <div className="screen">
      {/* Back Header */}
      <div className="detail-header">
        <button className="back-btn" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
          </svg>
          Back
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAddLine(true)}>+ Line Item</button>
      </div>

      {/* Budget Info */}
      <div className="detail-info">
        <h1 className="detail-title">{budget.name}</h1>
        <span className={`inline-badge inline-badge-${budget.status === 'Active' ? 'success' : 'default'}`}>
          {budget.status}
        </span>
        {budget.notes && <p className="detail-notes">{budget.notes}</p>}
      </div>

      {/* Budget Summary */}
      <div className="detail-summary">
        <div className="detail-summary-item">
          <span className="detail-summary-label">Budget</span>
          <span className="detail-summary-value">{formatCurrency(budget.totalBudget)}</span>
        </div>
        <div className="detail-summary-item">
          <span className="detail-summary-label">Allocated</span>
          <span className="detail-summary-value">{formatCurrency(budget.lineItemTotal)}</span>
        </div>
        <div className="detail-summary-item">
          <span className="detail-summary-label">Remaining</span>
          <span className={`detail-summary-value ${variance >= 0 ? 'success-text' : 'danger-text'}`}>
            {formatCurrency(variance)}
          </span>
        </div>
      </div>

      {/* View Toggle */}
      <div className="toggle-group">
        <button
          className={`toggle-btn ${viewMode === 'location' ? 'active' : ''}`}
          onClick={() => setViewMode('location')}
        >
          By Location
        </button>
        <button
          className={`toggle-btn ${viewMode === 'category' ? 'active' : ''}`}
          onClick={() => setViewMode('category')}
        >
          By Category
        </button>
      </div>

      {/* Line Items by Location */}
      {viewMode === 'location' && budget.byLocation && (
        <div className="list-items">
          {Object.entries(budget.byLocation)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([locationName, data]) => (
              <div key={locationName} className="section">
                <div className="section-header-compact">
                  <h4 className="section-title-sm">{locationName}</h4>
                  <span className="section-total">{formatCurrency(data.total)}</span>
                </div>
                {data.items.map(item => (
                  <div key={item.id} className="list-item list-item-compact">
                    <div className="list-item-content">
                      <div className="list-item-title-sm">{item.category}</div>
                      <div className="list-item-subtitle">{item.description}</div>
                    </div>
                    <div className="list-item-right">
                      <div className="list-item-value-sm">{formatCurrency(item.amount)}</div>
                      <button className="btn-icon danger-text" onClick={() => handleDeleteLine(item.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
        </div>
      )}

      {/* Line Items by Category */}
      {viewMode === 'category' && budget.byCategory && (
        <div className="list-items">
          {Object.entries(budget.byCategory)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([category, data]) => (
              <div key={category} className="section">
                <div className="section-header-compact">
                  <h4 className="section-title-sm">{category}</h4>
                  <span className="section-total">{formatCurrency(data.total)}</span>
                </div>
                {data.items.map(item => (
                  <div key={item.id} className="list-item list-item-compact">
                    <div className="list-item-content">
                      <div className="list-item-title-sm">{item.locationName}</div>
                      <div className="list-item-subtitle">{item.description}</div>
                    </div>
                    <div className="list-item-right">
                      <div className="list-item-value-sm">{formatCurrency(item.amount)}</div>
                      <button className="btn-icon danger-text" onClick={() => handleDeleteLine(item.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
        </div>
      )}

      {/* Add Line Item Modal */}
      {showAddLine && (
        <div className="modal-overlay" onClick={() => setShowAddLine(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Line Item</h3>
              <button className="modal-close" onClick={() => setShowAddLine(false)}>&times;</button>
            </div>
            <div className="form-group">
              <label className="form-label">Location</label>
              <input className="form-input" placeholder="e.g., Griffith Observatory"
                value={lineForm.locationName} onChange={e => setLineForm({ ...lineForm, locationName: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={lineForm.category}
                  onChange={e => setLineForm({ ...lineForm, category: e.target.value })}>
                  <option>Location Fees</option>
                  <option>Security</option>
                  <option>Fire Safety</option>
                  <option>Equipment Rentals</option>
                  <option>Permits</option>
                  <option>Police</option>
                  <option>Catering</option>
                  <option>Transportation</option>
                  <option>Parking</option>
                  <option>Miscellaneous</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Amount</label>
                <input className="form-input" type="number" placeholder="0"
                  value={lineForm.amount} onChange={e => setLineForm({ ...lineForm, amount: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" placeholder="Description"
                value={lineForm.description} onChange={e => setLineForm({ ...lineForm, description: e.target.value })} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddLine(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddLine}
                disabled={!lineForm.locationName || !lineForm.amount}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BudgetDetail;
