# Location-Manager Project

> **First thing every session:** Read `LEARNINGS.md` for past debugging discoveries and gotchas before starting work.

> Cross-cutting patterns → see global ~/.claude/CLAUDE.md

Budget tracking and Glide synchronization for The Shards TV production.

**Project Location**: `~/Projects/Location-Manager` (local SSD)
**GitHub**: https://github.com/neking1969/Location-Manager

## Quick Start

**Dev command**: `bash lambda/deploy.sh` (deploys Lambda)

**Key URLs:**
- Glide App: https://go.glideapps.com/app/TFowqRmlJ8sMhdap17C0
- Glide Live: https://the-shards-season-1-fcmz.glide.page
- **Ledger Dashboard**: https://ledger.dglocations.com (custom domain)
- Dashboard (old URL): https://main.d2nhaxprh2fg8e.amplifyapp.com

---

## Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| Google Drive Direct Sync | ACTIVE | Lambda scans Google Drive directly, EventBridge every 15 min |
| Custom Domain | LIVE | `ledger.dglocations.com` via Route 53 + Amplify |
| EventBridge Auto-Sync | ACTIVE | `shards-ledger-auto-sync` rule fires every 15 min |
| PRODUCTION STATUS | READY | All systems go! |

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

### Google Drive Direct Sync
| Item | Value |
|------|-------|
| Service Account | `shards-sync@shards-ledger-sync.iam.gserviceaccount.com` |
| Auth Method | Service account JSON key, base64-encoded in Lambda env var `GOOGLE_SERVICE_ACCOUNT_KEY` |
| Auto-Sync | EventBridge rule `shards-ledger-auto-sync` every 15 min |
| On-Demand | Sync Now button → Lambda `/trigger-sync` |
| **Make.com DEACTIVATED** | Scenarios 4560594 + 4560595 no longer used |

### Google Drive Folders
| Folder | Google Drive ID | Purpose |
|--------|----------------|---------|
| Ledgers | `1ZWEcHz9oBYOm8gtXdxTJGFN8gzXWDgyn` | Drop GL Ledger Excel files here |
| POs | `128JxBOum6mCt_XexA5dSGUKRiyU8xvsg` | Drop SmartPO Excel files here |
| Processed | `1uHCPpgl7XG9_OZox60r6lhJbaw1x7Xg1` | Files moved here after sync |

### Route 53 / Custom Domain
| Item | Value |
|------|-------|
| Domain | `dglocations.com` (registered at GoDaddy, DNS on Route 53) |
| Hosted Zone ID | `Z06569953HSJVZ2LIK2PK` |

### AWS Lambda (Main)
| Item | Value |
|------|-------|
| Function Name | `location-manager-sync` |
| Region | `us-west-2` |
| Base URL | `https://6fjv2thgxf6r4x24na4y6ilgt40vstgl.lambda-url.us-west-2.on.aws` |
| **Data Endpoint** | `https://6fjv2thgxf6r4x24na4y6ilgt40vstgl.lambda-url.us-west-2.on.aws/data` |
| **Trigger Sync** | `https://6fjv2thgxf6r4x24na4y6ilgt40vstgl.lambda-url.us-west-2.on.aws/trigger-sync` |

### AWS Lambda (Sync Status Reader)
| Item | Value |
|------|-------|
| Function Name | `location-manager-sync-status` |
| Function URL | `https://hhg666k2cv4wr6txkqjxtqutlu0hwuer.lambda-url.us-west-2.on.aws/` |

### AWS S3 Bucket
| Item | Value |
|------|-------|
| Bucket Name | `location-manager-prod` |
| Ledger Data | `processed/parsed-ledgers-detailed.json` |
| Budget Data | `static/parsed-budgets.json` |
| File Confirmations | `processed/file-confirmations.json` |

### Dashboard
| Item | Value |
|------|-------|
| **ONLY External UI** | **Shards-Ledger-App is the ONLY UI (outside Glide)** |
| **Dashboard URL** | **`https://ledger.dglocations.com`** |
| Amplify App ID | `d2nhaxprh2fg8e` |
| GitHub Repo | `https://github.com/neking1969/Shards_Ledger` |

---

## Recent Changes (2026-02-14)

> Older changes archived in CHANGELOG.md

40. **Custom Domain `ledger.dglocations.com`** - Route 53 hosted zone, SSL CNAME, GoDaddy nameservers changed.

