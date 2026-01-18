const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const pdfParse = require('pdf-parse');

// Use DynamoDB in Lambda, file-based locally
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const { getDatabase, findById, findAll, insert, update, remove, saveDatabase, COST_CATEGORIES } = isLambda
  ? require('../database-dynamodb')
  : require('../database');

// Account code to category mapping for Disney/Fox production ledgers
const ACCOUNT_CODE_MAP = {
  '6304': 'Security',
  '6305': 'Police',
  '6307': 'Fire',
  '6342': 'Rentals'
};

// Keywords to subcategorize 6342 entries
const SUBCATEGORY_KEYWORDS = {
  'Permits': ['permit', 'permits', 'license', 'film la', 'filming permit'],
  'Rentals': ['tent', 'tents', 'table', 'tables', 'chair', 'chairs', 'restroom', 'hvac', 'dumpster', 'air scrubber', 'generator', 'heater'],
  'Loc Fees': ['layout', 'maps', 'survey', 'scout']
};

// Configure multer - use memory storage for Lambda compatibility
const storage = isLambda
  ? multer.memoryStorage()
  : multer.diskStorage({
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
  limits: { fileSize: 50 * 1024 * 1024 },
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

// Generate content hash for duplicate detection
function generateContentHash(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

// Check for duplicate ledger
async function checkDuplicate(projectId, contentHash, originalName) {
  const existingFiles = await findAll('uploaded_files', { project_id: projectId });

  // Check by content hash (exact duplicate)
  const hashMatch = existingFiles.find(f => f.content_hash === contentHash);
  if (hashMatch) {
    return {
      isDuplicate: true,
      type: 'exact',
      existingFile: hashMatch,
      message: `This exact file was already uploaded on ${new Date(hashMatch.created_at).toLocaleDateString()}`
    };
  }

  // Check by filename (potential duplicate)
  const nameMatch = existingFiles.find(f =>
    f.original_name === originalName && f.status !== 'superseded'
  );
  if (nameMatch) {
    return {
      isDuplicate: true,
      type: 'name',
      existingFile: nameMatch,
      message: `A file named "${originalName}" was already uploaded. This may be an updated version.`
    };
  }

  return { isDuplicate: false };
}

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
    const accountMatch = line.match(/Acct:\s*(\d{4})\s*-\s*(.+)/);
    if (accountMatch) {
      currentAccount = accountMatch[1];
      currentAccountName = accountMatch[2].trim();
      continue;
    }

    if (!currentAccount || !line || line.startsWith('Account') || line.startsWith('GL 505')) {
      continue;
    }

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
  const parts = line.split(/\s{2,}/);
  if (parts.length < 5) return null;

  const episodeMatch = line.match(/\b(10[1-9]|1[1-9][0-9])\b/);
  const episode = episodeMatch ? episodeMatch[1] : null;

  const amountMatch = line.match(/-?[\d,]+\.\d{2}$/);
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[0].replace(/,/g, ''));
  if (isNaN(amount) || amount === 0) return null;

  const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4})/);
  const date = dateMatch ? normalizeDate(dateMatch[1]) : null;

  let description = '';
  const descMatch = line.match(/\d{2}\/\d{2}[-\/]\d{2}\/?\d{0,2}\s+([A-Z][A-Z0-9\s:,\-\.]+?)(?=\s{2,}|\s+[A-Z]{2,}\s+\d)/i);
  if (descMatch) {
    description = descMatch[1].trim();
  }

  let vendor = '';
  const vendorMatch = line.match(/([A-Z][A-Z\s&\.]+(?:INC|LLC|PARTNERS|SECURITY|PRODUCTION|STUDIO|SERVIC)?\w*)\s+\d{3,}/);
  if (vendorMatch) {
    vendor = vendorMatch[1].trim();
  }

  const location = extractLocationFromDescription(description, accountName);
  let category = ACCOUNT_CODE_MAP[accountCode] || 'Loc Fees';

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

function extractLocationFromDescription(description, accountName) {
  if (!description) return 'General';

  const colonMatch = description.match(/[A-Z]+:([A-Z][A-Z\s]+)/);
  if (colonMatch) {
    return formatLocationName(colonMatch[1].trim());
  }

  let cleaned = description
    .replace(/^\d{2}\/\d{2}[-\/]\d{2}\/?\d{0,2}\s*/, '')
    .replace(/^(SECURITY|FIRE|POLICE|PERMITS?|LAYOUT|RESTROOM|TENTS?|DRIVING)[\s:]+/i, '');

  if (cleaned && cleaned.length > 2) {
    return formatLocationName(cleaned.split(/\s{2,}/)[0]);
  }

  return 'General';
}

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

function subcategorize6342(description) {
  const lowerDesc = (description || '').toLowerCase();
  for (const [category, keywords] of Object.entries(SUBCATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lowerDesc.includes(kw))) {
      return category;
    }
  }
  return 'Rentals';
}

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

    if (!grouped[key].totals[entry.category]) {
      grouped[key].totals[entry.category] = 0;
    }
    grouped[key].totals[entry.category] += entry.amount;
  }

  return Object.values(grouped);
}

