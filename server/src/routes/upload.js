const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const pdfParse = require('pdf-parse');
const { getDatabase, findById, insert, remove, saveDatabase, COST_CATEGORIES } = require('../database');

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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
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

// Parse PDF and extract cost data
async function parsePDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return extractCostData(data.text);
}

// Extract cost data from parsed text
function extractCostData(text) {
  const lines = text.split('\n').filter(line => line.trim());
  const entries = [];

  // Common patterns for cost data in production documents
  const amountPattern = /\$?\s*([\d,]+\.?\d*)/;
  const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;

  for (const line of lines) {
    // Try to extract amount from the line
    const amountMatch = line.match(amountPattern);
    if (amountMatch) {
      const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
      if (amount > 0 && amount < 10000000) { // Reasonable amount range
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

// Attempt to categorize an entry based on keywords - updated for new categories
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

  return 'Loc Fees'; // Default to Loc Fees
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

// Upload and parse PDF
router.post('/pdf/:projectId', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileId = uuidv4();

    // Parse the PDF
    const parsedEntries = await parsePDF(req.file.path);

    // Save file record
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

    // Verify set exists
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
      .map(({ parsed_data, ...rest }) => rest) // Exclude parsed_data from response
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
      // Delete physical file
      const filePath = path.join(__dirname, '../../uploads', file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete database record
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
