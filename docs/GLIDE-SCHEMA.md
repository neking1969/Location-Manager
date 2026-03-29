# Glide App Schema: The Shards Season 1

## Document History
- **Created**: January 28, 2025
- **Last Updated**: January 29, 2025 (Night - added API column IDs)
- **App URL**: https://go.glideapps.com/app/TFowqRmlJ8sMhdap17C0

---

## Tables Overview

| Table Name | Purpose | Row Count (est.) |
|------------|---------|------------------|
| Locations: Master List | All filming locations | ~50+ |
| Locations: Budgets | Budget records per location | ~50+ |
| Budget: Line Items | Individual expense items per budget | ~500+ |
| Vendors | Vendor/payee master list | ~100+ |
| Contacts | Production contacts | ~50+ |
| Permits | Permit tracking | ~50+ |
| Assignments | Location assignments | ~50+ |
| Budgets | General budget data | ~20+ |
| Index: Standard Line Items | Standard line item templates | - |
| Index: Rate Card | Rate card reference | - |
| Schedules: One Liner | Schedule one-liners | - |
| **Sync Sessions** | **Weekly sync session tracking (NEW)** | **~50+** |

---

## Core Tables (Detailed)

### 1. Locations: Master List

**Purpose**: Master list of all filming locations

**Key Fields**:
| Field | Type | Description |
|-------|------|-------------|
| Location Name | Text | Primary identifier |
| Address | Text | Physical address |
| Type | Choice | Location type (Interior, Exterior, etc.) |
| Status | Choice | Active, Inactive, etc. |
| Contact | Relation | Link to Contacts table |
| Notes | Text | Additional notes |
| Created | Date | Record creation date |
| Modified | Date | Last modification date |

**Relationships**:
- Has many -> Locations: Budgets
- Has many -> Permits
- Has many -> Assignments

---

### 2. Locations: Budgets

**Purpose**: Budget records for each location (parent of line items)

**Key Fields**:
| Field | Type | Description |
|-------|------|-------------|
| Budget ID | Text/Auto | Unique identifier |
| Location | Relation | Link to Locations: Master List |
| Budget Name | Text | Descriptive name |
| Total Budget | Number | Total budgeted amount |
| Total Actuals | Number | Sum of actual expenses |
| Variance | Computed | Budget - Actuals |
| Status | Choice | Draft, Active, Closed |
| Created | Date | Record creation date |
| Modified | Date | Last modification date |

**Relationships**:
- Belongs to -> Locations: Master List
- Has many -> Budget: Line Items

**Notes**:
- This is the PRIMARY table for location-specific budget tracking
- Each location should have one budget record
- Actuals are calculated from Budget: Line Items

---

### 3. Budget: Line Items

**Purpose**: Individual expense line items for each budget

**Key Fields**:
| Field | Type | Description |
|-------|------|-------------|
| Line Item ID | Text/Auto | Unique identifier |
| Budget | Relation | Link to Locations: Budgets |
| Description | Text | Line item description |
| Category | Choice | Expense category |
| Budgeted Amount | Number | Planned amount |
| Actual Amount | Number | Actual spent |
| Variance | Computed | Budgeted - Actual |
| Vendor | Relation | Link to Vendors table |
| Date | Date | Transaction date |
| Invoice/PO | Text | Reference number |
| Notes | Text | Additional notes |
| Source | Choice | Where data came from (Manual, Ledger, SmartPO) |

**Relationships**:
- Belongs to -> Locations: Budgets
- Belongs to -> Vendors (optional)

**Notes**:
- This is where LEDGER DATA gets imported
- Each row from the accounting ledger becomes a line item
- The `Source` field tracks whether it was manual entry or imported

---

### 4. Vendors

**Purpose**: Master list of all vendors/payees

