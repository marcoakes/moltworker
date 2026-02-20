import type { Skill, SkillCategory, SkillRetrievalResult } from './types';
import { listSkills, incrementSkillRetrieval } from './store';
import { formatSkillContext } from './injection';

// Use any for R2Bucket to avoid type conflicts
type R2Bucket = any;

/**
 * Detect relevant categories from the user message
 */
export function detectCategory(message: string): SkillCategory[] {
  const lowerMessage = message.toLowerCase();
  const categories: SkillCategory[] = [];

  // Earnings category detection
  const earningsKeywords = ['compare', 'vs', 'versus', 'comparison'];
  const hasEarningsKeywords = earningsKeywords.some((kw) => lowerMessage.includes(kw));

  // Count ticker-like patterns (3-5 uppercase letters)
  const tickerPattern = /\b[A-Z]{2,5}\b/g;
  const tickers = message.match(tickerPattern) || [];
  const hasMultipleTickers = tickers.length >= 2;

  if (hasEarningsKeywords && hasMultipleTickers) {
    categories.push('earnings');
  }

  // Screening category detection
  const screeningKeywords = ['find', 'screen', 'filter', 'search for', 'identify'];
  const hasScreeningKeywords = screeningKeywords.some((kw) => lowerMessage.includes(kw));

  if (hasScreeningKeywords) {
    categories.push('screening');
  }

  return categories;
}

/**
 * Score skill relevance to a message (simple keyword matching)
 */
export function scoreSkillRelevance(skill: Skill, message: string): number {
  const lowerMessage = message.toLowerCase();
  let score = 0;

  // Check skill name
  const nameWords = skill.name.toLowerCase().split(' ');
  for (const word of nameWords) {
    if (word.length > 3 && lowerMessage.includes(word)) {
      score += 2;
    }
  }

  // Check principle
  const principleWords = skill.principle.toLowerCase().split(' ');
  for (const word of principleWords) {
    if (word.length > 4 && lowerMessage.includes(word)) {
      score += 1;
    }
  }

  // Check when_to_apply
  const whenWords = skill.when_to_apply.toLowerCase().split(' ');
  for (const word of whenWords) {
    if (word.length > 4 && lowerMessage.includes(word)) {
      score += 1.5;
    }
  }

  return score;
}

/**
 * Retrieve relevant skills for a message
 */
export async function retrieveSkillsForMessage(
  bucket: R2Bucket,
  message: string,
): Promise<SkillRetrievalResult> {
  // Always include general skills
  const generalSkills = await listSkills(bucket, 'general');

  // Detect relevant categories
  const detectedCategories = detectCategory(message);

  // Retrieve skills from detected categories
  const categorySkills: Skill[] = [];
  for (const category of detectedCategories) {
    const skills = await listSkills(bucket, category);
    categorySkills.push(...skills);
  }

  // Score and sort category skills
  const scoredSkills = categorySkills.map((skill) => ({
    skill,
    score: scoreSkillRelevance(skill, message),
  }));

  scoredSkills.sort((a, b) => b.score - a.score);

  // Take top 5 relevant skills
  const relevantSkills = scoredSkills.slice(0, 5).map((s) => s.skill);

  // Increment retrieval counts (fire and forget)
  const allRetrieved = [...generalSkills, ...relevantSkills];
  const skillIds = allRetrieved.map((s) => s.id);

  // Update retrieval counts in background
  Promise.all(skillIds.map((id) => incrementSkillRetrieval(bucket, id))).catch((err) => {
    console.error('[Skills] Failed to update retrieval counts:', err);
  });

  // Format the skill context
  const formatted = formatSkillContext(generalSkills, relevantSkills);

  return {
    general: generalSkills,
    relevant: relevantSkills,
    skillIds,
    formatted,
  };
}
