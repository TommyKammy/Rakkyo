/**
 * Pluggable object-storage backend for avatar images (issue #8).
 *
 * The route/service layer must never lose uploaded bytes on restart, deploy,
 * or scale-out. This interface abstracts the byte store so the in-memory map
 * (tests / dev), a filesystem volume (single-instance prod), or a cloud
 * bucket (GCS / S3 for horizontal scale-out) can be swapped via env without
 * touching calling code.
 *
 * @module services/storage/StorageProvider
 */
export interface StorageProvider {
  /** Persist `body` under `key`, overwriting any existing object. */
  put(key: string, body: Buffer, contentType: string): Promise<void>;

  /** Read the object bytes, or null if the key does not exist. */
  get(key: string): Promise<Buffer | null>;

  /** Whether an object exists for `key`. */
  exists(key: string): Promise<boolean>;

  /** Remove the object. A missing key is not an error. */
  delete(key: string): Promise<void>;

  /**
   * Produce a provider-native signed read URL for direct client access
   * (e.g. a GCS/S3 v4 signed URL), or `null` when the backend has no native
   * signing (in-memory / filesystem) — in which case the caller falls back to
   * the app-served, HMAC-signed `/api/avatars/raw/:key` endpoint.
   *
   * @param key - object key
   * @param ttlSeconds - signed URL validity window
   */
  getSignedReadUrl(key: string, ttlSeconds: number): Promise<string | null>;

  /**
   * Test-only: remove every stored object. Optional — only the in-memory and
   * filesystem providers implement it; cloud providers omit it.
   */
  clearAll?(): Promise<void> | void;
}
