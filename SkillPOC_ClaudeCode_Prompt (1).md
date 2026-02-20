# Claude Code Prompt: Self-Improving Skills POC

## Context

I have a Moltbot (OpenClaw) deployed on Cloudflare Workers with R2 persistent storage. Repository: https://github.com/marcoakes/moltworker

I want to build a lightweight proof of concept that demonstrates **recursive self-improving skills** for financial research tasks. The goal is to show that an AI agent can learn from its own experience, store what it learns as reusable skills, and get measurably better over time without any model retraining.

This POC needs to be simple enough to demo to a product team, and structured so it could later be expanded into a real product feature.

## What To Build

Build a skill learning layer on top of the existing Moltbot deployment with these components:

### 1. Skill Store (R2-backed)

Create a `/skills` namespace in R2 storage with this structure:

```
skills/
  general/           # Skills that apply to all tasks
  earnings/          # Earnings comparison skills
  screening/         # Screening/filtering skills  
  meta/              # Meta-skills (including self-improvement)
  _index.json        # Skill registry with metadata
```

Each skill is a JSON object:

```json
{
  "id": "skill-uuid",
  "name": "Fiscal Year Normalization",
  "category": "earnings",
  "principle": "When comparing financial metrics across companies, check fiscal year end dates first. Normalize to calendar quarters before extracting data. NVDA ends Jan, MSFT ends Jun, most others end Dec.",
  "when_to_apply": "Any task comparing metrics across two or more companies",
  "created_from": "task-uuid-that-generated-this",
  "created_at": "2026-02-19T10:00:00Z",
  "times_retrieved": 0,
  "times_helped": 0,
  "times_not_helped": 0,
  "version": 1,
  "status": "active"
}
```

The `_index.json` file maintains a lightweight registry for fast retrieval without scanning all files.

### 2. Seed Meta-Skill

Create a single seed skill stored at `skills/meta/self-improvement.json`:

```json
{
  "id": "meta-self-improvement",
  "name": "Self-Improvement",
  "category": "meta",
  "principle": "After completing any task, reflect on what happened. If the task succeeded, identify the pattern that made it work. If it failed or required retries, identify what went wrong and what should have been done. Formulate lessons as candidate skills. A good skill is: transferable (applies beyond this specific task), concise (a few sentences), actionable (gives clear guidance), and non-redundant (not already in the library). Store approved skills for future use.",
  "when_to_apply": "After every task completion, whether successful or not",
  "status": "active"
}
```

Also seed 3-4 starter general skills to show the hierarchical structure:

- "Verify Source Before Citing": Always check document dates and confirm data comes from primary filings, not secondary summaries.
- "Decompose Complex Queries": Break multi-part financial questions into sequential sub-tasks. Answer each before synthesizing.
- "State Assumptions Explicitly": When making comparisons, state the time period, currency, and whether figures are GAAP or non-GAAP.

### 3. Skill Retrieval Layer

Before the agent processes any user message, add a middleware step:

1. Take the user's message
2. Retrieve all general skills (always included)
3. Use simple keyword/semantic matching against the user message to find relevant category-specific skills (top 3-5)
4. Inject retrieved skills into the system prompt as a "Skills Context" section
5. Track which skills were retrieved for this task (for later evaluation)

Keep it simple for the POC: keyword matching on skill names, principles, and when_to_apply fields is fine. No need for a vector database yet. If the message mentions "compare", "vs", "versus", or multiple ticker symbols, pull from the earnings category. If it mentions "find", "screen", "filter", pull from screening.

Format the injected skills like this in the system prompt:

```
## Active Skills (learned from experience)

### General Skills
- **Verify Source Before Citing**: Always check document dates and confirm data comes from primary filings, not secondary summaries.
- **Decompose Complex Queries**: Break multi-part financial questions into sequential sub-tasks.

### Relevant Skills for This Task
- **Fiscal Year Normalization**: When comparing financial metrics across companies, check fiscal year end dates first. Normalize to calendar quarters before extracting data.
```

### 4. Post-Task Reflection Loop

After the agent delivers its response to the user, trigger a background reflection step. This is a second LLM call (not visible to the user) that:

1. Takes the full conversation (user query + agent response + any tool calls/retries)
2. Includes the self-improvement meta-skill as instructions
3. Includes the current skill library index (so it knows what already exists)
4. Asks the model to evaluate:
   - Did this task go well or poorly?
   - Were the retrieved skills helpful? (mark as helped/not_helped)
   - Is there a new lesson worth capturing as a skill?
   - Does any existing skill need refinement?

