/**
 * Calculate damage based on problem difficulty, correctness, and grit (hints used).
 * Formula: floor(difficulty * (isCorrect ? 1.5 : 0.3) * (1 + hintsUsed * 0.2))
 */
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

  const correctMultiplier = isCorrect ? 1.5 : 0.3;
  const gritMultiplier = 1 + hintsUsed * 0.2;
  return Math.floor(difficulty * correctMultiplier * gritMultiplier);
}
