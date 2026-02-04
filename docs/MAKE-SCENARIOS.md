# Make.com Scenarios Documentation

## Document History
- **Created**: January 28, 2025
- **Last Updated**: January 29, 2025 (Night - HTTP module configured)
- **Organization**: Enneking Lab
- **Team ID**: 300311

---

## Folder Structure

### Dez Locations Folder (ID: 231082)

This folder contains all scenarios related to the Dez/Locations budget tracking system.

**URL**: https://us1.make.com/300311/scenarios?folder=231082

---

## Scenarios Inventory

### Active Scenarios

| Scenario Name | ID | Status | Trigger | Purpose |
|---------------|-----|--------|---------|---------|
| Dez: New Location-Add a Location Budget | - | Active | Glide webhook | Creates budget record when new location added |
| Dez: Update Location-Update Location Budget row | - | Active | Glide webhook | Updates budget when location modified |
| Dez: Locations: Add Line Items | - | Active | Glide webhook | Adds line items to budgets |
| Dez: Locations: MAKE.COM | - | Active | Various | Integration scenarios |

### Weekly Sync Scenario (Updated Jan 29, 2025)

| Scenario Name | ID | Status | Trigger | Purpose |
|---------------|-----|--------|---------|---------|
| **Dez: Location-Manager Weekly Sync** | 4528779 | Inactive (ready to activate) | Webhook | Processes file uploads from Glide Weekly Sync |

**Configuration Status**: HTTP module configured with Glide API integration

---

## Key Scenario: Dez: Location-Manager Weekly Sync

### Overview
This scenario receives a webhook trigger from the Glide app and initiates the weekly sync process with the Location-Manager API.

### Scenario URL
https://us1.make.com/300311/scenarios/4528779/edit?folder=231082

### Components

```
+-----------------+     +-----------------+
|   WEBHOOKS      |     |      HTTP       |
|                 |---->|                 |
| Custom webhook  |     | Make a request  |
|    (Trigger)    |     |    (Action)     |
+-----------------+     +-----------------+
```

#### 1. Webhooks Module (Trigger)
- **Type**: Custom webhook
- **Webhook Name**: Dez-Location-Manager-Sync
- **Webhook URL**: `https://hook.us1.make.com/k3onejon45ao1wv4fdlwcqpbl4bflo`
- **Status**: Active

#### 2. HTTP Module (Action) - CONFIGURED
- **Type**: Make a request
- **Purpose**: Update Glide Sync Sessions status + Call Location-Manager API
- **URL**: `https://api.glideapp.io/api/function/mutateTables`
- **Method**: POST
- **Headers**:
  - Authorization: `Bearer ad54fb67-06fe-40b1-a87d-565a003c3f49`
  - Content-Type: `application/json`
- **Body Content Type**: application/json
- **Status**: Configured, ready for testing

### Webhook Details

| Property | Value |
|----------|-------|
| Webhook ID | 2595084 |
| Webhook URL | `https://hook.us1.make.com/k3onejon45ao1wv4fdlwcqpbl4bflo` |
| Webhook UDID | c3xiwof046hsuhkivah0cwcqpbl4bflo |
| Service | gateway-webhook |
| Status | Active |
| Scenario ID | 4528779 |
| Scenario Status | Inactive |

### Configuration Status (Updated Jan 29, 2025)

**COMPLETED:**
- Webhook trigger configured
- HTTP Module 1: URL, Method, Headers set
- Blueprint JSON created at `/blueprints/weekly-sync-scenario.json`

**REMAINING (to finish in Make.com UI):**
1. **HTTP Module Body** - Set JSON body to update Glide status:
   ```json
   {"appID": "TFowqRmlJ8sMhdap17C0", "mutations": [{"kind": "set-columns-in-row", "tableName": "native-table-03Yk3buCk0yZOF5dzh4i", "rowID": "{{1.syncSessionId}}", "columnValues": {"8v4u7": "Processing"}}]}
   ```

