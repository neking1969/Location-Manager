/**
 * Fuzzy matching utilities for location and vendor name matching
 */

import Fuse from 'fuse.js';

/**
 * Create a fuzzy matcher for a list of items
 */
export function createMatcher(items, keys = ['name'], threshold = 0.4) {
  return new Fuse(items, {
    keys,
    threshold,
    includeScore: true,
    ignoreLocation: true,
    findAllMatches: true
  });
}

/**
 * Normalize a string for comparison
 */
export function normalize(str) {
  if (!str) return '';
  return str
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ')        // Normalize whitespace
    .trim();
}

/**
 * Calculate match confidence (0-100)
 */
export function calculateConfidence(score) {
  // Fuse score is 0 (perfect) to 1 (no match)
  return Math.round((1 - score) * 100);
}

/**
 * Find the best match for a string in a list
 */
export function findBestMatch(query, candidates, options = {}) {
  const {
    keys = ['name'],
    threshold = 0.4,
    minConfidence = 50
  } = options;

  const fuse = createMatcher(candidates, keys, threshold);
  const results = fuse.search(query);

  if (results.length === 0) {
    return { match: null, confidence: 0, alternatives: [] };
  }

  const best = results[0];
  const confidence = calculateConfidence(best.score);

  if (confidence < minConfidence) {
    return {
      match: null,
      confidence: 0,
      alternatives: results.slice(0, 3).map(r => ({
        item: r.item,
        confidence: calculateConfidence(r.score)
      })),
      rejectedBest: {
        item: best.item,
        confidence
      }
    };
  }

  return {
    match: best.item,
    confidence,
    alternatives: results.slice(1, 4).map(r => ({
      item: r.item,
      confidence: calculateConfidence(r.score)
    }))
  };
}

/**
 * Match location from ledger to Glide locations
 */
export function matchLocation(ledgerLocation, glideLocations, locationMappings = {}) {
  // First check explicit mappings
  const normalized = normalize(ledgerLocation);

  // Check direct mapping - support both array format (from S3) and object format
  const mappingsArray = locationMappings.mappings || [];

  // Convert array format to lookup
  for (const mapping of mappingsArray) {
    if (!mapping.ledgerLocation) continue;

    // Check exact match
    const mappingNormalized = normalize(mapping.ledgerLocation);
    if (mappingNormalized === normalized) {
      // Check if it's a service charge / production overhead
      if (mapping.budgetLocation === 'SERVICE_CHARGE' || mapping.budgetLocation === 'PRODUCTION_OVERHEAD') {
        return {
          match: null,
          confidence: 0,
          reason: mapping.budgetLocation,
          isServiceCharge: true
        };
      }
      return {
        match: mapping.budgetLocation,
        confidence: 100,
        reason: 'explicit mapping'
      };
    }

    // Check aliases
    if (mapping.aliases) {
      for (const alias of mapping.aliases) {
        const aliasNormalized = normalize(alias);
        if (aliasNormalized === normalized) {
          if (mapping.budgetLocation === 'SERVICE_CHARGE' || mapping.budgetLocation === 'PRODUCTION_OVERHEAD') {
            return {
              match: null,
              confidence: 0,
              reason: mapping.budgetLocation,
              isServiceCharge: true
            };
          }
          return {
            match: mapping.budgetLocation,
            confidence: 100,
            reason: 'alias mapping'
          };
        }
      }
    }
  }

  // Try fuzzy matching against Glide locations
  // Note: Glide returns 'Name' which fromGlideRow transforms to 'locationName'
  const candidates = glideLocations.map(loc => ({
    name: loc.locationName || loc.name || loc.Name,
    rowId: loc.rowId || loc['$rowID']
  }));

  const result = findBestMatch(ledgerLocation, candidates, {
    keys: ['name'],
    threshold: 0.5,
    minConfidence: 60
  });

  if (result.match) {
    return {
      match: result.match.name,
      rowId: result.match.rowId,
      confidence: result.confidence,
      reason: 'fuzzy match',
      alternatives: result.alternatives
    };
  }

  return {
    match: null,
    confidence: 0,
    reason: 'no match found',
    alternatives: result.alternatives
  };
}

/**
 * Match vendor from ledger to known vendors
 */
export function matchVendor(ledgerVendor, vendorContacts) {
  const result = findBestMatch(ledgerVendor, vendorContacts, {
    keys: ['name', 'aliases'],
    threshold: 0.4,
    minConfidence: 70
  });

  return {
    match: result.match,
    confidence: result.confidence,
    alternatives: result.alternatives
  };
}

export default {
  createMatcher,
  normalize,
  calculateConfidence,
  findBestMatch,
  matchLocation,
  matchVendor
};
