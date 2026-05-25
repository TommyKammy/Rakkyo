import { Router } from 'express';
import {
  authMiddleware,
  AuthenticatedRequest,
} from '../middlewares/auth';
import { SyncService } from '../services/SyncService';
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

    // D-6: Check client schema version compatibility
    if (schemaVersion < MIN_CLIENT_SCHEMA_VERSION) {
      res.status(409).json({
        error: 'schema_version_mismatch',
        message:
          '最新版に更新してください。オフラインデータはローカルに保持されています。',
        serverVersion: OFFLINE_SCHEMA_VERSION,
        minClientVersion: MIN_CLIENT_SCHEMA_VERSION,
      });
      return;
    }

    const syncService = new SyncService(authReq.repos!.sync);
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
        (a: { aiDiagnosis?: string | null }) =>
          a.aiDiagnosis && a.aiDiagnosis.length > 0
      )
      .map(
        (a: {
          questionId: string;
          aiDiagnosis: string;
          createdAt: string | Date;
        }) => ({
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
