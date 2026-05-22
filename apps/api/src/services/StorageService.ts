import crypto from 'crypto';
import { requireSecret } from '../utils/secrets';
import { generateSignedToken, verifySignedToken, TokenPayload } from '../utils/signedToken';

const STORAGE_HMAC_SECRET = requireSecret(
  'AVATAR_STORAGE_SECRET',
  'rakkyo-dev-storage-hmac-insecure-key-9988'
);

export interface IStorageService {
  uploadAvatarImage(buffer: Buffer): Promise<string>;
  generateSignedUrl(objectKey: string, expiresSeconds: number): Promise<string>;
  deleteAvatarImage(objectKey: string): Promise<void>;
  hasObject(objectKey: string): boolean;
  getObject(objectKey: string): Buffer | null;
  verifySignedUrlToken(objectKey: string, token: string): boolean;
  clearAll(): void;
}

export class StorageService implements IStorageService {
  private static instance: StorageService;
  private mockFiles = new Map<string, Buffer>();

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public async uploadAvatarImage(buffer: Buffer): Promise<string> {
    const objectKey = `avatar_${crypto.randomUUID()}.png`;
    this.mockFiles.set(objectKey, buffer);
    return objectKey;
  }

  public async generateSignedUrl(objectKey: string, expiresSeconds: number): Promise<string> {
    const payload: TokenPayload = {
      objectKey,
      expiresAt: Date.now() + expiresSeconds * 1000,
    };
    const token = generateSignedToken(payload, STORAGE_HMAC_SECRET);
    // Returns relative endpoint that can be requested from the server
    return `/api/avatars/raw/${objectKey}?token=${token}`;
  }

  public async deleteAvatarImage(objectKey: string): Promise<void> {
    this.mockFiles.delete(objectKey);
  }

  public hasObject(objectKey: string): boolean {
    return this.mockFiles.has(objectKey);
  }

  public getObject(objectKey: string): Buffer | null {
    return this.mockFiles.get(objectKey) || null;
  }

  public verifySignedUrlToken(objectKey: string, token: string): boolean {
    const result = verifySignedToken<{ objectKey: string } & TokenPayload>(token, STORAGE_HMAC_SECRET);
    if (!result.ok) return false;
    return result.payload.objectKey === objectKey;
  }

  public clearAll(): void {
    this.mockFiles.clear();
  }
}

export const storageService = StorageService.getInstance();
