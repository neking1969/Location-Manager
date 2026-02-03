#!/bin/bash
set -e

FUNCTION_NAME="location-manager-sync"
REGION="us-west-2"
RUNTIME="nodejs20.x"
HANDLER="lambda/handler.handler"
TIMEOUT=60
MEMORY=512

cd "$(dirname "$0")/.."

echo "Building deployment package..."
rm -rf dist lambda-package.zip
mkdir -p dist

cp -r src dist/
cp -r lambda dist/
cp package.json dist/
cp .env dist/ 2>/dev/null || echo "No .env file found, continuing..."

cd dist
npm install --omit=dev --silent

echo "Creating zip..."
zip -r ../lambda-package.zip . -x "*.DS_Store" -x "node_modules/.cache/*" > /dev/null

cd ..

if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null; then
    echo "Updating existing function..."
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://lambda-package.zip \
        --region $REGION
else
    echo "Creating new function..."

    ROLE_ARN=$(aws iam get-role --role-name lambda-execution-role --query 'Role.Arn' --output text 2>/dev/null || true)

    if [ -z "$ROLE_ARN" ]; then
        echo "Creating IAM role..."
        aws iam create-role \
            --role-name lambda-execution-role \
            --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

        aws iam attach-role-policy \
            --role-name lambda-execution-role \
            --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

        ROLE_ARN=$(aws iam get-role --role-name lambda-execution-role --query 'Role.Arn' --output text)
        echo "Waiting for role propagation..."
        sleep 10
    fi

    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime $RUNTIME \
        --role $ROLE_ARN \
        --handler $HANDLER \
        --zip-file fileb://lambda-package.zip \
        --timeout $TIMEOUT \
        --memory-size $MEMORY \
        --region $REGION \
        --environment "Variables={NODE_OPTIONS=--experimental-vm-modules}"
fi

echo "Setting up Function URL..."
aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id FunctionURLAllowPublicAccess \
    --action lambda:InvokeFunctionUrl \
    --principal "*" \
    --function-url-auth-type NONE \
    --region $REGION 2>/dev/null || true

URL=$(aws lambda create-function-url-config \
    --function-name $FUNCTION_NAME \
    --auth-type NONE \
    --region $REGION \
    --query 'FunctionUrl' \
    --output text 2>/dev/null || \
    aws lambda get-function-url-config \
    --function-name $FUNCTION_NAME \
    --region $REGION \
    --query 'FunctionUrl' \
    --output text)

echo ""
echo "Deployment complete!"
echo "Function URL: $URL"
echo ""
echo "Endpoints:"
echo "  Health: ${URL}health"
echo "  Sync:   ${URL}sync"
echo "  Approve: ${URL}approve"

rm -rf dist lambda-package.zip
