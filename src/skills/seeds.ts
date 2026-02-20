import type { Skill } from './types';

/**
 * Seed skills that initialize the system
 */
export const SEED_SKILLS: Skill[] = [
  {
    id: 'meta-self-improvement',
    name: 'Self-Improvement',
    category: 'meta',
    principle:
      'After completing any task, reflect on what happened. If the task succeeded, identify the pattern that made it work. If it failed or required retries, identify what went wrong and what should have been done. Formulate lessons as candidate skills. A good skill is: transferable (applies beyond this specific task), concise (a few sentences), actionable (gives clear guidance), and non-redundant (not already in the library). Store approved skills for future use.',
    when_to_apply: 'After every task completion, whether successful or not',
    created_at: new Date().toISOString(),
    times_retrieved: 0,
    times_helped: 0,
    times_not_helped: 0,
    version: 1,
    status: 'active',
  },
  {
    id: 'general-verify-source',
    name: 'Verify Source Before Citing',
    category: 'general',
    principle:
      'Always check document dates and confirm data comes from primary filings, not secondary summaries.',
    when_to_apply: 'When citing financial data or research',
    created_at: new Date().toISOString(),
    times_retrieved: 0,
    times_helped: 0,
    times_not_helped: 0,
    version: 1,
    status: 'active',
  },
  {
    id: 'general-decompose-queries',
    name: 'Decompose Complex Queries',
    category: 'general',
    principle:
      'Break multi-part financial questions into sequential sub-tasks. Answer each before synthesizing.',
    when_to_apply: 'When facing multi-part questions',
    created_at: new Date().toISOString(),
    times_retrieved: 0,
    times_helped: 0,
    times_not_helped: 0,
    version: 1,
    status: 'active',
  },
  {
    id: 'general-state-assumptions',
    name: 'State Assumptions Explicitly',
    category: 'general',
    principle:
      'When making comparisons, state the time period, currency, and whether figures are GAAP or non-GAAP.',
    when_to_apply: 'When comparing financial metrics',
    created_at: new Date().toISOString(),
    times_retrieved: 0,
    times_helped: 0,
    times_not_helped: 0,
    version: 1,
    status: 'active',
  },
];