Use this prompt for the reflection call:

```
You are a skill learning system. Review the following task interaction and the skills that were available.

## Task Interaction
[insert full conversation]

## Skills Retrieved For This Task
[insert retrieved skills]

## Current Skill Library
[insert skill index]

## Instructions
Evaluate this interaction and respond with JSON:

{
  "task_outcome": "success" | "partial" | "failure",
  "skills_evaluation": [
    {"skill_id": "...", "was_helpful": true/false}
  ],
  "new_skill": null | {
    "name": "Short descriptive name",
    "category": "general" | "earnings" | "screening",
    "principle": "The lesson in 1-3 sentences",
    "when_to_apply": "When this skill is relevant"
  },
  "skill_refinement": null | {
    "skill_id": "...",
    "updated_principle": "Refined version of the principle"
  },
  "reasoning": "Brief explanation of your evaluation"
}

Only propose a new skill if it is: transferable, concise, actionable, and not already covered by existing skills. Most interactions will NOT produce a new skill. That is fine.
```

### 5. Skill Management API

Add simple API endpoints to the Cloudflare Worker:

- `GET /skills` - List all skills with metadata (for the demo dashboard)
- `GET /skills/:category` - List skills in a category
- `GET /skills/stats` - Return skill library stats (total count, retrieval rates, growth over time)
- `POST /skills/reset` - Reset to seed skills only (for demo resets)

### 6. Simple Dashboard

Create a minimal HTML page at `/_skills/` that shows:

- Total skill count (broken down by category)
- Most recently created skills
- Most frequently retrieved skills
- A timeline of skill creation (to show growth over time)
- A "reset" button to clear back to seed skills for re-demoing

This does NOT need to be fancy. A single HTML page with fetch calls to the skills API, rendered as simple tables and counters. No framework needed.

## Demo Flow

The demo should work like this:

1. Start with seed skills only (reset the library)
2. Ask: "Compare NVDA and AMD gross margins over the last 8 quarters"
3. Agent responds (using only general skills)
4. Background reflection runs and potentially creates a fiscal-year-related skill
5. Show the dashboard: a new skill appeared
6. Ask a similar question: "How do MSFT and AAPL R&D spending trends compare?"
7. Agent now has the fiscal year skill loaded automatically
8. Background reflection might create another skill (e.g., about normalizing R&D as % of revenue)
9. Show the dashboard: the library is growing
10. After 5-10 interactions, the library has accumulated domain-specific expertise that makes each subsequent task faster and more accurate

## Technical Notes

- Use the existing Moltbot/OpenClaw agent loop for the main conversation
- The reflection call should be async/background, not blocking the user response
- R2 is the persistence layer for skills (already available in the Moltbot setup)
- Keep the total injected skill context under 1500 tokens to leave room for the actual task
- Skills should survive container restarts (R2 handles this)
- The meta-skill (self-improvement) should always be included in reflection calls but NOT in user-facing task execution (to keep context clean)

## What NOT To Build

- No vector database (keyword matching is fine for POC)
- No user authentication on the skills dashboard (it's a demo)
- No multi-user skill isolation (single shared library for POC)
- No skill versioning history (just current version)
- No automated quality gate (trust the LLM's judgment for POC, add human review later)
- No complex UI (plain HTML/CSS, no React/Vue/etc)

## Success Criteria

The POC is successful if:

1. The skill library visibly grows through normal usage (not manually seeded)
2. Skills created from one interaction are retrieved and applied to a different, later interaction
3. An observer can see that the agent's responses improve over a sequence of related queries
4. The whole thing runs on the existing Moltbot infrastructure with no additional services

## File Structure

```
src/
  skills/
    store.ts          # R2 skill CRUD operations
    retrieval.ts      # Skill matching and context injection  
    reflection.ts     # Post-task reflection and skill generation
    types.ts          # TypeScript types for skills
    seeds.ts          # Seed skills data
  routes/
    skills-api.ts     # GET/POST endpoints for skill management
  pages/
    skills-dashboard.html  # Simple dashboard page
```

Integrate into the existing Moltbot worker entry point. The skill retrieval should hook into the message processing pipeline before the LLM call, and the reflection should hook in after the response is sent.
