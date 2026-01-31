const express = require('express');
const router = express.Router();
const glide = require('@glideapps/tables');

// Glide API Configuration
const GLIDE_APP_ID = process.env.GLIDE_APP_ID || 'TFowqRmlJ8sMhdap17C0';
const GLIDE_TOKEN = process.env.GLIDE_TOKEN || 'ad54fb67-06fe-40b1-a87d-565a003c3f49';

// Table IDs from The Shards Glide app (verified 2025-01-25)
const TABLES = {
  locations: 'native-table-PRIIMzLmQiCVsRIfzYEa',
  purchaseOrders: 'native-table-fo5Seg62UynLTbmFbEmZ',
  invoices: 'native-table-1rujyipHG8Zv1PVWdmpf',
  checkRequests: 'native-table-7qA0wApval6ZMwuT4JeX',
  budgetLineItems: 'native-table-K4VWicYrUQZwN5Jqrzfq',
  budgets: 'native-table-NVCyYvHOwu5Y4O6Z1i32'
};

// Fetch data from Glide table using @glideapps/tables
async function fetchGlideTable(tableId) {
  const table = glide.table({
    token: GLIDE_TOKEN,
    app: GLIDE_APP_ID,
    table: tableId,
    columns: {} // Empty = get all columns
  });

  const rows = await table.get();
  return rows || [];
}

// GET /api/glide/sync - Fetch all data from Glide
router.get('/sync', async (req, res) => {
  try {
    console.log('Syncing data from Glide...');

    // Fetch all tables in parallel
    const [locations, budgetLineItems, budgets, purchaseOrders, invoices, checkRequests] = await Promise.all([
      fetchGlideTable(TABLES.locations),
      fetchGlideTable(TABLES.budgetLineItems),
      fetchGlideTable(TABLES.budgets),
      fetchGlideTable(TABLES.purchaseOrders),
      fetchGlideTable(TABLES.invoices),
      fetchGlideTable(TABLES.checkRequests)
    ]);

    // Calculate summary stats
    const totalBudget = budgetLineItems.reduce((sum, item) => {
      const amount = parseFloat(item['Sub Total'] || item['subTotal'] || 0);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    const totalPOs = purchaseOrders.reduce((sum, po) => {
      const amount = parseFloat(po['Amount'] || po['amount'] || 0);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    const totalInvoices = invoices.reduce((sum, inv) => {
      const amount = parseFloat(inv['Amount'] || inv['amount'] || 0);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      counts: {
        locations: locations.length,
        budgetLineItems: budgetLineItems.length,
        budgets: budgets.length,
        purchaseOrders: purchaseOrders.length,
        invoices: invoices.length,
        checkRequests: checkRequests.length
      },
      summary: {
        totalBudget,
        totalPOs,
        totalInvoices,
        totalActual: totalPOs + totalInvoices
      },
      data: {
        locations,
        budgetLineItems,
        budgets,
        purchaseOrders,
        invoices,
        checkRequests
      }
    });
  } catch (error) {
    console.error('Glide sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/glide/locations - Fetch locations with budget data
router.get('/locations', async (req, res) => {
  try {
    console.log('Fetching locations from Glide...');

    const [locations, budgetLineItems, purchaseOrders] = await Promise.all([
      fetchGlideTable(TABLES.locations),
      fetchGlideTable(TABLES.budgetLineItems),
      fetchGlideTable(TABLES.purchaseOrders)
    ]);

    console.log(`Fetched: ${locations.length} locations, ${budgetLineItems.length} budget items, ${purchaseOrders.length} POs`);

    // Group budget items by location
    const budgetByLocation = {};
    budgetLineItems.forEach(item => {
      // Try multiple possible column names
      const locationName = item['Locations/Location Name'] ||
                          item['Location Name'] ||
                          item['locationName'] ||
                          item['Name'] ||
                          'Unknown';
      if (!budgetByLocation[locationName]) {
        budgetByLocation[locationName] = { budget: 0, items: [] };
      }
      const amount = parseFloat(item['Sub Total'] || item['subTotal'] || item['Amount'] || 0);
      if (!isNaN(amount)) {
        budgetByLocation[locationName].budget += amount;
        budgetByLocation[locationName].items.push(item);
      }
    });

    // Group POs by location
    const actualByLocation = {};
    purchaseOrders.forEach(po => {
      const locationName = po['Location'] ||
                          po['location'] ||
                          po['Location Name'] ||
                          po['locationName'] ||
                          'Unknown';
      if (!actualByLocation[locationName]) {
        actualByLocation[locationName] = { actual: 0, items: [] };
      }
      const amount = parseFloat(po['Amount'] || po['amount'] || po['Total'] || 0);
      if (!isNaN(amount)) {
        actualByLocation[locationName].actual += amount;
        actualByLocation[locationName].items.push(po);
      }
    });

    // Combine into location cards
    const locationCards = locations.map(loc => {
      const name = loc['Location Name'] ||
                  loc['locationName'] ||
                  loc['Name'] ||
                  loc['name'] ||
                  'Unknown';
      const budget = budgetByLocation[name]?.budget || 0;
      const actual = actualByLocation[name]?.actual || 0;
      const variance = budget - actual;

      return {
        id: loc.$rowID || loc.id || Math.random().toString(36).substr(2, 9),
        name,
        budget,
        actual,
        variance,
        isOverBudget: variance < 0,
        budgetItems: budgetByLocation[name]?.items?.length || 0,
        actualItems: actualByLocation[name]?.items?.length || 0
      };
    });

    // Sort by actual spend (highest first)
    locationCards.sort((a, b) => b.actual - a.actual);

    const summary = {
      totalLocations: locationCards.length,
      totalBudget: locationCards.reduce((sum, l) => sum + l.budget, 0),
      totalActual: locationCards.reduce((sum, l) => sum + l.actual, 0),
      overBudgetCount: locationCards.filter(l => l.isOverBudget).length
    };

    console.log('Summary:', summary);

    res.json({
      success: true,
      locations: locationCards,
      summary
    });
  } catch (error) {
    console.error('Glide locations error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/glide/budgets - Fetch budget comparison data
router.get('/budgets', async (req, res) => {
  try {
    const [budgets, budgetLineItems] = await Promise.all([
      fetchGlideTable(TABLES.budgets),
      fetchGlideTable(TABLES.budgetLineItems)
    ]);

    // Group by episode
    const byEpisode = {};
    budgetLineItems.forEach(item => {
      const episode = item['Budgets/Episode #'] || item['Episode'] || item['episode'] || 'Unknown';
      if (!byEpisode[episode]) {
        byEpisode[episode] = { budget: 0, items: [] };
      }
      const amount = parseFloat(item['Sub Total'] || item['subTotal'] || 0);
      if (!isNaN(amount)) {
        byEpisode[episode].budget += amount;
        byEpisode[episode].items.push(item);
      }
    });

    const episodes = Object.entries(byEpisode).map(([episode, data]) => ({
      episode,
      budget: data.budget,
      itemCount: data.items.length
    })).sort((a, b) => a.episode.localeCompare(b.episode));

    res.json({
      success: true,
      budgets,
      episodes,
      totalBudget: episodes.reduce((sum, e) => sum + e.budget, 0)
    });
  } catch (error) {
    console.error('Glide budgets error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
