import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || '';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(amount || 0);
}

function BudgetsList({ onNavigate }) {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', episodeNumber: '', totalBudget: '', status: 'Draft', notes: '' });

  useEffect(() => {
    fetchBudgets();
  }, []);

  const fetchBudgets = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/api/budget-app/budgets`);
      setBudgets(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    try {
      await axios.post(`${API}/api/budget-app/budgets`, {
        ...form,
        totalBudget: parseFloat(form.totalBudget) || 0
      });
      setShowAdd(false);
      setForm({ name: '', episodeNumber: '', totalBudget: '', status: 'Draft', notes: '' });
      fetchBudgets();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = budgets.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.episodeNumber.toLowerCase().includes(search.toLowerCase())
  );

  const totalBudget = filtered.reduce((s, b) => s + (b.totalBudget || 0), 0);
  const totalActual = filtered.reduce((s, b) => s + (b.actualSpend || 0), 0);

  if (loading) {
    return <div className="screen-loading"><div className="spinner"></div><p>Loading budgets...</p></div>;
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-header-row">
          <div>
            <h1 className="screen-title">Budgets</h1>
            <p className="screen-subtitle">{budgets.length} episodes</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add</button>
        </div>
      </div>

      {/* Search */}
      <div className="search-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Search budgets..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Totals */}
      <div className="inline-summary">
        <div className="inline-summary-item">
          <span className="inline-summary-label">Budget</span>
          <span className="inline-summary-value">{formatCurrency(totalBudget)}</span>
        </div>
        <div className="inline-summary-item">
          <span className="inline-summary-label">Spent</span>
          <span className="inline-summary-value">{formatCurrency(totalActual)}</span>
        </div>
        <div className="inline-summary-item">
          <span className="inline-summary-label">Variance</span>
          <span className={`inline-summary-value ${(totalBudget - totalActual) >= 0 ? 'success-text' : 'danger-text'}`}>
            {formatCurrency(totalBudget - totalActual)}
          </span>
        </div>
      </div>

      {/* Budget List */}
      <div className="list-items">
        {filtered.map(budget => {
          const variance = budget.totalBudget - (budget.actualSpend || 0);
          const pct = budget.totalBudget > 0
            ? ((budget.actualSpend || 0) / budget.totalBudget * 100).toFixed(0)
            : 0;

          return (
            <div
              key={budget.id}
              className="list-item list-item-clickable"
              onClick={() => onNavigate('budget-detail', budget.id)}
            >
              <div className="list-item-content">
                <div className="list-item-title">{budget.name}</div>
                <div className="list-item-subtitle">
                  <span className={`inline-badge inline-badge-${budget.status === 'Active' ? 'success' : 'default'}`}>
                    {budget.status}
                  </span>
                  {' '}{budget.lineItemCount} line items | {pct}% spent
                </div>
                <div className="progress-bar" style={{ marginTop: '0.375rem' }}>
                  <div
                    className={`progress-fill ${variance < 0 ? 'over' : pct > 80 ? 'warning' : 'under'}`}
                    style={{ width: `${Math.min(parseFloat(pct), 100)}%` }}
                  />
                </div>
              </div>
              <div className="list-item-right">
                <div className="list-item-value">{formatCurrency(budget.totalBudget)}</div>
                <div className={`list-item-subvalue ${variance >= 0 ? 'success-text' : 'danger-text'}`}>
                  {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Budget Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">New Budget</h3>
              <button className="modal-close" onClick={() => setShowAdd(false)}>&times;</button>
            </div>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" placeholder="e.g., Episode 106 - Aftermath"
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Episode #</label>
                <input className="form-input" placeholder="e.g., 106"
                  value={form.episodeNumber} onChange={e => setForm({ ...form, episodeNumber: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Total Budget</label>
                <input className="form-input" type="number" placeholder="0"
                  value={form.totalBudget} onChange={e => setForm({ ...form, totalBudget: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="Draft">Draft</option>
                <option value="Active">Active</option>
                <option value="Locked">Locked</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" placeholder="Optional notes"
                value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdd} disabled={!form.name}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BudgetsList;
