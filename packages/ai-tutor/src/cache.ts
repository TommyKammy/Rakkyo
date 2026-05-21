export interface CacheEntry {
  hintText: string;
  stage: number;
  generatedAt: number;
}

export class AiResponseCache {
  private cache: Map<string, CacheEntry>;
  private ttlMs: number;

  constructor(ttlMs: number = 24 * 60 * 60 * 1000) { // Default TTL: 24 hours
    this.cache = new Map<string, CacheEntry>();
    this.ttlMs = ttlMs;
  }

  private buildKey(userId: string, questionId: string, stage: number): string {
    return `${userId}_${questionId}_${stage}`;
  }

  get(userId: string, questionId: string, stage: number): CacheEntry | null {
    const key = this.buildKey(userId, questionId, stage);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check expiration
    if (Date.now() - entry.generatedAt > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  set(userId: string, questionId: string, stage: number, hintText: string): void {
    const key = this.buildKey(userId, questionId, stage);
    this.cache.set(key, {
      hintText,
      stage,
      generatedAt: Date.now()
    });
  }

  delete(userId: string, questionId: string, stage: number): boolean {
    const key = this.buildKey(userId, questionId, stage);
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}
