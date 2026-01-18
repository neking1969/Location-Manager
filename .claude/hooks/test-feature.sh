#!/bin/bash
set -euo pipefail

# Test Feature Script - Runs local server and tests endpoints
# Usage: ./test-feature.sh [feature-name]

FEATURE="${1:-all}"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(dirname $(dirname $(dirname $0)))}"

echo "============================================"
echo "Testing Feature: $FEATURE"
echo "Project Dir: $PROJECT_DIR"
echo "============================================"

cd "$PROJECT_DIR"

# Kill any existing servers
pkill -f "node.*server" 2>/dev/null || true
pkill -f "react-scripts" 2>/dev/null || true
sleep 2

# Start backend server in background
echo "Starting backend server..."
cd server
npm start &
SERVER_PID=$!
cd ..

# Wait for server to start
echo "Waiting for server to start..."
for i in {1..30}; do
  if curl -s http://localhost:5001/api/projects > /dev/null 2>&1; then
    echo "Server is running!"
    break
  fi
  sleep 1
done

# Run tests based on feature
run_ledger_test() {
  echo ""
  echo "Testing Ledger Upload API..."

  # Test 1: Check categories endpoint
  echo "Test 1: GET /api/upload/categories"
  CATEGORIES=$(curl -s http://localhost:5001/api/upload/categories)
  if echo "$CATEGORIES" | grep -q "Security"; then
    echo "✓ Categories endpoint working"
  else
    echo "✗ Categories endpoint failed"
    echo "Response: $CATEGORIES"
    return 1
  fi

  # Test 2: Check duplicate detection endpoint
  echo ""
  echo "Test 2: POST /api/upload/check-duplicates/:projectId"
  # First get a project ID
  PROJECTS=$(curl -s http://localhost:5001/api/projects)
  PROJECT_ID=$(echo "$PROJECTS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ -n "$PROJECT_ID" ]; then
    DUPE_RESPONSE=$(curl -s -X POST http://localhost:5001/api/upload/check-duplicates/$PROJECT_ID \
      -H "Content-Type: application/json" \
      -d '{"entries": [{"vendor": "TEST", "amount": 100, "date": "2025-01-01", "category": "Security"}]}')

    if echo "$DUPE_RESPONSE" | grep -q "duplicates"; then
      echo "✓ Duplicate check endpoint working"
    else
      echo "✗ Duplicate check endpoint failed"
      echo "Response: $DUPE_RESPONSE"
    fi
  else
    echo "⚠ No project found to test with"
  fi

  # Test 3: Check custom import endpoint exists
  echo ""
  echo "Test 3: POST /api/upload/ledger/import-custom/:projectId"
  if [ -n "$PROJECT_ID" ]; then
    IMPORT_RESPONSE=$(curl -s -X POST "http://localhost:5001/api/upload/ledger/import-custom/$PROJECT_ID" \
      -H "Content-Type: application/json" \
      -d '{"entries": []}')

    if echo "$IMPORT_RESPONSE" | grep -q "entries_imported\|error"; then
      echo "✓ Import custom endpoint responding"
    else
      echo "✗ Import custom endpoint failed"
      echo "Response: $IMPORT_RESPONSE"
    fi
  fi
}

run_api_test() {
  echo ""
  echo "Testing Core API..."

  # Test projects endpoint
  echo "Test: GET /api/projects"
  RESPONSE=$(curl -s http://localhost:5001/api/projects)
  if echo "$RESPONSE" | grep -q "\["; then
    echo "✓ Projects endpoint working"
    PROJECT_COUNT=$(echo "$RESPONSE" | grep -o '"id"' | wc -l)
    echo "  Found $PROJECT_COUNT projects"
  else
    echo "✗ Projects endpoint failed"
  fi
}

# Execute tests
case "$FEATURE" in
  ledger)
    run_ledger_test
    ;;
  api)
    run_api_test
    ;;
  all)
    run_api_test
    run_ledger_test
    ;;
  *)
    echo "Unknown feature: $FEATURE"
    echo "Available: ledger, api, all"
    ;;
esac

echo ""
echo "============================================"
echo "Tests complete!"
echo "============================================"

# Cleanup
kill $SERVER_PID 2>/dev/null || true
