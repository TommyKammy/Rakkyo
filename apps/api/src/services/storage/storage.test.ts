import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { InMemoryStorageProvider } from './InMemoryStorageProvider';
import { FsStorageProvider } from './FsStorageProvider';
import { GcsStorageProvider } from './GcsStorageProvider';
import { createStorageProvider } from './index';

describe('InMemoryStorageProvider', () => {
  it('put/get/exists/delete round-trip', async () => {
    const p = new InMemoryStorageProvider();
    const buf = Buffer.from('hello');
    expect(await p.exists('k')).toBe(false);
    await p.put('k', buf, 'image/png');
    expect(await p.exists('k')).toBe(true);
    expect(await p.get('k')).toEqual(buf);
    await p.delete('k');
    expect(await p.exists('k')).toBe(false);
    expect(await p.get('k')).toBeNull();
  });

  it('returns a defensive copy (caller mutation does not corrupt the store)', async () => {
    const p = new InMemoryStorageProvider();
    const buf = Buffer.from([1, 2, 3]);
    await p.put('k', buf, 'image/png');
    buf[0] = 99;
    const got = await p.get('k');
    expect(got?.[0]).toBe(1);
  });

  it('has no native signed URL', async () => {
    const p = new InMemoryStorageProvider();
    expect(await p.getSignedReadUrl('k', 300)).toBeNull();
  });
});

describe('FsStorageProvider', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rakkyo-fs-test-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('persists bytes to disk and survives a new provider instance (durability)', async () => {
    const writer = new FsStorageProvider(dir);
    const buf = Buffer.from('durable-bytes');
    await writer.put('avatar_x.png', buf, 'image/png');

    // A brand-new provider (simulating a process restart) reads the same bytes.
    const reader = new FsStorageProvider(dir);
    expect(await reader.exists('avatar_x.png')).toBe(true);
    expect(await reader.get('avatar_x.png')).toEqual(buf);
  });

  it('returns null for missing keys and treats double-delete as a no-op', async () => {
    const p = new FsStorageProvider(dir);
    expect(await p.get('nope.png')).toBeNull();
    expect(await p.exists('nope.png')).toBe(false);
    await expect(p.delete('nope.png')).resolves.toBeUndefined();
  });

  it('rejects path-traversal keys', async () => {
    const p = new FsStorageProvider(dir);
    await expect(p.put('../escape.png', Buffer.from('x'), 'image/png')).rejects.toThrow();
    await expect(p.get('a/b.png')).rejects.toThrow();
  });

  it('has no native signed URL (served via app endpoint)', async () => {
    const p = new FsStorageProvider(dir);
    expect(await p.getSignedReadUrl('k', 300)).toBeNull();
  });
});

describe('createStorageProvider (env selection + fail-fast)', () => {
  const ORIGINAL_ENV = { ...process.env };
  let exitSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    delete process.env.RAKKYO_STORAGE_BACKEND;
    delete process.env.RAKKYO_STORAGE_DIR;
    delete process.env.RAKKYO_GCS_BUCKET;
    // Make a fail-fast call observable instead of killing the test runner.
    exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => {
        throw new Error(`process.exit:${code}`);
      }) as never);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    errorSpy.mockRestore();
    process.env = { ...ORIGINAL_ENV };
  });

  it('defaults to in-memory in non-production when no backend is set', () => {
    process.env.NODE_ENV = 'test';
    expect(createStorageProvider()).toBeInstanceOf(InMemoryStorageProvider);
  });

  it('selects the fs backend', () => {
    process.env.NODE_ENV = 'test';
    process.env.RAKKYO_STORAGE_BACKEND = 'fs';
    process.env.RAKKYO_STORAGE_DIR = '/tmp/rakkyo-test-dir';
    expect(createStorageProvider()).toBeInstanceOf(FsStorageProvider);
  });

  it('selects the gcs backend when a bucket is configured', () => {
    process.env.NODE_ENV = 'test';
    process.env.RAKKYO_STORAGE_BACKEND = 'gcs';
    process.env.RAKKYO_GCS_BUCKET = 'rakkyo-avatars';
    expect(createStorageProvider()).toBeInstanceOf(GcsStorageProvider);
  });

  it('fails fast in production when no backend is set', () => {
    process.env.NODE_ENV = 'production';
    expect(() => createStorageProvider()).toThrow(/process\.exit/);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('fails fast in production when backend=memory (not durable)', () => {
    process.env.NODE_ENV = 'production';
    process.env.RAKKYO_STORAGE_BACKEND = 'memory';
    expect(() => createStorageProvider()).toThrow(/process\.exit/);
  });

  it('fails fast when gcs backend is missing its bucket', () => {
    process.env.NODE_ENV = 'test';
    process.env.RAKKYO_STORAGE_BACKEND = 'gcs';
    expect(() => createStorageProvider()).toThrow(/process\.exit/);
  });

  it('fails fast on an unknown backend', () => {
    process.env.NODE_ENV = 'test';
    process.env.RAKKYO_STORAGE_BACKEND = 'ftp';
    expect(() => createStorageProvider()).toThrow(/process\.exit/);
  });
});
