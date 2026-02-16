import { handleSync, handleApproval } from '../src/api/sync.js';
import { downloadFile } from '../src/utils/downloadFile.js';
import { writeJsonToS3, readJsonFromS3 } from '../src/utils/s3Utils.js';
import { writeProcessedLedger } from '../src/utils/writeProcessedData.js';
import { parseFilename, generateHash } from '../src/utils/fileUtils.js';
import { categorizeTransaction } from '../src/parsers/ledger.js';
import { createGlideClient } from '../src/glide/client.js';
import { transformBudgetData } from '../src/parsers/budget.js';
import { generateFileHash, checkFileProcessed, markFileProcessed, classifyFileType } from '../src/utils/fileDeduplication.js';
import { parseMultipart, extractBoundary } from '../src/utils/parseMultipart.js';
import { getAuth, scanAndDownloadNewFiles, moveFile } from '../src/utils/googleDrive.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand, PutCommand, DeleteCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({ region: 'us-west-2' });
const ddb = DynamoDBDocumentClient.from(ddbClient);
const BUDGETS_TABLE = 'shards-budgets';

const ALL_CATEGORIES = [
  'Loc Fees', 'Addl. Site Fees', 'Site Personnel', 'Permits',
  'Addl. Labor', 'Equipment', 'Parking', 'Fire', 'Police', 'Security'
];

/**
 * Reads budget data from DynamoDB and transforms it into the same structure
 * as transformBudgetData() from Glide.
 * Returns: { byLocationEpisode, byEpisodeCategory, byCategoryLocationEpisode, episodeTotals, metadata }
 */
async function transformDynamoDBBudgetData() {
  console.log('[Budget/DynamoDB] Fetching budgets from DynamoDB...');

  // Scan all items from DynamoDB (budgets, locations, line items)
  const scanResult = await ddb.send(new ScanCommand({ TableName: BUDGETS_TABLE }));
  const items = scanResult.Items || [];

  // Separate by type based on SK pattern
  const budgetMeta = items.filter(i => i.SK === 'META');
  const locations = items.filter(i => i.SK && i.SK.startsWith('LOC#'));
  const lineItems = items.filter(i => i.SK && i.SK.startsWith('LI#'));

  console.log(`[Budget/DynamoDB] Found ${budgetMeta.length} budgets, ${locations.length} locations, ${lineItems.length} line items`);

  // Build episode lookup from budget metadata
  const episodeLookup = new Map(); // budgetId -> episode name
  for (const budget of budgetMeta) {
    if (budget.PK && budget.episode) {
      // Normalize episode: "Episode 101" → "101"
      const episode = String(budget.episode).replace(/^Episode\s+/i, '');
      episodeLookup.set(budget.PK, episode);
    }
  }

  // Aggregate line items by location+episode and episode+category
  const locEpMap = new Map(); // "location|episode" -> { location, episode, totalBudget }
  const epCatMap = new Map(); // "episode|category" -> { episode, category, totalBudget }
  const catLocEpMap = new Map(); // "category|location|episode" -> { category, location, episode, totalBudget }

  let skippedCount = 0;

  for (const li of lineItems) {
    const amount = parseFloat(li.subtotal) || 0;
    if (amount === 0) {
      skippedCount++;
      continue;
    }

    // Extract location from SK: "LI#LocationName#lineItemId"
    const skParts = (li.SK || '').split('#');
    const locationName = skParts[1] || 'Unknown';

    // Get episode from budget PK
    const episode = episodeLookup.get(li.PK) || 'all';

    // Normalize category (handle variations in category names)
    const CATEGORY_NORMALIZE = {
      'location fees': 'Loc Fees',
      'loc fees': 'Loc Fees',
      'site fees': 'Loc Fees',
      'addl. site fees': 'Addl. Site Fees',
      'site personnel': 'Site Personnel',
      'addl. labor': 'Addl. Labor',
      'equipment': 'Equipment',
      'security': 'Security',
      'police': 'Police',
      'fire': 'Fire',
      'permits': 'Permits',
      'parking': 'Parking'
    };
    const rawCategory = li.category || 'Other';
    const category = CATEGORY_NORMALIZE[rawCategory.toLowerCase().trim()] || rawCategory;

    // Aggregate by location+episode
    const locEpKey = `${locationName}|${episode}`;
    if (!locEpMap.has(locEpKey)) {
      locEpMap.set(locEpKey, { location: locationName, episode, totalBudget: 0 });
    }
    locEpMap.get(locEpKey).totalBudget += amount;

    // Aggregate by episode+category
    const epCatKey = `${episode}|${category}`;
    if (!epCatMap.has(epCatKey)) {
      epCatMap.set(epCatKey, { episode, category, totalBudget: 0 });
    }
    epCatMap.get(epCatKey).totalBudget += amount;

    // Aggregate by category+location+episode
    const catLocEpKey = `${category}|${locationName}|${episode}`;
    if (!catLocEpMap.has(catLocEpKey)) {
      catLocEpMap.set(catLocEpKey, { category, location: locationName, episode, totalBudget: 0 });
    }
    catLocEpMap.get(catLocEpKey).totalBudget += amount;
  }

  const byLocationEpisode = Array.from(locEpMap.values());
  const byEpisodeCategory = Array.from(epCatMap.values());
  const byCategoryLocationEpisode = Array.from(catLocEpMap.values());

  // Calculate episode totals
  const episodeTotals = {};
  for (const item of byLocationEpisode) {
    if (!episodeTotals[item.episode]) episodeTotals[item.episode] = 0;
    episodeTotals[item.episode] += item.totalBudget;
  }

  console.log(`[Budget/DynamoDB] Transformed: ${byLocationEpisode.length} location-episodes, ${byEpisodeCategory.length} episode-categories, ${Object.keys(episodeTotals).length} episode groups`);
  console.log(`[Budget/DynamoDB] Skipped ${skippedCount} zero-amount line items`);

  return {
    byLocationEpisode,
    byEpisodeCategory,
    byCategoryLocationEpisode,
    episodeTotals,
    metadata: {
      budgetCount: budgetMeta.length,
      locationCount: locations.length,
      lineItemCount: lineItems.length,
      lineItemsWithRate: lineItems.length - skippedCount,
      generatedAt: new Date().toISOString(),
      source: 'DynamoDB'
    }
  };
}

function generateComparison(budgets, ledgers) {
  const comparison = {};

  // Find active episodes from ledger transactions
  const activeEps = new Set();
  for (const ledger of ledgers.ledgers || []) {
    for (const txn of ledger.transactions || []) {
      const ep = txn.episode || ledger.episode;
      if (ep && ep !== 'unknown') activeEps.add(ep);
    }
  }

  for (const item of budgets.byEpisodeCategory || []) {
    if (!ALL_CATEGORIES.includes(item.category)) continue;
    if (item.episode === 'all' && activeEps.size > 0) {
      const perEp = item.totalBudget / activeEps.size;
      for (const ep of activeEps) {
        const key = `${ep}|${item.category}`;
        if (!comparison[key]) {
          comparison[key] = { episode: ep, category: item.category, budget: 0, actual: 0, isGlCategory: true };
        }
        comparison[key].budget += perEp;
      }
    } else {
      const key = `${item.episode}|${item.category}`;
      if (!comparison[key]) {
        comparison[key] = { episode: item.episode, category: item.category, budget: 0, actual: 0, isGlCategory: true };
      }
      comparison[key].budget += item.totalBudget;
    }
  }

  for (const ledger of ledgers.ledgers || []) {
    for (const txn of ledger.transactions || []) {
      const glAccount = txn.glCode || txn.transNumber?.substring(0, 4);
      if (!glAccount) continue;

      const category = categorizeTransaction(glAccount, txn.transType, txn.description);
      if (category === 'Other') continue;

      const episode = txn.episode || ledger.episode;
      if (!episode || episode === 'unknown') continue;
      const key = `${episode}|${category}`;
      if (!comparison[key]) {
        comparison[key] = { episode, category, budget: 0, actual: 0, isGlCategory: true, glAccount };
      }
      comparison[key].actual += txn.amount || 0;
      comparison[key].glAccount = glAccount;
    }
  }

  const result = Object.values(comparison).map(item => ({
    ...item,
    variance: item.budget - item.actual,
    variancePercent: item.budget > 0 ? ((item.budget - item.actual) / item.budget) * 100 : (item.actual > 0 ? -100 : 0)
  })).sort((a, b) => a.episode.localeCompare(b.episode) || a.category.localeCompare(b.category));

  const grandTotals = result.reduce((acc, i) => {
    acc.budget += i.budget;
    acc.actual += i.actual;
    return acc;
  }, { budget: 0, actual: 0 });
  grandTotals.variance = grandTotals.budget - grandTotals.actual;

  return {
    generatedAt: new Date().toISOString(),
    budgetSource: 'Glide Budget Line Items',
    actualsSource: 'GL Ledger Excel files',
    comparison: result,
    grandTotals
  };
}

// Simple string similarity for budget matching (Dice coefficient)
function stringSimilarity(s1, s2) {
  s1 = s1.toLowerCase().replace(/[^a-z0-9]/g, '');
  s2 = s2.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;

  const bigrams1 = new Map();
  for (let i = 0; i < s1.length - 1; i++) {
    const bigram = s1.substring(i, i + 2);
    bigrams1.set(bigram, (bigrams1.get(bigram) || 0) + 1);
  }

  let intersectionSize = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bigram = s2.substring(i, i + 2);
    const count = bigrams1.get(bigram) || 0;
    if (count > 0) {
      bigrams1.set(bigram, count - 1);
      intersectionSize++;
    }
  }

  return (2 * intersectionSize) / (s1.length + s2.length - 2);
}

// Build dynamic alias lookup from location-mappings.json
// Maps: alias/ledgerLocation (lowercase) → budgetLocation
function buildAliasLookup(mappings) {
  const lookup = new Map();
  const serviceChargePatterns = [];
  const pendingLocations = new Map();

  for (const m of mappings || []) {
    const ledgerLoc = (m.ledgerLocation || '').toLowerCase().trim();
    const budgetLoc = m.budgetLocation || '';

    if (budgetLoc === 'SERVICE_CHARGE') {
      serviceChargePatterns.push(ledgerLoc);
      for (const alias of m.aliases || []) {
        serviceChargePatterns.push(alias.toLowerCase().trim());
      }
    } else if (budgetLoc.startsWith('PENDING:')) {
      const pendingName = budgetLoc.replace('PENDING:', '');
      pendingLocations.set(ledgerLoc, pendingName);
      for (const alias of m.aliases || []) {
        pendingLocations.set(alias.toLowerCase().trim(), pendingName);
      }
    } else {
      lookup.set(ledgerLoc, budgetLoc);
      for (const alias of m.aliases || []) {
        lookup.set(alias.toLowerCase().trim(), budgetLoc);
      }
    }
  }

  return { lookup, serviceChargePatterns, pendingLocations };
}

