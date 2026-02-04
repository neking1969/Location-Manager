import { handleSync, handleApproval } from '../src/api/sync.js';
import { downloadFile } from '../src/utils/downloadFile.js';
import { writeJsonToS3, readJsonFromS3 } from '../src/utils/s3Utils.js';

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
