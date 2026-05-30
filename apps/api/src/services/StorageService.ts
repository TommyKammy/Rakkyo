import crypto from 'crypto';
import { requireSecret } from '../utils/secrets';
import { generateSignedToken, verifySignedToken, TokenPayload } from '../utils/signedToken';
import { StorageProvider, createStorageProvider } from './storage';

const STORAGE_HMAC_SECRET = requireSecret(
  'AVATAR_STORAGE_SECRET',
  'rakkyo-dev-storage-hmac-insecure-key-9988'
);

/** MIME type for stored avatar images. */
const AVATAR_CONTENT_TYPE = 'image/png';

export interface IStorageService {
  uploadAvatarImage(buffer: Buffer): Promise<string>;
  /** Store bytes under a caller-supplied key (used by tests / seeding). */
  putObject(objectKey: string, buffer: Buffer): Promise<void>;
  generateSignedUrl(objectKey: string, expiresSeconds: number): Promise<string>;
  deleteAvatarImage(objectKey: string): Promise<void>;
  hasObject(objectKey: string): Promise<boolean>;
  getObject(objectKey: string): Promise<Buffer | null>;
  verifySignedUrlToken(objectKey: string, token: string): boolean;
  clearAll(): void;
}

/**
 * Avatar image storage facade (issue #8).
 *
 * Delegates byte persistence to a pluggable {@link StorageProvider} chosen at
 * boot from the environment (in-memory for tests/dev, filesystem or GCS for
 * production), so uploaded images survive restarts / deploys / scale-out. The
 * HMAC-signed, app-served read URL is retained as the read path for providers
 * without native signing (in-memory / filesystem); the GCS provider returns a
 * native v4 signed URL for direct bucket reads.
 */
export class StorageService implements IStorageService {
  private static instance: StorageService;
  private readonly provider: StorageProvider;

  private constructor(provider?: StorageProvider) {
    this.provider = provider ?? createStorageProvider();
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public async uploadAvatarImage(buffer: Buffer): Promise<string> {
    const objectKey = `avatar_${crypto.randomUUID()}.png`;
    await this.provider.put(objectKey, buffer, AVATAR_CONTENT_TYPE);
    return objectKey;
  }

  public async putObject(objectKey: string, buffer: Buffer): Promise<void> {
    await this.provider.put(objectKey, buffer, AVATAR_CONTENT_TYPE);
  }

  public async generateSignedUrl(objectKey: string, expiresSeconds: number): Promise<string> {
    // Prefer a provider-native signed URL (e.g. GCS v4) for direct client
    // reads. Providers without native signing return null, in which case we
    // serve the bytes ourselves via the HMAC-signed /api/avatars/raw endpoint.
    const nativeUrl = await this.provider.getSignedReadUrl(objectKey, expiresSeconds);
    if (nativeUrl) {
      return nativeUrl;
    }

    const payload: TokenPayload = {
      objectKey,
      expiresAt: Date.now() + expiresSeconds * 1000,
    };
    const token = generateSignedToken(payload, STORAGE_HMAC_SECRET);
    return `/api/avatars/raw/${objectKey}?token=${token}`;
  }

  public async deleteAvatarImage(objectKey: string): Promise<void> {
    await this.provider.delete(objectKey);
  }

  public async hasObject(objectKey: string): Promise<boolean> {
    return this.provider.exists(objectKey);
  }

  public async getObject(objectKey: string): Promise<Buffer | null> {
    return this.provider.get(objectKey);
  }

  public verifySignedUrlToken(objectKey: string, token: string): boolean {
    const result = verifySignedToken<{ objectKey: string } & TokenPayload>(token, STORAGE_HMAC_SECRET);
    if (!result.ok) return false;
    return result.payload.objectKey === objectKey;
  }

  public clearAll(): void {
    // Test-only helper. Providers that support it implement clearAll();
    // a returned promise is intentionally not awaited (tests use the
    // synchronous in-memory provider).
    void this.provider.clearAll?.();
  }
}

export const storageService = StorageService.getInstance();
