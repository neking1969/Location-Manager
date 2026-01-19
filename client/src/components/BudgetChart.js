import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';

const COST_CATEGORIES = ['Loc Fees', 'Security', 'Fire', 'Rentals', 'Permits', 'Police'];

function BudgetChart({ sets, title }) {
  // Aggregate data by category across all sets
  const categoryData = COST_CATEGORIES.map(category => {
    const budgetKey = `budget_${category.toLowerCase().replace(' ', '_')}`;
    const actualKey = `actual_${category.toLowerCase().replace(' ', '_')}`;

    const budget = sets.reduce((sum, set) => {
      const key = category === 'Loc Fees' ? 'budget_loc_fees' : budgetKey;
      return sum + (set[key] || 0);
    }, 0);

    const actual = sets.reduce((sum, set) => {
      const key = category === 'Loc Fees' ? 'actual_loc_fees' : actualKey;
      return sum + (set[key] || 0);
    }, 0);

    return {
      category: category.length > 8 ? category.substring(0, 7) + '.' : category,
      fullCategory: category,
      Budget: budget,
      Actual: actual,
      variance: budget - actual,
      isOver: actual > budget
    };
  });

  const formatCurrency = (value) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const variance = data.Budget - data.Actual;
      const isOver = variance < 0;

      return (
        <div style={{
          background: 'white',
          padding: '12px',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <p style={{ fontWeight: '600', marginBottom: '8px' }}>{data.fullCategory}</p>
          <p style={{ color: '#2563eb', margin: '4px 0' }}>
            Budget: ${data.Budget.toLocaleString()}
          </p>
          <p style={{ color: '#10b981', margin: '4px 0' }}>
            Actual: ${data.Actual.toLocaleString()}
          </p>
          <p style={{
            color: isOver ? '#ef4444' : '#10b981',
            fontWeight: '600',
            marginTop: '8px',
            borderTop: '1px solid #e5e7eb',
            paddingTop: '8px'
          }}>
            {isOver ? 'Over by' : 'Under by'}: ${Math.abs(variance).toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  // Calculate totals for the summary
  const totalBudget = categoryData.reduce((sum, d) => sum + d.Budget, 0);
  const totalActual = categoryData.reduce((sum, d) => sum + d.Actual, 0);
  const totalVariance = totalBudget - totalActual;

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div className="card-header">
        <h3 className="card-title">{title || 'Budget vs Actual by Category'}</h3>
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem' }}>
          <span style={{ color: '#2563eb' }}>Budget: {formatCurrency(totalBudget)}</span>
          <span style={{ color: '#10b981' }}>Actual: {formatCurrency(totalActual)}</span>
          <span style={{
            color: totalVariance < 0 ? '#ef4444' : '#10b981',
            fontWeight: '600'
          }}>
            {totalVariance < 0 ? 'Over' : 'Under'}: {formatCurrency(Math.abs(totalVariance))}
          </span>
        </div>
      </div>

      <div style={{ height: '300px', marginTop: '1rem' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={categoryData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="category"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={{ stroke: '#d1d5db' }}
            />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={{ stroke: '#d1d5db' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="Budget" fill="#2563eb" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Actual" radius={[4, 4, 0, 0]}>
              {categoryData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isOver ? '#ef4444' : '#10b981'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Category breakdown table */}
      <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Category</th>
              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Budget</th>
              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Actual</th>
              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Variance</th>
              <th style={{ padding: '0.5rem', textAlign: 'right' }}>% Used</th>
            </tr>
          </thead>
          <tbody>
            {categoryData.map((row, index) => {
              const percentUsed = row.Budget > 0 ? (row.Actual / row.Budget * 100).toFixed(0) : 0;
              return (
                <tr key={index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.5rem' }}>{row.fullCategory}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'monospace' }}>
                    ${row.Budget.toLocaleString()}
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'monospace' }}>
                    ${row.Actual.toLocaleString()}
                  </td>
                  <td style={{
                    padding: '0.5rem',
                    textAlign: 'right',
                    fontFamily: 'monospace',
                    color: row.isOver ? '#ef4444' : '#10b981',
                    fontWeight: row.isOver ? '600' : 'normal'
                  }}>
                    {row.isOver ? '-' : '+'}${Math.abs(row.variance).toLocaleString()}
                  </td>
                  <td style={{
                    padding: '0.5rem',
                    textAlign: 'right',
                    color: percentUsed > 100 ? '#ef4444' : percentUsed > 80 ? '#f59e0b' : '#10b981'
                  }}>
                    {percentUsed}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default BudgetChart;
