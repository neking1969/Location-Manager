# How to Add Glide Sync Module to Make.com

## Why This Is Separate

The simplified blueprint (`make-blueprint-simplified.json`) works perfectly and stores permits in:
- ✅ Google Drive (PDFs)
- ✅ Airtable (structured data)

Glide sync is optional and can be added manually once the basic flow is working.

---

## Option 1: Sync from Airtable to Glide (Recommended)

**Easiest approach**: Connect Airtable directly to Glide as a data source.

### Steps:
1. In Glide app, go to Data section
2. Add new data source
3. Select "Airtable"
4. Connect to "DG Locations" base
5. Select "Permits" table
6. Glide will automatically sync!

**Benefits**:
- No Make.com configuration needed
- Real-time sync
- Two-way sync (edit in Glide updates Airtable)

---

## Option 2: Add HTTP Module for Glide API (Advanced)

If you want Make.com to push directly to Glide, add this module after Airtable:

### Module Configuration

**Module**: HTTP > Make a Request
**Position**: After "Create Airtable Record" (module #9)

### Settings:

**URL**:
```
https://api.glideapp.io/api/function/mutateTables
```

**Method**: POST

**Headers**:
```
Authorization: Bearer ad54fb67-06fe-40b1-a87d-565a003c3f49
Content-Type: application/json
```

**Body** (Raw JSON):
```json
{
  "appID": "TFowqRmlJ8sMhdap17C0",
  "mutations": [
    {
      "kind": "add-row-to-table",
      "tableName": "native-table-3KOJwq5ixiqBXx3saPGl",
      "columnValues": {
        "productionTitle": "{{6.productionTitle}}",
        "permitType": "{{6.permitType}}",
        "processingStatus": "{{6.processingStatus}}",
        "releaseDate": "{{6.releaseDate}}",
        "locationManager": "{{6.locationManager}}",
        "contactPhone": "{{6.contactPhone}}",
        "productionOfficeAddress": "{{6.productionOfficeAddress}}",
        "totalFee": "{{6.totalFee}}",
        "feeBreakdown": "{{6.feeBreakdown}}",
        "invoiceNumber": "{{6.invoiceNumber}}",
        "invoiceDate": "{{6.invoiceDate}}",
        "paymentStatus": "{{6.paymentStatus}}",
        "balanceDue": "{{6.balanceDue}}",
        "loc1Address": "{{6.locationAddress}}",
        "loc1DatesStart": "{{6.filmingDatesStart}}",
        "loc1DatesEnd": "{{6.filmingDatesEnd}}",
        "loc1FilmingActivitiesDetails": "{{6.filmingActivities}}",
        "generalTermsConditions": "{{6.requirements}}",
        "permit": "{{8.webContentLink}}",
        "json": "{{toString(6)}}"
      }
    }
  ]
}
```

### Error Handling:

If this module fails, the permit is still safely stored in Airtable and Google Drive. You can manually add it to Glide or re-run the sync later.

---

## Option 3: Zapier Integration (Alternative)

If Make.com has issues with Glide API:

1. Create Zapier automation:
   - Trigger: New Airtable record in "Permits"
   - Action: Add row to Glide table
2. Zapier has native Glide integration
3. More user-friendly interface

---

## Testing Glide Sync

### Test Data (Minimal):
```json
{
  "appID": "TFowqRmlJ8sMhdap17C0",
  "mutations": [
    {
      "kind": "add-row-to-table",
      "tableName": "native-table-3KOJwq5ixiqBXx3saPGl",
      "columnValues": {
        "productionTitle": "The Shards",
        "permitNumber": "TEST-001",
        "processingStatus": "Test",
        "totalFee": "100"
      }
    }
  ]
}
```

### Using curl:
```bash
curl --request POST 'https://api.glideapp.io/api/function/mutateTables' \
--header 'Authorization: Bearer ad54fb67-06fe-40b1-a87d-565a003c3f49' \
--header 'Content-Type: application/json' \
--data-raw '{
  "appID": "TFowqRmlJ8sMhdap17C0",
  "mutations": [{
    "kind": "add-row-to-table",
    "tableName": "native-table-3KOJwq5ixiqBXx3saPGl",
    "columnValues": {
      "productionTitle": "The Shards",
      "permitNumber": "TEST-001"
    }
  }]
}'
```

---

## Troubleshooting

### "Module Not Found" Error
This happens when Make.com can't parse the blueprint structure. Solution:
1. Use simplified blueprint first
2. Add Glide module manually through UI
3. Or use Option 1 (Airtable → Glide direct sync)

### Glide API Returns Error
Common issues:
- **Authentication**: Check API token is correct
- **Column names**: Use simplified column names (not `remote\u001dfld...`)
- **Data types**: Ensure numbers are numbers, dates are YYYY-MM-DD format

### Best Practice
Start with **Option 1** (Airtable → Glide sync). It's the most reliable and requires zero Make.com configuration. Add direct API sync later if needed.

---

## References

- [Glide API Documentation](https://www.glideapps.com/docs/using-glide-tables-api)
- [Make Community: Glide Integration](https://community.make.com/t/template-how-to-use-data-from-a-webhook-to-add-row-in-glide-app/19958)
- [Glide Tables API Guide](https://help.glideapps.com/en/articles/9297111-glide-tables-api-a-non-developer-guide)

---

## Summary

**Recommended Path**:
1. ✅ Import `make-blueprint-simplified.json` (works perfectly!)
2. ✅ Test with sample permit email
3. ✅ Verify PDF in Drive, record in Airtable
4. ✅ Connect Airtable to Glide as data source (Option 1)
5. ✨ Done! Permits auto-sync to Glide!

No need to fight with Make.com HTTP modules. Airtable → Glide is the cleanest solution.
