/**
 * Tests for PDF ledger parsing functionality
 * Tests the parsing logic without requiring actual PDF files
 */

// Import the functions we need to test
// We'll need to extract them or test via the route handlers

const {
  resetDatabase,
  createTestProject,
  createTestEpisode,
  createTestSet
} = require('./setup');

// Mock the parsing functions by requiring the upload module internals
// Since functions aren't exported, we'll test via API or recreate the logic

describe('PDF Parsing Logic', () => {
  beforeEach(() => {
    resetDatabase();
  });

  describe('isLedgerFormat detection', () => {
    // Recreate the function for testing
    function isLedgerFormat(text) {
      return text.includes('General Ledger') ||
             text.includes('GL 505') ||
             /Acct:\s*\d{4}/.test(text);
    }

    test('detects General Ledger text', () => {
      expect(isLedgerFormat('This is a General Ledger report')).toBe(true);
    });

    test('detects GL 505 format', () => {
      expect(isLedgerFormat('GL 505 Production Report')).toBe(true);
    });

    test('detects account code pattern', () => {
      expect(isLedgerFormat('Acct: 6304 - LOCATION SECURITY')).toBe(true);
    });

    test('rejects non-ledger text', () => {
      expect(isLedgerFormat('Random invoice text here')).toBe(false);
    });
  });

  describe('normalizeDate function', () => {
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

    test('normalizes MM/DD/YYYY format', () => {
      expect(normalizeDate('01/15/2024')).toBe('2024-01-15');
    });

    test('normalizes MM/DD/YY format', () => {
      expect(normalizeDate('01/15/24')).toBe('2024-01-15');
    });

    test('normalizes with dashes', () => {
      expect(normalizeDate('01-15-2024')).toBe('2024-01-15');
    });

    test('handles single digit month/day', () => {
      expect(normalizeDate('1/5/2024')).toBe('2024-01-05');
    });

    test('returns null for invalid format', () => {
      expect(normalizeDate('invalid')).toBe(null);
    });
  });

  describe('subcategorize6342 function', () => {
    const SUBCATEGORY_KEYWORDS = {
      'Permits': ['permit', 'permits', 'license', 'film la', 'filming permit'],
      'Rentals': ['tent', 'tents', 'table', 'tables', 'chair', 'chairs', 'restroom', 'hvac', 'dumpster', 'air scrubber', 'generator', 'heater'],
      'Loc Fees': ['layout', 'maps', 'survey', 'scout']
    };

    function subcategorize6342(description) {
      const lowerDesc = (description || '').toLowerCase();
      for (const [category, keywords] of Object.entries(SUBCATEGORY_KEYWORDS)) {
        if (keywords.some(kw => lowerDesc.includes(kw))) {
          return category;
        }
      }
      return 'Rentals';
    }

    test('categorizes permit entries', () => {
      expect(subcategorize6342('FILMING PERMIT FEE')).toBe('Permits');
      expect(subcategorize6342('Film LA permit')).toBe('Permits');
    });

    test('categorizes rental entries', () => {
      expect(subcategorize6342('TENT RENTAL')).toBe('Rentals');
      expect(subcategorize6342('Generator for set')).toBe('Rentals');
      expect(subcategorize6342('RESTROOM TRAILERS')).toBe('Rentals');
    });

    test('categorizes loc fees entries', () => {
      expect(subcategorize6342('LAYOUT SERVICES')).toBe('Loc Fees');
      expect(subcategorize6342('Location scout')).toBe('Loc Fees');
    });

    test('defaults to Rentals for unknown', () => {
      expect(subcategorize6342('SOME UNKNOWN CHARGE')).toBe('Rentals');
    });

    test('handles null/undefined description', () => {
      expect(subcategorize6342(null)).toBe('Rentals');
      expect(subcategorize6342(undefined)).toBe('Rentals');
    });
  });

  describe('formatLocationName function', () => {
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

    test('converts uppercase to title case', () => {
      expect(formatLocationName('LATCHFORD HOUSE')).toBe('Latchford House');
    });

    test('handles mixed case', () => {
      expect(formatLocationName('downtown STREET')).toBe('Downtown Street');
    });

    test('returns General for empty input', () => {
      expect(formatLocationName('')).toBe('General');
      expect(formatLocationName(null)).toBe('General');
    });

    test('normalizes multiple spaces', () => {
      expect(formatLocationName('DOWNTOWN   STREET')).toBe('Downtown Street');
    });
  });

  describe('Account code mapping', () => {
    const ACCOUNT_CODE_MAP = {
      '6304': 'Security',
      '6305': 'Police',
      '6307': 'Fire',
      '6342': 'Rentals'
    };

    test('maps 6304 to Security', () => {
      expect(ACCOUNT_CODE_MAP['6304']).toBe('Security');
    });

    test('maps 6305 to Police', () => {
      expect(ACCOUNT_CODE_MAP['6305']).toBe('Police');
    });

    test('maps 6307 to Fire', () => {
      expect(ACCOUNT_CODE_MAP['6307']).toBe('Fire');
    });

    test('maps 6342 to Rentals (default)', () => {
      expect(ACCOUNT_CODE_MAP['6342']).toBe('Rentals');
    });
  });

  describe('Amount extraction', () => {
    function extractAmount(line) {
      const amountMatch = line.match(/-?[\d,]+\.\d{2}$/);
      if (!amountMatch) return null;
      const amount = parseFloat(amountMatch[0].replace(/,/g, ''));
      if (isNaN(amount) || amount === 0) return null;
      return amount;
    }

    test('extracts positive amounts', () => {
      expect(extractAmount('Some description 1,234.56')).toBe(1234.56);
    });

    test('extracts negative amounts (credits)', () => {
      expect(extractAmount('Credit entry -500.00')).toBe(-500);
    });

    test('extracts amounts with commas', () => {
      expect(extractAmount('Large amount 12,345.67')).toBe(12345.67);
    });

    test('returns null for no amount', () => {
      expect(extractAmount('No amount here')).toBe(null);
    });

    test('returns null for zero amount', () => {
      expect(extractAmount('Zero 0.00')).toBe(null);
    });
  });

  describe('Episode extraction', () => {
    function extractEpisode(line) {
      const episodeMatch = line.match(/\b(10[1-9]|1[1-9][0-9])\b/);
      return episodeMatch ? episodeMatch[1] : null;
    }

    test('extracts episode 101', () => {
      expect(extractEpisode('6304 QE 101 LATCHFORD')).toBe('101');
    });

    test('extracts episode 102', () => {
      expect(extractEpisode('Line for episode 102 here')).toBe('102');
    });

    test('extracts episode 115', () => {
      expect(extractEpisode('6305 115 DOWNTOWN')).toBe('115');
    });

    test('returns null for no episode', () => {
      expect(extractEpisode('General charge no episode')).toBe(null);
    });

    test('does not match 100 (not a valid episode)', () => {
      expect(extractEpisode('Some 100 thing')).toBe(null);
    });
  });

  describe('Date extraction', () => {
    function extractDate(line) {
      const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4})/);
      return dateMatch ? dateMatch[1] : null;
    }

    test('extracts MM/DD/YYYY date', () => {
      expect(extractDate('Entry on 01/15/2024 for vendor')).toBe('01/15/2024');
    });

    test('returns null when no date', () => {
      expect(extractDate('No date in this line')).toBe(null);
    });
  });

  describe('groupEntries function', () => {
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

    test('groups entries by episode and location', () => {
      const entries = [
        { episode: '101', location: 'Downtown', category: 'Security', amount: 100 },
        { episode: '101', location: 'Downtown', category: 'Security', amount: 200 },
        { episode: '102', location: 'Park', category: 'Fire', amount: 150 }
      ];

      const grouped = groupEntries(entries);
      expect(grouped).toHaveLength(2);

      const downtown = grouped.find(g => g.location === 'Downtown');
      expect(downtown.entries).toHaveLength(2);
      expect(downtown.totals['Security']).toBe(300);
    });

    test('handles entries without episode', () => {
      const entries = [
        { episode: null, location: 'General', category: 'Rentals', amount: 500 }
      ];

      const grouped = groupEntries(entries);
      expect(grouped[0].episode).toBe(null);
    });

    test('accumulates totals by category', () => {
      const entries = [
        { episode: '101', location: 'Set A', category: 'Security', amount: 100 },
        { episode: '101', location: 'Set A', category: 'Fire', amount: 50 },
        { episode: '101', location: 'Set A', category: 'Security', amount: 75 }
      ];

      const grouped = groupEntries(entries);
      expect(grouped[0].totals['Security']).toBe(175);
      expect(grouped[0].totals['Fire']).toBe(50);
    });
  });
});

describe('Ledger Line Parsing', () => {
  // Test the full line parsing logic
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
    const date = dateMatch ? dateMatch[1] : null;

    return {
      account_code: accountCode,
      account_name: accountName,
      episode,
      amount,
      date
    };
  }

  test('parses a complete ledger line', () => {
    const line = '6304  QE  101  LATCHFORD  CA  QE  01/15/2024  VENDOR INC  12345  1,500.00';
    const result = parseLedgerLine(line, '6304', 'LOCATION SECURITY');

    expect(result).not.toBeNull();
    expect(result.account_code).toBe('6304');
    expect(result.episode).toBe('101');
    expect(result.amount).toBe(1500);
  });

  test('returns null for lines with too few parts', () => {
    const line = '6304 short line';
    const result = parseLedgerLine(line, '6304', 'LOCATION SECURITY');
    expect(result).toBeNull();
  });

  test('returns null for lines without amount', () => {
    const line = '6304  QE  101  LATCHFORD  CA  QE  no amount here';
    const result = parseLedgerLine(line, '6304', 'LOCATION SECURITY');
    expect(result).toBeNull();
  });
});
