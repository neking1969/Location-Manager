/**
 * Glide API Client - Handles all Glide table operations
 */

import { TABLE_IDS, COLUMNS, toGlideRow, fromGlideRow } from './tables.js';

const GLIDE_API_BASE = 'https://api.glideapp.io';

/**
 * GlideClient class for interacting with Glide Big Tables API
 */
export class GlideClient {
  constructor(apiKey, appId) {
    this.apiKey = apiKey;
    this.appId = appId;
  }

  /**
   * Make an authenticated request to Glide API
   */
  async request(endpoint, options = {}) {
    const url = `${GLIDE_API_BASE}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Glide API error: ${response.status} - ${error}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  /**
   * Query tables using the Glide Big Tables API
   */
  async queryTables(queries) {
    const response = await this.request('/api/function/queryTables', {
      method: 'POST',
      body: JSON.stringify({
        appID: this.appId,
        queries
      })
    });
    return response;
  }

  /**
   * Get all rows from a table
   */
  async getTableRows(tableName) {
    const results = await this.queryTables([{ tableName }]);
    return results?.[0]?.rows || [];
  }

  /**
   * Add a row to a table using mutateTables API
   */
  async addRow(tableName, data) {
    return this.request('/api/function/mutateTables', {
      method: 'POST',
      body: JSON.stringify({
        appID: this.appId,
        mutations: [{
          kind: 'add-row-to-table',
          tableName,
          columnValues: data
        }]
      })
    });
  }

  /**
   * Update a row in a table using mutateTables API
   */
  async updateRow(tableName, rowId, data) {
    return this.request('/api/function/mutateTables', {
      method: 'POST',
      body: JSON.stringify({
        appID: this.appId,
        mutations: [{
          kind: 'set-columns-in-row',
          tableName,
          rowID: rowId,
          columnValues: data
        }]
      })
    });
  }

  /**
   * Delete a row from a table using mutateTables API
   */
  async deleteRow(tableName, rowId) {
    return this.request('/api/function/mutateTables', {
      method: 'POST',
      body: JSON.stringify({
        appID: this.appId,
        mutations: [{
          kind: 'delete-row',
          tableName,
          rowID: rowId
        }]
      })
    });
  }

  /**
   * Batch add rows (with rate limiting)
   */
  async batchAddRows(tableName, rows, batchSize = 50) {
    const results = [];

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const mutations = batch.map(row => ({
        kind: 'add-row-to-table',
        tableName,
        columnValues: row
      }));

      try {
        const result = await this.request('/api/function/mutateTables', {
          method: 'POST',
          body: JSON.stringify({
            appID: this.appId,
            mutations
          })
        });
        results.push(...batch.map(() => ({ success: true })));
      } catch (e) {
        results.push(...batch.map(row => ({ error: e.message, row })));
      }

      if (i + batchSize < rows.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  // ============ Table-specific methods ============

  /**
   * Get all locations from Glide (using Locations Master List)
   */
  async getLocations() {
    const rows = await this.getTableRows(TABLE_IDS.LOCATIONS_MASTER);
    return rows.map(row => fromGlideRow('LOCATIONS_MASTER', row));
  }

  /**
   * Get all vendors from Glide
   */
  async getVendors() {
    const rows = await this.getTableRows(TABLE_IDS.VENDORS);
    return rows.map(row => fromGlideRow('VENDORS', row));
  }

  /**
   * Get all budget line items from Glide
   */
  async getBudgetLineItems() {
    const rows = await this.getTableRows(TABLE_IDS.BUDGET_LINE_ITEMS);
    return rows.map(row => fromGlideRow('BUDGET_LINE_ITEMS', row));
  }

  /**
   * Get all episodes from Glide
   */
  async getEpisodes() {
    const rows = await this.getTableRows(TABLE_IDS.EPISODES);
    return rows.map(row => fromGlideRow('EPISODES', row));
  }

  /**
   * Get all budgets from Glide
   */
  async getBudgets() {
    const rows = await this.getTableRows(TABLE_IDS.BUDGETS);
    return rows.map(row => fromGlideRow('BUDGETS', row));
  }

  /**
   * Get all locations budgets from Glide (parent records for budget line items)
   */
  async getLocationsBudgets() {
    const rows = await this.getTableRows(TABLE_IDS.LOCATIONS_BUDGETS);
    return rows.map(row => fromGlideRow('LOCATIONS_BUDGETS', row));
  }

  /**
   * Add new location to Glide
   */
  async addLocation(location) {
    const glideData = toGlideRow('LOCATIONS_MASTER', {
      locationName: location.name,
      locationAddress: location.address,
      locationCity: location.city,
      locationState: location.state,
      locationStatus: location.status || 'Active'
    });
    return this.addRow(TABLE_IDS.LOCATIONS_MASTER, glideData);
  }

  /**
   * Add new vendor to Glide
   */
  async addVendor(vendor) {
    const glideData = toGlideRow('VENDORS', {
      vendor: vendor.name,
      contact: vendor.contact,
      phoneCell: vendor.phone,
      email: vendor.email,
      address: vendor.address,
      city: vendor.city,
      state: vendor.state,
      category: vendor.category
    });
    return this.addRow(TABLE_IDS.VENDORS, glideData);
  }

  /**
   * Update budget actuals
   */
  async updateBudgetActual(rowId, actual, lastUpdated) {
    return this.updateRow(TABLE_IDS.BUDGET_LINE_ITEMS, rowId, {
      [COLUMNS.BUDGET_LINE_ITEMS.actual]: actual,
      [COLUMNS.BUDGET_LINE_ITEMS.dateAdded]: lastUpdated
    });
  }

  /**
   * Add check request
   */
  async addCheckRequest(checkRequest) {
    const glideData = toGlideRow('CHECK_REQUESTS', {
      name: checkRequest.name,
      location: checkRequest.location,
      episode: checkRequest.episode,
      vendor: checkRequest.vendor,
      description: checkRequest.description,
      category: checkRequest.category,
      amount: checkRequest.amount,
      status: checkRequest.status || 'Pending',
      dateRequested: checkRequest.dateRequested || new Date().toISOString()
    });
    return this.addRow(TABLE_IDS.CHECK_REQUESTS, glideData);
  }

  /**
   * Test connection by querying for tables
   */
  async testConnection() {
    try {
      await this.queryTables([{ tableName: TABLE_IDS.LOCATIONS_MASTER, limit: 1 }]);
      return { success: true, message: 'Connected to Glide API' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

/**
 * Create a Glide client from environment variables
 */
export function createGlideClient() {
  const apiKey = process.env.GLIDE_API_KEY;
  const appId = process.env.GLIDE_APP_ID;

  if (!apiKey || !appId) {
    throw new Error('GLIDE_API_KEY and GLIDE_APP_ID must be set');
  }

  return new GlideClient(apiKey, appId);
}

// Re-export table definitions for convenience
export { TABLE_IDS, COLUMNS, toGlideRow, fromGlideRow } from './tables.js';

export default {
  GlideClient,
  createGlideClient,
  TABLE_IDS,
  COLUMNS
};
