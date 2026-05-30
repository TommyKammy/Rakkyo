/**
 * Lightweight client-side safety filter for offline abuse detection (D-7).
 * This is a keyword-based subset of the full SafetyFilter in @rakkyo/ai-tutor.
 * It runs entirely on the client without API calls.
 */

/** Blocked keyword patterns (case-insensitive) */
const BLOCKED_PATTERNS: RegExp[] = [
  // Japanese profanity / bullying
  /バカ|ばか|馬鹿/,
  /死ね|しね|氏ね/,
  /殺す|ころす/,
  /キモい|きもい/,
  /うざい|ウザい/,
  /消えろ|きえろ/,
  // Sexual content
  /エロ|えろ|セックス/,
  // Self-harm
  /自殺|じさつ/,
  // English profanity (basic)
  /fuck|shit|damn|ass|bitch/i,
];

/** Maximum allowed input length for safety-checked text. */
const MAX_SAFE_INPUT_LENGTH = 1000;

/**
 * Check if text contains abusive or inappropriate content.
 * Client-side lightweight version for offline use.
 * @param text - The text to check for abuse.
 * @returns true if the text is considered abusive.
 */
export function isAbusiveLite(text: string): boolean {
  if (text.length > MAX_SAFE_INPUT_LENGTH) {
    return true;
  }
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Sanitize text by replacing blocked patterns with asterisks.
 * @param text - The text to sanitize.
 * @returns The sanitized text with blocked words replaced.
 */
export function sanitizeLite(text: string): string {
  let sanitized = text;
  for (const pattern of BLOCKED_PATTERNS) {
    sanitized = sanitized.replace(new RegExp(pattern, 'gi'), (match) =>
      '＊'.repeat(match.length)
    );
  }
  return sanitized;
}
