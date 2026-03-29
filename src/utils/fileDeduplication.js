/**
 * File Deduplication - Track processed files to prevent duplicate processing
 */

import { readJsonFromS3, writeJsonToS3 } from './s3Utils.js';
import crypto from 'crypto';

/**
 * Generate hash for file content
 * @param {Buffer} buffer - File buffer
 * @returns {string} SHA256 hash
 */
export function generateFileHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Check if file has been processed before
 * @param {string} fileHash - File content hash
 * @param {string} fileName - Original filename
 * @returns {Promise<{isDuplicate: boolean, previousSync?: object}>}
 */
export async function checkFileProcessed(fileHash, fileName) {
  try {
    const registry = await readJsonFromS3('processed-files-registry.json');

    if (registry.files && registry.files[fileHash]) {
      return {
        isDuplicate: true,
        previousSync: registry.files[fileHash]
      };
    }

    return { isDuplicate: false };
  } catch (e) {
    // Registry doesn't exist yet - first run
    if (e.message?.includes('NoSuchKey') || e.message?.includes('does not exist')) {
      return { isDuplicate: false };
    }
    console.error('[Dedup] Error checking file registry:', e.message);
    return { isDuplicate: false }; // Fail open - allow processing
  }
}

/**
 * Mark file as processed
 * @param {string} fileHash - File content hash
 * @param {string} fileName - Original filename
 * @param {object} metadata - Sync metadata (syncSessionId, timestamp, etc.)
 */
export async function markFileProcessed(fileHash, fileName, metadata = {}) {
  try {
    let registry;
    try {
      registry = await readJsonFromS3('processed-files-registry.json');
    } catch (e) {
      // Initialize registry if doesn't exist
      registry = {
        version: '1.0',
        createdAt: new Date().toISOString(),
        files: {}
      };
    }

    registry.files[fileHash] = {
      fileName,
      processedAt: new Date().toISOString(),
      ...metadata
    };

    await writeJsonToS3('processed-files-registry.json', registry);
    console.log(`[Dedup] Marked file as processed: ${fileName} (hash: ${fileHash.substring(0, 8)}...)`);
  } catch (e) {
    console.error('[Dedup] Error marking file as processed:', e.message);
    // Don't throw - dedup is best-effort
  }
}

/**
 * Get file type from filename and folder path
 * @param {string} fileName - Filename
 * @param {string} folderPath - Google Drive folder path (optional)
 * @returns {string} One of: LEDGER, SMARTPO, INVOICE, CHECK_REQUEST, UNKNOWN
 */
export function classifyFileType(fileName, folderPath = '') {
  const nameLower = fileName.toLowerCase();
  const pathLower = folderPath.toLowerCase();

  // Ledger files: Episode pattern + GL accounts
  if (/\d{3}\s+6304-6342/.test(fileName)) {
    return 'LEDGER';
  }

  // SmartPO exports
  if (nameLower.startsWith('po-log') || nameLower.includes('purchase') && nameLower.includes('order')) {
    return 'SMARTPO';
  }

  // Folder-based classification
  if (pathLower.includes('/ledgers/') || pathLower.includes('/accounting')) {
    return 'LEDGER';
  }
  if (pathLower.includes('/pos/') || pathLower.includes('/purchase')) {
    return 'SMARTPO';
  }
  if (pathLower.includes('/invoices/')) {
    return 'INVOICE';
  }
  if (pathLower.includes('/check') && pathLower.includes('request')) {
    return 'CHECK_REQUEST';
  }

  return 'UNKNOWN';
}
