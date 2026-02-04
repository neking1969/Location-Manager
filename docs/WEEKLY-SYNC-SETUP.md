# Weekly Sync Workflow - Complete Setup Guide

## Overview

This document provides step-by-step instructions to complete the Weekly Sync workflow that connects:
- **Glide** (Sync Sessions table + Weekly Sync screen)
- **Make.com** (scenario ID: 4528779)
- **Location-Manager API** (Lambda endpoint)

---

## 1. Glide Configuration (COMPLETED)

### Sync Sessions Table
- **Table ID**: `native-table-03Yk3buCk0yZOF5dzh4i`
- **Columns**:
  | Field | Column ID | Type |
  |-------|-----------|------|
  | Name | Name | text |
  | Ledger File | ledgerFile | multiple files |
  | SmartPO File | smartpoFile | multiple files |
  | Status | 8v4u7 | text |
  | Sync Date | eoSi2 | date-time |
  | Records Processed | Ys6ff | number |
  | Errors | 60vZb | number |
  | Notes | ESsUc | text |

### Weekly Sync Screen
- Located under "More" menu in app navigation
- Edit form with file pickers for Ledger File and SmartPO File
- Test row created: "Test Sync 2026-01-29"

---

## 2. Make.com Scenario Configuration (IN PROGRESS)

### Scenario Details
- **URL**: https://us1.make.com/300311/scenarios/4528779/edit?folder=231082
- **Webhook URL**: `https://hook.us1.make.com/k3onejon45ao1wv4fdlwcqpbl4bflo`
- **Webhook ID**: 2595084

### Module 1: Webhook (DONE)
Already configured as trigger.

### Module 2: HTTP - Update Status to "Processing"

**Configuration:**
```
URL: https://api.glideapp.io/api/function/mutateTables
Method: POST
Headers:
  - Authorization: Bearer ad54fb67-06fe-40b1-a87d-565a003c3f49
  - Content-Type: application/json
Body content type: application/json
Body input method: JSON string
Request content:
```
```json
{"appID": "TFowqRmlJ8sMhdap17C0", "mutations": [{"kind": "set-columns-in-row", "tableName": "native-table-03Yk3buCk0yZOF5dzh4i", "rowID": "{{1.syncSessionId}}", "columnValues": {"8v4u7": "Processing", "eoSi2": "{{now}}"}}]}
```

### Module 3: HTTP - Call Location-Manager API

**Configuration:**
```
URL: https://YOUR-LAMBDA-ENDPOINT/sync
Method: POST
Headers:
  - Content-Type: application/json
Body content type: application/json
Request content:
```
```json
{"syncSessionId": "{{1.syncSessionId}}", "ledgerFileUrl": "{{1.ledgerFileUrl}}", "smartpoFileUrl": "{{1.smartpoFileUrl}}", "sessionName": "{{1.name}}"}
```

### Module 4: HTTP - Update Glide with Results

**Configuration:**
```
URL: https://api.glideapp.io/api/function/mutateTables
Method: POST
Headers:
  - Authorization: Bearer ad54fb67-06fe-40b1-a87d-565a003c3f49
  - Content-Type: application/json
Body content type: application/json
Request content:
```
```json
{"appID": "TFowqRmlJ8sMhdap17C0", "mutations": [{"kind": "set-columns-in-row", "tableName": "native-table-03Yk3buCk0yZOF5dzh4i", "rowID": "{{1.syncSessionId}}", "columnValues": {"8v4u7": "Complete", "Ys6ff": {{3.body.recordsProcessed}}, "60vZb": {{3.body.errors}}, "ESsUc": "{{3.body.summary}}"}}]}
```

### Module 5: Webhook Response (Optional)

**Configuration:**
```
Status: 200
Body:
```
```json
{"success": true, "recordsProcessed": {{3.body.recordsProcessed}}}
```

---

## 3. Glide Workflow Configuration

### Create Workflow in Glide

1. Go to Glide -> Workflows tab
2. Create new workflow: "Weekly Sync: Trigger Processing"
3. **Trigger**: On row change in Sync Sessions table
4. **Condition**: When Ledger File changes from empty to non-empty
5. **Action**: Call API (Webhook)

**Webhook Configuration:**
```
URL: https://hook.us1.make.com/k3onejon45ao1wv4fdlwcqpbl4bflo
Method: POST
Headers:
  Content-Type: application/json
Body:
{
  "syncSessionId": "{{$rowID}}",
  "ledgerFileUrl": "{{Ledger File}}",
  "smartpoFileUrl": "{{SmartPO File}}",
  "name": "{{Name}}"
}
```

---

## 4. Testing

### Manual Test via Curl
```bash
curl -X POST "https://hook.us1.make.com/k3onejon45ao1wv4fdlwcqpbl4bflo" \
  -H "Content-Type: application/json" \
  -d '{
    "syncSessionId": "YpcIrAkqT.aaW8fMoSLqng",
    "ledgerFileUrl": "https://example.com/test-ledger.xlsx",
    "smartpoFileUrl": "",
    "name": "Test Sync 2026-01-29"
  }'
```

### End-to-End Test
1. Open Glide app -> Weekly Sync screen
2. Click on existing sync session or create new one
3. Upload a Ledger file using the file picker
4. Click Submit
5. Watch the Status column update from "Pending" -> "Processing" -> "Complete"
6. Check Records Processed and Errors columns for results

---

## 5. Files Created

| File | Purpose |
|------|---------|
| `/blueprints/weekly-sync-scenario.json` | Make.com scenario blueprint (can be imported) |
| `/blueprints/glide-workflow-config.md` | Glide workflow documentation |
| `/docs/WEEKLY-SYNC-SETUP.md` | This setup guide |
| `/src/glide/tables.js` | Updated with SYNC_SESSIONS table config |

---

## 6. Architecture Diagram

```
+-----------------+
|   Glide App     |
|  Weekly Sync    |
|    Screen       |
+--------+--------+
         | User uploads file
         | Workflow triggers
         v
+-----------------+
|   Make.com      |
|   Webhook       |
|   Scenario      |
+--------+--------+
         | 1. Update status -> "Processing"
         | 2. Call Lambda API
         | 3. Update status -> "Complete"
         v
+-----------------+
| Location-Manager|
|   Lambda API    |
|  /sync endpoint |
+--------+--------+
         | Parse files
         | Match locations/vendors
         | Return results
         v
+-----------------+
|   Glide App     |
| Sync Sessions   |
|  (updated row)  |
+-----------------+
```

---

## 7. Credentials Reference

| Service | Credential | Value |
|---------|------------|-------|
| Glide API | Token | `ad54fb67-06fe-40b1-a87d-565a003c3f49` |
| Glide App | ID | `TFowqRmlJ8sMhdap17C0` |
| Make.com Webhook | URL | `https://hook.us1.make.com/k3onejon45ao1wv4fdlwcqpbl4bflo` |
| Make.com Scenario | ID | `4528779` |

---

## Next Steps

1. **Complete Make.com modules** - Add modules 3-5 following the configurations above
2. **Deploy Lambda** - Ensure `/sync` endpoint is deployed and accessible
3. **Create Glide workflow** - Set up the trigger in Glide
4. **Test end-to-end** - Upload a real ledger file and verify the flow
