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
    
    // Sort attempts by createdAt asc just in case
    attempts.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    // 1. Overall Summary
    const totalAttempts = attempts.length;
    const correctAttempts = attempts.filter(a => a.isCorrect).length;
    const accuracyRate = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;
    
    const uniqueDays = new Set(attempts.map(a => getJstDateString(new Date(a.createdAt))));
    const totalActiveDays = uniqueDays.size;
    
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
    
    // 3. Topic Progress
    const topicProgress = [];
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
        isCompleted: unitCorrect >= Math.min(totalQuestionsInUnit, 5) // Completed if they solved at least 5 correctly (or total if less)
      });
    }
    
    // 4. Hint Stage Usage
    let stage1Count = 0;
    let stage2Count = 0;
    let stage3Count = 0;
    
    attempts.forEach(a => {
      if (a.hintsUsed >= 1) stage1Count++;
      if (a.hintsUsed >= 2) stage2Count++;
      if (a.hintsUsed >= 3) stage3Count++;
    });
    
    res.json({
      summary: {
        totalActiveDays,
        totalAttempts,
        correctAttempts,
        accuracyRate,
        totalHintsUsed,
        gritScore
      },
      dailyActivity,
      topicProgress,
      hintStageUsage: {
        stage1Count,
        stage2Count,
        stage3Count
      }
    });
    
  } catch (error) {
    console.error('Error generating parent stats:', error);
    res.status(500).json({ error: '親ダッシュボード統計の取得中にエラーが発生しました。' });
  }
});

export default router;
