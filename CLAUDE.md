# Location-Manager Project

Budget tracking and Glide synchronization for The Shards TV production.

**Project Location**: `~/Projects/Location-Manager` (local SSD - fast!)
**Backup Location**: Google Drive `/Production-Projects/Location-Manager` (slow, avoid)

## Quick Start

**Tell Claude one of these:**
- "Test the end-to-end Weekly Sync workflow"
- "Deploy the Location-Manager Lambda endpoint"
- "Check the Make.com scenario status"

**Key URLs:**
- Glide App: https://go.glideapps.com/app/TFowqRmlJ8sMhdap17C0
- Glide Live: https://the-shards-season-1-fcmz.glide.page
- Make.com Scenario: https://us1.make.com/300311/scenarios/4528779/edit
- **Ledger Dashboard (ONLY External UI)**: https://main.d2nhaxprh2fg8e.amplifyapp.com

---

## Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| Glide Sync Sessions Table | ✅ Done | ID: `native-table-03Yk3buCk0yZOF5dzh4i` |
| Weekly Sync Screen | ✅ Done | File pickers for Ledger + SmartPO |
| Make.com Webhook | ✅ Done | URL configured |
| Make.com HTTP Module | ✅ Done | Configured and tested |
| Lambda Endpoint | ✅ Done | Deployed to `us-west-2` with file download support |
| Lambda IAM S3 Permissions | ✅ Done | S3AccessPolicy attached for read/write access |
| **Handler File Download** | ✅ Fixed | Handler now downloads files from URLs before processing |
| File Download Logic | ✅ Done | Downloads files from Glide URLs |
| S3 Data Persistence | ✅ Done | All 5 files written successfully |
| Dashboard Redirect | ✅ Done | Opens Shards-Ledger-App after submission |
| Dashboard Polling | ✅ Done | Checks S3 every 3s via Lambda proxy |
| **Summary Row Filter** | ✅ Done | Filters out Excel total rows |
| **Date Extraction** | ✅ Done | Extracts date ranges from descriptions |
| **Location Inference** | ✅ Deployed | Multi-pass: dates → vendor → episode primary |
| **Payroll Date Pattern** | ✅ Done | Extracts dates from `MM/DD/YY :` format |
| **Vendor Location Map** | ✅ Done | Infers location from vendor history |
| **Production Overhead** | ✅ Done | Categorizes uninferrable payroll/permits |
| **Cloud-Only Architecture** | ✅ Done | Dashboard reads from Lambda/S3, no local files |
| **PRODUCTION STATUS** | ✅ **READY** | All systems go! |

---

## Key IDs Reference

### Glide Tables
| Table | ID |
|-------|-----|
| Budgets | `native-table-NVCyYvHOwu5Y4O6Z1i32` |
| Budget Line Items | `native-table-K4VWicYrUQZwN5Jqrzfq` |
| Locations Budgets | `native-table-2JZRLDBX5ZWikodKHz6P` |
| Locations Master | `native-table-PRIIMzLmQiCVsRIfzYEa` |
| Vendors | `native-table-lmMcRP53QnXU3DnL6Byk` |
| Sync Sessions | `native-table-03Yk3buCk0yZOF5dzh4i` |

### Make.com
| Item | Value |
|------|-------|
| Scenario ID | 4528779 |
| Webhook URL | `https://hook.us1.make.com/k3snwjfpk65auz4wa49tiancqdla1d1o` |

### AWS Lambda (Main)
| Item | Value |
|------|-------|
| Function Name | `location-manager-sync` |
| Region | `us-west-2` |
| Base URL | `https://6fjv2thgxf6r4x24na4y6ilgt40vstgl.lambda-url.us-west-2.on.aws` |
| Sync Endpoint | `https://6fjv2thgxf6r4x24na4y6ilgt40vstgl.lambda-url.us-west-2.on.aws/sync` |
| **Data Endpoint** | `https://6fjv2thgxf6r4x24na4y6ilgt40vstgl.lambda-url.us-west-2.on.aws/data` |
| Health Endpoint | `https://6fjv2thgxf6r4x24na4y6ilgt40vstgl.lambda-url.us-west-2.on.aws/health` |
| Mappings Endpoint | `https://6fjv2thgxf6r4x24na4y6ilgt40vstgl.lambda-url.us-west-2.on.aws/mappings` |

