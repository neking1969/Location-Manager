# Google Drive Auto-Sync — ACTIVE

## Status: LIVE

The auto-sync system is **built, deployed, and active**. When Kirsten drops files into the Google Drive folders, they are automatically processed within 15 minutes.

| Component | Status | Details |
|-----------|--------|---------|
| Google Drive Folders | Created | `jeffrey@enneking.company` Drive |
| Make.com Scenario | Active | ID: 4560202, polls every 15 min |
| Lambda Multipart Support | Deployed | Accepts file uploads via multipart/form-data |
| File Deduplication | Active | Same file won't be processed twice |
| Archive After Processing | Active | Files move to `/Archives/` after sync |

---

## How It Works

```
Kirsten drops file into Google Drive folder
  ↓ (within 15 minutes)
Make.com watches folder for new files
  ↓
Google Drive "Get a File" downloads the file content
  ↓
Router classifies by filename or parent folder
  ↓
HTTP POST sends file as multipart/form-data to Lambda /sync
  ↓
Lambda parses Excel, writes to S3, updates dashboard
  ↓
File is moved to /Archives/ folder
```

---

## Google Drive Folder Structure

**Account**: `jeffrey@enneking.company`
**Path**: `Shared with me > AF > The Shards: Season 1 > AA_FOR BUDGET TRACKING WEBSITE`

| Folder | Google Drive ID | File Types |
|--------|----------------|------------|
| `/Ledgers/` | `1ZWEcHz9oBYOm8gtXdxTJGFN8gzXWDgyn` | `{episode} 6304-6342 {date}.xlsx` |
| `/POs/` | `128JxBOum6mCt_XexA5dSGUKRiyU8xvsg` | `PO-Log-{date}.xlsx` |
| `/Check Requests/` | `1jwsFJu-QsyVVbv52k25klMZ5kVjALCHu` | Check request files |
| `/Invoices/` | `1barija6FSQ2POU4Mt9bhn3osFvZ6vdRY` | Invoice files |
| `/Archives/` | `1uHCPpgl7XG9_OZox60r6lhJbaw1x7Xg1` | Processed files (auto-moved) |

**Parent folder**: `AA_FOR BUDGET TRACKING WEBSITE` = `1ccQn099wEk5V2w6WmgtExw66azkgQu4M`

---

## Make.com Scenario Details

| Item | Value |
|------|-------|
| Scenario ID | 4560202 |
| Name | Shards: Google Drive Auto-Sync |
| Folder | Dez Production (231082) |
| Schedule | Every 15 minutes |
| Connection | `jeffrey@enneking.company` (ID: 1551176) |
| URL | https://us1.make.com/300311/scenarios/4560202/edit |

### Scenario Flow

1. **Watch Files in Folder** — Watches `AA_FOR BUDGET TRACKING WEBSITE` (including subfolders) for newly created files
2. **Get a File** — Downloads file content via Google Drive API
3. **Router** — Routes to 4 paths:
   - **Route 1 (Ledger)**: filename contains `6304-6342` → POST as `LEDGER`
   - **Route 2 (PO Log)**: filename contains `PO-Log` → POST as `SMARTPO`
   - **Route 3 (Invoice)**: parent folder is Invoices → POST as `INVOICE`
   - **Route 4 (Check Request)**: parent folder is Check Requests → POST as `CHECK_REQUEST`
4. **HTTP POST** — Sends file as multipart/form-data to Lambda `/sync`
5. **Move to Archives** — Moves processed file to `/Archives/` folder

---

## Testing

### Quick Test (Drop a file)
1. Open Google Drive: https://drive.google.com/drive/folders/1ZWEcHz9oBYOm8gtXdxTJGFN8gzXWDgyn
2. Upload a ledger file (e.g., `106 6304-6342 020626.xlsx`)
3. Wait up to 15 minutes (or manually run the scenario)
4. Check Make.com execution log: https://us1.make.com/300311/scenarios/4560202/edit
5. Check dashboard: https://main.d2nhaxprh2fg8e.amplifyapp.com

### Manual Trigger
To test immediately without waiting for the 15-minute poll:
- Go to the Make.com scenario and click "Run once"

### Curl Test (Direct Lambda)
```bash
curl -X POST \
  "https://6fjv2thgxf6r4x24na4y6ilgt40vstgl.lambda-url.us-west-2.on.aws/sync" \
  -F "file=@path/to/ledger.xlsx" \
  -F "fileType=LEDGER" \
  -F "syncSource=google-drive-auto" \
  -F "syncSessionId=test-$(date +%s)" \
  -F "fileName=106 6304-6342 020626.xlsx"
```

---

## Sharing Access with Kirsten

Kirsten (k.cornay@gmail.com) needs access to the Google Drive folders. To share:
1. Open: https://drive.google.com/drive/folders/1ccQn099wEk5V2w6WmgtExw66azkgQu4M
2. Click "Manage access"
3. Add `k.cornay@gmail.com` with **Editor** access
4. This gives her access to all subfolders (Ledgers, POs, etc.)

---

## Monitoring

- **Make.com executions**: https://us1.make.com/300311/scenarios/4560202/edit (Executions tab)
- **Lambda logs**: AWS CloudWatch → `/aws/lambda/location-manager-sync`
- **Dashboard**: https://main.d2nhaxprh2fg8e.amplifyapp.com
- **S3 data**: `s3://location-manager-prod/processed/`
