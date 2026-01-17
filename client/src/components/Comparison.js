import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

function Comparison({ onProjectLoad }) {
  const { projectId } = useParams();
  const [comparisonData, setComparisonData] = useState(null);
  const [varianceData, setVarianceData] = useState(null);
  const [locationData, setLocationData] = useState([]);
  const [episodeData, setEpisodeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('category');
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      const [compRes, locRes, epRes, projectRes] = await Promise.all([
        axios.get(`/api/reports/comparison/${projectId}`),
        axios.get(`/api/reports/by-location/${projectId}`),
        axios.get(`/api/reports/by-episode/${projectId}`),
        axios.get(`/api/projects/${projectId}`)
      ]);
      setComparisonData(compRes.data);
      setLocationData(locRes.data);
      setEpisodeData(epRes.data);
      if (onProjectLoad) {
        onProjectLoad(projectRes.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVarianceDetails = async (category) => {
    try {
      const response = await axios.get(`/api/reports/variance/${projectId}?category=${encodeURIComponent(category)}`);
      setVarianceData(response.data);
      setSelectedCategory(category);
    } catch (error) {
      console.error('Error fetching variance details:', error);
    }
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

  if (!comparisonData) {
    return <div className="alert alert-error">Failed to load comparison data</div>;
  }

  const { categories, totals } = comparisonData;

  // Prepare chart data
  const chartData = categories.map(cat => ({
    name: cat.category,
    Budgeted: cat.budgeted,
    Actual: cat.actual,
    variance: cat.variance
  }));

  return (
    <div>
      {/* Overall Summary */}
      <div className="summary-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="summary-card">
          <div className="summary-label">Total Budgeted</div>
          <div className="summary-value">{formatCurrency(totals.budgeted)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Total Actual</div>
          <div className="summary-value">{formatCurrency(totals.actual)}</div>
        </div>
        <div className={`summary-card ${totals.status === 'over_budget' ? 'over-budget' : 'under-budget'}`}>
          <div className="summary-label">Total Variance</div>
          <div className={`summary-value ${totals.variance < 0 ? 'negative' : 'positive'}`}>
            {totals.variance < 0 ? '-' : '+'}{formatCurrency(Math.abs(totals.variance))}
          </div>
          <div className="summary-detail">
            {totals.variance < 0 ? 'Over' : 'Under'} budget by {Math.abs(totals.variance_percent)}%
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'category' ? 'active' : ''}`}
          onClick={() => setActiveTab('category')}
        >
          By Category
        </button>
        <button
          className={`tab ${activeTab === 'location' ? 'active' : ''}`}
          onClick={() => setActiveTab('location')}
        >
          By Location
        </button>
        <button
          className={`tab ${activeTab === 'episode' ? 'active' : ''}`}
          onClick={() => setActiveTab('episode')}
        >
          By Episode
        </button>
      </div>

      {/* Category Comparison */}
      {activeTab === 'category' && (
        <>
          {/* Chart */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 className="card-title" style={{ marginBottom: '1rem' }}>Budget vs Actual Comparison</h3>
            <div className="chart-container" style={{ height: '400px' }}>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                      fontSize={11}
                      height={100}
                    />
                    <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value, name) => [formatCurrency(value), name]}
                      labelStyle={{ fontWeight: 'bold' }}
                    />
                    <Legend />
                    <Bar dataKey="Budgeted" fill="#2563eb" name="Budgeted" />
                    <Bar dataKey="Actual" name="Actual">
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.variance >= 0 ? '#10b981' : '#ef4444'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state">
                  <p>No data to compare. Add budget items and ledger entries.</p>
                </div>
              )}
            </div>
          </div>

          {/* Comparison Table */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '1rem' }}>Category Breakdown</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Budgeted</th>
                    <th>Actual</th>
                    <th>Variance</th>
                    <th>% Variance</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map(cat => (
                    <tr
                      key={cat.category}
                      className={`comparison-row ${cat.status === 'over_budget' ? 'over-budget' : ''}`}
                    >
                      <td><strong>{cat.category}</strong></td>
                      <td className="amount">{formatCurrency(cat.budgeted)}</td>
                      <td className="amount">{formatCurrency(cat.actual)}</td>
                      <td className={`amount ${cat.variance < 0 ? 'negative' : 'positive'}`}>
                        {cat.variance < 0 ? '-' : '+'}{formatCurrency(Math.abs(cat.variance))}
                      </td>
                      <td className={cat.variance < 0 ? 'negative' : 'positive'}>
                        {cat.variance < 0 ? '' : '+'}{cat.variance_percent}%
                      </td>
                      <td>
                        <span className={`badge ${cat.status === 'over_budget' ? 'badge-danger' : 'badge-success'}`}>
                          {cat.status === 'over_budget' ? 'Over' : 'Under'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => fetchVarianceDetails(cat.category)}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 'bold', background: 'var(--gray-100)' }}>
                    <td>TOTAL</td>
                    <td className="amount">{formatCurrency(totals.budgeted)}</td>
                    <td className="amount">{formatCurrency(totals.actual)}</td>
                    <td className={`amount ${totals.variance < 0 ? 'negative' : 'positive'}`}>
                      {totals.variance < 0 ? '-' : '+'}{formatCurrency(Math.abs(totals.variance))}
                    </td>
                    <td className={totals.variance < 0 ? 'negative' : 'positive'}>
                      {totals.variance < 0 ? '' : '+'}{totals.variance_percent}%
                    </td>
                    <td>
                      <span className={`badge ${totals.status === 'over_budget' ? 'badge-danger' : 'badge-success'}`}>
                        {totals.status === 'over_budget' ? 'Over' : 'Under'}
                      </span>
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Variance Details Modal */}
          {selectedCategory && varianceData && (
            <div className="modal-overlay" onClick={() => setSelectedCategory(null)}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
                <div className="modal-header">
                  <h3 className="modal-title">{selectedCategory} - Details</h3>
                  <button className="modal-close" onClick={() => setSelectedCategory(null)}>&times;</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ padding: '1rem', background: 'var(--gray-50)', borderRadius: '0.375rem' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>Budgeted</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{formatCurrency(varianceData.budget_total)}</div>
                  </div>
                  <div style={{ padding: '1rem', background: 'var(--gray-50)', borderRadius: '0.375rem' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>Actual</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{formatCurrency(varianceData.actual_total)}</div>
                  </div>
                </div>

                <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>Budget Items ({varianceData.budget_items.length})</h4>
                {varianceData.budget_items.length > 0 ? (
                  <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th>Location</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {varianceData.budget_items.map(item => (
                          <tr key={item.id}>
                            <td>{item.description || '-'}</td>
                            <td>{item.location_name || '-'}</td>
                            <td className="amount">{formatCurrency(item.budgeted_amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ color: 'var(--gray-500)' }}>No budget items</p>
                )}

                <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>Ledger Entries ({varianceData.ledger_entries.length})</h4>
                {varianceData.ledger_entries.length > 0 ? (
                  <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Description</th>
                          <th>Vendor</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {varianceData.ledger_entries.map(entry => (
                          <tr key={entry.id}>
                            <td>{entry.date || '-'}</td>
                            <td>{entry.description?.substring(0, 30) || '-'}</td>
                            <td>{entry.vendor || '-'}</td>
                            <td className="amount">{formatCurrency(entry.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ color: 'var(--gray-500)' }}>No ledger entries</p>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Location Comparison */}
      {activeTab === 'location' && (
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '1rem' }}>Spending by Location</h3>
          {locationData.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Location</th>
                    <th>Budgeted</th>
                    <th>Spent</th>
                    <th>Variance</th>
                    <th>Entries</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {locationData.map(loc => (
                    <tr key={loc.location_name} className={loc.variance < 0 ? 'comparison-row over-budget' : ''}>
                      <td><strong>{loc.location_name}</strong></td>
                      <td className="amount">{formatCurrency(loc.budgeted)}</td>
                      <td className="amount">{formatCurrency(loc.total_spent)}</td>
                      <td className={`amount ${loc.variance < 0 ? 'negative' : 'positive'}`}>
                        {loc.variance < 0 ? '-' : '+'}{formatCurrency(Math.abs(loc.variance))}
                      </td>
                      <td>{loc.entry_count}</td>
                      <td>
                        <span className={`badge ${loc.variance < 0 ? 'badge-danger' : 'badge-success'}`}>
                          {loc.variance < 0 ? 'Over' : 'Under'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p>No location data available. Add location names to your entries.</p>
            </div>
          )}
        </div>
      )}

      {/* Episode Comparison */}
      {activeTab === 'episode' && (
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '1rem' }}>Spending by Episode</h3>
          {episodeData.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Episode</th>
                    <th>Budgeted</th>
                    <th>Spent</th>
                    <th>Variance</th>
                    <th>Entries</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {episodeData.map(ep => (
                    <tr key={ep.episode} className={ep.variance < 0 ? 'comparison-row over-budget' : ''}>
                      <td><strong>{ep.episode}</strong></td>
                      <td className="amount">{formatCurrency(ep.budgeted)}</td>
                      <td className="amount">{formatCurrency(ep.total_spent)}</td>
                      <td className={`amount ${ep.variance < 0 ? 'negative' : 'positive'}`}>
                        {ep.variance < 0 ? '-' : '+'}{formatCurrency(Math.abs(ep.variance))}
                      </td>
                      <td>{ep.entry_count}</td>
                      <td>
                        <span className={`badge ${ep.variance < 0 ? 'badge-danger' : 'badge-success'}`}>
                          {ep.variance < 0 ? 'Over' : 'Under'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p>No episode data available. Add episode numbers to your entries.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Comparison;
