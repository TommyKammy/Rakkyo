import { z } from 'zod';

/** Schema for a single offline Attempt to be synced */
export const SyncAttemptSchema = z.object({
  clientEventId: z.string().uuid(),
  userId: z.string(),
  questionId: z.string(),
  isCorrect: z.boolean(),
  hintsUsed: z.number().int().min(0).max(10),
  answerSubmitted: z.string().max(1000),
  durationSeconds: z.number().int().min(0).max(7200).nullable().optional(),
  errorType: z.string().max(100).nullable().optional(),
  createdAt: z.string().datetime(),
});

export type SyncAttempt = z.infer<typeof SyncAttemptSchema>;

/** Schema for a batch sync request */
export const SyncBatchRequestSchema = z.object({
  attempts: z.array(SyncAttemptSchema).min(1).max(50),
  schemaVersion: z.number().int().min(1),
  deviceId: z.string().max(100),
});

export type SyncBatchRequest = z.infer<typeof SyncBatchRequestSchema>;

/** Schema for individual attempt sync result */
export const SyncAttemptResultSchema = z.object({
  clientEventId: z.string().uuid(),
  status: z.enum(['created', 'duplicate', 'rejected']),
  serverId: z.string().uuid().optional(),
  reason: z.string().optional(),
});

export type SyncAttemptResult = z.infer<typeof SyncAttemptResultSchema>;

/** Schema for batch sync response */
export const SyncBatchResponseSchema = z.object({
  results: z.array(SyncAttemptResultSchema),
  serverStats: z.object({
    currentXp: z.number().int(),
    level: z.number().int(),
    streakCount: z.number().int(),
  }),
  syncedAt: z.string().datetime(),
});

export type SyncBatchResponse = z.infer<typeof SyncBatchResponseSchema>;

/** Schema for schema version check response */
export const SchemaVersionResponseSchema = z.object({
  version: z.number().int(),
  minClientVersion: z.number().int(),
  migrationRequired: z.boolean(),
});

export type SchemaVersionResponse = z.infer<typeof SchemaVersionResponseSchema>;

/** Schema for static hints prefetch response */
export const HintPrefetchResponseSchema = z.object({
  lessonId: z.string(),
  questions: z.array(z.object({
    questionId: z.string(),
    hints: z.array(z.string().max(2000)),
  })),
});

export type HintPrefetchResponse = z.infer<typeof HintPrefetchResponseSchema>;

/** Schema for AI cache prefetch response */
export const AiCachePrefetchResponseSchema = z.object({
  entries: z.array(z.object({
    questionId: z.string(),
    diagnosis: z.string().max(5000),
    generatedAt: z.string().datetime(),
  })),
});

export type AiCachePrefetchResponse = z.infer<typeof AiCachePrefetchResponseSchema>;