### AWS Lambda (Sync Status Reader)
| Item | Value |
|------|-------|
| Function Name | `location-manager-sync-status` |
| Function URL | `https://hhg666k2cv4wr6txkqjxtqutlu0hwuer.lambda-url.us-west-2.on.aws/` |
| Purpose | Reads S3 for dashboard polling |

### AWS S3 Bucket
| Item | Value |
|------|-------|
| Bucket Name | `location-manager-prod` |
| Region | `us-west-2` |
| Ledger Data | `processed/parsed-ledgers-detailed.json` |
| Sync Summary | `processed/latest-sync-summary.json` |
| Budget Data | `static/parsed-budgets.json` |
| Location Mappings | `config/location-mappings.json` |

### Dashboard
| Item | Value |
|------|-------|
| **ONLY External UI** | **This is the ONLY UI (outside Glide) for this project** |
| Dashboard URL | `https://main.d2nhaxprh2fg8e.amplifyapp.com` |
| Comparison API | `https://main.d2nhaxprh2fg8e.amplifyapp.com/api/comparison` |
| GitHub Repo | `https://github.com/neking1969/Shards_Ledger` |
| Amplify App ID | `d2nhaxprh2fg8e` |

---

## Deploy Command

```bash
cd ~/Projects/Location-Manager
bash lambda/deploy.sh
```

---

## Recent Changes (2026-02-13)

19. ✅ **$921K Transaction Recovery** - Fixed two bugs causing dashboard to show $5.49M instead of $6.41M:
    - **Service charge filter** (`handler.js:474-477`): `isServiceCharge()` used bidirectional substring matching that incorrectly dropped 126 txns/$931K. "parking" pattern matched real locations like "Buckley Courtyard / Parking Lot" ($463K lost) and "3rd Floor Parking Garage" ($61K lost). Even true service charges (GUARDS, PERMITS) are valid GL expenditures. Fix: Removed filter entirely; service charges now flow through normal location matching.
    - **txId hash collisions** (`ledger.js:592-600`): Hash of vendor+amount+desc+episode+GL+transNumber+transType lost 45 txns/$47K from identical-looking rows (e.g., 8 monthly GLOBUG rentals at $2,400). Fix: Added `rowIndex` and `filename` to hash; all 1,912 txIds now unique.
    - **Result**: Dashboard=$6,413,088.32 = exact match with raw GL ledgers and Kirsten's email ($6,413,088.23).
    - Re-parsed all 4 ledger files and wrote to S3 with new unique txIds.

---

## Recent Changes (2026-02-11)

18. ✅ **Transaction-Level Deduplication System** - FIXED critical bug in `mergeLedgers()` function that was overwriting entire ledgers instead of deduplicating individual transactions. Rewrote to flatten all transactions, deduplicate by `txId` (hash of vendor, amount, description, episode, glCode, transNumber, transType), and rebuild ledger structure. Added automatic archival of existing transaction data to `archives/transactions/{date}-{session}-pre-merge.json` before any merge operation. Logs now show deduplication stats (e.g., "Deduplicated 42 duplicate transactions"). Next ledger upload will be foolproof - zero data loss guaranteed. File: `src/utils/writeProcessedData.js:3-64,120-152`.

16. ✅ **Drag-and-Drop Transaction Reassignment** - Implemented @dnd-kit/core drag-and-drop for moving budget line items between episodes and locations. Features: (1) Centered floating overlay with backdrop blur when dragging (2) Episode cards color-coded green (under budget) or red (over budget) (3) Location cards populated from `/api/locations-budget` using `glideLocation` field (4) ReassignmentModal for confirming changes with reason field (5) POST to `/api/overrides` to save reassignments (6) DELETE endpoint for undo functionality. Key files: `BudgetDndProvider.tsx`, `EpisodeCard.tsx`, `DraggableTransaction.tsx`, `ReassignmentModal.tsx`. Pattern: `fixed inset-0` + `flex items-center justify-center` for centered overlay, NOT fixed panels at screen edges.

17. ✅ **Deduplication Architecture Issue** - RESOLVED. Was: `mergeLedgers()` merged by `${episode}-${account}` key, overwriting entire ledgers. Now: transaction-level dedup by `txId` with automatic archival before merge.

---

## Recent Changes (2026-02-08)

15. ✅ **Outline Button Style (All Pages)** - Replaced all solid-fill buttons with outline + semi-transparent fill to match dashboard card style. Pattern: `bg-{color}/20 text-{color}-400 border border-{color}/30`. Active toggles/pills use `ring-1 ring-{color}/50`. Changed ~30 buttons across 9 files: LocationFilters, LocationsClient, SyncButton, RefreshButton, episodes/[id], upload, review-pos, ledgers, mapping. Commit `b033f6d`.

