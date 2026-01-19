const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const pdfParse = require('pdf-parse');
const { getDatabase, findById, findAll, insert, remove, saveDatabase, COST_CATEGORIES } = require('../database');

// Account code to category mapping for Disney/Fox production ledgers
const ACCOUNT_CODE_MAP = {
  '6302': 'Loc Fees',   // LOCATION FEES
  '6303': 'Loc Fees',   // LOCATION RENTAL
  '6304': 'Security',   // LOCATION SECURITY
  '6305': 'Police',     // LOCATION POLICE
  '6306': 'Police',     // LOCATION TRAFFIC CONTROL
  '6307': 'Fire',       // LOCATION FIREMAN
  '6308': 'Fire',       // LOCATION FIRE SAFETY
  '6340': 'Permits',    // PERMITS
  '6341': 'Permits',    // LICENSES
  '6342': 'Rentals',    // FEES & PERMITS (default, subcategorize by description)
  '6350': 'Rentals',    // EQUIPMENT RENTAL
  '6360': 'Rentals'     // MISCELLANEOUS RENTAL
};

// Keywords to subcategorize 6342 (Fees & Permits) entries
const SUBCATEGORY_KEYWORDS = {
  'Permits': ['permit', 'permits', 'license', 'film la', 'filming permit'],
  'Rentals': ['tent', 'tents', 'table', 'tables', 'chair', 'chairs', 'restroom', 'hvac', 'dumpster', 'air scrubber', 'generator', 'heater'],
  'Loc Fees': ['layout', 'maps', 'survey', 'scout']
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for large ledgers
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, CSV, and Excel files are allowed.'));
    }
  }
});

// Detect if PDF is a production ledger format
function isLedgerFormat(text) {
  // Check for common ledger indicators
  const hasLedgerKeyword = text.includes('General Ledger') ||
                           text.includes('GL 505') ||
                           text.includes('Ledger Detail') ||
                           text.includes('Cost Report');

  const hasAccountPattern = /Acct:\s*\d{4}/.test(text) ||
                            /Account[:\s]+\d{4}/.test(text);

  // Check if text contains lines with known account codes
  const hasKnownAccounts = Object.keys(ACCOUNT_CODE_MAP).some(code =>
    new RegExp(`^${code}\\s`, 'm').test(text)
  );

  return hasLedgerKeyword || hasAccountPattern || hasKnownAccounts;
}

// Parse production ledger PDF
function parseLedgerPDF(text) {
  const entries = [];
  const lines = text.split('\n');

  let currentAccount = null;
  let currentAccountName = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect account header - multiple formats:
    // "Acct: 6304 - LOCATION SECURITY"
    // "Account: 6304 LOCATION SECURITY"
    // "6304 - LOCATION SECURITY" (standalone)
    // "Account 6304"
    const accountMatch = line.match(/(?:Acct|Account)?[:\s]*(\d{4})\s*[-:]?\s*([A-Z][A-Z\s&]+)?/i);
    if (accountMatch && ACCOUNT_CODE_MAP[accountMatch[1]]) {
      currentAccount = accountMatch[1];
      currentAccountName = accountMatch[2]?.trim() || `Account ${currentAccount}`;
      continue;
    }

    // Skip header rows and empty lines
    if (!line || line.startsWith('Account') || line.startsWith('GL 505') || line.includes('Page')) {
      continue;
    }

    // Try to parse a data row
    // Format: Account LO EPI SET ... Description Vendor Trans# TT ... Amount
    // The amount is typically at the end, and episode is near the start

    // Look for lines that start with a known account code
    const lineAccountMatch = line.match(/^(\d{4})/);
    if (lineAccountMatch) {
      const lineAccount = lineAccountMatch[1];
      // If we have a current account context, use it; otherwise try the line's account
      const accountToUse = currentAccount || (ACCOUNT_CODE_MAP[lineAccount] ? lineAccount : null);
      const accountNameToUse = currentAccountName || `Account ${lineAccount}`;

      if (accountToUse) {
        const entry = parseLedgerLine(line, accountToUse, accountNameToUse);
        if (entry) {
          entries.push(entry);
        }
      }
    }
  }

  return entries;
}

