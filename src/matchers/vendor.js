/**
 * Vendor Matcher - Matches ledger vendors to known vendor contacts
 */

import { matchVendor, normalize } from '../utils/fuzzyMatch.js';

/**
 * Extract unique vendors from parsed ledgers
 */
export function extractVendors(parsedLedgers) {
  const vendorStats = new Map();

  for (const ledger of parsedLedgers.ledgers || []) {
    for (const trans of ledger.transactions || []) {
      if (!trans.vendor) continue;

      const normalized = normalize(trans.vendor);
      if (!normalized) continue;

      if (!vendorStats.has(normalized)) {
        vendorStats.set(normalized, {
          ledgerName: trans.vendor,
          occurrences: 0,
          totalAmount: 0,
          episodes: new Set(),
          locations: new Set()
        });
      }

      const stats = vendorStats.get(normalized);
      stats.occurrences++;
      stats.totalAmount += trans.amount || 0;
      stats.episodes.add(trans.episode);
      stats.locations.add(trans.location);
    }
  }

  return Array.from(vendorStats.values()).map(v => ({
    ...v,
    episodes: Array.from(v.episodes),
    locations: Array.from(v.locations).slice(0, 5)
  }));
}

/**
 * Match vendors from ledger to known vendor contacts
 */
export function matchVendors(ledgerVendors, vendorContacts) {
  const results = {
    matched: [],
    newVendors: [],
    lowConfidence: []
  };

  for (const vendor of ledgerVendors) {
    const matchResult = matchVendor(vendor.ledgerName, vendorContacts);

    if (matchResult.match && matchResult.confidence >= 90) {
      results.matched.push({
        ledgerName: vendor.ledgerName,
        matchedTo: matchResult.match.name,
        confidence: matchResult.confidence,
        enrichment: matchResult.match,
        occurrences: vendor.occurrences,
        totalAmount: vendor.totalAmount
      });
    } else if (matchResult.match && matchResult.confidence >= 70) {
      results.lowConfidence.push({
        ledgerName: vendor.ledgerName,
        suggestedMatch: matchResult.match.name,
        confidence: matchResult.confidence,
        alternatives: matchResult.alternatives,
        occurrences: vendor.occurrences,
        totalAmount: vendor.totalAmount
      });
    } else {
      results.newVendors.push({
        ledgerName: vendor.ledgerName,
        occurrences: vendor.occurrences,
        totalAmount: vendor.totalAmount,
        episodes: vendor.episodes,
        suggestedCategory: guessCategory(vendor.ledgerName),
        alternatives: matchResult.alternatives
      });
    }
  }

  return results;
}

/**
 * Guess vendor category from name using word boundary matching
 */
function guessCategory(vendorName) {
  const name = vendorName.toUpperCase();
  const words = name.split(/[\s\-_.,&]+/);

  const categoryPatterns = {
    'Security': ['SECURITY', 'GUARD', 'PATROL', 'SURVEILLANCE'],
    'Police': ['POLICE', 'SHERIFF', 'CHP', 'LAPD', 'PD'],
    'Fire': ['FIRE', 'RESCUE', 'EMT', 'PARAMEDIC'],
    'A/C': ['HVAC', 'COOLING', 'HEATING'],
    'Cleaning': ['CLEANING', 'SANITATION', 'JANITORIAL', 'WASTE', 'JANITOR'],
    'Electrical': ['ELECTRICAL', 'ELECTRIC', 'LIGHTING'],
    'Catering': ['CATERING', 'CATERER', 'CRAFT SERVICES', 'CRAFTY'],
    'Transportation': ['TRANSPORT', 'TRUCKING', 'VEHICLE', 'LOGISTICS'],
    'Equipment': ['RENTAL', 'RENTALS', 'EQUIPMENT', 'SUPPLIES']
  };

  for (const [category, patterns] of Object.entries(categoryPatterns)) {
    for (const pattern of patterns) {
      if (pattern.includes(' ')) {
        if (name.includes(pattern)) {
          return category;
        }
      } else {
        if (words.includes(pattern)) {
          return category;
        }
      }
    }
  }

  return 'Other';
}

/**
 * Generate vendor review items for Kirsten
 */
export function generateVendorReview(matchResults) {
  const reviewItems = [];

  // Low confidence matches
  for (const item of matchResults.lowConfidence) {
    reviewItems.push({
      type: 'low_confidence',
      ledgerName: item.ledgerName,
      suggestedMatch: item.suggestedMatch,
      confidence: item.confidence,
      occurrences: item.occurrences,
      totalAmount: item.totalAmount,
      action: null
    });
  }

  // New vendors (not in database)
  for (const item of matchResults.newVendors) {
    reviewItems.push({
      type: 'new_vendor',
      ledgerName: item.ledgerName,
      suggestedCategory: item.suggestedCategory,
      occurrences: item.occurrences,
      totalAmount: item.totalAmount,
      approved: false
    });
  }

  return reviewItems;
}

export default {
  extractVendors,
  matchVendors,
  generateVendorReview
};
