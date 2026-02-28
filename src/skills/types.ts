/**
 * TypeScript type definitions for the self-improving skills system
 */

export type SkillCategory = 'general' | 'earnings' | 'screening' | 'meta';
export type SkillStatus = 'active' | 'archived';
export type TaskOutcome = 'success' | 'partial' | 'failure';

/**
 * A skill represents a learned pattern or principle that can be applied to future tasks
 */
export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  principle: string;
  when_to_apply: string;
  created_from?: string; // task UUID that generated this skill
  created_at: string; // ISO timestamp
  times_retrieved: number;
  times_helped: number;
  times_not_helped: number;
  version: number;
  status: SkillStatus;
}

/**
 * Summary of a skill for index listings
 */
export interface SkillSummary {
  id: string;
  name: string;
  category: SkillCategory;
  created_at: string;
  times_retrieved: number;
}

/**
 * Index structure for fast skill lookups
 */
export interface SkillIndex {
  totalCount: number;
  categoryCount: Record<string, number>;
  recentlyCreated: SkillSummary[];
  mostRetrieved: SkillSummary[];
  lastUpdated: string;
}

/**
 * Result from the reflection LLM call
 */
export interface ReflectionResult {
  task_outcome: TaskOutcome;
  skills_evaluation: Array<{
    skill_id: string;
    was_helpful: boolean;
  }>;
  new_skill: {
    name: string;
    category: Exclude<SkillCategory, 'meta'>; // Can't create meta skills from reflection
    principle: string;
    when_to_apply: string;
  } | null;
  skill_refinement: {
    skill_id: string;
    updated_principle: string;
  } | null;
  reasoning: string;
}

/**
 * Conversation context for tracking skills used in a conversation
 */
export interface ConversationContext {
  conversationId: string;
  userMessage: string;
  assistantResponse?: string;
  retrievedSkillIds: string[];
  timestamp: string;
}

/**
 * Statistics for skill updates
 */
export interface SkillStatsUpdate {
  times_retrieved?: number;
  times_helped?: number;
  times_not_helped?: number;
}

/**
 * Result of skill retrieval
 */
export interface SkillRetrievalResult {
  general: Skill[];
  meta: Skill[];
  relevant: Skill[];
  skillIds: string[];
  formatted: string;
}
