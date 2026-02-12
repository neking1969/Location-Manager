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
  'Scouting': 'default', 'Confirmed': 'info', 'Active': 'success',
  'Wrapped': 'warning', 'Cancelled': 'danger',
  'Draft': 'default', 'Submitted': 'info', 'Approved': 'success',
  'Paid': 'success', 'Pending': 'warning', 'Overdue': 'danger',
  'Requested': 'info', 'Issued': 'warning', 'Cleared': 'success', 'Voided': 'danger'
};

function LocationDetail({ locationId, onBack }) {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    fetchLocation();
  }, [locationId]);

  const fetchLocation = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/api/budget-app/locations/${locationId}`);
      setLocation(res.data);
      setEditForm(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await axios.put(`${API}/api/budget-app/locations/${locationId}`, {
        name: editForm.name,
        address: editForm.address,
        type: editForm.type,
        status: editForm.status,
        contactName: editForm.contactName,
        contactPhone: editForm.contactPhone,
        dailyRate: parseFloat(editForm.dailyRate) || 0,
        notes: editForm.notes
      });
      setEditing(false);
      fetchLocation();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="screen-loading"><div className="spinner"></div><p>Loading location...</p></div>;
  }

  if (!location) {
    return <div className="screen-error"><p>Location not found</p><button className="btn btn-primary" onClick={onBack}>Go Back</button></div>;
  }

  const spentPct = location.budget > 0 ? (location.actual / location.budget * 100) : 0;

  return (
    <div className="screen">
      {/* Header */}
      <div className="detail-header">
        <button className="back-btn" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
          </svg>
          Back
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => setEditing(!editing)}>
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {/* Location Info */}
      {!editing ? (
        <div className="detail-info">
          <h1 className="detail-title">{location.name}</h1>
          <span className={`inline-badge inline-badge-${STATUS_COLORS[location.status] || 'default'}`}>
            {location.status}
          </span>
          <span className="inline-badge inline-badge-default" style={{ marginLeft: '0.5rem' }}>{location.type}</span>
          {location.address && <p className="detail-address">{location.address}</p>}
          {location.notes && <p className="detail-notes">{location.notes}</p>}
        </div>
      ) : (
        <div className="detail-edit-form">
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" value={editForm.name || ''}
              onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <input className="form-input" value={editForm.address || ''}
              onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={editForm.status || 'Active'}
                onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                <option>Scouting</option><option>Confirmed</option><option>Active</option>
                <option>Wrapped</option><option>Cancelled</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={editForm.type || 'Exterior'}
                onChange={e => setEditForm({ ...editForm, type: e.target.value })}>
                <option>Exterior</option><option>Interior</option><option>Interior/Exterior</option><option>Stage</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Contact</label>
              <input className="form-input" value={editForm.contactName || ''}
                onChange={e => setEditForm({ ...editForm, contactName: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={editForm.contactPhone || ''}
                onChange={e => setEditForm({ ...editForm, contactPhone: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-input" value={editForm.notes || ''}
              onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button className="btn btn-primary" onClick={handleSave}>Save</button>
            <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Budget Summary */}
      {location.budget > 0 && (
        <div className="detail-summary">
          <div className="detail-summary-item">
            <span className="detail-summary-label">Budget</span>
            <span className="detail-summary-value">{formatCurrency(location.budget)}</span>
          </div>
          <div className="detail-summary-item">
            <span className="detail-summary-label">Spent</span>
            <span className="detail-summary-value">{formatCurrency(location.actual)}</span>
          </div>
          <div className="detail-summary-item">
            <span className="detail-summary-label">Remaining</span>
            <span className={`detail-summary-value ${location.variance >= 0 ? 'success-text' : 'danger-text'}`}>
              {formatCurrency(location.variance)}
            </span>
          </div>
        </div>
      )}

      {location.budget > 0 && (
        <div className="progress-bar" style={{ margin: '0 0 1.5rem 0', height: '0.625rem' }}>
          <div
            className={`progress-fill ${spentPct > 100 ? 'over' : spentPct > 80 ? 'warning' : 'under'}`}
            style={{ width: `${Math.min(spentPct, 100)}%` }}
          />
        </div>
      )}

      {/* Section Tabs */}
      <div className="toggle-group">
        {['overview', 'pos', 'invoices', 'checks'].map(section => (
          <button
            key={section}
            className={`toggle-btn ${activeSection === section ? 'active' : ''}`}
            onClick={() => setActiveSection(section)}
          >
            {{
              overview: 'Budget',
              pos: `POs (${location.purchaseOrders?.length || 0})`,
              invoices: `Invoices (${location.invoices?.length || 0})`,
              checks: `Checks (${location.checkRequests?.length || 0})`
            }[section]}
          </button>
        ))}
      </div>

      {/* Budget Items */}
      {activeSection === 'overview' && (
        <div className="list-items">
          {(location.budgetItems || []).map(item => (
            <div key={item.id} className="list-item">
              <div className="list-item-content">
                <div className="list-item-title">{item.category}</div>
                <div className="list-item-subtitle">{item.description}</div>
              </div>
              <div className="list-item-value">{formatCurrency(item.amount)}</div>
            </div>
          ))}
          {(!location.budgetItems || location.budgetItems.length === 0) && (
            <div className="empty-state"><p>No budget items for this location</p></div>
          )}
        </div>
      )}

      {/* Purchase Orders */}
      {activeSection === 'pos' && (
        <div className="list-items">
          {(location.purchaseOrders || []).map(po => (
            <div key={po.id} className="list-item">
              <div className="list-item-content">
                <div className="list-item-title">{po.vendor}</div>
                <div className="list-item-subtitle">
                  <span className={`inline-badge inline-badge-${STATUS_COLORS[po.status] || 'default'}`}>{po.status}</span>
                  {' '}{po.poNumber} | {po.date}
                </div>
                <div className="list-item-subtitle">{po.description}</div>
              </div>
              <div className="list-item-value">{formatCurrency(po.amount)}</div>
            </div>
          ))}
          {(!location.purchaseOrders || location.purchaseOrders.length === 0) && (
            <div className="empty-state"><p>No purchase orders</p></div>
          )}
        </div>
      )}

      {/* Invoices */}
      {activeSection === 'invoices' && (
        <div className="list-items">
          {(location.invoices || []).map(inv => (
            <div key={inv.id} className="list-item">
              <div className="list-item-content">
                <div className="list-item-title">{inv.vendor}</div>
                <div className="list-item-subtitle">
                  <span className={`inline-badge inline-badge-${STATUS_COLORS[inv.status] || 'default'}`}>{inv.status}</span>
                  {' '}{inv.invoiceNumber} | {inv.date}
                </div>
                <div className="list-item-subtitle">{inv.description}</div>
              </div>
              <div className="list-item-value">{formatCurrency(inv.amount)}</div>
            </div>
          ))}
          {(!location.invoices || location.invoices.length === 0) && (
            <div className="empty-state"><p>No invoices</p></div>
          )}
        </div>
      )}

      {/* Check Requests */}
      {activeSection === 'checks' && (
        <div className="list-items">
          {(location.checkRequests || []).map(cr => (
            <div key={cr.id} className="list-item">
              <div className="list-item-content">
                <div className="list-item-title">{cr.payee}</div>
                <div className="list-item-subtitle">
                  <span className={`inline-badge inline-badge-${STATUS_COLORS[cr.status] || 'default'}`}>{cr.status}</span>
                  {' '}{cr.checkNumber} | {cr.date}
                </div>
                <div className="list-item-subtitle">{cr.description}</div>
              </div>
              <div className="list-item-value">{formatCurrency(cr.amount)}</div>
            </div>
          ))}
          {(!location.checkRequests || location.checkRequests.length === 0) && (
            <div className="empty-state"><p>No check requests</p></div>
          )}
        </div>
      )}

      {/* Contact Info */}
      {(location.contactName || location.contactPhone) && (
        <div className="section" style={{ marginTop: '1.5rem' }}>
          <div className="section-header"><h3 className="section-title">Contact</h3></div>
          <div className="detail-fields">
            {location.contactName && (
              <div className="detail-field">
                <span className="detail-field-label">Name</span>
                <span className="detail-field-value">{location.contactName}</span>
              </div>
            )}
            {location.contactPhone && (
              <div className="detail-field">
                <span className="detail-field-label">Phone</span>
                <span className="detail-field-value">{location.contactPhone}</span>
              </div>
            )}
            {location.dailyRate > 0 && (
              <div className="detail-field">
                <span className="detail-field-label">Daily Rate</span>
                <span className="detail-field-value">{formatCurrency(location.dailyRate)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default LocationDetail;
