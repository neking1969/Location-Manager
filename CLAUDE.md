# Location Manager - Claude Session Guide

## What This App Does
TV production location cost tracker - compares actual costs vs budgets for filming locations.

## Quick Start - Run Tests (Recommended)
```bash
cd server && npm test
```
This runs 35 automated tests covering:
- All API endpoints (projects, episodes, sets, costs, reports)
- Budget/actual calculations
- Variance calculations
- Edge cases (refunds, decimals, empty data)

No servers need to be started - tests use supertest which tests the Express app directly.

## Quick Start - Local Development (Optional)
```bash
cd server && npm start &
cd client && npm start
```

## Current Status
- **Backend:** Deployed to AWS Lambda (working)
- **Frontend:** Deploying to S3 (in progress - fixing public access)
- **Database:** DynamoDB in AWS, JSON file locally

## AWS Deployment
Automatic via GitHub Actions - just push code and it deploys.

- **Frontend URL:** http://location-manager-frontend-app.s3-website-us-west-2.amazonaws.com
- **API URL:** Check GitHub Actions output

## Key Files
- `server/src/index.js` - Express API entry point
- `server/src/database.js` - Local JSON database
- `server/src/database-dynamodb.js` - AWS DynamoDB database
- `client/src/api.js` - API client configuration
- `.github/workflows/deploy.yml` - Auto-deployment workflow
- `.claude/hooks/session-start.sh` - Auto-installs dependencies

## To Continue Development
Just tell Claude what you want to build or fix. Dependencies install automatically.
