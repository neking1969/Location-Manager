/**
 * Sync API - Main endpoint for processing ledger files and syncing to Glide
 *
 * This is called by Make.com when Kirsten presses "Sync Now" in Glide
 */

import { parseLedgerFiles } from '../parsers/ledger.js';
import { parseSmartPO } from '../parsers/smartpo.js';
import { matchLocations, generateLocationReview } from '../matchers/location.js';
import { extractVendors, matchVendors, generateVendorReview } from '../matchers/vendor.js';
import { runLocationInference } from '../matchers/dateLocation.js';
import { buildVendorLocationMap, inferLocationsFromVendor } from '../matchers/vendorLocationMap.js';
import { categorizeProductionOverhead } from '../matchers/productionOverhead.js';
import { createGlideClient } from '../glide/client.js';

/**
 * Main sync handler
 *
 * @param {Object} input - Input from Make.com
 * @param {Array} input.ledgerFiles - Array of { filename, buffer } for ledger files
 * @param {Object} input.smartpoFile - { filename, buffer } for SmartPO file (optional)
 * @param {Object} input.options - Processing options
 * @returns {Object} Sync results including review items
 */
export async function handleSync(input) {
  const results = {
    success: true,
    timestamp: new Date().toISOString(),
    ledgers: null,
    smartpo: null,
    locations: null,
    vendors: null,
    reviewItems: [],
    summary: {}
  };

  try {
    // 1. Initialize Glide client
    const glide = createGlideClient();

    // 2. Get current Glide data for matching
    let glideLocations = [];
    let glideVendors = [];
    let glideApiErrors = [];

    try {
      glideLocations = await glide.getLocations();
    } catch (e) {
      glideApiErrors.push({ source: 'locations', error: e.message });
    }

    try {
      glideVendors = await glide.getVendors();
    } catch (e) {
      glideApiErrors.push({ source: 'vendors', error: e.message });
    }

    if (glideApiErrors.length > 0) {
      results.warnings = results.warnings || [];
      results.warnings.push(...glideApiErrors.map(e =>
        `Glide API error (${e.source}): ${e.error} - matching will use empty list`
      ));
    }

    // 3. Parse ledger files
    if (input.ledgerFiles && input.ledgerFiles.length > 0) {
      results.ledgers = parseLedgerFiles(input.ledgerFiles);

      if (!results.ledgers || !results.ledgers.ledgers) {
        throw new Error('Failed to parse ledger files - no valid data returned');
      }

      // 3b. Multi-pass location inference
      // Pass 1: Date-based inference (episode dates -> global dates -> episode primary)
      const dateInferenceResult = runLocationInference(results.ledgers);
      results.dateInference = dateInferenceResult.stats;

      // Pass 2: Vendor-based inference for remaining unmatched
      const { vendorMap, stats: vendorMapStats } = buildVendorLocationMap(results.ledgers);
      const vendorInferenceStats = inferLocationsFromVendor(results.ledgers, vendorMap);
      results.vendorInference = { mapStats: vendorMapStats, inferenceStats: vendorInferenceStats };

      // Pass 3: Categorize remaining unmatched as Production Overhead
      const overheadStats = categorizeProductionOverhead(results.ledgers);
      results.productionOverhead = overheadStats;

      // Apply all inferred locations to transactions
      for (const ledger of results.ledgers.ledgers || []) {
        for (const txn of ledger.transactions || []) {
          if (txn.inferredLocation && !txn.location) {
            txn.location = txn.inferredLocation;
            txn.locationSource = 'inferred';
          } else if (txn.location) {
            txn.locationSource = 'explicit';
          }
        }
      }

      // 4. Match locations
      results.locations = matchLocations(
        results.ledgers,
        glideLocations,
        input.locationMappings || {}
      );

      // 5. Extract and match vendors
      const ledgerVendors = extractVendors(results.ledgers);
      results.vendors = matchVendors(ledgerVendors, glideVendors);

      // 6. Generate review items
      const locationReview = generateLocationReview(results.locations);
      const vendorReview = generateVendorReview(results.vendors);
      results.reviewItems = [...locationReview, ...vendorReview];
    }

    // 7. Parse SmartPO file (if provided)
    if (input.smartpoFile) {
      results.smartpo = parseSmartPO(
        input.smartpoFile.buffer,
        input.smartpoFile.filename
      );
    }

    // 8. Calculate summary with detailed inference breakdown
    const locationReviewTypes = ['needs_mapping', 'needs_new_entry'];
    const vendorReviewTypes = ['low_confidence', 'new_vendor'];

    const dateStats = results.dateInference || {};
    const vendorStats = results.vendorInference?.inferenceStats || {};
    const overheadStats = results.productionOverhead || {};

    results.summary = {
      ledgerFiles: results.ledgers?.totalFiles || 0,
      transactions: results.ledgers?.ledgers?.reduce((sum, l) => sum + l.transactionCount, 0) || 0,

      locationsExplicit: dateStats.alreadyHadLocation || 0,
      locationsInferredFromDates: (dateStats.inferredFromEpisodeDates || 0) + (dateStats.inferredFromGlobalDates || 0),
      locationsInferredFromVendor: (vendorStats.inferredHigh || 0) + (vendorStats.inferredMedium || 0) + (vendorStats.inferredLow || 0),
      locationsInferredFromEpisodePrimary: dateStats.inferredFromEpisodePrimary || 0,

      productionOverheadPayroll: overheadStats.payroll || 0,
      productionOverheadPayrollAmount: overheadStats.payrollAmount || 0,
      productionOverheadOther: overheadStats.overhead || 0,
      productionOverheadOtherAmount: overheadStats.overheadAmount || 0,

      stillUnmatched: overheadStats.stillUnmatched || 0,
      stillUnmatchedAmount: overheadStats.unmatchedAmount || 0,

      locationsMatched: results.locations?.stats?.matchedCount || 0,
      locationsNeedReview: results.reviewItems.filter(r => locationReviewTypes.includes(r.type)).length,
      vendorsMatched: results.vendors?.matched?.length || 0,
      vendorsNeedReview: results.reviewItems.filter(r => vendorReviewTypes.includes(r.type)).length,
      purchaseOrders: results.smartpo?.totalPOs || 0,
      totalPOAmount: results.smartpo?.totalAmount || 0
    };

    // 9. If auto-import enabled and no review items, import directly
    if (input.options?.autoImport && results.reviewItems.length === 0) {
      await performImport(glide, results);
      results.imported = true;
    }

  } catch (error) {
    results.success = false;
    results.error = error.message;
  }

  return results;
}

