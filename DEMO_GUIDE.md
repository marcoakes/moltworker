# Demo Guide: Self-Improving Skills System

## Quick Start Demo (5 Minutes)

### Prerequisites
- Cloudflare account with Workers deployed
- Anthropic API key configured
- Access to the worker URL

### Step 1: Deploy (2 minutes)

```bash
cd /Users/moakes/one-skill-to-rule-them-all

# Build and deploy
npm run deploy
```

Wait for deployment to complete. Note your worker URL (e.g., `https://moltbot.your-account.workers.dev`)

### Step 2: Enable Skills (1 minute)

```bash
# Enable the skills system
wrangler secret put SKILLS_ENABLED
# When prompted, enter: true
```

### Step 3: Initialize & View Dashboard (30 seconds)

**Option A: Via Browser**
1. Open your browser
2. Go to `https://your-worker-url/_skills`
3. You should see the dashboard with 4 seed skills

**Option B: Via API**
```bash
# Initialize skills (if dashboard shows 0 skills)
curl -X POST https://your-worker-url/api/skills/initialize \
  -H "Cookie: CF_Authorization=YOUR_CF_ACCESS_TOKEN"

# View skills via API
curl https://your-worker-url/api/skills/stats \
  -H "Cookie: CF_Authorization=YOUR_CF_ACCESS_TOKEN"
```

### Step 4: Demo the Learning (2 minutes)

1. **Open the main UI**: `https://your-worker-url/`

2. **First Question** (creates baseline):
   ```
   Compare NVDA and AMD gross margins over the last 8 quarters
   ```

   - Agent responds using only general skills
   - Behind the scenes: reflection runs and may create a new skill about fiscal year normalization

3. **Check Dashboard** (refresh after 10-15 seconds):
   - Go to `https://your-worker-url/_skills`
   - Look at "Recently Created Skills" - should see a new skill!
   - Note the "Total Skills" count increased

4. **Second Question** (uses learned skill):
   ```
   How do MSFT and AAPL R&D spending trends compare over the last year?
   ```

   - Agent now has the fiscal year skill loaded automatically
   - Response should be more informed

5. **Check Dashboard Again**:
   - Refresh dashboard
   - Check "Most Retrieved Skills" - the new skill should have times_retrieved > 0
   - Maybe another new skill about R&D comparisons

6. **Continue the Cycle** (3-4 more questions):
   ```
   Find companies in the semiconductor industry with revenue growth above 20%

   What's the difference between GAAP and non-GAAP earnings for TSLA?

   Compare the operating margins of tech companies vs traditional manufacturers
   ```

7. **Final Dashboard Check**:
   - Total skills should be 7-10 (started with 4)
   - Recent skills show the learning journey
   - Most retrieved shows which skills are most useful

---

## Detailed Demo Flow (15 Minutes)

### Setup Phase (5 minutes)

#### 1. Deploy the Worker

```bash
cd /Users/moakes/one-skill-to-rule-them-all

# Install dependencies (if not done)
npm install

# Build and deploy
npm run deploy
```

Expected output:
```
✓ built in XXXms
✨  Total Upload: XX.XX KiB / gzip: XX.XX KiB
✨  Uploaded moltbot-sandbox (X.XX sec)
✨  Published moltbot-sandbox (X.XX sec)
   https://moltbot-sandbox.your-account.workers.dev
```

#### 2. Configure Secrets

```bash
# Enable skills (required)
wrangler secret put SKILLS_ENABLED
# Enter: true

# Verify Anthropic API key is set (should already be configured)
wrangler secret list
# Should show: ANTHROPIC_API_KEY, MOLTBOT_GATEWAY_TOKEN, SKILLS_ENABLED
```

#### 3. Enable Debug Logging (Optional but recommended for demo)

```bash
# This lets you see skills being injected in real-time
wrangler secret put DEBUG_ROUTES
# Enter: true
```

#### 4. Open Logs in Separate Terminal

```bash
# In a new terminal window
cd /Users/moakes/one-skill-to-rule-them-all
wrangler tail
```

Keep this running to see real-time logs.

### Demo Phase (10 minutes)

#### Open Your Demo Windows

1. **Terminal 1**: Logs (`wrangler tail`)
2. **Browser Tab 1**: Main UI at `https://your-worker-url/`
3. **Browser Tab 2**: Dashboard at `https://your-worker-url/_skills`

#### Demo Script

**[Show Dashboard]**
- "Here's the skills dashboard showing our AI's learned knowledge"
- Point out: Total Skills (4), Categories, Seed skills
- "These are the baseline skills - let's watch it learn new ones"

**[Go to Main UI]**
- "Now I'll ask a financial analysis question"

**Question 1: Earnings Comparison**
```
Compare NVDA and AMD gross margins over the last 8 quarters
```

**[Check Logs]**
- Look for: `[Skills] Injected 3 skills into message`
- Look for: `[Skills] Triggered reflection for conversation XXX`
- "The system just injected our general skills and is now reflecting on the interaction"

**[Wait 10 seconds, refresh dashboard]**
- "Look - a new skill appeared!"
- Point to "Recently Created Skills"
- Show the new skill (likely about fiscal year normalization)
- "The AI identified that comparing companies requires normalizing fiscal year calendars"

**Question 2: Similar Comparison**
```
How do MSFT and AAPL R&D spending trends compare?
```

