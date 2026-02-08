/**
 * Production Overhead Categorization
 *
 * Identifies transactions that are legitimately NOT location-specific:
 * - Payroll items that couldn't be date-inferred
 * - Generic permits and fees without location context
 * - Production-wide services
 *
 * These are categorized as "Production Overhead" rather than "Unmatched"
 */

const PAYROLL_PATTERNS = [
  /^\d{1,2}\/\d{1,2}\/\d{2,4}\s*:\s*[A-Z]+,?\s*[A-Z]?\s*:/i,
  /REGULAR\s*\d*\.?\d*X/i,
  /OVERTIME\s*\d*\.?\d*X/i,
  /DOUBLE\s*TIME/i,
  /GOLDEN\s*TIME/i,
  /MEAL\s*PENALTY/i,
  /KIT\s*RENTAL/i,
  /BOX\s*RENTAL/i,
  /\w+\s*ALLOWANCE/i,
  /MILEAGE/i,
  /PER\s*DIEM/i,
  /HOLIDAY\s*PAY/i,
  /SICK\s*PAY/i,
  /VACATION\s*PAY/i
];

const PAYROLL_VENDORS = [
  'ENTERTAINMENT PARTNERS',
  'EP OPERATIONS',
  'CAST & CREW',
  'PAYROLL SERVICES',
  'ADP',
  'PAYCHEX'
];

const OVERHEAD_DESCRIPTION_PATTERNS = [
  /^PERMIT\s*FEE$/i,
  /^FIRE\s*(?:SAFETY)?$/i,
  /^POLICE$/i,
  /^MEDIC$/i,
  /^SECURITY$/i,
  /^GUARDS?$/i,
  /GENERAL\s*LIABILITY/i,
  /WORKERS?\s*COMP/i,
  /INSURANCE/i
];

/**
 * Check if a transaction is payroll
 */
export function isPayrollTransaction(txn) {
  const desc = (txn.description || '').toUpperCase();
  const vendor = (txn.vendor || '').toUpperCase();

  if (txn.dateRange?.isPayroll) return true;

  for (const pattern of PAYROLL_PATTERNS) {
    if (pattern.test(desc)) return true;
  }

  for (const v of PAYROLL_VENDORS) {
    if (vendor.includes(v)) return true;
  }

  return false;
}

/**
 * Check if a transaction is generic overhead
 */
function isOverheadTransaction(txn) {
  const desc = (txn.description || '').toUpperCase();

  for (const pattern of OVERHEAD_DESCRIPTION_PATTERNS) {
    if (pattern.test(desc)) return true;
  }

  return false;
}

/**
 * Categorize remaining unmatched transactions as Production Overhead
 *
 * @param {Object} parsedLedgers - Output from parseLedgerFiles (will be mutated)
 * @returns {Object} Stats about overhead categorization
 */
export function categorizeProductionOverhead(parsedLedgers) {
  const stats = {
    totalChecked: 0,
    payroll: 0,
    overhead: 0,
    stillUnmatched: 0,
    payrollAmount: 0,
    overheadAmount: 0,
    unmatchedAmount: 0
  };

  for (const ledger of parsedLedgers.ledgers || []) {
    for (const txn of ledger.transactions || []) {
      stats.totalChecked++;
      const amount = Math.abs(txn.amount || 0);

      // Check for payroll — but GL 6304/6305/6307/6342 payroll
      // IS location spend (officers, firefighters, site personnel)
      const txnGl = txn.glCode || (txn.transNumber || '').substring(0, 4);
      const isLocationLabor = ['6304', '6305', '6307', '6342'].includes(txnGl);
      if (!isLocationLabor && isPayrollTransaction(txn)) {
        txn.category = 'production_overhead';
        txn.overheadType = 'payroll';
        txn.locationRequired = false;
        // Clear any incorrectly inferred location
        if (txn.inferredLocation) {
          txn.inferredLocation = null;
          txn.location = null;
          txn.locationSource = 'payroll';
        }
        stats.payroll++;
        stats.payrollAmount += amount;
      } else if (!txn.inferredLocation && !txn.location) {
        // Only check for generic overhead if no location
        if (isOverheadTransaction(txn)) {
          txn.category = 'production_overhead';
          txn.overheadType = 'general_overhead';
          txn.locationRequired = false;
          stats.overhead++;
          stats.overheadAmount += amount;
        } else {
          stats.stillUnmatched++;
          stats.unmatchedAmount += amount;
        }
      }
    }
  }

  return stats;
}

export default {
  categorizeProductionOverhead,
  isPayrollTransaction,
  isOverheadTransaction
};
