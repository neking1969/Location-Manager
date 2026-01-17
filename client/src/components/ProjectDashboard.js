import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function ProjectDashboard({ onProjectLoad }) {
  const { projectId } = useParams();
  const [dashboardData, setDashboardData] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, [projectId]);

  const fetchDashboard = async () => {
    try {
      const [dashRes, compRes] = await Promise.all([
        axios.get(`/api/reports/dashboard/${projectId}`),
        axios.get(`/api/reports/comparison/${projectId}`)
      ]);
      setDashboardData(dashRes.data);
      setComparisonData(compRes.data);
      if (onProjectLoad && dashRes.data.project) {
        onProjectLoad(dashRes.data.project);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
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

  if (!dashboardData) {
    return <div className="alert alert-error">Failed to load dashboard data</div>;
  }

  const { project, summary, over_budget_categories, recent_entries } = dashboardData;
  const isOverBudget = summary.variance < 0;

  // Prepare chart data
  const chartData = comparisonData?.categories?.map(cat => ({
    name: cat.category.replace('/', '/\n'),
    Budgeted: cat.budgeted,
    Actual: cat.actual
  })) || [];

  const pieData = comparisonData?.categories?.filter(c => c.actual > 0).map(cat => ({
    name: cat.category,
    value: cat.actual
  })) || [];

  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.5rem' }}>{project.name}</h2>
        {project.production_company && (
          <p style={{ color: 'var(--gray-500)' }}>{project.production_company}</p>
        )}
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-label">Total Budgeted</div>
          <div className="summary-value">{formatCurrency(summary.total_budgeted)}</div>
          <div className="summary-detail">{summary.budget_item_count} budget items</div>
        </div>

        <div className="summary-card">
          <div className="summary-label">Total Spent</div>
          <div className="summary-value">{formatCurrency(summary.total_actual)}</div>
          <div className="summary-detail">{summary.ledger_entry_count} ledger entries</div>
        </div>

        <div className={`summary-card ${isOverBudget ? 'over-budget' : 'under-budget'}`}>
          <div className="summary-label">Variance</div>
          <div className={`summary-value ${isOverBudget ? 'negative' : 'positive'}`}>
            {isOverBudget ? '-' : '+'}{formatCurrency(Math.abs(summary.variance))}
          </div>
          <div className="summary-detail">
            {isOverBudget ? 'Over' : 'Under'} budget by {Math.abs(summary.variance_percent)}%
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-label">Budget Used</div>
          <div className="summary-value">
            {summary.total_budgeted > 0
              ? Math.round((summary.total_actual / summary.total_budgeted) * 100)
              : 0}%
          </div>
          <div className="progress-bar">
            <div
              className={`progress-fill ${
                summary.total_actual > summary.total_budgeted
                  ? 'over'
                  : summary.total_actual > summary.total_budgeted * 0.9
                  ? 'warning'
                  : 'under'
              }`}
              style={{
                width: `${Math.min(100, summary.total_budgeted > 0
                  ? (summary.total_actual / summary.total_budgeted) * 100
                  : 0)}%`
              }}
            />
          </div>
        </div>
      </div>

      {/* Over Budget Alerts */}
      {over_budget_categories.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>
          <strong>Budget Alerts:</strong> {over_budget_categories.length} categories are over budget
          <ul style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
            {over_budget_categories.map(cat => (
              <li key={cat.category}>
                {cat.category}: Over by {formatCurrency(cat.over_by)} ({cat.over_percent}%)
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '1rem' }}>Budget vs Actual by Category</h3>
          <div className="chart-container">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                    fontSize={10}
                    height={80}
                  />
                  <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="Budgeted" fill="#2563eb" />
                  <Bar dataKey="Actual" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">
                <p>No data to display</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '1rem' }}>Spending Distribution</h3>
          <div className="chart-container">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      percent > 0.05 ? `${name.substring(0, 10)}... ${(percent * 100).toFixed(0)}%` : ''
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">
                <p>No spending data yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Entries */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3 className="card-title" style={{ marginBottom: '1rem' }}>Recent Ledger Entries</h3>
        {recent_entries.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Vendor</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {recent_entries.map(entry => (
                  <tr key={entry.id}>
                    <td>{entry.date || '-'}</td>
                    <td>{entry.category}</td>
                    <td>{entry.description?.substring(0, 50) || '-'}</td>
                    <td>{entry.vendor || '-'}</td>
                    <td className="amount">{formatCurrency(entry.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No ledger entries yet. Upload a PDF or add entries manually.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectDashboard;
