# Rollback Procedure - Google Drive Auto-Sync Feature

## Quick Rollback Commands

If you need to quickly revert to the previous working state:

### 1. Revert Location-Manager (Lambda Backend)

```bash
cd /Volumes/Photos/Projects/Location-Manager
git checkout main
git log -1 --oneline
```

**Current main branch commit**: `3e341a8` (before auto-sync changes)
**Feature branch**: `feature/google-drive-auto-sync`

### 2. Revert Shards-Ledger-App (Dashboard)

```bash
cd /Users/jeffreyenneking/Projects/Shards-Ledger-App
git checkout main
git log -1 --oneline
```

**Feature branch**: `feature/sync-status-display`

### 3. Redeploy Previous Lambda Version

```bash
cd /Volumes/Photos/Projects/Location-Manager
# Deploy from main branch (pre-auto-sync)
npm run deploy  # or your usual Lambda deployment command
```

---

## What Changed in This Feature

### Location-Manager (Lambda) Changes

**Files Added**:
- `src/utils/fileDeduplication.js` - Duplicate file detection

**Files Modified**:
- `lambda/handler.js` - Added fileType routing, syncSource param, deduplication
- `CLAUDE.md` - Updated status

**Files Added (Blueprints)**:
- `blueprints/google-drive-auto-sync-scenario.json` - Make.com scenario

### Shards-Ledger-App (Dashboard) Changes

**Files Added**:
- `src/components/SyncStatus.tsx` - Sync status display component

**Files Modified**:
- `src/app/summary/page.tsx` - Added SyncStatus component to header

---

## Testing Rollback

After rolling back, verify the system still works:

```bash
# Test manual sync still works (existing Glide workflow)
curl -X POST "https://6fjv2thgxf6r4x24na4y6ilgt40vstgl.lambda-url.us-west-2.on.aws/sync" \
  -H "Content-Type: application/json" \
  -d '{
    "ledgerFileUrl": "https://example.com/test.xlsx",
    "syncSessionId": "rollback-test"
  }'
```

Expected: Lambda processes file without new parameters (backward compatible)

---

## If You Want to Keep Some Features

### Keep Lambda Enhancements, Remove Dashboard Display

```bash
# Keep Lambda on feature branch
cd /Volumes/Photos/Projects/Location-Manager
# (Stay on feature/google-drive-auto-sync)

# Revert only dashboard
cd /Users/jeffreyenneking/Projects/Shards-Ledger-App
git checkout main
```

### Keep Dashboard Display, Revert Lambda

```bash
# Revert Lambda
cd /Volumes/Photos/Projects/Location-Manager
git checkout main

# Keep dashboard on feature branch
cd /Users/jeffreyenneking/Projects/Shards-Ledger-App
# (Stay on feature/sync-status-display)
```

**Note**: Dashboard will show "Loading..." for sync status if Lambda doesn't write summary file, but won't break.

---

## Deactivating Make.com Scenario

If you set up the Google Drive Watch scenario in Make.com:

1. Go to: https://us1.make.com/300311/scenarios
2. Find: "Google Drive Auto-Sync to Location-Manager"
3. Click: Toggle switch to **OFF** (deactivate)
4. File uploads will no longer trigger auto-sync

**This does NOT require code rollback** - just stops the automation.

---

## Full Recovery Checklist

- [ ] Checkout `main` branch in Location-Manager
- [ ] Checkout `main` branch in Shards-Ledger-App
- [ ] Redeploy Lambda from `main` branch
- [ ] Verify Glide manual sync still works
- [ ] Dashboard loads without errors
- [ ] (Optional) Deactivate Make.com scenario

---

## Contact Information

If rollback fails, check:
- Lambda logs: `aws logs tail /aws/lambda/location-manager-prod --follow`
- Dashboard dev server: `npm run dev` in Shards-Ledger-App
- S3 bucket state: `aws s3 ls s3://location-manager-prod/processed/`

---

## Merge Back Later

If you want to re-enable the feature after fixing issues:

```bash
# Location-Manager
cd /Volumes/Photos/Projects/Location-Manager
git checkout feature/google-drive-auto-sync
git rebase main  # Resolve conflicts if any
git checkout main
git merge feature/google-drive-auto-sync
git push origin main

# Shards-Ledger-App
cd /Users/jeffreyenneking/Projects/Shards-Ledger-App
git checkout feature/sync-status-display
git rebase main
git checkout main
git merge feature/sync-status-display
git push origin main
```

Then redeploy Lambda.

---

**Last Updated**: 2026-02-11
**Feature Branch Created**: 2026-02-11
**Pre-Feature Commit (Location-Manager)**: `3e341a8`
**Pre-Feature Commit (Shards-Ledger-App)**: `764acac` (main branch clean)
