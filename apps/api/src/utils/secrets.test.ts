import { requireSecret, MIN_SECRET_LENGTH } from './secrets';

describe('requireSecret', () => {
  const originalEnv = process.env.NODE_ENV;
  let exitSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    // Stub process.exit so tests can assert without actually terminating Jest.
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(((_code?: number) => {
      throw new Error('__process_exit_called__');
    }) as never);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
    delete process.env.__TEST_SECRET__;
  });

  it('returns the env value when it meets the minimum length', () => {
    process.env.NODE_ENV = 'production';
    process.env.__TEST_SECRET__ = 'a'.repeat(MIN_SECRET_LENGTH);
    expect(requireSecret('__TEST_SECRET__', 'dev-fallback-' + 'x'.repeat(40))).toBe('a'.repeat(MIN_SECRET_LENGTH));
  });

  it('process.exit(1) in production when secret is missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.__TEST_SECRET__;
    expect(() => requireSecret('__TEST_SECRET__', 'dev-fallback-' + 'x'.repeat(40))).toThrow(
      '__process_exit_called__'
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('not set in production'));
  });

  it('process.exit(1) in production when secret is shorter than the minimum', () => {
    process.env.NODE_ENV = 'production';
    process.env.__TEST_SECRET__ = 'tooshort';
    expect(() => requireSecret('__TEST_SECRET__', 'dev-fallback-' + 'x'.repeat(40))).toThrow(
      '__process_exit_called__'
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('too short'));
  });

  it('returns dev fallback in development when secret is missing, with a loud warning', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.__TEST_SECRET__;
    const fallback = 'dev-fallback-' + 'x'.repeat(40);
    const result = requireSecret('__TEST_SECRET__', fallback);
    expect(result).toBe(fallback);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('INSECURE'));
  });

  it('returns the short env value in development but warns about strength', () => {
    process.env.NODE_ENV = 'development';
    process.env.__TEST_SECRET__ = 'short';
    const result = requireSecret('__TEST_SECRET__', 'dev-fallback-' + 'x'.repeat(40));
    expect(result).toBe('short');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('5 chars'));
  });

  it('is quiet in test mode (no warnings) when secret is missing', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.__TEST_SECRET__;
    const fallback = 'dev-fallback-' + 'x'.repeat(40);
    const result = requireSecret('__TEST_SECRET__', fallback);
    expect(result).toBe(fallback);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
