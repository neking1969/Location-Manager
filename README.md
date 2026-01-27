# Location Manager - Permit Automation

Automatic permit tracking system for "The Shards" TV production using Claude AI.

## Quick Start

**For Kirsten**: See [`SETUP-GUIDE-FOR-KIRSTEN.md`](SETUP-GUIDE-FOR-KIRSTEN.md)

**For Developers**: See [`CLAUDE.md`](CLAUDE.md)

## What This Does

Automatically processes permit emails:
1. Monitors Gmail (modernlocations@gmail.com)
2. Parses with Claude AI
3. Stores PDFs in Google Drive
4. Creates Airtable records
5. Syncs to Glide "The Shards" app

**Zero manual data entry!**

## Files

- ⭐ **`make-blueprint-final.json`** - Import this to Make.com (recommended)
- `SETUP-GUIDE-FOR-KIRSTEN.md` - Simple setup guide
- `CLAUDE.md` - Complete documentation
- `PERMIT-AUTOMATION-PLAN.md` - Technical details
- `glide-permit-integration.md` - Glide schema

## Setup

1. Import `make-blueprint-final.json` to Make.com
2. Add your Anthropic API key to the Claude module
3. Connect Gmail, Google Drive, Airtable accounts
4. Turn scenario ON
5. Done!

## Cost

~$0.007 per permit (~$0.35 for 50 permits/season)

## Support

See documentation files or contact Jeff.