2. **Add Module 2**: HTTP call to Lambda API endpoint

3. **Add Module 3**: HTTP to update Glide with results

4. **Activate Scenario**: Toggle from Inactive to Active

**See**: `/docs/WEEKLY-SYNC-SETUP.md` for complete configuration details

---

## Webhooks Inventory

All webhooks in the Make.com account related to Dez/Locations:

| Webhook Name | URL | Purpose |
|--------------|-----|---------|
| Dez-Location-Manager-Sync | `https://hook.us1.make.com/k3onejon45ao1wv4fdlwcqpbl4bflo` | Weekly sync trigger |
| Dez Budgets | `https://hook.us1.make.com/...` | Budget operations |
| Dez Budgets: JSON Budgets | `https://hook.us1.make.com/...` | JSON budget data |
| Dez Locations: Add Line Items | `https://hook.us1.make.com/...` | Line item creation |
| Copy of Dez Locations CLONE | `https://hook.us1.make.com/...` | Clone operations |

---

## Integration with Glide

### How Glide Triggers Make.com

1. **Glide Workflow**: "Dez: Location-Manager Weekly Sync"
   - Trigger: Schedule (Every week, Mondays)
   - Action: Loop through Budgets table
   - Action: Trigger webhook (calls Make.com)

2. **Webhook URL**: Configured in Glide workflow
   - URL: `https://hook.us1.make.com/k3onejon45ao1wv4fdlwcqpbl4bflo`

3. **Data Flow**:
   ```
   Glide Workflow (scheduled)
         |
         | HTTP POST to webhook URL
         v
   Make.com Webhook (receives trigger)
         |
         | Executes scenario
         v
   HTTP Module (calls Location-Manager API)
         |
         | API processes ledger data
         v
   Response returned to Make.com
         |
         | (Future: Update Glide tables)
         v
   Sync complete
   ```

---

## Other Relevant Webhooks

From the webhooks list, these appear related to the system:

| Webhook | URL Suffix | Notes |
|---------|------------|-------|
| 20th: Create a JSON from Calendar | ...4sji4ctwejnv | Calendar integration |
| 20th: Generate JSON | ...lgfubzhi4jaf | JSON generation |
| 20th: PDF Extractor | ...pzqoqdmprpn | PDF processing |
| Anthropic | ...gfnoothacojnw | Claude AI integration |
| Avery 5659 | ...hppc8nsdpdoar | Label printing |
| Check-In Sheet | ...dfigtjvl8y0cfict | Check-in tracking |
| Dez Budgets: Revise One Sheet | ...q4b0lhrc7bp3 | One-sheet revision |

---

## Best Practices

### Webhook Security
- Keep webhook URLs confidential
- Consider implementing webhook signatures for verification
- Monitor webhook activity for unauthorized access

### Scenario Organization
- Keep related scenarios in the same folder
- Use clear, descriptive naming conventions
- Document scenario purposes and triggers

### Error Handling
- Always add error handling modules
- Set up notifications for failed scenarios
- Log important operations for debugging

---

## Troubleshooting

### Common Issues

1. **Webhook not triggering**
   - Check if scenario is active (not inactive)
   - Verify webhook URL is correct
   - Check Make.com execution logs

2. **HTTP module failing**
   - Verify endpoint URL is correct
   - Check authentication headers
   - Review API response for errors

3. **Glide workflow not calling webhook**
   - Verify workflow is enabled
   - Check schedule settings
   - Review workflow run history in Glide

### Debugging Steps

1. **Test webhook manually**:
   ```bash
   curl -X POST https://hook.us1.make.com/k3onejon45ao1wv4fdlwcqpbl4bflo \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```

2. **Check Make.com execution history**:
   - Go to scenario page
   - Click "History" tab
   - Review executions and errors

3. **Check Glide workflow history**:
   - Go to Workflows section
   - Select the workflow
   - Review "Run History" panel
