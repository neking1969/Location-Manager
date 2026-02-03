# Location-Manager

Budget tracking and Glide synchronization for The Shards TV production.

**Last Updated**: February 3, 2026

## Quick Status

| Component | Status |
|-----------|--------|
| Glide Sync Sessions Table | ✅ Complete |
| Weekly Sync Screen | ✅ Complete |
| Make.com Scenario | ✅ Complete |
| Lambda API | ✅ Deployed |
| File Download Handler | ✅ Complete |
| Location Inference | ✅ Complete |
| S3 Data Persistence | ✅ Complete |
| Dashboard Integration | ✅ Complete |
| End-to-End Workflow | ✅ Production Ready |

---

## For Kirsten: Weekly Sync Workflow

Every Friday when you receive new ledgers from accounting:

1. Open the **Glide app** → https://the-shards-season-1-fcmz.glide.page
2. Click **"More"** → **"Weekly Sync"**
3. Click the **"+"** button or click an existing session
4. Upload the **Ledger file** (drag & drop or click)
5. Upload the **SmartPO file** (optional)
6. Click **"Submit"**
7. Browser automatically opens the **Dashboard**
8. Wait for blue banner: "New ledger data detected!"
9. Dashboard auto-refreshes with new data
10. Done! ✓

That's it - no terminal, no CSV imports, no switching apps.

---

## Technical Setup

### Prerequisites

- Node.js 18+
- AWS CLI configured
- Glide API access (API key + App ID)
- Make.com account (for automation)

### Installation

```bash
cd ~/Projects/Location-Manager
npm install
```

### Environment Variables

```env
GLIDE_API_KEY=ad54fb67-06fe-40b1-a87d-565a003c3f49
GLIDE_APP_ID=TFowqRmlJ8sMhdap17C0
PORT=3001
```

### Local Development

```bash
npm start          # Start API server on port 3001
npm run dev        # Start with auto-reload
npm test           # Test Glide connection
```

### Lambda Deployment

```bash
cd ~/Projects/Location-Manager
bash lambda/deploy.sh
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sync` | POST | Process ledger files, match locations/vendors |
| `/approve` | POST | Import approved review items to Glide |
| `/health` | GET | Health check |

**Lambda Function URL**: `https://6fjv2thgxf6r4x24na4y6ilgt40vstgl.lambda-url.us-west-2.on.aws`

---

## Architecture

```
┌─────────────────────┐
│    Glide App        │
│   Weekly Sync       │
│     Screen          │
└──────────┬──────────┘
           │ User uploads file, triggers workflow
           ▼
┌─────────────────────┐
│    Make.com         │
│    Webhook          │
│    Scenario         │
└──────────┬──────────┘
           │ 1. Update Glide status → "Processing"
           │ 2. Call Lambda with file URLs
           │ 3. Update Glide with results
           ▼
┌─────────────────────┐
│  Location-Manager   │
│    Lambda API       │
│   /sync endpoint    │
└──────────┬──────────┘
           │ 1. Download files from Glide URLs
           │ 2. Parse Excel data
           │ 3. Multi-pass location inference
           │ 4. Match locations/vendors
           │ 5. Write to S3
           ▼
┌─────────────────────┐
│   Shards-Ledger-App │
│     Dashboard       │
│  (auto-refresh)     │
└─────────────────────┘
```

---

## Project Structure

```
Location-Manager/
├── src/
│   ├── index.js              # Entry point (Lambda + Express)
│   ├── api/
│   │   └── sync.js           # Main sync endpoint
│   ├── parsers/
│   │   ├── ledger.js         # Excel ledger parsing + date extraction
│   │   └── smartpo.js        # SmartPO parsing
│   ├── matchers/
│   │   ├── location.js       # Location matching
│   │   ├── vendor.js         # Vendor matching
│   │   ├── dateLocation.js   # Date-based location inference
│   │   ├── vendorLocationMap.js  # Vendor history inference
│   │   └── productionOverhead.js # Overhead categorization
│   ├── glide/
│   │   ├── client.js         # Glide API wrapper
│   │   └── tables.js         # Table IDs and column mappings
│   └── utils/
│       ├── fuzzyMatch.js     # Fuzzy string matching
│       ├── fileUtils.js      # File utilities
│       └── downloadFile.js   # URL → Buffer download
├── lambda/
│   ├── handler.js            # AWS Lambda handler (downloads files)
│   └── deploy.sh             # Deployment script
├── docs/
│   └── WEEKLY-SYNC-SETUP.md  # Complete setup guide
├── package.json
├── .env
├── CLAUDE.md                 # Project context for Claude sessions
└── README.md
```

---

## Key IDs Reference

### Glide

| Item | Value |
|------|-------|
| App ID | `TFowqRmlJ8sMhdap17C0` |
| App URL | https://go.glideapps.com/app/TFowqRmlJ8sMhdap17C0 |
| Live URL | https://the-shards-season-1-fcmz.glide.page |
| Sync Sessions Table | `native-table-03Yk3buCk0yZOF5dzh4i` |

### Make.com

| Item | Value |
|------|-------|
| Scenario ID | 4528779 |
| Scenario URL | https://us1.make.com/300311/scenarios/4528779/edit |
| Webhook URL | `https://hook.us1.make.com/k3snwjfpk65auz4wa49tiancqdla1d1o` |

### AWS Lambda

| Item | Value |
|------|-------|
| Function Name | `location-manager-sync` |
| Region | `us-west-2` |
| Function URL | `https://6fjv2thgxf6r4x24na4y6ilgt40vstgl.lambda-url.us-west-2.on.aws` |

### Dashboard

| Item | Value |
|------|-------|
| URL | https://main.d2nhaxprh2fg8e.amplifyapp.com |
| Project | Shards-Ledger-App |

---

## Quick Test Commands

### Test Health Endpoint
```bash
curl https://6fjv2thgxf6r4x24na4y6ilgt40vstgl.lambda-url.us-west-2.on.aws/health
```

### Test Sync Endpoint (no file)
```bash
curl -X POST "https://6fjv2thgxf6r4x24na4y6ilgt40vstgl.lambda-url.us-west-2.on.aws/sync" \
  -H "Content-Type: application/json" \
  -d '{"syncSessionId": "test"}'
```

### View Lambda Logs
```bash
aws logs tail /aws/lambda/location-manager-sync --region us-west-2 --follow
```

---

## Location Inference Pipeline

The system uses a multi-pass algorithm to maximize location matching:

1. **Explicit Locations**: Extract location names from description field
2. **Date-based Inference**: Match dates to known filming locations
   - Episode-specific date lookup
   - Global date lookup (all episodes)
   - Episode primary location fallback
3. **Vendor-based Inference**: Infer from vendor's historical location patterns
4. **Production Overhead**: Categorize payroll/permits as non-location-specific

This reduces unmatched spend from ~$678K to ~$28K (96% improvement).

---

## Recent Updates (2026-02-03)

- ✅ Moved project to local storage (`~/Projects/Location-Manager`)
- ✅ Fixed Lambda handler to download files from Glide URLs
- ✅ Added multi-pass location inference (dates → vendor → overhead)
- ✅ Added payroll date pattern recognition (`MM/DD/YY :`)
- ✅ Dashboard auto-refresh on new sync data
- ✅ S3 data persistence for all processed data