/**
 * Import approved data to Glide
 */
async function performImport(glide, results) {
  const importResults = {
    locations: { added: 0, errors: [] },
    vendors: { added: 0, errors: [] },
    actuals: { updated: 0, errors: [] }
  };

  // Import new locations
  if (results.locations?.needsGlideEntry) {
    for (const loc of results.locations.needsGlideEntry) {
      try {
        await glide.addLocation({
          name: loc.proposedName,
          episode: loc.episodes?.[0] || '',
          category: loc.category || 'TBD'
        });
        importResults.locations.added++;
      } catch (e) {
        importResults.locations.errors.push({ location: loc.proposedName, error: e.message });
      }
    }
  }

  // Import new vendors
  if (results.vendors?.newVendors) {
    for (const vendor of results.vendors.newVendors) {
      try {
        await glide.addVendor({
          name: vendor.ledgerName,
          category: vendor.suggestedCategory
        });
        importResults.vendors.added++;
      } catch (e) {
        importResults.vendors.errors.push({ vendor: vendor.ledgerName, error: e.message });
      }
    }
  }

  return importResults;
}

/**
 * Handle approved review items from Kirsten
 *
 * @param {Object} input - Input from Make.com
 * @param {Array} input.approvedItems - Review items with Kirsten's decisions
 * @returns {Object} Import results
 */
export async function handleApproval(input) {
  const glide = createGlideClient();
  const results = {
    success: true,
    timestamp: new Date().toISOString(),
    imported: {
      locations: 0,
      vendors: 0
    },
    errors: []
  };

  for (const item of input.approvedItems || []) {
    try {
      if (item.type === 'needs_mapping' && item.action === 'create_new') {
        // Create new location in Glide
        await glide.addLocation({
          name: item.ledgerLocation,
          episode: item.episodes?.[0] || '',
          category: 'Exterior'
        });
        results.imported.locations++;
      } else if (item.type === 'needs_new_entry' && item.approved) {
        // Create new location in Glide
        await glide.addLocation({
          name: item.proposedName,
          episode: item.episodes?.[0] || '',
          category: 'TBD'
        });
        results.imported.locations++;
      } else if (item.type === 'new_vendor' && item.approved) {
        // Create new vendor in Glide
        await glide.addVendor({
          name: item.ledgerName,
          category: item.suggestedCategory
        });
        results.imported.vendors++;
      }
    } catch (error) {
      results.errors.push({
        item: item.ledgerLocation || item.ledgerName,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Get current unmapped locations
 *
 * @returns {Object} Unmapped locations and Glide locations for resolution UI
 */
export async function handleGetUnmapped() {
  return {
    unmapped: [],
    glideLocations: [],
    timestamp: new Date().toISOString()
  };
}

/**
 * Process user's resolution decision for an unmapped location
 *
 * @param {Object} input - Resolution input
 * @param {string} input.ledgerLocation - The original ledger location name
 * @param {string} input.action - One of: 'create_new', 'map_to_existing', 'service_charge'
 * @param {string} input.targetLocation - For 'map_to_existing', the Glide location to map to
 * @param {Object} input.newLocationData - For 'create_new', the new location data
 * @returns {Object} Resolution result
 */
export async function handleResolveLocation(input) {
  const glide = createGlideClient();
  const { ledgerLocation, action, targetLocation, newLocationData } = input;

  const result = {
    success: true,
    action,
    ledgerLocation,
    timestamp: new Date().toISOString()
  };

  try {
    switch (action) {
      case 'create_new':
        await glide.addLocation({
          name: newLocationData?.name || ledgerLocation,
          address: newLocationData?.address,
          city: newLocationData?.city,
          state: newLocationData?.state,
          status: 'Active'
        });
        result.message = `Created new location: ${newLocationData?.name || ledgerLocation}`;
        break;

      case 'map_to_existing':
        result.mappedTo = targetLocation;
        result.message = `Mapped "${ledgerLocation}" to "${targetLocation}"`;
        break;

      case 'service_charge':
        result.message = `Marked "${ledgerLocation}" as service charge`;
        break;

      default:
        result.success = false;
        result.error = `Unknown action: ${action}`;
    }
  } catch (error) {
    result.success = false;
    result.error = error.message;
  }

  return result;
}

export default {
  handleSync,
  handleApproval,
  handleGetUnmapped,
  handleResolveLocation
};
