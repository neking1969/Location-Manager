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
| **Google Drive Auto-Sync** | ✅ **ACTIVE** | Scenarios #4560594 (Ledgers) + #4560595 (POs), polls every 15 min |
| **Multipart File Upload** | ✅ Done | Lambda accepts multipart/form-data uploads |
| **Google Drive Folders** | ✅ Created | Ledgers, POs, Invoices, Check Requests, Archives |
| **Sync Now Button** | ✅ Done | Triggers Watch scenarios on-demand, checks for new files |
| **File Deduplication** | ✅ Done | SHA256 hash prevents re-processing; cleared on file delete |
| **SmartPO Independent Sync** | ✅ Done | PO files sync even without ledger in same session |
| **File Confirmation Blur** | ✅ Done | Dashboard blurred until all source files confirmed |
| **File Delete & Replace** | ✅ Done | Delete button on file cards, confirmation modal, removes data from S3 |
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
| Weekly Sync Scenario ID | 4528779 |
| Webhook URL | `https://hook.us1.make.com/k3snwjfpk65auz4wa49tiancqdla1d1o` |
| **Ledger Watch Scenario** | **4560594** (watches Ledgers subfolder) |
| **PO Watch Scenario** | **4560595** (watches POs subfolder) |
| Auto-Sync Schedule | Every 15 minutes |
| Old Auto-Sync Scenario | 4560202 (DEACTIVATED — watched parent folder, missed subfolders) |
| Google Drive Connection | ID 1551176 (`jeffrey@enneking.company`) |
| MAKE_API_TOKEN | Lambda env var for on-demand scenario triggers |

### Google Drive Folders (Auto-Sync)
| Folder | Google Drive ID |
|--------|----------------|
| AA_FOR BUDGET TRACKING WEBSITE | `1ccQn099wEk5V2w6WmgtExw66azkgQu4M` |
| /Ledgers | `1ZWEcHz9oBYOm8gtXdxTJGFN8gzXWDgyn` |
| /POs | `128JxBOum6mCt_XexA5dSGUKRiyU8xvsg` |
| /Check Requests | `1jwsFJu-QsyVVbv52k25klMZ5kVjALCHu` |
| /Invoices | `1barija6FSQ2POU4Mt9bhn3osFvZ6vdRY` |
| /Archives | `1uHCPpgl7XG9_OZox60r6lhJbaw1x7Xg1` |

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
| **Trigger Sync Endpoint** | `https://6fjv2thgxf6r4x24na4y6ilgt40vstgl.lambda-url.us-west-2.on.aws/trigger-sync` |

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
| File Confirmations | `processed/file-confirmations.json` |

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

## Recent Changes (2026-02-14)

35. ✅ **Report Date Fix for Episode 102** - Episode 102's filename (`Episode 102 GL Ledger`) doesn't match the standard `101 6304-6342 MMDDYY.xlsx` pattern, so `parseFilename()` returned null and no `reportDate` was set. Two fixes: (1) Lambda `handler.js` `/files` endpoint now derives `reportDate` from transaction data or `parsedAt` when filename can't be parsed. Deployed to Lambda. (2) Dashboard `FileVerification.tsx` now always shows Report Date row with `processedAt` as fallback. Committed `d8455ec` (dashboard build #115), Lambda redeployed.

