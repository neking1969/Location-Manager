/**
 * Location Matcher - Matches ledger locations to Glide locations
 */

import { matchLocation, normalize } from '../utils/fuzzyMatch.js';

/**
 * Match all locations from parsed ledgers
 */
export function matchLocations(parsedLedgers, glideLocations, locationMappings = {}) {
  const results = {
    matched: [],
    needsMapping: [],
    needsGlideEntry: [],
    serviceCharges: []
  };

  // Collect unique locations
  const locationStats = new Map();

  for (const ledger of parsedLedgers.ledgers || []) {
    for (const trans of ledger.transactions || []) {
      if (!trans.location) continue;

      const normalized = normalize(trans.location);
      if (!locationStats.has(normalized)) {
        locationStats.set(normalized, {
          ledgerLocation: trans.location,
          occurrences: 0,
          totalAmount: 0,
          episodes: new Set(),
          accounts: new Set(),
          vendors: new Set()
        });
      }

      const stats = locationStats.get(normalized);
      stats.occurrences++;
      stats.totalAmount += trans.amount || 0;
      stats.episodes.add(trans.episode);
      stats.accounts.add(trans.account);
      stats.vendors.add(trans.vendor);
    }
  }

  // Match each unique location
  for (const [, stats] of locationStats) {
    const matchResult = matchLocation(stats.ledgerLocation, glideLocations, locationMappings);

    const item = {
      ledgerLocation: stats.ledgerLocation,
      occurrences: stats.occurrences,
      totalAmount: Math.round(stats.totalAmount * 100) / 100,
      episodes: Array.from(stats.episodes),
      accounts: Array.from(stats.accounts),
      vendors: Array.from(stats.vendors).slice(0, 3)
    };

    if (matchResult.isServiceCharge) {
      results.serviceCharges.push({
        ...item,
        reason: matchResult.reason
      });
    } else if (matchResult.match) {
      results.matched.push({
        ...item,
        mappedLocation: matchResult.match,
        confidence: matchResult.confidence,
        rowId: matchResult.rowId
      });
    } else if (matchResult.alternatives?.length > 0) {
      results.needsMapping.push({
        ...item,
        suggestedMatch: matchResult.alternatives[0]?.item?.name || null,
        possibleMatches: matchResult.alternatives.map(a => a.item?.name).filter(Boolean),
        reason: matchResult.reason
      });
    } else {
      results.needsGlideEntry.push({
        ...item,
        proposedName: stats.ledgerLocation,
        category: 'TBD'
      });
    }
  }

  // Calculate stats
  const totalLocations = locationStats.size;
  const matchedCount = results.matched.length;
  const matchRate = totalLocations > 0 ? Math.round((matchedCount / totalLocations) * 100) : 0;

  return {
    ...results,
    stats: {
      totalLocations,
      matchedCount,
      unmatchedCount: results.needsMapping.length + results.needsGlideEntry.length,
      serviceChargeCount: results.serviceCharges.length,
      matchRate
    }
  };
}

/**
 * Generate review items for Kirsten
 */
export function generateLocationReview(matchResults) {
  const reviewItems = [];

  // Items that need mapping (have possible matches)
  for (const item of matchResults.needsMapping) {
    reviewItems.push({
      type: 'needs_mapping',
      ledgerLocation: item.ledgerLocation,
      occurrences: item.occurrences,
      totalAmount: item.totalAmount,
      episodes: item.episodes,
      accounts: item.accounts,
      vendors: item.vendors,
      suggestedMatch: item.suggestedMatch,
      possibleMatches: item.possibleMatches,
      action: null // Kirsten will set this
    });
  }

  // Items that need new Glide entries
  for (const item of matchResults.needsGlideEntry) {
    reviewItems.push({
      type: 'needs_new_entry',
      ledgerLocation: item.ledgerLocation,
      occurrences: item.occurrences,
      totalAmount: item.totalAmount,
      episodes: item.episodes,
      accounts: item.accounts,
      vendors: item.vendors,
      proposedName: item.proposedName,
      approved: false // Kirsten will approve
    });
  }

  return reviewItems;
}

export default {
  matchLocations,
  generateLocationReview
};
