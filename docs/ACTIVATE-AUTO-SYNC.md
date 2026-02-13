# Activate Google Drive Auto-Sync

## What This Does
When activated, any file dropped into the Google Drive budget tracking folders will automatically be processed and appear on the dashboard within 2-3 minutes.

## Status
- Lambda: Ready (deployed with /sync endpoint and file type detection)
- Blueprint: Ready (at `blueprints/google-drive-auto-sync-scenario.json`)
- Make.com: Needs manual setup (Google Drive connection required)

---

## Setup Steps (Jeffrey does this once)

### Step 1: Connect Google Drive in Make.com

The `modernlocations@gmail.com` Google account is not yet connected in Make.com.

1. Go to **Make.com** > **Connections**: https://us1.make.com/300311/connections
2. Click **Add Connection**
3. Choose **Google**
4. Sign in with **modernlocations@gmail.com**
5. Grant permissions for Google Drive access
6. Name it: `Modern Locations Google Drive`

### Step 2: Create the Auto-Sync Scenario

1. Go to **Make.com** > **Scenarios**: https://us1.make.com/300311/scenarios
2. Click **Create a new scenario**
3. Name it: `Shards: Google Drive Auto-Sync`

### Step 3: Add Google Drive Trigger

1. Click the **+** to add a module
2. Search for **Google Drive**
3. Choose **Watch Files in a Folder**
4. Connection: Select the `Modern Locations Google Drive` connection
5. Folder: Navigate to:
   ```
   My Drive > THE SHARDS - SEASON 1 > AA_FOR BUDGET TRACKING WEBSITE
   ```
6. Watch: **Files Created**
7. Limit: **10**
8. **Important**: Check "Watch Subfolders" so it catches files in /Ledgers/, /POs/, etc.

### Step 4: Add Router Module

1. After the Google Drive trigger, add a **Router**
2. Create 4 routes:

**Route 1 - Ledgers**
- Filter: Filename matches `\d{3}\s+6304-6342` (regex)
- OR: Folder path contains `Ledgers`

**Route 2 - PO Log**
- Filter: Filename starts with `PO-Log`
- OR: Folder path contains `POs`

**Route 3 - Invoices**
- Filter: Folder path contains `Invoices`

**Route 4 - Check Requests**
- Filter: Folder path contains `Check Requests`

### Step 5: Add HTTP Module to Each Route

For each route, add an **HTTP > Make a request** module:

- **URL**: `https://6fjv2thgxf6r4x24na4y6ilgt40vstgl.lambda-url.us-west-2.on.aws/sync`
- **Method**: POST
- **Body type**: JSON
- **Body**:
  ```json
  {
    "fileUrl": "{{webContentLink from Google Drive trigger}}",
    "fileName": "{{name from Google Drive trigger}}",
    "filePath": "{{parents folder name}}",
    "syncSource": "google-drive-auto",
    "fileType": "LEDGER"
  }
  ```
  (Change `fileType` for each route: LEDGER, SMARTPO, INVOICE, CHECK_REQUEST)

### Step 6: Add Archive Step (Optional)

After each HTTP module, add a **Google Drive > Move a File** module:
- Move the processed file to the `/Archives/` folder
- This prevents reprocessing and shows Kirsten which files have been handled

### Step 7: Activate

1. Click the **ON/OFF toggle** to activate the scenario
2. Set scheduling to **Immediately** (triggers on file creation)
3. Save

---

## Quick Alternative: Import Blueprint

Instead of building from scratch, you can import the pre-built blueprint:

1. Go to Make.com > Scenarios > Create New
2. Click the **...** menu > **Import Blueprint**
3. Upload: `/Volumes/Photos/Projects/Location-Manager/blueprints/google-drive-auto-sync-scenario.json`
4. The blueprint will need you to:
   - Select the Google Drive connection (Step 1 above must be done first)
   - Set the folder ID for the watched folder
5. Activate the scenario

---

## Testing

After activation, test by dropping a file into `/Ledgers/`:

1. Copy any existing ledger file (e.g., `101 6304-6342 020626.xlsx`)
2. Rename it slightly (e.g., add a space at the end)
3. Drop it in the `/Ledgers/` folder
4. Wait 2-3 minutes
5. Check the dashboard — the file should be detected as a duplicate (same content hash) and skipped
6. Check the Make.com scenario execution log to verify it ran

To test with truly new data, you'll need a new ledger file from EP Accounting.

---

## Monitoring

- **Make.com execution history**: https://us1.make.com/300311/scenarios/4528779/edit (click Executions tab)
- **Lambda logs**: Check AWS CloudWatch for `location-manager-sync`
- **Dashboard**: Numbers should update within 2-3 minutes of file drop