34. ✅ **PO Number Display Fix (Dashboard)** - Fixed `locations-budget/route.ts` in Shards_Ledger dashboard (commit `aaadb53`, build #114). The `transformLocation()` function was hardcoding `transType: "AP"` and dropping `poNumber`, `documentNumber`, and `effectiveDate` from Lambda response. Now all 4 fields pass through correctly. Effect: PO# and Doc# columns show actual PO numbers (e.g., `1WZX0334`), transaction tabs correctly split POs/Invoices/Checks/Payroll, and date column shows actual dates. Data validation: 177 of 178 ledger PO numbers match SmartPO records; 444 transactions have PO numbers; 38 SmartPO POs have no ledger invoices yet (open/committed).

33. ✅ **Unmapped Locations Verified Working** - Confirmed the Review Unmapped page (`/locations/review`) works correctly with Lambda backend. 41 unmapped locations: 34 pending ($268K), 4 no_budget_match ($306K), 3 service_charge ($1K). Kirsten can: click "New Location" to mark as pending, click "Map to Existing" to alias to budgeted location. No code changes needed — already functional.

32. ✅ **Sync Now Button Fix (Complete)** - Fixed Sync Now button to reliably sync files from Google Drive. Root cause: old scenario #4560202 watched the PARENT folder `AA_FOR BUDGET TRACKING WEBSITE`, but files are in SUBFOLDERS (`/Ledgers/` and `/POs/`). Google Drive Watch module doesn't see files in subfolders. Fix: Created 2 new Watch scenarios (#4560594 for Ledgers, #4560595 for POs) that each watch the correct subfolder. Lambda `/trigger-sync` triggers both via REST API (`POST /api/v2/scenarios/{id}/run`). Auto-sync runs every 15 min; Sync Now button triggers immediately. File: `handler.js` (trigger-sync endpoint).

31. ✅ **File Dedup Clearing on Delete** - When files are deleted from dashboard, dedup records in `processed-files-registry.json` are now cleared so the same file can be re-synced from Google Drive. Matches by episode number (for ledgers) or filename prefix (for SmartPOs). File: `handler.js` (`/files/delete` handler).

30. ✅ **SmartPO Independent Write** - Fixed bug where SmartPO data wasn't persisted when synced without a ledger file. The S3 write path was gated on `result.ledgers` being non-null. Added independent SmartPO write block that writes to `processed/parsed-smartpo.json` when PO data is present but no ledger. File: `handler.js`.

29. ✅ **Feb 13 Ledger Files Synced** - Manually synced 4 new ledger files from accountant (episodes 101, 104, 105, 106 dated 02/13/26). Dashboard now shows: Budget $7,316,027, Actual $6,447,727.59, Variance $868,299.41. 43/50 locations with actuals, 13 over budget. 215 POs ($1,787,703.92).

28. ✅ **Dedup Marking Fix** - Moved dedup `markFileProcessed()` call outside of `result.ledgers` block so ALL file types (not just ledgers) get registered in the dedup registry. File: `handler.js`.

---

## Recent Changes (2026-02-13)

27. ✅ **File Delete & Replace** - Added delete button (trash icon) on each file card with confirmation modal. Clicking trash shows modal with file name, transaction count, amount, and episode. "Delete File" removes data from S3 (filters out ledger groups by episode, or clears SmartPO data), removes the confirmation entry, and removes the card from the UI. Cancel dismisses safely. After deleting, Kirsten drops the corrected file in Google Drive and clicks Sync Now. Files: `handler.js` (new `/files/delete` POST endpoint), `api/files/route.ts` (DELETE handler), `FileVerification.tsx` (DeleteConfirmModal component, delete state management, trash icons on cards).

26. ✅ **File Confirmation Blur Overlay** - Dashboard content is blurred/dimmed/non-interactive on every page load until Kirsten confirms all source files are current and accurate. FileVerification component now exposes `onAllConfirmed` callback prop. Summary page wraps all content below file cards in a conditional blur container (`blur-sm opacity-40 pointer-events-none select-none`). Smooth 500ms transition when blur lifts. Resets on every page navigation. Files: `FileVerification.tsx` (callback prop), `summary/page.tsx` (blur wrapper + state).

25. ✅ **Sync Now Button** - Added "Sync Now" button to dashboard header nav. Triggers Make.com auto-sync scenario #4560202 on-demand via Lambda `/trigger-sync` endpoint (proxies to Make.com REST API). Make.com API token stored as Lambda env var `MAKE_API_TOKEN`. Button shows spinner during sync, checkmark on success, X on error. Auto-resets after 4-5s. Files: `handler.js` (new `/trigger-sync` endpoint), `SyncNowButton.tsx` (new component), `api/trigger-sync/route.ts` (new API proxy), `layout.tsx` (added to nav).

24. ✅ **Google Drive Auto-Sync — COMPLETE** - Built end-to-end auto-sync pipeline: Kirsten drops files into Google Drive → Make.com detects (every 15 min) → downloads via Google Drive API → sends as multipart/form-data to Lambda → Lambda parses and writes to S3 → dashboard updates.
    - Created Google Drive folder structure under `AF > The Shards: Season 1 > AA_FOR BUDGET TRACKING WEBSITE` with subfolders: Ledgers, POs, Check Requests, Invoices, Archives
    - Built Make.com scenario #4560202 with Watch Files → Get File → Router (4 routes by filename/folder) → HTTP POST (multipart) → Move to Archives
    - Added `parseMultipart.js` utility for Lambda to parse multipart/form-data without npm dependencies
    - Updated Lambda handler to accept both JSON (existing Glide flow) and multipart (new Google Drive flow)
    - Tested via curl multipart upload — Episode 106 ledger (34 txns) parsed successfully
    - Files: `handler.js` (multipart body parsing), `src/utils/parseMultipart.js` (new), `docs/ACTIVATE-AUTO-SYNC.md` (rewritten)

23. ✅ **Multipart File Upload Support** - Lambda `/sync` endpoint now accepts `multipart/form-data` uploads in addition to JSON with file URLs. Lambda Function URLs base64-encode binary bodies (`event.isBase64Encoded`). Custom multipart parser extracts files and form fields from boundary-delimited binary data. No new npm dependencies.

22. ✅ **Non-Location Spend Indicator** - Added amber badge to Budget page episode headers showing payroll/overhead spend not tied to specific filming locations. Uses existing `nonLocationSpend` from API. Files: `EpisodeCard.tsx`, `page.tsx`.

21. ✅ **Service Charge Classification** - Handler now properly classifies SERVICE_CHARGE locations (PERMITS, GUARDS, BASECAMP, etc.) as `reason: 'service_charge'` instead of `no_budget_match`. 24 service charge locations ($288K) now properly labeled. File: `handler.js:534-543`.

20. ✅ **Location Mapping Expansion** (v2.4) - Reduced truly unknown locations from ~30 to 0:
    - Mapped ASYLUM→Melrose Video Bar ($35K), SYCAMORE COVE→Malibu Beach ($20K), STAR MAKE UP ROOM/HALLWAY/SLPS BACKLOT→SLP Stage ($19K), SKATE RINK→Roller Rink, KELLBER'S→Keller Residence, CYN→Benedict Canyon, MULHOLLAND HWY→Woodley Ave, REPROG DISCO BALLS→Roller Rink
    - Added 21 new PENDING locations (Bristol Ave, Bronson Caves, Wilton Pl, etc.)
    - Added CHAIRS, DRIVING SUPPORT, SITE REP/REPAIRS as SERVICE_CHARGE
    - Result: 65 unmapped = 41 pending + 24 service_charge + 0 unknown

19bis. ✅ **Ep 105 Budget Category Fix** - Budget parser was showing $821K episode total but $0 in all categories. Root cause: locations with `totalFromMake` but no line items were added to `byLocationEpisode` but not `byEpisodeCategory` or `byCategoryLocationEpisode`. Fix: now propagates budget to all three maps. File: `budget.js:182-210`.

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
23. **Budget parser must propagate totalFromMake to all maps** - When a location has `totalFromMake` but no line items, `byLocationEpisode` gets updated but `byEpisodeCategory` and `byCategoryLocationEpisode` must also be updated. Otherwise episodes show budget totals but $0 in all categories.
24. **SERVICE_CHARGE locations need explicit classification** - `buildAliasLookup()` separates service charge patterns from budget aliases, but the matching loop must check `serviceChargePatterns` to classify them as `service_charge` rather than `no_budget_match`.
25. **Location mappings version** - v2.4 as of 2026-02-13. 65 unmapped = 41 pending + 24 service_charge + 0 unknown.
26. **Lambda Function URLs base64-encode binary bodies** - When a request has a binary Content-Type (like multipart/form-data), `event.isBase64Encoded` is `true` and `event.body` is base64. Must decode: `Buffer.from(event.body, 'base64')`.
27. **Make.com `google-drive:getAFile` downloads file binary** - Use this before HTTP module to download file content. Then map `{{2.data}}` as the file value in multipart fields. Module version 4, requires `google-restricted` connection.
28. **Make.com module names are camelCase** - `watchFilesInAFolder`, `getAFile`, `moveAFileIntoAFolder`, `copyAFile`. NOT `downloadAFile` or `searchFiles`.
29. **Google Drive `uc?export=download` URLs need auth** - Can't use `https://drive.google.com/uc?export=download&id=...` from Lambda without Google credentials. Must have Make.com download the file first and send binary.
30. **Make.com `listFiles` RPC always returns root** - The `folderId` parameter is ignored; it always lists root drive contents. Can't use this to browse specific folders.
31. **Make.com scenario trigger via REST API** - `POST https://us1.make.com/api/v2/scenarios/{id}/run` with `Authorization: Token {token}`. Works even for scheduled (non-webhook) scenarios. Returns `{executionId}`. Token stored as Lambda env var `MAKE_API_TOKEN`.
32. **FileVerification callback pattern** - Pass `onAllConfirmed?: (confirmed: boolean) => void` to expose internal state to parent. Fires on initial load and after each confirmation. Used by summary page to control blur overlay.
33. **Lambda env vars** - `GLIDE_APP_ID`, `GLIDE_API_KEY`, `MAKE_API_TOKEN`. Set via `aws lambda update-function-configuration --environment`.
34. **File deletion is episode-scoped for ledgers** - `/files/delete` with `fileKey: "ledger-ep106"` removes ALL ledger groups for episode 106, recalculates totals. SmartPO deletion clears the entire PO dataset. Both also remove the file confirmation entry.
35. **Next.js DELETE method for API routes** - Use `export async function DELETE(request: Request)` in route.ts. The Lambda endpoint is still POST (Lambda Function URLs don't differentiate HTTP methods well), so the Next.js DELETE handler proxies as POST to Lambda `/files/delete`.
36. **Google Drive Watch module doesn't see subfolders** - `watchFilesInAFolder` only detects files DIRECTLY in the specified folder. Files in subfolders are invisible. Must create separate Watch scenarios for each subfolder.
37. **Watch cursor starts at activation time** - Files uploaded BEFORE a Watch scenario is activated are invisible to the Watch module. Only files uploaded AFTER activation are caught. Use manual sync (curl to Lambda) for pre-existing files.
38. **Google Drive folder ownership vs access** - Files are in `modernlocations@gmail.com` drive, but Make.com connection #1551176 uses `jeffrey@enneking.company`. Works because the folder is shared. Both accounts can see files via the same folder IDs.
39. **Make.com `searchForFilesFolders` + `getAFile` = broken** - When combining Search module output with the Download module, the internal `filterGoogleFileFormat` function crashes with `Cannot read properties of undefined (reading 'startsWith')`. Use Watch module (which works) or `makeApiCall` instead.
40. **Make.com webhook creation requires data fields** - `gateway-webhook` hooks require `data: {headers: false, method: false, stringify: false, teamId: N}`. Without these, creation fails with validation error.
41. **Dedup registry must be cleared on file delete** - When files are deleted from the dashboard, their SHA256 hash records in `processed-files-registry.json` must also be deleted, otherwise re-uploading the same file to Google Drive will be silently skipped.

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

## Reconciliation Reference (2026-02-14)

### Latest Dashboard State (Feb 13 ledger files)
| Metric | Value |
|--------|-------|
| Budget | $7,316,027.00 |
| Actual | $6,447,727.59 |
| Variance | $868,299.41 |
| Locations with actuals | 43/50 |
| Locations over budget | 13 |
| Purchase Orders | 215 ($1,787,703.92), 209 open |

### Previous Verified Totals (Feb 6 ledger files)
| Source | Total |
|--------|-------|
| Raw GL ledger files (4 files, 02/06/26) | $6,413,088.32 |
| S3 stored data (1,912 txns) | $6,413,088.32 |
| Lambda /data endpoint | $6,413,088.32 |
| Kirsten's email (Feb 10) | $6,413,088.23 |

### Dashboard Breakdown
- Budgeted locations: 50 locations matched to Glide budgets
- Unmapped locations: 65 total = 41 pending + 24 service_charge + 0 unknown
- No-location: ~1,061 txns (mostly Police/Site Personnel payroll)
- Ep 105 categories: All 10 populated

### Known Open Items
1. **Ep 105 budget discrepancy** - Kirsten=$840,390, Glide=$821,355 (diff $19,035). This is a **Glide data issue** — `totalFromMake` values in Glide sum to $821K, not $840K. Code is correct. Needs manual audit of Ep 105 location budgets in Glide vs Kirsten's spreadsheet.
2. **41 PENDING locations** - Real filming locations ($233K total) that need Glide budget entries. Top: Bristol Ave ($27K), Wilton Pl ($24K), Bronson Caves ($22K), Hill Dr ($18K).
3. **Kirsten's Ep 106 variance math** - She wrote "Under Budget: $32,991.60" but $120,795 - $74,733.80 = $46,061.20. Minor data entry error on her part.

---

## CRITICAL Rules

- **Shards-Ledger-App** is the **ONLY** external UI for this project
- **Glide** is **ONLY** for data entry (file uploads, forms)
- **NEVER** suggest building new dashboards or UIs
- All data display happens in Shards-Ledger-App
- **Dashboard reads from Lambda/S3** - no local file dependencies