// Parse a single ledger line - Disney GL 505 format
// Format: Account LO EPI SET WC WS F1-F4 IN TaxCode TransferCode Description Vendor Trans# TT JS Cur Period PONum Doc# EffDate PayNum Amount
function parseLedgerLine(line, accountCode, accountName) {
  // Split by multiple spaces to get columns
  const parts = line.split(/\s{2,}/).filter(p => p.trim());

  // Need at least a few parts with an amount
  if (parts.length < 3) return null;

  // Extract amount from end of line (always has 2 decimal places)
  const amountMatch = line.match(/(-?[\d,]+\.\d{2})$/);
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  if (isNaN(amount) || amount === 0) return null;

  // Parse the beginning columns: Account LO EPI SET
  // Format: "6305    01    101         QW"
  const startMatch = line.match(/^(\d{4})\s+(\d{2})\s+(\d{2,4})?/);
  let episode = null;
  if (startMatch) {
    // Episode is in the 3rd position
    episode = startMatch[3] || null;
  } else {
    // Fallback: look for 3-digit episode pattern anywhere in first part
    const episodeMatch = line.match(/\b(10[0-9]{1,2}|[1-9][0-9]{2})\b/);
    episode = episodeMatch ? episodeMatch[1] : null;
  }

  // Extract effective date (format: MM/DD/YYYY near end of line)
  const effDateMatch = line.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s+[\d,]+\.\d{2}$/);
  const date = effDateMatch ? normalizeDate(effDateMatch[1]) : null;

  // Extract description - look for the description column
  // Format in GL505: "10/25/25 : ALBIN, W : REGULAR 1X" or similar
  let description = '';
  let personName = '';

  // Look for description pattern: "MM/DD/YY : NAME : TYPE"
  const descMatch = line.match(/(\d{1,2}\/\d{1,2}\/\d{2})\s*:\s*([A-Z]+,\s*[A-Z])\s*:\s*([A-Z0-9\s]+?)(?=\s{2,})/i);
  if (descMatch) {
    personName = descMatch[2]; // "ALBIN, W"
    const payType = descMatch[3].trim(); // "REGULAR 1X"
    description = `${personName} - ${payType}`;
  } else {
    // Fallback: try to extract any text that looks like a description
    const fallbackMatch = line.match(/(?:QW|QE|USA)\s+(.+?)(?=\s{2,}[A-Z])/);
    if (fallbackMatch) {
      description = fallbackMatch[1].trim();
    }
  }

  // Extract vendor name - typically in CAPS before transaction number
  let vendor = '';
  const vendorMatch = line.match(/([A-Z][A-Z\s]+(?:PARTNERS|INC|LLC|CO|CORP|SERVICES?))\s+\d{3,}/i);
  if (vendorMatch) {
    vendor = vendorMatch[1].trim();
  }

  // Extract location from SET column or description
  let location = 'General';
  // Try to find SET code in early columns
  const setMatch = line.match(/^\d{4}\s+\d{2}\s+\d{2,4}\s+([A-Z][A-Z0-9]+)/);
  if (setMatch && setMatch[1].length > 1) {
    location = formatLocationName(setMatch[1]);
  }

  // Determine category from account code
  let category = ACCOUNT_CODE_MAP[accountCode] || 'Loc Fees';

  // Subcategorize 6342 entries based on description
  if (accountCode === '6342') {
    category = subcategorize6342(description);
  }

  return {
    account_code: accountCode,
    account_name: accountName,
    episode,
    location,
    category,
    description: description || `${accountName} charge`,
    vendor,
    amount,
    date,
    raw_line: line
  };
}

