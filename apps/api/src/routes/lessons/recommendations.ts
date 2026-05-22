import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../../middlewares/auth';
import { AiTutorProviderFactory, AttemptSummary } from '@rakkyo/ai-tutor';

const router = Router();

router.get('/reviews', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const repos = req.repos!;
    const subjectCode = req.query.subject as string | undefined;

    let attempts = await repos.attempts.findAttemptsByUser(userId);
    // Sort attempts by createdAt asc to process in chronological order
    attempts = [...attempts].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const rawUnits = await repos.curriculum.findAllUnits(subjectCode);

    if (subjectCode) {
      const subjectQuestionIds = new Set<string>();
      for (const unit of rawUnits) {
        for (const lesson of unit.lessons) {
          for (const q of lesson.questions) {
            subjectQuestionIds.add(q.id);
          }
        }
      }
      attempts = attempts.filter(att => subjectQuestionIds.has(att.questionId));
    }

    // Group attempts by questionId to find the latest attempt for each question
    const latestAttempts = new Map<string, any>();
    for (const attempt of attempts) {
      latestAttempts.set(attempt.questionId, attempt);
    }

    // Identify candidate questions needing review
    const reviewQuestionIds: string[] = [];
    const attemptMetaMap = new Map<string, { hintsUsed: number; isCorrect: boolean }>();
    
    latestAttempts.forEach((attempt, qId) => {
      if (!attempt.isCorrect || (attempt.isCorrect && (attempt.hintsUsed || 0) >= 2)) {
        reviewQuestionIds.push(qId);
        attemptMetaMap.set(qId, {
          hintsUsed: attempt.hintsUsed || 0,
          isCorrect: attempt.isCorrect
        });
      }
    });

    if (reviewQuestionIds.length === 0) {
      res.json({ questions: [] });
      return;
    }

    // Retrieve full question details for candidates from curriculum data
    const allQuestions: any[] = [];
    for (const unit of rawUnits) {
      for (const lesson of unit.lessons) {
        for (const q of lesson.questions) {
          allQuestions.push({
            id: q.id,
            type: q.type,
            prompt: q.prompt,
            options: q.options,
            explanation: q.explanation,
            hints: q.hints,
            lessonId: lesson.id,
            lessonName: lesson.name,
            unitId: unit.id,
            unitName: unit.name
          });
        }
      }
    }
    
    // Filter and map
    const candidates = allQuestions
      .filter(q => reviewQuestionIds.includes(q.id))
      .map(q => {
        const meta = attemptMetaMap.get(q.id)!;
        return {
          id: q.id,
          type: q.type,
          prompt: q.prompt,
          options: q.options,
          explanation: q.explanation,
          hints: q.hints,
          lessonId: q.lessonId,
          lessonName: q.lessonName,
          unitId: q.unitId,
          unitName: q.unitName,
          lastAttempt: {
            isCorrect: meta.isCorrect,
            hintsUsed: meta.hintsUsed
          }
        };
      });

    // Prioritize incorrect over hint-heavy
    candidates.sort((a, b) => {
      if (!a.lastAttempt.isCorrect && b.lastAttempt.isCorrect) return -1;
      if (a.lastAttempt.isCorrect && !b.lastAttempt.isCorrect) return 1;
      return 0;
    });

    const selectedReviews = candidates.slice(0, 5);

    res.json({ questions: selectedReviews });
  } catch (error) {
    console.error('Review scheduler error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  }
});

router.get('/recommendations', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const repos = req.repos!;
    const user = req.user;

    const dbAttempts = await repos.attempts.findAttemptsByUser(userId, 10);
    const attempts: AttemptSummary[] = dbAttempts.map(a => ({
      lessonId: a.question?.lessonId || 'unknown',
      lessonName: a.question?.lesson?.name || 'unknown',
      isCorrect: a.isCorrect,
      hintsUsed: a.hintsUsed,
      errorType: a.errorType,
      aiDiagnosis: a.aiDiagnosis,
      createdAt: new Date(a.createdAt).toISOString()
    }));

    // Collect available lessons
    const dbLessons = await repos.curriculum.findLessons(5);
    const availableLessons = dbLessons.map((l: any) => ({
      id: l.id,
      name: l.name,
      unitName: l.unit.name
    }));

    const provider = AiTutorProviderFactory.getProvider();
    const recommendation = await provider.generateRecommendation({
      studentNickname: user.nickname || '生徒',
      attempts,
      availableLessons
    });

    res.json(recommendation);
  } catch (error) {
    console.error('Lessons recommendation error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  }
});

export default router;
