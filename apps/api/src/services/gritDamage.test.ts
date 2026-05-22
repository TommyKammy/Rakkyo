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

  it('should apply grit bonus (hint multiplier) correctly for incorrect answers', () => {
    // floor(5 * 0.3 * (1 + 5 * 0.2)) = floor(1.5 * 2.0) = floor(3.0) = 3
    expect(calculateGritDamage(5, false, 5)).toBe(3);
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
