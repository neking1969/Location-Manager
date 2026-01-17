const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const pdfParse = require('pdf-parse');
const { getDatabase, COST_CATEGORIES } = require('../database');

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

// Attempt to categorize an entry based on keywords
function categorizeEntry(text) {
  const lowerText = text.toLowerCase();

  const categoryKeywords = {
    'Location Fees': ['location fee', 'rental fee', 'site fee', 'venue fee', 'location rental'],
    'Permits & Licenses': ['permit', 'license', 'filming permit', 'city permit', 'county permit'],
    'Security': ['security', 'guard', 'police', 'off-duty', 'watchman'],
    'Parking': ['parking', 'valet', 'lot rental', 'garage'],
    'Site Preparation': ['prep', 'setup', 'construction', 'build', 'installation'],
    'Site Restoration': ['restoration', 'cleanup', 'repair', 'damage', 'restore'],
    'Catering/Craft Services': ['catering', 'craft', 'food', 'meal', 'lunch', 'breakfast', 'dinner', 'snack'],
    'Crew Accommodations': ['hotel', 'motel', 'lodging', 'accommodation', 'housing', 'room'],
    'Transportation': ['transport', 'vehicle', 'truck', 'van', 'shuttle', 'fuel', 'gas', 'mileage'],
    'Equipment Rentals': ['equipment', 'rental', 'generator', 'tent', 'table', 'chair', 'power'],
    'Insurance': ['insurance', 'liability', 'coverage', 'bond'],
    'Utilities': ['utility', 'electric', 'water', 'power hookup', 'generator fuel'],
    'Communication': ['phone', 'radio', 'walkie', 'internet', 'wifi', 'cell'],
    'Office Supplies': ['office', 'supplies', 'paper', 'printer', 'copy'],
    'Petty Cash': ['petty cash', 'pc', 'cash expense', 'miscellaneous cash']
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return category;
    }
  }

  return 'Miscellaneous';
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

    const db = getDatabase();
    const fileId = uuidv4();
    const uploadType = req.body.type || 'ledger'; // 'ledger' or 'budget'

    // Parse the PDF
    const parsedEntries = await parsePDF(req.file.path);

    // Save file record
    db.prepare(`
      INSERT INTO uploaded_files (id, project_id, filename, original_name, file_type, file_size, parsed_data, upload_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fileId,
      req.params.projectId,
      req.file.filename,
      req.file.originalname,
      'pdf',
      req.file.size,
      JSON.stringify(parsedEntries),
      uploadType
    );

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

// Import parsed entries
router.post('/import/:fileId', (req, res) => {
  try {
    const db = getDatabase();
    const { entries, type } = req.body; // type: 'ledger' or 'budget'

    const file = db.prepare('SELECT * FROM uploaded_files WHERE id = ?').get(req.params.fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    let imported = 0;

    if (type === 'ledger') {
      const insert = db.prepare(`
        INSERT INTO ledger_entries
        (id, project_id, category, description, amount, date, source_file)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMany = db.transaction((entries) => {
        for (const entry of entries) {
          insert.run(
            uuidv4(),
            file.project_id,
            entry.category,
            entry.description,
            entry.amount,
            entry.date,
            file.original_name
          );
          imported++;
        }
      });

      insertMany(entries);
    } else if (type === 'budget') {
      const insert = db.prepare(`
        INSERT INTO budget_items
        (id, project_id, category, description, budgeted_amount)
        VALUES (?, ?, ?, ?, ?)
      `);

      const insertMany = db.transaction((entries) => {
        for (const entry of entries) {
          insert.run(
            uuidv4(),
            file.project_id,
            entry.category,
            entry.description,
            entry.amount
          );
          imported++;
        }
      });

      insertMany(entries);
    }

    res.json({
      message: `Successfully imported ${imported} entries`,
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
    const files = db.prepare(`
      SELECT id, project_id, filename, original_name, file_type, file_size, upload_type, created_at
      FROM uploaded_files
      WHERE project_id = ?
      ORDER BY created_at DESC
    `).all(req.params.projectId);
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete uploaded file
router.delete('/files/:fileId', (req, res) => {
  try {
    const db = getDatabase();
    const file = db.prepare('SELECT * FROM uploaded_files WHERE id = ?').get(req.params.fileId);

    if (file) {
      // Delete physical file
      const filePath = path.join(__dirname, '../../uploads', file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete database record
      db.prepare('DELETE FROM uploaded_files WHERE id = ?').run(req.params.fileId);
    }

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
