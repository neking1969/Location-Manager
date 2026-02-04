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
- **Ledger Dashboard (ONLY External UI)**: https://main.d2nhaxprh2fg8e.amplifyapp.com/locations

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

### AWS Lambda
| Item | Value |
|------|-------|
| Function Name | `location-manager-sync` |
| Region | `us-west-2` |
| Base URL | `https://6fjv2thgxf6r4x24na4y6ilgt40vstgl.lambda-url.us-west-2.on.aws` |
| Sync Endpoint | `https://6fjv2thgxf6r4x24na4y6ilgt40vstgl.lambda-url.us-west-2.on.aws/sync` |
| Health Endpoint | `https://6fjv2thgxf6r4x24na4y6ilgt40vstgl.lambda-url.us-west-2.on.aws/health` |

### AWS Lambda (Sync Status Reader)
| Item | Value |
|------|-------|
| Function Name | `location-manager-sync-status` |
| Function URL | `https://hhg666k2cv4wr6txkqjxtqutlu0hwuer.lambda-url.us-west-2.on.aws/` |
| Purpose | Reads S3 for dashboard polling |

### Dashboard
| Item | Value |
|------|-------|
| **ONLY External UI** | **This is the ONLY UI (outside Glide) for this project** |
| Dashboard URL | `https://main.d2nhaxprh2fg8e.amplifyapp.com` |
| Locations Page | `https://main.d2nhaxprh2fg8e.amplifyapp.com/locations` |

---

## Deploy Command

```bash
cd ~/Projects/Location-Manager
bash lambda/deploy.sh
```

---

## Recent Changes (2026-02-03)

1. ✅ **Moved to Local Storage** - Project now at `~/Projects/Location-Manager`
2. ✅ **Handler File Download Fixed** - `lambda/handler.js` now downloads files from URLs
3. ✅ **Multi-Pass Location Inference** - dates → vendor → episode primary → overhead
4. ✅ **Payroll Date Pattern** - Recognizes `MM/DD/YY :` format
5. ✅ **Git Repository Initialized** - Version control enabled

---

## Learnings & Gotchas

1. **Local storage is FAST** - Google Drive CloudStorage path is extremely slow (30+ min for rsync)
2. **Lambda handler must download files** - URLs from Make.com/Glide need to be downloaded before processing
3. **Glide URLs are temporary** - Storage URLs expire, return 403 after expiration
4. **Episode 101+102 Block** - Accounting treats these as one block, all transactions show as "Episode 101"
5. **Summary rows in ledgers** - Excel files have total rows that must be filtered out

---

## Architecture

```
Glide App (data entry)
  ↓ webhook
Make.com (relay)
  ↓ HTTP POST
Lambda: location-manager-sync (processing ~4s)
  ↓ writes to S3
S3 Bucket (location-manager-prod/processed/)
  ↓
Lambda: location-manager-sync-status (reads S3)
  ↑ polls every 3s via Function URL
Dashboard (Shards-Ledger-App /api/sync-status)
  ↓ auto-refresh when detected
User sees new data
```

---

## CRITICAL Rules

- **Shards-Ledger-App** is the **ONLY** external UI for this project
- **Glide** is **ONLY** for data entry (file uploads, forms)
- **NEVER** suggest building new dashboards or UIs
- All data display happens in Shards-Ledger-App
