import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { createAccessMiddleware } from '../auth';
import { listSkills, getSkill, getIndex, resetToSeeds, initializeSkills } from '../skills/store';

/**
 * Skills API routes - all protected by Cloudflare Access
 */
export const skillsRoutes = new Hono<AppEnv>();

// Middleware: Verify Cloudflare Access JWT for all skills routes
skillsRoutes.use('*', createAccessMiddleware({ type: 'json' }));

/**
 * GET /api/skills - List all skills
 * Query params:
 *   - category: optional category filter (general|earnings|screening|meta)
 */
skillsRoutes.get('/', async (c) => {
  const bucket = c.env.MOLTBOT_BUCKET;
  const category = c.req.query('category');

  try {
    const skills = await listSkills(bucket, category);
    return c.json({
      skills,
      count: skills.length,
      category: category || 'all',
    });
  } catch (error) {
    console.error('[Skills API] Failed to list skills:', error);
    return c.json({ error: 'Failed to list skills' }, 500);
  }
});

/**
 * GET /api/skills/stats - Get skill library statistics
 */
skillsRoutes.get('/stats', async (c) => {
  const bucket = c.env.MOLTBOT_BUCKET;

  try {
    const index = await getIndex(bucket);

    if (!index) {
      return c.json({
        total: 0,
        byCategory: {},
        recentlyCreated: [],
        mostRetrieved: [],
        lastUpdated: null,
      });
    }

    return c.json({
      total: index.totalCount,
      byCategory: index.categoryCount,
      recentlyCreated: index.recentlyCreated,
      mostRetrieved: index.mostRetrieved,
      lastUpdated: index.lastUpdated,
    });
  } catch (error) {
    console.error('[Skills API] Failed to get stats:', error);
    return c.json({ error: 'Failed to get statistics' }, 500);
  }
});

/**
 * POST /api/skills/reset - Reset to seed skills
 */
skillsRoutes.post('/reset', async (c) => {
  const bucket = c.env.MOLTBOT_BUCKET;

  try {
    await resetToSeeds(bucket);
    return c.json({
      success: true,
      message: 'Skills reset to seed state',
    });
  } catch (error) {
    console.error('[Skills API] Failed to reset skills:', error);
    return c.json({ error: 'Failed to reset skills' }, 500);
  }
});

/**
 * POST /api/skills/initialize - Initialize skills if not present
 */
skillsRoutes.post('/initialize', async (c) => {
  const bucket = c.env.MOLTBOT_BUCKET;

  try {
    await initializeSkills(bucket);
    return c.json({
      success: true,
      message: 'Skills initialized',
    });
  } catch (error) {
    console.error('[Skills API] Failed to initialize skills:', error);
    return c.json({ error: 'Failed to initialize skills' }, 500);
  }
});

/**
 * GET /api/skills/diagnostics/env - Check environment variables
 */
skillsRoutes.get('/diagnostics/env', async (c) => {
  return c.json({
    SKILLS_ENABLED: c.env.SKILLS_ENABLED || 'NOT SET',
    ANTHROPIC_API_KEY: c.env.ANTHROPIC_API_KEY ? 'SET (hidden)' : 'NOT SET',
    DEBUG_ROUTES: c.env.DEBUG_ROUTES || 'NOT SET'
  });
});

/**
 * POST /api/skills/diagnostics/enable - Enable WebSocket message capture
 */
skillsRoutes.post('/diagnostics/enable', async (c) => {
  const { enableCapture } = await import('../skills/diagnostics');
  enableCapture();
  return c.json({
    success: true,
    message: 'Diagnostics capture enabled. Send messages in chat, then call /diagnostics/messages to see them.'
  });
});

/**
 * POST /api/skills/diagnostics/disable - Disable WebSocket message capture
 */
skillsRoutes.post('/diagnostics/disable', async (c) => {
  const { disableCapture } = await import('../skills/diagnostics');
  disableCapture();
  return c.json({
    success: true,
    message: 'Diagnostics capture disabled'
  });
});

/**
 * GET /api/skills/diagnostics/messages - Get captured WebSocket messages
 */
