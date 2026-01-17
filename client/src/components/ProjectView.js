import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import SetCard from './SetCard';

const COST_CATEGORIES = ['Loc Fees', 'Security', 'Fire', 'Rentals', 'Permits', 'Police'];

function ProjectView({ onProjectLoad }) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [sets, setSets] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEpisodeModal, setShowEpisodeModal] = useState(false);
  const [showSetModal, setShowSetModal] = useState(false);
  const [episodeForm, setEpisodeForm] = useState({ name: '', episode_number: '', type: 'episode' });
  const [setForm, setSetForm] = useState({
    set_name: '', location: '',
    budget_loc_fees: '', budget_security: '', budget_fire: '',
    budget_rentals: '', budget_permits: '', budget_police: ''
  });
  const [editingSet, setEditingSet] = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    fetchProjectData();
  }, [projectId]);

  useEffect(() => {
    if (activeTab) {
      fetchSetsForEpisode(activeTab);
    }
  }, [activeTab]);

  const fetchProjectData = async () => {
    try {
      const [projectRes, episodesRes, summaryRes] = await Promise.all([
        axios.get(`/api/projects/${projectId}`),
        axios.get(`/api/episodes/project/${projectId}`),
        axios.get(`/api/reports/dashboard/${projectId}`)
      ]);

      setProject(projectRes.data);
      setEpisodes(episodesRes.data);
      setSummary(summaryRes.data.summary);

      if (onProjectLoad) {
        onProjectLoad(projectRes.data);
      }

      // Set first tab as active
      if (episodesRes.data.length > 0 && !activeTab) {
        setActiveTab(episodesRes.data[0].id);
      }
    } catch (error) {
      console.error('Error fetching project:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSetsForEpisode = async (episodeId) => {
    try {
      const response = await axios.get(`/api/sets/episode/${episodeId}`);
      setSets(response.data);
    } catch (error) {
      console.error('Error fetching sets:', error);
    }
  };

  const handleAddEpisode = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/episodes', {
        project_id: projectId,
        ...episodeForm
      });
      setEpisodes([...episodes, response.data]);
      setShowEpisodeModal(false);
      setEpisodeForm({ name: '', episode_number: '', type: 'episode' });
      if (!activeTab) {
        setActiveTab(response.data.id);
      }
    } catch (error) {
      console.error('Error creating episode:', error);
    }
  };

  const handleAddSet = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        project_id: projectId,
        episode_id: activeTab,
        set_name: setForm.set_name,
        location: setForm.location,
        budget_loc_fees: parseFloat(setForm.budget_loc_fees) || 0,
        budget_security: parseFloat(setForm.budget_security) || 0,
        budget_fire: parseFloat(setForm.budget_fire) || 0,
        budget_rentals: parseFloat(setForm.budget_rentals) || 0,
        budget_permits: parseFloat(setForm.budget_permits) || 0,
        budget_police: parseFloat(setForm.budget_police) || 0
      };

      if (editingSet) {
        await axios.put(`/api/sets/${editingSet.id}`, payload);
      } else {
        await axios.post('/api/sets', payload);
      }

      fetchSetsForEpisode(activeTab);
      fetchProjectData(); // Refresh summary
      closeSetModal();
    } catch (error) {
      console.error('Error saving set:', error);
    }
  };

  const handleEditSet = (set) => {
    setEditingSet(set);
    setSetForm({
      set_name: set.set_name,
      location: set.location || '',
      budget_loc_fees: set.budget_loc_fees || '',
      budget_security: set.budget_security || '',
      budget_fire: set.budget_fire || '',
      budget_rentals: set.budget_rentals || '',
      budget_permits: set.budget_permits || '',
      budget_police: set.budget_police || ''
    });
    setShowSetModal(true);
  };

  const handleDeleteSet = async (setId) => {
    if (window.confirm('Are you sure you want to delete this set and all its costs?')) {
      try {
        await axios.delete(`/api/sets/${setId}`);
        fetchSetsForEpisode(activeTab);
        fetchProjectData();
      } catch (error) {
        console.error('Error deleting set:', error);
      }
    }
  };

  const handleDeleteEpisode = async (episodeId) => {
    if (window.confirm('Are you sure you want to delete this episode/tab and all its sets?')) {
      try {
        await axios.delete(`/api/episodes/${episodeId}`);
        const newEpisodes = episodes.filter(e => e.id !== episodeId);
        setEpisodes(newEpisodes);
        if (activeTab === episodeId) {
          setActiveTab(newEpisodes[0]?.id || null);
        }
        fetchProjectData();
      } catch (error) {
        console.error('Error deleting episode:', error);
      }
    }
  };

  const closeSetModal = () => {
    setShowSetModal(false);
    setEditingSet(null);
    setSetForm({
      set_name: '', location: '',
      budget_loc_fees: '', budget_security: '', budget_fire: '',
      budget_rentals: '', budget_permits: '', budget_police: ''
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!project) {
    return <div className="alert alert-error">Project not found</div>;
  }

  const activeEpisode = episodes.find(e => e.id === activeTab);

  return (
    <div>
      {/* Project Header */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.25rem' }}>{project.name}</h2>
            {project.production_company && (
              <p style={{ color: 'var(--gray-500)' }}>{project.production_company}</p>
            )}
          </div>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            Back to Projects
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="summary-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="summary-card">
            <div className="summary-label">Total Budget</div>
            <div className="summary-value">{formatCurrency(summary.total_budget)}</div>
            <div className="summary-detail">{summary.set_count} sets</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Total Actual</div>
            <div className="summary-value">{formatCurrency(summary.total_actual)}</div>
            <div className="summary-detail">{summary.entry_count} cost entries</div>
          </div>
          <div className={`summary-card ${summary.status === 'over_budget' ? 'over-budget' : 'under-budget'}`}>
            <div className="summary-label">Under/Over</div>
            <div className={`summary-value ${summary.variance < 0 ? 'negative' : 'positive'}`}>
              {summary.variance < 0 ? '-' : '+'}{formatCurrency(Math.abs(summary.variance))}
            </div>
            <div className="summary-detail">
              {summary.variance < 0 ? 'Over' : 'Under'} by {Math.abs(summary.variance_percent)}%
            </div>
          </div>
        </div>
      )}

      {/* Episode Tabs */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
            {episodes.map(episode => (
              <button
                key={episode.id}
                className={`tab ${activeTab === episode.id ? 'active' : ''}`}
                onClick={() => setActiveTab(episode.id)}
                style={{ position: 'relative' }}
              >
                {episode.name}
                {episode.total_actual > episode.total_budget && episode.total_budget > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: 'var(--danger)'
                  }} />
                )}
              </button>
            ))}
            <button className="tab" onClick={() => setShowEpisodeModal(true)}>
              + Add Tab
            </button>
          </div>
          {activeTab && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => handleDeleteEpisode(activeTab)}
            >
              Delete Tab
            </button>
          )}
        </div>

        {/* Sets for Active Tab */}
        {activeTab && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--gray-200)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>
                {activeEpisode?.name} - Sets ({sets.length})
              </h3>
              <button className="btn btn-primary" onClick={() => setShowSetModal(true)}>
                + Add Set
              </button>
            </div>

            {sets.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📍</div>
                <div className="empty-state-title">No Sets Yet</div>
                <p>Add your first location set to start tracking costs.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {sets.map(set => (
                  <SetCard
                    key={set.id}
                    set={set}
                    onEdit={() => handleEditSet(set)}
                    onDelete={() => handleDeleteSet(set.id)}
                    onRefresh={() => {
                      fetchSetsForEpisode(activeTab);
                      fetchProjectData();
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {!activeTab && episodes.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📑</div>
            <div className="empty-state-title">No Tabs Yet</div>
            <p>Add your first tab (episode or location group like Backlot).</p>
          </div>
        )}
      </div>

      {/* Add Episode Modal */}
      {showEpisodeModal && (
        <div className="modal-overlay" onClick={() => setShowEpisodeModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Tab</h3>
              <button className="modal-close" onClick={() => setShowEpisodeModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddEpisode}>
              <div className="form-group">
                <label className="form-label">Tab Type</label>
                <select
                  className="form-select"
                  value={episodeForm.type}
                  onChange={e => setEpisodeForm({ ...episodeForm, type: e.target.value })}
                >
                  <option value="episode">Episode</option>
                  <option value="location_group">Location Group (e.g., Backlot)</option>
                  <option value="amortization">Amortization</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={episodeForm.name}
                  onChange={e => setEpisodeForm({ ...episodeForm, name: e.target.value })}
                  required
                  placeholder={episodeForm.type === 'episode' ? 'e.g., 101' : 'e.g., Backlot'}
                />
              </div>
              {episodeForm.type === 'episode' && (
                <div className="form-group">
                  <label className="form-label">Episode Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={episodeForm.episode_number}
                    onChange={e => setEpisodeForm({ ...episodeForm, episode_number: e.target.value })}
                    placeholder="e.g., 101"
                  />
                </div>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEpisodeModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Add Tab</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Set Modal */}
      {showSetModal && (
        <div className="modal-overlay" onClick={closeSetModal}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{editingSet ? 'Edit Set' : 'Add Set'}</h3>
              <button className="modal-close" onClick={closeSetModal}>&times;</button>
            </div>
            <form onSubmit={handleAddSet}>
              <div className="form-group">
                <label className="form-label">Set Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={setForm.set_name}
                  onChange={e => setSetForm({ ...setForm, set_name: e.target.value })}
                  required
                  placeholder="e.g., Las Palmas Studio Lot - Hallway Outside Stage 10"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Location</label>
                <input
                  type="text"
                  className="form-input"
                  value={setForm.location}
                  onChange={e => setSetForm({ ...setForm, location: e.target.value })}
                  placeholder="e.g., 123 Main St, Los Angeles, CA"
                />
              </div>

              <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--gray-600)' }}>
                BUDGET BY CATEGORY
              </h4>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Loc Fees</label>
                  <input
                    type="number"
                    className="form-input"
                    value={setForm.budget_loc_fees}
                    onChange={e => setSetForm({ ...setForm, budget_loc_fees: e.target.value })}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Security</label>
                  <input
                    type="number"
                    className="form-input"
                    value={setForm.budget_security}
                    onChange={e => setSetForm({ ...setForm, budget_security: e.target.value })}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Fire</label>
                  <input
                    type="number"
                    className="form-input"
                    value={setForm.budget_fire}
                    onChange={e => setSetForm({ ...setForm, budget_fire: e.target.value })}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Rentals</label>
                  <input
                    type="number"
                    className="form-input"
                    value={setForm.budget_rentals}
                    onChange={e => setSetForm({ ...setForm, budget_rentals: e.target.value })}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Permits</label>
                  <input
                    type="number"
                    className="form-input"
                    value={setForm.budget_permits}
                    onChange={e => setSetForm({ ...setForm, budget_permits: e.target.value })}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Police</label>
                  <input
                    type="number"
                    className="form-input"
                    value={setForm.budget_police}
                    onChange={e => setSetForm({ ...setForm, budget_police: e.target.value })}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeSetModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingSet ? 'Update Set' : 'Add Set'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectView;
