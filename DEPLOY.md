# How to Deploy Your App to AWS

This guide will help you deploy your app so you can access it from any browser.

---

## Step 1: Deploy the Backend (API)

1. **Go to AWS Console**: https://console.aws.amazon.com
2. **Search for "SAM"** in the search bar and click "AWS Serverless Application Repository"
3. **Or use CloudShell** (easier):
   - Click the terminal icon (>_) in the top navigation bar
   - This opens a command line in your browser
   - Run these commands:

```bash
# Download your code
git clone https://github.com/neking1969/Location-Manager.git
cd Location-Manager

# Install the SAM CLI (if not already installed)
pip install aws-sam-cli

# Deploy the backend
cd aws
sam build
sam deploy --guided
```

4. **Answer the prompts**:
   - Stack Name: `location-manager`
   - AWS Region: `us-east-1` (or your preferred region)
   - Confirm changes: `y`
   - Allow SAM CLI IAM role creation: `y`
   - Save arguments: `y`

5. **Copy the API URL** shown at the end (looks like: `https://xxxxx.execute-api.us-east-1.amazonaws.com`)

---

## Step 2: Deploy the Frontend

1. **Go to AWS Amplify**: https://console.aws.amazon.com/amplify
2. **Click "New app"** → "Host web app"
3. **Select "GitHub"** and connect your account
4. **Choose your repository**: `Location-Manager`
5. **Choose branch**: `claude/setup-session-hook-u1lxQ` (or main after merging)
6. **Click "Next"** through the settings (defaults are fine)
7. **Before deploying**, click "Edit" under "Environment variables"
8. **Add this variable**:
   - Key: `REACT_APP_API_URL`
   - Value: (paste the API URL from Step 1)
9. **Click "Save and deploy"**

---

## Step 3: Access Your App

After deployment completes (2-3 minutes), Amplify will show you a URL like:
`https://main.xxxxx.amplifyapp.com`

**Click it to open your app in Safari!**

---

## Updating Your App

Whenever you push new code to GitHub, Amplify automatically redeploys your app. Just wait a few minutes and refresh the page.

---

## Costs

With AWS Free Tier, this setup typically costs:
- **DynamoDB**: Free for up to 25GB storage
- **Lambda**: Free for up to 1 million requests/month
- **Amplify Hosting**: Free for up to 1000 build minutes/month

For a small app like this, you'll likely pay **$0-5/month**.
