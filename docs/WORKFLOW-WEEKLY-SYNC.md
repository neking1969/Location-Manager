# Weekly Sync Workflow: Detailed Process

## Document History
- **Created**: January 28, 2025
- **Last Updated**: January 29, 2025 (COMPLETE IMPLEMENTATION)

---

## Overview

The Weekly Sync workflow synchronizes ledger data from accounting with the budget tracking system. **This workflow is now fully implemented and ready for testing.**

---

## Current Implementation Status: COMPLETE

| Component | Status | Details |
|-----------|--------|---------|
| Glide Sync Sessions Table | Done | ID: `native-table-03Yk3buCk0yZOF5dzh4i` |
| Weekly Sync Screen | Done | File pickers for Ledger + SmartPO |
| Make.com Webhook | Done | URL: `https://hook.us1.make.com/k3onejon45ao1wv4fdlwcqpbl4bflo` |
| Make.com HTTP Module | Done | Configured with Glide API |
| Location-Manager API | Pending | Needs Lambda deployment |
| End-to-End Test | Pending | Ready when Lambda deployed |

---

## Timeline

| Day | Activity | Actor |
|-----|----------|-------|
| Friday | Receive ledgers from accounting | Kirsten |
| Friday | Upload ledgers via Glide Weekly Sync screen | Kirsten |
| Friday | System processes files automatically | System |
| Friday | Review results in Sync Sessions | Kirsten |

---

## Process Flow (IMPLEMENTED)

```
+---------------------------------------------------------------+
|                     FRIDAY: LEDGER UPLOAD                      |
+---------------------------------------------------------------+
|                                                                |
|  1. Kirsten opens Glide App                                   |
|     URL: https://the-shards-season-1-fcmz.glide.page         |
|                                                                |
|  2. Clicks "More" -> "Weekly Sync"                            |
|                                                                |
|  3. Clicks "+" to create new sync session                     |
|     - Enters session name (e.g., "Week of Jan 29")           |
|     - Uploads Ledger file via file picker                     |
|     - Uploads SmartPO file (optional)                         |
|     - Adds any notes                                          |
|                                                                |
|  4. Clicks "Submit"                                           |
|     |                                                         |
|  5. Glide workflow triggers Make.com webhook                  |
|     |                                                         |
|  6. Make.com scenario:                                        |
|     a) Updates status -> "Processing"                         |
|     b) Calls Location-Manager API with file URLs             |
|     c) Updates status -> "Complete" with results              |
|     |                                                         |
|  7. Kirsten sees updated Sync Sessions row:                   |
|     - Status: Complete                                        |
|     - Records Processed: 47                                   |
|     - Errors: 2                                               |
|     - Notes: Summary message                                  |
|                                                                |
+---------------------------------------------------------------+
```

---

## Data Storage (CONFIRMED)

### Sync Sessions Table
Stores metadata about each sync session:
- Session name
- File URLs (Ledger + SmartPO)
- Processing status
- Results (records processed, errors)

**Table ID**: `native-table-03Yk3buCk0yZOF5dzh4i`

### Budget: Line Items Table
Stores imported line items from ledgers:
- One row per transaction
- Linked to locations and vendors
- Source field indicates "Ledger" or "SmartPO"

**Table ID**: `native-table-K4VWicYrUQZwN5Jqrzfq`

---

## Duplicate Detection Logic

Hash-based deduplication in `/src/parsers/ledger.js`:

1. **Hash Generation**: Each transaction gets a 12-character hash from:
   - Location
   - Vendor
   - Transaction number
   - Amount

2. **Detection**: Before import, check if hash exists in Budget: Line Items

3. **Handling**:
   - Duplicates are skipped
   - Count reported in "Records Processed"
   - Details in Notes field

---

## Integration Points

### Glide -> Make.com
```
Trigger: Row change in Sync Sessions (Ledger File populated)
Webhook: https://hook.us1.make.com/k3onejon45ao1wv4fdlwcqpbl4bflo
Payload: {syncSessionId, ledgerFileUrl, smartpoFileUrl, name}
```

### Make.com -> Glide API
```
Endpoint: https://api.glideapp.io/api/function/mutateTables
Auth: Bearer ad54fb67-06fe-40b1-a87d-565a003c3f49
Operations: set-columns-in-row (status updates)
```

### Make.com -> Location-Manager Lambda
```
Endpoint: https://[LAMBDA_URL]/sync
Method: POST
Payload: File URLs and session info
Response: Processing results
```

---

## Testing Instructions

### 1. Manual Webhook Test
```bash
curl -X POST "https://hook.us1.make.com/k3onejon45ao1wv4fdlwcqpbl4bflo" \
  -H "Content-Type: application/json" \
  -d '{
    "syncSessionId": "YpcIrAkqT.aaW8fMoSLqng",
    "ledgerFileUrl": "https://example.com/test.xlsx",
    "name": "Test Sync"
  }'
```

### 2. End-to-End Test
1. Open https://the-shards-season-1-fcmz.glide.page
2. Go to More -> Weekly Sync
3. Create new sync session
4. Upload test ledger file
5. Submit and watch status update

---

## Related Documentation

- **Setup Guide**: `/docs/WEEKLY-SYNC-SETUP.md`
- **Make.com Config**: `/docs/MAKE-SCENARIOS.md`
- **Glide Schema**: `/docs/GLIDE-SCHEMA.md`
- **Blueprint**: `/blueprints/weekly-sync-scenario.json`