// Upload and parse MULTIPLE production ledger PDFs
router.post('/ledger/:projectId', upload.array('files', 10), async (req, res) => {
  try {
    // Handle both single 'file' field and multiple 'files' field
    const files = req.files || (req.file ? [req.file] : []);

    if (files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];
    const duplicates = [];

    for (const file of files) {
      try {
        // Get file buffer (memory storage for Lambda, read from disk for local)
        let dataBuffer;
        if (file.buffer) {
          dataBuffer = file.buffer;
        } else {
          dataBuffer = fs.readFileSync(file.path);
        }

        // Generate content hash for duplicate detection
        const contentHash = generateContentHash(dataBuffer);

        // Check for duplicates
        const duplicateCheck = await checkDuplicate(
          req.params.projectId,
          contentHash,
          file.originalname
        );

        if (duplicateCheck.isDuplicate) {
          duplicates.push({
            filename: file.originalname,
            ...duplicateCheck
          });
          continue;
        }

        // Parse PDF
        const data = await pdfParse(dataBuffer);
        const text = data.text;

        if (!isLedgerFormat(text)) {
          results.push({
            filename: file.originalname,
            success: false,
            error: 'Not a valid production ledger format'
          });
          continue;
        }

        const fileId = uuidv4();
        const entries = parseLedgerPDF(text);
        const grouped = groupEntries(entries);

        // Save file record with content hash
        await insert('uploaded_files', {
          id: fileId,
          project_id: req.params.projectId,
          filename: file.filename || `${Date.now()}-${file.originalname}`,
          original_name: file.originalname,
          file_type: 'ledger',
          file_size: file.size,
          content_hash: contentHash,
          parsed_data: JSON.stringify({ entries, grouped }),
          upload_type: 'ledger',
          status: 'pending',
          entries_count: entries.length
        });

        results.push({
          file_id: fileId,
          filename: file.originalname,
          success: true,
          entries_found: entries.length,
          entries,
          grouped
        });

      } catch (fileError) {
        results.push({
          filename: file.originalname,
          success: false,
          error: fileError.message
        });
      }
    }

    res.json({
      total_files: files.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      duplicates: duplicates.length,
      results,
      duplicates,
      message: duplicates.length > 0
        ? `${results.filter(r => r.success).length} files parsed. ${duplicates.length} duplicate(s) detected.`
        : `${results.filter(r => r.success).length} files parsed successfully.`
    });

  } catch (error) {
    console.error('Ledger parse error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Also support single file upload for backwards compatibility
router.post('/ledger/:projectId/single', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  // Redirect to the multi-file handler
  req.files = [req.file];
  return router.handle(req, res);
});

// Import ledger entries - auto-creates episodes and sets
router.post('/ledger/import/:fileId', async (req, res) => {
  try {
    const { projectId, handleDuplicate } = req.body;

    const file = await findById('uploaded_files', req.params.fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const parsedData = JSON.parse(file.parsed_data);
    const { entries, grouped } = parsedData;

    let episodesCreated = 0;
    let setsCreated = 0;
    let entriesImported = 0;
    let entriesSkipped = 0;

    // Get existing episodes
    const existingEpisodes = await findAll('episodes', { project_id: projectId });
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
        const newEpisode = await insert('episodes', {
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
      const existingSets = await findAll('sets', { episode_id: episodeId });
      let set = existingSets.find(s => s.set_name === group.location);

      if (!set) {
        set = await insert('sets', {
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
        // Check for duplicate entry (same amount, date, vendor, category)
        const existingCosts = await findAll('cost_entries', { set_id: set.id });
        const isDuplicateEntry = existingCosts.some(c =>
          c.amount === entry.amount &&
          c.date === entry.date &&
          c.vendor === entry.vendor &&
          c.category === entry.category
        );

        if (isDuplicateEntry && handleDuplicate !== 'import_all') {
          entriesSkipped++;
          continue;
        }

        await insert('cost_entries', {
          id: uuidv4(),
          set_id: set.id,
          category: entry.category,
          description: entry.description,
          vendor: entry.vendor,
          amount: entry.amount,
          date: entry.date,
          notes: `Imported from ${file.original_name} - Account ${entry.account_code}`,
          source_file_id: file.id
        });
        entriesImported++;
      }
    }

    // Update file status
    await update('uploaded_files', file.id, {
      status: 'imported',
      imported_at: new Date().toISOString(),
      entries_imported: entriesImported,
      entries_skipped: entriesSkipped
    });

    res.json({
      message: 'Ledger imported successfully',
      episodes_created: episodesCreated,
      sets_created: setsCreated,
      entries_imported: entriesImported,
      entries_skipped: entriesSkipped
    });

  } catch (error) {
    console.error('Ledger import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Supersede an existing ledger with a new version
router.post('/ledger/supersede/:oldFileId', async (req, res) => {
  try {
    const { newFileId } = req.body;

    const oldFile = await findById('uploaded_files', req.params.oldFileId);
    const newFile = await findById('uploaded_files', newFileId);

    if (!oldFile || !newFile) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Mark old file as superseded
    await update('uploaded_files', oldFile.id, {
      status: 'superseded',
      superseded_by: newFileId,
      superseded_at: new Date().toISOString()
    });

    // Mark new file as the current version
    await update('uploaded_files', newFile.id, {
      supersedes: oldFile.id
    });

    res.json({
      message: 'File superseded successfully',
      old_file: oldFile.original_name,
      new_file: newFile.original_name
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get uploaded files for a project with duplicate info
router.get('/files/:projectId', async (req, res) => {
  try {
    const files = await findAll('uploaded_files', { project_id: req.params.projectId });

    // Remove parsed_data to reduce payload, add summary info
    const filesWithSummary = files
      .map(f => {
        const { parsed_data, ...rest } = f;
        return {
          ...rest,
          has_duplicates: files.some(other =>
            other.id !== f.id &&
            (other.content_hash === f.content_hash || other.original_name === f.original_name)
          )
        };
      })
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

    res.json(filesWithSummary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete uploaded file
router.delete('/files/:fileId', async (req, res) => {
  try {
    const file = await findById('uploaded_files', req.params.fileId);

    if (file) {
      // Delete physical file if exists (local only)
      if (!isLambda && file.filename) {
        const filePath = path.join(__dirname, '../../uploads', file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      await remove('uploaded_files', req.params.fileId);
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