**Key Fields**:
| Field | Type | Description |
|-------|------|-------------|
| Vendor ID | Text/Auto | Unique identifier |
| Vendor Name | Text | Primary name |
| Alternate Names | Text | Aliases for matching |
| Category | Choice | Vendor category |
| Contact Name | Text | Primary contact |
| Contact Email | Email | Contact email |
| Contact Phone | Phone | Contact phone |
| Address | Text | Vendor address |
| Tax ID | Text | Tax identification |
| Status | Choice | Active, Inactive |
| Notes | Text | Additional notes |

**Relationships**:
- Has many -> Budget: Line Items

**Notes**:
- Used for fuzzy matching when importing ledgers
- `Alternate Names` field helps with matching variations

---

### 5. Contacts

**Purpose**: Production contacts directory

**Key Fields**:
| Field | Type | Description |
|-------|------|-------------|
| Contact ID | Text/Auto | Unique identifier |
| Name | Text | Full name |
| Role | Choice | Production role |
| Email | Email | Email address |
| Phone | Phone | Phone number |
| Company | Text | Company/organization |
| Notes | Text | Additional notes |

---

### 6. Permits

**Purpose**: Filming permit tracking

**Key Fields**:
| Field | Type | Description |
|-------|------|-------------|
| Permit ID | Text/Auto | Unique identifier |
| Location | Relation | Link to Locations: Master List |
| Permit Type | Choice | Type of permit |
| Issuing Authority | Text | Who issued it |
| Issue Date | Date | When issued |
| Expiry Date | Date | When expires |
| Status | Choice | Pending, Approved, Expired |
| Document | File | Permit document |
| Notes | Text | Additional notes |

**Relationships**:
- Belongs to -> Locations: Master List

---

### 7. Assignments

**Purpose**: Location assignment tracking

**Key Fields**:
| Field | Type | Description |
|-------|------|-------------|
| Assignment ID | Text/Auto | Unique identifier |
| Location | Relation | Link to Locations: Master List |
| Department | Choice | Which department |
| Assigned To | Relation | Link to Contacts |
| Start Date | Date | Assignment start |
| End Date | Date | Assignment end |
| Status | Choice | Active, Complete |
| Notes | Text | Additional notes |

---

### 8. Sync Sessions (COMPLETED)

**Purpose**: Track weekly sync sessions for ledger imports

**Status**: Table and screen fully configured + API tested (January 29, 2025)

**Table ID**: `native-table-03Yk3buCk0yZOF5dzh4i`

**Key Fields**:
| Field | Type | Column ID | Description |
|-------|------|-----------|-------------|
| Name | Text | Name | Session identifier (auto or manual) |
| Ledger File | Multiple files | ledgerFile | Uploaded GL ledger Excel file(s) |
| SmartPO File | Multiple files | smartpoFile | Uploaded SmartPO export (optional) |
| Status | Text | 8v4u7 | Pending, Processing, Complete, Error |
| Sync Date | Date & Time | eoSi2 | When sync was initiated |
| Records Processed | Number | Ys6ff | Count of records processed |
| Errors | Number | 60vZb | Count of errors encountered |
| Notes | Text | ESsUc | Additional notes or error details |

**Relationships**:
- Standalone (no relations yet)

**Test Row Created**: "Test Sync 2026-01-29" (Row ID: YpcIrAkqT.aaW8fMoSLqng)

**Connected Screen**: Weekly Sync

**Screen Configuration**:
| Setting | Value |
|---------|-------|
| Source | Sync Sessions |
| Style | List |
| Title | Name column |
| Description | Status column |
| Allow add | Enabled |
| Allow edit | Enabled |
| Allow delete | Disabled |

**Edit Form Components**:
| Component | Type | Maps To |
|-----------|------|---------|
| Name | Text Entry | Name |
| Ledger File | File Picker | Ledger File |
| SmartPO File | File Picker | SmartPO File |
| Notes | Text Entry | Notes |

**Notes**:
- Used by the "Weekly Sync" screen for file uploads
- Each row = one sync session
- Edit form has file picker components for uploading ledger/SmartPO files
- Kirsten creates new row -> uploads files -> reviews import

