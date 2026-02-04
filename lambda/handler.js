import { handleSync, handleApproval } from '../src/api/sync.js';
import { downloadFile } from '../src/utils/downloadFile.js';
import { writeJsonToS3, readJsonFromS3 } from '../src/utils/s3Utils.js';

const GL_TO_BUDGET_CATEGORY = {
  '6304': 'Security',
  '6305': 'Police',
  '6307': 'Fire',
  '6342': 'Loc Fees'
};

function generateComparison(budgets, ledgers) {
  const comparison = {};

  for (const item of budgets.byEpisodeCategory || []) {
    if (!['Security', 'Police', 'Fire', 'Loc Fees', 'Permits', 'Parking'].includes(item.category)) continue;
    const key = `${item.episode}|${item.category}`;
    if (!comparison[key]) {
      comparison[key] = {
        episode: item.episode,
        category: item.category,
        budget: 0,
        actual: 0,
        isGlCategory: true
      };
    }
    comparison[key].budget += item.totalBudget;
  }

  for (const ledger of ledgers.ledgers || []) {
    for (const txn of ledger.transactions || []) {
      const glAccount = txn.transNumber?.substring(0, 4);
      const category = GL_TO_BUDGET_CATEGORY[glAccount];
      if (!category) continue;
      const episode = txn.episode || ledger.episode;
      if (!episode || episode === 'unknown') continue;
      const key = `${episode}|${category}`;
      if (!comparison[key]) {
        comparison[key] = {
          episode,
          category,
          budget: 0,
          actual: 0,
          isGlCategory: true,
          glAccount
        };
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

    let result;
    if (path.includes('/sync')) {
      const syncInput = {};

      if (body.ledgerFileUrl) {
        console.log('[Handler] Downloading ledger file from URL:', body.ledgerFileUrl);
        const ledgerFile = await downloadFile(body.ledgerFileUrl);
        syncInput.ledgerFiles = [ledgerFile];
        console.log('[Handler] Ledger file downloaded:', ledgerFile.filename, ledgerFile.buffer.length, 'bytes');
      }

      if (body.smartpoFileUrl) {
        try {
          console.log('[Handler] Downloading SmartPO file from URL:', body.smartpoFileUrl);
          syncInput.smartpoFile = await downloadFile(body.smartpoFileUrl);
          console.log('[Handler] SmartPO file downloaded:', syncInput.smartpoFile.filename);
        } catch (e) {
          console.warn('[Handler] SmartPO download failed (optional):', e.message);
        }
      }

      syncInput.options = body.options;
      syncInput.locationMappings = body.locationMappings;

      result = await handleSync(syncInput);
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
    } else if (path.includes('/data')) {
      const ledgers = await readJsonFromS3('processed/parsed-ledgers-detailed.json').catch(() => null);
      const budgets = await readJsonFromS3('static/parsed-budgets.json').catch(() => null);

      let comparison = null;
      if (budgets && ledgers) {
        comparison = generateComparison(budgets, ledgers);
      }

      if (ledgers?.ledgers && Array.isArray(ledgers.ledgers)) {
        const latestLedgers = {};
        for (const ledger of ledgers.ledgers) {
          const key = `${ledger.episode}-${ledger.account}`;
          if (!latestLedgers[key] || ledger.reportDate > latestLedgers[key].reportDate) {
            latestLedgers[key] = ledger;
          }
        }
        ledgers.ledgers = Object.values(latestLedgers);
        ledgers.deduplicationApplied = true;
        ledgers.originalCount = ledgers.totalLineItems;
        ledgers.deduplicatedCount = Object.keys(latestLedgers).length;
      }

      result = { comparison, budgets, ledgers };
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
