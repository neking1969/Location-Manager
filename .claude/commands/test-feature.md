# Test Feature Request

You are testing a feature request for the Location Manager app. Follow this process and DO NOT STOP until the feature is fully working.

## Process

### 1. Understand the Request
- Clarify what the user wants
- Break it into specific, testable requirements
- Create a checklist of acceptance criteria

### 2. Implement the Feature
- Make the necessary code changes
- Follow existing code patterns in the project
- Update both frontend and backend if needed

### 3. Test Locally
Run these tests after every change:

```bash
# Start the server
cd /home/user/Location-Manager/server && npm start &
sleep 2

# Test API endpoints
curl -s http://localhost:5001/api/health
curl -s http://localhost:5001/api/projects

# Build frontend
cd /home/user/Location-Manager/client && CI=true npm run build

# Run linter
cd /home/user/Location-Manager/client && npx eslint src/ --max-warnings=0
```

### 4. Fix Any Errors
- If tests fail, fix the issue immediately
- Re-run tests after each fix
- Do not proceed until all tests pass

### 5. Test the Specific Feature
- Create test data if needed
- Verify the feature works via API calls
- Check for edge cases

### 6. Commit and Deploy
```bash
git add -A
git commit -m "Add [feature description]"
git push
```

### 7. Verify Production
After deployment completes:
- Check GitHub Actions for success
- Test the feature on the live URL: http://location-manager-frontend-app.s3-website-us-west-2.amazonaws.com

### 8. Report Results
Only report success when:
- [ ] All local tests pass
- [ ] Feature works as requested
- [ ] Code is committed and pushed
- [ ] Deployment succeeded
- [ ] Feature works in production

## Important Rules

1. **Never give up** - Keep iterating until it works
2. **Test after every change** - Don't assume it works
3. **Fix errors immediately** - Don't skip failing tests
4. **Be thorough** - Test edge cases
5. **Verify in production** - Local success isn't enough