// Also add a specialized parser for Disney police/security payroll format
function parseDisneyPayrollLine(line, accountCode, accountName) {
  // Format: 6305 01 101 QW 10/25/25:NAME,I:TYPE VENDOR 1449 PR PR USD 8 PONum Date Amount

  const amountMatch = line.match(/(-?[\d,]+\.\d{2})$/);
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  if (isNaN(amount) || amount === 0) return null;

  // Extract episode (3rd column)
  const colMatch = line.match(/^(\d{4})\s+(\d{2})\s+(\d{2,4})/);
  const episode = colMatch ? colMatch[3] : null;

  // Extract person and pay type from description
  const payrollMatch = line.match(/(\d{1,2}\/\d{1,2}\/\d{2})\s*:\s*([A-Z]+,\s*[A-Z])\s*:\s*([A-Z0-9\s]+)/i);
  let description = accountName;
  if (payrollMatch) {
    const name = payrollMatch[2];
    const payType = payrollMatch[3].trim();
    description = `${name} - ${payType}`;
  }

  // Extract effective date
  const dateMatch = line.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s+[\d,]+\.\d{2}$/);
  const date = dateMatch ? normalizeDate(dateMatch[1]) : null;

  // Vendor
  const vendorMatch = line.match(/([A-Z][A-Z\s]+(?:PARTNERS|INC|LLC))\s+\d{3,}/i);
  const vendor = vendorMatch ? vendorMatch[1].trim() : '';

  return {
    account_code: accountCode,
    account_name: accountName,
    episode,
    location: 'General',
    category: ACCOUNT_CODE_MAP[accountCode] || 'Loc Fees',
    description,
    vendor,
    amount,
    date,
    raw_line: line
  };
}


// Extract location name from description
function extractLocationFromDescription(description, accountName) {
  if (!description) return 'General';

  // Common patterns: "SECURITY:LATCHFORD HOUSE", "FIRE (102)", "LAYOUT:BUCKLEY GYM"
  const colonMatch = description.match(/[A-Z]+:([A-Z][A-Z\s]+)/);
  if (colonMatch) {
    return formatLocationName(colonMatch[1].trim());
  }

  // Pattern: remove date prefix and category prefix
  let cleaned = description
    .replace(/^\d{2}\/\d{2}[-\/]\d{2}\/?\d{0,2}\s*/, '') // Remove date prefix
    .replace(/^(SECURITY|FIRE|POLICE|PERMITS?|LAYOUT|RESTROOM|TENTS?|DRIVING)[\s:]+/i, ''); // Remove category prefix

  if (cleaned && cleaned.length > 2) {
    return formatLocationName(cleaned.split(/\s{2,}/)[0]);
  }

  return 'General';
}

// Format location name to title case
function formatLocationName(name) {
  if (!name) return 'General';
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Subcategorize 6342 (Fees & Permits) based on description keywords
function subcategorize6342(description) {
  const lowerDesc = (description || '').toLowerCase();

  for (const [category, keywords] of Object.entries(SUBCATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lowerDesc.includes(kw))) {
      return category;
    }
  }

  return 'Rentals'; // Default for 6342
}

// Normalize date format
function normalizeDate(dateStr) {
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    let [month, day, year] = parts;
    if (year.length === 2) {
      year = '20' + year;
    }
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

// Group entries by episode and location
function groupEntries(entries) {
  const grouped = {};

  for (const entry of entries) {
    const key = `${entry.episode || 'unknown'}_${entry.location || 'General'}`;
    if (!grouped[key]) {
      grouped[key] = {
        episode: entry.episode,
        location: entry.location,
        entries: [],
        totals: {}
      };
    }
    grouped[key].entries.push(entry);

    // Accumulate totals by category
    if (!grouped[key].totals[entry.category]) {
      grouped[key].totals[entry.category] = 0;
    }
    grouped[key].totals[entry.category] += entry.amount;
  }

  return Object.values(grouped);
}

// Legacy PDF parsing for non-ledger formats
async function parsePDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return extractCostData(data.text);
}

function extractCostData(text) {
  const lines = text.split('\n').filter(line => line.trim());
  const entries = [];
  const amountPattern = /\$?\s*([\d,]+\.?\d*)/;
  const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;

  for (const line of lines) {
    const amountMatch = line.match(amountPattern);
    if (amountMatch) {
      const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
      if (amount > 0 && amount < 10000000) {
        const dateMatch = line.match(datePattern);
        const category = categorizeEntry(line);
        entries.push({
          description: line.trim().substring(0, 200),
          amount,
          date: dateMatch ? normalizeDate(dateMatch[1]) : null,
          category,
          raw_text: line.trim()
        });
      }
    }
  }
  return entries;
}

