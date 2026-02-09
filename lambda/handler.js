import { handleSync, handleApproval } from '../src/api/sync.js';
import { downloadFile } from '../src/utils/downloadFile.js';
import { writeJsonToS3, readJsonFromS3 } from '../src/utils/s3Utils.js';
import { writeProcessedLedger } from '../src/utils/writeProcessedData.js';
import { parseFilename, generateHash } from '../src/utils/fileUtils.js';
import { categorizeTransaction } from '../src/parsers/ledger.js';
import { createGlideClient } from '../src/glide/client.js';
import { transformBudgetData } from '../src/parsers/budget.js';

const ALL_CATEGORIES = [
  'Loc Fees', 'Addl. Site Fees', 'Site Personnel', 'Permits',
  'Addl. Labor', 'Equipment', 'Parking', 'Fire', 'Police', 'Security'
];

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
function extractDescriptionKeyword(description) {
  if (!description) return null;

  // Pattern 1: After colon, before optional episode suffix
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

  // Check if location is a service charge
  function isServiceCharge(name) {
    if (!name) return false;
    const normalized = name.toLowerCase().trim();
    return serviceChargePatterns.some(p => normalized.includes(p) || p.includes(normalized));
  }
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
  let serviceChargeTotal = 0;
  let serviceChargeCount = 0;
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

      // Check if this is a service charge (skip from location matching)
      if (isServiceCharge(locName)) {
        serviceChargeTotal += Math.abs(tx.amount || 0);
        serviceChargeCount++;
        continue;
      }

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
  console.log(`[Handler] Description keyword overrides: ${descriptionOverrides}, service charges skipped: ${serviceChargeCount}`);

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
      // Check if this is a PENDING location (known but not yet in Glide)
      const pendingName = pendingLocations.get(key);
      if (pendingName) {
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

export async function handler(event, context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const path = event.path || event.rawPath || '';
    console.log('[Handler] Path:', path, 'Method:', event.httpMethod || event.requestContext?.http?.method);
    console.log('[Handler] Body keys:', Object.keys(body).join(', '));
    console.log('[Handler] Body preview:', JSON.stringify(body).substring(0, 500));

    let result;
    if (path.includes('/sync')) {
      const syncInput = {};

      // Support multiple ledger files (array, comma-separated string, or single URL)
      let ledgerUrls = body.ledgerFileUrls && body.ledgerFileUrls.length > 0
        ? body.ledgerFileUrls
        : body.ledgerFileUrl
          ? body.ledgerFileUrl.split(',').map(u => u.trim()).filter(u => u.startsWith('http'))
          : [];
      if (ledgerUrls.length > 0) {
        console.log(`[Handler] Downloading ${ledgerUrls.length} ledger file(s)...`);
        syncInput.ledgerFiles = [];
        for (const url of ledgerUrls) {
          try {
            const ledgerFile = await downloadFile(url);
            syncInput.ledgerFiles.push(ledgerFile);
            console.log(`[Handler] Downloaded: ${ledgerFile.filename} (${ledgerFile.buffer.length} bytes)`);
          } catch (e) {
            console.warn(`[Handler] Failed to download ledger: ${e.message}`);
          }
        }
        console.log(`[Handler] Downloaded ${syncInput.ledgerFiles.length}/${ledgerUrls.length} ledger files`);
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

      // Always write budget data to S3 when available (even without ledger upload)
      if (result.success && result.budgetData) {
        await writeJsonToS3('static/parsed-budgets.json', result.budgetData);
        console.log('[Handler] Wrote budget data to S3');
      }
    } else if (path.includes('/approve')) {
      result = await handleApproval(body);
    } else if (path.includes('/mappings')) {
      const method = event.httpMethod || event.requestContext?.http?.method || 'POST';
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
      const method = event.httpMethod || event.requestContext?.http?.method || 'POST';
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

      // Always fetch fresh budgets from Glide (never stale S3 cache)
      let budgets = null;
      try {
        console.log('[Data] Fetching fresh budget data from Glide...');
        const glide = createGlideClient();
        const [glideLocationsBudgets, glideBudgetLineItems, glideEpisodes, glideBudgets] = await Promise.all([
          glide.getLocationsBudgets(),
          glide.getBudgetLineItems(),
          glide.getEpisodes(),
          glide.getBudgets()
        ]);
        console.log(`[Data] Fetched ${glideLocationsBudgets.length} locations, ${glideBudgetLineItems.length} line items`);
        budgets = transformBudgetData(glideLocationsBudgets, glideBudgetLineItems, glideEpisodes, glideBudgets);
        // Update S3 cache so it stays current
        await writeJsonToS3('static/parsed-budgets.json', budgets).catch(e =>
          console.warn('[Data] Failed to update S3 budget cache:', e.message)
        );
      } catch (e) {
        console.warn('[Data] Glide budget fetch failed, falling back to S3 cache:', e.message);
        budgets = await readJsonFromS3('static/parsed-budgets.json').catch(() => null);
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
