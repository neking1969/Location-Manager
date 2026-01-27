# Glide Permits Table Integration

## Table Details

**App ID**: `TFowqRmlJ8sMhdap17C0`
**Table ID**: `native-table-3KOJwq5ixiqBXx3saPGl`
**API Token**: `ad54fb67-06fe-40b1-a87d-565a003c3f49`

## Table Schema (Key Fields)

This is a comprehensive FilmLA-style permit table with the following structure:

### Core Permit Info
- `permitType` - Type of filming permit
- `processingStatus` - Current status in pipeline
- `processedDate` - When permit was processed
- `releaseDate` - Permit release date
- `productionTitle` - Show/movie title (e.g., "The Shards")
- `producer`, `director`, `productionCompany` - Production team
- `locationManager`, `productionManager` - Key contacts
- `permit` - URI to permit PDF file

### Financial Info
- `totalFee` - Total permit cost
- `feeBreakdown` - Itemized fees
- `invoiceNumber`, `invoiceDate` - Billing info
- `paymentStatus`, `paymentMethod`, `paymentDate` - Payment tracking
- `balanceDue` - Outstanding amount

### Contact Info
- `contactPhone` - Main production phone
- `productionOfficeAddress` - Office location
- `locationAssistantPhone`, `locationAssistantEmail` - Assistant contacts
- `filmlaCoordinator` - FilmLA rep assigned

### Location Fields (loc1-loc5)
Each location (up to 5 per permit) has:
- `locXId`, `locXAddress`, `locXType` - Basic info
- `locXDatesStart`, `locXDatesEnd` - Filming dates
- `locXPoliticalJurisdiction`, `locXPoliceJurisdiction`, `locXFireJurisdiction` - Jurisdictions
- `locXOpenToPublic` - Public access flag
- `locXEquipmentQuantity`, `locXPersonnelQuantity` - Crew/equipment counts
- `locXFilmingActivitiesType`, `locXFilmingActivitiesDetails` - What's being filmed
- `locXPostingFootage`, `locXPostingDates`, `locXPostingDescription` - Street posting
- `locXClosureFootage`, `locXClosureDates`, `locXClosureDescription`, `locXClosureType` - Road closures
- `locXApprovals` - Required approvals

### Additional Locations
- `baseCampLocations` - Base camp addresses
- `crewParkingLocations` - Parking lot addresses
- `additionalAddresses` - Other relevant addresses

### Terms & Conditions
- `generalTermsConditions` - Permit terms
- `filmmakersCode` - Code of conduct
- `trafficControlNotes` - Traffic management notes

### Raw Data
- `json` - Full JSON of parsed permit data

## Claude Parsing Strategy

Given the complexity of this schema, we'll use a **two-stage approach**:

### Stage 1: Basic Permit Info (Always Parse)
Extract these fields for every permit:
- Production title
- Permit type
- Processing status
- Location manager
- Contact info
- Total fee
- Payment status
- Release date

### Stage 2: Detailed Location Info (FilmLA permits only)
For FilmLA permits with multiple locations, extract:
- Up to 5 locations with full details
- Posting/closure requirements
- Equipment/personnel counts
- Filming activities

## Updated Claude Prompt

```
You are parsing a filming permit for "The Shards" TV production.

Extract permit information and return as JSON. If a field is not present in the document, use null or empty string.

**Always Extract (Stage 1):**
{
  "productionTitle": "The Shards",
  "permitType": "string (e.g., 'FilmLA Multi-Location', 'Simple Permit')",
  "processingStatus": "string (e.g., 'Approved', 'Pending')",
  "releaseDate": "YYYY-MM-DD",
  "locationManager": "string",
  "contactPhone": "string",
  "productionOfficeAddress": "string",
  "totalFee": "number (no $ sign)",
  "feeBreakdown": "string (itemized)",
  "invoiceNumber": "string",
  "invoiceDate": "YYYY-MM-DD",
  "paymentStatus": "string (e.g., 'Paid', 'Due')",
  "balanceDue": "number"
}

**For Multi-Location FilmLA Permits (Stage 2):**
If this is a FilmLA permit with multiple locations, also extract for EACH location (up to 5):
{
  "locations": [
    {
      "id": "Location 1",
      "address": "string",
      "type": "string (e.g., 'Street', 'Private Property')",
      "datesStart": "YYYY-MM-DD",
      "datesEnd": "YYYY-MM-DD",
      "politicalJurisdiction": "string (e.g., 'City of LA')",
      "policeJurisdiction": "string",
      "fireJurisdiction": "string",
      "openToPublic": boolean,
      "equipmentQuantity": "string",
      "personnelQuantity": "string",
      "filmingActivitiesType": "string",
      "filmingActivitiesDetails": "string",
      "postingFootage": "string",
      "postingDates": "string",
      "postingDescription": "string",
      "closureFootage": "string",
      "closureDates": "string",
      "closureDescription": "string",
      "closureType": "string",
      "approvals": "string"
    }
  ],
  "baseCampLocations": "string",
  "crewParkingLocations": "string",
  "additionalAddresses": "string",
  "generalTermsConditions": "string",
  "filmmakersCode": "string",
  "trafficControlNotes": "string"
}

Email/Document:
[INSERT EMAIL BODY OR PDF TEXT HERE]
```

