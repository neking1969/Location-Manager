# Product Requirements Document (PRD)
# Location Manager

## Overview

**Product Name:** Location Manager (Cost Tracker)
**Purpose:** Track and compare actual costs vs budgets for TV production filming locations
**Target User:** Location Managers in TV/Film production

---

## Problem Statement

Location Managers need to track costs across multiple filming locations, episodes, and cost categories. Currently this is done via spreadsheets, which lack:
- Real-time variance calculations
- Multi-user access
- Automatic organization by episode/set
- PDF import for receipts and invoices

---

## Product Goals

1. Replace spreadsheet-based tracking with a dedicated web application
2. Provide real-time budget vs actual comparisons
3. Organize costs by Production > Episode > Set structure
4. Enable PDF import for faster data entry
5. Deploy to AWS for reliable cloud access

---

## Features

### Core Features (MVP)

| Feature | Description | Status |
|---------|-------------|--------|
| Production Management | Create/manage multiple shows or seasons | Done |
| Episode Tabs | Organize by episode (101, 102) or groups (Backlot, Amort) | Done |
| Set Tracking | Each filming location has its own budget | Done |
| Cost Categories | Loc Fees, Security, Fire, Rentals, Permits, Police | Done |
| Variance Display | Show Under/Over budget per set and category | Done |
| Dashboard | Summary view with totals and charts | Done |

### Future Features

| Feature | Description | Priority |
|---------|-------------|----------|
| PDF Import | Upload PDFs and extract cost data automatically | High |
| User Authentication | Login/logout, role-based access | Medium |
| Export to Excel | Download reports as spreadsheets | Medium |
| Mobile View | Responsive design for on-set access | Low |
| Multi-production Dashboard | Compare across productions | Low |

---

## Technical Architecture

### Frontend
- **Framework:** React 18
- **Routing:** React Router v6
- **Charts:** Recharts
- **HTTP Client:** Axios
- **Hosting:** AWS S3 (static website)

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database (Local):** JSON file storage
- **Database (Production):** AWS DynamoDB
- **Hosting:** AWS Lambda via API Gateway

### Deployment
- **CI/CD:** GitHub Actions
- **Infrastructure:** AWS (Lambda, S3, DynamoDB, API Gateway)
- **Trigger:** Push to main branch auto-deploys

---

## Data Model

### Production
```json
{
  "id": "uuid",
  "name": "Shards Season 1",
  "createdAt": "2024-01-15T00:00:00Z"
}
```

### Episode
```json
{
  "id": "uuid",
  "projectId": "uuid",
  "name": "101",
  "type": "episode"
}
```

### Set
```json
{
  "id": "uuid",
  "episodeId": "uuid",
  "name": "Downtown LA Warehouse",
  "budget": {
    "locFees": 5000,
    "security": 1500,
    "fire": 800,
    "rentals": 2000,
    "permits": 500,
    "police": 1200
  }
}
```

### Cost Entry
```json
{
  "id": "uuid",
  "setId": "uuid",
  "category": "locFees",
  "amount": 4500,
  "description": "Day 1-3 location fee",
  "date": "2024-01-20"
}
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/projects | List all productions |
| POST | /api/projects | Create production |
| GET | /api/episodes/project/:id | Get episodes for production |
| POST | /api/episodes | Create episode |
| GET | /api/sets/episode/:id | Get sets for episode |
| POST | /api/sets | Create set with budget |
| GET | /api/costs/set/:id | Get costs for set |
| POST | /api/costs | Add cost entry |
| GET | /api/reports/dashboard/:id | Dashboard summary |

---

## Success Metrics

1. **Adoption:** Location Manager actively uses the app for at least one production
2. **Time Savings:** Reduce time spent on cost tracking by 50%
3. **Accuracy:** Zero budget calculation errors (automated variance)
4. **Uptime:** 99% availability via AWS deployment

---

## Current Status

- **Backend:** Deployed to AWS Lambda
- **Frontend:** Deployed to S3 (static website)
- **Database:** DynamoDB in AWS, JSON file for local development
- **CI/CD:** GitHub Actions auto-deploys on push

---

## Links

- **GitHub:** https://github.com/neking1969/Location-Manager
- **Frontend URL:** http://location-manager-frontend-app.s3-website-us-west-2.amazonaws.com
- **Local Dev:** http://localhost:3000 (frontend), http://localhost:5001 (API)
