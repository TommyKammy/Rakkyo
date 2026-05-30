import { storageService } from './StorageService';

describe('StorageService', () => {
  beforeEach(() => {
    storageService.clearAll();
  });

  it('should successfully upload an avatar image and return an opaque key', async () => {
    const buffer = Buffer.from('fake-image-data-bytes');
    const key = await storageService.uploadAvatarImage(buffer);

    expect(key).toMatch(/^avatar_[a-f0-9-]+\.png$/);
    expect(await storageService.hasObject(key)).toBe(true);
    expect(await storageService.getObject(key)).toEqual(buffer);
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
    expect(await storageService.hasObject(key)).toBe(true);

    await storageService.deleteAvatarImage(key);
    expect(await storageService.hasObject(key)).toBe(false);
    expect(await storageService.getObject(key)).toBeNull();
  });

  it('should store bytes under a caller-supplied key via putObject', async () => {
    const key = 'avatar_seeded-key.png';
    const buffer = Buffer.from('seeded-bytes');
    await storageService.putObject(key, buffer);

    expect(await storageService.hasObject(key)).toBe(true);
    expect(await storageService.getObject(key)).toEqual(buffer);
  });
});
