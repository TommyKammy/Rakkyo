import { Router, Response } from 'express';
import prisma from '../db';
import { mockDb } from '../mockDb';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth';

const router = Router();

// DELETE /me/data - Right-to-Be-Forgotten (忘れられる権利) API
// ユーザー自身のアカウントおよび紐づく全データを完全に削除する
router.delete('/me/data', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const isMock = req.isMock || process.env.NODE_ENV === 'test';

    if (!isMock) {
      // 1. 依存データの手動削除 (Prisma schemaで onDelete: Cascade がないものを先に削除)
      // 1-1. ParentMessage 削除
      await prisma.parentMessage.deleteMany({
        where: { userId }
      });

      // 1-2. UserBadge 削除
      await prisma.userBadge.deleteMany({
        where: { userId }
      });

      // 1-3. Attempt 削除
      // Note: ParentalCelebration は Attempt に onDelete: Cascade で紐づいているため、
      // Attempt 削除時に cascade 削除されます。
      await prisma.attempt.deleteMany({
        where: { userId }
      });

      // 2. ユーザー本体の削除
      // Note: ClassEnrollment, StudentAssignmentProgress, ParentChildRelation, PeerStamp, HiramekiTip, ParentalCelebration 
      // などは Prisma schema 上で onDelete: Cascade になっているため、自動的に完全削除されます。
      await prisma.user.delete({
        where: { id: userId }
      });

      res.json({ success: true, message: 'ユーザーデータおよび関連する学習履歴が完全に削除されました。' });
    } else {
      mockDb.deleteUserData(userId);
      res.json({ success: true, message: 'ユーザーデータおよび関連する学習履歴が完全に削除されました。' });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
