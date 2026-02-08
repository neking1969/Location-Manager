const CATEGORY_NORMALIZE = {
  'location fees': 'Loc Fees',
  'loc fees': 'Loc Fees',
  'location fee': 'Loc Fees',
  'site fees': 'Loc Fees',
  'addl. site fees': 'Addl. Site Fees',
  'additional site fees': 'Addl. Site Fees',
  'addl site fees': 'Addl. Site Fees',
  'equipment': 'Equipment',
  'security': 'Security',
  'police': 'Police',
  'fire': 'Fire',
  'permits': 'Permits',
  'parking': 'Parking',
  'rentals': 'Rentals',
  'site personnel': 'Site Personnel',
  'addl. labor': 'Addl. Labor',
  'additional labor': 'Addl. Labor',
  'addl labor': 'Addl. Labor'
};

function normalizeCategory(cat) {
  if (!cat) return 'Other';
  const normalized = CATEGORY_NORMALIZE[cat.toLowerCase().trim()];
  return normalized || cat;
}

function resolveRelation(value) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function calculateLineItemTotal(lineItem) {
  const rate = parseFloat(lineItem.rate);
  if (isNaN(rate) || rate === 0) return 0;

  const unit = parseFloat(lineItem.unit);
  // unit=0 means zero quantity, not "default to 1"
  // Only default to 1 when unit is absent/null (not explicitly set to 0)
  const effectiveUnit = (lineItem.unit === null || lineItem.unit === undefined) ? 1 : (isNaN(unit) ? 1 : unit);
  if (effectiveUnit === 0) return 0;

  const time = parseFloat(lineItem.time);
  const effectiveTime = (lineItem.time === null || lineItem.time === undefined) ? 1 : (isNaN(time) ? 1 : time);
  if (effectiveTime === 0) return 0;

  return rate * effectiveUnit * effectiveTime;
}

