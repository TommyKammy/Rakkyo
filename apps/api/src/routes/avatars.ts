import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth';
import { z } from 'zod';
import crypto from 'crypto';
import {
  VEGETABLE_MAP,
  COLOR_MAP,
  FEATURE_MAP,
  CLOTHING_MAP,
  EXPRESSION_MAP,
  avatarGeneratorService
} from '../services/AvatarGeneratorService';
import { storageService } from '../services/StorageService';
import { generateSignedToken, verifySignedToken, TokenPayload } from '../utils/signedToken';
import { requireSecret } from '../utils/secrets';

const router = Router();
const AVATAR_SHARE_SECRET = requireSecret('AVATAR_SHARE_SECRET', 'rakkyo-dev-avatar-share-insecure-key-9988');
// Cron jobs (TTL cleanup) are not user-authenticated; they present this
// shared secret in the `x-cron-secret` header. Prevents anyone reachable
// from the internet triggering destructive lifecycle actions.
const CRON_SECRET = requireSecret('RAKKYO_CRON_SECRET', 'rakkyo-dev-cron-insecure-key-3344');

const generateSchema = z.object({
  baseVegetable: z.enum(Object.keys(VEGETABLE_MAP) as [string, ...string[]]),
  mainColor: z.enum(Object.keys(COLOR_MAP) as [string, ...string[]]),
  facialFeatures: z.enum(Object.keys(FEATURE_MAP) as [string, ...string[]]),
  clothing: z.enum(Object.keys(CLOTHING_MAP) as [string, ...string[]]),
  expression: z.enum(Object.keys(EXPRESSION_MAP) as [string, ...string[]]),
});

