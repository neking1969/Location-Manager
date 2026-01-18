# Location Manager - Claude Session Guide

## What This App Does
TV production location cost tracker - compares actual costs vs budgets for filming locations.

## Quick Commands

### Test the app locally
```bash
cd server && npm start &
sleep 2
curl http://localhost:5001/api/projects
```

### Build and check for errors
```bash
cd client && CI=true npm run build
```

### Deploy changes
```bash
git add -A && git commit -m "Your message" && git push
```

## Current Status
- **Frontend:** http://location-manager-frontend-app.s3-website-us-west-2.amazonaws.com
- **Backend:** AWS Lambda (auto-deploys via GitHub Actions)
- **Database:** DynamoDB (production), JSON file (local)

## When Implementing Features

**Always follow this process:**

1. **Make changes** to the code
2. **Build to check for errors:** `cd client && CI=true npm run build`
3. **Test the API:** `curl http://localhost:5001/api/[endpoint]`
4. **Fix any errors** before proceeding
5. **Commit and push:** `git add -A && git commit -m "message" && git push`
6. **Verify deployment** in GitHub Actions
7. **Test on live site**

**Do not stop until the feature works in production.**

## Key Files
- `server/src/index.js` - Express API entry
- `server/src/routes/` - API endpoints
- `server/src/database.js` - Local database
- `server/src/database-dynamodb.js` - AWS database
- `client/src/components/` - React components
- `client/src/api.js` - API client config
- `.github/workflows/deploy.yml` - Auto-deployment

## API Endpoints
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/episodes/project/:id` - Get episodes
- `GET /api/sets/episode/:id` - Get sets
- `POST /api/sets` - Create set with budget
- `POST /api/costs` - Add cost entry
- `GET /api/reports/dashboard/:id` - Dashboard data

## Known Issues
- PDF import doesn't work in Lambda (file upload handling needs update)

## Testing Checklist
Before considering any feature complete:
- [ ] No build errors (`npm run build` succeeds)
- [ ] No lint errors
- [ ] API endpoint works locally
- [ ] Changes committed and pushed
- [ ] GitHub Actions deployment succeeds
- [ ] Feature works on live site