export function transformBudgetData(locationsBudgets, budgetLineItems, episodes, budgets) {
  // Build episode lookup: $rowID -> episode name (e.g., "101", "104")
  const episodeLookup = new Map();
  for (const ep of episodes || []) {
    const rowId = ep.$rowID;
    if (rowId) episodeLookup.set(rowId, String(ep.episode));
  }
  console.log(`[Budget] Episode lookup: ${episodeLookup.size} episodes`);

  // Build budget -> episode lookup via Budgets.episodeId -> Episodes.$rowID
  const budgetEpisodeLookup = new Map();
  for (const b of budgets || []) {
    const epRef = resolveRelation(b.episodeId);
    if (b.$rowID && epRef) {
      const epName = episodeLookup.get(epRef);
      if (epName) budgetEpisodeLookup.set(b.$rowID, epName);
    }
  }
  console.log(`[Budget] Budget->episode lookup: ${budgetEpisodeLookup.size} of ${(budgets || []).length} budgets mapped to episodes`);

  // Build location budget -> episode lookup via budgetId chain:
  // Locations:Budgets.budgetId -> Budgets.$rowID -> Budgets.episode
  const locationBudgetEpisodeLookup = new Map();
  for (const loc of locationsBudgets || []) {
    const locRowId = loc.$rowID;
    const budgetRef = resolveRelation(loc.budgetId);
    if (locRowId && budgetRef) {
      const ep = budgetEpisodeLookup.get(budgetRef);
      if (ep) locationBudgetEpisodeLookup.set(locRowId, ep);
    }
  }
  console.log(`[Budget] Location->episode lookup: ${locationBudgetEpisodeLookup.size} of ${(locationsBudgets || []).length} locations resolved to episodes`);

  // Build location lookup: $rowID -> location name
  const locationLookup = new Map();
  for (const loc of locationsBudgets || []) {
    const rowId = loc.$rowID;
    const name = loc.locationUserInput || loc.locationName || loc.Name;
    if (rowId && name) locationLookup.set(rowId, name);
  }
  console.log(`[Budget] Location lookup: ${locationLookup.size} locations`);

  const locEpMap = new Map();
  const epCatMap = new Map();
  let skippedCount = 0;
  let withDirectEpisode = 0;
  let withBudgetEpisode = 0;
  let withoutEpisode = 0;

  for (const li of budgetLineItems || []) {
    const amount = calculateLineItemTotal(li);
    if (amount === 0) {
      skippedCount++;
      continue;
    }

    const locationRef = resolveRelation(li.locationId);
    const locationName = locationLookup.get(locationRef) || 'Unknown';

    // Episode resolution priority:
    // 1. Direct episodeId on line item (most specific)
    // 2. Via location's budgetId -> Budgets table -> episode
    // 3. Via line item's own budgetId -> Budgets table -> episode
    // 4. Fall back to "all"
    let episodeName = 'all';

    const episodeRef = resolveRelation(li.episodeId);
    if (episodeRef) {
      const resolved = episodeLookup.get(episodeRef);
      if (resolved) {
        episodeName = resolved;
        withDirectEpisode++;
      }
    }

    if (episodeName === 'all' && locationRef) {
      const locEp = locationBudgetEpisodeLookup.get(locationRef);
      if (locEp) {
        episodeName = locEp;
        withBudgetEpisode++;
      }
    }

    if (episodeName === 'all') {
      const budgetRef = resolveRelation(li.budgetId);
      if (budgetRef) {
        const budgetEp = budgetEpisodeLookup.get(budgetRef);
        if (budgetEp) {
          episodeName = budgetEp;
          withBudgetEpisode++;
        }
      }
    }

    if (episodeName === 'all') withoutEpisode++;

    const category = normalizeCategory(li.category);

    const locEpKey = `${locationName}|${episodeName}`;
    if (!locEpMap.has(locEpKey)) {
      locEpMap.set(locEpKey, { location: locationName, episode: episodeName, totalBudget: 0 });
    }
    locEpMap.get(locEpKey).totalBudget += amount;

    const epCatKey = `${episodeName}|${category}`;
    if (!epCatMap.has(epCatKey)) {
      epCatMap.set(epCatKey, { episode: episodeName, category, totalBudget: 0 });
    }
    epCatMap.get(epCatKey).totalBudget += amount;
  }

  const byLocationEpisode = Array.from(locEpMap.values());
  const byEpisodeCategory = Array.from(epCatMap.values());

  const episodeTotals = {};
  for (const item of byLocationEpisode) {
    if (!episodeTotals[item.episode]) episodeTotals[item.episode] = 0;
    episodeTotals[item.episode] += item.totalBudget;
  }

  // Cross-check: compare calculated totals vs totalFromMake on parent records
  for (const loc of locationsBudgets || []) {
    const expectedTotal = parseFloat(loc.totalFromMake) || 0;
    if (expectedTotal > 0) {
      const locName = loc.locationUserInput || loc.locationName;
      const actualTotal = byLocationEpisode
        .filter(item => item.location === locName)
        .reduce((sum, item) => sum + item.totalBudget, 0);
      const diff = Math.abs(expectedTotal - actualTotal);
      if (diff > expectedTotal * 0.05) {
        console.warn(`[Budget] Total mismatch for ${locName}: expected $${expectedTotal.toFixed(2)}, calculated $${actualTotal.toFixed(2)} (diff: $${diff.toFixed(2)})`);
      }
    }
  }

  console.log(`[Budget] Transformed: ${byLocationEpisode.length} location-episodes, ${byEpisodeCategory.length} episode-categories, ${Object.keys(episodeTotals).length} episode groups`);
  console.log(`[Budget] Episode resolution: ${withDirectEpisode} direct episodeId, ${withBudgetEpisode} via budgetId chain, ${withoutEpisode} unresolved ("all"), ${skippedCount} zero-amount skipped`);

  return {
    byLocationEpisode,
    byEpisodeCategory,
    episodeTotals,
    metadata: {
      locationsBudgetCount: (locationsBudgets || []).length,
      lineItemCount: (budgetLineItems || []).length,
      lineItemsWithRate: (budgetLineItems || []).length - skippedCount,
      lineItemsWithDirectEpisode: withDirectEpisode,
      lineItemsWithBudgetEpisode: withBudgetEpisode,
      lineItemsWithoutEpisode: withoutEpisode,
      episodeCount: (episodes || []).length,
      budgetCount: (budgets || []).length,
      generatedAt: new Date().toISOString()
    }
  };
}
