/**
 * Calculate damage based on problem difficulty, correctness, and grit (hints used).
 * Formula: floor(difficulty * (isCorrect ? 1.5 : 0.3) * (1 + min(hintsUsed, MAX_HINTS_PER_QUESTION) * 0.2))
 *
 * `hintsUsed` is clamped server-side to MAX_HINTS_PER_QUESTION as a
 * defence-in-depth measure: even if a client bypasses the Zod schema
 * (e.g. crafted request), it cannot produce unbounded damage.
 */
export const MAX_HINTS_PER_QUESTION = 3;
export const MAX_DIFFICULTY = 10;

export function calculateGritDamage(
  difficulty: number,
  isCorrect: boolean,
  hintsUsed: number
): number {
  if (difficulty < 0) {
    throw new Error('Difficulty must be non-negative');
  }
  if (hintsUsed < 0) {
    throw new Error('Hints used must be non-negative');
  }

  const clampedDifficulty = Math.min(difficulty, MAX_DIFFICULTY);
  const clampedHints = Math.min(hintsUsed, MAX_HINTS_PER_QUESTION);

  const correctMultiplier = isCorrect ? 1.5 : 0.3;
  const gritMultiplier = 1 + clampedHints * 0.2;
  return Math.floor(clampedDifficulty * correctMultiplier * gritMultiplier);
}
