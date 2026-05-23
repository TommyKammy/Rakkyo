import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthenticatedRequest } from '../../middlewares/auth';
import { allCurriculums } from '@rakkyo/curriculum';
import { AiTutorProviderFactory } from '@rakkyo/ai-tutor';

const router = Router();

const submitSchema = z.object({
  questionId: z.string().max(100),
  answerSubmitted: z.string().max(5000),
  hintsUsed: z.number().int().nonnegative(),
  isCorrect: z.boolean().optional(), // Fallback from client if verification fails
  durationSeconds: z.number().int().nonnegative().optional().nullable(),
  isReview: z.boolean().optional(),
});

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

// Evaluate answer route
router.post('/submit', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repos = req.repos!;
    const parsed = submitSchema.parse(req.body);
    const userId = req.userId!;
    const user = req.user;

    let isCorrect = false;
    let foundQuestion = await repos.curriculum.findQuestionById(parsed.questionId);
    let attemptId: string | null = null;

    if (foundQuestion) {
      isCorrect = foundQuestion.answers.some(
        (ans: string) => ans.toLowerCase().trim() === parsed.answerSubmitted.toLowerCase().trim()
      );
    } else if (parsed.isCorrect !== undefined) {
      // Ultimate fallback: trust the client if we couldn't resolve the question
      isCorrect = parsed.isCorrect;
    }

    // Calculate Streak Updates
    const now = new Date();
    const todayStr = getJstDateString(now);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = getJstDateString(yesterday);

    let currentStreak = user.streakCount || 0;
    const lastActiveStr = user.lastActiveDate
      ? getJstDateString(new Date(user.lastActiveDate))
      : null;

    if (!lastActiveStr) {
      currentStreak = 1;
    } else if (lastActiveStr === yesterdayStr) {
      currentStreak += 1;
    } else if (lastActiveStr !== todayStr) {
      // If they skipped a day or more
      currentStreak = 1;
    }

    // Grit / Retry Review Bonus Detection
    let isGritBonus = false;
    if (isCorrect) {
      const pastAttempts = await repos.attempts.findAttemptsByQuestion(userId, parsed.questionId);
      isGritBonus = pastAttempts.some(a => !a.isCorrect || a.hintsUsed >= 2);
    }

    // Quest Progress Before Saving
    const allAttemptsBefore = await repos.attempts.findAttemptsByUser(userId);
    const todayAttemptsBefore = allAttemptsBefore.filter(
      a => getJstDateString(new Date(a.createdAt)) === todayStr
    );
    const questsBefore = checkQuestsCompleted(todayAttemptsBefore);

    // Process XP and Level Ups
    let currentXp = user.currentXp || 0;
    let currentLevel = user.level || 1;
    let leveledUp = false;

    // Grit retry bonus: 30 XP, Review: 25 XP, Normal: 10 XP
    const xpAwarded = isCorrect ? (isGritBonus ? 30 : (parsed.isReview ? 25 : 10)) : 0;

    // Precise Mistake Diagnosis
    let errorType: string | null = null;
    let aiDiagnosis: string | null = null;

    if (!isCorrect) {
      try {
        const provider = AiTutorProviderFactory.getProvider();
        const explanation = foundQuestion?.explanation || "";
        const answers = foundQuestion?.answers || [];
        const diagnosis = await provider.diagnoseMistake({
          prompt: foundQuestion?.prompt || parsed.questionId,
          explanation,
          answers,
          answerSubmitted: parsed.answerSubmitted,
          subjectCode: 'math'
        });
        errorType = diagnosis.errorType;
        aiDiagnosis = diagnosis.aiDiagnosis;
      } catch (diagError) {
        console.error('Failed to run AI diagnosis:', diagError);
      }
    }

    // Check quest progress after adding current attempt (simulate)
    const currentAttemptFake = {
      userId,
      questionId: parsed.questionId,
      isCorrect,
      hintsUsed: parsed.hintsUsed,
      answerSubmitted: parsed.answerSubmitted,
      durationSeconds: parsed.durationSeconds,
      createdAt: now.toISOString(),
      errorType,
      aiDiagnosis
    };
    const todayAttemptsAfter = [...todayAttemptsBefore, currentAttemptFake];
    const questsAfter = checkQuestsCompleted(todayAttemptsAfter);

    const questUnlocked: { name: string; bonusXp: number }[] = [];
    let questBonusXp = 0;
    if (!questsBefore.adventure && questsAfter.adventure) {
      questUnlocked.push({ name: '本日の大冒険 🧮', bonusXp: 50 });
      questBonusXp += 50;
    }
    if (!questsBefore.grit && questsAfter.grit) {
      questUnlocked.push({ name: '粘り強さの達人 🧅', bonusXp: 50 });
      questBonusXp += 50;
    }
    if (!questsBefore.intuition && questsAfter.intuition) {
      questUnlocked.push({ name: '直感マスター ⚡', bonusXp: 50 });
      questBonusXp += 50;
    }

    if (isCorrect) {
      currentXp += xpAwarded;
    }
    currentXp += questBonusXp;

    let xpNeeded = currentLevel * 100;
    while (currentXp >= xpNeeded) {
      currentXp -= xpNeeded;
      currentLevel += 1;
      leveledUp = true;
      xpNeeded = currentLevel * 100;
    }

    // Create attempt record
    const createdAttempt = await repos.attempts.createAttempt({
      userId,
      questionId: parsed.questionId,
      isCorrect,
      hintsUsed: parsed.hintsUsed,
      answerSubmitted: parsed.answerSubmitted,
      durationSeconds: parsed.durationSeconds,
      errorType,
      aiDiagnosis
    });
    attemptId = createdAttempt.id;

    // Update User stats
    await repos.users.updateUser(userId, {
      currentXp,
      level: currentLevel,
      streakCount: currentStreak,
      lastActiveDate: now
    });

    // Badges awarding logic
    const newBadges: string[] = [];
    const earnedBadgeNames = await repos.attempts.getUserBadges(userId);
    const allAttemptsAfter = [createdAttempt, ...allAttemptsBefore];

    // 1. XP / Start Badge check
    if ((currentXp > 0 || currentLevel > 1) && !earnedBadgeNames.some(b => b.includes('冒険のはじまり'))) {
      await repos.attempts.addUserBadge(userId, '冒険のはじまり');
      newBadges.push('🎉 冒険のはじまり');
    }

    // 2. Streak Badge check
    if (currentStreak >= 3 && !earnedBadgeNames.some(b => b.includes('あきらめない心'))) {
      await repos.attempts.addUserBadge(userId, 'あきらめない心');
      newBadges.push('🔥 あきらめない心');
    }

    // 3. Correct Answers count Badge check
    const correctCount = allAttemptsAfter.filter(a => a.isCorrect).length;
    if (correctCount >= 5 && !earnedBadgeNames.some(b => b.includes('数学マスターの卵'))) {
      await repos.attempts.addUserBadge(userId, '数学マスターの卵');
      newBadges.push('📐 数学マスターの卵');
    }

    // 4. Gritの達人 check
    const gritAttempts = allAttemptsAfter.filter(a => a.hintsUsed >= 1);
    const gritSuccess = gritAttempts.filter(a => a.isCorrect);
    const gritScore = gritAttempts.length > 0 ? Math.round((gritSuccess.length / gritAttempts.length) * 100) : 0;
    if (allAttemptsAfter.length >= 5 && gritAttempts.length >= 1 && gritScore >= 90 && !earnedBadgeNames.some(b => b.includes('Gritの達人'))) {
      await repos.attempts.addUserBadge(userId, 'Gritの達人');
      newBadges.push('🔥 Gritの達人');
    }

    // 5. 無限の探求者 check
    const totalDurationSeconds = allAttemptsAfter.reduce((sum, a) => sum + (a.durationSeconds || 0), 0);
    if (totalDurationSeconds >= 36000 && !earnedBadgeNames.some(b => b.includes('無限の探求者'))) {
      await repos.attempts.addUserBadge(userId, '無限の探求者');
      newBadges.push('⌛ 無限の探求者');
    }

    // 6. ストリークの鬼 check
    if (currentStreak >= 7 && !earnedBadgeNames.some(b => b.includes('ストリークの鬼'))) {
      await repos.attempts.addUserBadge(userId, 'ストリークの鬼');
      newBadges.push('⚡ ストリークの鬼');
    }

    // 7. 完璧主義者 check
    if (!earnedBadgeNames.some(b => b.includes('完璧主義者'))) {
      const consecutiveCorrect = 0; // wait
      const sortedAttempts = [...allAttemptsAfter].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      let consecutiveCorrectCount = 0;
      let maxConsecutiveCorrect = 0;
      for (const a of sortedAttempts) {
        if (a.isCorrect) {
          consecutiveCorrectCount++;
          if (consecutiveCorrectCount > maxConsecutiveCorrect) {
            maxConsecutiveCorrect = consecutiveCorrectCount;
          }
        } else {
          consecutiveCorrectCount = 0;
        }
      }
      if (maxConsecutiveCorrect >= 10) {
        await repos.attempts.addUserBadge(userId, '完璧主義者');
        newBadges.push('🌟 完璧主義者');
      }
    }

    const updatedBadgesList = await repos.attempts.getUserBadges(userId);

    res.json({
      attemptId,
      isCorrect,
      xpAwarded,
      isGritBonus,
      questUnlocked,
      leveledUp,
      newBadges,
      errorType,
      aiDiagnosis,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        schoolYear: user.schoolYear,
        currentXp,
        level: currentLevel,
        streakCount: currentStreak,
        badges: updatedBadgesList,
        isMock: !!req.isMock
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Lessons submit error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  }
});

