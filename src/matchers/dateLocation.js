/**
 * Date-based Location Inference
 *
 * Multi-pass algorithm to infer locations for transactions without explicit location names:
 * 1. First pass: Build date-to-location maps (per-episode AND global)
 * 2. Second pass: Infer locations using date lookups
 * 3. Third pass: Fall back to episode primary location for remaining unmatched
 */

import { expandDateRange } from '../parsers/ledger.js';

export const SERVICE_TYPES = [
  'GUARDS', 'GUARD', 'FIRE', 'PERMITS', 'PERMIT', 'POLICE', 'MEDIC', 'SECURITY',
  'CLEANING SERVICE', 'HMU STATION', 'DIR CHAIRS', 'TENTS', 'TABLES', 'CHAIRS',
  'DUMPSTERS', 'MAPS', 'MAP', 'PERMIT SVC', 'AIR QUALITY', 'BASECAMP', 'PARKING', 'DRIVING'
];

/**
 * Build maps of dates to locations - both per-episode and global
 *
 * @param {Object} parsedLedgers - Output from parseLedgerFiles
 * @returns {Object} { byEpisode: { episode: { date: [locations] } }, global: { date: [locations] }, episodePrimary: { episode: location } }
 */
export function buildDateLocationMap(parsedLedgers) {
  const byEpisode = {};
  const globalMap = {};
  const episodeLocationCounts = {};

  for (const ledger of parsedLedgers.ledgers || []) {
    for (const txn of ledger.transactions || []) {
      if (!txn.location || !txn.dateRange) continue;

      const locUpper = txn.location.toUpperCase();
      if (SERVICE_TYPES.includes(locUpper)) continue;

      const episode = txn.episode || 'unknown';
      if (!byEpisode[episode]) byEpisode[episode] = {};
      if (!episodeLocationCounts[episode]) episodeLocationCounts[episode] = {};

      const dates = expandDateRange(txn.dateRange.startDate, txn.dateRange.endDate);
      for (const date of dates) {
        if (!byEpisode[episode][date]) byEpisode[episode][date] = new Set();
        byEpisode[episode][date].add(locUpper);

        if (!globalMap[date]) globalMap[date] = new Set();
        globalMap[date].add(locUpper);
      }

      episodeLocationCounts[episode][locUpper] = (episodeLocationCounts[episode][locUpper] || 0) + Math.abs(txn.amount || 1);
    }
  }

  const result = { byEpisode: {}, global: {}, episodePrimary: {} };

  for (const episode in byEpisode) {
    result.byEpisode[episode] = {};
    for (const date in byEpisode[episode]) {
      result.byEpisode[episode][date] = Array.from(byEpisode[episode][date]);
    }
  }

  for (const date in globalMap) {
    result.global[date] = Array.from(globalMap[date]);
  }

  for (const episode in episodeLocationCounts) {
    const counts = episodeLocationCounts[episode];
    let maxLoc = null;
    let maxCount = 0;
    for (const loc in counts) {
      if (counts[loc] > maxCount) {
        maxCount = counts[loc];
        maxLoc = loc;
      }
    }
    if (maxLoc) result.episodePrimary[episode] = maxLoc;
  }

  return result;
}

/**
 * Infer locations for transactions that don't have explicit location names
 * Uses multi-level fallback: episode dates -> global dates -> episode primary
 *
 * @param {Object} parsedLedgers - Output from parseLedgerFiles (will be mutated)
 * @param {Object} maps - Output from buildDateLocationMap { byEpisode, global, episodePrimary }
 * @returns {Object} Stats about the inference process
 */
export function inferLocations(parsedLedgers, maps) {
  const stats = {
    totalTransactions: 0,
    alreadyHadLocation: 0,
    inferredFromEpisodeDates: 0,
    inferredFromGlobalDates: 0,
    inferredFromEpisodePrimary: 0,
    multipleOptions: 0,
    noMatch: 0,
    noDateRange: 0
  };

  for (const ledger of parsedLedgers.ledgers || []) {
    for (const txn of ledger.transactions || []) {
      stats.totalTransactions++;

      if (txn.location && !SERVICE_TYPES.includes(txn.location.toUpperCase())) {
        stats.alreadyHadLocation++;
        continue;
      }

      if (!txn.dateRange) {
        stats.noDateRange++;
        continue;
      }

      const episode = txn.episode || 'unknown';
      const dates = expandDateRange(txn.dateRange.startDate, txn.dateRange.endDate);

      // Try 1: Episode-specific date lookup
      const episodeMap = maps.byEpisode[episode] || {};
      let possibleLocations = findLocationsOnDates(dates, episodeMap);

      if (possibleLocations.length === 1) {
        stats.inferredFromEpisodeDates++;
        txn.inferredLocation = possibleLocations[0];
        txn.inferenceReason = 'episode_date_match';
        txn.inferenceConfidence = 'high';
        continue;
      }

      // Try 2: Global date lookup (all episodes)
      if (possibleLocations.length === 0) {
        possibleLocations = findLocationsOnDates(dates, maps.global);

        if (possibleLocations.length === 1) {
          stats.inferredFromGlobalDates++;
          txn.inferredLocation = possibleLocations[0];
          txn.inferenceReason = 'global_date_match';
          txn.inferenceConfidence = 'medium';
          continue;
        }
      }

      // Multiple locations found - pick episode primary if available
      if (possibleLocations.length > 1) {
        const primary = maps.episodePrimary[episode];
        if (primary && possibleLocations.includes(primary)) {
          stats.inferredFromEpisodePrimary++;
          txn.inferredLocation = primary;
          txn.inferenceReason = 'multiple_picked_primary';
          txn.inferenceConfidence = 'medium';
          txn.possibleLocations = possibleLocations;
          continue;
        }

        stats.multipleOptions++;
        txn.inferredLocation = null;
        txn.inferenceReason = 'multiple_locations';
        txn.possibleLocations = possibleLocations;
        txn.inferenceConfidence = 'review_needed';
        continue;
      }

      // Try 3: Episode primary as last resort
      const primary = maps.episodePrimary[episode];
      if (primary) {
        stats.inferredFromEpisodePrimary++;
        txn.inferredLocation = primary;
        txn.inferenceReason = 'episode_primary_fallback';
        txn.inferenceConfidence = 'low';
        continue;
      }

      stats.noMatch++;
      txn.inferredLocation = null;
      txn.inferenceReason = 'no_locations_on_dates';
      txn.searchedDates = dates;
    }
  }

  return stats;
}

function findLocationsOnDates(dates, dateMap) {
  const locations = new Set();
  for (const date of dates) {
    const locs = dateMap[date];
    if (locs) locs.forEach(loc => locations.add(loc));
  }
  return Array.from(locations);
}

/**
 * Run the full multi-pass inference algorithm
 *
 * @param {Object} parsedLedgers - Output from parseLedgerFiles
 * @returns {Object} { parsedLedgers (mutated), maps, stats }
 */
export function runLocationInference(parsedLedgers) {
  const maps = buildDateLocationMap(parsedLedgers);
  const stats = inferLocations(parsedLedgers, maps);

  return {
    parsedLedgers,
    maps,
    stats
  };
}

export default {
  buildDateLocationMap,
  inferLocations,
  runLocationInference,
  SERVICE_TYPES
};
