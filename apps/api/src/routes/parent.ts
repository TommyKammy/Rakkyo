import { Router, Response } from 'express';
import prisma from '../db';
import { mockDb } from '../mockDb';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth';
import { calculateParentStats } from '../services/parentStatsService';

const router = Router();

router.get('/stats', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const isMock = req.isMock;
    
    let attempts: any[] = [];
    
    if (!isMock) {
      try {
        attempts = await prisma.attempt.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' }
        });
      } catch (dbError) {
        console.warn('⚠️ Parent stats DB query failed. Falling back to mockDb.');
        attempts = mockDb.getUserAttempts(userId);
      }
    } else {
      attempts = mockDb.getUserAttempts(userId);
    }
    
    const stats = calculateParentStats(attempts);
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
    const isMock = req.isMock;
    
    let messages: any[] = [];
    
    if (!isMock) {
      try {
        messages = await prisma.parentMessage.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 10
        });
      } catch (dbError) {
        console.warn('⚠️ Parent messages DB query failed. Falling back to mockDb.');
        messages = mockDb.getParentMessages(userId);
      }
    } else {
      messages = mockDb.getParentMessages(userId);
    }
    
    // Sort descending by date
    messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    res.json({ messages });
  } catch (err) {
    console.error('Error getting parent messages:', err);
    res.status(500).json({ error: 'メッセージの取得に失敗しました。' });
  }
});

// POST /message - Send a parent message
router.post('/message', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const isMock = req.isMock;
    const { message } = req.body;
    
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'メッセージ内容を正しく指定してください。' });
      return;
    }
    
    let newMessage: any;
    
    if (!isMock) {
      try {
        newMessage = await prisma.parentMessage.create({
          data: {
            userId,
            message,
            isRead: false
          }
        });
      } catch (dbError) {
        console.warn('⚠️ Parent message DB creation failed. Falling back to mockDb.');
        newMessage = mockDb.createParentMessage(userId, message);
      }
    } else {
      newMessage = mockDb.createParentMessage(userId, message);
    }
    
    res.status(201).json({ message: newMessage });
  } catch (err) {
    console.error('Error sending parent message:', err);
    res.status(500).json({ error: 'メッセージの送信に失敗しました。' });
  }
});

// PATCH /message/:id/read - Mark parent message as read
router.patch('/message/:id/read', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isMock = req.isMock;
    const { id } = req.params;
    
    let success = false;
    
    if (!isMock) {
      try {
        await prisma.parentMessage.update({
          where: { id },
          data: { isRead: true }
        });
        success = true;
      } catch (dbError) {
        console.warn('⚠️ Parent message DB update failed. Falling back to mockDb.');
        success = mockDb.markParentMessageAsRead(id);
      }
    } else {
      success = mockDb.markParentMessageAsRead(id);
    }
    
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
