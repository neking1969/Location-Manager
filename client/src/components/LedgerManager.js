import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

function LedgerManager({ onProjectLoad }) {
  const { projectId } = useParams();
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [formData, setFormData] = useState({
    category: '',
    description: '',
    amount: '',
    vendor: '',
    invoice_number: '',
    date: '',
    episode: '',
    location_name: '',
    payment_status: 'pending',
    po_number: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      const [entriesRes, categoriesRes, projectRes] = await Promise.all([
        axios.get(`/api/ledgers/project/${projectId}`),
        axios.get('/api/budgets/categories'),
        axios.get(`/api/projects/${projectId}`)
      ]);
      setLedgerEntries(entriesRes.data);
      setCategories(categoriesRes.data);
      if (onProjectLoad) {
        onProjectLoad(projectRes.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        project_id: projectId,
        amount: parseFloat(formData.amount) || 0
      };

      if (editEntry) {
        const response = await axios.put(`/api/ledgers/${editEntry.id}`, payload);
        setLedgerEntries(ledgerEntries.map(entry =>
          entry.id === editEntry.id ? response.data : entry
        ));
      } else {
        const response = await axios.post('/api/ledgers', payload);
        setLedgerEntries([response.data, ...ledgerEntries]);
      }

      closeModal();
    } catch (error) {
      console.error('Error saving ledger entry:', error);
    }
  };

  const handleEdit = (entry) => {
    setEditEntry(entry);
    setFormData({
      category: entry.category,
      description: entry.description || '',
      amount: entry.amount.toString(),
      vendor: entry.vendor || '',
      invoice_number: entry.invoice_number || '',
      date: entry.date || '',
      episode: entry.episode || '',
      location_name: entry.location_name || '',
      payment_status: entry.payment_status || 'pending',
      po_number: entry.po_number || '',
      notes: entry.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this ledger entry?')) {
      try {
        await axios.delete(`/api/ledgers/${id}`);
        setLedgerEntries(ledgerEntries.filter(entry => entry.id !== id));
      } catch (error) {
        console.error('Error deleting entry:', error);
      }
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditEntry(null);
    setFormData({
      category: '',
      description: '',
      amount: '',
      vendor: '',
      invoice_number: '',
      date: '',
      episode: '',
      location_name: '',
      payment_status: 'pending',
      po_number: '',
      notes: ''
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const filteredEntries = filterCategory
    ? ledgerEntries.filter(e => e.category === filterCategory)
    : ledgerEntries;

  const totalSpent = filteredEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);

  // Group by category for summary
  const byCategory = ledgerEntries.reduce((acc, entry) => {
    acc[entry.category] = (acc[entry.category] || 0) + entry.amount;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Summary */}
      <div className="summary-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="summary-card">
          <div className="summary-label">Total Spent</div>
          <div className="summary-value">{formatCurrency(totalSpent)}</div>
          <div className="summary-detail">
            {filteredEntries.length} entries
            {filterCategory && ` in ${filterCategory}`}
          </div>
        </div>
      </div>

      {/* Category Summary */}
      {Object.keys(byCategory).length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 className="card-title" style={{ marginBottom: '1rem' }}>Spending by Category</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([category, amount]) => (
              <div
                key={category}
                style={{
                  padding: '0.75rem',
                  background: filterCategory === category ? 'var(--primary)' : 'var(--gray-50)',
                  color: filterCategory === category ? 'white' : 'inherit',
                  borderRadius: '0.375rem',
                  cursor: 'pointer'
                }}
                onClick={() => setFilterCategory(filterCategory === category ? '' : category)}
              >
                <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>{category}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>{formatCurrency(amount)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ledger Entries Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            Ledger Entries
            {filterCategory && (
              <span style={{ fontSize: '0.875rem', fontWeight: 'normal', marginLeft: '0.5rem' }}>
                (Filtered: {filterCategory})
                <button
                  onClick={() => setFilterCategory('')}
                  style={{
                    marginLeft: '0.5rem',
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    cursor: 'pointer'
                  }}
                >
                  Clear
                </button>
              </span>
            )}
          </h3>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Add Entry
          </button>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📒</div>
            <div className="empty-state-title">No Ledger Entries</div>
            <p>Add entries manually or upload a PDF to import costs.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Vendor</th>
                  <th>Invoice #</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map(entry => (
                  <tr key={entry.id}>
                    <td>{entry.date || '-'}</td>
                    <td>{entry.category}</td>
                    <td>{entry.description?.substring(0, 40) || '-'}</td>
                    <td>{entry.vendor || '-'}</td>
                    <td>{entry.invoice_number || '-'}</td>
                    <td>
                      <span className={`badge ${
                        entry.payment_status === 'paid' ? 'badge-success' :
                        entry.payment_status === 'pending' ? 'badge-warning' : 'badge-info'
                      }`}>
                        {entry.payment_status}
                      </span>
                    </td>
                    <td className="amount">{formatCurrency(entry.amount)}</td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleEdit(entry)}
                        style={{ marginRight: '0.5rem' }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(entry.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{editEntry ? 'Edit Ledger Entry' : 'Add Ledger Entry'}</h3>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select
                    className="form-select"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    required
                  >
                    <option value="">Select a category</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Location fee for downtown warehouse"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Amount *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Vendor</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.vendor}
                    onChange={e => setFormData({ ...formData, vendor: e.target.value })}
                    placeholder="e.g., ABC Properties"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Invoice #</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.invoice_number}
                    onChange={e => setFormData({ ...formData, invoice_number: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">PO #</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.po_number}
                    onChange={e => setFormData({ ...formData, po_number: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Location Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.location_name}
                    onChange={e => setFormData({ ...formData, location_name: e.target.value })}
                    placeholder="e.g., Main Street Cafe"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Episode</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.episode}
                    onChange={e => setFormData({ ...formData, episode: e.target.value })}
                    placeholder="e.g., EP 101"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Payment Status</label>
                <select
                  className="form-select"
                  value={formData.payment_status}
                  onChange={e => setFormData({ ...formData, payment_status: e.target.value })}
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="approved">Approved</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-input"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editEntry ? 'Update' : 'Add'} Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default LedgerManager;
