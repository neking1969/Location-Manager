# Complete System Vision: The Shards Production Workflow

## Document History
- **Created**: January 28, 2025
- **Last Updated**: January 29, 2025 (Weekly Sync implemented)

---

## Executive Summary

This document describes the **complete automated production accounting system** for The Shards Season 1, centered around Kirsten's workflow as Locations Coordinator.

### The Core Problem

Kirsten manages location budgets and needs to:
1. **Submit budgets** for approval (in Glide)
2. **Track actuals** from accounting ledgers (from EP)
3. **Reconcile** approved budgets vs actual spend
4. **Track POs** generated in SmartPO
5. **Track Check Requests** she submits
6. **Manage Permits** that come via email

Currently, these are disconnected processes requiring manual effort.

### The Solution

A unified system where:
- **Glide** = Kirsten's single workspace (upload, input, review)
- **Make.com** = Automation hub (email polling, file processing, webhooks)
- **Shards Ledger App** = Beautiful reconciliation dashboard
- **Airtable** = Permit tracking (already built)
- **Google Drive** = File storage (ledgers, permits, etc.)

---

## Data Sources & Their Roles

| Source | What It Contains | How It Arrives | Destination |
|--------|------------------|----------------|-------------|
| **Glide: Locations Budgets** | Approved budgets by location | Kirsten enters manually | Shards Ledger (pull) |
| **Glide: Budget Line Items** | Individual budget items | Kirsten enters manually | Shards Ledger (pull) |
| **GL Ledgers (Excel)** | Actual spend from accounting | Kirsten uploads in Glide | Shards Ledger (process) |
| **SmartPO** | Purchase Orders | Export from SmartPO system | Glide (via upload) |
| **Check Requests** | Payment requests | Kirsten enters in Glide | Shards Ledger (pull) |
| **Permits (Email)** | Filming permits | Email to Kirsten/Desarey | Airtable + Glide |

---

## The Five Workflows

### 1. Weekly Ledger Upload & Reconciliation

**Trigger**: Fridays when Kirsten receives GL ledgers from EP Accounting

```
+---------------------------------------------------------------+
|              WEEKLY LEDGER RECONCILIATION FLOW                 |
+---------------------------------------------------------------+
|                                                                |
|  FRIDAY: Kirsten receives GL ledgers via email                |
|                                                                |
|  1. Opens Glide -> "Weekly Sync" screen                       |
|                                                                |
|  2. Uploads ledger Excel file(s)                             |
|     +-- File saved to Google Drive: /Shards/Ledgers/          |
|                                                                |
|  3. Glide triggers Make.com webhook                          |
|     +-- Webhook: "Dez-Location-Manager-Sync"                  |
|                                                                |
|  4. Make.com scenario:                                       |
|     a. Downloads file from Google Drive                      |
|     b. Sends to Shards Ledger App /api/upload                |
|     c. Triggers data refresh                                 |
|                                                                |
|  5. Shards Ledger App processes:                             |
|     a. Parses Excel -> line items                            |
|     b. Detects duplicates (skips if already imported)        |
|     c. Fuzzy matches locations                               |
|     d. Computes budget vs actuals                            |
|                                                                |
|  6. Kirsten views reconciliation:                            |
|     +-- Shards Ledger App /locations                          |
|     +-- Shows: Budget (approved) vs Actuals (from ledger)     |
|     +-- Highlights: Over-budget locations, variances          |
|                                                                |
|  7. (Optional) Review fuzzy matches:                         |
|     +-- /locations/mapping - confirm/reject uncertain matches |
|                                                                |
+---------------------------------------------------------------+
```

**Cost Consideration**:
- Make.com: 1 operation per file upload + 1 HTTP call = ~2 operations/week
- Very low cost

---

### 2. SmartPO Purchase Order Tracking

**Trigger**: When Kirsten exports PO data from SmartPO system

```
+---------------------------------------------------------------+
|                    SMARTPO TRACKING FLOW                       |
+---------------------------------------------------------------+
|                                                                |
|  1. Kirsten exports PO Log from SmartPO (Excel)              |
|                                                                |
|  2. Opens Glide -> "Weekly Sync" screen                       |
|                                                                |
|  3. Uploads SmartPO Excel file                               |
|     +-- File saved to Google Drive: /Shards/SmartPO/          |
|                                                                |
|  4. Make.com processes:                                      |
|     a. Parses SmartPO Excel                                  |
|     b. Extracts: PO#, Vendor, Amount, Location, Status       |
|     c. Sends to Shards Ledger App                            |
|                                                                |
|  5. Shards Ledger App:                                       |
|     a. Matches POs to locations                              |
|     b. Links to budget line items                            |
|     c. Shows committed spend vs budget                       |
|                                                                |
|  6. (Optional) Sync to Glide:                                |
|     +-- Push PO data to Glide Purchase Orders table           |
|     +-- Kirsten can view/edit in Glide                        |
|                                                                |
+---------------------------------------------------------------+
```

