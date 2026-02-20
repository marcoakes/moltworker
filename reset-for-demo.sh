#!/bin/bash
# Reset skills to seed state for a fresh demo

echo "🔄 Resetting skills to seed state..."
curl -X POST https://moltbot-sandbox.marcoakes.workers.dev/api/skills/reset

echo ""
echo "✅ Skills reset complete!"
echo ""
echo "Verifying..."
curl -s https://moltbot-sandbox.marcoakes.workers.dev/api/skills/stats | python3 -m json.tool

echo ""
echo "🎬 Ready for demo! You should see 4 skills (3 general + 1 meta)"
