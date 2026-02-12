import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || '';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(amount || 0);
}

const STATUS_COLORS = {
  'Draft': 'default', 'Submitted': 'info', 'Approved': 'success',
  'Paid': 'success', 'Cancelled': 'danger', 'Pending': 'warning',
  'Overdue': 'danger', 'Requested': 'info', 'Issued': 'warning',
  'Cleared': 'success', 'Voided': 'danger'
};

function TransactionsList({ onNavigate }) {
  const [activeType, setActiveType] = useState('pos');
  const [pos, setPOs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    locationName: '', vendor: '', description: '', amount: '',
    date: new Date().toISOString().split('T')[0], status: 'Draft',
    category: 'Location Fees', poNumber: '', invoiceNumber: '',
    checkNumber: '', payee: '', dueDate: ''
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [posRes, invRes, chkRes] = await Promise.all([
        axios.get(`${API}/api/budget-app/purchase-orders`),
        axios.get(`${API}/api/budget-app/invoices`),
        axios.get(`${API}/api/budget-app/check-requests`)
      ]);
      setPOs(posRes.data);
      setInvoices(invRes.data);
      setChecks(chkRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    try {
      const endpoint = {
        pos: 'purchase-orders',
        invoices: 'invoices',
        checks: 'check-requests'
      }[activeType];

      const data = {
        locationName: form.locationName,
        description: form.description,
        amount: parseFloat(form.amount) || 0,
        date: form.date,
        category: form.category,
        notes: ''
      };

      if (activeType === 'pos') {
        data.vendor = form.vendor;
        data.poNumber = form.poNumber;
        data.status = form.status || 'Draft';
      } else if (activeType === 'invoices') {
        data.vendor = form.vendor;
        data.invoiceNumber = form.invoiceNumber;
        data.dueDate = form.dueDate;
        data.status = form.status || 'Pending';
      } else {
        data.payee = form.payee;
        data.checkNumber = form.checkNumber;
        data.status = form.status || 'Requested';
      }

      await axios.post(`${API}/api/budget-app/${endpoint}`, data);
      setShowAdd(false);
      resetForm();
      fetchAll();
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setForm({
      locationName: '', vendor: '', description: '', amount: '',
      date: new Date().toISOString().split('T')[0], status: 'Draft',
      category: 'Location Fees', poNumber: '', invoiceNumber: '',
      checkNumber: '', payee: '', dueDate: ''
    });
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('Delete this item?')) return;
    const endpoint = { pos: 'purchase-orders', invoices: 'invoices', checks: 'check-requests' }[type];
    try {
      await axios.delete(`${API}/api/budget-app/${endpoint}/${id}`);
      fetchAll();
    } catch (err) {
      console.error(err);
    }
  };

  const getActiveData = () => {
    const data = { pos, invoices, checks }[activeType] || [];
    if (!search) return data;
    return data.filter(item =>
      (item.vendor || item.payee || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.locationName || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(search.toLowerCase())
    );
  };

  const activeData = getActiveData();
  const total = activeData.reduce((s, item) => s + (item.amount || 0), 0);

  if (loading) {
    return <div className="screen-loading"><div className="spinner"></div><p>Loading transactions...</p></div>;
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-header-row">
          <div>
            <h1 className="screen-title">Transactions</h1>
            <p className="screen-subtitle">POs, Invoices, & Checks</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add</button>
        </div>
      </div>

      {/* Type Tabs */}
      <div className="toggle-group">
        <button className={`toggle-btn ${activeType === 'pos' ? 'active' : ''}`}
          onClick={() => setActiveType('pos')}>
          POs ({pos.length})
        </button>
        <button className={`toggle-btn ${activeType === 'invoices' ? 'active' : ''}`}
          onClick={() => setActiveType('invoices')}>
          Invoices ({invoices.length})
        </button>
        <button className={`toggle-btn ${activeType === 'checks' ? 'active' : ''}`}
          onClick={() => setActiveType('checks')}>
          Checks ({checks.length})
        </button>
      </div>

      {/* Search */}
      <div className="search-bar">
        <input
          type="text" className="search-input"
          placeholder={`Search ${activeType}...`}
          value={search} onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Total */}
      <div className="inline-summary">
        <div className="inline-summary-item">
          <span className="inline-summary-label">Total</span>
          <span className="inline-summary-value">{formatCurrency(total)}</span>
        </div>
        <div className="inline-summary-item">
          <span className="inline-summary-label">Count</span>
          <span className="inline-summary-value">{activeData.length}</span>
        </div>
      </div>

      {/* List */}
      <div className="list-items">
        {activeData.map(item => (
          <div key={item.id} className="list-item">
            <div className="list-item-content">
              <div className="list-item-title">{item.vendor || item.payee}</div>
              <div className="list-item-subtitle">
                <span className={`inline-badge inline-badge-${STATUS_COLORS[item.status] || 'default'}`}>
                  {item.status}
                </span>
                {' '}{item.poNumber || item.invoiceNumber || item.checkNumber}
                {item.date && ` | ${item.date}`}
              </div>
              <div className="list-item-subtitle">
                {item.locationName} - {item.description}
              </div>
            </div>
            <div className="list-item-right">
              <div className="list-item-value">{formatCurrency(item.amount)}</div>
              <button className="btn-icon danger-text" onClick={() => handleDelete(activeType, item.id)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>
        ))}
        {activeData.length === 0 && (
          <div className="empty-state">
            <p className="empty-state-title">No {activeType} found</p>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => { setShowAdd(false); resetForm(); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                New {activeType === 'pos' ? 'Purchase Order' : activeType === 'invoices' ? 'Invoice' : 'Check Request'}
              </h3>
              <button className="modal-close" onClick={() => { setShowAdd(false); resetForm(); }}>&times;</button>
            </div>

            <div className="form-group">
              <label className="form-label">Location</label>
              <input className="form-input" placeholder="Location name"
                value={form.locationName} onChange={e => setForm({ ...form, locationName: e.target.value })} />
            </div>

            {activeType !== 'checks' && (
              <div className="form-group">
                <label className="form-label">Vendor</label>
                <input className="form-input" placeholder="Vendor name"
                  value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} />
              </div>
            )}

            {activeType === 'checks' && (
              <div className="form-group">
                <label className="form-label">Payee</label>
                <input className="form-input" placeholder="Payee name"
                  value={form.payee} onChange={e => setForm({ ...form, payee: e.target.value })} />
              </div>
            )}

            <div className="form-row">
              {activeType === 'pos' && (
                <div className="form-group">
                  <label className="form-label">PO Number</label>
                  <input className="form-input" placeholder="PO-2026-XXX"
                    value={form.poNumber} onChange={e => setForm({ ...form, poNumber: e.target.value })} />
                </div>
              )}
              {activeType === 'invoices' && (
                <div className="form-group">
                  <label className="form-label">Invoice Number</label>
                  <input className="form-input" placeholder="INV-XXX"
                    value={form.invoiceNumber} onChange={e => setForm({ ...form, invoiceNumber: e.target.value })} />
                </div>
              )}
              {activeType === 'checks' && (
                <div className="form-group">
                  <label className="form-label">Check Number</label>
                  <input className="form-input" placeholder="CHK-XXX"
                    value={form.checkNumber} onChange={e => setForm({ ...form, checkNumber: e.target.value })} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Amount</label>
                <input className="form-input" type="number" placeholder="0"
                  value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date"
                  value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}>
                  <option>Location Fees</option><option>Security</option><option>Fire Safety</option>
                  <option>Equipment Rentals</option><option>Permits</option><option>Police</option>
                  <option>Catering</option><option>Transportation</option><option>Parking</option>
                  <option>Miscellaneous</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" placeholder="Description"
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}>
                {activeType === 'pos' && <>
                  <option>Draft</option><option>Submitted</option><option>Approved</option><option>Paid</option><option>Cancelled</option>
                </>}
                {activeType === 'invoices' && <>
                  <option>Pending</option><option>Approved</option><option>Paid</option><option>Overdue</option><option>Cancelled</option>
                </>}
                {activeType === 'checks' && <>
                  <option>Requested</option><option>Approved</option><option>Issued</option><option>Cleared</option><option>Voided</option>
                </>}
              </select>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowAdd(false); resetForm(); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdd}
                disabled={!form.locationName || !form.amount}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TransactionsList;