skillsRoutes.get('/diagnostics/messages', async (c) => {
  const { getCapturedMessages } = await import('../skills/diagnostics');
  const messages = getCapturedMessages();
  return c.json({
    messages,
    count: messages.length
  });
});

/**
 * POST /api/skills/diagnostics/clear - Clear captured messages
 */
skillsRoutes.post('/diagnostics/clear', async (c) => {
  const { clearCaptures } = await import('../skills/diagnostics');
  clearCaptures();
  return c.json({
    success: true,
    message: 'Captured messages cleared'
  });
});

/**
 * POST /api/skills/create-demo-skill - Manually create a demo skill (for demos when auto-reflection isn't working)
 */
skillsRoutes.post('/create-demo-skill', async (c) => {
  const bucket = c.env.MOLTBOT_BUCKET;

  try {
    const { saveSkill } = await import('../skills/store');

    const demoSkill = {
      id: `skill-${crypto.randomUUID()}`,
      name: 'Fiscal Year Normalization',
      category: 'earnings' as const,
      principle: 'When comparing financial metrics across companies, check fiscal year end dates first. Normalize to calendar quarters before extracting data. NVDA ends Jan, MSFT ends Jun, most others end Dec.',
      when_to_apply: 'Any task comparing metrics across two or more companies',
      created_from: 'demo-interaction',
      created_at: new Date().toISOString(),
      times_retrieved: 0,
      times_helped: 0,
      times_not_helped: 0,
      version: 1,
      status: 'active' as const
    };

    await saveSkill(bucket, demoSkill);

    return c.json({
      success: true,
      skill: demoSkill,
      message: 'Demo skill created successfully'
    });
  } catch (error) {
    console.error('[Skills API] Create demo skill failed:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /api/skills/test-retrieval - Test skill retrieval (for debugging)
 */
skillsRoutes.post('/test-retrieval', async (c) => {
  const bucket = c.env.MOLTBOT_BUCKET;

  try {
    const body = await c.req.json();
    const message = body.message || 'test message';

    // Import retrieval function
    const { retrieveSkillsForMessage } = await import('../skills/retrieval');

    const result = await retrieveSkillsForMessage(bucket, message);

    return c.json({
      message,
      general: result.general.map(s => s.name),
      relevant: result.relevant.map(s => s.name),
      skillIds: result.skillIds,
      totalRetrieved: result.skillIds.length,
      formattedLength: result.formatted.length
    });
  } catch (error) {
    console.error('[Skills API] Test retrieval failed:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /api/skills/test-injection - Test complete injection flow (for debugging)
 */
skillsRoutes.post('/test-injection', async (c) => {
  const bucket = c.env.MOLTBOT_BUCKET;

  try {
    const body = await c.req.json();
    const message = body.message || 'Compare NVDA and AMD revenue';

    // Import functions
    const { retrieveSkillsForMessage } = await import('../skills/retrieval');
    const { augmentMessage } = await import('../skills/injection');
    const { incrementSkillRetrieval } = await import('../skills/store');

    // Step 1: Retrieve skills
    const skillResult = await retrieveSkillsForMessage(bucket, message);

    // Step 2: Augment message
    const augmentedMessage = augmentMessage(message, skillResult.formatted);

    // Step 3: Increment retrieval stats
    for (const skillId of skillResult.skillIds) {
      await incrementSkillRetrieval(bucket, skillId);
    }

    return c.json({
      success: true,
      originalMessage: message,
      augmentedMessage: augmentedMessage.slice(0, 500) + '...',
      skillsRetrieved: skillResult.skillIds.length,
      skillNames: [...skillResult.general, ...skillResult.relevant].map(s => s.name)
    });
  } catch (error) {
    console.error('[Skills API] Test injection failed:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /api/skills/test-reflection - Test reflection manually (for debugging)
 */
skillsRoutes.post('/test-reflection', async (c) => {
  const bucket = c.env.MOLTBOT_BUCKET;

  try {
    const body = await c.req.json();
    const userMessage = body.userMessage || 'Compare NVDA and AMD gross margins';
    const assistantResponse = body.assistantResponse || 'NVDA gross margin is 75%, AMD is 50%';

    // Import reflection module to access internal function
    const reflectionModule = await import('../skills/reflection');
    const { storeRetrievedSkills, updateConversationMessage, updateConversationResponse, getRetrievedSkills } = reflectionModule;

    // Also import what we need from store
    const { getIndex, getSkill } = await import('../skills/store');

    // Simulate a conversation
    const conversationId = `test-${Date.now()}`;
    await storeRetrievedSkills(bucket, conversationId, ['general-decompose-queries', 'general-state-assumptions', 'general-verify-source']);
    await updateConversationMessage(bucket, conversationId, userMessage);
    await updateConversationResponse(bucket, conversationId, assistantResponse);

    // Get conversation context
    const retrievedSkillIds = await getRetrievedSkills(bucket, conversationId);
    const retrievedSkills = await Promise.all(
      retrievedSkillIds.map(id => getSkill(bucket, id))
    );

    // Build prompt directly (copy from reflection.ts)
    const index = await getIndex(bucket);
    const skillIndex = JSON.stringify(index, null, 2);
    const retrievedSkillsJson = JSON.stringify(retrievedSkills.filter(s => s !== null), null, 2);

    const prompt = `You are a skill learning system. Review the following task interaction and the skills that were available.

## Task Interaction
**User:** ${userMessage}
**Assistant:** ${assistantResponse}

## Skills Retrieved for This Task
${retrievedSkillsJson}

## Current Skill Library
${skillIndex}

Your task: Evaluate whether this interaction reveals a reusable pattern worth capturing as a new skill.

Respond with JSON:
{
  "task_outcome": "success" | "partial" | "failure",
  "skills_evaluation": [{"skill_id": "...", "was_helpful": true/false}],
  "new_skill": null | {
    "name": "...",
    "category": "general" | "earnings" | "screening",
    "principle": "...",
    "when_to_apply": "..."
  },
  "skill_refinement": null | {"skill_id": "...", "updated_principle": "..."},
  "reasoning": "..."
}`;

    // Call Anthropic API
    const apiKey = c.env.ANTHROPIC_API_KEY;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return c.json({ error: `Anthropic API error: ${response.status} ${error}` }, 500);
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Parse JSON
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : null;
    const parsed = jsonText ? JSON.parse(jsonText) : null;

    return c.json({
      success: true,
      rawResponse: content,
      parsedResult: parsed,
      newSkillProposed: parsed?.new_skill !== null
    });
  } catch (error) {
    console.error('[Skills API] Test reflection failed:', error);
    return c.json({ error: String(error), stack: error instanceof Error ? error.stack : undefined }, 500);
  }
});

/**
 * POST /api/skills/force-create-skill - Force create the fiscal year skill (for testing)
 */
skillsRoutes.post('/force-create-skill', async (c) => {
  const bucket = c.env.MOLTBOT_BUCKET;

  try {
    const { saveSkill } = await import('../skills/store');

    const newSkill = {
      id: `skill-${crypto.randomUUID()}`,
      name: 'Cross-Company Fiscal Year Normalization',
      category: 'earnings' as const,
      principle: 'When comparing financial metrics across companies, normalize to the same calendar quarters by adjusting for differences in fiscal year ends. NVDA ends Jan, MSFT ends Jun, most end Dec.',
      when_to_apply: 'When making cross-company financial comparisons involving different fiscal year calendars',
      created_from: 'manual-test',
      created_at: new Date().toISOString(),
      times_retrieved: 0,
      times_helped: 0,
      times_not_helped: 0,
      version: 1,
      status: 'active' as const
    };

    await saveSkill(bucket, newSkill);

    return c.json({
      success: true,
      skill: newSkill,
      message: 'Fiscal year normalization skill created successfully!'
    });
  } catch (error) {
    console.error('[Skills API] Force create skill failed:', error);
    return c.json({ error: String(error), stack: error instanceof Error ? error.stack : undefined }, 500);
  }
});

/**
 * POST /api/skills/test-context-storage - Test R2 conversation storage
 */
skillsRoutes.post('/test-context-storage', async (c) => {
  const bucket = c.env.MOLTBOT_BUCKET;

  try {
    const { storeRetrievedSkills, getRetrievedSkills, getAllConversationIds } = await import('../skills/reflection');

    const testConvId = `test-${Date.now()}`;
    const testSkills = ['general-decompose-queries', 'general-verify-source'];

    // Store
    await storeRetrievedSkills(bucket, testConvId, testSkills);

    // Retrieve
    const retrieved = await getRetrievedSkills(bucket, testConvId);

    // List all
    const allIds = await getAllConversationIds(bucket);

    return c.json({
      success: true,
      testConvId,
      storedSkills: testSkills.length,
      retrievedSkills: retrieved.length,
      match: retrieved.length === testSkills.length,
      allConversationIds: allIds,
      totalContexts: allIds.length
    });
  } catch (error) {
    return c.json({ error: String(error), stack: error instanceof Error ? error.stack : undefined }, 500);
  }
});

/**
 * DELETE /api/skills/:id - Delete a skill by ID
 */
skillsRoutes.delete('/:id', async (c) => {
  const bucket = c.env.MOLTBOT_BUCKET;
  const skillId = c.req.param('id');

  try {
    const { getSkill, rebuildIndex } = await import('../skills/store');

    // Get skill to determine key
    const skill = await getSkill(bucket, skillId);
    if (!skill) {
      return c.json({ error: 'Skill not found' }, 404);
    }

    // Delete from R2 (use proper key format)
    const key = `skills/${skill.category}/skill-${skill.id}.json`;
    await bucket.delete(key);

    // Rebuild index
    await rebuildIndex(bucket);

    return c.json({
      success: true,
      message: `Skill ${skill.name} deleted successfully`,
      deletedKey: key
    });
  } catch (error) {
    console.error(`[Skills API] Failed to delete skill ${skillId}:`, error);
    return c.json({ error: 'Failed to delete skill' }, 500);
  }
});

/**
 * GET /api/skills/debug/conversations - Show conversation contexts (for debugging)
 */
skillsRoutes.get('/debug/conversations', async (c) => {
  const bucket = c.env.MOLTBOT_BUCKET;

  try {
    const { getAllConversationIds } = await import('../skills/reflection');

    const allIds = await getAllConversationIds(bucket);

    // Get full context for each conversation
    const contexts = await Promise.all(
      allIds.map(async id => {
        const key = `conversations/${id}.json`;
        const obj = await bucket.get(key);
        if (!obj) return null;
        const data = await obj.text();
        const context = JSON.parse(data);
        return {
          conversationId: id,
          skillCount: context.retrievedSkillIds?.length || 0,
          hasUserMessage: !!context.userMessage,
          hasAssistantResponse: !!context.assistantResponse,
          userMessagePreview: context.userMessage?.slice(0, 50),
          assistantResponsePreview: context.assistantResponse?.slice(0, 50)
        };
      })
    );

    const validContexts = contexts.filter(c => c !== null);

    return c.json({
      totalContexts: validContexts.length,
      contexts: validContexts,
      message: validContexts.length === 0 ? 'No active conversation contexts found in R2' : `Found ${validContexts.length} active contexts in R2`
    });
  } catch (error) {
    return c.json({ error: String(error), stack: error instanceof Error ? error.stack : undefined }, 500);
  }
});

/**
 * GET /api/skills/:id - Get a single skill by ID
 */
skillsRoutes.get('/:id', async (c) => {
  const bucket = c.env.MOLTBOT_BUCKET;
  const skillId = c.req.param('id');

  try {
    const skill = await getSkill(bucket, skillId);

    if (!skill) {
      return c.json({ error: 'Skill not found' }, 404);
    }

    return c.json(skill);
  } catch (error) {
    console.error(`[Skills API] Failed to get skill ${skillId}:`, error);
    return c.json({ error: 'Failed to get skill' }, 500);
  }
});

/**
 * Skills dashboard handler (serves HTML page)
 */
export async function skillsDashboardHandler(c: any) {
  // Import the dashboard HTML
  const dashboardHtml = await import('../pages/skills-dashboard.html');
  return c.html(dashboardHtml.default);
}