// Recommend similar question
router.post('/recommend-similar', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repos = req.repos!;
    const userId = req.userId!;
    const { questionId } = req.body;

    if (!questionId) {
      res.status(400).json({ error: 'questionIdは必須です。' });
      return;
    }

    const foundQuestion = await repos.curriculum.findQuestionById(questionId);
    if (!foundQuestion) {
      res.status(404).json({ error: '元の問題が見つかりませんでした。' });
      return;
    }

    const pastAttempts = await repos.attempts.findAttemptsByQuestion(userId, questionId);
    const latestAttempt = pastAttempts[0] || null;

    // Call AI to generate similar question
    const provider = AiTutorProviderFactory.getProvider();
    const similarQResult = await provider.generateSimilarQuestion({
      prompt: foundQuestion.prompt,
      explanation: foundQuestion.explanation,
      answers: foundQuestion.answers,
      errorType: (latestAttempt?.errorType as any) || 'conceptual_error',
      aiDiagnosis: latestAttempt?.aiDiagnosis || 'もう一度ゆっくり考えてみよう！',
      subjectCode: 'math'
    });

    const lessonId = foundQuestion.lessonId || 'dynamic-lesson';
    const savedQuestion = await repos.curriculum.createDynamicQuestion({
      lessonId,
      type: foundQuestion.type || 'NUMBER_INPUT',
      prompt: similarQResult.prompt,
      answers: similarQResult.answers,
      options: similarQResult.options,
      explanation: similarQResult.explanation,
      hints: similarQResult.hints,
      isDynamic: true
    });

    res.json(savedQuestion);
  } catch (error) {
    console.error('Recommend similar question error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  }
});

export default router;
