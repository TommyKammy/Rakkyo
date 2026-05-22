/**
 * Centralised secret loader.
 *
 * In production, every named secret MUST be provided via the environment
 * AND must meet a minimum strength threshold (32 characters, roughly
 * aligned with NIST SP 800-63B recommendations for secret keys). If a
 * required secret is missing or too weak the process exits immediately
 * so the service never boots with a publicly-known fallback value or a
 * trivially-brute-forceable key.
 *
 * In non-production environments (development / test) a clearly-marked
 * dev fallback is accepted so local tooling and the test suite continue
 * to work without forcing every contributor to maintain a personal .env
 * file. Too-short env-provided values get a loud warning but do not
 * crash dev tooling.
 */
export const MIN_SECRET_LENGTH = 32;

export function requireSecret(envName: string, devFallback: string): string {
  const value = process.env[envName];
  const isProd = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

  if (value && value.length > 0) {
    if (value.length < MIN_SECRET_LENGTH) {
      if (isProd) {
        // eslint-disable-next-line no-console
        console.error(
          `FATAL: ${envName} is too short (${value.length} chars; need at least ${MIN_SECRET_LENGTH}). Refusing to start.`
        );
        process.exit(1);
      }
      if (!isTest) {
        // eslint-disable-next-line no-console
        console.warn(
          `⚠️  ${envName} is only ${value.length} chars long; production requires at least ${MIN_SECRET_LENGTH}. ` +
            `Generate a stronger value before deploying.`
        );
      }
    }
    return value;
  }

  if (isProd) {
    // eslint-disable-next-line no-console
    console.error(
      `FATAL: required secret "${envName}" is not set in production. Refusing to start.`
    );
    process.exit(1);
  }

  if (!isTest) {
    // eslint-disable-next-line no-console
    console.warn(
      `⚠️  ${envName} is not set; falling back to an INSECURE development value. ` +
        `Production refuses to start without this variable.`
    );
  }

  return devFallback;
}
