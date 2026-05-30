import { promises as fs } from 'fs';
import path from 'path';
import { StorageProvider } from './StorageProvider';

/**
 * Filesystem-backed durable object store (issue #8).
 *
 * Objects survive process restarts, deploys, and crashes as long as the base
 * directory is a persistent volume — suitable for single-instance / mounted-
 * disk production. For horizontal scale-out across instances that don't share
 * a volume, use {@link GcsStorageProvider} instead.
 *
 * Reads are served through the app-served `/api/avatars/raw/:key` endpoint
 * (no native signed URL), with the same HMAC token validation as before.
 */
export class FsStorageProvider implements StorageProvider {
  private readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  /**
   * Resolve a storage key to an absolute path INSIDE baseDir, rejecting any
   * key that would escape it (path traversal defense — keys come from
   * `avatar_<uuid>.png` but we never trust input blindly).
   */
  private resolvePath(key: string): string {
    // Disallow separators / traversal in the key entirely; our keys are flat.
    if (key.includes('/') || key.includes('\\') || key.includes('..')) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    const resolved = path.resolve(this.baseDir, key);
    const baseResolved = path.resolve(this.baseDir);
    if (resolved !== path.join(baseResolved, key)) {
      throw new Error(`Storage key escapes base directory: ${key}`);
    }
    return resolved;
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  async put(key: string, body: Buffer, _contentType?: string): Promise<void> {
    await this.ensureDir();
    await fs.writeFile(this.resolvePath(key), body);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.resolvePath(key));
    } catch (err: any) {
      if (err && err.code === 'ENOENT') return null;
      throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolvePath(key));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolvePath(key));
    } catch (err: any) {
      if (err && err.code === 'ENOENT') return; // already gone
      throw err;
    }
  }

  async getSignedReadUrl(_key: string, _ttlSeconds: number): Promise<string | null> {
    // No native signing — caller uses the app-served HMAC URL.
    return null;
  }

  async clearAll(): Promise<void> {
    await fs.rm(this.baseDir, { recursive: true, force: true });
  }
}
