# Location Manager - Claude Session Guide

## Starting a New Session

When you start a new Claude session with this project, just say:

> "Let's work on Location Manager"

Dependencies install automatically via the session hook. You're ready to go.

---

## What This App Does

TV production location cost tracker - compares actual costs vs budgets for filming locations.

**Key documents:**
- `PRD.md` - Full product requirements and feature list
- `README.md` - Technical setup and API documentation

---

## Quick Commands

### Run Locally
```bash
cd server && npm start &
DANGEROUSLY_DISABLE_HOST_CHECK=true npm start
```

**Local URLs:**
- Frontend: http://localhost:3000
- API: http://localhost:5001

### Deploy to AWS
Just push to main - GitHub Actions handles deployment automatically.

---

## Current Status

| Component | Status | Location |
|-----------|--------|----------|
| Backend | Deployed | AWS Lambda |
| Frontend | Deployed | AWS S3 |
| Database | Working | DynamoDB (AWS) / JSON (local) |
| CI/CD | Working | GitHub Actions |

**Live URLs:**
- Frontend: http://location-manager-frontend-app.s3-website-us-west-2.amazonaws.com
- API: Check GitHub Actions output for current endpoint

---

## Project Structure

```
Location-Manager/
├── client/                 # React frontend
│   └── src/
│       ├── components/     # React components
│       ├── api.js          # API client config
│       └── App.js          # Main app
├── server/                 # Express backend
│   └── src/
│       ├── routes/         # API routes
│       ├── database.js     # Local JSON storage
│       ├── database-dynamodb.js  # AWS DynamoDB
│       └── index.js        # Entry point
├── .github/workflows/      # GitHub Actions
├── .claude/                # Claude session config
│   ├── hooks/              # Auto-run scripts
│   └── settings.json       # Hook configuration
├── CLAUDE.md               # This file
├── PRD.md                  # Product requirements
└── README.md               # Technical docs
```

---

## Key Files to Know

| File | Purpose |
|------|---------|
| `server/src/index.js` | Express API entry point |
| `server/src/database.js` | Local JSON database |
| `server/src/database-dynamodb.js` | AWS DynamoDB adapter |
| `client/src/api.js` | API client configuration |
| `client/src/components/` | All React components |
| `.github/workflows/deploy.yml` | CI/CD pipeline |

---

## Common Tasks

### Add a new feature
1. Update backend route in `server/src/routes/`
2. Update frontend component in `client/src/components/`
3. Test locally with `npm start` in both directories
4. Push to main to deploy

### Fix a bug
1. Identify the file (check Key Files above)
2. Make the fix
3. Test locally
4. Push to deploy

### Check deployment status
```bash
gh run list --limit 5
```

---

## GitHub Repository

https://github.com/neking1969/Location-Manager

---

## Need Help?

Just describe what you want to build or fix. Claude will:
1. Read the relevant files
2. Make the changes
3. Test if needed
4. Commit and push when ready
