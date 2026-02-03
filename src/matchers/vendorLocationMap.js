/**
 * Vendor-to-Location Inference
 *
 * Builds a map of vendors to their most common locations based on historical transactions.
 * Used as a fallback when date-based inference fails.
 */

import { SERVICE_TYPES } from './dateLocation.js';

/**
 * Build a map of vendors to locations based on transaction history
 *
 * @param {Object} parsedLedgers - Output from parseLedgerFiles
 * @returns {Object} { vendorMap: { vendor: { location, count, confidence } }, stats }
 */
export function buildVendorLocationMap(parsedLedgers) {
  const vendorLocations = {};

  for (const ledger of parsedLedgers.ledgers || []) {
    for (const txn of ledger.transactions || []) {
      if (!txn.vendor || !txn.location) continue;

      const locUpper = txn.location.toUpperCase();
      if (SERVICE_TYPES.includes(locUpper)) continue;

      const vendorKey = txn.vendor.toUpperCase().trim();
      if (!vendorLocations[vendorKey]) {
        vendorLocations[vendorKey] = {};
      }

      vendorLocations[vendorKey][locUpper] = (vendorLocations[vendorKey][locUpper] || 0) + 1;
    }
  }

  const vendorMap = {};
  let highConfidence = 0;
  let mediumConfidence = 0;
  let lowConfidence = 0;

  for (const vendor in vendorLocations) {
    const locs = vendorLocations[vendor];
    const entries = Object.entries(locs).sort((a, b) => b[1] - a[1]);

    if (entries.length === 0) continue;

    const [topLocation, topCount] = entries[0];
    const totalCount = entries.reduce((sum, [, c]) => sum + c, 0);
    const ratio = topCount / totalCount;

    let confidence;
    if (entries.length === 1 && topCount >= 3) {
      confidence = 'high';
      highConfidence++;
    } else if (ratio >= 0.8 && topCount >= 2) {
      confidence = 'medium';
      mediumConfidence++;
    } else if (ratio >= 0.6 && topCount >= 2) {
      confidence = 'low';
      lowConfidence++;
    } else {
      continue;
    }

    vendorMap[vendor] = {
      location: topLocation,
      count: topCount,
      totalAppearances: totalCount,
      ratio: Math.round(ratio * 100),
      confidence,
      allLocations: entries.length > 1 ? entries.slice(0, 3).map(([l, c]) => ({ location: l, count: c })) : undefined
    };
  }

  return {
    vendorMap,
    stats: {
      totalVendors: Object.keys(vendorLocations).length,
      mappedVendors: Object.keys(vendorMap).length,
      highConfidence,
      mediumConfidence,
      lowConfidence
    }
  };
}

/**
 * Apply vendor-based location inference to unmatched transactions
 *
 * @param {Object} parsedLedgers - Output from parseLedgerFiles (will be mutated)
 * @param {Object} vendorMap - Output from buildVendorLocationMap
 * @returns {Object} Stats about vendor inference
 */
export function inferLocationsFromVendor(parsedLedgers, vendorMap) {
  const stats = {
    attempted: 0,
    inferredHigh: 0,
    inferredMedium: 0,
    inferredLow: 0,
    noVendorMatch: 0
  };

  for (const ledger of parsedLedgers.ledgers || []) {
    for (const txn of ledger.transactions || []) {
      if (txn.inferredLocation || (txn.location && !SERVICE_TYPES.includes(txn.location.toUpperCase()))) {
        continue;
      }

      if (!txn.vendor) {
        stats.noVendorMatch++;
        continue;
      }

      stats.attempted++;
      const vendorKey = txn.vendor.toUpperCase().trim();
      const mapping = vendorMap[vendorKey];

      if (!mapping) {
        stats.noVendorMatch++;
        continue;
      }

      txn.inferredLocation = mapping.location;
      txn.inferenceReason = 'vendor_history';
      txn.inferenceConfidence = mapping.confidence;
      txn.vendorLocationRatio = mapping.ratio;

      if (mapping.confidence === 'high') stats.inferredHigh++;
      else if (mapping.confidence === 'medium') stats.inferredMedium++;
      else stats.inferredLow++;
    }
  }

  return stats;
}

export default {
  buildVendorLocationMap,
  inferLocationsFromVendor
};
