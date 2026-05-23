import { storageService } from './StorageService';

describe('StorageService', () => {
  beforeEach(() => {
    storageService.clearAll();
  });

  it('should successfully upload an avatar image and return an opaque key', async () => {
    const buffer = Buffer.from('fake-image-data-bytes');
    const key = await storageService.uploadAvatarImage(buffer);
    
    expect(key).toMatch(/^avatar_[a-f0-9-]+\.png$/);
    expect(storageService.hasObject(key)).toBe(true);
    expect(storageService.getObject(key)).toEqual(buffer);
  });

  it('should generate a valid signed URL', async () => {
    const buffer = Buffer.from('dummy-image');
    const key = await storageService.uploadAvatarImage(buffer);
    const signedUrl = await storageService.generateSignedUrl(key, 5); // 5 seconds expiry
    
    expect(signedUrl).toContain(`/api/avatars/raw/${key}?token=`);
    const token = signedUrl.split('token=')[1];
    
    expect(storageService.verifySignedUrlToken(key, token)).toBe(true);
  });

  it('should fail validation if the token is tampered with', async () => {
    const buffer = Buffer.from('dummy-image');
    const key = await storageService.uploadAvatarImage(buffer);
    const signedUrl = await storageService.generateSignedUrl(key, 5);
    const token = signedUrl.split('token=')[1];
    
    const tamperedToken = token.slice(0, -5) + 'xxxxx';
    expect(storageService.verifySignedUrlToken(key, tamperedToken)).toBe(false);
  });

  it('should successfully delete an image physically', async () => {
    const buffer = Buffer.from('to-be-deleted');
    const key = await storageService.uploadAvatarImage(buffer);
    expect(storageService.hasObject(key)).toBe(true);

    await storageService.deleteAvatarImage(key);
    expect(storageService.hasObject(key)).toBe(false);
    expect(storageService.getObject(key)).toBeNull();
  });
});