---

## Index/Reference Tables

### Index: Standard Line Items
Template line items for creating new budgets

### Index: Rate Card
Standard rates for various expense categories

### Schedules: One Liner
Schedule one-liner data (format TBD)

---

## Data Relationships Diagram

```
+---------------------+
| Locations: Master   |
|      List           |
+---------+-----------+
          |
          | 1:N
          v
+---------------------+         +-----------------+
| Locations: Budgets  |-------->|    Vendors      |
+---------+-----------+         +-----------------+
          |                              ^
          | 1:N                          |
          v                              |
+---------------------+                  |
| Budget: Line Items  |------------------+
+---------------------+


+---------------------+
| Locations: Master   |
|      List           |
+---------+-----------+
          |
          +-------------+--------------+
          | 1:N         | 1:N          | 1:N
          v             v              v
    +----------+  +----------+  +-------------+
    | Permits  |  |Assignments|  |  Contacts   |
    +----------+  +----------+  +-------------+
```

---

## Workflows

### Existing Workflows (discovered Jan 28, 2025)

| Workflow Name | Trigger | Actions |
|---------------|---------|---------|
| Add Rows to One Liner: Days | App interaction | - |
| Budget: Line Items: Delete This Row | App interaction | - |
| Budgets: Add a Budget | App interaction | - |
| Budgets: Delete Budget | App interaction | - |
| Budgets: Delete Budget: Confirmation 1 | App interaction | - |
| Budgets: Delete Budget: Confirmation 2 | App interaction | - |
| Budgets: Make Prep 50% | App interaction | - |
| Budgets: Make Wrap 50% | App interaction | - |
| Budgets: MAKE.COM-Google Sheets: Add Spreadsheet | Integration | - |
| Generate CSV | App interaction | - |
| Locations: Budget-Add a Location | App interaction | - |
| Locations: Budget-Bulk Move Line Items | App interaction | - |
| Locations: Delete from Budget | App interaction | - |
| Row Creator | Schedule | - |
| Schedules: One Liner-CLAUDE: Processing with Lambda | Integration | - |
| Schedules: One Liner-Add Rows to One Liners: Days | App interaction | - |
| Untitled manual workflow | Manual | - |
| Untitled workflow (multiple) | Various | - |
| Vendors: Add a Fresh Vendor | App interaction | - |
| Vendors: Open on Click | App interaction | - |
| GET Claude Response | Integration | - |
| Locations: Budget-Add a Location copy | App interaction | - |
| Locations: Budgets: Change Locations | App interaction | - |
| Schedules: One Liner: CLAUDE: make.com | Integration | - |
| Schedules: One Liner-Process with Claude | Integration | - |
| Untitled workflow copy | Schedule | - |
| Vendors: Add Contact to New Vendor | App interaction | - |
| **Dez: Location-Manager Weekly Sync** | **Schedule (Weekly)** | **Trigger webhook to Make.com** |

---

## Notes for Ledger Import

When importing ledger data, the system needs to:

1. **Match Locations**: Use fuzzy matching to find the correct location in `Locations: Master List`
2. **Match Vendors**: Use fuzzy matching against `Vendors` table
3. **Create Line Items**: Insert rows into `Budget: Line Items`
4. **Update Totals**: Recalculate totals in `Locations: Budgets`

### Matching Strategy
- Location matching: Compare ledger location names against `Location Name` field
- Vendor matching: Compare payee names against `Vendor Name` and `Alternate Names`
- Use fuzzy matching (Levenshtein distance, etc.) for approximate matches
- Flag uncertain matches for user review

---

## API Integration Points

### Glide API
- **App ID**: TFowqRmlJ8sMhdap17C0
- **Tables accessible via API**: All tables listed above
- **Operations**: Query, Add Row, Set Columns, Delete Row

### Make.com Integration
- Webhooks trigger Glide workflows
- Make.com can read/write Glide tables directly
- Used for complex multi-step automations
