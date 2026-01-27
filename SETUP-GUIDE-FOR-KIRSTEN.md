# Permit Automation Setup Guide

## What This Does

**Automatically processes permit emails** so you never have to manually enter permit data again!

When a permit email arrives:
1. ✅ Email detected automatically
2. ✅ Claude AI extracts all permit details
3. ✅ PDF uploaded to Google Drive "Permits" folder
4. ✅ Record created in Airtable
5. ✅ Permit appears in "The Shards" Glide app
6. ✅ Email marked as read

**Zero manual work required!**

---

## Setup Steps (One Time Only)

### Step 1: Import Blueprint to Make.com

1. Go to https://www.make.com/en/login
2. Log in to your Make account
3. Click **"Scenarios"** in left sidebar
4. Click **"Create a new scenario"** button (top right)
5. Click the **three dots menu** (⋮) at bottom
6. Select **"Import Blueprint"**
7. Upload the file: `make-blueprint-complete.json`
8. Click **"Save"** → Scenario imported!

### Step 2: Connect Your Accounts

Make.com will ask you to connect these accounts (if not already connected):

#### A. Gmail Connection
- Account: **modernlocations@gmail.com**
- Purpose: Watch for permit emails
- Permissions: Read emails, mark as read

#### B. Google Drive Connection
- Account: **modernlocations@gmail.com**
- Purpose: Upload PDFs to Permits folder
- Permissions: Upload files to Shared Drive "DG Locations"

#### C. Airtable Connection
- Account: Your Airtable account
- Purpose: Create permit records
- Base: **DG Locations** (appY2qj52CCh0fESZ)
- Table: **Permits** (tblsGeGlKnZK2NPaX)

### Step 3: Turn On the Scenario

1. After all connections are set up
2. Click the **"ON"** toggle switch (bottom left)
3. Set schedule: **Every 15 minutes** (default)
4. Click **"OK"**

✅ **Done! The automation is now running!**

---

## How to Use

### Nothing to Do! 🎉

The automation runs **automatically every 15 minutes**:

1. Checks inbox for new unread emails with "permit" in subject
2. Only processes emails with PDF attachments
3. Parses, uploads, creates records
4. Marks email as read

### Where to Find Your Permits

**Google Drive**:
- Path: `modernlocations@gmail.com` → `Shared Drives` → `DG Locations` → `Permits`
- PDFs named: `[Permit#] - [Address] - [Date].pdf`

**Airtable**:
- Base: `DG Locations`
- Table: `Permits`
- All permit details in organized table

**Glide App** ("The Shards"):
- Open app on phone/tablet
- Go to Permits section
- See all permits with full details

---

## Testing the Automation

### Test with Sample Email

1. **Forward a real permit email** to modernlocations@gmail.com
2. Subject must include word "permit"
3. Must have PDF attachment
4. Wait 15 minutes (or trigger scenario manually in Make.com)
5. Check:
   - ✅ PDF in Google Drive Permits folder?
   - ✅ Record in Airtable Permits table?
   - ✅ Permit in Glide app?
   - ✅ Email marked as read?

### Manual Trigger (Optional)

1. Go to Make.com scenario
2. Click **"Run once"** button (bottom)
3. Watch it process in real-time!

---

## What Claude AI Extracts

### Basic Info (Always)
- Production title: "The Shards"
- Permit number: e.g., "FP-2025-1234"
- Permit type: e.g., "FilmLA Multi-Location"
- Status: "Approved" or "Pending"
- Release date
- Location manager name
- Contact phone
- Production office address

### Financial Info
- Total fee amount
- Fee breakdown (itemized)
- Invoice number
- Invoice date
- Payment status
- Balance due

### Location Details (For Each Location)
- Location ID/name
- Full address
- Location type (street, private property, etc.)
- Filming dates (start/end)
- Filming activities description
- Posting requirements
- Closure requirements
- Special terms/conditions

---

## Troubleshooting

### Permit Not Showing Up?

**Check these:**

1. ✅ Email has "permit" in subject?
2. ✅ Email has PDF attachment?
3. ✅ Email is unread?
4. ✅ Make scenario is "ON"?
5. ✅ Wait 15 minutes for next check

### Error in Make.com?

1. Go to Make.com scenario
2. Click **"History"** tab
3. Look for red errors
4. Click error to see details
5. Common issues:
   - Connection expired → Reconnect account
   - Invalid PDF → Forward different permit
   - API limit reached → Wait 1 hour

### Need Help?

Contact Jeff or check the scenario run history in Make.com for detailed error messages.

---

## Cost

**Anthropic Claude API**: ~$0.007 per permit
- **50 permits per season**: ~$0.35 total
- **Incredibly affordable!**

**Make.com**: Included in your current plan

---

## Advanced: Viewing Run History

1. Go to Make.com scenario
2. Click **"History"** tab (top)
3. See every execution:
   - ✅ Green = Success
   - ❌ Red = Error
   - ⏸️ Gray = No emails found
4. Click any run to see details
5. See exactly what Claude extracted

---

## Summary

**What you set up**: A fully automated permit processing system
**Time to set up**: 10-15 minutes (one time)
**Time saved**: Hours per week!
**Manual work required**: Zero ✨

Just forward or receive permit emails, and everything happens automatically!

---

## Files Reference

- `make-blueprint-complete.json` - The complete automation blueprint
- `PERMIT-AUTOMATION-PLAN.md` - Technical details
- `glide-permit-integration.md` - Glide table schema
- `CLAUDE.md` - Project documentation

---

**Questions?** Ask Jeff!
