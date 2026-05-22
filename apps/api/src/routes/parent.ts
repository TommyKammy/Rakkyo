import { Router, Response } from 'express';
import prisma from '../db';
import { mockDb } from '../mockDb';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth';
import { mathGrade1Curriculum } from '@rakkyo/curriculum';

const router = Router();

// Helper to format Date into JST YYYY-MM-DD
function getJstDateString(date: Date): string {
  const jstTime = date.getTime() + (9 * 60 * 60 * 1000);
  const jstDate = new Date(jstTime);
  return jstDate.toISOString().split('T')[0];
}

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
    
    // Sort attempts by createdAt asc
    attempts.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    // 1. Overall Summary
    const totalAttempts = attempts.length;
    const correctAttempts = attempts.filter(a => a.isCorrect).length;
    const accuracyRate = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;
    
    const uniqueDays = new Set(attempts.map(a => getJstDateString(new Date(a.createdAt))));
    const totalActiveDays = uniqueDays.size;
    
    // Calculate total study time in minutes
    const totalDurationSeconds = attempts.reduce((acc, a) => acc + (a.durationSeconds || 0), 0);
    const totalStudyTimeMinutes = Math.round(totalDurationSeconds / 60);
    
    let totalHintsUsed = 0;
    let gritAttempts = 0; // Attempts where hints were used
    let gritSuccess = 0;   // Attempts where hints were used AND answer was correct
    
    attempts.forEach(a => {
      totalHintsUsed += a.hintsUsed;
      if (a.hintsUsed > 0) {
        gritAttempts++;
        if (a.isCorrect) {
          gritSuccess++;
        }
      }
    });
    
    const gritScore = gritAttempts > 0 ? Math.round((gritSuccess / gritAttempts) * 100) : 0;
    
    // 2. Daily Activity (Last 7 Days)
    const dailyActivity = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = getJstDateString(d);
      
      const dayAttempts = attempts.filter(a => getJstDateString(new Date(a.createdAt)) === dateStr);
      const dayCorrect = dayAttempts.filter(a => a.isCorrect).length;
      const dayHints = dayAttempts.reduce((acc, a) => acc + a.hintsUsed, 0);
      
      dailyActivity.push({
        date: dateStr,
        attemptsCount: dayAttempts.length,
        correctCount: dayCorrect,
        hintsCount: dayHints
      });
    }
    
    // 3. Topic Progress & Automated Weak Unit Estimation
    const topicProgress = [];
    const unitScores = [];
    
    for (const unit of mathGrade1Curriculum.units) {
      // Collect all question IDs / prompts in this unit
      const questionIdsInUnit = new Set<string>();
      let totalQuestionsInUnit = 0;
      
      for (const lesson of unit.lessons) {
        for (const question of lesson.questions) {
          totalQuestionsInUnit++;
          if (question.id) questionIdsInUnit.add(question.id);
          questionIdsInUnit.add(question.prompt);
        }
      }
      
      const unitAttempts = attempts.filter(a => questionIdsInUnit.has(a.questionId));
      const unitCorrect = unitAttempts.filter(a => a.isCorrect).length;
      const unitAccuracy = unitAttempts.length > 0 ? Math.round((unitCorrect / unitAttempts.length) * 100) : 0;
      
      topicProgress.push({
        unitName: unit.name,
        totalQuestions: totalQuestionsInUnit,
        attemptsCount: unitAttempts.length,
        correctCount: unitCorrect,
        accuracyRate: unitAccuracy,
        isCompleted: unitCorrect >= Math.min(totalQuestionsInUnit, 5)
      });
      
      // Calculate weak unit analytics if there are attempts
      if (unitAttempts.length > 0) {
        const totalHints = unitAttempts.reduce((acc, a) => acc + a.hintsUsed, 0);
        const avgHints = totalHints / unitAttempts.length;
        
        const uniqueQuestions = new Set(unitAttempts.map(a => a.questionId));
        const uniqueCount = uniqueQuestions.size;
        const retryRate = uniqueCount > 0 ? (unitAttempts.length - uniqueCount) / uniqueCount : 0;
        
        // Weakest Score = (100 - accuracy) * 0.4 + (avgHints / 3 * 100) * 0.4 + (retryRate * 100) * 0.2
        const accuracyComp = (100 - unitAccuracy) * 0.4;
        const hintComp = Math.min(100, (avgHints / 3) * 100) * 0.4;
        const retryComp = Math.min(100, retryRate * 100) * 0.2;
        const weakestScore = Math.round(accuracyComp + hintComp + retryComp);
        
        let reasoning = "全体的にバランス良く取り組めています。";
        if (unitAccuracy < 60) {
          reasoning = `正答率が ${unitAccuracy}% と少し苦戦している様子が見られます。つまずきポイントを整理しましょう。`;
        } else if (avgHints > 1.2) {
          reasoning = "最終的な正答率は高いですが、3段階ヒントをたくさん活用してじっくり粘り強く解いています。";
        } else if (retryRate > 0.3) {
          reasoning = "間違えた問題を何度も解き直し、納得するまであきらめずに挑戦している姿勢が素晴らしいです。";
        }
        
        unitScores.push({
          unitName: unit.name,
          weakestScore,
          accuracyRate: unitAccuracy,
          avgHintsUsed: Math.round(avgHints * 10) / 10,
          retryCount: unitAttempts.length - uniqueCount,
          reason: reasoning
        });
      }
    }
    
    // Sort weak units by score descending
    unitScores.sort((a, b) => b.weakestScore - a.weakestScore);
    const weakestUnits = unitScores.slice(0, 2);
    
    // 4. Hint Stage Usage
    let stage1Count = 0;
    let stage2Count = 0;
    let stage3Count = 0;
    
    attempts.forEach(a => {
      if (a.hintsUsed >= 1) stage1Count++;
      if (a.hintsUsed >= 2) stage2Count++;
      if (a.hintsUsed >= 3) stage3Count++;
    });
    
    // 5. Weekly History (Last 4 Weeks Comparative Report)
    const weeklyHistory = [];
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    for (let w = 3; w >= 0; w--) {
      const startDaysAgo = (w + 1) * 7 - 1;
      const endDaysAgo = w * 7;
      
      const startDate = new Date(now.getTime() - startDaysAgo * oneDayMs);
      const endDate = new Date(now.getTime() - endDaysAgo * oneDayMs);
      
      const startStr = getJstDateString(startDate);
      const endStr = getJstDateString(endDate);
      
      const weekAttempts = attempts.filter(a => {
        const aDateStr = getJstDateString(new Date(a.createdAt));
        return aDateStr >= startStr && aDateStr <= endStr;
      });
      
      const weekTotal = weekAttempts.length;
      const weekCorrect = weekAttempts.filter(a => a.isCorrect).length;
      const weekAccuracy = weekTotal > 0 ? Math.round((weekCorrect / weekTotal) * 100) : 0;
      
      const weekDuration = weekAttempts.reduce((acc, a) => acc + (a.durationSeconds || 0), 0);
      const weekMinutes = Math.round(weekDuration / 60);
      
      let weekGritAttempts = 0;
      let weekGritSuccess = 0;
      weekAttempts.forEach(a => {
        if (a.hintsUsed > 0) {
          weekGritAttempts++;
          if (a.isCorrect) weekGritSuccess++;
        }
      });
      const weekGritScore = weekGritAttempts > 0 ? Math.round((weekGritSuccess / weekGritAttempts) * 100) : 0;
      
      weeklyHistory.push({
        label: w === 0 ? "今週" : `${w}週間前`,
        period: `${startStr.slice(5)} 〜 ${endStr.slice(5)}`,
        totalAttempts: weekTotal,
        accuracyRate: weekAccuracy,
        studyTimeMinutes: weekMinutes,
        gritScore: weekGritScore
      });
    }
    
    res.json({
      summary: {
        totalActiveDays,
        totalAttempts,
        correctAttempts,
        accuracyRate,
        totalHintsUsed,
        gritScore,
        totalStudyTimeMinutes
      },
      dailyActivity,
      topicProgress,
      hintStageUsage: {
        stage1Count,
        stage2Count,
        stage3Count
      },
      weakestUnits,
      weeklyHistory
    });
    
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
