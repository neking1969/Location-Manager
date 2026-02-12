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
  'Scouting': 'default',
  'Confirmed': 'info',
  'Active': 'success',
  'Wrapped': 'warning',
  'Cancelled': 'danger'
};

function LocationsList({ onNavigate }) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '', address: '', type: 'Exterior', status: 'Scouting',
    contactName: '', contactPhone: '', dailyRate: '', notes: ''
  });

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/api/budget-app/locations`);
      setLocations(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    try {
      await axios.post(`${API}/api/budget-app/locations`, {
        ...form,
        dailyRate: parseFloat(form.dailyRate) || 0
      });
      setShowAdd(false);
      setForm({ name: '', address: '', type: 'Exterior', status: 'Scouting', contactName: '', contactPhone: '', dailyRate: '', notes: '' });
      fetchLocations();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = locations
    .filter(l => filterStatus === 'all' || l.status === filterStatus)
    .filter(l =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      (l.address || '').toLowerCase().includes(search.toLowerCase())
    );

  if (loading) {
    return <div className="screen-loading"><div className="spinner"></div><p>Loading locations...</p></div>;
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-header-row">
          <div>
            <h1 className="screen-title">Locations</h1>
            <p className="screen-subtitle">{locations.length} locations</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add</button>
        </div>
      </div>

      {/* Search */}
      <div className="search-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Search locations..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Status Filter */}
      <div className="filter-chips">
        {['all', 'Active', 'Confirmed', 'Scouting', 'Wrapped'].map(status => (
          <button
            key={status}
            className={`filter-chip ${filterStatus === status ? 'active' : ''}`}
            onClick={() => setFilterStatus(status)}
          >
            {status === 'all' ? 'All' : status}
          </button>
        ))}
      </div>

      {/* Location List */}
      <div className="list-items">
        {filtered.map(location => (
          <div
            key={location.id}
            className="list-item list-item-clickable"
            onClick={() => onNavigate('location-detail', location.id)}
          >
            <div className="list-item-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div className="list-item-content">
              <div className="list-item-title">{location.name}</div>
              <div className="list-item-subtitle">
                <span className={`inline-badge inline-badge-${STATUS_COLORS[location.status] || 'default'}`}>
                  {location.status}
                </span>
                {' '}{location.type}
                {location.poCount > 0 && ` | ${location.poCount} POs`}
              </div>
              {location.budget > 0 && (
                <div className="progress-bar" style={{ marginTop: '0.375rem' }}>
                  <div
                    className={`progress-fill ${location.isOverBudget ? 'over' : 'under'}`}
                    style={{ width: `${Math.min(100, location.budget > 0 ? (location.actual / location.budget * 100) : 0)}%` }}
                  />
                </div>
              )}
            </div>
            <div className="list-item-right">
              {location.budget > 0 ? (
                <>
                  <div className="list-item-value">{formatCurrency(location.budget)}</div>
                  <div className={`list-item-subvalue ${location.variance >= 0 ? 'success-text' : 'danger-text'}`}>
                    {location.variance >= 0 ? '+' : ''}{formatCurrency(location.variance)}
                  </div>
                </>
              ) : (
                <div className="list-item-value muted-text">{formatCurrency(location.dailyRate)}/day</div>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="empty-state">
            <p className="empty-state-title">No locations found</p>
            <p>Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {/* Add Location Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">New Location</h3>
              <button className="modal-close" onClick={() => setShowAdd(false)}>&times;</button>
            </div>
            <div className="form-group">
              <label className="form-label">Location Name</label>
              <input className="form-input" placeholder="e.g., Griffith Observatory"
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <input className="form-input" placeholder="Full address"
                value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option>Exterior</option>
                  <option>Interior</option>
                  <option>Interior/Exterior</option>
                  <option>Stage</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option>Scouting</option>
                  <option>Confirmed</option>
                  <option>Active</option>
                  <option>Wrapped</option>
                  <option>Cancelled</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Contact Name</label>
                <input className="form-input" placeholder="Contact person"
                  value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Daily Rate</label>
                <input className="form-input" type="number" placeholder="0"
                  value={form.dailyRate} onChange={e => setForm({ ...form, dailyRate: e.target.value })} />
              </div>
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

export default LocationsList;
