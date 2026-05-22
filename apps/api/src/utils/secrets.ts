/**
 * Centralised secret loader.
 *
 * In production, every named secret MUST be provided via the environment.
 * If a required secret is missing the process exits immediately so that the
 * service never boots with a publicly-known fallback value.
 *
 * In non-production environments (development / test) a clearly-marked dev
 * fallback is accepted so local tooling and the test suite continue to work
 * without forcing every contributor to maintain a personal .env file.
 */
export function requireSecret(envName: string, devFallback: string): string {
  const value = process.env[envName];
  if (value && value.length > 0) {
    return value;
  }

  if (process.env.NODE_ENV === 'production') {
    // eslint-disable-next-line no-console
    console.error(
      `FATAL: required secret "${envName}" is not set in production. Refusing to start.`
    );
    process.exit(1);
  }

  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.warn(
      `⚠️  ${envName} is not set; falling back to an INSECURE development value. ` +
        `Production refuses to start without this variable.`
    );
  }

  return devFallback;
}
