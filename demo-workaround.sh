#!/bin/bash

echo "🎬 Skills Demo Workaround Script"
echo "================================"
echo ""
echo "Since automatic WebSocket detection isn't working yet,"
echo "this script simulates what would happen automatically."
echo ""

echo "📊 Current state:"
curl -s https://moltbot-sandbox.marcoakes.workers.dev/api/skills/stats | \
  python3 -c "import sys, json; d=json.load(sys.stdin); print(f'Total skills: {d[\"total\"]}')"

echo ""
echo "▶️  Simulating: User asks 'Compare NVDA and AMD gross margins'"
echo "▶️  Agent responds with comparison"
echo "▶️  Reflection identifies new pattern about fiscal years..."
echo ""

read -p "Press ENTER to create the learned skill..."

echo ""
echo "💡 Creating new skill: Fiscal Year Normalization"
curl -s -X POST https://moltbot-sandbox.marcoakes.workers.dev/api/skills/create-demo-skill | \
  python3 -m json.tool

echo ""
echo ""
echo "✅ Skill created! Check the dashboard:"
echo "   https://moltbot-sandbox.marcoakes.workers.dev/_skills"
echo ""

echo "📊 New state:"
curl -s https://moltbot-sandbox.marcoakes.workers.dev/api/skills/stats | \
  python3 -c "import sys, json; d=json.load(sys.stdin); print(f'Total skills: {d[\"total\"]} (was 4)')"

echo ""
echo "🎯 The skill system works! Just need to fix WebSocket message detection for full automation."
