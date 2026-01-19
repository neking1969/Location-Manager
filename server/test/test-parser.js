// Test script to verify the GL 505 parser logic works correctly
// Run with: node test/test-parser.js

const path = require('path');

// Import the upload module to test parsing functions
// We'll recreate the parsing functions here for testing

// Account code to category mapping
const ACCOUNT_CODE_MAP = {
  '6304': 'Security',
  '6305': 'Police',
  '6307': 'Fire',
  '6342': 'Rentals'
};

const SUBCATEGORY_KEYWORDS = {
  'Permits': ['permit', 'permits', 'license', 'film la', 'filming permit'],
  'Rentals': ['tent', 'tents', 'table', 'tables', 'chair', 'chairs', 'restroom', 'hvac', 'dumpster', 'generator', 'heater'],
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

// Parse column-based GL 505 format
function parseColumnBasedLine(line, accountCode, accountName) {
  const parts = line.split(/\s{2,}/).filter(p => p.trim());
  if (parts.length < 4) return null;

  // Extract amount (last number with decimals)
  const amountMatch = line.match(/-?[\d,]+\.\d{2}$/);
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[0].replace(/,/g, ''));
  if (isNaN(amount) || amount === 0) return null;

  // Extract episode from start (format: "6305 01 101" = Account LO EPI)
  const startMatch = line.match(/^\d{4}\s+\d{1,2}\s+(\d{3})/);
  const episode = startMatch ? startMatch[1] : null;

  // Extract effective date
  const effDateMatch = line.match(/(\d{2}\/\d{2}\/\d{4})/);
  const date = effDateMatch ? normalizeDate(effDateMatch[1]) : null;

  // Extract description - officer format: "10/25/25 : ALBIN, W : REGULAR 1X"
  let description = '';
  let personName = '';
  let payType = '';

  const officerMatch = line.match(/(\d{2}\/\d{2}\/\d{2})\s*:\s*([A-Z]+,\s*[A-Z])\s*:\s*([A-Z0-9\s\.]+?)(?=\s{2,})/i);
  if (officerMatch) {
    const workDate = officerMatch[1];
    personName = officerMatch[2].trim();
    payType = officerMatch[3].trim();
    description = `${workDate} - ${personName} - ${payType}`;
  } else {
    // Fallback for non-officer entries
    const descMatch = line.match(/\d{2}\/\d{2}\/\d{2}\s*:\s*([^:]+?)(?=\s{2,}[A-Z]{3,})/i);
    if (descMatch) {
      description = descMatch[1].trim();
    }
  }

  // Extract vendor
  let vendor = '';
  const vendorMatch = line.match(/([A-Z][A-Z\s&\.]+(?:PARTNERS|SECURITY|INC|LLC|SERVICES?|ENTERTAINMENT|WATCH))\s+\d/);
  if (vendorMatch) {
    vendor = vendorMatch[1].trim();
  }

  let category = ACCOUNT_CODE_MAP[accountCode] || 'Loc Fees';
  if (accountCode === '6342') {
    category = subcategorize6342(description);
  }

  return {
    account_code: accountCode,
    account_name: accountName,
    episode,
    location: 'General',
    category,
    description: description || `${accountName} charge`,
    vendor,
    person_name: personName,
    pay_type: payType,
    amount,
    date,
    raw_line: line
  };
}