**Why POs Matter for Reconciliation**:
- POs = **Committed spend** (money promised but not yet paid)
- Ledger actuals = **Actual spend** (money already paid)
- Variance = Budget - Committed - Actual

---

### 3. Check Request Tracking

**Trigger**: Kirsten enters check requests in Glide

```
+---------------------------------------------------------------+
|                  CHECK REQUEST TRACKING FLOW                   |
+---------------------------------------------------------------+
|                                                                |
|  1. Kirsten creates Check Request in Glide                   |
|     +-- Glide table: Check Requests                           |
|     +-- Fields: Vendor, Amount, Location, Purpose, Status     |
|                                                                |
|  2. Glide workflow triggers webhook to Make.com              |
|     +-- On: New check request created                         |
|                                                                |
|  3. Make.com sends to Shards Ledger App /api/sync            |
|     +-- Check request data included in payload                |
|                                                                |
|  4. Shards Ledger App:                                       |
|     a. Links check request to location                       |
|     b. Adds to committed spend calculation                   |
|     c. Shows in reconciliation view                          |
|                                                                |
|  5. When check is cashed -> appears in GL Ledger             |
|     +-- Next ledger upload will show as actual spend          |
|     +-- Reconciliation shows: CR pending -> CR paid           |
|                                                                |
+---------------------------------------------------------------+
```

---

### 4. Email Permit Polling (Kirsten + Desarey)

**Trigger**: Permit documents arrive via email

```
+---------------------------------------------------------------+
|                   PERMIT EMAIL POLLING FLOW                    |
+---------------------------------------------------------------+
|                                                                |
|  EMAIL ACCOUNTS TO MONITOR:                                   |
|  - Kirsten's email (locations coordinator)                   |
|  - Desarey's email (your wife - permit contact?)             |
|                                                                |
|  MAKE.COM SCENARIO: "Permit Email Watcher"                   |
|                                                                |
|  1. Schedule: Check email every 15 minutes (or on new email) |
|                                                                |
|  2. Filter emails:                                           |
|     - Subject contains: "permit", "filming permit", "location"|
|     - From: known permit authorities (city, county, etc.)    |
|     - Has attachment: PDF                                    |
|                                                                |
|  3. For matching emails:                                     |
|     a. Download PDF attachment                               |
|     b. Save to Google Drive: /Shards/Permits/                |
|     c. Extract permit data (OCR or manual)                   |
|        - Location name                                       |
|        - Permit type                                         |
|        - Issue date / Expiry date                            |
|        - Issuing authority                                   |
|                                                                |
|  4. Create records:                                          |
|     +-- Airtable: Permits table (already built)              |
|     +-- Glide: Permits table (sync from Airtable or direct)  |
|                                                                |
|  5. Notification:                                            |
|     +-- Slack/email to Kirsten: "New permit added: [Location]"|
|                                                                |
+---------------------------------------------------------------+
```

**Cost Consideration**:
- Make.com email polling: ~100-300 operations/day depending on frequency
- Could use Gmail API with push notifications instead of polling (more efficient)

---

### 5. Glide <-> Shards Ledger Sync

**Trigger**: Periodic or on-demand sync to keep systems in sync

```
+---------------------------------------------------------------+
|                    BIDIRECTIONAL SYNC FLOW                     |
+---------------------------------------------------------------+
|                                                                |
|  GLIDE -> SHARDS LEDGER (Budget Data):                        |
|                                                                |
|  1. Trigger: Daily or when Kirsten clicks "Sync" in Glide    |
|                                                                |
|  2. Make.com calls Shards Ledger /api/glide/pull             |
|     +-- Fetches: Locations, Budgets, Line Items, POs, CRs     |
|                                                                |
|  3. Shards Ledger stores in glide-*.json files               |
|                                                                |
|  4. Reconciliation view updated with latest budget data      |
|                                                                |
|  ---------------------------------------------------------   |
|                                                                |
|  SHARDS LEDGER -> GLIDE (Processed Data):                     |
|                                                                |
|  1. Trigger: After ledger processing complete                |
|                                                                |
|  2. Shards Ledger calls Glide API (or via Make.com)         |
|     +-- Updates: Actual spend per location                    |
|     +-- Updates: Variance calculations                        |
|     +-- Updates: Over-budget flags                            |
|                                                                |
|  3. Kirsten sees updated data in Glide without leaving app   |
|                                                                |
+---------------------------------------------------------------+
```

