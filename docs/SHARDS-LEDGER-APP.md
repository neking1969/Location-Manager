# Shards Ledger App: Complete Architecture

## Document History
- **Created**: January 28, 2025
- **Last Updated**: January 29, 2025
- **App Location**: `/Users/jeffreyenneking/Shards_Ledger/`
- **Dev Server**: `http://localhost:3000`

> **Note**: The Location-Manager Weekly Sync workflow now provides an alternative path for ledger uploads via Glide. See `/docs/WEEKLY-SYNC-SETUP.md`.

---

## Executive Summary

The **Shards Ledger App** is a Next.js application that serves as the **primary UI for Kirsten** to:
1. Upload ledger files (Excel) and SmartPO exports
2. View budget reconciliation (budget vs actuals)
3. See location-centric budget tracking with variance analysis
4. Review and approve location/vendor fuzzy matching
5. Sync data bidirectionally with Glide

**This is the "beautiful UI" app** - the main dashboard Kirsten uses.

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 16 (App Router) |
| Frontend | React 19, TypeScript |
| Styling | Tailwind CSS, Dark theme |
| Data Storage | JSON files in `/data` directory |
| API | Next.js API routes |
| Matching | Fuzzball (fuzzy string matching) |
| Excel Parsing | xlsx library |

---

## Kirsten's Weekly Workflow

### Friday: Receive and Upload Ledgers

```
+---------------------------------------------------------------+
|                   FRIDAY WORKFLOW                              |
+---------------------------------------------------------------+
|                                                                |
|  1. Kirsten receives GL ledgers from EP Accounting            |
|     - Excel files: [EPISODE] [ACCOUNTS] [MMDDYY].xlsx         |
|     - Example: "101 6304-6342 012326.xlsx"                    |
|                                                                |
|  2. Opens Shards Ledger App (localhost:3000)                  |
|                                                                |
|  3. Goes to /upload page                                      |
|     - Drag & drop Excel files                                 |
|     - Or click to browse                                      |
|     - Accepts: .xlsx (ledgers/SmartPO), .pdf (reference)      |
|                                                                |
|  4. File is automatically:                                    |
|     a. Saved to data/ledgers/ (for ledger Excel)             |
|        OR data/uploads/ (for PDFs)                            |
|     b. Parsed by parse-excel-ledgers.mjs                     |
|     c. Duplicate detection runs automatically                 |
|     d. Fuzzy matching assigns locations                       |
|                                                                |
|  5. Review results at /locations/mapping                      |
|     - Confirm high-confidence matches                         |
|     - Manually assign unmatched locations                     |
|     - Reject incorrect suggestions                            |
|                                                                |
|  6. View reconciliation at /locations                         |
|     - Budget vs Actuals by location                           |
|     - Expandable cards with episode breakdown                 |
|     - Over/under budget indicators                            |
|                                                                |
|  7. (Optional) Sync to Glide                                  |
|     - Click "Sync to Glide" button                           |
|     - POs/Invoices/Check Requests sync back                  |
|                                                                |
+---------------------------------------------------------------+
```

---

## Data Storage Architecture

### Key Insight: JSON File-Based Storage

All data is stored in JSON files in the `/data` directory - **NOT a traditional database**.

```
Shards_Ledger/
+-- data/
    |
    |-- INPUT FILES (raw data):
    +-- ledgers/                         # Raw Excel ledger files from EP
    |   +-- 101 6304-6342 012326.xlsx   # Episode 101 ledger
    |   +-- 104 6304-6342 012326.xlsx   # Episode 104 ledger
    |   +-- ...                          # More ledger files
    |
    +-- glide-exports/                   # CSV exports from Glide
    |   +-- Budget_ Line Items (2).csv   # Budget line items
    |
    |-- PARSED/PROCESSED DATA:
    +-- parsed-ledgers-detailed.json     # 1.5MB - ALL LEDGER LINE ITEMS
    +-- glide-budget-line-items.json     # 1MB - Budget items from Glide
    +-- location-comparison.json         # 1.2MB - Budget vs actuals by location
    +-- location-matches.json            # 106KB - Fuzzy matching results
    +-- smartpo-parsed.json              # 121KB - SmartPO PO data
    |
    |-- GLIDE SYNC DATA:
    +-- glide-locations.json             # 17KB - Location master data
    +-- glide-purchase-orders.json       # POs from Glide
    +-- glide-invoices.json              # Invoices from Glide
    +-- glide-check-requests.json        # Check requests from Glide
    |
    |-- SUPPORT FILES:
    +-- budget-vs-actuals.json           # Summary comparison
    +-- duplicate-detection-results.json # Duplicate detection output
    +-- location-mappings.json           # Manual location mappings
    +-- sync-history.json                # Sync operation history
    +-- validation-report.json           # Data validation results
```

---

## Ledger Line Item Data Structure

From `parsed-ledgers-detailed.json`:

