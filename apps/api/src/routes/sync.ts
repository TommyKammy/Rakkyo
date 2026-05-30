import { Router } from 'express';
import {
  authMiddleware,
  AuthenticatedRequest,
} from '../middlewares/auth';
import { SyncService } from '../services/SyncService';
import { consumeSyncToken } from '../utils/syncRateLimiter';
import {
  SyncBatchRequestSchema,
  OFFLINE_SCHEMA_VERSION,
  MIN_CLIENT_SCHEMA_VERSION,
} from '@rakkyo/shared';

const router = Router();

/**
 * POST /api/sync/batch
 * Process a batch of offline attempts with idempotent merge (D-1).
 * Requires authentication.
 */
router.post('/batch', authMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.userId;
    if (!userId) {
      res.status(401).json({ error: '認証が必要です。' });
      return;
    }

    // D-7 / P2: Enforce per-user sync throttling ACROSS requests. The client
    // posts one attempt per /batch request, so the per-item throttle inside
    // processBatch never fires; a modified client could otherwise replay many
    // one-attempt batches to bypass DB-write throttling. A 429 is safe for the
    // legitimate client — flushPendingAttempts reverts the row to PENDING and
    // retries later. Skipped in tests for determinism (mirrors the per-item
    // throttle's NODE_ENV guard).
    if (process.env.NODE_ENV !== 'test' && !consumeSyncToken(userId)) {
      res.status(429).json({
        error: 'rate_limited',
        message:
          '同期リクエストが多すぎます。少し待ってから自動的に再試行されます。',
      });
      return;
    }

    // Validate request body with shared Zod schema (§3 input validation)
    const parsed = SyncBatchRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'リクエストの形式が正しくありません。',
        details: parsed.error.issues.map((i) => i.message),
      });
      return;
    }

    const { attempts, schemaVersion, deviceId } = parsed.data;

    // D-6: Check client schema version compatibility (both directions).
    // - Below MIN: the client is too old; tell it to update.
    // - Above the server's current OFFLINE_SCHEMA_VERSION: the client is
    //   NEWER than this server (staged deploy / rollback). Zod would silently
    //   strip unknown fields and we could persist misinterpreted attempts, so
    //   reject and have the client hold its local data until the server
    //   catches up.
    if (
      schemaVersion < MIN_CLIENT_SCHEMA_VERSION ||
      schemaVersion > OFFLINE_SCHEMA_VERSION
    ) {
      res.status(409).json({
        error: 'schema_version_mismatch',
        message:
          schemaVersion > OFFLINE_SCHEMA_VERSION
            ? 'サーバーの更新をお待ちください。オフラインデータはローカルに保持されています。'
            : '最新版に更新してください。オフラインデータはローカルに保持されています。',
        serverVersion: OFFLINE_SCHEMA_VERSION,
        minClientVersion: MIN_CLIENT_SCHEMA_VERSION,
      });
      return;
    }

    const syncService = new SyncService(
      authReq.repos!.sync,
      authReq.repos!.curriculum,
      authReq.repos!.attempts
    );
    const result = await syncService.processBatch(
      userId,
      attempts,
      deviceId
    );

    res.json(result);
  } catch (error) {
    console.error('Sync batch error:', error);
    res.status(500).json({
      error: '同期中にエラーが発生しました。データはローカルに保持されています。',
    });
  }
});

/**
 * GET /api/sync/schema-version
 * Return the current server schema version for client-side compatibility check (D-6).
 * PUBLIC: Used by the client before auth to verify schema compatibility.
 */
// PUBLIC: Schema version check is needed before auth flow to detect
// incompatible clients and prompt for update before attempting sync.
router.get('/schema-version', (_req, res) => {
  try {
    res.json({
      version: OFFLINE_SCHEMA_VERSION,
      minClientVersion: MIN_CLIENT_SCHEMA_VERSION,
      migrationRequired: false,
    });
  } catch (error) {
    console.error('Schema version error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  }
});

/**
 * GET /api/sync/hints/:lessonId
 * Return static hints for all questions in a lesson for offline prefetch (P16D-003).
 * Requires authentication.
 */
router.get('/hints/:lessonId', authMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { lessonId } = req.params;

    if (!lessonId) {
      res.status(400).json({ error: 'レッスンIDが必要です。' });
      return;
    }

    // Query questions and their hints for the given lesson ID using the repository.
    const questions = await authReq.repos!.curriculum.findQuestionsByLessonId(lessonId);
    if (!questions || questions.length === 0) {
      // Return 404 if no questions are found for this lesson ID
      res.status(404).json({ error: 'レッスンが見つからないか、問題が登録されていません。' });
      return;
    }

    res.json({
      lessonId,
      questions: questions.map((q) => ({
        questionId: q.id,
        hints: q.hints || [],
      })),
    });
  } catch (error) {
    console.error('Hint prefetch error:', error);
    res.status(500).json({ error: 'ヒントの取得に失敗しました。' });
  }
});

/**
 * GET /api/sync/ai-cache
 * Return recent AI diagnosis responses for offline prefetch (P16D-003, D-5).
 * Requires authentication.
 */
router.get('/ai-cache', authMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.userId;
    if (!userId) {
      res.status(401).json({ error: '認証が必要です。' });
      return;
    }

    // Get recent attempts with AI diagnosis
    const attempts = await authReq.repos!.attempts.findAttemptsByUser(
      userId,
      30
    );

    const entries = attempts
      .filter(
        (a: { aiDiagnosis?: string | null; question?: { lesson?: { name?: string } } }) =>
          a.aiDiagnosis && a.aiDiagnosis.length > 0 && !!a.question?.lesson?.name
      )
      .map(
        (a: {
          questionId: string;
          aiDiagnosis: string;
          createdAt: string | Date;
          question?: { lesson?: { name?: string } };
        }) => ({
          // P2: lessonId scopes the offline AI cache (prompt-fallback ids
          // collide across lessons). Use lesson.name — the same identifier
          // the web client reads the cache with.
          lessonId: a.question!.lesson!.name,
          questionId: a.questionId,
          diagnosis: a.aiDiagnosis,
          generatedAt:
            typeof a.createdAt === 'string'
              ? a.createdAt
              : a.createdAt.toISOString(),
        })
      );

    res.json({ entries });
  } catch (error) {
    console.error('AI cache prefetch error:', error);
    res.status(500).json({ error: 'AIキャッシュの取得に失敗しました。' });
  }
});

export default router;
