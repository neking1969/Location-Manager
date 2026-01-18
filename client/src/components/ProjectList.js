import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

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
      const response = await api.get('/api/projects');
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
      const response = await api.post('/api/projects', formData);
      setProjects([response.data, ...projects]);
      setShowModal(false);
      setFormData({
        name: '',
        production_company: '',
        start_date: '',
        end_date: '',
        notes: ''
      });
      onSelectProject(response.data);
      navigate(`/project/${response.data.id}`);
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Error creating project. Make sure the server is running.\n\nRun: cd server && npm start');
    }
  };

  const handleSelectProject = (project) => {
    onSelectProject(project);
    navigate(`/project/${project.id}`);
  };

  const handleDelete = async (e, projectId) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this production? All data will be lost.')) {
      try {
        await api.delete(`/api/projects/${projectId}`);
        setProjects(projects.filter(p => p.id !== projectId));
      } catch (error) {
        console.error('Error deleting project:', error);
      }
    }
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
      <div className="section-header">
        <h2 className="section-title">Productions</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + New Production
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🎬</div>
            <div className="empty-state-title">No Productions Yet</div>
            <p>Create your first production to start tracking location costs.</p>
            <button
              className="btn btn-primary"
              onClick={() => setShowModal(true)}
              style={{ marginTop: '1.5rem' }}
            >
              + Create Production
            </button>
          </div>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map(project => (
            <div
              key={project.id}
              className="project-card"
              onClick={() => handleSelectProject(project)}
            >
              <div className="project-card-header">
                <div className="project-card-title">{project.name}</div>
                <div className="project-card-company">
                  {project.production_company || 'No company'}
                </div>
              </div>
              <div className="project-card-body">
                <div className="project-card-stats">
                  <div className="project-card-stat">
                    <div className="project-card-stat-value">{project.episode_count || 0}</div>
                    <div className="project-card-stat-label">Episodes</div>
                  </div>
                  <div className="project-card-stat">
                    <div className="project-card-stat-value">{project.set_count || 0}</div>
                    <div className="project-card-stat-label">Sets</div>
                  </div>
                </div>
              </div>
              <div className="project-card-footer">
                <button
                  className="btn btn-danger btn-sm"
                  onClick={(e) => handleDelete(e, project.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">New Production</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Production Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="e.g., The Shards Season 1"
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
                    placeholder="Optional notes about this production..."
                  />
                </div>
                <div className="modal-footer" style={{ margin: '0 -1.5rem -1.5rem', padding: '1rem 1.5rem' }}>
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
        </div>
      )}
    </div>
  );
}

export default ProjectList;