```typescript
interface LedgerLineItem {
  // Raw fields from Excel
  AccountNumber: string;      // GL account: "6304", "6305", "6307", "6342"
  EpisodeCode: string;        // "101", "102", "104", "105", "106"
  Description: string;        // Contains location, dates, service type
  VendorName: string;         // Payee name from ledger
  Amount: number;             // Dollar amount (positive or negative)
  DocumentNumber: string;     // Reference number
  DocumentType: string;       // "PO", "AP", "CP", "PR", "APV"
  TransactionDate: string;    // Date of transaction

  // Extracted/computed fields
  extractedLocation: string;  // Location parsed from Description
  matchedGlideLocation?: string;  // Matched Glide location (if found)
  matchConfidence?: number;   // Match confidence score (0-100)
  budgetCategory: string;     // Security, Police, Fire, Loc Fees, Equipment, Labor
}
```

### GL Account Mapping

| Account | Name | Budget Category |
|---------|------|-----------------|
| 6304 | Location Security | Security |
| 6305 | Location Police | Police |
| 6307 | Location Fireman | Fire |
| 6342 | Fees & Permits | Loc Fees (or Equipment/Labor based on description) |

---

## Duplicate Detection Logic

**Already built and working!** (`scripts/detect-duplicates.mjs`)

### How It Works

1. **Content Hash**: Each line item is hashed based on:
   - Vendor name (normalized)
   - Amount (rounded to 2 decimals)
   - Date
   - Description (normalized)
   - Document number

2. **Cross-File Detection**: Duplicates detected across ALL ledger files in `data/ledgers/`

3. **Prevention**: When new ledgers are parsed:
   - New items are checked against existing hashes
   - Duplicates are flagged but NOT re-imported
   - Results stored in `data/duplicate-detection-results.json`

### Running Duplicate Detection

```bash
cd /Users/jeffreyenneking/Shards_Ledger
npm run detect:duplicates
```

**This ensures Kirsten can upload new ledgers weekly without creating duplicate entries.**

---

## Location Matching System

### Intelligent Fuzzy Matching

Uses **fuzzball** library for fuzzy string matching:

| Strategy | Confidence | Example |
|----------|------------|---------|
| Exact match | 100% | "LATCHFORD HOUSE" = "LATCHFORD HOUSE" |
| Prefix match | 80-98% | "LATCHFORD" -> "LATCHFORD HOUSE" |
| Token set ratio | 85%+ | "HOUSE LATCHFORD" -> "LATCHFORD HOUSE" |
| Abbreviation expansion | 75-95% | "BUCKLEY HS" -> "BUCKLEY HIGH SCHOOL" |
| Partial ratio | 70-80% | Substring matching |

### Confidence Levels

| Level | Score | UI Action |
|-------|-------|-----------|
| High | 90-100 | Auto-confirmed (green) |
| Medium | 70-89 | Pending review (yellow) |
| Low | 50-69 | Needs verification (orange) |
| None | <50 | Manual assignment required (red) |

### User Review UI (`/locations/mapping`)

- **Bulk confirm**: Confirm all matches above a threshold (90%+, 80%+, 70%+)
- **Individual review**: Click to see details, confirm or reject
- **Manual assign**: Dropdown to select correct location for unmatched items

---

## API Endpoints

### Upload & Processing

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/upload` | POST | Upload ledger/SmartPO files |
| `/api/upload` | GET | List recent uploads |
| `/api/refresh` | POST | Trigger full data refresh |
| `/api/refresh` | GET | Get current validation status |

### Data Access

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/comparison` | GET | Budget vs actuals summary |
| `/api/ledgers` | GET | Ledger line items with mapping status |
| `/api/locations-budget` | GET | Location-centric budget view |
| `/api/locations` | GET | Location mapping and validation |
| `/api/episodes` | GET | Episode-level data |

### Location Matching

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/locations/matches` | GET | Get all matching results |
| `/api/locations/matches/confirm` | POST | Confirm match(es) |
| `/api/locations/matches/reject` | POST | Reject a suggested match |
| `/api/locations/create` | POST | Create new location |

### Glide Sync

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sync` | POST | Receive webhook from Glide |
| `/api/sync` | GET | Get sync status/history |
| `/api/glide/pull` | POST | Pull data FROM Glide |
| `/api/glide/sync-pos` | POST | Sync POs TO Glide |

---

## Frontend Pages

| Route | Purpose | Primary User |
|-------|---------|--------------|
| `/` | Dashboard with summary metrics, top locations | Kirsten |
| `/upload` | **File upload (ledgers, SmartPO)** | Kirsten |
| `/upload/review-pos` | Review unmapped POs before sync | Kirsten |
| `/locations` | **Location-centric budget view** | Kirsten |
| `/locations/mapping` | **Location matching review** | Kirsten |
| `/ledgers` | Ledger tiles with line-item details | Kirsten |
| `/budget` | Budget vs actuals table | Kirsten |
| `/blocks` | Block view (episodes by filming block) | Kirsten |

---

## Data Flow Diagrams