---

## The Reconciliation View (Core Value)

This is what Kirsten sees in the Shards Ledger App:

```
+---------------------------------------------------------------+
|                    RECONCILIATION DASHBOARD                    |
+---------------------------------------------------------------+
|                                                                |
|  LOCATION: Latchford House                     Episode: 101   |
|  ---------------------------------------------------------   |
|                                                                |
|  BUDGET (Approved)         COMMITTED (POs/CRs)    ACTUAL (GL) |
|  ---------------------------------------------------------   |
|  Security:    $45,000      $42,000               $38,500      |
|  Police:      $32,000      $30,000               $28,750      |
|  Fire:        $18,000      $18,000               $17,200      |
|  Loc Fees:    $65,000      $58,000               $52,300      |
|  Equipment:   $12,000      $10,500               $9,800       |
|  Labor:       $28,000      $26,000               $24,100      |
|  ---------------------------------------------------------   |
|  TOTAL:      $200,000     $184,500              $170,650      |
|                                                                |
|  VARIANCE:   Budget - Actual = $29,350 UNDER BUDGET           |
|  REMAINING:  Budget - Committed = $15,500 available           |
|                                                                |
|  [View Line Items] [View POs] [View Check Requests]           |
|                                                                |
+---------------------------------------------------------------+
```

### What Each Column Means

