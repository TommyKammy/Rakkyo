import prisma from '../../db';

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
 *  - input is already a canonical id  → returns it unchanged
 *  - input is a prompt with a DB row  → returns the canonical UUID
 *  - input has no DB row (unseeded /  → returns the input unchanged
 *    pure in-memory dev)                (preserves prior behaviour)
 *  - DB lookup throws                 → returns the input unchanged (the
 *                                        caller's own create/query surfaces
 *                                        the DB error)
 *
 * @param idOrPrompt - The client-supplied questionId (canonical id or prompt)
 * @returns The canonical `Question.id`, or the input unchanged if unresolved
 */
export async function resolveCanonicalQuestionId(
  idOrPrompt: string
): Promise<string> {
  try {
    const q = await prisma.question.findFirst({
      where: { OR: [{ id: idOrPrompt }, { prompt: idOrPrompt }] },
      select: { id: true },
    });
    return q?.id ?? idOrPrompt;
  } catch {
    return idOrPrompt;
  }
}
