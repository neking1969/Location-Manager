import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function ProjectList({ onSelectProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    production_company: '',
    start_date: '',
    end_date: '',
    notes: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await axios.get('/api/projects');
      setProjects(response.data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/projects', formData);
      setProjects([response.data, ...projects]);
      setShowModal(false);
      setFormData({
        name: '',
        production_company: '',
        start_date: '',
        end_date: '',
        notes: ''
      });
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  const handleSelectProject = (project) => {
    onSelectProject(project);
    navigate(`/project/${project.id}/dashboard`);
  };

  const handleDelete = async (e, projectId) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this project? All budget and ledger data will be lost.')) {
      try {
        await axios.delete(`/api/projects/${projectId}`);
        setProjects(projects.filter(p => p.id !== projectId));
      } catch (error) {
        console.error('Error deleting project:', error);
      }
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Productions</h2>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + New Production
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📽️</div>
            <div className="empty-state-title">No Productions Yet</div>
            <p>Create your first production to start tracking costs.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Production Name</th>
                  <th>Company</th>
                  <th>Budgeted</th>
                  <th>Spent</th>
                  <th>Variance</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projects.map(project => {
                  const variance = (project.total_budgeted || 0) - (project.total_spent || 0);
                  const isOverBudget = variance < 0;
                  return (
                    <tr
                      key={project.id}
                      onClick={() => handleSelectProject(project)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td><strong>{project.name}</strong></td>
                      <td>{project.production_company || '-'}</td>
                      <td className="amount">{formatCurrency(project.total_budgeted)}</td>
                      <td className="amount">{formatCurrency(project.total_spent)}</td>
                      <td className={`amount ${isOverBudget ? 'negative' : 'positive'}`}>
                        {isOverBudget ? '-' : '+'}{formatCurrency(Math.abs(variance))}
                      </td>
                      <td>
                        <span className={`badge ${isOverBudget ? 'badge-danger' : 'badge-success'}`}>
                          {isOverBudget ? 'Over Budget' : 'Under Budget'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={(e) => handleDelete(e, project.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">New Production</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Production Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g., Season 3 - Downtown Locations"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Production Company</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.production_company}
                  onChange={e => setFormData({ ...formData, production_company: e.target.value })}
                  placeholder="e.g., ABC Studios"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.start_date}
                    onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.end_date}
                    onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-input"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Any additional notes..."
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Production
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectList;
