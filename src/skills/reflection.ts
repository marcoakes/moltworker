import type { MoltbotEnv } from '../types';
import type { ReflectionResult, Skill, ConversationContext } from './types';
import { getIndex, saveSkill, updateSkillStats } from './store';

// Use any for R2Bucket to avoid type conflicts
type R2Bucket = any;

const CONVERSATIONS_PREFIX = 'conversations/';
const CONTEXT_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get conversation context key
 */
function getConversationKey(conversationId: string): string {
  return `${CONVERSATIONS_PREFIX}${conversationId}.json`;
}

/**
 * Store retrieved skills for a conversation (in R2)
 */
export async function storeRetrievedSkills(bucket: R2Bucket, conversationId: string, skillIds: string[]): Promise<void> {
  const context: ConversationContext = {
    conversationId,
    userMessage: '',
    retrievedSkillIds: skillIds,
    timestamp: new Date().toISOString(),
  };

  const key = getConversationKey(conversationId);
  await bucket.put(key, JSON.stringify(context));

  console.log(`[Skills] Stored context in R2: ${conversationId}, skills: ${skillIds.length}`);
}

/**
 * Get all conversation IDs (for debugging)
 */
export async function getAllConversationIds(bucket: R2Bucket): Promise<string[]> {
  const listed = await bucket.list({ prefix: CONVERSATIONS_PREFIX });
  return listed.objects.map(obj => obj.key.replace(CONVERSATIONS_PREFIX, '').replace('.json', ''));
}

/**
 * Find the most recent conversation context without a response
 */
export async function findPendingConversation(bucket: R2Bucket): Promise<string | null> {
  const listed = await bucket.list({ prefix: CONVERSATIONS_PREFIX });

  // Sort by most recent first
  const sorted = listed.objects.sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime());

  // Find first context that has a userMessage but no assistantResponse
  for (const obj of sorted) {
    const object = await bucket.get(obj.key);
    if (!object) continue;

    const data = await object.text();
    const context = JSON.parse(data) as ConversationContext;

    if (context.userMessage && !context.assistantResponse) {
      return context.conversationId;
    }
  }

  return null;
}

/**
 * Get conversation context from R2
 */
async function getConversationContext(bucket: R2Bucket, conversationId: string): Promise<ConversationContext | null> {
  const key = getConversationKey(conversationId);
  const object = await bucket.get(key);

  if (!object) return null;

  const data = await object.text();
  return JSON.parse(data) as ConversationContext;
}

/**
 * Get retrieved skills for a conversation
 */
export async function getRetrievedSkills(bucket: R2Bucket, conversationId: string): Promise<string[]> {
  const context = await getConversationContext(bucket, conversationId);
  return context?.retrievedSkillIds || [];
}

/**
 * Update conversation with user message
 */
export async function updateConversationMessage(bucket: R2Bucket, conversationId: string, userMessage: string): Promise<void> {
  const context = await getConversationContext(bucket, conversationId);
  if (context) {
    context.userMessage = userMessage;
    const key = getConversationKey(conversationId);
    await bucket.put(key, JSON.stringify(context));
  }
}

/**
 * Update conversation with assistant response
 */
export async function updateConversationResponse(
  bucket: R2Bucket,
  conversationId: string,
  assistantResponse: string,
): Promise<void> {
  const context = await getConversationContext(bucket, conversationId);
  if (context) {
    context.assistantResponse = assistantResponse;
    const key = getConversationKey(conversationId);
    await bucket.put(key, JSON.stringify(context));
  }
}

/**
 * Delete conversation context
 */
async function deleteConversationContext(bucket: R2Bucket, conversationId: string): Promise<void> {
  const key = getConversationKey(conversationId);
  await bucket.delete(key);
}

/**
 * Clean up old conversation contexts
 */
export async function cleanupOldContexts(bucket: R2Bucket): Promise<void> {
  const now = Date.now();
  const listed = await bucket.list({ prefix: CONVERSATIONS_PREFIX });

  for (const obj of listed.objects) {
    const age = now - obj.uploaded.getTime();
    if (age > CONTEXT_TTL_MS) {
      await bucket.delete(obj.key);
      console.log(`[Skills] Cleaned up old context: ${obj.key}`);
    }
  }
}

/**
 * Call Anthropic API for reflection
 */