11. ✅ **Active Tab Highlighting** - Nav tabs now highlight white when on the current page. Fixed "Dashboard" tab which never highlighted because `href="/"` didn't match the `/summary` pathname after redirect. Changed all nav links from `/` to `/summary`. Simplified NavLink `isActive` logic.
12. ✅ **Over-Budget Count Fix** - Summary page Quick Stats "Over Budget" card showed 5 instead of 11. The `problemLocations` array was `.slice(0, 5)` for display, but the count card was reading from the truncated array. Now uses full `allOverBudget.length`.
13. ✅ **Topsheet Category Fix** - Topsheet was using simplified `getBudgetCategory()` which missed Equipment, Addl. Site Fees, and Site Personnel for GL 6342. Now uses Lambda's pre-computed `tx.category` (same fix as Budget page). Also updated CATEGORY_COLUMNS to match standard names.
14. ✅ **Live Data Validation** - All pages validated against live API data. Budget, actual, variance match across Lambda, Dashboard API, and browser display for all 50 locations, 5 episodes, and 10 categories.

8. ✅ **Category Order Matches Glide** - Dashboard categories now display in Glide's budget view order instead of alphabetical: Loc Fees, Addl. Site Fees, Site Personnel, Permits, Addl. Labor, Equipment, Parking, Fire, Police, Security. Changed in `route.ts` (CATEGORY_ORDER) and `handler.js` (ALL_CATEGORIES).
9. ✅ **Pre-computed Category Matching** - Dashboard now uses Lambda's pre-computed `tx.category` field instead of recalculating from GL codes. Fixes Equipment, Addl. Site Fees, and Site Personnel showing $0 actual (the dashboard's `getCategoryFromTransaction()` was missing GL 6342 subcategory handlers).
10. ℹ️ **Addl. Labor Stays $0** - Investigated and confirmed: Addl. Labor has no GL code. Budget items are payroll positions (Layout Tech, A/C Operator, KALM, ALM, Bathroom Attendant, Snake Wrangler) that show as GL 6342 + PR in ledgers, same as Site Personnel. Splitting by name not worth complexity. Total budget: $292K.

1. ✅ **Budget totalFromMake Fix** - `budget.js` now uses Glide's `totalFromMake` as authoritative budget instead of calculating from line items (rate×unit×time). Scales line item amounts proportionally to match.
2. ✅ **Live Glide Budget Fetch** - `/data` endpoint fetches fresh budgets from Glide on every request instead of reading stale S3 cache. Falls back to S3 if Glide is unreachable.
3. ✅ **Topsheet Math.abs Bug** - Fixed in Shards-Ledger-App: category columns were using `Math.abs()` which counted refunds/credits as positive. Now uses signed amounts.
4. ✅ **Data Verification** - All 50 locations verified: budget amounts match Glide's `totalFromMake` exactly. Fixed 4 previously mismatched: Ext. Warehouse ($39K→$15K), Police Station ($171K→$147K), Ryan's House ($169K→$174K), Ext.Roller Rink Alley ($0→$38K).
5. ✅ **Budget vs Actuals Episode Headers Fix** - Episode header bars were using GL-only category sums for budget/actual/variance, ignoring non-GL categories. Now uses API's pre-calculated `ep.totalBudget`, `ep.totalActual`, and `ep.variance`. All episodes now show correct totals and green (under budget) status. File: `Shards-Ledger-App/src/app/budget/page.tsx`.
6. ✅ **GL Categories Expanded** - Added Equipment, Addl. Site Fees, Site Personnel to `GL_CATEGORIES` list in `/api/episodes/route.ts`. These are tracked via GL 6342 + description/transType matching. Only Addl. Labor remains non-GL.
7. ✅ **Unified Category Table** - Merged GL and non-GL category tables into one aligned table. Removed separate "Non-GL Categories (Budget Only)" section. All categories now show Budget, Actual, Variance, Status in consistent columns.

### Previous Changes (2026-02-07)

