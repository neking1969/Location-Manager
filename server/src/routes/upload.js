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
  '6304': 'Security',   // LOCATION SECURITY
  '6305': 'Police',     // LOCATION POLICE
  '6307': 'Fire',       // LOCATION FIREMAN
  '6342': 'Rentals'     // FEES & PERMITS (default, subcategorize by description)
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
  return text.includes('General Ledger') ||
         text.includes('GL 505') ||
         /Acct:\s*\d{4}/.test(text);
}

// Parse production ledger PDF
function parseLedgerPDF(text) {
  const entries = [];
  const lines = text.split('\n');

  let currentAccount = null;
  let currentAccountName = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect account header (e.g., "Acct: 6304 - LOCATION SECURITY")
    const accountMatch = line.match(/Acct:\s*(\d{4})\s*-\s*(.+)/);
    if (accountMatch) {
      currentAccount = accountMatch[1];
      currentAccountName = accountMatch[2].trim();
      continue;
    }

    // Skip header rows and empty lines
    if (!currentAccount || !line || line.startsWith('Account') || line.startsWith('GL 505')) {
      continue;
    }

    // Try to parse a data row
    // Format: Account LO EPI SET ... Description Vendor Trans# TT ... Amount
    // The amount is typically at the end, and episode is near the start

    // Look for lines that start with the account code
    if (line.startsWith(currentAccount)) {
      const entry = parseLedgerLine(line, currentAccount, currentAccountName);
      if (entry) {
        entries.push(entry);
      }
    }
  }

  return entries;
}

// Parse a single ledger line
function parseLedgerLine(line, accountCode, accountName) {
  // Split by multiple spaces to get columns
  const parts = line.split(/\s{2,}/);

  if (parts.length < 5) return null;

  // Extract episode number (usually 3 digits like 101, 102, 104)
  const episodeMatch = line.match(/\b(10[1-9]|1[1-9][0-9])\b/);
  const episode = episodeMatch ? episodeMatch[1] : null;

  // Extract amount (last number with decimals, possibly negative)
  const amountMatch = line.match(/-?[\d,]+\.\d{2}$/);
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[0].replace(/,/g, ''));
  if (isNaN(amount) || amount === 0) return null;

  // Extract date (MM/DD/YYYY format)
  const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4})/);
  const date = dateMatch ? normalizeDate(dateMatch[1]) : null;

  // Extract description - look for text after date patterns that describes the cost
  // Common format: "MM/DD-MM/DD DESCRIPTION" or "MM/DD/YY DESCRIPTION"
  let description = '';
  const descMatch = line.match(/\d{2}\/\d{2}[-\/]\d{2}\/?\d{0,2}\s+([A-Z][A-Z0-9\s:,\-\.]+?)(?=\s{2,}|\s+[A-Z]{2,}\s+\d)/i);
  if (descMatch) {
    description = descMatch[1].trim();
  } else {
    // Fallback: extract text between account info and vendor
    const fallbackMatch = line.match(/(?:QE|QW|USA)\s+(?:CA\s+)?(?:QE|QW)?\s*(.+?)(?=\s{2,}[A-Z])/);
    if (fallbackMatch) {
      description = fallbackMatch[1].trim();
    }
  }

  // Extract vendor name (usually in caps, before the transaction number)
  let vendor = '';
  const vendorMatch = line.match(/([A-Z][A-Z\s&\.]+(?:INC|LLC|PARTNERS|SECURITY|PRODUCTION|STUDIO|SERVIC)?\w*)\s+\d{3,}/);
  if (vendorMatch) {
    vendor = vendorMatch[1].trim();
  }

  // Extract location from description
  const location = extractLocationFromDescription(description, accountName);

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

module.exports = router;
