# The Shards: Location-Manager System Overview

## Document History
- **Created**: January 28, 2025
- **Last Updated**: January 29, 2025 (Weekly Sync COMPLETE)
- **Authors**: Claude (AI Assistant), Jeffrey Enneking

---

## Executive Summary

The Location-Manager system is a budget tracking and synchronization tool for **The Shards** TV production (Season 1). It connects multiple platforms to streamline the workflow of tracking location budgets, actuals from accounting ledgers, and permit information.

### Key Stakeholders
- **Kirsten** - Primary user who uploads weekly ledger files
- **Jeffrey Enneking** - System administrator and developer
- **Production Team** - Consumers of budget reports and location data

---

## System Architecture

```
+-----------------------------------------------------------------------+
|                         THE SHARDS ECOSYSTEM                           |
+-----------------------------------------------------------------------+
|                                                                        |
|  +--------------+     +--------------+     +------------------+        |
|  |   GLIDE      |     |   MAKE.COM   |     | LOCATION-MANAGER |        |
|  |  (Frontend)  |---->| (Automation) |---->|    (API/Node)    |        |
|  |              |     |              |     |                  |        |
|  | "The Shards: |     | Webhooks &   |     | - Ledger parsing |        |
|  |  Season 1"   |     | Scenarios    |     | - Fuzzy matching |        |
|  +--------------+     +--------------+     | - Budget calc    |        |
|         |                    |             +------------------+        |
|         |                    |                                         |
|         v                    v                                         |
|  +--------------+     +--------------+                                 |
|  | GOOGLE DRIVE |     |  AIRTABLE    |                                 |
|  |              |     |              |                                 |
|  | - Ledger     |     | - Permits    |                                 |
|  |   uploads    |     | - Locations  |                                 |
|  | - SmartPO    |     |   (mirror)   |                                 |
|  +--------------+     +--------------+                                 |
|                                                                        |
+-----------------------------------------------------------------------+
```

---

## Platform Details

### 1. Glide App: "The Shards: Season 1"

**Purpose**: Primary user interface for the production team

**URL**: https://go.glideapps.com/app/TFowqRmlJ8sMhdap17C0

**Key Tables** (see [GLIDE-SCHEMA.md](./GLIDE-SCHEMA.md) for full details):
| Table | Purpose |
|-------|---------|
| Locations: Master List | All filming locations |
| Locations: Budgets | Budget data per location |
| Budget: Line Items | Individual line items for each budget |
| Vendors | Vendor/payee master list |
| Contacts | Production contacts |
| Permits | Permit tracking |
| Assignments | Location assignments |

**Key Screens**:
- Budgets
- Locations: Master List
- Contacts
- Vendors
- Assignments
- Permits
- Weekly Sync (IMPLEMENTED - under "More" menu)

**Workflows Created**:
- "Dez: Location-Manager Weekly Sync" - Weekly scheduled trigger to Make.com

---

### 2. Make.com

**Purpose**: Automation hub connecting Glide, Google Drive, and Location-Manager API

**Organization**: Enneking Lab (ID: 300311)

**Key Folder**: "Dez Locations" (ID: 231082)

**Scenarios in Dez Locations folder**:
| Scenario | Status | Purpose |
|----------|--------|---------|
| Dez: Location-Manager Weekly Sync (ID: 4528779) | Configured | Weekly sync trigger from Glide (HTTP module ready) |
| Dez: New Location-Add a Location Budget | Active | Creates budget when location added |
| Dez: Update Location-Update Location Budget row | Active | Updates budget when location modified |
| (Multiple others) | Various | Various automation tasks |

**Key Webhooks**:
| Webhook | URL | Used By |
|---------|-----|---------|
| Dez-Location-Manager-Sync | `https://hook.us1.make.com/k3onejon45ao1wv4fdlwcqpbl4bflo` | Glide Weekly Sync workflow |

---

### 3. Airtable

**Purpose**: Permit tracking and location data (possibly legacy or parallel system)

**Base**: Permits: Locations (ID: app1uceo07zHkAFEt)

**Key Tables**:
| Table | Record Count | Purpose |
|-------|--------------|---------|
| Location | 23 records | Location master data |
| (Others TBD) | - | Permit tracking |

**Fields in Location Table**:
- Location (name)
- Address (linked/computed)
- Type
- Contact Name
- Contact Email
- Notes
- Status
- Created/Modified timestamps