// Fallback hardcoded aliases for basic typo correction
const LOCATION_ALIASES = {
  'kellner': 'keller',
  'kellners': 'keller',
  'kellenrs': 'keller',
  'matt kellner': 'keller',
  'brets': 'bret',
  'bretts': 'bret',
  'brett': 'bret',
  'melrose bar': 'melrose video bar',
  'melrose ave': 'melrose video bar',
  'melrose asylum': 'melrose video bar',
  'melrose/asylum': 'melrose video bar',
};

// Extract first meaningful word from location name
function getFirstWord(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim().split(/\s+/)[0] || '';
}

// Apply aliases to normalize location name
function applyAliases(name) {
  let normalized = name.toLowerCase();
  for (const [alias, canonical] of Object.entries(LOCATION_ALIASES)) {
    if (normalized.includes(alias)) {
      normalized = normalized.replace(alias, canonical);
    }
  }
  return normalized;
}

// Extract location keyword from description for matching
// Handles patterns like "FINAL LOC FEE:MELROSE BAR (102)" → "MELROSE BAR"
// Also handles "PERMITS:MELROSE AVE:FIRE" → "MELROSE AVE" (skips GL category suffixes)
const GL_CATEGORY_NAMES = /^(FIRE|POLICE|SECURITY|PERMITS?|PARKING|EQUIPMENT)$/i;
function extractDescriptionKeyword(description) {
  if (!description) return null;

  const segments = description.split(':').map(s => s.trim());
  if (segments.length >= 3) {
    const last = segments[segments.length - 1].replace(/\s*\(\d+\)\s*$/, '').trim();
    if (GL_CATEGORY_NAMES.test(last)) {
      const middle = segments[segments.length - 2].replace(/\s*\(\d+\)\s*$/, '').trim();
      if (middle.length > 3
          && !/^(FINAL|ADD'?L|SITE REP|IN HOUSE|NO WEEKENDS)$/i.test(middle)
          && !/^(REGULAR|OVERTIME|OT|DOUBLE\s*TIME|GOLDEN\s*TIME|MEAL\s*PENALTY|FLSAOT)\s*/i.test(middle)
          && !/^\d+(\.\d+)?X$/i.test(middle)
          && !/\b(ALLOWANCE|RENTAL|MILEAGE|PER\s*DIEM|WORKED)\b/i.test(middle)) {
        return middle;
      }
    }
  }

  // Fallback: last segment after colon, before optional episode suffix
  // "10/22-10/29 FINAL LOC FEE:MELROSE BAR (102)" → "MELROSE BAR"
  const colonMatch = description.match(/:([^:]+?)(?:\s*\(\d+\))?$/);
  if (colonMatch) {
    const extracted = colonMatch[1].trim();
    // Filter out non-location fragments and pay types
    if (extracted.length > 3
        && !/^(FINAL|ADD'?L|SITE REP|IN HOUSE|NO WEEKENDS)$/i.test(extracted)
        && !/^(REGULAR|OVERTIME|OT|DOUBLE\s*TIME|GOLDEN\s*TIME|MEAL\s*PENALTY|FLSAOT)\s*/i.test(extracted)
        && !/^\d+(\.\d+)?X$/i.test(extracted)
        && !/\b(ALLOWANCE|RENTAL|MILEAGE|PER\s*DIEM|WORKED)\b/i.test(extracted)) {
      return extracted;
    }
  }

  return null;
}

// Find best budget match for an actual location name
// txnContext is optional - if provided, will also try matching from description
// aliasLookup is optional - mapping from alias/ledgerLocation → budgetLocation
function findBestBudgetMatch(actualName, budgetByLocation, threshold = 0.5, txnContext = null, aliasLookup = null) {
  const actualKey = actualName.toLowerCase().trim();
  const actualKeyAliased = applyAliases(actualKey);

  // PRIORITY 1: Try S3 alias lookup first (most authoritative)
  if (aliasLookup?.lookup) {
    const mappedBudget = aliasLookup.lookup.get(actualKey);
    if (mappedBudget) {
      const mappedKey = mappedBudget.toLowerCase().trim();
      if (budgetByLocation.has(mappedKey)) {
        return { budget: budgetByLocation.get(mappedKey), confidence: 0.98, matchType: 's3-mapping' };
      }
      // Budget location from mapping might have slight variations - try fuzzy within budgets
      for (const [budgetKey, budget] of budgetByLocation) {
        if (stringSimilarity(mappedKey, budgetKey) > 0.8) {
          return { budget, confidence: 0.95, matchType: 's3-mapping-fuzzy' };
        }
      }
    }
  }

  // Try exact match first (with alias normalization)
  if (budgetByLocation.has(actualKey)) {
    return { budget: budgetByLocation.get(actualKey), confidence: 1, matchType: 'exact' };
  }

  // Try exact match with aliased name
  for (const [budgetKey, budget] of budgetByLocation) {
    const budgetKeyAliased = applyAliases(budgetKey);
    if (actualKeyAliased === budgetKeyAliased) {
      return { budget, confidence: 0.95, matchType: 'alias' };
    }
  }

  // Try substring match (actual contained in budget or vice versa)
  for (const [budgetKey, budget] of budgetByLocation) {
    if (budgetKey.includes(actualKey) || actualKey.includes(budgetKey)) {
      return { budget, confidence: 0.9, matchType: 'substring' };
    }
  }

  // Try word-based match: first meaningful word matches
  const actualWord = getFirstWord(actualKey);
  if (actualWord.length >= 4) {
    for (const [budgetKey, budget] of budgetByLocation) {
      const budgetWord = getFirstWord(budgetKey);
      if (actualWord === budgetWord) {
        return { budget, confidence: 0.85, matchType: 'word' };
      }
      // Also check if first word is contained (handles "BUCKLEY H.S." vs "Buckley - Gymnasium")
      if (budgetWord.includes(actualWord) || actualWord.includes(budgetWord)) {
        return { budget, confidence: 0.8, matchType: 'word-partial' };
      }
    }
  }

  // Try aliased word match
  const actualWordAliased = getFirstWord(actualKeyAliased);
  if (actualWordAliased.length >= 4 && actualWordAliased !== actualWord) {
    for (const [budgetKey, budget] of budgetByLocation) {
      const budgetWord = getFirstWord(applyAliases(budgetKey));
      if (actualWordAliased === budgetWord) {
        return { budget, confidence: 0.8, matchType: 'alias-word' };
      }
    }
  }

  // Try key-word search: if the actual location's key word appears anywhere in budget name
  // This handles "KELLNER'S HOUSE" matching "Matt's Pool House/Keller Residence"
  const keyWords = ['keller', 'kellner', 'buckley', 'latchford', 'galleria', 'hancock', 'melrose', 'brentwood', 'susan', 'village', 'theater', 'debbie'];
  for (const keyword of keyWords) {
    if (actualKeyAliased.includes(keyword)) {
      for (const [budgetKey, budget] of budgetByLocation) {
        const budgetKeyAliased = applyAliases(budgetKey);
        if (budgetKeyAliased.includes(keyword)) {
          return { budget, confidence: 0.75, matchType: 'keyword' };
        }
      }
    }
  }

  // Try description keyword extraction (for cases like "FINAL LOC FEE:MELROSE BAR")
  if (txnContext?.description) {
    const descKeyword = extractDescriptionKeyword(txnContext.description);
    if (descKeyword) {
      const descKeywordAliased = applyAliases(descKeyword.toLowerCase());
      for (const [budgetKey, budget] of budgetByLocation) {
        const budgetKeyAliased = applyAliases(budgetKey);
        // Check if description keyword matches budget name
        if (budgetKeyAliased.includes(descKeywordAliased) ||
            descKeywordAliased.includes(budgetKeyAliased.split(' ')[0])) {
          return { budget, confidence: 0.82, matchType: 'description-keyword' };
        }
        // Check first word match
        const descWord = getFirstWord(descKeywordAliased);
        const budgetWord = getFirstWord(budgetKeyAliased);
        if (descWord.length >= 4 && descWord === budgetWord) {
          return { budget, confidence: 0.78, matchType: 'description-word' };
        }
      }
    }
  }

  // Fuzzy match
  let bestMatch = null;
  let bestScore = threshold;

  for (const [budgetKey, budget] of budgetByLocation) {
    const score = stringSimilarity(actualKey, budgetKey);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { budget, confidence: score, matchType: 'fuzzy' };
    }
  }

  return bestMatch;
}

function generateLocationComparison(budgets, ledgers, locationMappings = null, smartpo = null) {
  // Build alias lookup from S3 mappings
  const aliasData = buildAliasLookup(locationMappings?.mappings);
  const { lookup: aliasLookup, serviceChargePatterns, pendingLocations } = aliasData;
  console.log(`[Handler] Loaded ${aliasLookup.size} aliases, ${serviceChargePatterns.length} service patterns, ${pendingLocations.size} pending locations`);
  console.log(`[Handler] SmartPO data: ${smartpo?.totalPOs || 0} POs, $${(smartpo?.totalAmount || 0).toFixed(2)} total`);

  // isServiceCharge removed — was incorrectly filtering $930K+ of valid GL transactions
  // including false positives where "parking" pattern matched real locations like
  // "Buckley Courtyard / Parking Lot" and "3rd Floor Parking Garage"
  // Build budget lookup by location name (case-insensitive)
  const budgetByLocation = new Map();
  for (const item of budgets.byLocationEpisode || []) {
    const key = (item.location || '').toLowerCase().trim();
    if (!key) continue;
    if (!budgetByLocation.has(key)) {
      budgetByLocation.set(key, { locationName: item.location, totalBudget: 0, episodes: [] });
    }
    const loc = budgetByLocation.get(key);
    loc.totalBudget += item.totalBudget || 0;
    loc.episodes.push(item.episode);
  }

  // Generic location names that should trigger description extraction
  const GENERIC_LOCATIONS = new Set([
    'final', 'add\'l', 'addl', 'site rep', 'in house', 'no weekends',
    'guards', 'service', 'cleaning', 'service fee', 'permits'
  ]);

  // Check if location name is too generic to be useful
  function isGenericLocation(name) {
    if (!name) return true;
    const normalized = name.toLowerCase().trim();
    return normalized.length <= 3 || GENERIC_LOCATIONS.has(normalized);
  }

  // Group transactions by matchedLocation
  // Track service charges separately; collect no-location transactions for episode totals
  const actualsByLocation = new Map();
  const noLocationTransactions = []; // Transactions with no location (e.g. EP payroll)
  let descriptionOverrides = 0;

  // Build date-to-location map from transactions that have locations
  // Used to infer locations for payroll transactions by matching dates
  const dateLocationMap = {};
  for (const ledger of ledgers.ledgers || []) {
    for (const tx of ledger.transactions || []) {
      if (!tx.location && !tx.matchedLocation) continue;
      const loc = tx.matchedLocation || tx.location;
      if (!loc || isGenericLocation(loc)) continue;
      const ep = tx.episode || ledger.episode || 'unknown';
      if (!tx.dateRange) continue;
      const dateKey = tx.dateRange.startDate;
      if (!dateKey) continue;
      const mapKey = `${ep}|${dateKey}`;
      if (!dateLocationMap[mapKey]) dateLocationMap[mapKey] = {};
      dateLocationMap[mapKey][loc] = (dateLocationMap[mapKey][loc] || 0) + Math.abs(tx.amount || 1);
    }
  }
  // Find most common location per episode+date
  const bestLocationByDate = {};
  for (const [key, locs] of Object.entries(dateLocationMap)) {
    let best = null, bestAmt = 0;
    for (const [loc, amt] of Object.entries(locs)) {
      if (amt > bestAmt) { best = loc; bestAmt = amt; }
    }
    if (best) bestLocationByDate[key] = best;
  }

  // Find primary location per episode (highest total spend)
  const episodeLocationSpend = {};
  for (const ledger of ledgers.ledgers || []) {
    for (const tx of ledger.transactions || []) {
      const loc = tx.matchedLocation || tx.location;
      if (!loc || isGenericLocation(loc)) continue;
      const ep = tx.episode || ledger.episode || 'unknown';
      if (!episodeLocationSpend[ep]) episodeLocationSpend[ep] = {};
      episodeLocationSpend[ep][loc] = (episodeLocationSpend[ep][loc] || 0) + Math.abs(tx.amount || 0);
    }
  }
  const episodePrimaryLocation = {};
  for (const [ep, locs] of Object.entries(episodeLocationSpend)) {
    let best = null, bestAmt = 0;
    for (const [loc, amt] of Object.entries(locs)) {
      if (amt > bestAmt) { best = loc; bestAmt = amt; }
    }
    if (best) episodePrimaryLocation[ep] = best;
  }

  for (const ledger of ledgers.ledgers || []) {
    for (const tx of ledger.transactions || []) {
      // Recovery: undo incorrect overhead tagging on location-related payroll
      // GL 6304/6305/6307/6342 are ALL location spend even when from EP payroll
      const txGl = tx.glCode || (tx.transNumber || '').substring(0, 4);
      if (['6304', '6305', '6307', '6342'].includes(txGl) && tx.overheadType === 'payroll') {
        tx.overheadType = null;
        tx.category = tx.category === 'production_overhead' ? 'Unknown' : tx.category;
        // Try to recover location from date matching
        if (!tx.location && !tx.matchedLocation && tx.dateRange?.startDate) {
          const ep = tx.episode || ledger.episode || 'unknown';
          const dateKey = `${ep}|${tx.dateRange.startDate}`;
          if (bestLocationByDate[dateKey]) {
            tx.location = bestLocationByDate[dateKey];
            tx.locationSource = 'date-recovery';
          } else if (episodePrimaryLocation[ep]) {
            tx.location = episodePrimaryLocation[ep];
            tx.locationSource = 'episode-primary-recovery';
          }
        }
      }

      let locName = tx.matchedLocation || tx.location;

      // Strip PENDING: prefix — these are recognized but not yet in Glide budgets
      // Use the clean name so pendingLocations lookup works correctly
      if (locName && locName.startsWith('PENDING:')) {
        locName = locName.substring(8);
      }

      // If location is generic, try to extract better name from description
      if (isGenericLocation(locName) && tx.description) {
        const descKeyword = extractDescriptionKeyword(tx.description);
        if (descKeyword && !isGenericLocation(descKeyword)) {
          locName = descKeyword;
          descriptionOverrides++;
        }
      }

      if (!locName) {
        // No location — still track for episode-level category totals
        noLocationTransactions.push({
          txId: tx.txId,
          vendor: tx.vendor,
          amount: tx.amount,
          description: tx.description,
          category: tx.category,
          episode: tx.episode,
          transNumber: tx.transNumber,
          transType: tx.transType,
          glCode: tx.glCode,
          glAccount: tx.glCode || tx.transNumber?.substring(0, 4),
          _override: tx._override || null
        });
        continue;
      }

      // Service charges are NOT filtered — they're real GL expenditures
      // that belong in episode actuals. Transactions with generic service names
      // (GUARDS, PERMITS, etc.) will land in unmappedLocations via normal matching.
      // Previously this filter dropped 126+ txns worth $930K+ including false positives
      // like "Buckley Courtyard / Parking Lot" matching the "parking" pattern.

      const key = locName.toLowerCase().trim();
      if (!actualsByLocation.has(key)) {
        actualsByLocation.set(key, { locationName: locName, totalAmount: 0, transactions: [] });
      }
      const loc = actualsByLocation.get(key);
      loc.totalAmount += tx.amount || 0;
      loc.transactions.push({
        txId: tx.txId,
        vendor: tx.vendor,
        amount: tx.amount,
        extractedLocation: tx.location,
        matchedToBudget: tx.matchedLocation,
        description: tx.description,
        category: tx.category,
        episode: tx.episode,
        transType: tx.transType,
        transNumber: tx.transNumber,
        glCode: tx.glCode,
        glAccount: tx.glCode || tx.transNumber?.substring(0, 4),
        effectiveDate: tx.reportDate,
        poNumber: tx.transNumber,
        documentNumber: tx.transNumber,
        _override: tx._override || null
      });
    }
  }
  console.log(`[Handler] Description keyword overrides: ${descriptionOverrides}`);

  // Classify into budgeted vs unmapped
  // Aggregate actuals by matched budget location
  const budgetedMap = new Map(); // budgetKey -> aggregated data
  const unmappedLocations = [];

  // Process locations with actuals - use fuzzy matching to find budget
  for (const [key, actuals] of actualsByLocation) {
    // Pass first transaction as context for description-based matching
    const txnContext = actuals.transactions[0] || null;
    const match = findBestBudgetMatch(actuals.locationName, budgetByLocation, 0.5, txnContext, aliasData);

    if (match) {
      const budget = match.budget;
      const budgetKey = budget.locationName.toLowerCase().trim();

      if (!budgetedMap.has(budgetKey)) {
        budgetedMap.set(budgetKey, {
          locationName: budget.locationName,
          matchedNames: [],
          budgetAmount: budget.totalBudget,
          actualAmount: 0,
          transactions: [],
          matchTypes: new Set()
        });
      }

      const entry = budgetedMap.get(budgetKey);
      entry.matchedNames.push(actuals.locationName);
      entry.actualAmount += actuals.totalAmount;
      entry.transactions.push(...actuals.transactions);
      entry.matchTypes.add(match.matchType);
    } else {
      // Check if this is a known SERVICE_CHARGE (production overhead)
      const isServiceCharge = serviceChargePatterns.includes(key);
      // Check if this is a PENDING location (known but not yet in Glide)
      const pendingName = pendingLocations.get(key);
      if (isServiceCharge) {
        unmappedLocations.push({
          locationName: actuals.locationName,
          totalAmount: actuals.totalAmount,
          transactions: actuals.transactions.map(tx => ({ ...tx, reason: 'service_charge' })),
          reason: 'service_charge',
          reasonLabel: 'Production overhead (no budget location)'
        });
      } else if (pendingName) {
        unmappedLocations.push({
          locationName: actuals.locationName,
          totalAmount: actuals.totalAmount,
          transactions: actuals.transactions.map(tx => ({ ...tx, reason: 'pending_location' })),
          reason: 'pending_location',
          reasonLabel: `Pending: ${pendingName}`,
          pendingName: pendingName
        });
      } else {
        unmappedLocations.push({
          locationName: actuals.locationName,
          totalAmount: actuals.totalAmount,
          transactions: actuals.transactions.map(tx => ({ ...tx, reason: 'no_budget_match' })),
          reason: 'no_budget_match',
          reasonLabel: 'No budget entry found'
        });
      }
    }
  }

  // Convert budgetedMap to array and add budget-only locations
  const budgetedLocations = [];
  const processedBudgetKeys = new Set(budgetedMap.keys());

  // Calculate category breakdown from transactions using categorizeTransaction()
  function calculateCategoryBreakdown(transactions) {
    const breakdown = {};
    for (const cat of ALL_CATEGORIES) breakdown[cat] = 0;

    for (const tx of transactions || []) {
      const glAccount = tx.glCode || (tx.glAccount || tx.transNumber || '').substring(0, 4);
      const category = categorizeTransaction(glAccount, tx.transType, tx.description);
      if (breakdown.hasOwnProperty(category)) {
        breakdown[category] += (tx.amount || 0);
      } else {
        breakdown[category] = (tx.amount || 0);
      }
    }

    return breakdown;
  }

  for (const [key, entry] of budgetedMap) {
    const variance = entry.budgetAmount - entry.actualAmount;
    const categoryBreakdown = calculateCategoryBreakdown(entry.transactions);

    budgetedLocations.push({
      locationName: entry.locationName,
      matchedNames: entry.matchedNames,
      budgetAmount: entry.budgetAmount,
      actualAmount: entry.actualAmount,
      variance,
      variancePercent: entry.budgetAmount > 0 ? (variance / entry.budgetAmount) * 100 : -100,
      isOverBudget: entry.actualAmount > entry.budgetAmount,
      hasActuals: true,
      transactionCount: entry.transactions.length,
      matchTypes: Array.from(entry.matchTypes),
      transactions: entry.transactions,
      // Category breakdown matching Kirsten's spreadsheet
      byCategory: categoryBreakdown
    });
  }

  // Add budget-only locations (no actuals yet)
  for (const [key, budget] of budgetByLocation) {
    if (!processedBudgetKeys.has(key)) {
      budgetedLocations.push({
        locationName: budget.locationName,
        matchedNames: [],
        budgetAmount: budget.totalBudget,
        actualAmount: 0,
        variance: budget.totalBudget,
        variancePercent: 100,
        isOverBudget: false,
        hasActuals: false,
        transactionCount: 0,
        matchTypes: [],
        transactions: []
      });
    }
  }

  // Detect refundable deposits from transactions
  function isDeposit(tx) {
    const desc = (tx.description || '').toLowerCase();
    return desc.includes('deposit') ||
           desc.includes('refundable') ||
           desc.includes('security deposit') ||
           desc.includes('damage deposit');
  }

  // Calculate deposits from all transactions
  let totalDeposits = 0;
  let depositCount = 0;
  const depositTransactions = [];

  for (const loc of budgetedLocations) {
    for (const tx of loc.transactions || []) {
      if (isDeposit(tx)) {
        totalDeposits += Math.abs(tx.amount || 0);
        depositCount++;
        depositTransactions.push({
          location: loc.locationName,
          amount: tx.amount,
          description: tx.description,
          vendor: tx.vendor
        });
      }
    }
  }
  console.log(`[Handler] Found ${depositCount} deposits totaling $${totalDeposits.toFixed(2)}`);

  // Calculate PO totals by status
  const openPOStatuses = ['pending', 'approved', 'open', 'submitted'];
  const openPOs = (smartpo?.purchaseOrders || []).filter(po => {
    const status = (po.status || '').toLowerCase();
    return openPOStatuses.some(s => status.includes(s)) || !po.status;
  });
  const totalOpenPOAmount = openPOs.reduce((sum, po) => sum + (po.amount || 0), 0);

  // Calculate summary - deposits are INCLUDED in invoiced (they're paid out)
  // but tracked separately for visibility (they're refundable at wrap)
  const invoicedAmount = budgetedLocations.reduce((sum, l) => sum + l.actualAmount, 0);
  const noLocationTotal = noLocationTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const unmappedTotal = unmappedLocations.reduce((sum, l) => sum + l.totalAmount, 0);
  const totalInvoiced = invoicedAmount + unmappedTotal + noLocationTotal;
  const summary = {
    totalBudget: budgetedLocations.reduce((sum, l) => sum + l.budgetAmount, 0),
    totalActual: totalInvoiced,
    totalUnmapped: unmappedTotal,
    totalVariance: 0,
    locationsWithBudget: budgetByLocation.size,
    locationsWithActuals: budgetedLocations.filter(l => l.hasActuals).length,
    locationsOverBudget: budgetedLocations.filter(l => l.isOverBudget).length,
    unmappedTransactionCount: unmappedLocations.reduce((sum, l) => sum + l.transactions.length, 0),
    // Financial breakdown (Kirsten's methodology)
    invoiced: totalInvoiced,
    openPOs: totalOpenPOAmount,
    totalCommitted: totalInvoiced + totalOpenPOAmount,
    openPOCount: openPOs.length,
    totalPOCount: smartpo?.totalPOs || 0,
    // Deposits (included in invoiced, but tracked separately - refundable at wrap)
    deposits: totalDeposits,
    depositCount: depositCount,
    // Net spend = invoiced minus deposits (what's actually "spent" vs "held")
    netInvoiced: totalInvoiced - totalDeposits
  };
  summary.totalVariance = summary.totalBudget - summary.totalActual;
  // Variance including committed POs
  summary.committedVariance = summary.totalBudget - summary.totalCommitted;

  return {
    summary,
    budgetedLocations: budgetedLocations.sort((a, b) => b.actualAmount - a.actualAmount),
    unmappedLocations: unmappedLocations.sort((a, b) => Math.abs(b.totalAmount) - Math.abs(a.totalAmount)),
    // Include PO data for UI breakdown
    purchaseOrders: {
      total: smartpo?.totalPOs || 0,
      totalAmount: smartpo?.totalAmount || 0,
      openCount: openPOs.length,
      openAmount: totalOpenPOAmount,
      byStatus: smartpo?.byStatus || {}
    },
    // Deposit details for UI
    deposits: {
      total: totalDeposits,
      count: depositCount,
      transactions: depositTransactions
    },
    // Transactions with no location (EP payroll for police/fire/security)
    // Dashboard uses these for episode-level category totals
    noLocationTransactions,
    generatedAt: new Date().toISOString()
  };
}

async function performGoogleDriveSync() {
  const ledgerFolderId = process.env.GDRIVE_LEDGER_FOLDER_ID;
  const poFolderId = process.env.GDRIVE_PO_FOLDER_ID;
  const processedFolderId = process.env.GDRIVE_PROCESSED_FOLDER_ID;

  if (!ledgerFolderId || !poFolderId || !processedFolderId) {
    throw new Error('Google Drive folder IDs not configured (GDRIVE_LEDGER_FOLDER_ID, GDRIVE_PO_FOLDER_ID, GDRIVE_PROCESSED_FOLDER_ID)');
  }

  const auth = await getAuth();
  console.log('[GDriveSync] Authenticated with Google Drive');

  const [ledgerFiles, poFiles] = await Promise.all([
    scanAndDownloadNewFiles(auth, ledgerFolderId, 'Ledgers'),
    scanAndDownloadNewFiles(auth, poFolderId, 'POs')
  ]);

  const totalFound = ledgerFiles.length + poFiles.length;
  if (totalFound === 0) {
    return { success: true, message: 'No new files found in Google Drive', filesProcessed: 0, filesSkipped: 0 };
  }

  console.log(`[GDriveSync] Found ${ledgerFiles.length} ledger files, ${poFiles.length} PO files`);

  const processedFiles = [];
  const skippedDuplicates = [];
  const movedFiles = [];

  for (const file of ledgerFiles) {
    const fileHash = generateFileHash(file.buffer);
    const dedupCheck = await checkFileProcessed(fileHash, file.filename);
    if (dedupCheck.isDuplicate) {
      console.log(`[GDriveSync] SKIPPED duplicate: ${file.filename}`);
      skippedDuplicates.push({ fileName: file.filename, previousSync: dedupCheck.previousSync });
      await moveFile(auth, file.driveFileId, ledgerFolderId, processedFolderId).catch(e =>
        console.warn(`[GDriveSync] Failed to move ${file.filename} to processed: ${e.message}`)
      );
      movedFiles.push(file.filename);
      continue;
    }

    const detectedType = classifyFileType(file.filename, 'Ledgers');
    console.log(`[GDriveSync] Processing ledger: ${file.filename} as ${detectedType}`);

    const syncInput = {
      ledgerFiles: detectedType === 'LEDGER' ? [{ filename: file.filename, buffer: file.buffer }] : [],
      smartpoFile: detectedType === 'SMARTPO' ? { filename: file.filename, buffer: file.buffer } : undefined,
      options: {}
    };

    try {
      const s3Mappings = await readJsonFromS3('config/location-mappings.json');
      syncInput.locationMappings = s3Mappings;
    } catch (e) {
      syncInput.locationMappings = { mappings: [] };
    }

    if (syncInput.ledgerFiles.length > 0 || syncInput.smartpoFile) {
      const result = await handleSync(syncInput);

      if (result.success && result.ledgers) {
        await writeProcessedLedger(result, {
          syncSessionId: Date.now().toString(),
          sessionName: 'google-drive-auto'
        }, {
          ledgerFiles: syncInput.ledgerFiles,
          smartpoBuffer: syncInput.smartpoFile?.buffer,
          smartpoFilename: syncInput.smartpoFile?.filename
        });
      }

      if (result.success && !result.ledgers && result.smartpo?.purchaseOrders?.length > 0) {
        await writeJsonToS3('processed/parsed-smartpo.json', {
          purchaseOrders: result.smartpo.purchaseOrders,
          totalPOs: result.smartpo.totalPOs || result.smartpo.purchaseOrders.length,
          totalAmount: result.smartpo.totalAmount || 0,
          byStatus: result.smartpo.byStatus || {},
          lastUpdated: new Date().toISOString()
        });
      }

      if (result.success) {
        await markFileProcessed(fileHash, file.filename, {
          syncSource: 'google-drive-auto',
          fileType: detectedType,
          syncSessionId: Date.now().toString()
        });
        processedFiles.push({ fileName: file.filename, fileType: detectedType, status: 'processed' });
      }

      if (result.success && result.budgetData) {
        await writeJsonToS3('static/parsed-budgets.json', result.budgetData);
      }
    }

    await moveFile(auth, file.driveFileId, ledgerFolderId, processedFolderId).catch(e =>
      console.warn(`[GDriveSync] Failed to move ${file.filename} to processed: ${e.message}`)
    );
    movedFiles.push(file.filename);
  }

  for (const file of poFiles) {
    const fileHash = generateFileHash(file.buffer);
    const dedupCheck = await checkFileProcessed(fileHash, file.filename);
    if (dedupCheck.isDuplicate) {
      console.log(`[GDriveSync] SKIPPED duplicate PO: ${file.filename}`);
      skippedDuplicates.push({ fileName: file.filename, previousSync: dedupCheck.previousSync });
      await moveFile(auth, file.driveFileId, poFolderId, processedFolderId).catch(e =>
        console.warn(`[GDriveSync] Failed to move ${file.filename} to processed: ${e.message}`)
      );
      movedFiles.push(file.filename);
      continue;
    }

    console.log(`[GDriveSync] Processing PO file: ${file.filename}`);

    const syncInput = {
      ledgerFiles: [],
      smartpoFile: { filename: file.filename, buffer: file.buffer },
      options: {}
    };

    try {
      const s3Mappings = await readJsonFromS3('config/location-mappings.json');
      syncInput.locationMappings = s3Mappings;
    } catch (e) {
      syncInput.locationMappings = { mappings: [] };
    }

    const result = await handleSync(syncInput);

    if (result.success && result.smartpo?.purchaseOrders?.length > 0) {
      await writeJsonToS3('processed/parsed-smartpo.json', {
        purchaseOrders: result.smartpo.purchaseOrders,
        totalPOs: result.smartpo.totalPOs || result.smartpo.purchaseOrders.length,
        totalAmount: result.smartpo.totalAmount || 0,
        byStatus: result.smartpo.byStatus || {},
        lastUpdated: new Date().toISOString()
      });
    }

    if (result.success) {
      await markFileProcessed(fileHash, file.filename, {
        syncSource: 'google-drive-auto',
        fileType: 'SMARTPO',
        syncSessionId: Date.now().toString()
      });
      processedFiles.push({ fileName: file.filename, fileType: 'SMARTPO', status: 'processed' });
    }

    await moveFile(auth, file.driveFileId, poFolderId, processedFolderId).catch(e =>
      console.warn(`[GDriveSync] Failed to move ${file.filename} to processed: ${e.message}`)
    );
    movedFiles.push(file.filename);
  }

  if (processedFiles.length > 0) {
    await writeJsonToS3('processed/latest-sync-summary.json', {
      timestamp: new Date().toISOString(),
      syncSource: 'google-drive-auto',
      sessionId: Date.now().toString(),
      filesProcessed: processedFiles,
      filesDuplicated: skippedDuplicates,
      filesMoved: movedFiles
    });
  }

  return {
    success: true,
    message: `Processed ${processedFiles.length} files, skipped ${skippedDuplicates.length} duplicates, moved ${movedFiles.length} to processed`,
    filesProcessed: processedFiles.length,
    filesSkipped: skippedDuplicates.length,
    filesMoved: movedFiles.length,
    details: { processedFiles, skippedDuplicates, movedFiles }
  };
}

async function recalcTotals(budgetId, locationId) {
  const lineItems = await ddb.send(new QueryCommand({
    TableName: BUDGETS_TABLE, KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: { ':pk': budgetId, ':sk': `LI#${locationId}#` }
  }));
  const locTotal = (lineItems.Items || []).reduce((sum, li) => sum + (li.subtotal || 0), 0);

  const locResp = await ddb.send(new QueryCommand({
    TableName: BUDGETS_TABLE, KeyConditionExpression: 'PK = :pk AND SK = :sk',
    ExpressionAttributeValues: { ':pk': budgetId, ':sk': `LOC#${locationId}` }
  }));
  if (locResp.Items?.[0]) {
    const loc = locResp.Items[0];
    loc.total = locTotal;
    await ddb.send(new PutCommand({ TableName: BUDGETS_TABLE, Item: loc }));
  }

  const allLocs = await ddb.send(new QueryCommand({
    TableName: BUDGETS_TABLE, KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: { ':pk': budgetId, ':sk': 'LOC#' }
  }));
  const budgetTotal = (allLocs.Items || []).reduce((sum, l) => sum + (l.total || 0), 0);

  const metaResp = await ddb.send(new QueryCommand({
    TableName: BUDGETS_TABLE, KeyConditionExpression: 'PK = :pk AND SK = :sk',
    ExpressionAttributeValues: { ':pk': budgetId, ':sk': 'META' }
  }));
  if (metaResp.Items?.[0]) {
    const meta = metaResp.Items[0];
    meta.total = budgetTotal;
    await ddb.send(new PutCommand({ TableName: BUDGETS_TABLE, Item: meta }));
  }
}

export async function handler(event, context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Handle EventBridge scheduled events (automatic 15-min sync)
  if (event.source === 'aws.events' || event['detail-type'] === 'Scheduled Event') {
    console.log('[Handler] EventBridge scheduled sync triggered');
    try {
      const result = await performGoogleDriveSync();
      console.log('[Handler] EventBridge sync complete:', JSON.stringify(result));
      return { statusCode: 200, body: JSON.stringify(result) };
    } catch (error) {
      console.error('[Handler] EventBridge sync error:', error);
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const path = event.path || event.rawPath || '';
    const method = event.httpMethod || event.requestContext?.http?.method || 'POST';
    const contentType = event.headers?.['content-type'] || event.headers?.['Content-Type'] || '';
    console.log('[Handler] Path:', path, 'Method:', method);
    console.log('[Handler] Content-Type:', contentType);

    // Parse body — supports JSON and multipart/form-data
    let body = {};
    let uploadedFiles = [];

    if (contentType.includes('multipart/form-data')) {
      const boundary = extractBoundary(contentType);
      if (!boundary) throw new Error('Missing multipart boundary');
      const rawBody = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64')
        : Buffer.from(event.body || '', 'utf8');
      console.log(`[Handler] Parsing multipart body (${rawBody.length} bytes, boundary: ${boundary.substring(0, 20)}...)`);
      const parsed = parseMultipart(rawBody, boundary);
      body = parsed.fields;
      uploadedFiles = parsed.files;
      // Parse JSON fields that were stringified
      for (const [key, val] of Object.entries(body)) {
        try { body[key] = JSON.parse(val); } catch { /* keep as string */ }
      }
      console.log(`[Handler] Multipart: ${Object.keys(body).length} fields, ${uploadedFiles.length} files`);
      if (uploadedFiles.length > 0) {
        console.log(`[Handler] Uploaded files: ${uploadedFiles.map(f => `${f.filename} (${f.buffer.length} bytes)`).join(', ')}`);
      }
    } else {
      body = JSON.parse(event.body || '{}');
    }

    console.log('[Handler] Body keys:', Object.keys(body).join(', '));
    console.log('[Handler] Body preview:', JSON.stringify(body).substring(0, 500));

    let result;
    if (path.includes('/sync')) {
      const syncInput = {};
      const syncSource = body.syncSource || 'manual'; // 'manual', 'google-drive-auto', 'glide-webhook'
      const explicitFileType = body.fileType; // 'LEDGER', 'SMARTPO', 'INVOICE', 'CHECK_REQUEST'
      const filePath = body.filePath || ''; // Google Drive folder path for classification

      console.log(`[Handler] Sync source: ${syncSource}, Explicit fileType: ${explicitFileType || 'auto-detect'}`);

      // Track files processed in this sync
      const processedFiles = [];
      const skippedDuplicates = [];

      // Support multiple ledger files (array, comma-separated string, or single URL)
      let ledgerUrls = body.ledgerFileUrls && body.ledgerFileUrls.length > 0
        ? body.ledgerFileUrls
        : body.ledgerFileUrl
          ? body.ledgerFileUrl.split(',').map(u => u.trim()).filter(u => u.startsWith('http'))
          : [];

      // Single file mode (Google Drive auto-sync)
      if (body.fileUrl && !ledgerUrls.length) {
        ledgerUrls = [body.fileUrl];
      }

      if (ledgerUrls.length > 0) {
        console.log(`[Handler] Downloading ${ledgerUrls.length} file(s)...`);
        syncInput.ledgerFiles = [];
        for (const url of ledgerUrls) {
          try {
            const file = await downloadFile(url);

            // Override filename if explicitly provided (Google Drive URLs don't contain real filenames)
            if (body.fileName && ledgerUrls.length === 1) {
              console.log(`[Handler] Overriding filename from "${file.filename}" to "${body.fileName}"`);
              file.filename = body.fileName;
            }

            const fileHash = generateFileHash(file.buffer);

            // Check for duplicates
            const dedupCheck = await checkFileProcessed(fileHash, file.filename);
            if (dedupCheck.isDuplicate && syncSource === 'google-drive-auto') {
              console.log(`[Handler] SKIPPED duplicate file: ${file.filename} (previously processed ${dedupCheck.previousSync.processedAt})`);
              skippedDuplicates.push({
                fileName: file.filename,
                previousSync: dedupCheck.previousSync
              });
              continue;
            }

            // Classify file type
            const detectedType = explicitFileType || classifyFileType(file.filename, filePath);
            console.log(`[Handler] Downloaded: ${file.filename} (${file.buffer.length} bytes) - Type: ${detectedType}`);

            // Route based on file type
            if (detectedType === 'LEDGER') {
              syncInput.ledgerFiles.push(file);
            } else if (detectedType === 'SMARTPO') {
              syncInput.smartpoFile = file;
            } else if (detectedType === 'INVOICE' || detectedType === 'CHECK_REQUEST') {
              // Log for future processing - not yet implemented
              console.log(`[Handler] ${detectedType} file received but not yet processed: ${file.filename}`);
              processedFiles.push({
                fileName: file.filename,
                fileType: detectedType,
                fileHash,
                status: 'logged-only'
              });
            } else {
              // Unknown type - treat as ledger for backward compatibility
              console.warn(`[Handler] Unknown file type for ${file.filename}, treating as LEDGER`);
              syncInput.ledgerFiles.push(file);
            }

            processedFiles.push({
              fileName: file.filename,
              fileType: detectedType,
              fileHash,
              status: 'processed'
            });

          } catch (e) {
            console.warn(`[Handler] Failed to download file: ${e.message}`);
          }
        }
        console.log(`[Handler] Processed ${processedFiles.length} files, skipped ${skippedDuplicates.length} duplicates`);
      }

      // Handle multipart file uploads (legacy support)
      if (uploadedFiles.length > 0 && !syncInput.ledgerFiles?.length) {
        console.log(`[Handler] Processing ${uploadedFiles.length} multipart-uploaded file(s)...`);
        syncInput.ledgerFiles = syncInput.ledgerFiles || [];

        for (const uploaded of uploadedFiles) {
          const file = { filename: uploaded.filename, buffer: uploaded.buffer };
          const fileHash = generateFileHash(file.buffer);

          // Check for duplicates
          const dedupCheck = await checkFileProcessed(fileHash, file.filename);
          if (dedupCheck.isDuplicate && syncSource === 'google-drive-auto') {
            console.log(`[Handler] SKIPPED duplicate upload: ${file.filename}`);
            skippedDuplicates.push({ fileName: file.filename, previousSync: dedupCheck.previousSync });
            continue;
          }

          const detectedType = explicitFileType || classifyFileType(file.filename, filePath);
          console.log(`[Handler] Uploaded: ${file.filename} (${file.buffer.length} bytes) - Type: ${detectedType}`);

          if (detectedType === 'LEDGER') {
            syncInput.ledgerFiles.push(file);
          } else if (detectedType === 'SMARTPO') {
            syncInput.smartpoFile = file;
          } else if (detectedType === 'INVOICE' || detectedType === 'CHECK_REQUEST') {
            console.log(`[Handler] ${detectedType} file received but not yet processed: ${file.filename}`);
            processedFiles.push({ fileName: file.filename, fileType: detectedType, fileHash, status: 'logged-only' });
          } else {
            console.warn(`[Handler] Unknown file type for ${file.filename}, treating as LEDGER`);
            syncInput.ledgerFiles.push(file);
          }

          processedFiles.push({ fileName: file.filename, fileType: detectedType, fileHash, status: 'processed' });
        }
      }

      // Support multiple SmartPO files (array, comma-separated string, or single URL)
      const smartpoUrls = body.smartpoFileUrls && body.smartpoFileUrls.length > 0
        ? body.smartpoFileUrls
        : body.smartpoFileUrl
          ? body.smartpoFileUrl.split(',').map(u => u.trim()).filter(u => u.startsWith('http'))
          : [];
      if (smartpoUrls.length > 0) {
        try {
          console.log(`[Handler] Downloading SmartPO file from URL: ${smartpoUrls[0]}`);
          syncInput.smartpoFile = await downloadFile(smartpoUrls[0]);
          console.log(`[Handler] SmartPO file downloaded: ${syncInput.smartpoFile.filename}`);
        } catch (e) {
          console.warn('[Handler] SmartPO download failed (optional):', e.message);
        }
      }

      syncInput.options = body.options;

      // Load location mappings from S3 (merge with any provided in request)
      try {
        const s3Mappings = await readJsonFromS3('config/location-mappings.json');
        syncInput.locationMappings = s3Mappings;
        console.log('[Handler] Loaded', s3Mappings.mappings?.length || 0, 'location mappings from S3');
      } catch (e) {
        console.warn('[Handler] Could not load location mappings from S3:', e.message);
        syncInput.locationMappings = body.locationMappings || { mappings: [] };
      }

      result = await handleSync(syncInput);

      // Persist enriched transaction data to S3 (includes matchedLocation fields)
      if (result.success && result.ledgers) {
        await writeProcessedLedger(result, {
          syncSessionId: body.syncSessionId || Date.now().toString(),
          sessionName: body.syncSessionName || 'sync'
        }, {
          ledgerFiles: syncInput.ledgerFiles || [],
          smartpoBuffer: syncInput.smartpoFile?.buffer,
          smartpoFilename: syncInput.smartpoFile?.filename
        });
        console.log('[Handler] Persisted enriched ledger data to S3');
      }

      // Write SmartPO data independently (when synced without ledger)
      if (result.success && !result.ledgers && result.smartpo?.purchaseOrders?.length > 0) {
        const smartpoData = {
          purchaseOrders: result.smartpo.purchaseOrders,
          totalPOs: result.smartpo.totalPOs || result.smartpo.purchaseOrders.length,
          totalAmount: result.smartpo.totalAmount || 0,
          byStatus: result.smartpo.byStatus || {},
          lastUpdated: new Date().toISOString(),
          syncSessionId: body.syncSessionId || Date.now().toString()
        };
        await writeJsonToS3('processed/parsed-smartpo.json', smartpoData);
        console.log(`[Handler] Wrote SmartPO data: ${smartpoData.totalPOs} POs, $${smartpoData.totalAmount.toFixed(2)}`);
      }

      // Mark files as processed in registry (deduplication)
      if (result.success) {
        for (const fileInfo of processedFiles) {
          if (fileInfo.status === 'processed') {
            await markFileProcessed(fileInfo.fileHash, fileInfo.fileName, {
              syncSource,
              fileType: fileInfo.fileType,
              syncSessionId: body.syncSessionId || Date.now().toString()
            });
          }
        }
      }

      // Always write budget data to S3 when available (even without ledger upload)
      if (result.success && result.budgetData) {
        await writeJsonToS3('static/parsed-budgets.json', result.budgetData);
        console.log('[Handler] Wrote budget data to S3');
      }

      // Add file processing metadata to result
      result.filesProcessed = processedFiles;
      result.filesDuplicated = skippedDuplicates;
      result.syncSource = syncSource;

      // Write latest sync summary for dashboard
      if (result.success && result.ledgers) {
        const syncSummary = {
          timestamp: new Date().toISOString(),
          syncSource,
          sessionId: body.syncSessionId || Date.now().toString(),
          transactions: result.ledgers.totalLineItems || 0,
          grandTotal: result.ledgers.grandTotal || 0,
          filesProcessed: processedFiles.filter(f => f.status === 'processed'),
          filesDuplicated: skippedDuplicates
        };
        await writeJsonToS3('processed/latest-sync-summary.json', syncSummary);
        console.log('[Handler] Wrote latest sync summary');
      }
    } else if (path.includes('/approve')) {
      result = await handleApproval(body);
    } else if (path.includes('/mappings')) {
      if (method === 'GET') {
        try {
          const mappings = await readJsonFromS3('config/location-mappings.json');
          result = { mappings };
        } catch (e) {
          result = { mappings: [] };
        }
      } else {
        const existingMappings = await readJsonFromS3('config/location-mappings.json').catch(() => ({ mappings: [] }));
        const newMappings = body.mappings || [];
        const allMappings = [...(existingMappings.mappings || []), ...newMappings];

        const uniqueMappings = allMappings.reduce((acc, m) => {
          acc[m.ledgerLocation] = m;
          return acc;
        }, {});

        const finalMappings = Object.values(uniqueMappings);
        await writeJsonToS3('config/location-mappings.json', {
          mappings: finalMappings,
          updatedAt: new Date().toISOString()
        });

        result = {
          success: true,
          savedCount: newMappings.length,
          totalMappings: finalMappings.length
        };
        console.log(`[Handler] Saved ${newMappings.length} new mappings, total: ${finalMappings.length}`);
      }
    } else if (path.includes('/overrides')) {
      if (method === 'GET') {
        try {
          const data = await readJsonFromS3('config/transaction-overrides.json');
          result = data;
        } catch (e) {
          result = { overrides: [], updatedAt: null };
        }
      } else if (method === 'DELETE') {
        const existing = await readJsonFromS3('config/transaction-overrides.json')
          .catch(() => ({ overrides: [] }));
        const filtered = (existing.overrides || []).filter(o => o.txId !== body.txId);
        await writeJsonToS3('config/transaction-overrides.json', {
          overrides: filtered,
          updatedAt: new Date().toISOString()
        });
        result = { success: true, removedTxId: body.txId, totalOverrides: filtered.length };
        console.log(`[Handler] Removed override for txId=${body.txId}, remaining: ${filtered.length}`);
      } else {
        // POST: add or update an override
        const existing = await readJsonFromS3('config/transaction-overrides.json')
          .catch(() => ({ overrides: [] }));
        const overrides = existing.overrides || [];

        const override = {
          txId: body.txId,
          originalEpisode: body.originalEpisode || null,
          originalLocation: body.originalLocation || null,
          originalCategory: body.originalCategory || null,
          newEpisode: body.newEpisode || null,
          newLocation: body.newLocation || null,
          newCategory: body.newCategory || null,
          reason: body.reason || '',
          createdAt: new Date().toISOString(),
          createdBy: 'dashboard'
        };

        // Upsert by txId
        const idx = overrides.findIndex(o => o.txId === body.txId);
        if (idx >= 0) {
          overrides[idx] = override;
        } else {
          overrides.push(override);
        }

        await writeJsonToS3('config/transaction-overrides.json', {
          overrides,
          updatedAt: new Date().toISOString()
        });
        result = { success: true, override, totalOverrides: overrides.length };
        console.log(`[Handler] Saved override for txId=${body.txId}, total: ${overrides.length}`);
      }
    } else if (path.includes('/files/confirm') && method === 'POST') {
      // Kirsten confirms a file as current and accurate
      const confirmations = await readJsonFromS3('processed/file-confirmations.json')
        .catch(() => ({ confirmations: [] }));
      const list = confirmations.confirmations || [];

      const entry = {
        fileKey: body.fileKey,
        confirmedAt: new Date().toISOString(),
        confirmedBy: body.confirmedBy || 'kirsten'
      };

      // Upsert by fileKey
      const idx = list.findIndex(c => c.fileKey === body.fileKey);
      if (idx >= 0) {
        list[idx] = entry;
      } else {
        list.push(entry);
      }

      await writeJsonToS3('processed/file-confirmations.json', {
        confirmations: list,
        updatedAt: new Date().toISOString()
      });
      result = { success: true, confirmation: entry, total: list.length };
      console.log(`[Handler] File confirmed: ${body.fileKey}`);

    } else if (path.includes('/files/delete') && method === 'POST') {
      const fileKey = body.fileKey;
      if (!fileKey) {
        result = { error: 'fileKey is required' };
        statusCode = 400;
      } else {
        console.log(`[Handler] Deleting file: ${fileKey}`);
        let deletedTxCount = 0;
        let deletedAmount = 0;

        if (fileKey.startsWith('ledger-ep')) {
          const episode = fileKey.replace('ledger-ep', '');
          const ledgers = await readJsonFromS3('processed/parsed-ledgers-detailed.json').catch(() => null);

          if (ledgers?.ledgers) {
            const before = ledgers.ledgers.length;
            const kept = ledgers.ledgers.filter(l => {
              const ep = l.episode || 'unknown';
              if (ep === episode) {
                deletedTxCount += (l.transactions || []).length;
                deletedAmount += (l.transactions || []).reduce((s, t) => s + (t.amount || 0), 0);
                return false;
              }
              return true;
            });

            await writeJsonToS3('processed/parsed-ledgers-detailed.json', {
              ...ledgers,
              ledgers: kept,
              totalFiles: kept.length,
              totalLineItems: kept.reduce((s, l) => s + (l.transactions || []).length, 0),
              grandTotal: kept.reduce((s, l) => s + (l.transactions || []).reduce((s2, t) => s2 + (t.amount || 0), 0), 0),
              lastUpdated: new Date().toISOString()
            });
            console.log(`[Handler] Removed ${before - kept.length} ledger groups for episode ${episode} (${deletedTxCount} txns, $${deletedAmount.toFixed(2)})`);
          }
        } else if (fileKey.startsWith('smartpo-')) {
          const smartpo = await readJsonFromS3('processed/parsed-smartpo.json').catch(() => null);
          if (smartpo) {
            deletedTxCount = smartpo.purchaseOrders?.length || 0;
            deletedAmount = (smartpo.purchaseOrders || []).reduce((s, p) => s + (p.amount || 0), 0);
            await writeJsonToS3('processed/parsed-smartpo.json', {
              purchaseOrders: [],
              totalPOs: 0,
              totalAmount: 0,
              filename: null,
              parsedAt: null,
              deletedAt: new Date().toISOString()
            });
            console.log(`[Handler] Cleared SmartPO data (${deletedTxCount} POs, $${deletedAmount.toFixed(2)})`);
          }
        }

        const confirmations = await readJsonFromS3('processed/file-confirmations.json')
          .catch(() => ({ confirmations: [] }));
        const filteredConfirmations = (confirmations.confirmations || []).filter(c => c.fileKey !== fileKey);
        await writeJsonToS3('processed/file-confirmations.json', {
          confirmations: filteredConfirmations,
          updatedAt: new Date().toISOString()
        });

        // Clear dedup records so the file can be re-synced from Google Drive
        let dedupCleared = 0;
        try {
          const registry = await readJsonFromS3('processed-files-registry.json');
          if (registry.files) {
            const episode = fileKey.startsWith('ledger-ep') ? fileKey.replace('ledger-ep', '') : null;
            const isSmartpo = fileKey.startsWith('smartpo-');
            for (const [hash, entry] of Object.entries(registry.files)) {
              const name = entry.fileName || '';
              if ((episode && name.startsWith(episode + ' ')) || (isSmartpo && name.toLowerCase().startsWith('po-log'))) {
                delete registry.files[hash];
                dedupCleared++;
              }
            }
            if (dedupCleared > 0) {
              await writeJsonToS3('processed-files-registry.json', registry);
              console.log(`[Handler] Cleared ${dedupCleared} dedup record(s) for ${fileKey}`);
            }
          }
        } catch (e) {
          console.warn('[Handler] Could not clear dedup records:', e.message);
        }

        result = {
          success: true,
          deletedFileKey: fileKey,
          deletedTransactions: deletedTxCount,
          deletedAmount,
          dedupCleared,
          message: `Removed ${deletedTxCount} transactions ($${Math.abs(deletedAmount).toLocaleString()})`
        };
        console.log(`[Handler] File deleted: ${fileKey} — ${deletedTxCount} txns, $${deletedAmount.toFixed(2)}`);
      }

    } else if (path.includes('/files')) {
      // Return processed file inventory with confirmation status
      const ledgers = await readJsonFromS3('processed/parsed-ledgers-detailed.json').catch(() => null);
      const smartpo = await readJsonFromS3('processed/parsed-smartpo.json').catch(() => null);
      const syncSummary = await readJsonFromS3('processed/latest-sync-summary.json').catch(() => null);
      const confirmations = await readJsonFromS3('processed/file-confirmations.json')
        .catch(() => ({ confirmations: [] }));
      const confirmMap = {};
      for (const c of confirmations.confirmations || []) {
        confirmMap[c.fileKey] = c;
      }

      const files = [];

      // Add ledger files — group by episode (one card per source file)
      if (ledgers?.ledgers) {
        const byEpisode = {};
        for (const ledger of ledgers.ledgers) {
          const ep = ledger.episode || 'unknown';
          if (!byEpisode[ep]) {
            byEpisode[ep] = { txCount: 0, total: 0, filename: ledger.filename, reportDate: ledger.reportDate, parsedAt: ledger.parsedAt };
          }
          byEpisode[ep].txCount += (ledger.transactions || []).length;
          byEpisode[ep].total += (ledger.transactions || []).reduce((s, t) => s + (t.amount || 0), 0);
          if (ledger.filename && !byEpisode[ep].filename) byEpisode[ep].filename = ledger.filename;
          if (ledger.reportDate && !byEpisode[ep].reportDate) byEpisode[ep].reportDate = ledger.reportDate;
          if (ledger.parsedAt && !byEpisode[ep].parsedAt) byEpisode[ep].parsedAt = ledger.parsedAt;
        }
        for (const [ep, info] of Object.entries(byEpisode)) {
          // Fallback: derive reportDate from transaction data or parsedAt
          if (!info.reportDate) {
            const epLedger = ledgers.ledgers.find(l => (l.episode || 'unknown') === ep);
            const txDate = epLedger?.transactions?.[0]?.reportDate;
            info.reportDate = txDate || (info.parsedAt ? info.parsedAt.split('T')[0] : null);
          }
          const fileKey = `ledger-ep${ep}`;
          files.push({
            fileKey,
            fileName: info.filename || `Episode ${ep} GL Ledger`,
            fileType: 'LEDGER',
            episode: ep,
            reportDate: info.reportDate,
            transactionCount: info.txCount,
            totalAmount: info.total,
            processedAt: info.parsedAt || syncSummary?.timestamp || null,
            confirmation: confirmMap[fileKey] || null
          });
        }
      }

      // Add SmartPO file
      if (smartpo) {
        const poCount = smartpo.purchaseOrders?.length || 0;
        const poTotal = (smartpo.purchaseOrders || []).reduce((s, p) => s + (p.amount || 0), 0);
        const fileKey = `smartpo-${smartpo.filename || 'PO-Log'}`;
        files.push({
          fileKey,
          fileName: smartpo.filename || 'PO-Log',
          fileType: 'SMARTPO',
          episode: 'all',
          transactionCount: poCount,
          totalAmount: poTotal,
          processedAt: smartpo.parsedAt || syncSummary?.timestamp || null,
          confirmation: confirmMap[fileKey] || null
        });
      }

      result = {
        files,
        lastSync: syncSummary?.timestamp || null,
        totalFiles: files.length
      };

    } else if (path.includes('/ledgers') && !path.includes('/data')) {
      // Lightweight endpoint: return raw ledger data from S3
      const ledgers = await readJsonFromS3('processed/parsed-ledgers-detailed.json').catch(() => null);
      if (!ledgers) {
        result = { error: 'No ledger data found', ledgers: [] };
      } else {
        result = ledgers;
      }
    } else if (path.includes('/data')) {
      const ledgers = await readJsonFromS3('processed/parsed-ledgers-detailed.json').catch(() => null);
      const locationMappings = await readJsonFromS3('config/location-mappings.json').catch(() => ({ mappings: [] }));
      const smartpo = await readJsonFromS3('processed/parsed-smartpo.json').catch(() => null);

      // Backfill txId for transactions parsed before txId was added
      if (ledgers?.ledgers) {
        let backfilled = 0;
        for (const ledger of ledgers.ledgers) {
          for (const tx of ledger.transactions || []) {
            if (!tx.txId) {
              tx.txId = generateHash({
                vendor: tx.vendor || '',
                amount: tx.amount || 0,
                description: tx.description || '',
                episode: tx.episode || ledger.episode || '',
                glCode: tx.glCode || tx.account || '',
                transNumber: tx.transNumber || '',
                transType: tx.transType || ''
              });
              backfilled++;
            }
          }
        }
        if (backfilled > 0) {
          console.log(`[Handler] Backfilled txId for ${backfilled} transactions`);
        }
      }

      // Fetch fresh budgets from DynamoDB (replaced Glide)
      let budgets = null;
      try {
        console.log('[Data] Fetching fresh budget data from DynamoDB...');
        budgets = await transformDynamoDBBudgetData();
        // Update S3 cache so it stays current
        await writeJsonToS3('static/parsed-budgets.json', budgets).catch(e =>
          console.warn('[Data] Failed to update S3 budget cache:', e.message)
        );
      } catch (e) {
        console.error('[Data] DynamoDB budget fetch failed:', e.message, e.stack);
        // Fallback to S3 cache if DynamoDB fails
        budgets = await readJsonFromS3('static/parsed-budgets.json').catch(() => null);
        if (!budgets) {
          console.error('[Data] S3 fallback also failed - no budget data available');
        }
      }

      if (!ledgers || !budgets) {
        result = { error: 'Missing data files', budgets: !!budgets, ledgers: !!ledgers };
      } else {
        // FIRST: Recover episode/account from filename for ledgers stored with "unknown"
        // Must happen before dedup so recovered episodes merge correctly
        for (const ledger of ledgers.ledgers || []) {
          if (ledger.episode === 'unknown' && ledger.filename) {
            const fileInfo = parseFilename(ledger.filename);
            if (fileInfo) {
              ledger.episode = fileInfo.episode;
              ledger.account = fileInfo.account;
              for (const txn of ledger.transactions || []) {
                if (txn.episode === 'unknown') txn.episode = fileInfo.episode;
                if (txn.account === 'unknown') txn.account = fileInfo.account;
              }
              console.log(`[Handler] Recovered episode=${fileInfo.episode} account=${fileInfo.account} from filename: ${ledger.filename}`);
            }
          }
        }

        // THEN: Deduplicate ledgers by episode-account key (keep latest reportDate)
        if (ledgers.ledgers && Array.isArray(ledgers.ledgers)) {
          const latestLedgers = {};
          for (const ledger of ledgers.ledgers) {
            const key = `${ledger.episode}-${ledger.account}`;
            if (!latestLedgers[key] || (ledger.reportDate || '') > (latestLedgers[key].reportDate || '')) {
              latestLedgers[key] = ledger;
            }
          }
          const beforeCount = ledgers.ledgers.length;
          ledgers.ledgers = Object.values(latestLedgers);
          if (beforeCount !== ledgers.ledgers.length) {
            console.log(`[Handler] Deduplicated ledgers: ${beforeCount} -> ${ledgers.ledgers.length}`);
          }
        }

        // Apply transaction overrides BEFORE comparison
        const txOverrides = await readJsonFromS3('config/transaction-overrides.json')
          .catch(() => ({ overrides: [] }));
        const overrideMap = new Map((txOverrides.overrides || []).map(o => [o.txId, o]));
        if (overrideMap.size > 0) {
          let appliedCount = 0;
          for (const ledger of ledgers.ledgers || []) {
            for (const tx of ledger.transactions || []) {
              const override = overrideMap.get(tx.txId);
              if (override) {
                tx._override = {
                  originalEpisode: tx.episode,
                  originalLocation: tx.location || tx.matchedLocation,
                  originalCategory: tx.category
                };
                if (override.newEpisode) tx.episode = override.newEpisode;
                if (override.newLocation) {
                  tx.matchedLocation = override.newLocation;
                  tx.location = override.newLocation;
                }
                if (override.newCategory) tx.category = override.newCategory;
                appliedCount++;
              }
            }
          }
          if (appliedCount > 0) {
            console.log(`[Handler] Applied ${appliedCount} transaction overrides`);
          }
        }

        result = generateLocationComparison(budgets, ledgers, locationMappings, smartpo);
        result.episodeTotals = budgets.episodeTotals || {};
        result.byEpisodeCategory = budgets.byEpisodeCategory || [];
        result.byCategoryLocationEpisode = budgets.byCategoryLocationEpisode || [];

        // Distribute "all" budget across episodes with GL actuals
        // Glide budgets are per-location (not per-episode), so most items have episode="all"
        // The dashboard needs episode-keyed budgets to show per-episode comparisons
        if (result.episodeTotals.all != null) {
          const allBudget = result.episodeTotals.all;
          delete result.episodeTotals.all;

          const activeEps = new Set();
          for (const ledger of ledgers.ledgers || []) {
            if (ledger.episode && ledger.episode !== 'unknown') {
              activeEps.add(ledger.episode);
            }
          }

          if (activeEps.size > 0) {
            const perEp = allBudget / activeEps.size;
            for (const ep of activeEps) {
              result.episodeTotals[ep] = (result.episodeTotals[ep] || 0) + perEp;
            }
            console.log(`[Handler] Distributed $${allBudget.toFixed(0)} "all" budget across ${activeEps.size} episodes ($${perEp.toFixed(0)} each)`);
          } else {
            result.episodeTotals.all = allBudget;
          }
        }

        // Same for byEpisodeCategory
        if (result.byEpisodeCategory?.length > 0) {
          const activeEps = new Set();
          for (const ledger of ledgers.ledgers || []) {
            if (ledger.episode && ledger.episode !== 'unknown') {
              activeEps.add(ledger.episode);
            }
          }

          if (activeEps.size > 0) {
            const allItems = result.byEpisodeCategory.filter(i => i.episode === 'all');
            const nonAllItems = result.byEpisodeCategory.filter(i => i.episode !== 'all');

            for (const item of allItems) {
              const perEp = item.totalBudget / activeEps.size;
              for (const ep of activeEps) {
                const existing = nonAllItems.find(
                  i => i.episode === ep && i.category === item.category
                );
                if (existing) {
                  existing.totalBudget += perEp;
                } else {
                  nonAllItems.push({ episode: ep, category: item.category, totalBudget: perEp });
                }
              }
            }
            result.byEpisodeCategory = nonAllItems;
          }
        }

        // Same for byCategoryLocationEpisode
        if (result.byCategoryLocationEpisode?.length > 0) {
          const activeEps = new Set();
          for (const ledger of ledgers.ledgers || []) {
            if (ledger.episode && ledger.episode !== 'unknown') {
              activeEps.add(ledger.episode);
            }
          }

          if (activeEps.size > 0) {
            const allItems = result.byCategoryLocationEpisode.filter(i => i.episode === 'all');
            const nonAllItems = result.byCategoryLocationEpisode.filter(i => i.episode !== 'all');

            for (const item of allItems) {
              const perEp = item.totalBudget / activeEps.size;
              for (const ep of activeEps) {
                const existing = nonAllItems.find(
                  i => i.episode === ep && i.category === item.category && i.location === item.location
                );
                if (existing) {
                  existing.totalBudget += perEp;
                } else {
                  nonAllItems.push({ category: item.category, location: item.location, episode: ep, totalBudget: perEp });
                }
              }
            }
            result.byCategoryLocationEpisode = nonAllItems;
            console.log(`[Handler] Distributed ${allItems.length} "all" byCategoryLocationEpisode items across ${activeEps.size} episodes`);
          }
        }
      }
    } else if (path.includes('/budgets/line-items')) {
      if (method === 'GET') {
        const qs = event.queryStringParameters || {};
        const budgetId = qs.budgetId;
        const locationId = qs.locationId;
        if (!budgetId || !locationId) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'budgetId and locationId required' }) };
        }
        const resp = await ddb.send(new QueryCommand({
          TableName: BUDGETS_TABLE, KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: { ':pk': budgetId, ':sk': `LI#${locationId}#` }
        }));
        result = { items: resp.Items || [] };
      } else if (method === 'POST') {
        const { budgetId, locationId, lineItemId, category, name: itemName, quantity, rate, units } = body;
        const subtotal = (quantity || 1) * (rate || 0) * (units || 1);
        await ddb.send(new PutCommand({
          TableName: BUDGETS_TABLE, Item: {
            PK: budgetId, SK: `LI#${locationId}#${lineItemId}`,
            category, name: itemName, quantity: quantity || 1, rate: rate || 0, units: units || 1, subtotal
          }
        }));
        await recalcTotals(budgetId, locationId);
        result = { success: true, lineItemId, subtotal };
      } else if (method === 'PUT') {
        const { budgetId, locationId, lineItemId, ...updates } = body;
        if (updates.quantity !== undefined || updates.rate !== undefined || updates.units !== undefined) {
          updates.subtotal = (updates.quantity || 1) * (updates.rate || 0) * (updates.units || 1);
        }
        const existing = await ddb.send(new QueryCommand({
          TableName: BUDGETS_TABLE, KeyConditionExpression: 'PK = :pk AND SK = :sk',
          ExpressionAttributeValues: { ':pk': budgetId, ':sk': `LI#${locationId}#${lineItemId}` }
        }));
        const item = existing.Items?.[0] || {};
        const merged = { ...item, ...updates, PK: budgetId, SK: `LI#${locationId}#${lineItemId}` };
        if (updates.quantity !== undefined || updates.rate !== undefined || updates.units !== undefined) {
          merged.subtotal = (merged.quantity || 1) * (merged.rate || 0) * (merged.units || 1);
        }
        await ddb.send(new PutCommand({ TableName: BUDGETS_TABLE, Item: merged }));
        await recalcTotals(budgetId, locationId);
        result = { success: true, item: merged };
      } else if (method === 'DELETE') {
        const { budgetId, locationId, lineItemId } = body;
        await ddb.send(new DeleteCommand({
          TableName: BUDGETS_TABLE, Key: { PK: budgetId, SK: `LI#${locationId}#${lineItemId}` }
        }));
        await recalcTotals(budgetId, locationId);
        result = { success: true };
      }
    } else if (path.includes('/budgets/locations')) {
      if (method === 'GET') {
        const qs = event.queryStringParameters || {};
        const budgetId = qs.budgetId;
        if (!budgetId) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'budgetId required' }) };
        }
        const resp = await ddb.send(new QueryCommand({
          TableName: BUDGETS_TABLE, KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: { ':pk': budgetId, ':sk': 'LOC#' }
        }));
        result = { locations: resp.Items || [] };
      } else if (method === 'POST') {
        const { budgetId, locationId, name: locName, address, contactName, notes } = body;
        await ddb.send(new PutCommand({
          TableName: BUDGETS_TABLE, Item: {
            PK: budgetId, SK: `LOC#${locationId}`,
            name: locName, total: 0, address: address || '', contactName: contactName || '', notes: notes || ''
          }
        }));
        // Update budget location count
        const locs = await ddb.send(new QueryCommand({
          TableName: BUDGETS_TABLE, KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: { ':pk': budgetId, ':sk': 'LOC#' }
        }));
        const metaResp = await ddb.send(new QueryCommand({
          TableName: BUDGETS_TABLE, KeyConditionExpression: 'PK = :pk AND SK = :sk',
          ExpressionAttributeValues: { ':pk': budgetId, ':sk': 'META' }
        }));
        if (metaResp.Items?.[0]) {
          const meta = metaResp.Items[0];
          meta.locationCount = (locs.Items || []).length;
          await ddb.send(new PutCommand({ TableName: BUDGETS_TABLE, Item: meta }));
        }
        result = { success: true, locationId };
      } else if (method === 'DELETE') {
        const { budgetId, locationId } = body;
        // Delete all line items for this location
        const lineItems = await ddb.send(new QueryCommand({
          TableName: BUDGETS_TABLE, KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: { ':pk': budgetId, ':sk': `LI#${locationId}#` }
        }));
        if (lineItems.Items?.length) {
          const batches = [];
          for (let i = 0; i < lineItems.Items.length; i += 25) {
            batches.push(lineItems.Items.slice(i, i + 25));
          }
          for (const batch of batches) {
            await ddb.send(new BatchWriteCommand({
              RequestItems: { [BUDGETS_TABLE]: batch.map(item => ({ DeleteRequest: { Key: { PK: item.PK, SK: item.SK } } })) }
            }));
          }
        }
        // Delete the location record
        await ddb.send(new DeleteCommand({
          TableName: BUDGETS_TABLE, Key: { PK: budgetId, SK: `LOC#${locationId}` }
        }));
        // Update budget totals
        const remainingLocs = await ddb.send(new QueryCommand({
          TableName: BUDGETS_TABLE, KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: { ':pk': budgetId, ':sk': 'LOC#' }
        }));
        const metaResp2 = await ddb.send(new QueryCommand({
          TableName: BUDGETS_TABLE, KeyConditionExpression: 'PK = :pk AND SK = :sk',
          ExpressionAttributeValues: { ':pk': budgetId, ':sk': 'META' }
        }));
        if (metaResp2.Items?.[0]) {
          const meta = metaResp2.Items[0];
          meta.locationCount = (remainingLocs.Items || []).length;
          meta.total = (remainingLocs.Items || []).reduce((sum, l) => sum + (l.total || 0), 0);
          await ddb.send(new PutCommand({ TableName: BUDGETS_TABLE, Item: meta }));
        }
        result = { success: true };
      }
    } else if (path.includes('/budgets')) {
      if (method === 'GET') {
        const resp = await ddb.send(new ScanCommand({
          TableName: BUDGETS_TABLE, FilterExpression: 'SK = :meta',
          ExpressionAttributeValues: { ':meta': 'META' }
        }));
        result = { budgets: (resp.Items || []).sort((a, b) => a.PK.localeCompare(b.PK)) };
      } else if (method === 'POST') {
        const { budgetId, episode, title, date, status } = body;
        await ddb.send(new PutCommand({
          TableName: BUDGETS_TABLE, Item: {
            PK: budgetId, SK: 'META',
            episode: episode || budgetId, title: title || '', date: date || new Date().toISOString().split('T')[0],
            status: status || 'draft', total: 0, locationCount: 0
          }
        }));
        result = { success: true, budgetId };
      } else if (method === 'PUT') {
        const { budgetId, ...updates } = body;
        const existing = await ddb.send(new QueryCommand({
          TableName: BUDGETS_TABLE, KeyConditionExpression: 'PK = :pk AND SK = :sk',
          ExpressionAttributeValues: { ':pk': budgetId, ':sk': 'META' }
        }));
        if (!existing.Items?.[0]) {
          return { statusCode: 404, headers, body: JSON.stringify({ error: 'Budget not found' }) };
        }
        const merged = { ...existing.Items[0], ...updates, PK: budgetId, SK: 'META' };
        await ddb.send(new PutCommand({ TableName: BUDGETS_TABLE, Item: merged }));
        result = { success: true, budget: merged };
      } else if (method === 'DELETE') {
        const { budgetId } = body;
        // Get all items for this budget
        const allItems = await ddb.send(new QueryCommand({
          TableName: BUDGETS_TABLE, KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: { ':pk': budgetId }
        }));
        if (allItems.Items?.length) {
          const batches = [];
          for (let i = 0; i < allItems.Items.length; i += 25) {
            batches.push(allItems.Items.slice(i, i + 25));
          }
          for (const batch of batches) {
            await ddb.send(new BatchWriteCommand({
              RequestItems: { [BUDGETS_TABLE]: batch.map(item => ({ DeleteRequest: { Key: { PK: item.PK, SK: item.SK } } })) }
            }));
          }
        }
        result = { success: true };
      }
    } else if (path.includes('/trigger-sync') && method === 'POST') {
      console.log('[Handler] Manual sync triggered via Sync Now button');
      try {
        result = await performGoogleDriveSync();
      } catch (syncError) {
        console.error('[Handler] Google Drive sync failed:', syncError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: `Google Drive sync failed: ${syncError.message}` })
        };
      }
    } else if (path.includes('/health')) {
      result = { status: 'ok', timestamp: new Date().toISOString() };
    } else {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Not found' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Lambda error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}
