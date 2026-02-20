#!/bin/bash

echo "🧪 Testing Skills System Manually..."
echo ""

# Test 1: Can we retrieve skills?
echo "1. Testing skill retrieval..."
curl -s -X POST https://moltbot-sandbox.marcoakes.workers.dev/api/skills/test-retrieval \
  -H "Content-Type: application/json" \
  -d '{"message": "Compare NVDA and AMD gross margins"}' \
  | python3 -m json.tool

echo ""
echo "2. Checking if retrieval counts increased..."
curl -s https://moltbot-sandbox.marcoakes.workers.dev/api/skills | \
  python3 -c "import sys, json; data = json.load(sys.stdin); [print(f'{s[\"name\"]}: {s[\"times_retrieved\"]}') for s in data['skills']]"
