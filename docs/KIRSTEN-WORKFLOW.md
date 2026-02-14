# Kirsten's Dashboard Workflow

## Your Dashboard
**https://main.d2nhaxprh2fg8e.amplifyapp.com**

Bookmark this link. It's your one-stop shop for budget vs actuals across all episodes.

---

## What You Need To Do

When you receive new files from EP Accounting, save them to the correct Google Drive folder. That's it. The system handles everything else automatically.

### Google Drive Location
**Google Drive > Shared with me > AF > The Shards: Season 1 > AA_FOR BUDGET TRACKING WEBSITE**

Direct link: https://drive.google.com/drive/folders/1ccQn099wEk5V2w6WmgtExw66azkgQu4M

### Folder Guide

| You Receive... | Save It To... | Example Filename |
|----------------|---------------|------------------|
| GL Ledger (Excel) | `/Ledgers/` | `101 6304-6342 020626.xlsx` |
| PO Log (Excel) | `/POs/` | `PO-Log-02072026.xlsx` |
| Check Request | `/Check Requests/` | Any filename works |
| Invoice | `/Invoices/` | Any filename works |

### Important Notes
- **Ledger files must follow the naming pattern**: `{episode} 6304-6342 {date}.xlsx`
  - Example: `105 6304-6342 021326.xlsx`
  - The system uses the episode number and GL range in the filename to identify it
- **PO files must start with** `PO-Log`
- **Invoices and Check Requests** can have any filename — they're logged for reference
- **Don't worry about duplicates** — if you accidentally save the same file twice, the system detects it and skips the duplicate

---

## What Happens Automatically

1. You drop a file into the Google Drive folder
2. Make.com detects the new file (within 15 minutes)
3. The file is sent to our processing system (Lambda)
4. Transactions are parsed, categorized, and matched to locations
5. The dashboard updates with new data
6. The original file is moved to `/Archives/` so you know it was processed

**Total time from file drop to dashboard update: ~15 minutes** (scenario polls every 15 min)

### Sync Now Button
Don't want to wait 15 minutes? Click the **Sync Now** button in the top navigation bar. This immediately triggers the Google Drive check. You'll see a spinner while it's working, then a checkmark when done.

---

## When You Open the Dashboard

The dashboard is **blurred out** when you first open it. This is by design — you need to verify the source files are correct before trusting the numbers.

1. You'll see **Source File cards** at the top (not blurred)
2. Review each file — check the episode, transaction count, and report date
3. Click **"Confirm Current & Accurate"** on each file card
4. Once all files are confirmed, the blur lifts and the full dashboard is visible

This happens every time you visit the dashboard, so you always verify the data is fresh.

### Deleting a Wrong File

If you uploaded the wrong file or need to replace one with a newer version:

1. Click the **trash icon** (🗑) on the file card you want to remove
2. A confirmation popup shows the file name, transaction count, and dollar amount
3. Click **"Delete File"** to remove it, or **"Cancel"** to keep it
4. The file's data is removed from the dashboard immediately
5. Drop the corrected file into the Google Drive folder and click **Sync Now**

---

## Dashboard Pages (What They Show)

### Dashboard (Summary)
The main overview. Shows total budget, total actual, variance, and quick stats like how many locations are over budget.

### Cost Report (Topsheet)
A spreadsheet-style view of every location with category breakdowns (Loc Fees, Equipment, Parking, Security, etc.). You can:
- Search for specific locations
- Filter by episode
- Sort by any column
- Export to CSV

### Budget vs Actuals
Episode-by-episode breakdown showing budget, actual, and variance for each GL category. Click any category row to see individual transactions. Color-coded: green = under budget, red = over budget.

### Ledgers
Raw ledger data grouped by episode. Shows transaction counts and totals per GL account file. Click to expand and see individual transactions.

### Locations
List of all 50 budgeted locations with their spend. Also shows unmapped locations (transactions the system couldn't match to a Glide budget entry).

### Upload
Manual upload interface (you probably won't need this — the Google Drive auto-sync handles it).

---

## Dashboard Numbers You Care About

These are the key numbers from the current data (as of Feb 13, 2026):

| Metric | Value |
|--------|-------|
| **Total Budget** | $7,316,027 |
| **Total Actual (GL Spend)** | $6,413,088 |
| **Total Variance** | $902,939 under budget |
| **Budgeted Locations** | 50 |
| **Transactions Processed** | 1,912 |

### Per Episode
| Episode | Budget | Actual | Variance |
|---------|--------|--------|----------|
| 101/102 | $3,850,403 | $4,203,201 | $352,798 OVER |
| 104 | $1,427,919 | $1,389,831 | $38,088 under |
| 105 | $821,355 | $745,323 | $76,032 under |
| 106 | $120,795 | $74,734 | $46,061 under |
| 108 | $1,095,555 | $0 | Budget only |

---

## If Something Looks Wrong

1. **Numbers seem stale**: Click the **Sync Now** button in the top nav, or press `Cmd + Shift + R` (hard refresh) to clear the cache
2. **Dashboard is blurred**: You need to confirm the source files first. Review the file cards at the top and click "Confirm Current & Accurate" on each one
3. **A location is "unmapped"**: The system couldn't match a ledger location name to a Glide budget entry. Let Jeffrey know and he'll update the mapping
4. **A new file didn't process**: Check the Archives folder in Google Drive — if the file was moved there, it processed. If it's still in the original folder, click Sync Now or wait for the next 15-minute cycle
5. **Episode totals don't match your spreadsheet**: The dashboard uses GL ledger data as the source of truth. Small rounding differences (pennies) are normal
6. **Wrong file was uploaded**: Click the trash icon on the file card → confirm deletion → drop the correct file into Google Drive → click Sync Now

---

## Contacts

- **Jeffrey Enneking** — Dashboard technical support
- **Dashboard URL**: https://main.d2nhaxprh2fg8e.amplifyapp.com
- **Glide App**: https://the-shards-season-1-fcmz.glide.page
