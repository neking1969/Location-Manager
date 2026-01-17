import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

function BudgetManager({ onProjectLoad }) {
  const { projectId } = useParams();
  const [budgetItems, setBudgetItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [formData, setFormData] = useState({
    category: '',
    description: '',
    budgeted_amount: '',
    episode: '',
    location_name: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      const [itemsRes, categoriesRes, projectRes] = await Promise.all([
        axios.get(`/api/budgets/project/${projectId}`),
        axios.get('/api/budgets/categories'),
        axios.get(`/api/projects/${projectId}`)
      ]);
      setBudgetItems(itemsRes.data);
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
        budgeted_amount: parseFloat(formData.budgeted_amount) || 0
      };

      if (editItem) {
        const response = await axios.put(`/api/budgets/${editItem.id}`, payload);
        setBudgetItems(budgetItems.map(item =>
          item.id === editItem.id ? response.data : item
        ));
      } else {
        const response = await axios.post('/api/budgets', payload);
        setBudgetItems([...budgetItems, response.data]);
      }

      closeModal();
    } catch (error) {
      console.error('Error saving budget item:', error);
    }
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setFormData({
      category: item.category,
      description: item.description || '',
      budgeted_amount: item.budgeted_amount.toString(),
      episode: item.episode || '',
      location_name: item.location_name || '',
      notes: item.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this budget item?')) {
      try {
        await axios.delete(`/api/budgets/${id}`);
        setBudgetItems(budgetItems.filter(item => item.id !== id));
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditItem(null);
    setFormData({
      category: '',
      description: '',
      budgeted_amount: '',
      episode: '',
      location_name: '',
      notes: ''
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const totalBudget = budgetItems.reduce((sum, item) => sum + (item.budgeted_amount || 0), 0);

  // Group by category for summary
  const byCategory = budgetItems.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.budgeted_amount;
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
          <div className="summary-label">Total Budget</div>
          <div className="summary-value">{formatCurrency(totalBudget)}</div>
          <div className="summary-detail">{budgetItems.length} budget items</div>
        </div>
      </div>

      {/* Category Summary */}
      {Object.keys(byCategory).length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 className="card-title" style={{ marginBottom: '1rem' }}>Budget by Category</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([category, amount]) => (
              <div key={category} style={{ padding: '0.75rem', background: 'var(--gray-50)', borderRadius: '0.375rem' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>{category}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>{formatCurrency(amount)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget Items Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Budget Items</h3>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Add Budget Item
          </button>
        </div>

        {budgetItems.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No Budget Items</div>
            <p>Add budget items to start tracking planned costs.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Location</th>
                  <th>Episode</th>
                  <th>Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {budgetItems.map(item => (
                  <tr key={item.id}>
                    <td>{item.category}</td>
                    <td>{item.description || '-'}</td>
                    <td>{item.location_name || '-'}</td>
                    <td>{item.episode || '-'}</td>
                    <td className="amount">{formatCurrency(item.budgeted_amount)}</td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleEdit(item)}
                        style={{ marginRight: '0.5rem' }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(item.id)}
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
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editItem ? 'Edit Budget Item' : 'Add Budget Item'}</h3>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
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
                <label className="form-label">Description</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Downtown warehouse location fee"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Budgeted Amount *</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.budgeted_amount}
                  onChange={e => setFormData({ ...formData, budgeted_amount: e.target.value })}
                  required
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
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
                  {editItem ? 'Update' : 'Add'} Budget Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default BudgetManager;