## Make.com to Glide Integration

### Option 1: Direct Glide API (Recommended)
After Claude parses the permit, send data directly to Glide API:

```javascript
// HTTP Request to Glide API
POST https://api.glideapp.io/api/function/mutateTables
Headers:
  Authorization: Bearer ad54fb67-06fe-40b1-a87d-565a003c3f49
Body:
{
  "appID": "TFowqRmlJ8sMhdap17C0",
  "mutations": [
    {
      "kind": "add-row-to-table",
      "tableName": "native-table-3KOJwq5ixiqBXx3saPGl",
      "columnValues": {
        "remote\u001dfldNPQSRAfI0kDErV": "The Shards", // productionTitle
        "remote\u001dfld3bs5GHXyVBetl5": "FilmLA", // permitType
        "remote\u001dfldX3brsgcYIBT7hM": "Approved", // processingStatus
        "remote\u001dfldiDAa5nA4SckimO": "450", // totalFee
        "remote\u001dfldkVXQZtQcO5aut7": "Desarey Enneking", // locationManager
        "remote\u001dfld6fOPWdr5hIEuZK": "(213) 555-1234", // contactPhone
        // ... map all other fields from Claude response
      }
    }
  ]
}
```

### Option 2: Airtable + Glide Sync
Keep using Airtable as intermediate storage, then sync to Glide separately.

## Workflow Summary

```
1. Gmail receives permit email (modernlocations@gmail.com)
   ↓
2. Make.com watches inbox for "permit" keyword
   ↓
3. Extract email + PDF attachment
   ↓
4. Claude API parses permit (Stage 1 + Stage 2 if needed)
   ↓
5A. Upload PDF to Google Drive "Permits" folder
   ↓
5B. Create Airtable record (optional, for backup)
   ↓
6. POST to Glide API → Create row in Permits table
   ↓
7. Kirsten sees permit in "The Shards" Glide app
```

## Next Steps

1. ✅ Table schema identified
2. ⏳ Create Stage 1+2 Claude parsing prompt
3. ⏳ Update Make.com blueprint with Glide API call
4. ⏳ Test with sample FilmLA permit
5. ⏳ Test with simple permit (non-FilmLA)
6. ⏳ Deploy and monitor

## Cost Estimate

**Claude API (per permit)**:
- Stage 1 (basic): ~800 tokens input + 300 output = $0.004
- Stage 2 (detailed): ~2000 tokens input + 800 output = $0.010
- Average: $0.007 per permit

**50 permits per season**: ~$0.35 total

## Sample Test Permit

```
From: filmla@filmla.com
Subject: Permit Approved - The Shards - Multiple Locations

Permit #: FP-2025-5678
Production: The Shards - Season 1
Location Manager: Desarey Enneking
Phone: (213) 555-9999

Total Fee: $1,245.00
Payment Status: Paid
Invoice #: INV-2025-001
Invoice Date: December 10, 2025

LOCATION 1:
Address: Sunset Boulevard, between Laurel Canyon & Crescent Heights
Type: Public Street
Dates: December 15-16, 2025
Political: City of Los Angeles
Police: LAPD West Bureau
Fire: LAFD Station 82
Equipment: 2 cameras, 1 lighting truck
Personnel: 35 crew
Activities: Driving scene with 3 picture vehicles
Posting: 500 feet, December 14-17
Closure: Partial lane closure 7am-7pm December 15-16

LOCATION 2:
Address: 1234 Hollywood Blvd (Debbie's House)
Type: Private Residence
Dates: December 17-18, 2025
Equipment: 3 cameras, grip truck
Personnel: 45 crew
Activities: Interior/exterior dialogue scenes

Base Camp: Highland Ave & Franklin Ave
Crew Parking: Hollywood & Vine parking structure

Terms: Filmmaker's Code of Conduct applies
Traffic: LAPD traffic control required for closures
```
