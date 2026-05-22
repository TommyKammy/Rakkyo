import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth';
import { calculateParentStats } from '../services/parentStatsService';

const router = Router();

router.get('/stats', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const repos = req.repos!;
    
    // Get attempts from repository and sort ascending as the original logic did
    const attempts = await repos.attempts.findAttemptsByUser(userId);
    const sortedAttempts = [...attempts].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    const stats = calculateParentStats(sortedAttempts);
    res.json(stats);
    
  } catch (error) {
    console.error('Error generating parent stats:', error);
    res.status(500).json({ error: '親ダッシュボード統計の取得中にエラーが発生しました。' });
  }
});

// GET /message - Get parent messages (latest first)
router.get('/message', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const repos = req.repos!;
    const messages = await repos.users.findParentMessages(userId);
    
    // Sort descending by date
    const sortedMessages = [...messages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    res.json({ messages: sortedMessages });
  } catch (err) {
    console.error('Error getting parent messages:', err);
    res.status(500).json({ error: 'メッセージの取得に失敗しました。' });
  }
});

// POST /message - Send a parent message
router.post('/message', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const repos = req.repos!;
    const { message } = req.body;
    
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'メッセージ内容を正しく指定してください。' });
      return;
    }
    
    const newMessage = await repos.users.createParentMessage(userId, message);
    
    res.status(201).json({ message: newMessage });
  } catch (err) {
    console.error('Error sending parent message:', err);
    res.status(500).json({ error: 'メッセージの送信に失敗しました。' });
  }
});

// PATCH /message/:id/read - Mark parent message as read
router.patch('/message/:id/read', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const repos = req.repos!;
    const success = await repos.users.markParentMessageAsRead(id);
    
    if (!success) {
      res.status(404).json({ error: '対象のメッセージが見つかりませんでした。' });
      return;
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking message read:', err);
    res.status(500).json({ error: 'メッセージの既読更新に失敗しました。' });
  }
});

export default router;