### Upload Flow (Kirsten's Friday Workflow)

```
Kirsten drops Excel file on /upload
           |
           v
POST /api/upload
           |
           +-- Save to data/ledgers/ (for Excel ledgers)
           |   OR data/uploads/ (for PDFs)
           |
           +-- Run parse-excel-ledgers.mjs
           |   +-- Output: data/parsed-ledgers-detailed.json
           |
           +-- Run detect-duplicates.mjs
           |   +-- Flags duplicates, prevents re-import
           |
           +-- Run intelligent-matcher.mjs
               +-- Output: data/location-matches.json
           |
           v
Return: Parse results (PO count, amount, match stats)
           |
           v
Kirsten reviews at /locations/mapping
           |
           v
Data visible at /locations (budget vs actuals)
```

### Glide Sync Flow

```
TWO-WAY SYNC:

1. PULL (Glide -> Shards Ledger):
   POST /api/glide/pull
   +-- Fetches: Locations, POs, Invoices, Check Requests
   +-- Saves to: glide-*.json files
   +-- Triggers: refresh-all-data.mjs

2. PUSH (Shards Ledger -> Glide):
   POST /api/glide/sync-pos
   +-- Reads: smartpo-parsed.json
   +-- Pushes to: Glide Purchase Orders table
   +-- Returns: added/updated/skipped counts

3. WEBHOOK (Glide -> Shards Ledger):
   POST /api/sync
   +-- Receives: Glide webhook payload
   +-- Merges: locations, POs, invoices, check requests
   +-- Triggers: refresh-all-data.mjs
```

---

## Commands Reference

```bash
cd /Users/jeffreyenneking/Shards_Ledger

# Development
npm run dev               # Start dev server (localhost:3000)
npm run build             # Production build

# Data Pipeline
npm run refresh           # Full data refresh (parallel, ~0.6s)
npm run refresh:locations # Location comparison only
npm run parse:ledgers     # Parse Excel ledgers only

# Validation & Analysis
npm run validate          # Validate data integrity
npm run validate:lines    # Validate line-item matching
npm run detect:duplicates # Detect duplicate line items
npm run analyze:locations # Analyze location mapping
npm run match:locations   # Run fuzzy matching engine

# Glide Integration
npm run mcp:build         # Build MCP server
npm run mcp:dev           # Run MCP server in dev mode
```

---

## Glide Table IDs (verified 2025-01-25)

| Glide Table | Table ID |
|-------------|----------|
| Locations: Master List | `native-table-PRIIMzLmQiCVsRIfzYEa` |
| Purchase Orders | `native-table-fo5Seg62UynLTbmFbEmZ` |
| Invoices | `native-table-1rujyipHG8Zv1PVWdmpf` |
| Check Requests | `native-table-7qA0wApval6ZMwuT4JeX` |

---

## Key Files Summary

| File | Size | Purpose |
|------|------|---------|
| `parsed-ledgers-detailed.json` | 1.5MB | **ALL ledger line items** - primary actuals data |
| `location-comparison.json` | 1.2MB | Computed: budget vs actuals by location |
| `glide-budget-line-items.json` | 1MB | Budget line items from Glide |
| `location-matches.json` | 106KB | Fuzzy matching results with confidence |
| `smartpo-parsed.json` | 121KB | Parsed SmartPO purchase orders |
| `duplicate-detection-results.json` | 80KB | Duplicate detection output |

---

## Current Status (as of Jan 28, 2025)

### Working
- Dashboard with top locations summary
- Budget, Blocks, Ledgers pages
- **Location-centric view** with expandable cards, episode tabs
- **Excel ledger parsing** (replaced OCR)
- **Intelligent fuzzy matching** (98% match rate, 99% $ coverage)
- **Location mapping review UI** at `/locations/mapping`
- **Duplicate detection** (prevents re-importing same line items)
- **File upload UI** at `/upload`
- Glide MCP server and sync endpoints

### Pending
- 92 pending matches need review at `/locations/mapping`
- 5 unmatched service fees

---

## Relationship to Other Systems

| System | Role | Integration |
|--------|------|-------------|
| **Shards Ledger App** | Primary UI | This app |
| **Glide App** | Source of truth for budgets | Two-way sync via API |
| **Location-Manager API** | Backend automation (separate project) | Webhook receiver |
| **Make.com** | Automation orchestration | Triggers webhooks |

---

## Important Notes for Weekly Sync

1. **Duplicate Prevention**: Already built! Kirsten can upload new ledgers every Friday without worrying about duplicates.

2. **No Database**: All data is JSON files. Simple, portable, easy to debug.

3. **Automatic Matching**: ~98% of locations match automatically. Kirsten only reviews the edge cases.

4. **Glide Sync**: Data flows both ways:
   - Budget data PULLS from Glide
   - PO/Invoice data can PUSH back to Glide

5. **Episode Blocks**:
   - Block 1: Episodes 101 + 102
   - Block 2: Episodes 104 + 105
   - Block 3: Episode 106
