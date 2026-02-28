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
    DEMO_MODE: c.env.DEMO_MODE || 'NOT SET',
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
 * POST /api/skills/test - Test the entire skills pipeline
 * Verifies retrieval, injection, and basic functionality work correctly
 */
skillsRoutes.post('/test', async (c) => {
  const bucket = c.env.MOLTBOT_BUCKET;

  try {
    const body = await c.req.json().catch(() => ({}));
    const testMessage = body.message || 'Compare NVDA and AMD revenue growth';

    // Import functions
    const { retrieveSkillsForMessage } = await import('../skills/retrieval');
    const { augmentMessage } = await import('../skills/injection');

    // Test retrieval
    const skillResult = await retrieveSkillsForMessage(bucket, testMessage);

    // Test injection
    const augmented = augmentMessage(testMessage, skillResult.formatted);

    // Check if skills are enabled
    const skillsEnabled = c.env.SKILLS_ENABLED === 'true';

    return c.json({
      success: true,
      skillsEnabled,
      test: {
        message: testMessage,
        skillsRetrieved: skillResult.skillIds.length,
        skillNames: [...skillResult.general, ...skillResult.relevant].map(s => s.name),
        messageAugmented: augmented.length > testMessage.length,
        augmentedPreview: augmented.slice(0, 200) + (augmented.length > 200 ? '...' : '')
      },
      recommendation: skillsEnabled
        ? 'Skills system is working correctly!'
        : 'Set SKILLS_ENABLED=true to enable the skills system in production.'
    });
  } catch (error) {
    console.error('[Skills API] Test failed:', error);
    return c.json({
      success: false,
      error: String(error),
      message: 'Skills system test failed. Check logs for details.'
    }, 500);
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