// Helper functions for ISO week calculation
function getISOWeekBucket(d: Date = new Date()): string {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  week1.setDate(week1.getDate() + 3 - (week1.getDay() + 6) % 7);
  const weekNum = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-W${pad(weekNum)}`;
}

function getNextMonday(d: Date = new Date()): Date {
  const date = new Date(d.getTime());
  const days = (8 - date.getDay()) % 7 || 7;
  date.setDate(date.getDate() + days);
  date.setHours(0, 0, 0, 0);
  return date;
}

// 1. POST /api/avatars/generate - Child requests new avatars
router.post('/generate', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const uploadedObjectKeys: string[] = [];
  try {
    const userId = req.userId!;
    const repos = req.repos!;

    const user = await repos.users.findById(userId);
    if (!user) {
      return res.status(401).json({ error: 'ユーザーが見つかりません。' });
    }
    // Avatar generation is a child-only feature. Parents / teachers
    // must not consume quota or appear in the moderation queue.
    if (user.role !== 'STUDENT') {
      return res.status(403).json({ error: 'アバターの作成は児童アカウントのみ可能です。' });
    }

    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: '無効なパラメータが含まれています。' });
    }

    if (user.tenantId === 'default-b2c') {
      const parents = await repos.users.findParentsByChild(userId);
      if (parents.length === 0) {
        return res.status(400).json({ error: 'Parent relation required' });
      }
    }

    // Defer quota charge to AFTER the candidate row write succeeds, so
    // transient AI / storage / DB failures do not consume a user's
    // weekly attempt. We still claim the weekly slot first (atomic)
    // so concurrent generations cannot both pass the cap check; on
    // downstream failure we explicitly rollback the slot.
    const limit = 3;
    const weekBucket = getISOWeekBucket();
    const resetAt = getNextMonday();
    const quotaResult = await repos.avatars.atomicIncrementQuota(userId, weekBucket, limit, resetAt);
    if (!quotaResult.success) {
      return res.status(429).json({ error: '週次生成上限（3回）に達しました。' });
    }

    let savedAvatars: Awaited<ReturnType<typeof repos.avatars.createAvatar>>[] = [];
    try {
      const params = parsed.data as any;
      const candidateBuffers = await avatarGeneratorService.generateCandidates(params, 3);

      // Upload first (storage I/O), then atomically write all DB rows.
      // If any DB insert fails we compensate by deleting every storage
      // object we have already uploaded for this request, so no orphan
      // file or partial pending-row set is ever visible to the user.
      const uploads = await Promise.all(
        candidateBuffers.map(async (buf) => ({
          buf,
          objectKey: await storageService.uploadAvatarImage(buf)
        }))
      );
      uploads.forEach(u => uploadedObjectKeys.push(u.objectKey));

      savedAvatars = await repos.avatars.createAvatarsAtomically(
        uploads.map(u => ({
          id: crypto.randomUUID(),
          userId,
          status: 'PENDING',
          baseVegetable: params.baseVegetable,
          mainColor: params.mainColor,
          facialFeatures: params.facialFeatures,
          clothing: params.clothing,
          expression: params.expression,
          prompt: avatarGeneratorService.generatePrompt(params),
          objectKey: u.objectKey
        }))
      );
    } catch (innerErr) {
      // Compensate: roll back the storage uploads we made AND the
      // weekly quota slot we reserved, so the user can retry without
      // losing one of their three weekly attempts.
      await Promise.all(uploadedObjectKeys.map(k =>
        storageService.deleteAvatarImage(k).catch(() => undefined)
      ));
      await repos.avatars.releaseQuotaIncrement(userId, weekBucket).catch(() => undefined);
      throw innerErr;
    }

    const candidates = await Promise.all(
      savedAvatars.map(async (avatar) => ({
        id: avatar.id,
        previewUrl: await storageService.generateSignedUrl(avatar.objectKey, 300)
      }))
    );

    res.status(201).json({ candidates });
  } catch (err: any) {
    console.error('Error generating avatar candidates:', err);
    res.status(500).json({ error: 'アバター画像の生成中にエラーが発生しました。' });
  }
});

// 2. GET /api/avatars/pending - Moderator retrieves their pending queue
router.get('/pending', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const repos = req.repos!;
    const user = await repos.users.findById(userId);
    if (!user) {
      return res.status(401).json({ error: 'ユーザーが見つかりません。' });
    }

    let targetStudentIds: string[] = [];

    if (user.role === 'TEACHER') {
      // B2B cram school/school context. Use the bulk variant so a
      // teacher with 10 classes pays one DB round-trip instead of 10.
      const enrollments = await repos.users.findEnrollmentsByUser(userId, 'TEACHER');
      const classIds = enrollments.map(e => e.classId);

      const studentEnrollments = await repos.users.findEnrollmentsByClasses(classIds, 'STUDENT');
      targetStudentIds = Array.from(new Set(
        studentEnrollments
          .map(e => e.user)
          .filter(s => s && s.tenantId === user.tenantId)
          .map(s => s.id)
      ));
    } else if (user.role === 'PARENT') {
      // B2C parent context
      const children = await repos.users.findChildrenByParent(userId);
      targetStudentIds = children.map(c => c.id);
    } else {
      return res.status(403).json({ error: 'モデレーションキューにアクセスする権限がありません。' });
    }

    if (targetStudentIds.length === 0) {
      return res.json({ pending: [] });
    }

    const pendingAvatars = await repos.avatars.findPendingAvatarsByUserIds(targetStudentIds);

    // Enriched with dynamic signed URL previews (5 minutes)
    const enrichedPending = await Promise.all(
      pendingAvatars.map(async (avatar) => {
        const previewUrl = await storageService.generateSignedUrl(avatar.objectKey, 300);
        return {
          id: avatar.id,
          userId: avatar.userId,
          baseVegetable: avatar.baseVegetable,
          mainColor: avatar.mainColor,
          facialFeatures: avatar.facialFeatures,
          clothing: avatar.clothing,
          expression: avatar.expression,
          prompt: avatar.prompt,
          createdAt: avatar.createdAt,
          previewUrl
        };
      })
    );

    res.json({ pending: enrichedPending });
  } catch (err: any) {
    console.error('Error fetching pending moderation queue:', err);
    res.status(500).json({ error: '承認待ちアバター一覧の取得中にエラーが発生しました。' });
  }
});

// Helper for moderator authorization checks
async function verifyModeratorAuth(repos: any, moderator: any, avatar: any): Promise<boolean> {
  if (moderator.role === 'TEACHER') {
    if (moderator.tenantId !== avatar.user.tenantId) {
      return false; // Strict cross-tenant check
    }
    const teacherEnrollments = await repos.users.findEnrollmentsByUser(moderator.id, 'TEACHER');
    const classIds = teacherEnrollments.map((e: any) => e.classId);
    if (classIds.length === 0) return false;

    // Single bulk query instead of one per class. This used to be the
    // hottest N+1 path in the avatar feature: /active/:userId and
    // /:id/share both call here on every request, so a teacher with
    // 10 classes was issuing 10 enrollments queries per page render.
    const studentEnrollments = await repos.users.findEnrollmentsByClasses(classIds, 'STUDENT');
    return studentEnrollments.some((e: any) => e.userId === avatar.userId);
  } else if (moderator.role === 'PARENT') {
    const children = await repos.users.findChildrenByParent(moderator.id);
    return children.some((c: any) => c.id === avatar.userId);
  }
  return false;
}

// 3. POST /api/avatars/:id/approve - Approve pending avatar
router.post('/:id/approve', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const repos = req.repos!;

    const moderator = await repos.users.findById(userId);
    if (!moderator) {
      return res.status(401).json({ error: 'ユーザーが見つかりません。' });
    }

    const avatar = await repos.avatars.findAvatarById(id);
    if (!avatar) {
      return res.status(404).json({ error: '対象のアバターが見つかりません。' });
    }

    const student = await repos.users.findById(avatar.userId);
    if (!student) {
      return res.status(404).json({ error: 'アバターの持ち主（生徒）が見つかりません。' });
    }

    const isAuthorized = await verifyModeratorAuth(repos, moderator, { ...avatar, user: student });
    if (!isAuthorized) {
      return res.status(403).json({ error: 'このアバターを承認する権限がありません。' });
    }

    // Single-statement conditional transition: returns null if the row
    // is no longer PENDING (another moderator already acted). Same
    // TOCTOU protection that the shared-link routes already use.
    const updated = await repos.avatars.updateAvatarStatusAtomic(id, 'PENDING', 'APPROVED');
    if (!updated) {
      return res.status(400).json({ error: 'このアバターはすでに処理されています。' });
    }

    const imageHash = crypto.createHash('sha256').update(avatar.objectKey).digest('hex');
    await repos.avatars.createApprovalAudit({
      avatarId: id,
      moderatorId: userId,
      action: 'APPROVE',
      imageHash
    });

    res.json({ success: true, avatar: updated });
  } catch (err: any) {
    console.error('Error approving avatar:', err);
    res.status(500).json({ error: 'アバターの承認処理中にエラーが発生しました。' });
  }
});

// 4. POST /api/avatars/:id/reject - Reject pending avatar with soft preset reason
router.post('/:id/reject', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const repos = req.repos!;
    const { reason } = req.body;

    const softReasons = ['気に入らなかった', 'もう少しシンプルにしよう', 'AUTO_REJECT_TTL_EXPIRED'];
    if (!reason || !softReasons.includes(reason)) {
      return res.status(400).json({ error: '不適切な却下理由です。' });
    }

    const moderator = await repos.users.findById(userId);
    if (!moderator) {
      return res.status(401).json({ error: 'ユーザーが見つかりません。' });
    }

    const avatar = await repos.avatars.findAvatarById(id);
    if (!avatar) {
      return res.status(404).json({ error: '対象のアバターが見つかりません。' });
    }

    const student = await repos.users.findById(avatar.userId);
    if (!student) {
      return res.status(404).json({ error: 'アバターの持ち主（生徒）が見つかりません。' });
    }

    const isAuthorized = await verifyModeratorAuth(repos, moderator, { ...avatar, user: student });
    if (!isAuthorized) {
      return res.status(403).json({ error: 'このアバターを却下する権限がありません。' });
    }

    const updated = await repos.avatars.updateAvatarStatusAtomic(id, 'PENDING', 'REJECTED', reason);
    if (!updated) {
      return res.status(400).json({ error: 'このアバターはすでに処理されています。' });
    }

    const imageHash = crypto.createHash('sha256').update(avatar.objectKey).digest('hex');
    await repos.avatars.createApprovalAudit({
      avatarId: id,
      moderatorId: userId,
      action: 'REJECT',
      imageHash,
      reason
    });

    res.json({ success: true, avatar: updated });
  } catch (err: any) {
    console.error('Error rejecting avatar:', err);
    res.status(500).json({ error: 'アバターの却下処理中にエラーが発生しました。' });
  }
});

// 5. GET /api/avatars/active/:userId - Child's active avatar (with dynamic signed URL)
//
// Authorization: only the avatar's owner, a linked parent, or a teacher
// in the same tenant/class may read it. The endpoint previously accepted
// any authenticated `:userId` which let any account enumerate avatars by
// guessing IDs — a cross-tenant / cross-class privacy leak.
router.get('/active/:userId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId: targetUserId } = req.params;
    const callerId = req.userId!;
    const repos = req.repos!;

    const caller = await repos.users.findById(callerId);
    if (!caller) {
      return res.status(401).json({ error: 'ユーザーが見つかりません。' });
    }

    let isAuthorized = callerId === targetUserId;
    if (!isAuthorized) {
      const target = await repos.users.findById(targetUserId);
      if (!target) {
        // Do not disclose existence of unrelated accounts to the caller.
        return res.status(404).json({ error: '承認済みのアバターが見つかりません。' });
      }
      // Reuse the moderator-authz path: any party allowed to moderate
      // this user's avatars is by extension allowed to view their
      // active avatar. This keeps the access policy DRY.
      isAuthorized = await verifyModeratorAuth(repos, caller, {
        userId: targetUserId,
        user: target
      });
    }
    if (!isAuthorized) {
      return res.status(403).json({ error: 'このアバターを閲覧する権限がありません。' });
    }

    const activeAvatar = await repos.avatars.findLatestApprovedAvatar(targetUserId);
    if (!activeAvatar) {
      return res.status(404).json({ error: '承認済みのアバターが見つかりません。' });
    }

    const avatarUrl = await storageService.generateSignedUrl(activeAvatar.objectKey, 300);

    res.json({
      id: activeAvatar.id,
      userId: activeAvatar.userId,
      baseVegetable: activeAvatar.baseVegetable,
      mainColor: activeAvatar.mainColor,
      facialFeatures: activeAvatar.facialFeatures,
      clothing: activeAvatar.clothing,
      expression: activeAvatar.expression,
      avatarUrl
    });
  } catch (err: any) {
    console.error('Error fetching active avatar:', err);
    res.status(500).json({ error: 'アクティブアバターの取得中にエラーが発生しました。' });
  }
});

// 6. GET /api/avatars/raw/:key - Delivers the actual raw image content with timing-safe signed token validation
router.get('/raw/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: '認証トークンが必要です。' });
    }

    const isValid = storageService.verifySignedUrlToken(key, token);
    if (!isValid) {
      return res.status(403).json({ error: '無効な、あるいは期限切れの署名です。' });
    }

    const buffer = storageService.getObject(key);
    if (!buffer) {
      return res.status(404).json({ error: '画像ファイルが見つかりません。' });
    }

    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err: any) {
    console.error('Error serving raw avatar image:', err);
    res.status(500).json({ error: '画像の配信中にエラーが発生しました。' });
  }
});

// 7. GET /api/avatars/:id/share - Generate shared timed-HMAC link for parent/moderator approval
router.get('/:id/share', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const repos = req.repos!;

    const avatar = await repos.avatars.findAvatarById(id);
    if (!avatar) {
      return res.status(404).json({ error: '対象のアバターが見つかりません。' });
    }

    // Only a linked parent or an authorised teacher in the same
    // tenant/class can issue a share token. Self-issuance by the
    // owning student would let the child bypass the moderation queue
    // by generating a token and self-approving via the token-only
    // /shared/approve route.
    const user = await repos.users.findById(userId);
    if (!user) {
      return res.status(401).json({ error: 'ユーザーが見つかりません。' });
    }
    if (userId === avatar.userId) {
      return res.status(403).json({ error: '自身のアバターの共有リンクは作成できません。保護者または先生に依頼してください。' });
    }
    const student = await repos.users.findById(avatar.userId);
    if (!student) {
      return res.status(404).json({ error: 'アバターの持ち主（生徒）が見つかりません。' });
    }
    const isAuthorized = await verifyModeratorAuth(repos, user, { ...avatar, user: student });
    if (!isAuthorized) {
      return res.status(403).json({ error: 'このアバターの共有リンクを作成する権限がありません。' });
    }

    const payload: TokenPayload = {
      avatarId: avatar.id,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours share URL
    };
    const token = generateSignedToken(payload, AVATAR_SHARE_SECRET);
    
    res.json({
      token,
      shareUrl: `/api/avatars/shared/pending/${token}`
    });
  } catch (err: any) {
    console.error('Error creating share link:', err);
    res.status(500).json({ error: '共有リンクの作成中にエラーが発生しました。' });
  }
});

// 8. GET /api/avatars/shared/pending/:token - Retrieve pending avatar info via sharing token
router.get('/shared/pending/:token', async (req: AuthenticatedRequest, res) => {
  try {
    const { token } = req.params;
    const repos = req.repos!;

    const result = verifySignedToken<{ avatarId: string } & TokenPayload>(token, AVATAR_SHARE_SECRET);
    if (!result.ok) {
      const statusMap = { bad_signature: 400, expired: 400, malformed: 400 };
      return res.status(statusMap[result.reason] || 400).json({ error: `無効な署名です (${result.reason})` });
    }

    const avatar = await repos.avatars.findAvatarById(result.payload.avatarId);
    if (!avatar) {
      return res.status(404).json({ error: 'アバターが見つかりません。' });
    }

    const previewUrl = await storageService.generateSignedUrl(avatar.objectKey, 300);

    res.json({
      id: avatar.id,
      userId: avatar.userId,
      status: avatar.status,
      baseVegetable: avatar.baseVegetable,
      mainColor: avatar.mainColor,
      facialFeatures: avatar.facialFeatures,
      clothing: avatar.clothing,
      expression: avatar.expression,
      previewUrl
    });
  } catch (err: any) {
    console.error('Error reading shared pending avatar:', err);
    res.status(500).json({ error: 'アバター情報の取得中にエラーが発生しました。' });
  }
});

// 9. POST /api/avatars/shared/approve/:token - Approve pending avatar via sharing token (one-time consumption)
router.post('/shared/approve/:token', async (req: AuthenticatedRequest, res) => {
  try {
    const { token } = req.params;
    const repos = req.repos!;

    const result = verifySignedToken<{ avatarId: string } & TokenPayload>(token, AVATAR_SHARE_SECRET);
    if (!result.ok) {
      return res.status(400).json({ error: `無効な署名です (${result.reason})` });
    }

    const avatar = await repos.avatars.findAvatarById(result.payload.avatarId);
    if (!avatar) {
      return res.status(404).json({ error: 'アバターが見つかりません。' });
    }

    // Atomic check-and-update (TOCTOU protection for shared-link one-time moderation)
    const updated = await repos.avatars.updateAvatarStatusAtomic(avatar.id, 'PENDING', 'APPROVED');
    if (!updated) {
      return res.status(400).json({ error: 'このアバターはすでに処理されているか、無効です。' });
    }

    // Create approval audit
    const imageHash = crypto.createHash('sha256').update(avatar.objectKey).digest('hex');
    await repos.avatars.createApprovalAudit({
      avatarId: avatar.id,
      moderatorId: 'shared-link',
      action: 'APPROVE',
      imageHash
    });

    res.json({ success: true, avatar: updated });
  } catch (err: any) {
    console.error('Error approving shared avatar:', err);
    res.status(500).json({ error: '共有リンクからの承認処理中にエラーが発生しました。' });
  }
});

// 10. POST /api/avatars/shared/reject/:token - Reject pending avatar via sharing token (one-time consumption)
router.post('/shared/reject/:token', async (req: AuthenticatedRequest, res) => {
  try {
    const { token } = req.params;
    const repos = req.repos!;
    const { reason } = req.body;

    const softReasons = ['気に入らなかった', 'もう少しシンプルにしよう', 'AUTO_REJECT_TTL_EXPIRED'];
    if (!reason || !softReasons.includes(reason)) {
      return res.status(400).json({ error: '不適切な却下理由です。' });
    }

    const result = verifySignedToken<{ avatarId: string } & TokenPayload>(token, AVATAR_SHARE_SECRET);
    if (!result.ok) {
      return res.status(400).json({ error: `無効な署名です (${result.reason})` });
    }

    const avatar = await repos.avatars.findAvatarById(result.payload.avatarId);
    if (!avatar) {
      return res.status(404).json({ error: 'アバターが見つかりません。' });
    }

    // Atomic check-and-update (TOCTOU protection for shared-link one-time moderation)
    const updated = await repos.avatars.updateAvatarStatusAtomic(avatar.id, 'PENDING', 'REJECTED', reason);
    if (!updated) {
      return res.status(400).json({ error: 'このアバターはすでに処理されているか、無効です。' });
    }

    // Create rejection audit
    const imageHash = crypto.createHash('sha256').update(avatar.objectKey).digest('hex');
    await repos.avatars.createApprovalAudit({
      avatarId: avatar.id,
      moderatorId: 'shared-link',
      action: 'REJECT',
      imageHash,
      reason
    });

    res.json({ success: true, avatar: updated });
  } catch (err: any) {
    console.error('Error rejecting shared avatar:', err);
    res.status(500).json({ error: '共有リンクからの却下処理中にエラーが発生しました。' });
  }
});

// 11. POST /api/avatars/cron/cleanup - TTL automatic rejection (30 days) and physical cleanups
//
// Authorization: this is NOT a user-authenticated route — it is meant to
// be invoked by a scheduler (cron / Cloud Scheduler / etc.). We gate it
// with a shared-secret header (`x-cron-secret`) verified with timing-safe
// comparison so an internet-reachable attacker cannot trigger mass
// destructive cleanup. Bypassing user auth without this guard would
// allow arbitrary tenant-wide deletion.
router.post('/cron/cleanup', async (req: AuthenticatedRequest, res) => {
  try {
    const presented = req.header('x-cron-secret') || '';
    const expectedBuf = Buffer.from(CRON_SECRET, 'utf-8');
    const presentedBuf = Buffer.from(presented, 'utf-8');
    if (
      presentedBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, presentedBuf)
    ) {
      return res.status(403).json({ error: 'クリーンアップ用シークレットが無効です。' });
    }

    const repos = req.repos!;
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    // Find and auto-reject all pending avatars older than 30 days.
    // Each transition is guarded by `updateAvatarStatusAtomic` so a
    // moderator who approved one of these records between the read
    // and write does NOT have their decision overwritten by the cron.
    const expiredPending = await repos.avatars.findExpiredAvatars(cutoff);
    const actuallyRejected: typeof expiredPending = [];
    for (const avatar of expiredPending) {
      const transitioned = await repos.avatars.updateAvatarStatusAtomic(
        avatar.id,
        'PENDING',
        'REJECTED',
        'AUTO_REJECT_TTL_EXPIRED'
      );
      if (!transitioned) continue; // someone else already moderated this one
      actuallyRejected.push(avatar);

      const imageHash = crypto.createHash('sha256').update(avatar.objectKey).digest('hex');
      await repos.avatars.createApprovalAudit({
        avatarId: avatar.id,
        moderatorId: 'cron-ttl-cleanup',
        action: 'REJECT',
        imageHash,
        reason: 'AUTO_REJECT_TTL_EXPIRED'
      });
    }

    // Now find all REJECTED or old unused candidate avatars older than 30 days to physically delete
    const oldRejectedAvatars = await repos.avatars.findOldRejectedAvatars(cutoff);

    // Deduplicate between newly rejected expired pending avatars and already rejected avatars to prevent double-delete calls.
    // Only avatars we ACTUALLY transitioned (not skipped by the
    // race-guard) should be cleaned up here.
    const uniqueAvatarsMap = new Map<string, typeof expiredPending[0]>();
    for (const a of actuallyRejected) {
      uniqueAvatarsMap.set(a.id, a);
    }
    for (const a of oldRejectedAvatars) {
      uniqueAvatarsMap.set(a.id, a);
    }
    const allExpiredUnique = Array.from(uniqueAvatarsMap.values());
    const objectKeysToDelete = allExpiredUnique.map(a => a.objectKey);
    const avatarIdsToDelete = allExpiredUnique.map(a => a.id);

    // Physically delete from StorageService
    await Promise.all(
      objectKeysToDelete.map(key => storageService.deleteAvatarImage(key).catch(err => {
        console.error(`Failed to delete expired avatar physical file ${key}:`, err);
      }))
    );

    // Delete database records
    if (avatarIdsToDelete.length > 0) {
      await repos.avatars.deleteAvatars(avatarIdsToDelete);
    }

    res.json({
      success: true,
      autoRejectedCount: actuallyRejected.length,
      physicallyDeletedCount: allExpiredUnique.length
    });
  } catch (err: any) {
    console.error('Error during automatic TTL cleanup:', err);
    res.status(500).json({ error: '自動クリーンアップの実行中にエラーが発生しました。' });
  }
});

export default router;
