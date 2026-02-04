# Glide Workflow Configuration: Weekly Sync Trigger

**Last Updated**: January 29, 2025
**Status**: Configuration documented, ready to implement in Glide

## Workflow Name
`Weekly Sync: Process Files`

## Trigger
**Type:** Row Change (on Sync Sessions table)
**Condition:** When `Ledger File` column changes from empty to non-empty

OR

**Type:** Button Click (on Weekly Sync screen)
**Button Label:** "Process Files"

## Actions

### Action 1: Call Webhook
**Type:** Call API / Webhook
**URL:** `https://hook.us1.make.com/k3onejon45ao1wv4fdlwcqpbl4bflo`
**Method:** POST
**Headers:**
- `Content-Type: application/json`

**Body:**
```json
{
  "syncSessionId": "{{Row ID}}",
  "ledgerFileUrl": "{{Ledger File}}",
  "smartpoFileUrl": "{{SmartPO File}}",
  "name": "{{Name}}"
}
```

### Action 2: Update Status (Before API Call)
**Type:** Set Columns
**Table:** Sync Sessions
**Row:** Current row
**Values:**
- Status = "Processing"
- Sync Date = NOW()

## Column Mappings

| Glide Column | JSON Field | Column ID |
|-------------|-----------|-----------|
| Row ID | syncSessionId | (built-in) |
| Name | name | Name |
| Ledger File | ledgerFileUrl | ledgerFile |
| SmartPO File | smartpoFileUrl | smartpoFile |
| Status | (output) | 8v4u7 |
| Records Processed | (output) | Ys6ff |
| Errors | (output) | 60vZb |
| Notes | (output) | ESsUc |

## Expected Response

The Make.com scenario will update the Sync Sessions row with:
- Status: "Complete" or "Error"
- Records Processed: count of processed transactions
- Errors: count of errors encountered
- Notes: summary message

## Manual Trigger (for testing)

```bash
curl -X POST "https://hook.us1.make.com/k3onejon45ao1wv4fdlwcqpbl4bflo" \
  -H "Content-Type: application/json" \
  -d '{
    "syncSessionId": "YpcIrAkqT.aaW8fMoSLqng",
    "ledgerFileUrl": "https://example.com/ledger.xlsx",
    "smartpoFileUrl": "https://example.com/smartpo.xlsx",
    "name": "Test Sync 2026-01-29"
  }'
```
