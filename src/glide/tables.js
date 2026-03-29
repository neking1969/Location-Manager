/**
 * Glide Table Definitions
 * Auto-generated from Glide app schema
 * App: The Shards: Season 1 (TFowqRmlJ8sMhdap17C0)
 */

// ============ TABLE IDs ============
export const TABLE_IDS = {
  BUDGETS: 'native-table-NVCyYvHOwu5Y4O6Z1i32',
  VENDORS: 'native-table-lmMcRP53QnXU3DnL6Byk',
  LOCATIONS_BUDGETS: 'native-table-2JZRLDBX5ZWikodKHz6P',
  LOCATIONS_MASTER: 'native-table-PRIIMzLmQiCVsRIfzYEa',
  EPISODES: 'native-table-SL98RSbiMVL7B63GetA8',
  CHECK_REQUESTS: 'native-table-7qA0wApval6ZMwuT4JeX',
  BUDGET_LINE_ITEMS: 'native-table-K4VWicYrUQZwN5Jqrzfq',
  PERMITS: 'native-table-3KOJwq5ixiqBXx3saPGl',
  SYNC_SESSIONS: 'native-table-03Yk3buCk0yZOF5dzh4i'
};

// ============ COLUMN MAPPINGS ============

export const COLUMNS = {
  // Budgets table columns
  BUDGETS: {
    episode: 'Name',
    episodeId: '6eqIy',
    total: 'YQnMt',
    totalCosts: 'N5cHA',
  },

  // Vendors table columns
  VENDORS: {
    vendor: 'EXJz0',
    logo: '681hl',
    isPreferred: '9vAOW',
    websiteUrl: 'UyI0H',
    newId: 'LxRPd',
    contactsId: 'SSWrd',
    contact: 'SMUD8',
    address: 'q9AgP',
    city: '7HGYk',
    state: 'LPIKG',
    zip: 'bEgQA',
    category: 'VnRHO',
    email: 'IjiHB',
    phoneCell: 'y8dnI',
    phoneOffice: 'PQYEf',
    phoneFax: 'nY8Vp',
    phoneType: 'kWj9p',
    notes: 'ugNBw',
    license: '6A6lt',
    poNumber: 'py6yH',
    location: 'tFz2I',
    episode: 'luLpL',
    description: 'HoMxw',
    amount: 'vJABk',
    status: 'vxUkd',
    dateCreated: '4FzxB',
    dateApproved: 'ap6yr',
    approvedBy: 'JNbEJ'
  },

  // Locations/Budgets table columns
  LOCATIONS_BUDGETS: {
    locationName: 'Name', // locationSmugmugLocationNameFolder
    locationUserInput: 'i2lsd',
    budgetId: 'rv4rj',
    newBudgetId: 'sEt47',
    oldBudgetId: 'DqezA',
    generatingLineItems: 'ugZyb',
    movingBudgetLineItems: 'jvGsn',
    showFormToAddNewLocations: 'JUaMR',
    totalFromMake: 'fXQS9',
    locationNameFromMake: 'nGHXO',
    googleSpreadsheetId: 'YoZK1',
    googleSheetId: 'e8b7n',
    summaryRow: 'f2iYk',
    lastAddedLocationId: 'CXh8Z',
    nameId: 'U72cC',
    locationsId: '1I3tc',
    projectId: 'RmXJ0',
    budgetLineItems: 'M2bDw',
    locationCsvLinks: 'j39jk',
    locationCoverImage: 'x8NWt',
    locationStatus: 'SXLjt',
    locationSet: 'XdUqd',
    locationAddress: '7GIxj',
    locationCity: 'fCvuz',
    locationState: 'e3iXH',
    locationZip: 'vPejZ',
    locationPriceLow: 'F7uaX',
    locationPriceHigh: 'UP8kv',
    locationCsv: 'l4w3N',
    locationSmugmugLink: 'gOoIL',
    smugmugLink: 'Om00c',
    generatingNewLocationLineItems: 'WqVGN'
  },

  // Locations Master List table columns
  LOCATIONS_MASTER: {
    locationName: 'Name', // locationNameLocationsMasterList
    assignedToPerson: 'whHD7',
    showForm: '1c8I6',
    budgetId: 'rv4rj',
    budgetLineItems: 'M2bDw',
    projectId: 'RmXJ0',
    nameId: 'U72cC',
    locationAddress: '7GIxj',
    locationCity: 'fCvuz',
    locationState: 'e3iXH',
    locationZip: 'vPejZ',
    locationPriceLow: 'F7uaX',
    locationPriceHigh: 'UP8kv',
    locationCoverImage: 'x8NWt',
    locationCsv: 'l4w3N',
    locationStatus: 'SXLjt',
    locationSmugmugLink: 'gOoIL',
    locationSet: 'XdUqd',
    locationUserInput: 'i2lsd',
    locationCsvLinks: 'j39jk',
    editLineItemsNewBudget: 'SiyC3',
    editLineItemsCurrentBudget: 'jSPGh',
    editLineItemsResponseBody: 'KwuxR',
    removeFromBudgetNewArray: 'cnx36'
  },

  // Episodes table columns
  EPISODES: {
    episode: 'Name',
    projectId: 'L9wpp',
    budgetId: 'vhq9m',
    locationsId: 'ooSfI',
    budgetLineItemsIDs: '7Shb6'
  },

  // Check Requests table columns
  CHECK_REQUESTS: {
    name: 'Name',
    crNumber: '4rrRi',
    location: 'yJRbm',
    episode: 'hP96r',
    vendor: 'Sqve5',
    description: 'Gi9i2',
    category: 'KbBUV',
    amount: 'lKc8Z',
    status: 'Dhatt',
    dateRequested: 'VjKQd',
    dateNeeded: 'umHt6',
    dateIssued: 'buO7a',
    checkNumber: 'FQNhB',
    payeeName: 'Rek8z',
    notes: '42m4l'
  },

  // Budget Line Items table columns
  BUDGET_LINE_ITEMS: {
    dateAdded: 'uRQVm',
    row: 'yEXUN',
    category: 'axJaC',
    itemName: 'Name',
    time: '49vJA',
    rate: 'uaFVK',
    unit: 'JaojI',
    locationId: 'IskVn',
    budgetId: 'JLpWO',
    projectId: '4KBt9',
    episodeId: 'SuERh',
    nameId: 'URxho'
  },

  // Sync Sessions table columns (Weekly Sync file uploads)
  SYNC_SESSIONS: {
    name: 'Name',
    ledgerFile: 'ledgerFile',
    smartpoFile: 'smartpoFile',
    status: '8v4u7',
    syncDate: 'eoSi2',
    recordsProcessed: 'Ys6ff',
    errors: '60vZb',
    notes: 'ESsUc'
  },

  // Permits table columns (synced from FilmLA via Airtable)
  PERMITS: {
    permitType: 'remote\u001dfld3bs5GHXyVBetl5',
    processingStatus: 'remote\u001dfldX3brsgcYIBT7hM',
    processedDate: 'remote\u001dfldlxEfLkezeDNrZS',
    releaseDate: 'remote\u001dfldpAxCxx8PkOy7dU',
    productionTitle: 'remote\u001dfldNPQSRAfI0kDErV',
    producer: 'remote\u001dfldAPVj9Cl8QXwX2A',
    productionCompany: 'remote\u001dfldF4hMb5u0ZyzujX',
    director: 'remote\u001dfld85Ltb4UTKbLrLl',
    locationManager: 'remote\u001dfldkVXQZtQcO5aut7',
    contactPhone: 'remote\u001dfld6fOPWdr5hIEuZK',
    totalFee: 'remote\u001dfldiDAa5nA4SckimO',
    invoiceNumber: 'remote\u001dfld9mjrvrdERceGtl',
    paymentStatus: 'remote\u001dfld56VOIYvHZeQJY1',
    // Location 1
    loc1Address: 'remote\u001dfldah2BkAVkPwkHAf',
    loc1Type: 'remote\u001dfldn8p8hEtuBkTvUT',
    loc1DatesStart: 'remote\u001dfldEOV3pJ3RvbQ5ml',
    loc1DatesEnd: 'remote\u001dfldgtRxbeePlyzYYd',
    // Add more permit fields as needed
    permit: 'remote\u001dfldt1iAWdglCJZGFU',
    json: 'remote\u001dfldfSoR6eLsGIHubY'
  }
};

