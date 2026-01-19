/**
 * Direct test of the PDF ledger parsing logic without needing a real PDF
 */

const fs = require('fs');
const path = require('path');

// Copy the relevant functions from upload.js for testing
const ACCOUNT_CODE_MAP = {
  '6304': 'Security',
  '6305': 'Police',
  '6307': 'Fire',
  '6342': 'Rentals'
};

const SUBCATEGORY_KEYWORDS = {
  'Permits': ['permit', 'permits', 'license', 'film la', 'filming permit'],
  'Rentals': ['tent', 'tents', 'table', 'tables', 'chair', 'chairs', 'restroom', 'hvac', 'dumpster', 'air scrubber', 'generator', 'heater'],
  'Loc Fees': ['layout', 'maps', 'survey', 'scout']
};

function isLedgerFormat(text) {
  return text.includes('General Ledger') ||
         text.includes('GL 505') ||
         /Acct:\s*\d{4}/.test(text);
}

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

// TEST DATA - simulating what pdf-parse extracts from a real ledger
const sampleLedgerText = `GL 505 General Ledger
Production Location Costs Report

Acct: 6304 - LOCATION SECURITY
Account  LO  EPI  SET  Description                              Vendor                   Trans#    Amount
-------  --  ---  ---  -----------                              ------                   ------    ------
6304     QE  101  A01  01/15-01/16 SECURITY:LATCHFORD HOUSE     APEX SECURITY INC        123456  2,500.00
6304     QE  101  A02  01/17-01/18 SECURITY:DOWNTOWN LOFT       APEX SECURITY INC        123457  1,800.00
6304     QE  102  B01  01/20-01/21 SECURITY:BUCKLEY GYM         SECURE PARTNERS LLC      123458  3,200.00

Acct: 6305 - LOCATION POLICE
Account  LO  EPI  SET  Description                              Vendor                   Trans#    Amount
-------  --  ---  ---  -----------                              ------                   ------    ------
6305     QE  101  A01  01/15-01/16 POLICE:LATCHFORD HOUSE       LAPD OFF-DUTY            223456  1,200.00
6305     QE  102  B01  01/20-01/21 POLICE:BUCKLEY GYM           LAPD OFF-DUTY            223457  1,500.00

Acct: 6307 - LOCATION FIREMAN
Account  LO  EPI  SET  Description                              Vendor                   Trans#    Amount
-------  --  ---  ---  -----------                              ------                   ------    ------
6307     QE  101  A01  01/15-01/16 FIRE:LATCHFORD HOUSE         LAFD FIRE WATCH          323456    800.00
6307     QE  102  B01  01/20-01/21 FIRE:BUCKLEY GYM             LAFD FIRE WATCH          323457    950.00

Acct: 6342 - FEES & PERMITS
Account  LO  EPI  SET  Description                              Vendor                   Trans#    Amount
-------  --  ---  ---  -----------                              ------                   ------    ------
6342     QE  101  A01  01/15-01/16 PERMIT:LATCHFORD HOUSE       FILM LA                  423456    350.00
6342     QE  101  A01  01/15-01/16 TENTS:LATCHFORD HOUSE        PARTY RENTAL INC         423457  1,500.00
6342     QE  102  B01  01/20-01/21 PERMIT:BUCKLEY GYM           FILM LA                  423458    275.00
6342     QE  102  B01  01/20-01/21 GENERATOR:BUCKLEY GYM        POWER SOLUTIONS          423459  2,100.00`;

// RUN TESTS
console.log('=== PDF Ledger Parsing Logic Tests ===\n');

// Test 1: Ledger format detection
console.log('Test 1: Ledger format detection');
const isLedger = isLedgerFormat(sampleLedgerText);
console.log(`  Is ledger format: ${isLedger}`);
console.log(`  ${isLedger ? 'PASS' : 'FAIL'}\n`);

// Test 2: Parse the ledger text
console.log('Test 2: Parse ledger entries');
const entries = parseLedgerPDF(sampleLedgerText);
console.log(`  Entries found: ${entries.length}`);

if (entries.length === 0) {
  console.log('  FAIL: No entries parsed!');
  console.log('\n  Debug: Testing individual line parsing...');

  // Debug: try parsing a single line
  const testLine = '6304     QE  101  A01  01/15-01/16 SECURITY:LATCHFORD HOUSE     APEX SECURITY INC        123456  2,500.00';
  console.log(`  Test line: "${testLine}"`);

  const result = parseLedgerLine(testLine, '6304', 'LOCATION SECURITY');
  console.log('  Parse result:', result);

  // Check what the regex is matching
  console.log('\n  Regex debugging:');
  console.log('    Episode match:', testLine.match(/\b(10[1-9]|1[1-9][0-9])\b/));
  console.log('    Amount match:', testLine.match(/-?[\d,]+\.\d{2}$/));
  console.log('    Parts split:', testLine.split(/\s{2,}/));
} else {
  console.log('  PASS: Entries parsed successfully');
  console.log('\n  Sample entries:');
  entries.slice(0, 3).forEach((e, i) => {
    console.log(`  ${i + 1}. Episode ${e.episode} | ${e.location} | ${e.category} | $${e.amount}`);
  });
}

// Test 3: Verify categories
console.log('\n\nTest 3: Category distribution');
const categoryCounts = {};
entries.forEach(e => {
  categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
});
console.log('  Categories:', categoryCounts);

// Test 4: Check expected totals
console.log('\nTest 4: Amount verification');
const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);
console.log(`  Total amount: $${totalAmount.toFixed(2)}`);
const expectedTotal = 2500 + 1800 + 3200 + 1200 + 1500 + 800 + 950 + 350 + 1500 + 275 + 2100;
console.log(`  Expected total: $${expectedTotal.toFixed(2)}`);
console.log(`  ${Math.abs(totalAmount - expectedTotal) < 0.01 ? 'PASS' : 'FAIL'}`);

console.log('\n=== Tests Complete ===');
