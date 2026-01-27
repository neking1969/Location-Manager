# Permit Automation System - Implementation Plan

## Goal
Automate permit tracking for "The Shards" production by monitoring Gmail, parsing permit documents with Claude, and syncing to Airtable + Glide.

## Current State
- **Make.com Blueprint**: Monitors Gmail → uploads PDFs → creates Airtable records
- **Google Drive**: Permits folder in modernlocations@gmail.com
- **Airtable**: "DG Locations" base → "Permits" table
- **Glide**: "The Shards" app (needs Permits table ID)

## Proposed Architecture

### Option 1: Enhanced Make.com Workflow (Recommended)
**Pros**: No new infrastructure, uses existing Make blueprint
**Cons**: Limited Claude integration, manual parsing logic

```
Gmail (modernlocations@gmail.com)
  ↓ Watch for emails with "permit" subject + PDF attachments
Make.com Scenario
  ├─ Get Email + Attachments
  ├─ Claude API → Parse permit details
  │   • Permit number
  │   • Issue/expiry dates
  │   • Location/address
  │   • Fees/amounts
  │   • Issuing agency
  │   • Contact info
  │   • Restrictions/requirements
  ├─ Google Drive → Upload PDF
  ├─ Airtable → Create/update record
  └─ Glide Webhook → Sync to app
```

### Option 2: Standalone MCP Server
**Pros**: More control, reusable across projects
**Cons**: Requires server hosting, more complex setup

```
Node.js MCP Server (mcp-servers/permit-automation/)
  ├─ Gmail API → Monitor inbox
  ├─ Claude API → Parse emails/PDFs
  ├─ Google Drive API → Store PDFs
  ├─ Airtable API → Create records
  └─ Glide API → Sync to app
```

## Recommended Approach: Option 1 (Enhanced Make.com)

### Implementation Steps

1. **Add Claude API Module to Make Blueprint**
   - After "Get Email" step
   - Send email body + PDF text to Claude
   - Prompt: "Extract permit details from this email..."
   - Parse response JSON with permit fields

2. **Update Airtable Module**
   - Map Claude-extracted fields to Airtable columns:
     - Permit# → `fldnIGfDCRgUniXvj`
     - Notes → `fld8mAAInACYKnWio`
     - Assignee → `fld4VQbtWVR82YzSZ`
     - Status → `fldccSBOqQVbnXiY3` (default: "Todo")
     - Attachments → `fldqiB1bahiozcnkn`

3. **Add Glide Webhook Module**
   - After Airtable record creation
   - POST to Glide API with permit data
   - Update Permits table in "The Shards" app

4. **Create Permits Folder in Google Drive**
   - Full path: `modernlocations@gmail.com/My Drive/Permits/`
   - Already created by Kirsten

## Data Schema

### Permit Fields (to extract with Claude)

| Field | Type | Example | Airtable Column |
|-------|------|---------|-----------------|
| Permit Number | Text | "FP-2025-1234" | Permit# |
| Issue Date | Date | "2025-12-15" | (add new column) |
| Expiry Date | Date | "2025-12-20" | (add new column) |
| Location | Text | "Debbie's House, Sunset Blvd" | (link to Locations) |
| Address | Text | "1234 Sunset Blvd, LA, CA" | (add new column) |
| Fee Amount | Currency | $450.00 | (add new column) |
| Issuing Agency | Text | "City of Los Angeles Film Office" | (add new column) |
| Contact Person | Text | "Jane Smith" | (add new column) |
| Contact Email | Email | "jane@filmla.com" | (add new column) |
| Contact Phone | Phone | "(213) 555-1234" | (add new column) |
| Restrictions | Long Text | "No parking 7am-7pm, ..." | Notes |
| Requirements | Long Text | "Fire safety officer required, ..." | Notes |
| PDF Link | Attachment | Google Drive URL | Attachments |

### Claude Parsing Prompt Template

```
You are a production assistant parsing permit documents for "The Shards" TV production.

Extract the following information from this permit email/document:

**Required Fields:**
- Permit Number
- Issue Date (format: YYYY-MM-DD)
- Expiry Date (format: YYYY-MM-DD)
- Location Name
- Address (street, city, state, zip)
- Fee Amount (number only, no $)

**Optional Fields:**
- Issuing Agency
- Contact Person
- Contact Email
- Contact Phone
- Parking Restrictions
- Time Restrictions
- Special Requirements
- Fire Safety Requirements
- Security Requirements

Return as JSON with these exact keys:
{
  "permitNumber": "",
  "issueDate": "",
  "expiryDate": "",
  "locationName": "",
  "address": "",
  "feeAmount": 0,
  "issuingAgency": "",
  "contactPerson": "",
  "contactEmail": "",
  "contactPhone": "",
  "restrictions": "",
  "requirements": ""
}

Email/Document Text:
[INSERT EMAIL BODY OR PDF TEXT HERE]
```

## Make.com Blueprint Updates

### New Modules to Add:

1. **HTTP: Claude API Call**
   - URL: `https://api.anthropic.com/v1/messages`
   - Method: POST
   - Headers:
     - `x-api-key`: [Anthropic API Key]
     - `anthropic-version`: "2023-06-01"
     - `content-type`: "application/json"
   - Body:
     ```json
     {
       "model": "claude-3-5-sonnet-20241022",
       "max_tokens": 1024,
       "messages": [{
         "role": "user",
         "content": "[PROMPT TEMPLATE + EMAIL TEXT]"
       }]
     }
     ```

2. **JSON: Parse Claude Response**
   - Parse `response.content[0].text` as JSON
   - Map to variables for Airtable

3. **Glide: Trigger Webhook** (optional, for real-time sync)
   - URL: Glide API endpoint or webhook trigger
   - Method: POST
   - Body: Permit data JSON

## Next Steps

1. Update Make.com blueprint with Claude API integration
2. Add new columns to Airtable "Permits" table
3. Discover Glide "Permits" table ID
4. Test with sample permit email
5. Monitor and refine Claude parsing accuracy

## Cost Estimation

**Claude API**:
- ~500 tokens per email (input) + 200 tokens (output) = 700 tokens
- Cost: ~$0.003 per email (Sonnet pricing)
- 50 permits per season = $0.15

**Make.com**:
- Current plan supports automation

## Success Metrics

- 95%+ parsing accuracy for required fields
- Zero manual data entry by Kirsten
- < 5 minute end-to-end processing time
- All PDFs stored and linked correctly
