# Deploy Your App to AWS

**One-time setup (15 minutes), then every future app deploys automatically!**

---

## Step 1: Get Your AWS Keys (5 minutes)

1. Go to **https://console.aws.amazon.com/iam**
2. Click **Users** → **Add users**
3. Name it: `github-deployer`
4. Click **Next** → **Attach policies directly**
5. Search and check these boxes:
   - `AmazonS3FullAccess`
   - `AmazonDynamoDBFullAccess`
   - `AWSLambda_FullAccess`
   - `AmazonAPIGatewayAdministrator`
   - `AWSCloudFormationFullAccess`
   - `IAMFullAccess`
6. Click **Next** → **Create user**
7. Click on the user → **Security credentials** → **Create access key**
8. Choose **Third-party service** → **Create access key**
9. **SAVE THESE TWO VALUES** (you'll need them in Step 2):
   - Access key ID
   - Secret access key

---

## Step 2: Add Keys to GitHub (5 minutes)

1. Go to your repo on GitHub: **https://github.com/neking1969/Location-Manager**
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add these 3 secrets:

| Name | Value |
|------|-------|
| `AWS_ACCESS_KEY_ID` | (paste your access key ID) |
| `AWS_SECRET_ACCESS_KEY` | (paste your secret access key) |
| `AWS_REGION` | `us-east-1` |

---

## Step 3: Merge Your Branch (2 minutes)

1. Go to **https://github.com/neking1969/Location-Manager**
2. You should see a yellow banner: "claude/setup-session-hook-u1lxQ had recent pushes"
3. Click **Compare & pull request**
4. Click **Create pull request**
5. Click **Merge pull request** → **Confirm merge**

---

## Step 4: Watch It Deploy!

1. Go to **https://github.com/neking1969/Location-Manager/actions**
2. You'll see the deployment running
3. When it's done (about 5 minutes), click on the job
4. Scroll to the bottom to see your app URLs!

---

## That's It!

From now on, whenever you push code to GitHub, your app automatically redeploys.

**Your app will be at:**
- Frontend: `http://location-manager-frontend-app.s3-website-us-east-1.amazonaws.com`
- API: (shown in the deployment output)

---

## Future Apps

For your next app, just:
1. Create a new GitHub repo
2. Copy the `.github/workflows/deploy.yml` file
3. Update the stack name in the workflow
4. Push to GitHub - it deploys automatically!

---

## Costs

- **DynamoDB**: Free up to 25GB
- **Lambda**: Free up to 1 million requests/month
- **S3**: Free up to 5GB
- **Typical monthly cost**: $0-5