39. **Replaced Make.com with Direct Google Drive Sync** - Lambda scans Google Drive directly via service account. New flow: JWT auth → list files → download → process → move to Processed.

38. **EventBridge 15-Minute Auto-Sync** - `shards-ledger-auto-sync` rule replaces Make.com polling.

37. **Auto-Expand Location Cards from Dashboard** - Clicking location auto-expands card with scroll-into-view.

36. **Full Dashboard Test Suite** - 10 Playwright tests, 19/19 values match Lambda source of truth.

35. **Report Date Fix for Episode 102** - Derives `reportDate` from transaction data when filename can't be parsed.

34. **PO Number Display Fix** - `transformLocation()` now passes through `poNumber`, `documentNumber`, `effectiveDate`.

33. **Unmapped Locations Verified Working** - 41 unmapped locations, mapping UI functional.

32. **Sync Now Button Fix (Complete)** - Created subfolder-specific Watch scenarios.

31-28. File dedup clearing, SmartPO independent write, Feb 13 ledger sync, dedup marking fix.

---

## Learnings & Gotchas

1. **Lambda handler must download files** - URLs from Make.com/Glide need to be downloaded before processing
2. **Glide URLs are temporary** - Storage URLs expire, return 403
3. **Episode 101+102 Block** - Accounting treats as one block, all show as "Episode 101"
4. **GL codes are per-row in Excel** - Column C, not per-file
5. **GL 6304/6305/6307/6342 = location labor** - Even from EP payroll vendor
6. **Budget episode resolution** - Requires traversing Glide relations: lineItem.budgetId → budget.episodeId
7. **Category budgets != totalFromMake** - Always use `ep.totalBudget`, not category sums
8. **GL 6342 subcategories** - Maps to multiple budget categories via description (PARKING, PERMIT, DUMPSTER, etc.)
9. **Use Lambda's pre-computed category** - Dashboard uses `tx.category`, not recalculate
10. **NEVER filter out service charge transactions** - $931K was incorrectly dropped by old `isServiceCharge()` filter
11. **txId hash must include rowIndex + filename** - Identical rows produce same hash without these
12. **Kirsten's totals are authoritative** - Dashboard should match her numbers
13. **Budget parser must propagate totalFromMake to all maps** - byEpisodeCategory and byCategoryLocationEpisode too
14. **Lambda env vars** - `GLIDE_APP_ID`, `GLIDE_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_KEY` (base64), `GDRIVE_*_FOLDER_ID`, `AWS_S3_BUCKET`
15. **File deletion is episode-scoped for ledgers** - `/files/delete` removes ALL groups for that episode
16. **Google Drive service account auth** - Use `google-auth-library` GoogleAuth with `credentials` from base64-decoded JSON
17. **Google Drive file move** - `PATCH /drive/v3/files/{id}?addParents={to}&removeParents={from}`
18. **EventBridge → Lambda** - Events have `event.source === 'aws.events'`, no HTTP routing fields
19. **Make.com eliminated** - Direct Google Drive API is faster, cheaper, more reliable

---

## Architecture (Cloud-Only, No Make.com)

```
Kirsten drops files into Google Drive (Ledgers/ or POs/ folder)
  ↓
EventBridge (every 15 min) OR Sync Now button
  ↓ triggers
Lambda: location-manager-sync → Google Drive API (service account auth)
  ↓ lists files, downloads, processes, moves to Processed/
S3 Bucket: location-manager-prod/
  ↓ reads via /data endpoint (fresh Glide budgets + S3 actuals)
Amplify: Shards-Ledger-App → Dashboard UI: https://ledger.dglocations.com
```

---

## Reconciliation Reference (2026-02-14)

| Metric | Value |
|--------|-------|
| Budget | $7,316,027.00 |
| Actual | $6,447,727.59 |
| Variance | $868,299.41 |
| Locations with actuals | 43/50 |
| Locations over budget | 13 |

### Known Open Items
1. **Ep 105 budget discrepancy** - Kirsten=$840,390, Glide=$821,355. Glide data issue.
2. **41 PENDING locations** - Real filming locations ($233K) needing Glide budget entries.

---

## CRITICAL Rules

- **Shards-Ledger-App** is the **ONLY** external UI for this project
- **Glide** is **ONLY** for data entry (file uploads, forms)
- **NEVER** suggest building new dashboards or UIs
- **Dashboard reads from Lambda/S3** - no local file dependencies
