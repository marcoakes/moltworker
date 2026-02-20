import type { Skill, SkillIndex, SkillSummary, SkillStatsUpdate } from './types';
import { SEED_SKILLS } from './seeds';

// Use any for R2Bucket to avoid type conflicts
type R2Bucket = any;

const SKILLS_PREFIX = 'skills/';
const INDEX_KEY = `${SKILLS_PREFIX}_index.json`;

/**
 * Get the R2 key for a skill
 */
function getSkillKey(skill: Skill): string {
  return `${SKILLS_PREFIX}${skill.category}/skill-${skill.id}.json`;
}

/**
 * List all skills, optionally filtered by category
 */
export async function listSkills(bucket: R2Bucket, category?: string): Promise<Skill[]> {
  const prefix = category ? `${SKILLS_PREFIX}${category}/` : SKILLS_PREFIX;
  const listed = await bucket.list({ prefix });

  const skills: Skill[] = [];

  for (const object of listed.objects) {
    // Skip the index file
    if (object.key === INDEX_KEY) continue;

    const obj = await bucket.get(object.key);
    if (obj) {
      const skill = (await obj.json()) as Skill;
      skills.push(skill);
    }
  }

  return skills;
}

/**
 * Get a single skill by ID
 */
export async function getSkill(bucket: R2Bucket, skillId: string): Promise<Skill | null> {
  // We need to search across all categories since we don't know the category
  const allSkills = await listSkills(bucket);
  return allSkills.find((s) => s.id === skillId) || null;
}

/**
 * Save a skill to R2
 */
export async function saveSkill(bucket: R2Bucket, skill: Skill): Promise<void> {
  const key = getSkillKey(skill);
  await bucket.put(key, JSON.stringify(skill, null, 2));

  // Rebuild index after saving
  await rebuildIndex(bucket);
}

/**
 * Update skill statistics
 */
export async function updateSkillStats(
  bucket: R2Bucket,
  skillId: string,
  stats: SkillStatsUpdate,
): Promise<void> {
  const skill = await getSkill(bucket, skillId);
  if (!skill) {
    console.warn(`[Skills] Skill ${skillId} not found for stats update`);
    return;
  }

  // Update stats
  if (stats.times_retrieved !== undefined) {
    skill.times_retrieved = stats.times_retrieved;
  }
  if (stats.times_helped !== undefined) {
    skill.times_helped = stats.times_helped;
  }
  if (stats.times_not_helped !== undefined) {
    skill.times_not_helped = stats.times_not_helped;
  }

  // Save without rebuilding index (optimization)
  const key = getSkillKey(skill);
  await bucket.put(key, JSON.stringify(skill, null, 2));
}

/**
 * Increment skill retrieval count
 */
export async function incrementSkillRetrieval(bucket: R2Bucket, skillId: string): Promise<void> {
  const skill = await getSkill(bucket, skillId);
  if (!skill) return;

  skill.times_retrieved += 1;

  const key = getSkillKey(skill);
  await bucket.put(key, JSON.stringify(skill, null, 2));

  // Rebuild index to reflect updated stats
  await rebuildIndex(bucket);
}

/**
 * Delete a skill
 */
export async function deleteSkill(bucket: R2Bucket, skillId: string): Promise<void> {
  const skill = await getSkill(bucket, skillId);
  if (!skill) return;

  const key = getSkillKey(skill);
  await bucket.delete(key);

  // Rebuild index
  await rebuildIndex(bucket);
}

/**
 * Reset skills to seed state
 */
export async function resetToSeeds(bucket: R2Bucket): Promise<void> {
  // Delete all existing skills
  const listed = await bucket.list({ prefix: SKILLS_PREFIX });

  for (const object of listed.objects) {
    await bucket.delete(object.key);
  }

  // Save seed skills
  for (const skill of SEED_SKILLS) {
    const key = getSkillKey(skill);
    await bucket.put(key, JSON.stringify(skill, null, 2));
  }

  // Rebuild index
  await rebuildIndex(bucket);
}

/**
 * Get the skill index
 */
export async function getIndex(bucket: R2Bucket): Promise<SkillIndex | null> {
  const obj = await bucket.get(INDEX_KEY);
  if (!obj) return null;

  return (await obj.json()) as SkillIndex;
}

/**
 * Rebuild the skill index from all skills
 */
export async function rebuildIndex(bucket: R2Bucket): Promise<void> {
  const allSkills = await listSkills(bucket);

  // Category counts
  const categoryCount: Record<string, number> = {
    general: 0,
    earnings: 0,
    screening: 0,
    meta: 0,
  };

  for (const skill of allSkills) {
    categoryCount[skill.category] = (categoryCount[skill.category] || 0) + 1;
  }

  // Sort by created_at descending
  const sortedByDate = [...allSkills].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  // Sort by retrieval count descending
  const sortedByRetrieval = [...allSkills].sort((a, b) => b.times_retrieved - a.times_retrieved);

  // Build summaries
  const toSummary = (skill: Skill): SkillSummary => ({
    id: skill.id,
    name: skill.name,
    category: skill.category,
    created_at: skill.created_at,
    times_retrieved: skill.times_retrieved,
  });

  const index: SkillIndex = {
    totalCount: allSkills.length,
    categoryCount,
    recentlyCreated: sortedByDate.slice(0, 10).map(toSummary),
    mostRetrieved: sortedByRetrieval.slice(0, 10).map(toSummary),
    lastUpdated: new Date().toISOString(),
  };

  await bucket.put(INDEX_KEY, JSON.stringify(index, null, 2));
}

/**
 * Initialize skills if none exist
 */
export async function initializeSkills(bucket: R2Bucket): Promise<void> {
  const index = await getIndex(bucket);

  if (!index || index.totalCount === 0) {
    console.log('[Skills] No skills found, initializing with seeds...');
    await resetToSeeds(bucket);
  }
}
