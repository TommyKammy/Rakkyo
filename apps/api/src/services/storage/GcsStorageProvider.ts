import { StorageProvider } from './StorageProvider';

/**
 * Google Cloud Storage backend (issue #8) — the horizontal-scale-out target.
 *
 * `@google-cloud/storage` is an OPTIONAL dependency: it is loaded via a
 * dynamic import with a non-literal specifier so the API package compiles and
 * its tests run WITHOUT the SDK installed (the in-memory / filesystem
 * providers cover dev + CI). Production opts in by:
 *   1. `pnpm add @google-cloud/storage` in apps/api
 *   2. `RAKKYO_STORAGE_BACKEND=gcs`
 *   3. `RAKKYO_GCS_BUCKET=<bucket>` (+ standard GOOGLE_APPLICATION_CREDENTIALS)
 *
 * Clients read images via native v4 signed URLs (direct bucket access); the
 * app-served `/api/avatars/raw` endpoint is not used for this backend.
 *
 * IAM: the service account needs object read/write/delete on the bucket only;
 * signed URLs are the sole client read path. Recommended bucket lifecycle:
 * delete objects unreferenced > 60 days as a backstop to the 30-day cron.
 */
export class GcsStorageProvider implements StorageProvider {
  private readonly bucketName: string;
  // Lazily-initialised GCS Bucket handle (typed loosely — SDK is optional).
  private bucketPromise: Promise<any> | null = null;

  constructor(bucketName: string) {
    this.bucketName = bucketName;
  }

  private async bucket(): Promise<any> {
    if (!this.bucketPromise) {
      this.bucketPromise = (async () => {
        // Non-literal specifier keeps tsc from resolving the optional module
        // at build time; it is only required at runtime for the gcs backend.
        const moduleName = '@google-cloud/storage';
        let mod: any;
        try {
          mod = await import(moduleName);
        } catch (err) {
          throw new Error(
            "RAKKYO_STORAGE_BACKEND=gcs requires the '@google-cloud/storage' " +
              'package. Run `pnpm add @google-cloud/storage` in apps/api.'
          );
        }
        const Storage = mod.Storage ?? mod.default?.Storage;
        const storage = new Storage();
        return storage.bucket(this.bucketName);
      })();
    }
    return this.bucketPromise;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const bucket = await this.bucket();
    await bucket.file(key).save(body, {
      contentType,
      resumable: false,
      metadata: { contentType },
    });
  }

  async get(key: string): Promise<Buffer | null> {
    const bucket = await this.bucket();
    try {
      const [contents] = await bucket.file(key).download();
      return contents as Buffer;
    } catch (err: any) {
      if (err && err.code === 404) return null;
      throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    const bucket = await this.bucket();
    const [exists] = await bucket.file(key).exists();
    return Boolean(exists);
  }

  async delete(key: string): Promise<void> {
    const bucket = await this.bucket();
    try {
      await bucket.file(key).delete();
    } catch (err: any) {
      if (err && err.code === 404) return; // already gone
      throw err;
    }
  }

  async getSignedReadUrl(key: string, ttlSeconds: number): Promise<string | null> {
    const bucket = await this.bucket();
    const [url] = await bucket.file(key).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + ttlSeconds * 1000,
    });
    return url as string;
  }
}
