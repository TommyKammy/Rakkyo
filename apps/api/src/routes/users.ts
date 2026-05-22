import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth';

const router = Router();

// DELETE /me/data - Right-to-Be-Forgotten (忘れられる権利) API
// ユーザー自身のアカウントおよび紐づく全データを完全に削除する
router.delete('/me/data', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const repos = req.repos!;
    await repos.users.deleteUserData(userId);
    res.json({ success: true, message: 'ユーザーデータおよび関連する学習履歴が完全に削除されました。' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
