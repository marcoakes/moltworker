import type { Skill } from './types';

const MAX_TOKEN_BUDGET = 1500;
const CHARS_PER_TOKEN = 4; // Rough estimate
const MAX_CHARS = MAX_TOKEN_BUDGET * CHARS_PER_TOKEN;

/**
 * Estimate token count from text (rough approximation)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Format a single skill for display
 */
function formatSkill(skill: Skill): string {
  return `- **${skill.name}**: ${skill.principle}`;
}

/**
 * Format skill context for injection into message
 */
export function formatSkillContext(general: Skill[], relevant: Skill[]): string {
  if (general.length === 0 && relevant.length === 0) {
    return '';
  }

  const sections: string[] = [];

  // General skills section
  if (general.length > 0) {
    sections.push('### General Skills');
    sections.push(...general.map(formatSkill));
    sections.push('');
  }

  // Relevant skills section
  if (relevant.length > 0) {
    sections.push('### Relevant Skills for This Task');
    sections.push(...relevant.map(formatSkill));
    sections.push('');
  }

  let formatted = sections.join('\n');

  // Check token budget and truncate if needed
  if (formatted.length > MAX_CHARS) {
    console.warn(
      `[Skills] Context exceeds budget (${formatted.length} chars > ${MAX_CHARS}), truncating...`,
    );

    // Prioritize general skills, then as many relevant as fit
    const generalSection = general.length > 0 ? `### General Skills\n${general.map(formatSkill).join('\n')}\n` : '';

    let result = generalSection;
    const availableChars = MAX_CHARS - generalSection.length - 100; // Reserve for header

    if (relevant.length > 0 && availableChars > 0) {
      result += '\n### Relevant Skills for This Task\n';
      for (const skill of relevant) {
        const skillText = formatSkill(skill) + '\n';
        if (result.length + skillText.length > MAX_CHARS) {
          result += '... (more skills available)\n';
          break;
        }
        result += skillText;
      }
    }

    formatted = result;
  }

  // Wrap in header
  const header = '---\n## Active Skills (learned from experience)\n\n';
  const footer = '---\n';

  return header + formatted + footer;
}

/**
 * Augment a user message with skill context
 */
export function augmentMessage(originalMessage: string, skillContext: string): string {
  if (!skillContext) {
    return originalMessage;
  }

  // Append skills after the original message
  return `${originalMessage}\n\n${skillContext}`;
}
