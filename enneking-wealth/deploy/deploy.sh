#!/bin/bash
set -euo pipefail

# Enneking Wealth - AWS Deployment Script
# Usage: ./deploy.sh [staging|production]

ENVIRONMENT="${1:-production}"
STACK_NAME="enneking-wealth-${ENVIRONMENT}"
REGION="${AWS_REGION:-us-west-2}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "========================================="
echo "  Enneking Wealth - Deploy to AWS"
echo "  Environment: ${ENVIRONMENT}"
echo "  Region: ${REGION}"
echo "========================================="

# Check for required tools
for cmd in aws node npm; do
  if ! command -v "$cmd" &> /dev/null; then
    echo "Error: $cmd is required but not installed."
    exit 1
  fi
done

# Check for .env file
if [ ! -f "$PROJECT_DIR/.env" ]; then
  echo "Error: .env file not found. Copy .env.example to .env and fill in values."
  exit 1
fi

# Source env vars
set -a
source "$PROJECT_DIR/.env"
set +a

echo ""
echo "Step 1: Building React frontend..."
cd "$PROJECT_DIR/client"
REACT_APP_API_URL="" npm run build
echo "Frontend built successfully."

echo ""
echo "Step 2: Deploying CloudFormation stack..."
aws cloudformation deploy \
  --template-file "$SCRIPT_DIR/cloudformation.yaml" \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    Environment="$ENVIRONMENT" \
    PlaidClientId="$PLAID_CLIENT_ID" \
    PlaidSecret="$PLAID_SECRET" \
    PlaidEnv="$PLAID_ENV" \
    FinnhubApiKey="$FINNHUB_API_KEY" \
  --no-fail-on-empty-changeset

echo "CloudFormation stack deployed."

# Get outputs
S3_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucket`].OutputValue' \
  --output text)

CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' \
  --output text)

LAMBDA_NAME=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunction`].OutputValue' \
  --output text)

echo ""
echo "Step 3: Uploading frontend to S3..."
aws s3 sync "$PROJECT_DIR/client/build/" "s3://$S3_BUCKET/" \
  --delete \
  --cache-control "public, max-age=31536000" \
  --exclude "index.html" \
  --exclude "asset-manifest.json" \
  --exclude "manifest.json"

# Upload HTML/JSON with short cache
aws s3 cp "$PROJECT_DIR/client/build/index.html" "s3://$S3_BUCKET/index.html" \
  --cache-control "public, max-age=0, must-revalidate"

if [ -f "$PROJECT_DIR/client/build/asset-manifest.json" ]; then
  aws s3 cp "$PROJECT_DIR/client/build/asset-manifest.json" "s3://$S3_BUCKET/asset-manifest.json" \
    --cache-control "public, max-age=0, must-revalidate"
fi

echo "Frontend uploaded."

echo ""
echo "Step 4: Packaging and deploying Lambda..."
cd "$PROJECT_DIR/server"
rm -rf /tmp/enneking-wealth-lambda
mkdir -p /tmp/enneking-wealth-lambda
cp -r src/* /tmp/enneking-wealth-lambda/
cp package.json /tmp/enneking-wealth-lambda/

# Create Lambda handler wrapper
cat > /tmp/enneking-wealth-lambda/index.js << 'HANDLER'
const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');

const plaidRoutes = require('./routes/plaid');
const stockRoutes = require('./routes/stocks');
const portfolioRoutes = require('./routes/portfolio');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/plaid', plaidRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/portfolio', portfolioRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports.handler = serverless(app);
HANDLER

cd /tmp/enneking-wealth-lambda
npm install --production
npm install serverless-http

# Create zip
cd /tmp/enneking-wealth-lambda
zip -r /tmp/enneking-wealth-lambda.zip . -q

# Deploy to Lambda
aws lambda update-function-code \
  --function-name "$LAMBDA_NAME" \
  --zip-file fileb:///tmp/enneking-wealth-lambda.zip \
  --region "$REGION"

echo "Lambda deployed."

# Clean up
rm -rf /tmp/enneking-wealth-lambda /tmp/enneking-wealth-lambda.zip

echo ""
echo "Step 5: Invalidating CloudFront cache..."
DISTRIBUTION_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Origins.Items[?Id=='S3Origin' && contains(DomainName, '${S3_BUCKET}')]].Id" \
  --output text)

if [ -n "$DISTRIBUTION_ID" ]; then
  aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text
  echo "Cache invalidated."
fi

echo ""
echo "========================================="
echo "  Deployment Complete!"
echo "========================================="
echo ""
echo "  URL: ${CLOUDFRONT_URL}"
echo ""
echo "  Next steps:"
echo "  1. Visit ${CLOUDFRONT_URL} to verify"
echo "  2. Link your Fidelity account"
echo "  3. Link your Merrill Lynch account"
echo ""
