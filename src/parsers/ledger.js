/**
 * Ledger Parser - Parses Excel ledger files to extract transaction data
 */

import XLSX from 'xlsx';
import { parseFilename, generateHash } from '../utils/fileUtils.js';

// Account code to category mapping
const ACCOUNT_CATEGORIES = {
  '6304': 'Security',
  '6305': 'Police',
  '6307': 'Fire',
  '6342': 'Loc Fees',
  'PR': 'Equipment/Labor'
};

/**
 * Extract date range from description field
 * Examples:
 *   "11/14-11/21 SECURITY:LE DOME" -> { startDate: "11/14", endDate: "11/21" }
 *   "12/03-05 GUARDS" -> { startDate: "12/03", endDate: "12/05" }
 *   "01/07-01/07 SYCAMORE:REMOTE BEACH" -> { startDate: "01/07", endDate: "01/07" }
 *   "10/16,10/20 BASECAMP" -> { startDate: "10/16", endDate: "10/20" }
 *   "11/22/25 : GARCES, R : REGULAR 1X" -> { startDate: "2025-11-22" } (payroll)
 */
function extractDateRangeFromDescription(description, reportYear = null) {
  if (!description || typeof description !== 'string') return null;

  // Determine the year from context (ledger file date)
  const year = reportYear ? reportYear.split('-')[0] : new Date().getFullYear().toString();

  // Pattern 5: MM/DD/YY : (payroll format) - check FIRST since it has explicit year
  // Examples: "11/22/25 : GARCES, R : REGULAR 1X", "01/10/26 : LAWRENCE, J : OVERTIME"
  const payrollMatch = description.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*:/);
  if (payrollMatch) {
    const [, month, day, yearPart] = payrollMatch;
    const fullYear = yearPart.length === 2 ? `20${yearPart}` : yearPart;
    const dateStr = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    return {
      startDate: dateStr,
      endDate: dateStr,
      raw: payrollMatch[0].trim(),
      isPayroll: true
    };
  }

  // Pattern 1: MM/DD-MM/DD (full dates)
  const fullRangeMatch = description.match(/(\d{1,2})\/(\d{1,2})-(\d{1,2})\/(\d{1,2})/);
  if (fullRangeMatch) {
    const [, startMonth, startDay, endMonth, endDay] = fullRangeMatch;
    return {
      startDate: `${year}-${startMonth.padStart(2, '0')}-${startDay.padStart(2, '0')}`,
      endDate: `${year}-${endMonth.padStart(2, '0')}-${endDay.padStart(2, '0')}`,
      raw: fullRangeMatch[0]
    };
  }

  // Pattern 2: MM/DD-DD (same month)
  const sameMonthMatch = description.match(/(\d{1,2})\/(\d{1,2})-(\d{1,2})(?!\d)/);
  if (sameMonthMatch) {
    const [, month, startDay, endDay] = sameMonthMatch;
    return {
      startDate: `${year}-${month.padStart(2, '0')}-${startDay.padStart(2, '0')}`,
      endDate: `${year}-${month.padStart(2, '0')}-${endDay.padStart(2, '0')}`,
      raw: sameMonthMatch[0]
    };
  }

  // Pattern 3: MM/DD,MM/DD (comma-separated dates)
  const commaMatch = description.match(/(\d{1,2})\/(\d{1,2}),(\d{1,2})\/(\d{1,2})/);
  if (commaMatch) {
    const [, startMonth, startDay, endMonth, endDay] = commaMatch;
    return {
      startDate: `${year}-${startMonth.padStart(2, '0')}-${startDay.padStart(2, '0')}`,
      endDate: `${year}-${endMonth.padStart(2, '0')}-${endDay.padStart(2, '0')}`,
      raw: commaMatch[0]
    };
  }

  // Pattern 4: Single date MM/DD
  const singleMatch = description.match(/^(\d{1,2})\/(\d{1,2})(?:\s|$)/);
  if (singleMatch) {
    const [, month, day] = singleMatch;
    const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    return {
      startDate: dateStr,
      endDate: dateStr,
      raw: singleMatch[0].trim()
    };
  }

  return null;
}

