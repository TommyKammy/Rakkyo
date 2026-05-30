import prisma from '../../db';
import { allCurriculums } from '@rakkyo/curriculum';

/**
 * Find a static curriculum question's prompt by its id-or-prompt.
 * @returns the prompt string, or null if no curriculum question matches
 */
function findCurriculumPrompt(idOrPrompt: string): string | null {
  for (const curriculum of allCurriculums) {
    for (const unit of curriculum.units) {
      for (const lesson of unit.lessons) {
        const q = lesson.questions.find(
          (quest) => quest.id === idOrPrompt || quest.prompt === idOrPrompt
        );
        if (q?.prompt) return q.prompt;
      }
    }
  }
  return null;
}

/**
 * Resolve a client-supplied question identifier to the canonical
 * `Question.id` (P1, issue #15).
 *
 * The static curriculum (e.g. math) defines questions WITHOUT an `id`, so the
 * web client identifies a question by `question.id || question.prompt` — i.e.
 * the prompt string for those lessons. But `apps/api/prisma/seed.ts` creates
 * DB `Question` rows with generated UUID ids, and `Attempt.questionId` is a FK
 * to `Question.id`. Persisting a prompt would therefore violate the FK.
 *
 * Resolving to the canonical id at the Prisma write/query boundary keeps the
 * ONLINE (`createAttempt`) and OFFLINE (`createAttemptIdempotent`) paths
 * consistent — both persist the same canonical id, so `findAttemptsByQuestion`
 * and `recalculateUserStats` group a question's attempts together regardless
 * of which path created them (no split-brain).
 *
 * Behaviour:
 *  - input is already a canonical id   → returns it unchanged
 *  - input is a prompt with a DB row   → returns the canonical UUID
 *  - input is a STABLE curriculum id   → resolved via the curriculum's prompt
 *    (e.g. "japanese-g1-u1-l1-001")      to the DB UUID. seed.ts persists only
 *                                         the prompt (DB ids are generated), so
 *                                         the curriculum id never matches a DB
 *                                         row directly (P1).
 *  - input has no DB row (unseeded /   → returns the input unchanged
 *    pure in-memory dev)                 (preserves prior behaviour)
 *  - DB lookup throws                  → returns the input unchanged (the
 *                                         caller's own create/query surfaces
 *                                         the DB error)
 *
 * @param idOrPrompt - The client-supplied questionId (canonical id, stable
 *                     curriculum id, or prompt)
 * @returns The canonical `Question.id`, or the input unchanged if unresolved
 */
export async function resolveCanonicalQuestionId(
  idOrPrompt: string
): Promise<string> {
  try {
    // 1. Direct DB match by id or prompt.
    const direct = await prisma.question.findFirst({
      where: { OR: [{ id: idOrPrompt }, { prompt: idOrPrompt }] },
      select: { id: true },
    });
    if (direct) return direct.id;

    // 2. The input may be a stable curriculum id that seed.ts did NOT persist
    //    (only the prompt is stored, with a generated UUID id). Map the
    //    curriculum id → its prompt → the DB row's canonical UUID.
    const curriculumPrompt = findCurriculumPrompt(idOrPrompt);
    if (curriculumPrompt && curriculumPrompt !== idOrPrompt) {
      const byPrompt = await prisma.question.findFirst({
        where: { prompt: curriculumPrompt },
        select: { id: true },
      });
      if (byPrompt) return byPrompt.id;
    }

    // 3. Unresolved (unseeded / pure in-memory dev) — preserve the input.
    return idOrPrompt;
  } catch {
    return idOrPrompt;
  }
}
