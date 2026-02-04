import { writeJsonToS3, uploadFileToS3 } from './s3Utils.js';

/**
 * Write processed ledger data to S3
 *
 * @param {Object} results - Results from handleSync
 * @param {Object} sessionInfo - Session metadata
 * @param {Object} originalFiles - Original file buffers (optional, for archival)
 * @returns {Promise<Object>} Paths to written files in S3
 */
export async function writeProcessedLedger(results, sessionInfo, originalFiles = {}) {
  const timestamp = new Date().toISOString();
  const dateStr = timestamp.split('T')[0]; // YYYY-MM-DD
  const sessionSlug = (sessionInfo.sessionName || 'sync').replace(/[^a-zA-Z0-9]/g, '-');

  console.log(`[Write] Starting S3 write for session: ${sessionInfo.sessionName} (${sessionInfo.syncSessionId})`);

  const writtenPaths = {};

  try {
    // 1. Archive original ledger file to S3 (optional redundancy)
    if (originalFiles.ledgerBuffer && originalFiles.ledgerFilename) {
      const archiveKey = `archives/ledgers/${dateStr}-${sessionSlug}-${originalFiles.ledgerFilename}`;
      const archiveResult = await uploadFileToS3(
        archiveKey,
        originalFiles.ledgerBuffer,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      writtenPaths.archivedLedger = archiveResult;
      console.log(`[Write] Archived ledger to S3: ${archiveKey}`);
    }

    // 2. Archive original SmartPO file to S3 (optional redundancy)
    if (originalFiles.smartpoBuffer && originalFiles.smartpoFilename) {
      const archiveKey = `archives/smartpos/${dateStr}-${sessionSlug}-${originalFiles.smartpoFilename}`;
      const archiveResult = await uploadFileToS3(
        archiveKey,
        originalFiles.smartpoBuffer,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      writtenPaths.archivedSmartPO = archiveResult;
      console.log(`[Write] Archived SmartPO to S3: ${archiveKey}`);
    }

    // 3. Write parsed-ledgers-detailed.json to S3
    const detailedData = {
      totalFiles: results.ledgers?.totalFiles || 0,
      totalLineItems: results.ledgers?.ledgers?.reduce((sum, l) =>
        sum + (l.transactionCount || 0), 0) || 0,
      grandTotal: results.ledgers?.ledgers?.reduce((sum, l) => {
        const ledgerTotal = l.lineItems?.reduce((itemSum, item) =>
          itemSum + (item.amount || 0), 0) || 0;
        return sum + ledgerTotal;
      }, 0) || 0,
      ledgers: results.ledgers?.ledgers || [],
      lastUpdated: timestamp,
      syncSessionId: sessionInfo.syncSessionId,
      sessionName: sessionInfo.sessionName
    };

    const parsedLedgersKey = 'processed/parsed-ledgers-detailed.json';
    await writeJsonToS3(parsedLedgersKey, detailedData);
    writtenPaths.parsedLedgers = { key: parsedLedgersKey };
    console.log(`[Write] Wrote parsed ledgers: ${detailedData.totalLineItems} transactions, $${detailedData.grandTotal.toFixed(2)} total`);

    // 4. Write processing queue entry
    const queueKey = `queues/weekly-sync-${Date.now()}.json`;
    const queueEntry = {
      timestamp,
      sessionId: sessionInfo.syncSessionId,
      sessionName: sessionInfo.sessionName,
      summary: results.summary,
      reviewItems: results.reviewItems || [],
      locations: {
        matched: results.locations?.stats?.matchedCount || 0,
        needsReview: (results.locations?.needsMapping?.length || 0) +
                     (results.locations?.needsGlideEntry?.length || 0),
        total: results.locations?.stats?.totalLocations || 0
      },
      vendors: {
        matched: results.vendors?.matched?.length || 0,
        needsReview: (results.vendors?.lowConfidence?.length || 0) +
                     (results.vendors?.newVendors?.length || 0)
      },
      success: results.success,
      s3Bucket: process.env.AWS_S3_BUCKET || 'location-manager-prod'
    };

    await writeJsonToS3(queueKey, queueEntry);
    writtenPaths.queueEntry = { key: queueKey };
    console.log(`[Write] Created queue entry: ${queueKey}`);

    // 5. Write latest sync summary (for quick access)
    const summaryKey = 'processed/latest-sync-summary.json';
    const latestSummary = {
      timestamp,
      sessionId: sessionInfo.syncSessionId,
      sessionName: sessionInfo.sessionName,
      transactions: detailedData.totalLineItems,
      grandTotal: detailedData.grandTotal,
      locationsMatched: queueEntry.locations.matched,
      vendorsMatched: queueEntry.vendors.matched,
      status: results.success ? 'success' : 'error'
    };

    await writeJsonToS3(summaryKey, latestSummary);
    writtenPaths.latestSummary = { key: summaryKey };
    console.log(`[Write] Updated latest summary`);

    console.log(`[Write] S3 write complete - ${Object.keys(writtenPaths).length} files written`);

    return {
      success: true,
      bucket: process.env.AWS_S3_BUCKET || 'location-manager-prod',
      paths: writtenPaths
    };

  } catch (error) {
    console.error(`[Write] Error writing data to S3:`, error);
    throw new Error(`Failed to write data to S3: ${error.message}`);
  }
}