1. ✅ **GL-Based 10-Category System** - `categorizeTransaction()` maps GL codes to: Loc Fees, Addl. Site Fees, Equipment, Parking, Permits, Security, Police, Fire, Site Personnel, Addl. Labor
2. ✅ **Per-Row GL & Episode Extraction** - Reads GL code (Column C) and episode (Column F) from each Excel row; filename is fallback only
3. ✅ **Budget Parser** - New `src/parsers/budget.js` transforms Glide budget data with 3-step episode resolution
4. ✅ **Multi-File Ledger Support** - Handler accepts arrays or CSV of ledger URLs
5. ✅ **Location Recovery for Payroll** - Date-based recovery infers locations for payroll transactions (GL 6304/6305/6307/6342)
6. ✅ **GL-Aware Production Overhead** - Payroll with location-labor GL codes stays as location spend, not overhead
7. ✅ **Budget vs Actual Comparison** - Full pipeline: 50 locations matched, $5.5M actual vs $7.4M budget
8. ✅ **Episode Budget Distribution** - "all" budgets distributed across active episodes
9. ⏳ **Pending GL Codes** - Need Rentals, Permits, Parking GL codes from EP Accounting
10. ⏳ **31 Unmapped Locations** - Extracted street names with $0 actual (no spend yet)

### Test Results (2026-02-07)
- 50 budgeted locations matched with transactions
- 49 no-location transactions ($108K) — payroll items where location couldn't be inferred
- 205 purchase orders tracked, 1 deposit detected
- Lambda deployed and serving data successfully

### Previous Changes (2026-02-05)

1. ✅ **Category Breakdown per Location** - `byCategory` field on each location
2. ✅ **GL Account Mapping** - 6304→Security, 6305→Police, 6307→Fire, 6342→Loc Fees
3. ✅ **Deposit Detection** - Lambda identifies refundable deposits
4. ✅ **Financial Breakdown Cards** - Summary UI cards
5. ✅ **Episodes 101/102 Combined** - Single block matching EP Accounting

### Previous Changes (2026-02-04)

1. ✅ **Cloud-Only Architecture** - Dashboard reads from Lambda/S3, not local files
2. ✅ **Added /data Endpoint** - Lambda serves comparison data from S3
3. ✅ **Expanded Location Mappings** - 80+ aliases, SERVICE_CHARGE patterns, PENDING locations
4. ✅ **Location Review UI** - `/locations/review` page for unmapped location categorization

---

## Learnings & Gotchas

1. **Local storage is FAST** - Google Drive CloudStorage path is extremely slow (30+ min for rsync)
2. **Lambda handler must download files** - URLs from Make.com/Glide need to be downloaded before processing
3. **Glide URLs are temporary** - Storage URLs expire, return 403 after expiration
4. **Episode 101+102 Block** - Accounting treats these as one block, all transactions show as "Episode 101"
5. **Summary rows in ledgers** - Excel files have total rows that must be filtered out
6. **Transaction-level GL accounts** - Use `transNumber` field (e.g., "6304"), not ledger-level `account` field
7. **GL codes are per-row in Excel** - Column C (`accountnumber`), not per-file
8. **Episode is per-row in Excel** - Column F (`episode`), filename is fallback only
9. **GL 6304/6305/6307/6342 = location labor** - Even from EP payroll vendor, these are location-specific costs
10. **Budget episode resolution** - Requires traversing Glide relations: lineItem.budgetId → budget.episodeId
11. **Category budgets ≠ totalFromMake** - Line item category budgets are scaled proportionally and may not sum to `totalFromMake`. Always use `ep.totalBudget` for authoritative totals, not category sums.
12. **Dashboard headers vs detail tables** - Episode headers should use API pre-calculated totals; detail tables use per-category data. Don't recompute header totals from category sums.
13. **GL 6342 subcategories** - GL 6342 maps to multiple budget categories via description: PARKING→Parking, PERMIT→Permits, DUMPSTER/TENTS→Equipment, STAGING/CLEANING→Addl. Site Fees, transType PR→Site Personnel, default→Loc Fees. All are trackable, not just Loc Fees.
14. **Amplify caches API responses** - `/api/episodes` has `s-maxage=60`. After deploy, users need Cmd+Shift+R (hard refresh) or wait 60s to see updated data.
15. **Use Lambda's pre-computed category** - Dashboard should use `tx.category` from Lambda, not recalculate. The Lambda's `categorizeTransaction()` has full GL 6342 subcategory logic; the dashboard's version was incomplete.
16. **Addl. Labor has no GL code** - Budget items are payroll positions (Layout Tech, A/C Operator, KALM, ALM, etc.) that share GL 6342 + PR with Site Personnel. No way to distinguish without name-matching. $292K budget, $0 actual is expected.
17. **Glide category display order** - Loc Fees, Addl. Site Fees, Site Personnel, Permits, Addl. Labor, Equipment, Parking, Fire, Police, Security. Defined as `CATEGORY_ORDER` in route.ts.
18. **Button style convention** - NEVER use solid fills (`bg-color text-white`). All buttons use outline + semi-transparent: action buttons `bg-{color}/20 text-{color}-400 border border-{color}/30`, active toggles/pills `ring-1 ring-{color}/50`, neutral buttons `bg-[var(--card)] text-[var(--muted)] border border-[var(--card-border)]`.
19. **NEVER filter out service charge transactions** - Service charges (PERMITS, GUARDS, BASECAMP, etc.) are valid GL expenditures that count toward episode actuals. The old `isServiceCharge()` filter incorrectly dropped $931K using bidirectional substring matching that caught real locations containing "parking", "fire", "security", etc.
20. **txId hash must include rowIndex + filename** - Without these, identical-looking rows (same vendor, amount, description, etc.) produce the same hash and get incorrectly deduped. Monthly recurring charges are the main casualty.
21. **Kirsten's totals are authoritative** - Her email totals ($6,413,088.23) match raw GL ledger files within pennies. Our dashboard should match her numbers. Ep 105 budget discrepancy ($840,390 vs $821,355) still needs investigation.
22. **No-location transactions are mostly payroll** - 1,061 transactions (mostly Police PR and Site Personnel PR) have no location in the ledger. They're real spend that counts toward episode totals but can't be assigned to specific filming locations.