| Column | Source | Meaning |
|--------|--------|---------|
| **Budget** | Glide: Locations Budgets | What Kirsten submitted for approval |
| **Committed** | SmartPO POs + Check Requests | Money promised but not yet paid |
| **Actual** | GL Ledger from EP | Money actually spent per accounting |
| **Variance** | Computed | Budget - Actual (positive = under budget) |
| **Remaining** | Computed | Budget - Committed (what's left to spend) |

---

## Make.com Scenarios Needed

| Scenario | Trigger | Actions | Est. Operations |
|----------|---------|---------|-----------------|
| **Weekly Ledger Sync** | Webhook from Glide | Download file -> POST to Shards Ledger | 2-3/week |
| **SmartPO Upload** | Webhook from Glide | Download file -> Parse -> POST | 2-3/week |
| **Check Request Sync** | Glide webhook (on create) | POST to Shards Ledger | 5-10/week |
| **Permit Email Watcher** | Email (polling or push) | Check email -> Download PDF -> Create Airtable/Glide record | 100-300/day |
| **Daily Glide Sync** | Schedule (daily) | Pull from Glide -> Push updates | 2/day |

**Total estimated Make.com operations**: ~150-350/day (mostly from email polling)

**Cost optimization**: Use Gmail push notifications instead of polling to reduce operations significantly.

---

## Glide Screens Needed

### 1. Weekly Sync Screen (NEW)

```
+---------------------------------------------------------------+
|                       WEEKLY SYNC                              |
+---------------------------------------------------------------+
|                                                                |
|  UPLOAD LEDGERS                                               |
|  +---------------------------------------------+              |
|  |                                             |              |
|  |     Drop GL Ledger files here               |              |
|  |        or click to browse                   |              |
|  |                                             |              |
|  |     Accepts: .xlsx (Excel)                  |              |
|  |                                             |              |
|  +---------------------------------------------+              |
|                                                                |
|  UPLOAD SMARTPO                                               |
|  +---------------------------------------------+              |
|  |                                             |              |
|  |     Drop SmartPO export here                |              |
|  |        or click to browse                   |              |
|  |                                             |              |
|  +---------------------------------------------+              |
|                                                                |
|  +---------------------------------------------+              |
|  |         [  SYNC NOW  ]                      |              |
|  +---------------------------------------------+              |
|                                                                |
|  LAST SYNC: January 24, 2025 at 3:45 PM                      |
|  STATUS: 847 line items processed, 3 need review              |
|                                                                |
|  [View Reconciliation ->]  [Review Matches ->]                |
|                                                                |
+---------------------------------------------------------------+
```

### 2. Existing Screens (Already in Glide)

- **Budgets** - Budget entry and approval
- **Locations: Master List** - Location management
- **Locations: Budgets** - Budget per location
- **Budget: Line Items** - Individual budget items
- **Vendors** - Vendor management
- **Purchase Orders** - PO tracking
- **Check Requests** - CR tracking
- **Permits** - Permit tracking

---

## Implementation Priority

### Phase 1: Weekly Ledger Flow (Highest Priority)
1. Build Glide "Weekly Sync" screen with file upload
2. Configure Google Drive folder for ledgers
3. Create Make.com scenario to process uploads
4. Connect to Shards Ledger App
5. Test end-to-end: Upload -> Process -> View Reconciliation

### Phase 2: SmartPO & Check Request Tracking
1. Add SmartPO upload to Weekly Sync screen
2. Create Make.com scenario for SmartPO processing
3. Add Check Request webhook to existing Glide workflow
4. Update Shards Ledger reconciliation to show committed spend

### Phase 3: Email Permit Polling
1. Create Make.com scenario to watch email accounts
2. Configure email filters for permit-related messages
3. Set up PDF extraction and storage
4. Connect to Airtable permits table
5. Sync permits to Glide

### Phase 4: Bidirectional Sync & Polish
1. Daily Glide -> Shards Ledger sync
2. Push variance/actual data back to Glide
3. Notifications for over-budget alerts
4. Dashboard refinements

---

## Questions to Resolve

1. **Email accounts for permit polling**:
   - Kirsten's work email address?
   - Desarey's email address?
   - Can we get OAuth access to these accounts?

2. **Permit data extraction**:
   - Are permits standardized PDFs that can be OCR'd?
   - Or do they need manual data entry?

3. **SmartPO export frequency**:
   - Weekly with ledgers?
   - More frequently?

4. **Notification preferences**:
   - Slack notifications?
   - Email summaries?
   - In-app alerts in Glide?

---

## System Architecture Diagram

```
                                    +-----------------+
                                    |   KIRSTEN'S     |
                                    |   WORKFLOW      |
                                    +--------+--------+
                                             |
              +------------------------------+------------------------------+
              |                              |                              |
              v                              v                              v
    +-----------------+           +-----------------+           +-----------------+
    |     GLIDE       |           |   SMARTPO       |           |     EMAIL       |
    |                 |           |                 |           |                 |
    | - Budgets       |           | - PO Export     |           | - Permits       |
    | - Locations     |           |   (Excel)       |           |   (Kirsten)     |
    | - Check Reqs    |           |                 |           | - Permits       |
    | - Weekly Sync   |           |                 |           |   (Desarey)     |
    +--------+--------+           +--------+--------+           +--------+--------+
             |                             |                             |
             |         +-------------------+-------------------+         |
             |         |                                       |         |
             v         v                                       v         v
    +-----------------------------------------------------------------------+
    |                              MAKE.COM                                  |
    |                                                                        |
    |   +--------------+  +--------------+  +--------------+  +------------+ |
    |   | Ledger Sync  |  | SmartPO Sync |  | CR Webhook   |  | Email Poll | |
    |   +------+-------+  +------+-------+  +------+-------+  +-----+------+ |
    |          |                 |                 |                |        |
    +----------+-----------------+-----------------+----------------+--------+
               |                 |                 |                |
               |                 |                 |                |
               v                 v                 v                |
    +-----------------------------------------------------+        |
    |              SHARDS LEDGER APP                       |        |
    |                                                      |        |
    |  - Parse ledgers (duplicate detection)              |        |
    |  - Fuzzy match locations                            |        |
    |  - Compute budget vs actuals                        |        |
    |  - Beautiful reconciliation UI                      |        |
    |                                                      |        |
    +-----------------------------------------------------+        |
                                                                    |
               +----------------------------------------------------+
               |
               v
    +-----------------+           +-----------------+
    |    AIRTABLE     |<--------->|  GOOGLE DRIVE   |
    |                 |           |                 |
    | - Permits       |           | - Ledger files  |
    | - Locations     |           | - SmartPO files |
    |                 |           | - Permit PDFs   |
    +-----------------+           +-----------------+
```

---

## Success Metrics

1. **Kirsten's time saved**: Reduce weekly reconciliation from hours to minutes
2. **Error reduction**: Automatic duplicate detection, fuzzy matching
3. **Visibility**: Real-time budget vs actuals dashboard
4. **Automation**: Zero manual file transfers between systems
5. **Cost**: Make.com operations < 500/day (~$15/month on Pro plan)
