import { handleSync, handleApproval } from '../src/api/sync.js';
import { downloadFile } from '../src/utils/downloadFile.js';

export async function handler(event, context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
