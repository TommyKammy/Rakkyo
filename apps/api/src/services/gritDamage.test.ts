import { calculateGritDamage } from './gritDamage';

describe('Grit Damage Calculator (P16A-002)', () => {
  it('should correctly calculate damage for normal correct answers with zero hints', () => {
    // floor(5 * 1.5 * 1.0) = floor(7.5) = 7
    expect(calculateGritDamage(5, true, 0)).toBe(7);
  });

  it('should correctly calculate damage for incorrect answers with zero hints', () => {
    // floor(5 * 0.3 * 1.0) = floor(1.5) = 1
    expect(calculateGritDamage(5, false, 0)).toBe(1);
  });

  it('should apply grit bonus (hint multiplier) correctly for correct answers', () => {
    // floor(5 * 1.5 * (1 + 3 * 0.2)) = floor(7.5 * 1.6) = floor(12.0) = 12
    expect(calculateGritDamage(5, true, 3)).toBe(12);
  });

  it('should apply grit bonus (hint multiplier) correctly for incorrect answers (hintsUsed clamped to MAX=3)', () => {
    // hintsUsed=5 is clamped to MAX_HINTS_PER_QUESTION=3.
    // floor(5 * 0.3 * (1 + 3 * 0.2)) = floor(1.5 * 1.6) = floor(2.4) = 2
    expect(calculateGritDamage(5, false, 5)).toBe(2);
  });

  it('should clamp astronomically large hintsUsed values to MAX (Phase 16-A CRIT-1)', () => {
    // Before clamp: floor(5 * 1.5 * (1 + 999999 * 0.2)) = ~1.5M damage (one-shot defeat).
    // After clamp: floor(5 * 1.5 * (1 + 3 * 0.2)) = floor(12.0) = 12.
    expect(calculateGritDamage(5, true, 999999)).toBe(12);
    expect(calculateGritDamage(5, true, Number.MAX_SAFE_INTEGER)).toBe(12);
  });

  it('should clamp astronomically large difficulty to MAX_DIFFICULTY', () => {
    // Even if a malicious question pool injects difficulty=10000, the
    // damage is bounded by MAX_DIFFICULTY=10.
    // floor(10 * 1.5 * 1.0) = 15
    expect(calculateGritDamage(10000, true, 0)).toBe(15);
  });

  it('should handle boundary difficulty value of 0', () => {
    expect(calculateGritDamage(0, true, 5)).toBe(0);
    expect(calculateGritDamage(0, false, 0)).toBe(0);
  });

  it('should throw error for invalid negative difficulty or negative hintsUsed', () => {
    expect(() => calculateGritDamage(-1, true, 0)).toThrow('Difficulty must be non-negative');
    expect(() => calculateGritDamage(5, true, -1)).toThrow('Hints used must be non-negative');
  });
});