// Sample text that simulates what pdf-parse would extract from a GL 505 PDF
const sampleText = `
The Shards - Season 1
Twentieth Century Fox Film Corp

General Ledger List By Account: Detail

Project: E62W    Episode: 101,102,103    Cost Period: 1 (05/07/25) To 17 (01/03/26)

Acct: 6305 - LOCATION POLICE
Account   LO  EPI  SET  WC    Description                                     Vendor Name           Trans#  Eff. Date      Amount
6305      01  101       QW    10/25/25 : ALBIN, W : REGULAR 1X                ENTERTAINMENT PARTNERS  1449  10/25/2025     619.20
6305      01  101       QW    10/25/25 : ALBIN, W : OVERTIME 1.5X             ENTERTAINMENT PARTNERS  1449  10/25/2025     348.30
6305      01  101       QW    10/25/25 : ALBIN, W : MEAL PENALTY NON UN       ENTERTAINMENT PARTNERS  1449  10/25/2025      77.40
6305      01  101       QW    10/25/25 : BOYD, R : REGULAR 1X                 ENTERTAINMENT PARTNERS  1449  10/25/2025     619.20
6305      01  101       QW    10/25/25 : BOYD, R : OVERTIME 1.5X              ENTERTAINMENT PARTNERS  1449  10/25/2025     464.40
6305      01  102       QW    10/28/25 : CHAPMAN, M : REGULAR 1X              ENTERTAINMENT PARTNERS  1450  10/28/2025   1,238.40
6305      01  102       QW    10/28/25 : CHAPMAN, M : OVERTIME 1.5X           ENTERTAINMENT PARTNERS  1450  10/28/2025     348.30
6305      01  103       QW    10/30/25 : DIAZ, E : REGULAR 1X                 ENTERTAINMENT PARTNERS  1451  10/30/2025   1,238.40
6305      01  103       QW    10/30/25 : DIAZ, E : MOTORCYCLE ALLOWANCE       ENTERTAINMENT PARTNERS  1451  10/30/2025     300.00

Acct: 6304 - LOCATION SECURITY
Account   LO  EPI  SET  WC    Description                                     Vendor Name           Trans#  Eff. Date      Amount
6304      01  101       QW    10/25/25 : JOHNSON, K : REGULAR 1X              SECURITY PARTNERS INC   2001  10/25/2025     450.00
6304      01  101       QW    10/25/25 : WILLIAMS, T : REGULAR 1X             SECURITY PARTNERS INC   2001  10/25/2025     450.00
6304      01  102       QW    10/28/25 : SMITH, J : REGULAR 1X                GUARD SERVICES LLC      2002  10/28/2025     525.00
6304      01  103       QW    10/30/25 : GARCIA, M : REGULAR 1X               ABC SECURITY INC        2003  10/30/2025     475.00

Acct: 6307 - LOCATION FIREMAN
Account   LO  EPI  SET  WC    Description                                     Vendor Name           Trans#  Eff. Date      Amount
6307      01  101       QW    10/25/25 : FIRE WATCH SERVICES                  LAFD FIRE WATCH         3001  10/25/2025     950.00
6307      01  102       QW    10/28/25 : FIRE WATCH SERVICES                  LAFD FIRE WATCH         3002  10/28/2025   1,200.00
6307      01  103       QW    10/30/25 : FIRE SAFETY STANDBY                  LAFD FIRE WATCH         3003  10/30/2025     875.00

Acct: 6342 - FEES & PERMITS
Account   LO  EPI  SET  WC    Description                                     Vendor Name           Trans#  Eff. Date      Amount
6342      01  101       QW    10/25/25 : FILMING PERMIT - DOWNTOWN            FILM LA                 4001  10/25/2025   1,250.00
6342      01  101       QW    10/25/25 : TENT RENTAL 20X30                    PARTY RENTALS INC       4002  10/25/2025     800.00
6342      01  102       QW    10/28/25 : FILMING PERMIT - BEACH               FILM LA                 4003  10/28/2025   2,100.00
6342      01  102       QW    10/28/25 : RESTROOM TRAILER RENTAL              PORTA SERVICES LLC      4004  10/28/2025     650.00
6342      01  103       QW    10/30/25 : FILMING PERMIT - WAREHOUSE           FILM LA                 4005  10/30/2025     900.00
6342      01  103       QW    10/30/25 : TABLES AND CHAIRS                    RENTAL CENTER INC       4006  10/30/2025     425.00

GL 505 - General Ledger List By Account
`;

// Parse the sample text
function parseLedgerPDF(text) {
  const entries = [];
  const lines = text.split('\n');

  let currentAccount = null;
  let currentAccountName = null;
  let isColumnFormat = text.includes('General Ledger List By Account') || text.includes('Eff. Date');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect account header
    const accountMatch = line.match(/Acct:\s*(\d{4})\s*-\s*(.+)/);
    if (accountMatch) {
      currentAccount = accountMatch[1];
      currentAccountName = accountMatch[2].trim();
      continue;
    }

    // Skip headers
    if (!currentAccount || !line ||
        line.startsWith('Account') ||
        line.startsWith('GL 505') ||
        line.includes('Tax Code') ||
        line.includes('Vendor Name') && line.includes('Trans#')) {
      continue;
    }

    // Parse data lines
    if (line.startsWith(currentAccount)) {
      const entry = parseColumnBasedLine(line, currentAccount, currentAccountName);
      if (entry) {
        entries.push(entry);
      }
    }
  }

  return entries;
}

// Group entries
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

// Run the test
console.log('=== GL 505 Parser Test ===\n');

const entries = parseLedgerPDF(sampleText);
console.log(`Parsed ${entries.length} entries:\n`);

// Show sample entries
console.log('Sample entries:');
entries.slice(0, 5).forEach((e, i) => {
  console.log(`  ${i + 1}. Episode ${e.episode} | ${e.category} | ${e.description} | $${e.amount.toFixed(2)}`);
});

console.log('\n--- Grouped Results ---\n');

const grouped = groupEntries(entries);
grouped.forEach(group => {
  const total = Object.values(group.totals).reduce((sum, v) => sum + v, 0);
  console.log(`Episode ${group.episode} - ${group.location}:`);
  console.log(`  Entries: ${group.entries.length}`);
  Object.entries(group.totals).forEach(([cat, amt]) => {
    console.log(`  ${cat}: $${amt.toFixed(2)}`);
  });
  console.log(`  TOTAL: $${total.toFixed(2)}\n`);
});

console.log('=== Test Complete ===');
console.log('\nTo test with a real PDF, upload it through the web UI.');