async function callReflectionLLM(env: MoltbotEnv, prompt: string): Promise<ReflectionResult> {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

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
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${error}`);
  }

  const data = (await response.json()) as any;
  const content = data.content[0].text as string;

  // Parse JSON from response
  // Try to extract JSON if wrapped in markdown code blocks
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('[Skills] No JSON found in reflection response. Content:', content);
    throw new Error('No JSON found in reflection response');
  }

  const jsonText = jsonMatch[1] || jsonMatch[0];
  return JSON.parse(jsonText) as ReflectionResult;
}

/**
 * Process reflection result and update skills
 */
async function processReflectionResult(
  bucket: R2Bucket,
  result: ReflectionResult,
  conversationId: string,
): Promise<void> {
  // Update skill helpfulness stats
  for (const evaluation of result.skills_evaluation) {
    const stats = evaluation.was_helpful
      ? { times_helped: 1 }
      : { times_not_helped: 1 };

    await updateSkillStats(bucket, evaluation.skill_id, stats).catch((err) => {
      console.error(`[Skills] Failed to update stats for ${evaluation.skill_id}:`, err);
    });
  }

  // Create new skill if proposed
  if (result.new_skill) {
    const newSkill: Skill = {
      id: `skill-${crypto.randomUUID()}`,
      name: result.new_skill.name,
      category: result.new_skill.category,
      principle: result.new_skill.principle,
      when_to_apply: result.new_skill.when_to_apply,
      created_from: conversationId,
      created_at: new Date().toISOString(),
      times_retrieved: 0,
      times_helped: 0,
      times_not_helped: 0,
      version: 1,
      status: 'active',
    };

    await saveSkill(bucket, newSkill);
    console.log(`[Skills] Created new skill: ${newSkill.name} (${newSkill.id})`);
  }

  // Handle skill refinement
  if (result.skill_refinement) {
    // For POC, we'll log this but not implement versioning yet
    console.log(
      `[Skills] Skill refinement suggested for ${result.skill_refinement.skill_id}:`,
      result.skill_refinement.updated_principle,
    );
  }
}

/**
 * Build the reflection prompt
 */
function buildReflectionPrompt(
  context: ConversationContext,
  skillIndex: string,
  retrievedSkillsJson: string,
): string {
  return `You are a skill learning system. Review the following task interaction and the skills that were available.

## Task Interaction
User Message: ${context.userMessage || '(not captured)'}
Assistant Response: ${context.assistantResponse || '(not captured)'}

## Skills Retrieved For This Task
${retrievedSkillsJson}

## Current Skill Library
${skillIndex}

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

Only propose a new skill if it is: transferable (applies beyond this specific task), concise (a few sentences), actionable (gives clear guidance), and non-redundant (not already covered by existing skills). Most interactions will NOT produce a new skill. That is fine.`;
}

/**
 * Demo-mode deterministic fallback skill proposal.
 * Used only when DEMO_MODE=true and model returned no new skill.
 */
function maybeBuildDemoFallbackSkill(context: ConversationContext): ReflectionResult['new_skill'] {
  const message = context.userMessage || '';
  const normalized = message.toLowerCase();
  const isComparisonPrompt =
    normalized.includes('compare') ||
    normalized.includes(' vs ') ||
    normalized.includes(' versus ') ||
    normalized.includes('difference between');

  if (!isComparisonPrompt) {
    return null;
  }

  const timeTag = new Date().toISOString().slice(11, 19).replace(/:/g, '');
  return {
    name: `Demo Comparison Normalization ${timeTag}`,
    category: 'earnings',
    principle:
      'When comparing companies, align fiscal calendars, metric definitions, and reporting windows before drawing conclusions.',
    when_to_apply:
      'When a request compares two companies or asks for cross-company trend analysis.',
  };
}

/**
 * Trigger reflection for a conversation
 */
export async function triggerReflection(
  env: MoltbotEnv,
  bucket: R2Bucket,
  conversationId: string,
): Promise<void> {
  console.log(`[Skills] Triggering reflection for conversation ${conversationId}`);

  // Get conversation context from R2
  const context = await getConversationContext(bucket, conversationId);
  if (!context) {
    console.warn(`[Skills] No context found in R2 for conversation ${conversationId}`);
    return;
  }

  console.log(`[Skills] Found context with ${context.retrievedSkillIds.length} skills`);

  // Get skill index
  const index = await getIndex(bucket);
  if (!index) {
    console.warn('[Skills] No skill index found, skipping reflection');
    return;
  }

  // Format retrieved skills
  const retrievedSkillsJson = JSON.stringify(
    index.recentlyCreated.filter((s) => context.retrievedSkillIds.includes(s.id)),
    null,
    2,
  );

  // Build prompt
  const prompt = buildReflectionPrompt(context, JSON.stringify(index, null, 2), retrievedSkillsJson);

  try {
    // Call LLM
    const result = await callReflectionLLM(env, prompt);

    // Deterministic demo behavior: force skill creation for comparison prompts.
    if (env.DEMO_MODE === 'true' && !result.new_skill) {
      const fallbackSkill = maybeBuildDemoFallbackSkill(context);
      if (fallbackSkill) {
        result.new_skill = fallbackSkill;
        result.reasoning = `${result.reasoning || ''} | DEMO_MODE fallback: forced skill creation for comparison prompt.`.trim();
        console.log('[Skills] DEMO_MODE fallback applied: forcing new skill creation');
      }
    }

    console.log(`[Skills] Reflection result:`, result);

    // Process result
    await processReflectionResult(bucket, result, conversationId);

    // Clean up context from R2
    await deleteConversationContext(bucket, conversationId);
  } catch (error) {
    console.error('[Skills] Reflection failed:', error);
    throw error;
  }
}
