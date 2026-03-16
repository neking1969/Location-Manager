# Location Manager — Learnings

> Auto-maintained by Claude. Records debugging discoveries, configuration gotchas, and patterns learned during development.

## 2026-02-14 Lambda: Must Download Files From URLs

**Skill:** AWS Lambda
**Type:** pattern
**Status:** verified

### Discovery
Lambda handler must download files from URLs provided by Make.com/Glide before processing. URLs cannot be passed directly to file processing functions.

## 2026-02-14 Glide: Storage URLs Are Temporary

**Skill:** Glide
**Type:** pattern
**Status:** verified

### Discovery
Glide storage URLs expire and return 403 after expiration. Never cache or persist Glide file URLs long-term.

## 2026-02-14 Production: Block Filming Budget Allocation

**Skill:** Domain Knowledge
**Type:** pattern
**Status:** verified

### Discovery
Episodes 101+102 are treated as one filming block by accounting. 89% of Block 1 spending is coded to Episode 101's GL accounts, which is normal for block filming. Always display budget comparison at Block level, not individual episodes.

## 2026-02-14 GL Codes: Per-Row in Excel, Not Per-File

**Skill:** Data Processing
**Type:** pattern
**Status:** verified

### Discovery
GL account codes are in Column C of each Excel row, not at the file level. GL codes 6304/6305/6307/6342 map to location labor, even from EP payroll vendor.

## 2026-02-14 Budget: Episode Resolution via Glide Relations

**Skill:** Glide
**Type:** pattern
**Status:** verified

### Discovery
Budget episode resolution requires traversing Glide relations: `lineItem.budgetId` -> `budget.episodeId`. Category budgets do NOT equal `totalFromMake`. Always use `ep.totalBudget`, not category sums.

## 2026-02-14 GL 6342: Multiple Budget Category Mappings

**Skill:** Domain Knowledge
**Type:** pattern
**Status:** verified

### Discovery
GL account 6342 maps to multiple budget categories via description keywords (PARKING, PERMIT, DUMPSTER, etc.). Must check description content first before defaulting to "Loc Fees".

## 2026-02-14 Dashboard: Use Lambda's Pre-Computed Category

**Skill:** Architecture
**Type:** pattern
**Status:** verified

### Discovery
Dashboard must use `tx.category` from Lambda's pre-computed output, not recalculate categories on the frontend. Recalculation causes discrepancies.

## 2026-02-14 Data: Never Filter Out Service Charges

**Skill:** Data Processing
**Type:** bugfix
**Status:** verified

### Discovery
$931K was incorrectly dropped by an old `isServiceCharge()` filter. NEVER filter out service charge transactions from actuals data.

## 2026-02-14 Hashing: txId Must Include rowIndex and Filename

**Skill:** Data Processing
**Type:** bugfix
**Status:** verified

### Discovery
Transaction ID hash must include `rowIndex` and `filename` in addition to transaction content. Identical rows in different files produce the same hash without these additional fields.

## 2026-02-14 Budget Parser: Propagate totalFromMake to All Maps

**Skill:** Data Processing
**Type:** bugfix
**Status:** verified

### Discovery
Budget parser must propagate `totalFromMake` to ALL output maps including `byEpisodeCategory` and `byCategoryLocationEpisode`. Missing propagation causes zero budget display.

## 2026-02-14 Google Drive: Service Account Auth Pattern

**Skill:** Google APIs
**Type:** pattern
**Status:** verified

### Discovery
Use `google-auth-library` GoogleAuth with `credentials` from base64-decoded JSON for service account auth. File move: `PATCH /drive/v3/files/{id}?addParents={to}&removeParents={from}`.

## 2026-02-14 EventBridge: Event Source Detection

**Skill:** AWS EventBridge
**Type:** pattern
**Status:** verified

### Discovery
EventBridge events have `event.source === 'aws.events'` with no HTTP routing fields. Lambda handler must detect this to differentiate EventBridge triggers from HTTP requests.

## 2026-02-14 Make.com: Eliminated in Favor of Direct Google Drive API

**Skill:** Architecture
**Type:** optimization
**Status:** verified

### Discovery
Direct Google Drive API via Lambda is faster, cheaper, and more reliable than Make.com for file sync operations. Make.com was replaced entirely.

## 2026-02-14 Ledger Files: Episode-Scoped Deletion

**Skill:** Data Processing
**Type:** pattern
**Status:** verified

### Discovery
File deletion via `/files/delete` removes ALL groups for that episode, not individual files. This is by design since ledger files are episode-scoped.
