import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../../middlewares/auth';

const router = Router();

// Helper to format Date into JST YYYY-MM-DD
function getJstDateString(date: Date): string {
  const jstTime = date.getTime() + (9 * 60 * 60 * 1000);
  const jstDate = new Date(jstTime);
  return jstDate.toISOString().split('T')[0];
}

function checkQuestsCompleted(attempts: any[]): { adventure: boolean; grit: boolean; intuition: boolean } {
  const adventure = attempts.length >= 3;
  const grit = attempts.some(a => a.isCorrect && a.hintsUsed >= 1);
  const intuition = attempts.some(a => a.isCorrect && a.hintsUsed === 0);
  return { adventure, grit, intuition };
}

router.get('/quests', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const repos = req.repos!;
    const now = new Date();
    const todayStr = getJstDateString(now);

    const attempts = await repos.attempts.findAttemptsByUser(userId);
    const todayAttempts = attempts.filter(a => getJstDateString(new Date(a.createdAt)) === todayStr);
    const quests = checkQuestsCompleted(todayAttempts);

    // Return current quest progress
    res.json([
      {
        id: 'adventure',
        name: '本日の大冒険 🧮',
        description: '算数の問題を3問解こう！',
        current: todayAttempts.length,
        target: 3,
        isCompleted: quests.adventure,
        bonusXp: 50,
      },
      {
        id: 'grit',
        name: '粘り強さの達人 🧅',
        description: 'ヒントを1回以上使って正解しよう！',
        current: todayAttempts.filter(a => a.isCorrect && a.hintsUsed >= 1).length,
        target: 1,
        isCompleted: quests.grit,
        bonusXp: 50,
      },
      {
        id: 'intuition',
        name: '直感マスター ⚡',
        description: 'ヒントを使わずに正解しよう！',
        current: todayAttempts.filter(a => a.isCorrect && a.hintsUsed === 0).length,
        target: 1,
        isCompleted: quests.intuition,
        bonusXp: 50,
      }
    ]);
  } catch (error) {
    console.error('Get quests error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  }
});

// Progress Calculation API
router.get('/progress', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const repos = req.repos!;
    const subjectCode = req.query.subject as string | undefined;

    let attempts = await repos.attempts.findAttemptsByUser(userId);
    // Sort attempts by createdAt asc (findAttemptsByUser returns desc)
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

    // Calculate progress
    const unitsProgress = rawUnits.map((unit: any) => {
      let unitTotalQuestions = 0;
      let unitCorrectQuestions = 0;
      let unitTotalScore = 0;

      const lessonsProgress = unit.lessons.map((lesson: any) => {
        const lessonQuestions = lesson.questions || [];
        const lessonTotal = lessonQuestions.length;
        let lessonCorrect = 0;
        let lessonScore = 0;

        lessonQuestions.forEach((q: any) => {
          const qId = q.id;
          const attempt = latestAttempts.get(qId);
          
          if (attempt && attempt.isCorrect) {
            lessonCorrect++;
            // Calculate score for understanding level
            const hints = attempt.hintsUsed || 0;
            const duration = attempt.durationSeconds;

            if (hints === 0 && duration !== null && duration !== undefined && duration <= 30) {
              lessonScore += 3; // S
            } else if (hints <= 1 && (duration === null || duration === undefined || duration <= 45)) {
              lessonScore += 2; // A
            } else if (hints <= 2) {
              lessonScore += 1; // B
            } else {
              lessonScore += 0; // C
            }
          }
        });

        unitTotalQuestions += lessonTotal;
        unitCorrectQuestions += lessonCorrect;
        unitTotalScore += lessonScore;

        const completionRate = lessonTotal > 0 ? Math.round((lessonCorrect / lessonTotal) * 100) : 0;
        
        let understandingLevel = '-';
        if (lessonTotal > 0 && lessonCorrect > 0) {
          const avgScore = lessonScore / lessonTotal;
          if (avgScore >= 2.5) understandingLevel = 'S';
          else if (avgScore >= 1.5) understandingLevel = 'A';
          else if (avgScore >= 0.5) understandingLevel = 'B';
          else understandingLevel = 'C';
        } else if (lessonTotal > 0) {
          understandingLevel = 'C';
        }

        return {
          id: lesson.id,
          name: lesson.name,
          order: lesson.order,
          completionRate,
          understandingLevel
        };
      });

      const completionRate = unitTotalQuestions > 0 ? Math.round((unitCorrectQuestions / unitTotalQuestions) * 100) : 0;
      let understandingLevel = '-';
      if (unitTotalQuestions > 0 && unitCorrectQuestions > 0) {
        const avgScore = unitTotalScore / unitTotalQuestions;
        if (avgScore >= 2.5) understandingLevel = 'S';
        else if (avgScore >= 1.5) understandingLevel = 'A';
        else if (avgScore >= 0.5) understandingLevel = 'B';
        else understandingLevel = 'C';
      } else if (unitTotalQuestions > 0) {
        understandingLevel = 'C';
      }

      return {
        id: unit.id,
        name: unit.name,
        order: unit.order,
        description: unit.description,
        completionRate,
        understandingLevel,
        lessons: lessonsProgress
      };
    });

    res.json({ units: unitsProgress });
  } catch (error) {
    console.error('Progress calculation error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  }
});

export default router;
