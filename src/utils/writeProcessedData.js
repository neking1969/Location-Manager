import { writeJsonToS3, readJsonFromS3, uploadFileToS3 } from './s3Utils.js';

/**
 * Merge ledgers by deduplicating transactions at the txId level
 * instead of overwriting entire ledgers by episode-account key.
 *
 * This ensures that when the same episode-account combo is uploaded twice,
 * old transactions are preserved and only new unique transactions are added.
 *
 * @param {Array} existingLedgers - Ledgers currently in S3
 * @param {Array} newLedgers - Newly uploaded ledgers
 * @returns {Array} Merged ledgers with deduplicated transactions
 */
function mergeLedgers(existingLedgers, newLedgers) {
  // Step 1: Flatten all transactions from all ledgers (existing + new)
  const allTransactions = new Map(); // Map<txId, transaction>

  // Add existing transactions
  for (const ledger of existingLedgers) {
    for (const tx of ledger.transactions || []) {
      if (tx.txId) {
        allTransactions.set(tx.txId, tx);
      }
    }
  }

  // Add new transactions (deduplicates automatically via Map)
  for (const ledger of newLedgers) {
    for (const tx of ledger.transactions || []) {
      if (tx.txId) {
        allTransactions.set(tx.txId, tx);
      }
    }
  }

  // Build metadata lookup from source ledgers (filename, reportDate, parsedAt)
  const metadataByEpisode = new Map();
  for (const ledger of [...newLedgers, ...existingLedgers]) {
    const ep = ledger.episode || 'unknown';
    if (!metadataByEpisode.has(ep) || ledger.filename) {
      metadataByEpisode.set(ep, {
        filename: ledger.filename,
        reportDate: ledger.reportDate,
        parsedAt: ledger.parsedAt,
      });
    }
  }

  // Step 2: Rebuild ledger structure by grouping transactions by episode-account
  const ledgerMap = new Map(); // Map<"episode-account", ledger>

  for (const tx of allTransactions.values()) {
    const episode = tx.episode || 'unknown';
    const account = tx.glAccount?.substring(0, 4) || 'unknown';
    const key = `${episode}-${account}`;

    if (!ledgerMap.has(key)) {
      const meta = metadataByEpisode.get(episode) || {};
      ledgerMap.set(key, {
        episode,
        account,
        filename: meta.filename,
        reportDate: meta.reportDate,
        parsedAt: meta.parsedAt,
        transactions: [],
        transactionCount: 0
      });
    }

    const ledger = ledgerMap.get(key);
    ledger.transactions.push(tx);
  }

  // Step 3: Update transaction counts for each ledger
  for (const ledger of ledgerMap.values()) {
    ledger.transactionCount = ledger.transactions.length;
  }

  return Array.from(ledgerMap.values());
}

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
    // 1. Archive original ledger file(s) to S3 (optional redundancy)
    if (originalFiles.ledgerFiles && originalFiles.ledgerFiles.length > 0) {
      writtenPaths.archivedLedgers = [];
      for (const file of originalFiles.ledgerFiles) {
        const archiveKey = `archives/ledgers/${dateStr}-${sessionSlug}-${file.filename}`;
        const archiveResult = await uploadFileToS3(
          archiveKey,
          file.buffer,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        writtenPaths.archivedLedgers.push(archiveResult);
        console.log(`[Write] Archived ledger to S3: ${archiveKey}`);
      }
    } else if (originalFiles.ledgerBuffer && originalFiles.ledgerFilename) {
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

    // 3. Read existing ledgers from S3, archive before merging, then merge
    const parsedLedgersKey = 'processed/parsed-ledgers-detailed.json';
    let existingLedgers = [];
    let existingData = null;
    try {
      existingData = await readJsonFromS3(parsedLedgersKey);
      existingLedgers = existingData.ledgers || [];
      console.log(`[Write] Read ${existingLedgers.length} existing ledgers from S3`);

      // Archive existing transaction data BEFORE merging (safety backup)
      if (existingLedgers.length > 0) {
        const archiveKey = `archives/transactions/${dateStr}-${sessionSlug}-pre-merge.json`;
        await writeJsonToS3(archiveKey, existingData);
        writtenPaths.archivedTransactions = { key: archiveKey };
        console.log(`[Write] Archived ${existingLedgers.length} existing ledgers before merge: ${archiveKey}`);
      }
    } catch (e) {
      console.log(`[Write] No existing ledgers in S3 (first sync or reset)`);
    }

    const newLedgers = results.ledgers?.ledgers || [];
    const mergedLedgers = mergeLedgers(existingLedgers, newLedgers);

    // Calculate deduplication stats
    const existingTxCount = existingLedgers.reduce((sum, l) => sum + (l.transactionCount || 0), 0);
    const newTxCount = newLedgers.reduce((sum, l) => sum + (l.transactionCount || 0), 0);
    const mergedTxCount = mergedLedgers.reduce((sum, l) => sum + (l.transactionCount || 0), 0);
    const duplicatesRemoved = (existingTxCount + newTxCount) - mergedTxCount;

    console.log(`[Write] Merged ledgers: ${existingTxCount} existing + ${newTxCount} new = ${mergedTxCount} unique transactions`);
    if (duplicatesRemoved > 0) {
      console.log(`[Write] Deduplicated ${duplicatesRemoved} duplicate transactions`);
    }

    const detailedData = {
      totalFiles: mergedLedgers.length,
      totalLineItems: mergedLedgers.reduce((sum, l) =>
        sum + (l.transactionCount || 0), 0),
      grandTotal: mergedLedgers.reduce((sum, l) => {
        const ledgerTotal = l.transactions?.reduce((itemSum, item) =>
          itemSum + (item.amount || 0), 0) || 0;
        return sum + ledgerTotal;
      }, 0),
      ledgers: mergedLedgers,
      lastUpdated: timestamp,
      syncSessionId: sessionInfo.syncSessionId,
      sessionName: sessionInfo.sessionName
    };

    await writeJsonToS3(parsedLedgersKey, detailedData);
    writtenPaths.parsedLedgers = { key: parsedLedgersKey };
    console.log(`[Write] Wrote merged ledgers: ${detailedData.totalLineItems} transactions, $${detailedData.grandTotal.toFixed(2)} total`);

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

    // 6. Write parsed SmartPO data to S3 (if available)
    if (results.smartpo && results.smartpo.purchaseOrders?.length > 0) {
      const smartpoKey = 'processed/parsed-smartpo.json';
      const smartpoData = {
        purchaseOrders: results.smartpo.purchaseOrders,
        totalPOs: results.smartpo.totalPOs || results.smartpo.purchaseOrders.length,
        totalAmount: results.smartpo.totalAmount || 0,
        byStatus: results.smartpo.byStatus || {},
        lastUpdated: timestamp,
        syncSessionId: sessionInfo.syncSessionId
      };
      await writeJsonToS3(smartpoKey, smartpoData);
      writtenPaths.parsedSmartPO = { key: smartpoKey };
      console.log(`[Write] Wrote parsed SmartPO: ${smartpoData.totalPOs} POs, $${smartpoData.totalAmount.toFixed(2)} total`);
    }

    // 7. Write budget data to S3 (if available)
    if (results.budgetData) {
      const budgetKey = 'static/parsed-budgets.json';
      await writeJsonToS3(budgetKey, results.budgetData);
      writtenPaths.parsedBudgets = { key: budgetKey };
      console.log(`[Write] Wrote budget data: ${results.budgetData.byLocationEpisode.length} location-episodes`);
    }

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
