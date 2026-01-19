/**
 * Export data to CSV and trigger download
 */

const COST_CATEGORIES = ['Loc Fees', 'Security', 'Fire', 'Rentals', 'Permits', 'Police'];

/**
 * Convert array of objects to CSV string
 */
function objectsToCSV(data, headers) {
  if (!data || data.length === 0) return '';

  const headerRow = headers.join(',');
  const rows = data.map(obj =>
    headers.map(header => {
      const value = obj[header];
      // Escape values that contain commas, quotes, or newlines
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',')
  );

  return [headerRow, ...rows].join('\n');
}

/**
 * Trigger CSV file download
 */
function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export project summary to CSV
 */
export function exportProjectSummary(project, episodes, summary) {
  const data = [{
    'Project Name': project.name,
    'Production Company': project.production_company || '',
    'Start Date': project.start_date || '',
    'End Date': project.end_date || '',
    'Total Budget': summary?.total_budget || 0,
    'Total Actual': summary?.total_actual || 0,
    'Variance': summary?.variance || 0,
    'Variance %': summary?.variance_percent || 0,
    'Status': summary?.status === 'over_budget' ? 'Over Budget' : 'Under Budget',
    'Episode Count': episodes.length,
    'Set Count': summary?.set_count || 0,
    'Cost Entry Count': summary?.entry_count || 0
  }];

  const headers = Object.keys(data[0]);
  const csv = objectsToCSV(data, headers);
  downloadCSV(csv, `${project.name.replace(/\s+/g, '_')}_summary.csv`);
}

/**
 * Export all sets with budgets to CSV
 */
export function exportSetsToCSV(sets, projectName, episodeName) {
  const data = sets.map(set => {
    const totalBudget = (set.budget_loc_fees || 0) + (set.budget_security || 0) +
      (set.budget_fire || 0) + (set.budget_rentals || 0) +
      (set.budget_permits || 0) + (set.budget_police || 0);

    const totalActual = (set.actual_loc_fees || 0) + (set.actual_security || 0) +
      (set.actual_fire || 0) + (set.actual_rentals || 0) +
      (set.actual_permits || 0) + (set.actual_police || 0);

    return {
      'Set Name': set.set_name,
      'Location': set.location || '',
      'Budget - Loc Fees': set.budget_loc_fees || 0,
      'Budget - Security': set.budget_security || 0,
      'Budget - Fire': set.budget_fire || 0,
      'Budget - Rentals': set.budget_rentals || 0,
      'Budget - Permits': set.budget_permits || 0,
      'Budget - Police': set.budget_police || 0,
      'Total Budget': totalBudget,
      'Actual - Loc Fees': set.actual_loc_fees || 0,
      'Actual - Security': set.actual_security || 0,
      'Actual - Fire': set.actual_fire || 0,
      'Actual - Rentals': set.actual_rentals || 0,
      'Actual - Permits': set.actual_permits || 0,
      'Actual - Police': set.actual_police || 0,
      'Total Actual': totalActual,
      'Variance': totalBudget - totalActual,
      'Status': totalActual > totalBudget ? 'Over Budget' : 'Under Budget'
    };
  });

  const headers = Object.keys(data[0] || {});
  const csv = objectsToCSV(data, headers);
  const filename = episodeName
    ? `${projectName.replace(/\s+/g, '_')}_${episodeName.replace(/\s+/g, '_')}_sets.csv`
    : `${projectName.replace(/\s+/g, '_')}_sets.csv`;
  downloadCSV(csv, filename);
}

/**
 * Export cost entries to CSV
 */
export function exportCostEntries(costEntries, setName, projectName) {
  const data = costEntries.map(entry => ({
    'Category': entry.category,
    'Description': entry.description || '',
    'Amount': entry.amount,
    'Vendor': entry.vendor || '',
    'Date': entry.date || '',
    'Invoice #': entry.invoice_number || '',
    'PO #': entry.po_number || '',
    'Check #': entry.check_number || '',
    'Payment Status': entry.payment_status || 'pending'
  }));

  const headers = Object.keys(data[0] || {});
  const csv = objectsToCSV(data, headers);
  const filename = `${projectName.replace(/\s+/g, '_')}_${setName.replace(/\s+/g, '_')}_costs.csv`;
  downloadCSV(csv, filename);
}

/**
 * Export budget vs actual comparison by category to CSV
 */
export function exportCategoryComparison(sets, projectName) {
  const categoryTotals = COST_CATEGORIES.map(category => {
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

    const variance = budget - actual;
    const percentUsed = budget > 0 ? ((actual / budget) * 100).toFixed(1) : 0;

    return {
      'Category': category,
      'Budget': budget,
      'Actual': actual,
      'Variance': variance,
      '% Used': percentUsed,
      'Status': actual > budget ? 'Over Budget' : 'Under Budget'
    };
  });

  // Add totals row
  const totalBudget = categoryTotals.reduce((sum, c) => sum + c.Budget, 0);
  const totalActual = categoryTotals.reduce((sum, c) => sum + c.Actual, 0);
  categoryTotals.push({
    'Category': 'TOTAL',
    'Budget': totalBudget,
    'Actual': totalActual,
    'Variance': totalBudget - totalActual,
    '% Used': totalBudget > 0 ? ((totalActual / totalBudget) * 100).toFixed(1) : 0,
    'Status': totalActual > totalBudget ? 'Over Budget' : 'Under Budget'
  });

  const headers = Object.keys(categoryTotals[0]);
  const csv = objectsToCSV(categoryTotals, headers);
  downloadCSV(csv, `${projectName.replace(/\s+/g, '_')}_category_comparison.csv`);
}

export default {
  exportProjectSummary,
  exportSetsToCSV,
  exportCostEntries,
  exportCategoryComparison
};
