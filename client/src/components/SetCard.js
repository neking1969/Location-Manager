import React, { useState } from 'react';
import axios from 'axios';

const COST_CATEGORIES = ['Loc Fees', 'Security', 'Fire', 'Rentals', 'Permits', 'Police'];

function SetCard({ set, onEdit, onDelete, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [costForm, setCostForm] = useState({
    description: '',
    amount: '',
    vendor: '',
    date: '',
    invoice_number: ''
  });
  const [editingCost, setEditingCost] = useState(null);
  const [costEntries, setCostEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  const budgetMap = {
    'Loc Fees': set.budget_loc_fees || 0,
    'Security': set.budget_security || 0,
    'Fire': set.budget_fire || 0,
    'Rentals': set.budget_rentals || 0,
    'Permits': set.budget_permits || 0,
    'Police': set.budget_police || 0
  };

  const actualMap = {
    'Loc Fees': set.actual_loc_fees || 0,
    'Security': set.actual_security || 0,
    'Fire': set.actual_fire || 0,
    'Rentals': set.actual_rentals || 0,
    'Permits': set.actual_permits || 0,
    'Police': set.actual_police || 0
  };

  const totalBudget = Object.values(budgetMap).reduce((a, b) => a + b, 0);
  const totalActual = Object.values(actualMap).reduce((a, b) => a + b, 0);
  const variance = totalBudget - totalActual;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const fetchCostEntries = async () => {
    setLoadingEntries(true);
    try {
      const response = await axios.get(`/api/costs/set/${set.id}`);
      setCostEntries(response.data);
    } catch (error) {
      console.error('Error fetching cost entries:', error);
    } finally {
      setLoadingEntries(false);
    }
  };

  const handleExpand = () => {
    if (!expanded) {
      fetchCostEntries();
    }
    setExpanded(!expanded);
  };

  const openCostModal = (category) => {
    setSelectedCategory(category);
    setCostForm({
      description: '',
      amount: '',
      vendor: '',
      date: '',
      invoice_number: ''
    });
    setEditingCost(null);
    setShowCostModal(true);
  };

  const handleEditCost = (cost) => {
    setSelectedCategory(cost.category);
    setCostForm({
      description: cost.description || '',
      amount: cost.amount.toString(),
      vendor: cost.vendor || '',
      date: cost.date || '',
      invoice_number: cost.invoice_number || ''
    });
    setEditingCost(cost);
    setShowCostModal(true);
  };

  const handleSaveCost = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        set_id: set.id,
        category: selectedCategory,
        description: costForm.description,
        amount: parseFloat(costForm.amount) || 0,
        vendor: costForm.vendor,
        date: costForm.date,
        invoice_number: costForm.invoice_number
      };

      if (editingCost) {
        await axios.put(`/api/costs/${editingCost.id}`, payload);
      } else {
        await axios.post('/api/costs', payload);
      }

      setShowCostModal(false);
      fetchCostEntries();
      onRefresh();
    } catch (error) {
      console.error('Error saving cost:', error);
    }
  };

  const handleDeleteCost = async (costId) => {
    if (window.confirm('Delete this cost entry?')) {
      try {
        await axios.delete(`/api/costs/${costId}`);
        fetchCostEntries();
        onRefresh();
      } catch (error) {
        console.error('Error deleting cost:', error);
      }
    }
  };

  const getCategoryEntries = (category) => {
    return costEntries.filter(e => e.category === category);
  };

  return (
    <div style={{
      border: '1px solid var(--gray-200)',
      borderRadius: '0.5rem',
      background: 'white',
      overflow: 'hidden'
    }}>
      {/* Set Header */}
      <div style={{
        padding: '1rem',
        background: 'var(--gray-50)',
        borderBottom: '1px solid var(--gray-200)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem' }}>
              {set.set_name}
            </h4>
            {set.location && (
              <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>{set.location}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={onEdit}>Edit</button>
            <button className="btn btn-danger btn-sm" onClick={onDelete}>Delete</button>
          </div>
        </div>
      </div>

      {/* Cost Table - Spreadsheet Style */}
      <div style={{ padding: '0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#1e40af', color: 'white' }}>
              <th style={{ padding: '0.5rem 1rem', textAlign: 'left', fontWeight: '600' }}>TRACK</th>
              <th style={{ padding: '0.5rem 1rem', textAlign: 'right', fontWeight: '600' }}>Budget</th>
              <th style={{ padding: '0.5rem 1rem', textAlign: 'right', fontWeight: '600' }}>Actual</th>
              <th style={{ padding: '0.5rem 1rem', textAlign: 'right', fontWeight: '600' }}>Variance</th>
              <th style={{ padding: '0.5rem 1rem', textAlign: 'center', width: '80px' }}></th>
            </tr>
          </thead>
          <tbody>
            {COST_CATEGORIES.map((category, index) => {
              const budget = budgetMap[category];
              const actual = actualMap[category];
              const catVariance = budget - actual;
              const isOver = catVariance < 0;

              return (
                <tr key={category} style={{ borderBottom: '1px solid var(--gray-200)' }}>
                  <td style={{ padding: '0.5rem 1rem' }}>{category}</td>
                  <td style={{ padding: '0.5rem 1rem', textAlign: 'right', fontFamily: 'monospace' }}>
                    {formatCurrency(budget)}
                  </td>
                  <td style={{ padding: '0.5rem 1rem', textAlign: 'right', fontFamily: 'monospace' }}>
                    {formatCurrency(actual)}
                  </td>
                  <td style={{
                    padding: '0.5rem 1rem',
                    textAlign: 'right',
                    fontFamily: 'monospace',
                    color: isOver ? 'var(--danger)' : 'var(--success)',
                    fontWeight: isOver ? '600' : 'normal'
                  }}>
                    {isOver ? '-' : ''}{formatCurrency(Math.abs(catVariance))}
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => openCostModal(category)}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      + Add
                    </button>
                  </td>
                </tr>
              );
            })}
            {/* Totals Row */}
            <tr style={{ background: '#f0fdf4', fontWeight: '600' }}>
              <td style={{ padding: '0.75rem 1rem', borderTop: '2px solid var(--gray-300)' }}>
                ACTUAL TOTAL
              </td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'monospace', borderTop: '2px solid var(--gray-300)' }}>
                {formatCurrency(totalBudget)}
              </td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontFamily: 'monospace', borderTop: '2px solid var(--gray-300)' }}>
                {formatCurrency(totalActual)}
              </td>
              <td style={{
                padding: '0.75rem 1rem',
                textAlign: 'right',
                fontFamily: 'monospace',
                borderTop: '2px solid var(--gray-300)',
                color: variance < 0 ? 'var(--danger)' : 'var(--success)'
              }}>
                {variance < 0 ? '-' : ''}{formatCurrency(Math.abs(variance))}
              </td>
              <td style={{ borderTop: '2px solid var(--gray-300)' }}></td>
            </tr>
            {/* Under/Over Row */}
            <tr style={{ background: variance < 0 ? '#fef2f2' : '#f0fdf4' }}>
              <td style={{ padding: '0.5rem 1rem', fontStyle: 'italic' }}>UNDER/OVER</td>
              <td colSpan="3" style={{
                padding: '0.5rem 1rem',
                textAlign: 'right',
                fontFamily: 'monospace',
                fontWeight: '600',
                color: variance < 0 ? 'var(--danger)' : 'var(--success)'
              }}>
                {variance < 0 ? 'OVER BY ' : 'UNDER BY '}{formatCurrency(Math.abs(variance))}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Expand/Collapse for Details */}
      <div style={{
        padding: '0.5rem 1rem',
        borderTop: '1px solid var(--gray-200)',
        background: 'var(--gray-50)'
      }}>
        <button
          onClick={handleExpand}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--primary)',
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}
        >
          {expanded ? '▼ Hide Details' : '▶ Show Cost Details'}
        </button>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div style={{ padding: '1rem', borderTop: '1px solid var(--gray-200)' }}>
          {loadingEntries ? (
            <div className="loading"><div className="spinner"></div></div>
          ) : costEntries.length === 0 ? (
            <p style={{ color: 'var(--gray-500)', textAlign: 'center' }}>No cost entries yet</p>
          ) : (
            COST_CATEGORIES.map(category => {
              const entries = getCategoryEntries(category);
              if (entries.length === 0) return null;

              return (
                <div key={category} style={{ marginBottom: '1rem' }}>
                  <h5 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--gray-700)' }}>
                    {category} ({entries.length})
                  </h5>
                  <table style={{ width: '100%', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--gray-100)' }}>
                        <th style={{ padding: '0.25rem 0.5rem', textAlign: 'left' }}>Date</th>
                        <th style={{ padding: '0.25rem 0.5rem', textAlign: 'left' }}>Description</th>
                        <th style={{ padding: '0.25rem 0.5rem', textAlign: 'left' }}>Vendor</th>
                        <th style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '0.25rem 0.5rem', width: '80px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map(entry => (
                        <tr key={entry.id}>
                          <td style={{ padding: '0.25rem 0.5rem' }}>{entry.date || '-'}</td>
                          <td style={{ padding: '0.25rem 0.5rem' }}>{entry.description || '-'}</td>
                          <td style={{ padding: '0.25rem 0.5rem' }}>{entry.vendor || '-'}</td>
                          <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right', fontFamily: 'monospace' }}>
                            {formatCurrency(entry.amount)}
                          </td>
                          <td style={{ padding: '0.25rem 0.5rem' }}>
                            <button
                              onClick={() => handleEditCost(entry)}
                              style={{ marginRight: '0.25rem', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteCost(entry.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                            >
                              Del
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Add Cost Modal */}
      {showCostModal && (
        <div className="modal-overlay" onClick={() => setShowCostModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingCost ? 'Edit' : 'Add'} {selectedCategory} Cost
              </h3>
              <button className="modal-close" onClick={() => setShowCostModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSaveCost}>
              <div className="form-group">
                <label className="form-label">Amount *</label>
                <input
                  type="number"
                  className="form-input"
                  value={costForm.amount}
                  onChange={e => setCostForm({ ...costForm, amount: e.target.value })}
                  required
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input
                  type="text"
                  className="form-input"
                  value={costForm.description}
                  onChange={e => setCostForm({ ...costForm, description: e.target.value })}
                  placeholder="e.g., Daily security guard"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Vendor</label>
                  <input
                    type="text"
                    className="form-input"
                    value={costForm.vendor}
                    onChange={e => setCostForm({ ...costForm, vendor: e.target.value })}
                    placeholder="e.g., ABC Security"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={costForm.date}
                    onChange={e => setCostForm({ ...costForm, date: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Invoice #</label>
                <input
                  type="text"
                  className="form-input"
                  value={costForm.invoice_number}
                  onChange={e => setCostForm({ ...costForm, invoice_number: e.target.value })}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCostModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCost ? 'Update' : 'Add'} Cost
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default SetCard;
