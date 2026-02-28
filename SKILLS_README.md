# Skills System - Self-Improving AI

This is a self-improving skills system that learns from conversations and automatically creates reusable patterns.

## How It Works

The skills system has three main components:

### 1. **Skills Injection**
When you send a message in chat, the system:
- Analyzes your message
- Retrieves relevant skills from the library
- Injects those skills into the message context
- Helps Claude provide better, more consistent responses

### 2. **Reflection & Learning**
After each conversation:
- The system reviews what happened
- Evaluates if existing skills were helpful
- Decides if a new pattern should be captured
- Creates new skills automatically (when appropriate)

### 3. **Skills Dashboard**
View and manage your growing skill library at `/_skills`:
- See total skills by category
- View recently created skills
- See which skills are used most
- Test the system
- Reset to seed state if needed

## Setup Instructions

### 1. Configure Environment Variables

Run the setup script:
```bash
./setup-skills.sh
```

Or manually set the secrets:
```bash
# Required: Enable the skills system
echo "true" | npx wrangler secret put SKILLS_ENABLED

# Optional: Enable demo mode (forces skill creation for demos)
echo "true" | npx wrangler secret put DEMO_MODE
```

### 2. Deploy

```bash
npm run deploy
```

### 3. Access the Dashboard

Visit: `https://your-worker.workers.dev/_skills`

## Testing the System

### Method 1: Use the Dashboard
1. Go to `/_skills`
2. Click "Test Skills System"
3. Review the results

### Method 2: API Endpoint
```bash
curl -X POST https://your-worker.workers.dev/api/skills/test \
  -H "Content-Type: application/json" \
  -d '{"message": "Compare NVDA and AMD revenue"}'
```

### Method 3: Send a Real Message
1. Go to the chat interface
2. Send a message like: "Compare NVDA and AMD revenue growth"
3. Wait ~10 seconds for reflection to complete
4. Check `/_skills` to see if a new skill was created

## Skill Categories

- **General**: Broadly applicable patterns (decomposing queries, stating assumptions)
- **Earnings**: Financial analysis patterns (fiscal year normalization)
- **Screening**: Stock screening and filtering patterns
- **Meta**: Skills about creating and managing skills

## Troubleshooting

### Skills Not Being Injected?

Check the dashboard status indicator:
- 🟢 **Skills System: Active** - Everything is working
- ⚠️ **Skills System: Not Configured** - Run `./setup-skills.sh`
- 🔴 **Skills System: Disabled** - Set `SKILLS_ENABLED=true`

### No New Skills Being Created?

This is normal! The system is conservative - it only creates new skills when:
1. The pattern is truly reusable
2. It's not already covered by existing skills
3. The pattern is clear and actionable

Most conversations won't produce new skills, and that's by design.

To force skill creation for demos, set `DEMO_MODE=true`.

### Skills Dashboard Shows Errors?

1. Click the "Test Skills System" button to diagnose
2. Check that SKILLS_ENABLED is set to "true"
3. Verify R2 bucket is accessible
4. Check browser console for detailed errors

## API Endpoints

### Skills Management
- `GET /api/skills/stats` - Get skill library statistics
- `GET /api/skills/:id` - Get a specific skill
- `DELETE /api/skills/:id` - Delete a skill
- `POST /api/skills/reset` - Reset to seed skills
- `POST /api/skills/initialize` - Initialize skills if not present

### Testing & Diagnostics
- `POST /api/skills/test` - Test the entire pipeline
- `GET /api/skills/diagnostics/env` - Check environment variables
- `POST /api/skills/diagnostics/enable` - Enable WebSocket message capture
- `GET /api/skills/diagnostics/messages` - View captured messages

## Architecture

```
User Message
    ↓
[Retrieval] → Find relevant skills from R2
    ↓
[Injection] → Augment message with skills
    ↓
[Chat] → Claude responds with context
    ↓
[Reflection] → Analyze conversation
    ↓
[Learning] → Create/update skills in R2
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SKILLS_ENABLED` | Yes | Set to `"true"` to enable the skills system |
| `DEMO_MODE` | No | Set to `"true"` to force skill creation for comparison queries |
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key (for reflection) |

## Files

- `src/skills/store.ts` - R2 storage and indexing
- `src/skills/retrieval.ts` - Find relevant skills
- `src/skills/injection.ts` - Augment messages
- `src/skills/reflection.ts` - Learn from conversations
- `src/pages/skills-dashboard.html` - Dashboard UI
- `src/routes/skills.ts` - API endpoints

## Best Practices

1. **Let it learn gradually** - Don't expect immediate skill creation
2. **Review the dashboard regularly** - See what patterns emerge
3. **Use descriptive messages** - Better messages → better skill learning
4. **Test after changes** - Use the test button to verify functionality
5. **Reset if needed** - It's okay to start fresh occasionally

## Advanced: Creating Custom Skills

You can create skills manually via the API:

```bash
curl -X POST https://your-worker.workers.dev/api/skills \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Custom Pattern",
    "category": "general",
    "principle": "The core lesson or pattern",
    "when_to_apply": "When this skill should be used"
  }'
```

---

**Questions?** Check the main [README.md](./README.md) or open an issue on GitHub.