---

### 4. Location-Manager API (This Project)

**Purpose**: Backend processing for ledger parsing, matching, and budget calculations

**Technology**: Node.js/Express, deployable to AWS Lambda

**Endpoints**:
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/sync` | POST | Process ledger files, match locations/vendors |
| `/approve` | POST | Import approved review items to Glide |
| `/health` | GET | Health check |

**Key Capabilities**:
- Excel/CSV ledger parsing
- Fuzzy string matching for locations and vendors
- Budget vs actuals calculations
- Glide API integration

---

## Data Flow: Weekly Sync Process

### Current Understanding (as of Jan 28, 2025)

```
FRIDAY: Kirsten receives ledgers from accounting
           |
           v
+-----------------------------------------+
| STEP 1: Upload Ledgers                  |
|                                         |
| Kirsten opens Glide app                 |
| Goes to "Weekly Sync" tab               |
| Uploads ledger files (PDF/Excel)        |
| Uploads SmartPO file (if available)     |
+-----------------------------------------+
           |
           v
+-----------------------------------------+
| STEP 2: Trigger Sync                    |
|                                         |
| Kirsten presses "Sync Now" button       |
| Glide calls Make.com webhook            |
+-----------------------------------------+
           |
           v
+-----------------------------------------+
| STEP 3: Make.com Processing             |
|                                         |
| - Retrieves files from Google Drive     |
| - Calls Location-Manager API /sync      |
| - Receives matched data                 |
| - Updates Glide tables                  |
+-----------------------------------------+
           |
           v
+-----------------------------------------+
| STEP 4: Review & Approve                |
|                                         |
| Kirsten reviews flagged items           |
| Maps unknown locations/vendors          |
| Presses "Approve & Import"              |
+-----------------------------------------+
           |
           v
+-----------------------------------------+
| STEP 5: Data Updated                    |
|                                         |
| - Locations: Budgets updated            |
| - Budget: Line Items updated            |
| - Reports reflect new actuals           |
+-----------------------------------------+
```

### Key Data Tables Involved

1. **Locations: Budgets** - Parent records for each location's budget
2. **Budget: Line Items** - Child records with individual expense items

---

## Open Questions & Decisions Needed

### Trigger Mechanism
The current Glide workflow is set to trigger weekly on Mondays. However, since Kirsten uploads on Fridays, we should consider:

1. **Scheduled (Current)**: Runs every Monday automatically
   - Pro: Automated, no user action needed
   - Con: May sync incomplete data if upload is delayed

2. **Manual Button**: Kirsten clicks "Sync Now" when ready
   - Pro: Syncs only when data is complete
   - Con: Requires user action

3. **Automatic on Upload**: Triggers when new files detected
   - Pro: Immediate sync after upload
   - Con: More complex to implement

**Recommendation**: Consider a hybrid approach - manual "Sync Now" button with a Monday reminder if no sync has occurred.

### Data Source Question
The Glide workflow currently loops through "Budgets" table. Should it:
- Loop through "Locations: Budgets" instead?
- Not loop at all (just trigger Make.com once)?

---

## Related Documentation

- [GLIDE-SCHEMA.md](./GLIDE-SCHEMA.md) - Detailed Glide table schemas
- [MAKE-SCENARIOS.md](./MAKE-SCENARIOS.md) - Make.com scenario documentation
- [AIRTABLE-SCHEMA.md](./AIRTABLE-SCHEMA.md) - Airtable table schemas
- [API-REFERENCE.md](./API-REFERENCE.md) - Location-Manager API documentation
- [WORKFLOW-GUIDE.md](./WORKFLOW-GUIDE.md) - Step-by-step workflow guide for users

---

## Changelog

### January 29, 2025
- **WEEKLY SYNC COMPLETE**: Full implementation finished
- Sync Sessions table configured with all column IDs
- Weekly Sync screen live with file pickers
- Make.com HTTP module configured with Glide API
- Blueprint JSON created for scenario import
- All documentation updated

### January 28, 2025
- Initial documentation created
- Explored Glide app structure and tables
- Explored Make.com scenarios in Dez Locations folder
- Explored Airtable Permits: Locations base
- Created Make.com scenario "Dez: Location-Manager Weekly Sync"
- Created Glide workflow "Dez: Location-Manager Weekly Sync"
- Connected Glide workflow to Make.com webhook