---

## Architecture (Cloud-Only)

```
Glide App (data entry)
  ↓ webhook
Make.com (relay)
  ↓ HTTP POST
Lambda: location-manager-sync (processing ~4s)
  ↓ writes to S3
S3 Bucket: location-manager-prod/
  ├── processed/parsed-ledgers-detailed.json  (ledger transactions)
  ├── processed/latest-sync-summary.json       (sync metadata)
  └── static/parsed-budgets.json               (budget data)
  ↓ reads via /data endpoint
Lambda: location-manager-sync
  ↓ serves JSON with comparison
Amplify: Shards-Ledger-App /api/comparison
  ↓ caches (60s) & serves
Dashboard UI: https://main.d2nhaxprh2fg8e.amplifyapp.com
```

**Key Point**: The dashboard works entirely from AWS. No local files required.

---

## Reconciliation Reference (2026-02-13)

### Verified Totals (all match within pennies)
| Source | Total |
|--------|-------|
| Raw GL ledger files (4 files, 02/06/26) | $6,413,088.32 |
| S3 stored data (1,912 txns) | $6,413,088.32 |
| Lambda /data endpoint | $6,413,088.32 |
| Kirsten's email (Feb 10) | $6,413,088.23 |

### Per-Episode Actuals
| Episode | Dashboard | Kirsten | Status |
|---------|----------|---------|--------|
| 101+102 | $4,203,200.53 | $4,203,200.50 | MATCH |
| 104 | $1,389,830.66 | $1,389,830.60 | MATCH |
| 105 | $745,323.33 | $745,323.33 | MATCH |
| 106 | $74,733.80 | $74,733.80 | MATCH |

### Dashboard Breakdown (after fixes)
- Budgeted locations: 711 txns / $5,201,403
- Unmapped locations: 140 txns / $554,348 (66 locations, mix of pending + no-budget-match)
- No-location: 1,061 txns / $657,337 (mostly Police/Site Personnel payroll)

### Known Open Items
1. **Ep 105 budget discrepancy** - Kirsten=$840,390, Glide=$821,355 (diff $19,035). Need to check Glide budget data.
2. **66 unmapped locations** - 24 PENDING (need Glide budget entries), rest are generic service names (PERMITS, GUARDS, BASECAMP, etc.)
3. **Dashboard UI may need update** - Amplify dashboard hasn't been redeployed since the Lambda fix. The Shards-Ledger-App `/api/episodes` route fetches from Lambda, so numbers should auto-update, but worth verifying visually.
4. **Kirsten's Ep 106 variance math** - She wrote "Under Budget: $32,991.60" but $120,795 - $74,733.80 = $46,061.20. Minor data entry error on her part.

---

## CRITICAL Rules

- **Shards-Ledger-App** is the **ONLY** external UI for this project
- **Glide** is **ONLY** for data entry (file uploads, forms)
- **NEVER** suggest building new dashboards or UIs
- All data display happens in Shards-Ledger-App
- **Dashboard reads from Lambda/S3** - no local file dependencies
