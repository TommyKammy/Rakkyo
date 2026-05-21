import { AiResponseCache } from './cache';

describe('AiResponseCache', () => {
  const userId = 'user_123';
  const questionId = 'quest_abc';
  const stage = 1;
  const hintText = '符号を確認してみてね！';

  it('should store and retrieve cache entries correctly', () => {
    const cache = new AiResponseCache();
    cache.set(userId, questionId, stage, hintText);

    const entry = cache.get(userId, questionId, stage);
    expect(entry).not.toBeNull();
    expect(entry?.hintText).toBe(hintText);
    expect(entry?.stage).toBe(stage);
    expect(cache.size()).toBe(1);
  });

  it('should return null for non-existent entries', () => {
    const cache = new AiResponseCache();
    const entry = cache.get(userId, questionId, stage);
    expect(entry).toBeNull();
  });

  it('should expire entries based on TTL', async () => {
    // Set low TTL (50 milliseconds)
    const cache = new AiResponseCache(50);
    cache.set(userId, questionId, stage, hintText);

    // Immediate get should work
    expect(cache.get(userId, questionId, stage)).not.toBeNull();

    // Wait for TTL expiration (100ms)
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(cache.get(userId, questionId, stage)).toBeNull();
    expect(cache.size()).toBe(0); // evicted on get
  });

  it('should delete specified entry', () => {
    const cache = new AiResponseCache();
    cache.set(userId, questionId, stage, hintText);
    expect(cache.size()).toBe(1);

    const deleted = cache.delete(userId, questionId, stage);
    expect(deleted).toBe(true);
    expect(cache.get(userId, questionId, stage)).toBeNull();
    expect(cache.size()).toBe(0);
  });

  it('should clear all entries', () => {
    const cache = new AiResponseCache();
    cache.set(userId, questionId, 1, 'Hint 1');
    cache.set(userId, questionId, 2, 'Hint 2');
    expect(cache.size()).toBe(2);

    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get(userId, questionId, 1)).toBeNull();
  });
});