/**
 * Expand a date range into individual dates
 * @param {string} startDate - YYYY-MM-DD format
 * @param {string} endDate - YYYY-MM-DD format
 * @returns {string[]} Array of dates in YYYY-MM-DD format
 */
function expandDateRange(startDate, endDate) {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Sanity check - don't expand ranges longer than 60 days
  const diffDays = (end - start) / (1000 * 60 * 60 * 24);
  if (diffDays > 60 || diffDays < 0) {
    return [startDate]; // Return just start date if range is invalid
  }

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

/**
 * Extract location name from description field
 * Examples:
 *   "10/31-11/05 SECURITY:LATCHFORD HOUSE" -> "LATCHFORD HOUSE"
 *   "10/28-10/31 SECURITY:BUCKLEY HS" -> "BUCKLEY HS"
 *   "FIRE/MEDIC: BUCKLEY" -> "BUCKLEY"
 *   "POLICE: MELROSE VIDEO BAR" -> "MELROSE VIDEO BAR"
 *   "10/16-10/28 GALLERIA MALL LOCATION FEE" -> "GALLERIA MALL"
 *   "10/16-10/24 LOC FEE:\"VILLAGE THEATER\"(FOX)" -> "VILLAGE THEATER"
 */
function extractLocationFromDescription(description) {
  if (!description || typeof description !== 'string') return '';

  const desc = description.toUpperCase().trim();

  // These descriptions with no dates are production overhead - extract them so Lambda can categorize
  const productionOverheadPatterns = [
    /^FIRE\s*(?:\(\d+\))?$/i,
    /^FIRE\s*SAFETY/i,
    /^PERMITS?\s*(?:\(\d+\))?$/i,
    /^POLICE\s*(?:\(\d+\))?$/i,
    /^MEDIC\s*(?:\(\d+\))?$/i,
    /^GUARDS?\s*$/i,
    /^MAPS?\s*(?:\(\d+\))?$/i,
    /^SECURITY\s*$/i
  ];

  for (const pattern of productionOverheadPatterns) {
    if (pattern.test(desc)) {
      // Return the service type so Lambda can classify as production overhead
      return desc.replace(/\s*\(\d+\)\s*/g, '').trim();
    }
  }

  // Ignore descriptions that are just category labels (no actual location)
  const categoryOnly = [
    'LOCATION SECURITY', 'SECURITY SERVICES', 'POLICE SERVICES',
    'FIRE SERVICES', 'PERMIT FEE', 'LOCATION FEE', 'FEE'
  ];
  if (categoryOnly.includes(desc)) return '';

  // Known service companies that should NOT be treated as locations
  // Use word boundaries to avoid false matches (e.g., "SITE REP" contains "EP")
  const serviceCompanyPatterns = [
    /\bPPS\b/,
    /\bPERMIT PLACE\b/,
    /\bENTERTAINMENT PARTNERS\b/,
    /\bEP OPERATIONS\b/,
    /\bCAST & CREW\b/,
    /\bPAYROLL SERVICES\b/
  ];
  for (const pattern of serviceCompanyPatterns) {
    if (pattern.test(desc)) return '';
  }

  // Pay types and rates that should NOT be treated as locations
  const payTypePatterns = [
    /^REGULAR\s*\d*\.?\d*X?$/i,
    /^OVERTIME\s*\d*\.?\d*X?$/i,
    /^OT\s*\d*\.?\d*X?$/i,
    /^DOUBLE\s*TIME/i,
    /^GOLDEN\s*TIME/i,
    /^MEAL\s*PENALTY/i,
    /^KIT\s*RENTAL/i,
    /^BOX\s*RENTAL/i,
    /^CAR\s*ALLOWANCE/i,
    /^MILEAGE/i,
    /^PER\s*DIEM/i,
    /^HOLIDAY\s*PAY/i,
    /^SICK\s*PAY/i,
    /^VACATION\s*PAY/i,
    /^\d+\.?\d*X$/i,
    /^FLAT\s*RATE/i,
    /^DAILY\s*RATE/i,
    /^WEEKLY\s*RATE/i
  ];

  const isPayType = (str) => {
    const s = str.trim();
    return payTypePatterns.some(pattern => pattern.test(s));
  };

  // Helper to clean up extracted location
  const cleanLocation = (loc) => {
    if (!loc) return '';
    let cleaned = loc.trim()
      .replace(/^["']+|["']+$/g, '')  // Remove surrounding quotes
      .replace(/\s*\(\d+\)\s*$/g, '')  // Remove episode suffixes like (102)
      .replace(/\((?:FOX|BRUIN|NBC|CBS|ABC|WB)\)$/i, '')  // Remove network suffixes
      .trim();
    return cleaned;
  };

  // PATTERN 1: Quoted locations - highest priority for proper nouns
  // "LOC FEE:"VILLAGE THEATER"(FOX)" -> VILLAGE THEATER
  // "VIP PARKING:"KELLNER'S HOUSE"" -> KELLNER'S HOUSE
  // "CLEANING:"VILLAGE THEATER"" -> VILLAGE THEATER
  const quotedMatch = desc.match(/["']([A-Z][A-Z0-9\s\-\'\.]+)["']/);
  if (quotedMatch) {
    const loc = cleanLocation(quotedMatch[1]);
    if (loc.length > 2 && !categoryOnly.includes(loc) && !isPayType(loc)) {
      return loc;
    }
  }

  // PATTERN 2: "LOCATION_NAME LOCATION FEE" or "LOCATION_NAME LOC FEE"
  // "GALLERIA MALL LOCATION FEE" -> GALLERIA MALL
  const locFeeMatch = desc.match(/(\d+\/\d+[\-\/]?\d*\s+)?([A-Z][A-Z0-9\s\-\'\.]+?)\s+(?:LOCATION\s+FEE|LOC\s+FEE)/i);
  if (locFeeMatch) {
    const loc = cleanLocation(locFeeMatch[2]);
    if (loc.length > 2 && !categoryOnly.includes(loc) && !isPayType(loc)) {
      return loc;
    }
  }

  // PATTERN 3: "LOCATION_NAME DEEP CLEAN" or "LOCATION_NAME CLEANING"
  // "GALLERIA DEEP CLEAN" -> GALLERIA
  // "PALACE THEATER CLEANING" -> PALACE THEATER
  const cleaningMatch = desc.match(/(\d+\/\d+[\-\/]?\d*\s+)?([A-Z][A-Z0-9\s\-\'\.]+?)\s+(?:DEEP\s+CLEAN|CLEANING)/i);
  if (cleaningMatch) {
    const loc = cleanLocation(cleaningMatch[2]);
    if (loc.length > 2 && !categoryOnly.includes(loc) && !isPayType(loc)) {
      return loc;
    }
  }

  // PATTERN 4: "INCONVENIENCE FEE:LOCATION" or "INCON FEE:LOCATION"
  const inconFeeMatch = desc.match(/INCON(?:VENIENCE)?\s+FEE[:\s]+["']?([A-Z][A-Z0-9\s\-\'\.]+?)["']?(?:\s*\(|$)/i);
  if (inconFeeMatch) {
    const loc = cleanLocation(inconFeeMatch[1]);
    if (loc.length > 2 && !categoryOnly.includes(loc) && !isPayType(loc)) {
      return loc;
    }
  }

  // PATTERN 5: SITE REP with compound prefix (SITE REP/ADDL PARK/WATER:GALLERIA)
  // Also handles "EXTRA PREP DAY:LOCATION"
  const siteRepCompoundMatch = desc.match(/(?:SITE\s*REP|EXTRA\s*PREP\s*DAY|PREP\s*DAY)[^:]*:\s*([A-Z0-9][A-Z0-9\s\-\'\.]+)/i);
  if (siteRepCompoundMatch) {
    const loc = cleanLocation(siteRepCompoundMatch[1]);
    if (loc.length > 2 && !categoryOnly.includes(loc) && !isPayType(loc)) {
      return loc;
    }
  }

  // PATTERN 6: VIP PARKING, BASECAMP, PARKING patterns with colon
  const parkingMatch = desc.match(/(?:VIP\s+)?(?:PARKING|BASECAMP)[:\s]+["']?([A-Z][A-Z0-9\s\-\'\.]+?)["']?(?:\s*\(|$)/i);
  if (parkingMatch) {
    const loc = cleanLocation(parkingMatch[1]);
    if (loc.length > 2 && !categoryOnly.includes(loc) && !isPayType(loc)) {
      return loc;
    }
  }

  // PATTERN 7: PREP/STRK CREW PRKG:LOCATION or similar compound prefixes
  const crewMatch = desc.match(/(?:PREP|STRK|CREW|PRKG)[\/\w\s]*[:\s]+([A-Z][A-Z0-9\s\-\'\.]+?)(?:\s*\(|$)/i);
  if (crewMatch) {
    const loc = cleanLocation(crewMatch[1]);
    if (loc.length > 2 && !categoryOnly.includes(loc) && !isPayType(loc)) {
      return loc;
    }
  }

  // PATTERN 8: Generic colon pattern (DATE RANGE TYPE:LOCATION)
  // Handles patterns like "REMOVE/REPLACE LIGHTS:LATCHFORD" or "PREP DAY:BRENTWOOD(102)"
  // Also handles "I/E LOCATION" or "3RD FLOOR PARKING" patterns
  const colonMatch = desc.match(/:\s*(?:I\/E\s+)?([A-Z0-9][A-Z0-9\s\-\'\.\/]+?)(?:\s*\(\d+\))?$/i);
  if (colonMatch) {
    const loc = cleanLocation(colonMatch[1]);
    if (loc.length > 2 && !categoryOnly.includes(loc) && !isPayType(loc)) {
      return loc;
    }
  }

  // PATTERN 9: LOCATION_NAME + SERVICE_TYPE (BUCKLEY HS SECURITY, TOWER RECORDS CLEANING)
  const serviceTypes = ['SECURITY', 'GUARDS', 'PERMIT'];
  for (const svc of serviceTypes) {
    const beforeSvcMatch = desc.match(new RegExp(`([A-Z][A-Z0-9\\s\\-\\']+)\\s+${svc}`, 'i'));
    if (beforeSvcMatch) {
      let loc = beforeSvcMatch[1].trim();
      loc = loc.replace(/^\d+\/\d+[\-\/]?\d*\s+/, '').trim();
      if (loc && loc.length > 2 && !categoryOnly.includes(loc) && !isPayType(loc)) {
        return cleanLocation(loc);
      }
    }
  }

  // PATTERN 10: dash/hyphen with keywords before it
  const dashMatch = desc.match(/(?:PERMIT|FEE|FILMING|LOCATION)\s*-\s*([A-Z][A-Z0-9\s\'\.]+)$/);
  if (dashMatch) {
    const loc = cleanLocation(dashMatch[1]);
    if (!isPayType(loc)) {
      return loc;
    }
  }

  // PATTERN 11: @location patterns
  const atMatch = desc.match(/(?:at|@)\s+([A-Z][A-Z0-9\s\-\'\.]+)/i);
  if (atMatch) {
    const loc = cleanLocation(atMatch[1]);
    if (!isPayType(loc)) {
      return loc;
    }
  }

  // PATTERN 12: BG HOLD, BLOCK DRVWAY, etc. with location after colon
  // "11/07-11/08 BG HOLD/BLOCK DRVWAY:MELROSE (102)" -> MELROSE
  const bgHoldMatch = desc.match(/(?:BG\s*HOLD|BLOCK\s*DRVWAY|DRIVEWAY)[^:]*:\s*([A-Z][A-Z0-9\s\-\'\.]+)/i);
  if (bgHoldMatch) {
    const loc = cleanLocation(bgHoldMatch[1]);
    if (loc.length > 2 && !categoryOnly.includes(loc) && !isPayType(loc)) {
      return loc;
    }
  }

  // PATTERN 13: PERMITS with location - "PERMITS:MELROSE AVE" or "10/16 PERMITS:VILLAGE"
  const permitsMatch = desc.match(/PERMITS?[:\s]+([A-Z][A-Z0-9\s\-\'\.]+?)(?:\s*:|$)/i);
  if (permitsMatch) {
    const loc = cleanLocation(permitsMatch[1]);
    // Only return if it's not just "FIRE" or another service
    if (loc.length > 3 && !categoryOnly.includes(loc) && !isPayType(loc) && !/^FIRE$/i.test(loc)) {
      return loc;
    }
  }

  // PATTERN 14: AMBASSADORS, TENTS, etc. with location - "VARIOUS AMBASSADORS:WESTWOOD"
  const ambassadorMatch = desc.match(/(?:AMBASSADORS?|TENTS?|TABLES?|CHAIRS?|DUMPSTERS?)[^:]*:\s*([A-Z][A-Z0-9\s\-\'\.]+)/i);
  if (ambassadorMatch) {
    const loc = cleanLocation(ambassadorMatch[1]);
    if (loc.length > 2 && !categoryOnly.includes(loc) && !isPayType(loc)) {
      return loc;
    }
  }

  // PATTERN 15: Invoice with location - "DRIVING INVOICE #2" -> DRIVING
  // Captures the word before INVOICE if it looks like a location
  const invoiceMatch = desc.match(/(\d+\/\d+[\/\-]?\d*\s+)?([A-Z][A-Z0-9\s\-\'\.]+)\s+INVOICE/i);
  if (invoiceMatch && invoiceMatch[2]) {
    const potentialLoc = cleanLocation(invoiceMatch[2]);
    // Only return if it's a known location-ish word (like DRIVING, BASECAMP, etc.)
    if (potentialLoc.length > 3 && !categoryOnly.includes(potentialLoc) && !isPayType(potentialLoc)) {
      return potentialLoc;
    }
  }

  // PATTERN 16: BASECAMP/PARKING at start with no colon - "10/17,10/20 BASECAMP/PARKING"
  // For these, just return "BASECAMP" or "PARKING" as the location
  const basecampMatch = desc.match(/\d+\/\d+[,\/\-\d]*\s+(BASECAMP|PARKING|DRIVING)/i);
  if (basecampMatch) {
    return basecampMatch[1].toUpperCase();
  }

  // PATTERN 17: Simple service words at end after date - "12/04-06 GUARDS"
  // Return the service type which will be mapped to production overhead
  const serviceEndMatch = desc.match(/\d+\/\d+[\/\-]?\d*\s+(GUARDS?|FIRE|POLICE|MEDIC|PERMITS?)\s*$/i);
  if (serviceEndMatch) {
    return serviceEndMatch[1].toUpperCase();
  }

  // PATTERN 18: Service with dates followed by location - "11/12-11/15 PERMITS(102)"MELROSE"
  const serviceWithLocMatch = desc.match(/\d+\/\d+[\/\-\d]*\s+(?:PERMITS?|FIRE|GUARDS?|POLICE|MEDIC)[\s\(\d\)]*[\"']?([A-Z][A-Z0-9\s\-\'\.]+)/i);
  if (serviceWithLocMatch) {
    const loc = cleanLocation(serviceWithLocMatch[1]);
    if (loc.length > 2 && !categoryOnly.includes(loc) && !isPayType(loc)) {
      return loc;
    }
  }

  // PATTERN 19: CLEANING SERVICE, HMU STATION, etc. - production overhead
  const equipmentServiceMatch = desc.match(/\d+\/\d+[\/\-\d]*\s+(CLEANING\s*SERVICE|HMU\s*STATION|DIR\s*CHAIRS|TENTS|TABLES|CHAIRS|DUMPSTERS?|MAPS?|PERMIT\s*SVC|AIR\s*QUALITY|REMOVE\/RESTORE|DEL\/PU|SITE\s*REP)/i);
  if (equipmentServiceMatch) {
    return equipmentServiceMatch[1].toUpperCase().replace(/\s+/g, ' ').trim();
  }

  // PATTERN 20: Generic production items - TENTS/TABLES/CHAIRS, DUMPSTERS, etc.
  const genericProdMatch = desc.match(/\d+\/\d+[\/\-\d]*\s+[\d\)]*\s*(TENTS?\/TABLES?\/CHAIRS?|DUMPSTERS?\/CIG\s*CANS?|HMU\s*STATION\/DIR\s*CHAIRS)/i);
  if (genericProdMatch) {
    return genericProdMatch[1].toUpperCase().replace(/\s+/g, ' ').trim();
  }

  return '';
}

/**
 * Parse an Excel ledger file buffer
 */
export function parseExcelLedger(buffer, filename) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const transactions = [];

  // Get file info from filename
  const fileInfo = parseFilename(filename);

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Find header row
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i];
      if (row && row.some(cell =>
        typeof cell === 'string' &&
        (cell.toLowerCase().includes('location') ||
         cell.toLowerCase().includes('vendor') ||
         cell.toLowerCase().includes('amount'))
      )) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) continue;

    const headers = data[headerRowIndex].map(h => String(h || '').toLowerCase().trim());
    const locationCol = headers.findIndex(h => h.includes('locationcode') || h.includes('location') || h.includes('set'));
    const vendorCol = headers.findIndex(h => h.includes('vendorname') || h.includes('vendor') || h.includes('payee'));
    const amountCol = headers.findIndex(h => h.includes('amount') || h.includes('total'));
    const transNumCol = headers.findIndex(h => h.includes('trans') || h.includes('po') || h.includes('number'));
    // Be specific: match 'description' exactly (not 'accountdesc') or 'memo'
    const descCol = headers.findIndex(h => h === 'description' || h === 'memo' || h === 'desc');

    // Parse data rows
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const location = locationCol >= 0 ? String(row[locationCol] || '').trim() : '';
      const vendor = vendorCol >= 0 ? String(row[vendorCol] || '').trim() : '';
      const amount = amountCol >= 0 ? parseFloat(row[amountCol]) || 0 : 0;
      const transNumber = transNumCol >= 0 ? String(row[transNumCol] || '').trim() : '';
      const description = descCol >= 0 ? String(row[descCol] || '').trim() : '';

      // Skip summary/total rows (no vendor AND no description)
      // These are Excel totals that should not be processed
      if (!vendor && !description) {
        continue;
      }

      // Only include rows with non-zero amounts (filters out headers, footers, empty rows)
      if (amount !== 0) {
        // Extract location name from description if location code is just a number
        const extractedLocation = extractLocationFromDescription(description);
        const locationName = extractedLocation || (location && !/^\d+$/.test(location) ? location : '');

        // Extract date range from description for location inference
        const reportDate = fileInfo?.date || new Date().toISOString().split('T')[0];
        const dateRange = extractDateRangeFromDescription(description, reportDate);

        const transaction = {
          location: locationName,
          locationCode: location,
          vendor,
          amount,
          transNumber,
          description,
          sheet: sheetName,
          episode: fileInfo?.episode || 'unknown',
          account: fileInfo?.account || 'unknown',
          category: ACCOUNT_CATEGORIES[fileInfo?.account] || 'Unknown',
          reportDate,
          dateRange: dateRange || null
        };

        // Add hash for deduplication
        transaction.hash = generateHash({
          location: transaction.location,
          vendor: transaction.vendor,
          transNumber: transaction.transNumber,
          amount: transaction.amount
        });

        transactions.push(transaction);
      }
    }
  }

  return {
    filename,
    episode: fileInfo?.episode || 'unknown',
    account: fileInfo?.account || 'unknown',
    category: ACCOUNT_CATEGORIES[fileInfo?.account] || 'Unknown',
    reportDate: fileInfo?.date || new Date().toISOString().split('T')[0],
    transactions,
    transactionCount: transactions.length
  };
}

/**
 * Parse multiple ledger files
 */
export function parseLedgerFiles(files) {
  const results = {
    parsedAt: new Date().toISOString(),
    totalFiles: files.length,
    successfulParses: 0,
    errors: [],
    ledgers: []
  };

  for (const file of files) {
    try {
      const ledger = parseExcelLedger(file.buffer, file.filename);
      results.ledgers.push(ledger);
      results.successfulParses++;
    } catch (error) {
      results.errors.push({
        filename: file.filename,
        error: error.message
      });
    }
  }

  return results;
}

export {
  extractDateRangeFromDescription,
  expandDateRange
};

export default {
  parseExcelLedger,
  parseLedgerFiles,
  ACCOUNT_CATEGORIES,
  extractDateRangeFromDescription,
  expandDateRange
};
