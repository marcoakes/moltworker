#!/bin/bash
# Setup script for the skills system

echo "🧠 Skills System Setup"
echo "====================="
echo ""

# Check if wrangler is available
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npx not found. Please install Node.js first."
    exit 1
fi

echo "This script will configure the skills system for your Moltbot deployment."
echo ""
echo "The skills system requires the following environment variables:"
echo "  - SKILLS_ENABLED=true (required - enables the skills system)"
echo "  - DEMO_MODE=true (optional - forces skill creation for demo purposes)"
echo ""

# Ask if they want to enable skills
read -p "Enable skills system? (y/n): " enable_skills

if [[ "$enable_skills" =~ ^[Yy]$ ]]; then
    echo "true" | npx wrangler secret put SKILLS_ENABLED
    echo "✅ SKILLS_ENABLED set to true"
else
    echo "❌ Skills system will remain disabled"
    exit 0
fi

# Ask about demo mode
read -p "Enable demo mode? (y/n): " enable_demo

if [[ "$enable_demo" =~ ^[Yy]$ ]]; then
    echo "true" | npx wrangler secret put DEMO_MODE
    echo "✅ DEMO_MODE set to true"
fi

echo ""
echo "✅ Skills system configured successfully!"
echo ""
echo "Next steps:"
echo "  1. Deploy with: npm run deploy"
echo "  2. Visit the dashboard at: https://your-worker.workers.dev/_skills"
echo "  3. Run the test button to verify everything works"
echo ""
