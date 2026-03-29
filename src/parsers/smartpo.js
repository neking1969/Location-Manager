/**
 * SmartPO Parser - Parses SmartPO Excel export files
 */

import XLSX from 'xlsx';

/**
 * Parse a SmartPO Excel file buffer
 */
export function parseSmartPO(buffer, filename) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const purchaseOrders = [];

  // Usually first sheet contains PO data
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (data.length === 0) {
    return { purchaseOrders: [], error: 'Empty file' };
  }

  // First row is headers
  const headers = data[0].map(h => String(h || '').toLowerCase().trim());

  // Find column indices
  const poNumCol = headers.findIndex(h => h.includes('po') && (h.includes('num') || h.includes('#')));
  const vendorCol = headers.findIndex(h => h.includes('vendor') || h.includes('payee'));
  const descCol = headers.findIndex(h => h.includes('desc') || h.includes('memo'));
  const amountCol = headers.findIndex(h => h.includes('amount') || h.includes('total'));
  const statusCol = headers.findIndex(h => h.includes('status'));
  const dateCol = headers.findIndex(h => h.includes('date'));
  const deptCol = headers.findIndex(h => h.includes('dept') || h.includes('department'));
  const episodeCol = headers.findIndex(h => h.includes('episode') || h.includes('ep'));

  // Parse data rows
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const poNumber = poNumCol >= 0 ? String(row[poNumCol] || '').trim() : '';
    const vendor = vendorCol >= 0 ? String(row[vendorCol] || '').trim() : '';
    const description = descCol >= 0 ? String(row[descCol] || '').trim() : '';
    const amount = amountCol >= 0 ? parseFloat(row[amountCol]) || 0 : 0;
    const status = statusCol >= 0 ? String(row[statusCol] || '').trim() : '';
    const date = dateCol >= 0 ? formatDate(row[dateCol]) : '';
    const department = deptCol >= 0 ? String(row[deptCol] || '').trim() : '';
    const episode = episodeCol >= 0 ? String(row[episodeCol] || '').trim() : '';

    if (poNumber || vendor || amount) {
      purchaseOrders.push({
        poNumber,
        vendor,
        description,
        amount,
        status,
        date,
        department,
        episode: episode || inferEpisode(description),
        category: inferCategory(description, department)
      });
    }
  }

  return {
    filename,
    parsedAt: new Date().toISOString(),
    purchaseOrders,
    totalPOs: purchaseOrders.length,
    totalAmount: purchaseOrders.reduce((sum, po) => sum + po.amount, 0),
    byStatus: groupBy(purchaseOrders, 'status')
  };
}

/**
 * Format Excel date to ISO string
 */
function formatDate(value) {
  if (!value) return '';

  // If it's an Excel serial number
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }

  // Try to parse as string date
  try {
    const date = new Date(value);
    if (!isNaN(date)) {
      return date.toISOString().split('T')[0];
    }
  } catch {
    // Fall through
  }

  return String(value);
}

/**
 * Try to infer episode from description
 */
function inferEpisode(description) {
  if (!description) return '';

  // Look for patterns like "EP101", "Episode 101", "101", etc.
  const patterns = [
    /EP\s*(\d{3})/i,
    /Episode\s*(\d{3})/i,
    /\b(10[1-6])\b/  // Episodes 101-106
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return '';
}

/**
 * Infer category from description/department
 */
function inferCategory(description, department) {
  const text = `${description} ${department}`.toUpperCase();

  const categories = {
    'Security': ['SECURITY', 'GUARD'],
    'Police': ['POLICE', 'SHERIFF', 'LAPD', 'CHP'],
    'Fire': ['FIRE', 'EMT'],
    'Permits': ['PERMIT', 'FILM LA'],
    'Locations': ['LOCATION', 'SITE', 'VENUE'],
    'Catering': ['CATERING', 'CRAFT', 'FOOD'],
    'Equipment': ['EQUIPMENT', 'RENTAL', 'GRIP', 'ELECTRIC']
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(kw => text.includes(kw))) {
      return category;
    }
  }

  return 'Other';
}

/**
 * Group array by property
 */
function groupBy(array, prop) {
  return array.reduce((groups, item) => {
    const key = item[prop] || 'Unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {});
}

export default {
  parseSmartPO
};