function categorizeEntry(text) {
  const lowerText = text.toLowerCase();
  const categoryKeywords = {
    'Loc Fees': ['location fee', 'rental fee', 'site fee', 'venue fee', 'location rental', 'loc fee', 'facility fee'],
    'Security': ['security', 'guard', 'watchman', 'patrol'],
    'Fire': ['fire', 'fire safety', 'fire watch', 'fire marshal', 'fdny', 'lafd'],
    'Rentals': ['rental', 'equipment', 'generator', 'tent', 'table', 'chair', 'power dist'],
    'Permits': ['permit', 'license', 'filming permit', 'city permit', 'county permit', 'film la'],
    'Police': ['police', 'off-duty', 'officer', 'lapd', 'nypd', 'pd', 'traffic control']
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return category;
    }
  }
  return 'Loc Fees';
}

// Upload and parse production ledger PDF
router.post('/ledger/:projectId', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const dataBuffer = fs.readFileSync(req.file.path);
    const data = await pdfParse(dataBuffer);
    const text = data.text;

    // Check if it's a ledger format
    if (!isLedgerFormat(text)) {
      return res.status(400).json({
        error: 'This does not appear to be a production ledger PDF. Please upload a GL 505 General Ledger report.'
      });
    }

    const fileId = uuidv4();
    const entries = parseLedgerPDF(text);
    const grouped = groupEntries(entries);

    // Save file record
    insert('uploaded_files', {
      id: fileId,
      project_id: req.params.projectId,
      filename: req.file.filename,
      original_name: req.file.originalname,
      file_type: 'ledger',
      file_size: req.file.size,
      parsed_data: JSON.stringify({ entries, grouped }),
      upload_type: 'ledger'
    });

    res.json({
      file_id: fileId,
      filename: req.file.originalname,
      entries_found: entries.length,
      entries,
      grouped,
      message: 'Ledger parsed successfully. Review and confirm import.'
    });
  } catch (error) {
    console.error('Ledger parse error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Import ledger entries - auto-creates episodes and sets
router.post('/ledger/import/:fileId', (req, res) => {
  try {
    const db = getDatabase();
    const { projectId } = req.body;

    const file = findById('uploaded_files', req.params.fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const parsedData = JSON.parse(file.parsed_data);
    const { entries, grouped } = parsedData;

    let episodesCreated = 0;
    let setsCreated = 0;
    let entriesImported = 0;

    // Get existing episodes
    const existingEpisodes = findAll('episodes', { project_id: projectId });
    const episodeMap = {};
    existingEpisodes.forEach(ep => {
      episodeMap[ep.episode_number || ep.name] = ep.id;
    });

    // Process each group
    for (const group of grouped) {
      const episodeNum = group.episode;

      // Create or find episode
      let episodeId = episodeMap[episodeNum];
      if (!episodeId && episodeNum) {
        const newEpisode = insert('episodes', {
          id: uuidv4(),
          project_id: projectId,
          name: episodeNum,
          episode_number: episodeNum,
          type: 'episode',
          sort_order: parseInt(episodeNum) || 999
        });
        episodeId = newEpisode.id;
        episodeMap[episodeNum] = episodeId;
        episodesCreated++;
      }

      // Create or find set for this location
      const existingSets = findAll('sets', { project_id: projectId });
      let set = existingSets.find(s =>
        s.set_name === group.location &&
        s.episode_id === episodeId
      );

      if (!set) {
        set = insert('sets', {
          id: uuidv4(),
          project_id: projectId,
          episode_id: episodeId,
          set_name: group.location,
          location: group.location,
          budget_loc_fees: 0,
          budget_security: 0,
          budget_fire: 0,
          budget_rentals: 0,
          budget_permits: 0,
          budget_police: 0
        });
        setsCreated++;
      }

      // Import entries for this group
      for (const entry of group.entries) {
        db.cost_entries.push({
          id: uuidv4(),
          set_id: set.id,
          category: entry.category,
          description: entry.description,
          vendor: entry.vendor,
          amount: entry.amount,
          date: entry.date,
          notes: `Imported from ${file.original_name} - Account ${entry.account_code}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        entriesImported++;
      }
    }

    saveDatabase();

    res.json({
      message: 'Ledger imported successfully',
      episodes_created: episodesCreated,
      sets_created: setsCreated,
      entries_imported: entriesImported
    });
  } catch (error) {
    console.error('Ledger import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Legacy PDF upload endpoint
router.post('/pdf/:projectId', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileId = uuidv4();
    const parsedEntries = await parsePDF(req.file.path);

    insert('uploaded_files', {
      id: fileId,
      project_id: req.params.projectId,
      filename: req.file.filename,
      original_name: req.file.originalname,
      file_type: 'pdf',
      file_size: req.file.size,
      parsed_data: JSON.stringify(parsedEntries),
      upload_type: 'costs'
    });

    res.json({
      file_id: fileId,
      filename: req.file.originalname,
      entries_found: parsedEntries.length,
      parsed_entries: parsedEntries,
      message: 'PDF parsed successfully. Review the entries before importing.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import parsed entries to a specific set
router.post('/import/:fileId', (req, res) => {
  try {
    const db = getDatabase();
    const { entries, set_id } = req.body;

    if (!set_id) {
      return res.status(400).json({ error: 'set_id is required' });
    }

    const file = findById('uploaded_files', req.params.fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const set = findById('sets', set_id);
    if (!set) {
      return res.status(404).json({ error: 'Set not found' });
    }

    let imported = 0;
    for (const entry of entries) {
      db.cost_entries.push({
        id: uuidv4(),
        set_id,
        category: entry.category,
        description: entry.description,
        amount: entry.amount,
        date: entry.date,
        notes: `Imported from ${file.original_name}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      imported++;
    }
    saveDatabase();

    res.json({
      message: `Successfully imported ${imported} entries to ${set.set_name}`,
      imported_count: imported
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get uploaded files for a project
router.get('/files/:projectId', (req, res) => {
  try {
    const db = getDatabase();
    const files = db.uploaded_files
      .filter(f => f.project_id === req.params.projectId)
      .map(({ parsed_data, ...rest }) => rest)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete uploaded file
router.delete('/files/:fileId', (req, res) => {
  try {
    const file = findById('uploaded_files', req.params.fileId);

    if (file) {
      const filePath = path.join(__dirname, '../../uploads', file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      remove('uploaded_files', req.params.fileId);
    }

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get cost categories
router.get('/categories', (req, res) => {
  res.json(COST_CATEGORIES);
});

// Debug endpoint - analyze PDF without importing
router.post('/debug/:projectId', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const dataBuffer = fs.readFileSync(req.file.path);
    const data = await pdfParse(dataBuffer);
    const text = data.text;

    // Analyze the text
    const lines = text.split('\n').filter(l => l.trim());
    const accountHeaders = lines.filter(l => /Acct:\s*\d{4}/.test(l));
    const linesWithAmounts = lines.filter(l => /-?[\d,]+\.\d{2}$/.test(l.trim()));
    const linesStartingWith6 = lines.filter(l => /^6[0-9]{3}/.test(l.trim()));

    // Try to parse
    const entries = parseLedgerPDF(text);
    const grouped = groupEntries(entries);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      debug: {
        total_lines: lines.length,
        is_ledger_format: isLedgerFormat(text),
        account_headers_found: accountHeaders,
        lines_with_amounts: linesWithAmounts.length,
        lines_starting_with_6xxx: linesStartingWith6.length,
        sample_lines: lines.slice(0, 30),
        sample_amount_lines: linesWithAmounts.slice(0, 10)
      },
      parsing_result: {
        entries_found: entries.length,
        entries: entries.slice(0, 20),
        grouped: grouped
      },
      raw_text_preview: text.substring(0, 3000)
    });
  } catch (error) {
    console.error('Debug parse error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Parse text directly (for testing without PDF)
router.post('/parse-text', express.text({ limit: '10mb' }), (req, res) => {
  try {
    const text = req.body;

    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    const entries = parseLedgerPDF(text);
    const grouped = groupEntries(entries);

    res.json({
      is_ledger_format: isLedgerFormat(text),
      entries_found: entries.length,
      entries,
      grouped
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
