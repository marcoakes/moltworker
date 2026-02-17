# Moltworker Deployment Guide - Real World Experience

This guide captures the complete deployment process based on actual implementation experience. It includes all the gotchas, workarounds, and solutions encountered during a real deployment.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Common Issues & Solutions](#common-issues--solutions)
- [Security Considerations](#security-considerations)
- [Cost Optimization](#cost-optimization)

---

## Prerequisites

### Required Accounts & Plans
1. **Cloudflare Account** with **Workers Paid Plan** ($5/month)
   - ⚠️ **Critical**: Cloudflare Containers are ONLY available on the Workers Paid plan
   - Standard free plan will NOT work - you'll get 404 errors when trying to access container features
   - Upgrade at: https://dash.cloudflare.com/?to=/:account/workers/plans

2. **Anthropic API Key**
   - Get one at: https://console.anthropic.com/
   - Set spending limits to prevent unexpected charges
   - Each interaction uses your API credits

3. **GitHub Account** (if using GitHub Actions for deployment)

### Required Tools
- **Node.js** v20 or later
- **Docker Desktop** (required for building container images)
  - Download: https://www.docker.com/products/docker-desktop/
  - Must be running before deployment
- **Git**

---

## Initial Setup

### 1. Fork or Clone the Repository

```bash
# Clone the original repository
git clone https://github.com/cloudflare/moltworker.git
cd moltworker

# Or fork to your own GitHub account first, then clone your fork
git clone https://github.com/YOUR_USERNAME/moltworker.git
cd moltworker
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create R2 Bucket (Optional but Recommended)

R2 provides persistent storage for conversation history and configuration.

1. Go to your Cloudflare dashboard: https://dash.cloudflare.com/
2. Navigate to **R2 Object Storage**
3. Click **Create bucket**
4. Name it (e.g., `marcmolt` or `moltbot-data`)
5. Create an R2 API token:
   - Click **Manage R2 API Tokens**
   - **Create API Token**
   - Permissions: **Object Read & Write**
   - Save the **Access Key ID** and **Secret Access Key**

### 4. Update wrangler.jsonc

Edit `wrangler.jsonc` to use your R2 bucket name:

```jsonc
"r2_buckets": [
  {
    "binding": "MOLTBOT_BUCKET",
    "bucket_name": "YOUR_BUCKET_NAME",  // Change this to your bucket name
  },
],
```

---

## Configuration

### Required Secrets

All secrets must be set using the Wrangler CLI. You'll need your Cloudflare API token first.

#### Get Cloudflare API Token

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click **Create Token**
3. Use **Edit Cloudflare Workers** template OR create custom token with:
   - **Account Settings**: Read
   - **Workers Scripts**: Edit
   - **Workers Containers**: Edit (REQUIRED for containers)
4. Copy the token immediately (you won't see it again)

#### Set Secrets via Wrangler

```bash
# Set Cloudflare API token in environment
export CLOUDFLARE_API_TOKEN="your-cloudflare-api-token"

# Set Anthropic API key
echo "your-anthropic-api-key" | npx wrangler secret put ANTHROPIC_API_KEY

# Generate and set gateway token (for authentication)
export GATEWAY_TOKEN=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
echo "Your gateway token (save this!): $GATEWAY_TOKEN"
echo "$GATEWAY_TOKEN" | npx wrangler secret put MOLTBOT_GATEWAY_TOKEN

# Set R2 credentials (if using R2 storage)
echo "your-r2-access-key-id" | npx wrangler secret put R2_ACCESS_KEY_ID
echo "your-r2-secret-access-key" | npx wrangler secret put R2_SECRET_ACCESS_KEY

# Set Cloudflare Account ID
echo "your-cloudflare-account-id" | npx wrangler secret put CF_ACCOUNT_ID

# Enable DEV_MODE to skip Cloudflare Access setup (for quick testing)
echo "true" | npx wrangler secret put DEV_MODE
```

⚠️ **Important**: Save your `GATEWAY_TOKEN` - you'll need it to access the worker!

---

## Deployment

### Option 1: Local Deployment (Recommended for First Time)

This is the most reliable method and gives you immediate feedback.

```bash
# Ensure Docker is running
docker ps

# Build and deploy
npm run build
npx wrangler deploy
```

**Expected output:**
```
✅ Created application moltbot-sandbox-sandbox
✅ Deployed moltbot-sandbox triggers
✅ URL: https://moltbot-sandbox.YOUR_USERNAME.workers.dev
```

The first deployment takes 2-5 minutes as it builds the Docker container.

### Option 2: GitHub Actions (For Automated Deployments)

If you want automatic deployments on every push:

#### 1. Set Up GitHub Secrets

Go to your repo: `https://github.com/YOUR_USERNAME/moltworker/settings/secrets/actions`

Add these secrets:
- `CLOUDFLARE_API_TOKEN` - Your Cloudflare API token (with Workers Containers permission)
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `ANTHROPIC_API_KEY` - Your Anthropic API key
- `MOLTBOT_GATEWAY_TOKEN` - Your gateway token
- `R2_ACCESS_KEY_ID` - Your R2 access key ID
- `R2_SECRET_ACCESS_KEY` - Your R2 secret access key
- `GH_PAT` - GitHub Personal Access Token with `repo` scope (for syncing upstream)

#### 2. Create Workflow File

Create `.github/workflows/deploy.yml`:

```yaml
name: Sync and Deploy Moltworker

on:
  workflow_dispatch:  # Manual trigger
  push:
    branches:
      - main
  schedule:
    - cron: '0 0 * * 0'  # Weekly sync on Sundays

jobs:
  sync-and-deploy:
    runs-on: ubuntu-latest

    env:
      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GH_PAT }}

      - name: Configure Git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Add upstream remote
        run: |
          git remote add upstream https://github.com/cloudflare/moltworker.git || true
          git fetch upstream

      - name: Merge upstream changes
        run: |
          git merge upstream/main --allow-unrelated-histories -X theirs || echo "No changes to merge"

      - name: Push changes
        run: |
          git push origin main || echo "Nothing to push"

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build project
        run: npm run build

      - name: Setup Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy --keep-vars

      - name: Set Cloudflare Worker Secrets
        run: |
          echo "${{ secrets.ANTHROPIC_API_KEY }}" | npx wrangler secret put ANTHROPIC_API_KEY || true
          echo "${{ secrets.MOLTBOT_GATEWAY_TOKEN }}" | npx wrangler secret put MOLTBOT_GATEWAY_TOKEN || true
          echo "${{ secrets.R2_ACCESS_KEY_ID }}" | npx wrangler secret put R2_ACCESS_KEY_ID || true
          echo "${{ secrets.R2_SECRET_ACCESS_KEY }}" | npx wrangler secret put R2_SECRET_ACCESS_KEY || true
          echo "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}" | npx wrangler secret put CF_ACCOUNT_ID || true
```

#### 3. Trigger Deployment

- Push to main branch, or
- Go to Actions tab and manually trigger the workflow

---

## Accessing Your Worker

After successful deployment, access your worker at:

```
https://moltbot-sandbox.YOUR_USERNAME.workers.dev/?token=YOUR_GATEWAY_TOKEN
```

⚠️ **First load takes 1-2 minutes** while the container starts up.

### Without Cloudflare Access (DEV_MODE)

If you set `DEV_MODE=true`, you can access the worker with just the gateway token in the URL.

### With Cloudflare Access (Production)

For production use, you should:
1. Remove `DEV_MODE` secret
2. Set up Cloudflare Access (see README.md)
3. Configure `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` secrets

---

## Common Issues & Solutions

### Issue 1: "Workers Containers not available" / 404 on containers dashboard

**Cause**: Not on Workers Paid plan

**Solution**:
1. Go to https://dash.cloudflare.com/?to=/:account/workers/plans
2. Upgrade to Workers Paid ($5/month)
3. Wait 5-10 minutes for activation
4. Create new API token with Workers Containers permission

### Issue 2: "Unable to authenticate request" [code: 10001]

**Cause**: Cloudflare API token missing Workers Containers permission

**Solution**:
1. Create new API token with Workers Containers permission
2. Update `CLOUDFLARE_API_TOKEN` environment variable
3. Redeploy

### Issue 3: Docker not found / "The Docker CLI could not be launched"

**Cause**: Docker not installed or not running

**Solution**:
1. Install Docker Desktop
2. Start Docker Desktop
3. Verify: `docker ps`
4. Try deployment again

### Issue 4: "Configuration Required" - Missing CF_ACCESS variables

**Cause**: Worker checking for Cloudflare Access configuration

**Solution A** (Quick - DEV_MODE):
```bash
echo "true" | npx wrangler secret put DEV_MODE
```

**Solution B** (Production - Set up Cloudflare Access):
Follow the Cloudflare Access setup in README.md

### Issue 5: "Invalid or missing token" when accessing worker

**Cause**: Gateway token not being passed correctly

**Solution**:
1. Verify token is set: `npx wrangler secret list`
2. Access without token parameter (worker auto-injects):
   ```
   https://moltbot-sandbox.YOUR_USERNAME.workers.dev/
   ```
3. Or explicitly include token:
   ```
   https://moltbot-sandbox.YOUR_USERNAME.workers.dev/?token=YOUR_TOKEN
   ```

### Issue 6: GitHub Actions deployment fails with authentication error

**Cause**: Multiple possible causes
- Token doesn't have Workers Containers permission
- Not on Workers Paid plan
- Token expired or invalid

**Solution**:
1. Verify account is on Workers Paid plan
2. Create new token with ALL these permissions:
   - Account Settings: Read
   - Workers Scripts: Edit
   - Workers Containers: Edit
3. Update GitHub secret `CLOUDFLARE_API_TOKEN`
4. Re-run workflow

### Issue 7: "command not found: npm" or "command not found: npx"

**Cause**: Node.js not installed or not in PATH

**Solution**:
```bash
# Install Node.js v20 to ~/.local/node
cd ~
wget https://nodejs.org/dist/v20.11.0/node-v20.11.0-darwin-x64.tar.gz
mkdir -p ~/.local
tar -xzf node-v20.11.0-darwin-x64.tar.gz -C ~/.local
mv ~/.local/node-v20.11.0-darwin-x64 ~/.local/node
export PATH="$HOME/.local/node/bin:$PATH"

# Add to your shell profile to persist
echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> ~/.zshrc
```

### Issue 8: Container starts but chat disconnects immediately

**Cause**: Gateway process not starting correctly or token mismatch

**Solution**:
1. Check container logs:
   ```bash
   # Enable debug routes first
   echo "true" | npx wrangler secret put DEBUG_ROUTES

   # Then check logs
   curl "https://your-worker.workers.dev/debug/logs?token=YOUR_TOKEN&tail=100"
   ```
2. Look for startup errors in logs
3. Verify all secrets are set correctly: `npx wrangler secret list`

---

## Security Considerations

### Cost Protection

⚠️ **IMPORTANT**: Anyone with your worker URL + token can use YOUR Anthropic API credits!

**Mitigations**:
1. **Set Anthropic API spending limits**: https://console.anthropic.com/
2. **Keep token private**: Only share with trusted people
3. **Enable Cloudflare Access**: Remove `DEV_MODE` and set up proper authentication
4. **Monitor usage**: Check https://console.anthropic.com/ regularly

### Recommended for Production

If sharing with others or using in production:

1. **Remove DEV_MODE**:
   ```bash
   npx wrangler secret delete DEV_MODE
   ```

2. **Set up Cloudflare Access** (follow README.md)

3. **Set environment variables**:
   ```bash
   echo "your-team.cloudflareaccess.com" | npx wrangler secret put CF_ACCESS_TEAM_DOMAIN
   echo "your-application-aud-tag" | npx wrangler secret put CF_ACCESS_AUD
   ```

4. **Rotate gateway token regularly**:
   ```bash
   export NEW_TOKEN=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
   echo "$NEW_TOKEN" | npx wrangler secret put MOLTBOT_GATEWAY_TOKEN
   ```

---

## Cost Optimization

Running 24/7 costs approximately **$34.50/month**:
- Workers Paid plan: $5/month
- Container compute: ~$28-29/month
- Network/storage: ~$1-2/month

### Reduce Costs with Auto-Sleep

Configure the container to sleep when idle:

```bash
# Sleep after 10 minutes of inactivity
echo "10m" | npx wrangler secret put SANDBOX_SLEEP_AFTER
```

With this setting, if you only use it 4-5 hours/day, costs drop to approximately **$10-12/month total**.

Other cost-saving options:
- Use a smaller instance type (edit `wrangler.jsonc`)
- Only run when needed (manually start/stop)
- Use Cloudflare AI Gateway with unified billing for better rate limits

---

## Debugging Tools

### Check Worker Status

```bash
# List all secrets
npx wrangler secret list

# Tail logs in real-time
npx wrangler tail --format pretty

# View recent deployments
npx wrangler deployments list
```

### Debug Endpoints (when DEBUG_ROUTES=true)

```bash
# Check environment configuration
curl "https://your-worker.workers.dev/debug/env?token=YOUR_TOKEN"

# Check running processes
curl "https://your-worker.workers.dev/debug/processes?token=YOUR_TOKEN"

# View container logs
curl "https://your-worker.workers.dev/debug/logs?token=YOUR_TOKEN&tail=100"

# Check gateway API
curl "https://your-worker.workers.dev/debug/gateway-api?token=YOUR_TOKEN"
```

---

## Tips & Best Practices

1. **Start with DEV_MODE**: Get it working first, then add Cloudflare Access
2. **Use R2 storage**: Persistence is crucial for a good experience
3. **Monitor costs**: Check Cloudflare and Anthropic dashboards regularly
4. **Keep Docker running**: Required for all deployments
5. **Save your tokens**: Store gateway token in password manager
6. **Test locally first**: Deploy locally before setting up GitHub Actions
7. **Read container logs**: They're your best friend for debugging
8. **Update regularly**: Run the GitHub Actions weekly sync to get upstream improvements

---

## Quick Reference Commands

```bash
# Deploy
npm run build && npx wrangler deploy

# Update a secret
echo "new-value" | npx wrangler secret put SECRET_NAME

# View logs
npx wrangler tail --format pretty

# Delete a secret
npx wrangler secret delete SECRET_NAME

# List all secrets
npx wrangler secret list

# Check deployment status
npx wrangler deployments list
```

---

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare Containers Documentation](https://developers.cloudflare.com/containers/)
- [OpenClaw Documentation](https://docs.openclaw.ai/)
- [Anthropic API Documentation](https://docs.anthropic.com/)

---

## Success Checklist

Before considering your deployment complete, verify:

- [ ] Worker deploys successfully
- [ ] Worker URL loads (may take 1-2 minutes first time)
- [ ] Can access with gateway token
- [ ] Chat interface connects and responds
- [ ] R2 storage configured (optional but recommended)
- [ ] Spending limits set on Anthropic API
- [ ] Gateway token saved securely
- [ ] GitHub Actions working (if using automated deployment)
- [ ] Cloudflare Access configured (for production)

---

## Getting Help

If you encounter issues not covered here:

1. Check container logs via debug endpoints
2. Review Cloudflare Workers logs in dashboard
3. Check Anthropic API usage/errors
4. Review [OpenClaw GitHub issues](https://github.com/openclaw/openclaw/issues)
5. Review [Moltworker GitHub issues](https://github.com/cloudflare/moltworker/issues)

---

**Time to Deploy**: First-time deployment typically takes 1-2 hours including account setup, troubleshooting, and testing. Subsequent deployments take 5-10 minutes.

**Difficulty**: Intermediate - requires familiarity with command line, Docker, and API tokens.

---

*This guide is based on real deployment experience and captures actual issues encountered and solved during implementation.*