**[Check Logs]**
- Look for: `[Skills] Injected 4 skills into message` (general + new skill)
- "Notice it retrieved 4 skills this time - the new fiscal year skill is being used!"

**[Dashboard]**
- Refresh dashboard
- "Most Retrieved Skills" now shows the fiscal year skill with times_retrieved = 1
- Possibly another new skill about R&D analysis

**Question 3: Screening Query**
```
Find semiconductor companies with revenue growth above 20%
```

**[Check Logs]**
- "This triggered the screening category detection"
- May create a screening-specific skill

**Question 4: More Complex**
```
Compare operating efficiency (operating margin) between tech companies and traditional manufacturers
```

**[Final Dashboard View]**
- Show total skills grew from 4 → 7-9
- Show timeline of skill creation
- "In just a few interactions, our AI built domain expertise"
- "These skills will persist and be used for all future queries"

**[Demo Reset Capability]**
- Click "Reset to Seed Skills" button
- Confirm
- "Back to baseline - ready for another demo or different domain"

---

## Demo Talking Points

### 1. The Problem
"Traditional AI assistants forget everything between sessions. Every query starts from scratch. No learning, no improvement."

### 2. The Solution
"This system allows the AI to learn from experience and build a library of reusable skills - patterns that worked well get captured and applied to future tasks."

### 3. How It Works
- "Skills are automatically extracted from successful interactions"
- "Keyword matching retrieves relevant skills for each query"
- "Skills are injected into the context so the AI can use them"
- "Background reflection evaluates what worked and creates new skills"

### 4. The Benefits
- "Faster responses - no need to re-learn patterns"
- "Better consistency - proven approaches get reused"
- "Domain adaptation - the AI gets better at YOUR specific tasks"
- "No retraining required - all learning happens in production"

### 5. Technical Highlights
- "Runs on Cloudflare Workers - serverless, scalable"
- "R2 storage for persistence across restarts"
- "Background processing doesn't slow down responses"
- "Token budget management keeps costs predictable"

---

## Troubleshooting

### Dashboard shows 0 skills?

```bash
# Initialize manually
curl -X POST https://your-worker-url/api/skills/initialize

# Or reset to seeds
curl -X POST https://your-worker-url/api/skills/reset
```

### Skills not being created?

1. Check logs for errors:
   ```bash
   wrangler tail
   ```

2. Verify ANTHROPIC_API_KEY is set:
   ```bash
   wrangler secret list
   ```

3. Check skills are enabled:
   ```bash
   wrangler secret list | grep SKILLS_ENABLED
   ```

### Can't access dashboard?

1. Check you're authenticated with Cloudflare Access
2. Try accessing via API first:
   ```bash
   curl https://your-worker-url/api/skills/stats
   ```

### Logs not showing skill injection?

- Make sure `SKILLS_ENABLED=true`
- Check message format is being detected (may need to adjust detection logic)

---

## API Testing (Alternative Demo)

If you prefer to demo via API:

```bash
# 1. Check initial state
curl https://your-worker-url/api/skills/stats

# 2. List all skills
curl https://your-worker-url/api/skills

# 3. Get specific skill
curl https://your-worker-url/api/skills/general-verify-source

# 4. Reset to seeds
curl -X POST https://your-worker-url/api/skills/reset

# 5. Watch stats grow
# (interact with UI, then check again)
curl https://your-worker-url/api/skills/stats
```

---

## Quick Demo Script (30 seconds)

Perfect for a fast demo:

1. Open dashboard: "Here are 4 baseline skills"
2. Ask: "Compare NVDA and AMD margins"
3. Refresh dashboard 10 seconds later: "Now we have 5 skills - it learned about fiscal years"
4. Ask: "Compare MSFT and AAPL spending"
5. Show dashboard: "The fiscal year skill was retrieved automatically"
6. "Over time, it builds expertise in YOUR specific domain"

---

## Demo Best Practices

### Before the Demo
- ✅ Deploy and test in advance
- ✅ Reset skills to seed state
- ✅ Have logs running in background
- ✅ Test network connectivity
- ✅ Have backup API commands ready

### During the Demo
- ✅ Explain what's happening at each step
- ✅ Show the logs to prove it's real-time
- ✅ Point out the skill count increasing
- ✅ Highlight the retrieval counts
- ✅ Explain the token budget management

### After the Demo
- ✅ Show the implementation files
- ✅ Explain the architecture
- ✅ Discuss future enhancements
- ✅ Answer questions about integration

---

## Example Demo Narrative

> "Let me show you something cool. This is a self-improving AI system. Watch this dashboard - we start with 4 basic skills."
>
> [Ask first question]
>
> "Behind the scenes, the AI is now reflecting on what just happened. It's asking itself: what pattern made this work? What should I remember?"
>
> [Refresh dashboard]
>
> "Look - it just created a new skill about normalizing fiscal years. It realized that when comparing companies, you need to account for different fiscal calendars."
>
> [Ask second question]
>
> "This time, the AI automatically retrieved that fiscal year skill. It didn't have to re-learn it. The skill is now part of its permanent knowledge."
>
> [Show final dashboard]
>
> "After just a few interactions, we've gone from 4 generic skills to 8 domain-specific skills. And these persist forever. The AI literally got smarter through experience."
>
> "No retraining. No fine-tuning. No manual prompt engineering. Just learning through doing."

---

**Ready to Demo?** Start with the Quick Start Demo above, then customize based on your audience!
