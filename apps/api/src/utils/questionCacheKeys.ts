import { allCurriculums } from '@rakkyo/curriculum';

/**
 * Client-facing question-identifier resolution for offline caches (P2).
 *
 * The web client identifies a question by `currentQuestion.id ||
 * currentQuestion.prompt`, where `currentQuestion` comes from the STATIC
 * curriculum. So the identifier it uses to read the offline hint / AI-diagnosis
 * caches is:
 *   - a stable curriculum id  (e.g. "japanese-g1-u1-l1-001"), when present, or
 *   - the prompt string       (e.g. math, which has no curriculum id).
 *
 * The DB, however, stores questions with generated UUID ids + the prompt text
 * (seed.ts), and synced attempts now persist the canonical UUID. So a cache
 * keyed only by the DB id/prompt would miss the curriculum-id lookups. These
 * helpers bridge that gap by emitting cache entries under EVERY identifier a
 * client might use.
 *
 * @module utils/questionCacheKeys
 */

/**
 * Find the static curriculum's client-facing id (`id || prompt`) for a prompt.
 * @returns the curriculum id/prompt, or null if no curriculum question matches
 */
function curriculumKeyForPrompt(prompt: string): string | null {
  for (const curriculum of allCurriculums) {
    for (const unit of curriculum.units) {
      for (const lesson of unit.lessons) {
        const q = lesson.questions.find((quest) => quest.prompt === prompt);
        if (q) return q.id || q.prompt;
      }
    }
  }
  return null;
}

/**
 * Compute every identifier a web client might use to look up cached data for a
 * question, given that question's DB/runtime shape.
 *
 * @param q - A question-like object with optional `id` and `prompt`
 * @returns De-duplicated list of client-facing cache keys
 */
export function clientFacingQuestionKeys(q: {
  id?: string | null;
  prompt?: string | null;
}): string[] {
  const keys = new Set<string>();
  if (q.prompt) {
    // Math (id-less static) reads by prompt.
    keys.add(q.prompt);
    // Japanese etc. read by the stable curriculum id mapped from the prompt.
    const curriculumKey = curriculumKeyForPrompt(q.prompt);
    if (curriculumKey) keys.add(curriculumKey);
  }
  // Dynamic / recommend-similar questions are identified by their own id.
  if (q.id) keys.add(q.id);
  return [...keys];
}
