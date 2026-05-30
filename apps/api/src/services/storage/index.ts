import path from 'path';
import os from 'os';
import { StorageProvider } from './StorageProvider';
import { InMemoryStorageProvider } from './InMemoryStorageProvider';
import { FsStorageProvider } from './FsStorageProvider';
import { GcsStorageProvider } from './GcsStorageProvider';

export { StorageProvider } from './StorageProvider';
export { InMemoryStorageProvider } from './InMemoryStorageProvider';
export { FsStorageProvider } from './FsStorageProvider';
export { GcsStorageProvider } from './GcsStorageProvider';

/**
 * Select and construct the object-storage backend from the environment
 * (issue #8). Mirrors the `requireSecret` fail-fast philosophy: production
 * must never silently fall back to a non-durable store.
 *
 * Env:
 *   - RAKKYO_STORAGE_BACKEND = memory | fs | gcs
 *   - RAKKYO_STORAGE_DIR     = base dir for the `fs` backend
 *   - RAKKYO_GCS_BUCKET      = bucket name for the `gcs` backend
 *
 * Defaults:
 *   - test / dev with no backend set → in-memory
 *   - production with no backend set → fail-fast (process.exit(1))
 *   - production + backend=memory     → fail-fast (not durable)
 */
export function createStorageProvider(): StorageProvider {
  const backend = (process.env.RAKKYO_STORAGE_BACKEND || '').trim().toLowerCase();
  const isProd = process.env.NODE_ENV === 'production';

  const fail = (message: string): never => {
    // eslint-disable-next-line no-console
    console.error(`FATAL: ${message} Refusing to start.`);
    process.exit(1);
  };

  if (!backend) {
    if (isProd) {
      fail(
        'RAKKYO_STORAGE_BACKEND is not set in production (expected "gcs" or "fs").'
      );
    }
    // Non-production default: ephemeral in-memory store.
    return new InMemoryStorageProvider();
  }

  switch (backend) {
    case 'memory':
      if (isProd) {
        fail(
          'RAKKYO_STORAGE_BACKEND=memory is not durable and is forbidden in production.'
        );
      }
      return new InMemoryStorageProvider();

    case 'fs': {
      const dir =
        (process.env.RAKKYO_STORAGE_DIR || '').trim() ||
        // A tmp default is fine for dev; production must set an explicit
        // persistent volume path.
        (isProd ? '' : path.join(os.tmpdir(), 'rakkyo-avatars'));
      if (!dir) {
        fail('RAKKYO_STORAGE_BACKEND=fs requires RAKKYO_STORAGE_DIR in production.');
      }
      return new FsStorageProvider(dir);
    }

    case 'gcs': {
      const bucket = (process.env.RAKKYO_GCS_BUCKET || '').trim();
      if (!bucket) {
        fail('RAKKYO_STORAGE_BACKEND=gcs requires RAKKYO_GCS_BUCKET.');
      }
      return new GcsStorageProvider(bucket);
    }

    default:
      return fail(
        `Unknown RAKKYO_STORAGE_BACKEND "${backend}" (expected memory | fs | gcs).`
      );
  }
}
