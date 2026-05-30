import { StorageProvider } from './StorageProvider';

/**
 * In-memory object store (issue #8).
 *
 * The default backend for tests and local dev. NOT durable — every object is
 * lost on process restart — so the factory refuses to select it in production.
 * Has no native signed URLs, so the service falls back to the app-served
 * `/api/avatars/raw/:key` endpoint for reads.
 */
export class InMemoryStorageProvider implements StorageProvider {
  private store = new Map<string, Buffer>();

  async put(key: string, body: Buffer, _contentType?: string): Promise<void> {
    // Copy so later mutation of the caller's buffer can't corrupt the store.
    this.store.set(key, Buffer.from(body));
  }

  async get(key: string): Promise<Buffer | null> {
    const buf = this.store.get(key);
    return buf ? Buffer.from(buf) : null;
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async getSignedReadUrl(_key: string, _ttlSeconds: number): Promise<string | null> {
    // No native signing — caller uses the app-served HMAC URL.
    return null;
  }

  clearAll(): void {
    this.store.clear();
  }
}
