#!/bin/bash
# Complete setup for Moltbot Skills System
# Run this script to configure all required secrets

echo "🚀 Complete Moltbot Skills Setup"
echo "================================="
echo ""

# Check if wrangler is available
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npx not found. Please install Node.js first."
    exit 1
fi

echo "✅ Skills system has been deployed successfully!"
echo "✅ SKILLS_ENABLED is set to: true"
echo "✅ DEMO_MODE is set to: true"
echo ""
echo "To complete the setup, you need to configure the following secrets:"
echo ""

# ANTHROPIC_API_KEY
echo "1️⃣  ANTHROPIC_API_KEY (required for AI reflection)"
echo "   Get your key from: https://console.anthropic.com/"
read -p "   Do you want to set it now? (y/n): " set_anthropic
if [[ "$set_anthropic" =~ ^[Yy]$ ]]; then
    read -sp "   Enter your Anthropic API key: " api_key
    echo ""
    echo "$api_key" | npx wrangler secret put ANTHROPIC_API_KEY
    echo "   ✅ ANTHROPIC_API_KEY configured"
else
    echo "   ⚠️  Skipped - You'll need to set this later with:"
    echo "      npx wrangler secret put ANTHROPIC_API_KEY"
fi
echo ""

# MOLTBOT_GATEWAY_TOKEN
echo "2️⃣  MOLTBOT_GATEWAY_TOKEN (for gateway access)"
read -p "   Generate a random token? (y/n): " gen_token
if [[ "$gen_token" =~ ^[Yy]$ ]]; then
    token=$(openssl rand -hex 32)
    echo "$token" | npx wrangler secret put MOLTBOT_GATEWAY_TOKEN
    echo "   ✅ MOLTBOT_GATEWAY_TOKEN configured"
    echo "   📝 Save this token: $token"
    echo "   You'll need it to access the Control UI"
else
    echo "   ⚠️  Skipped - You can set this later with:"
    echo "      openssl rand -hex 32 | npx wrangler secret put MOLTBOT_GATEWAY_TOKEN"
fi
echo ""

# Cloudflare Access (optional for production)
echo "3️⃣  Cloudflare Access (optional - for production API security)"
echo "   This protects /_admin and /api routes in production"
read -p "   Do you want to configure Cloudflare Access? (y/n): " config_access
if [[ "$config_access" =~ ^[Yy]$ ]]; then
    read -p "   Enter CF_ACCESS_TEAM_DOMAIN (e.g., myteam.cloudflareaccess.com): " team_domain
    read -p "   Enter CF_ACCESS_AUD (Application Audience Tag): " aud

    echo "$team_domain" | npx wrangler secret put CF_ACCESS_TEAM_DOMAIN
    echo "$aud" | npx wrangler secret put CF_ACCESS_AUD
    echo "   ✅ Cloudflare Access configured"
else
    echo "   ⚠️  Skipped - For local development, you can skip this"
    echo "   Set DEV_MODE=true in .dev.vars for local testing without auth"
fi
echo ""

echo "================================="
echo "✅ Setup Complete!"
echo ""
echo "Next steps:"
echo "  1. Visit your dashboard: https://moltbot-sandbox.marcoakes.workers.dev/_skills"
echo "  2. Click 'Test Skills System' to verify everything works"
echo "  3. Send a test message in chat to see skills in action"
echo ""
echo "Dashboard URL: https://moltbot-sandbox.marcoakes.workers.dev/_skills"
echo "Worker URL: https://moltbot-sandbox.marcoakes.workers.dev"
echo ""