// ============ HELPER FUNCTIONS ============

/**
 * Get table ID by friendly name
 */
export function getTableId(tableName) {
  const key = tableName.toUpperCase().replace(/[\s-]/g, '_');
  return TABLE_IDS[key] || null;
}

/**
 * Get column ID for a table field
 */
export function getColumnId(tableName, fieldName) {
  const tableKey = tableName.toUpperCase().replace(/[\s-]/g, '_');
  const columns = COLUMNS[tableKey];
  return columns ? columns[fieldName] : null;
}

/**
 * Transform row data from friendly names to Glide column IDs
 */
export function toGlideRow(tableName, data) {
  const tableKey = tableName.toUpperCase().replace(/[\s-]/g, '_');
  const columns = COLUMNS[tableKey];
  if (!columns) return data;

  const transformed = {};
  for (const [key, value] of Object.entries(data)) {
    const columnId = columns[key] || key;
    transformed[columnId] = value;
  }
  return transformed;
}

/**
 * Transform row data from Glide column IDs to friendly names
 */
export function fromGlideRow(tableName, row) {
  const tableKey = tableName.toUpperCase().replace(/[\s-]/g, '_');
  const columns = COLUMNS[tableKey];
  if (!columns) return row;

  // Create reverse mapping
  const reverseMap = {};
  for (const [friendly, columnId] of Object.entries(columns)) {
    reverseMap[columnId] = friendly;
  }

  const transformed = {};
  for (const [key, value] of Object.entries(row)) {
    const friendlyName = reverseMap[key] || key;
    transformed[friendlyName] = value;
  }
  return transformed;
}

export default {
  TABLE_IDS,
  COLUMNS,
  getTableId,
  getColumnId,
  toGlideRow,
  fromGlideRow
};
