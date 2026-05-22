import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../db';
import { mockDb } from '../mockDb';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth';
import { allCurriculums } from '@rakkyo/curriculum';
import { AiTutorProviderFactory, AiResponseCache, SafetyFilter, AttemptSummary } from '@rakkyo/ai-tutor';

const router = Router();

const submitSchema = z.object({
  questionId: z.string(),
  answerSubmitted: z.string(),
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
    const parsed = submitSchema.parse(req.body);
    const userId = req.userId!;
    const user = req.user;
    const isMock = req.isMock;

    let isCorrect = false;
    let foundQuestion = null;

    // 1. Verify Answer correctness
    if (!isMock) {
      try {
        foundQuestion = await prisma.question.findUnique({
          where: { id: parsed.questionId }
        });
        if (foundQuestion) {
          isCorrect = foundQuestion.answers.some(
            ans => ans.toLowerCase().trim() === parsed.answerSubmitted.toLowerCase().trim()
          );
        }
      } catch (dbError) {
        console.warn('⚠️ Database query failed when finding question. Falling back to local curriculum search.');
      }
    }

    // Fallback: Search in @rakkyo/curriculum static data if not found or in Mock mode
    if (!foundQuestion) {
      for (const curriculum of allCurriculums) {
        for (const unit of curriculum.units) {
          for (const lesson of unit.lessons) {
            const q = lesson.questions.find(
              quest => quest.id === parsed.questionId || quest.prompt === parsed.questionId
            );
            if (q) {
              foundQuestion = q;
              isCorrect = q.answers.some(
                ans => ans.toLowerCase().trim() === parsed.answerSubmitted.toLowerCase().trim()
              );
              break;
            }
          }
          if (foundQuestion) break;
        }
        if (foundQuestion) break;
      }
    }

    // Ultimate fallback: trust the client if we couldn't resolve the question
    if (!foundQuestion && parsed.isCorrect !== undefined) {
      isCorrect = parsed.isCorrect;
    }

    // 2. Calculate Streak Updates
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

    // 3. Grit / Retry Review Bonus Detection
    let isGritBonus = false;
    if (isCorrect) {
      if (isMock) {
        const pastAttempts = mockDb.getUserAttempts(userId);
        isGritBonus = pastAttempts.some(
          a => a.questionId === parsed.questionId && (!a.isCorrect || a.hintsUsed >= 2)
        );
      } else {
        try {
          const pastDbAttempts = await prisma.attempt.findMany({
            where: { userId, questionId: parsed.questionId }
          });
          isGritBonus = pastDbAttempts.some(a => !a.isCorrect || a.hintsUsed >= 2);
        } catch (e) {
          const pastAttempts = mockDb.getUserAttempts(userId);
          isGritBonus = pastAttempts.some(
            a => a.questionId === parsed.questionId && (!a.isCorrect || a.hintsUsed >= 2)
          );
        }
      }
    }

    // 4. Quest Progress Before Saving
    let todayAttemptsBefore: any[] = [];
    if (isMock) {
      const allMockAttemptsBefore = mockDb.getUserAttempts(userId);
      todayAttemptsBefore = allMockAttemptsBefore.filter(a => getJstDateString(new Date(a.createdAt)) === todayStr);
    } else {
      try {
        const allDbAttempts = await prisma.attempt.findMany({ where: { userId } });
        todayAttemptsBefore = allDbAttempts.filter(a => getJstDateString(new Date(a.createdAt)) === todayStr);
      } catch (e) {
        todayAttemptsBefore = mockDb.getUserAttempts(userId).filter(a => getJstDateString(new Date(a.createdAt)) === todayStr);
      }
    }
    const questsBefore = checkQuestsCompleted(todayAttemptsBefore);

    // 5. Process XP and Level Ups
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

    // 6. Badges awarding logic
    const newBadges: string[] = [];
    let updatedBadgesList: string[] = [];

    if (isMock) {
      // Mock Badge check
      const currentBadges = user.badges || [];
      updatedBadgesList = [...currentBadges];

      // Insert current attempt in mock DB so badge logic can count it
      mockDb.createAttempt({
        userId,
        questionId: parsed.questionId,
        isCorrect,
        hintsUsed: parsed.hintsUsed,
        answerSubmitted: parsed.answerSubmitted,
        durationSeconds: parsed.durationSeconds,
        errorType,
        aiDiagnosis
      });

      const allMockAttempts = mockDb.getUserAttempts(userId);

      // Award "🎉 冒険のはじまり" for starting / first XP
      if ((currentXp > 0 || currentLevel > 1) && !updatedBadgesList.includes('🎉 冒険のはじまり')) {
        updatedBadgesList.push('🎉 冒険のはじまり');
        newBadges.push('🎉 冒険のはじまり');
      }

      // Award "🔥 あきらめない心" for 3 day streak
      if (currentStreak >= 3 && !updatedBadgesList.includes('🔥 あきらめない心')) {
        updatedBadgesList.push('🔥 あきらめない心');
        newBadges.push('🔥 あきらめない心');
      }

      // Award "📐 数学マスターの卵" for 5 correct answers
      const correctAttemptsCount = allMockAttempts.filter(a => a.isCorrect).length;
      if (correctAttemptsCount >= 5 && !updatedBadgesList.includes('📐 数学マスターの卵')) {
        updatedBadgesList.push('📐 数学マスターの卵');
        newBadges.push('📐 数学マスターの卵');
      }

      // Award "🔥 Gritの達人" for gritScore >= 90% and attempts >= 5
      if (!updatedBadgesList.includes('🔥 Gritの達人')) {
        const gritAttempts = allMockAttempts.filter(a => a.hintsUsed >= 1);
        const gritSuccess = gritAttempts.filter(a => a.isCorrect);
        const gritScore = gritAttempts.length > 0 ? Math.round((gritSuccess.length / gritAttempts.length) * 100) : 0;
        if (allMockAttempts.length >= 5 && gritAttempts.length >= 1 && gritScore >= 90) {
          updatedBadgesList.push('🔥 Gritの達人');
          newBadges.push('🔥 Gritの達人');
        }
      }

      // Award "⌛ 無限の探求者" for study time >= 10h
      if (!updatedBadgesList.includes('⌛ 無限の探求者')) {
        const totalDurationSeconds = allMockAttempts.reduce((sum, a) => sum + (a.durationSeconds || 0), 0);
        if (totalDurationSeconds >= 36000) {
          updatedBadgesList.push('⌛ 無限の探求者');
          newBadges.push('⌛ 無限の探求者');
        }
      }

      // Award "ストリークの鬼" for streak >= 7
      if (currentStreak >= 7 && !updatedBadgesList.includes('⚡ ストリークの鬼')) {
        updatedBadgesList.push('⚡ ストリークの鬼');
        newBadges.push('⚡ ストリークの鬼');
      }

      // Award "完璧主義者" for consecutiveCorrect >= 10
      if (!updatedBadgesList.includes('🌟 完璧主義者')) {
        const sortedAttempts = [...allMockAttempts].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        let consecutiveCorrect = 0;
        let maxConsecutiveCorrect = 0;
        for (const a of sortedAttempts) {
          if (a.isCorrect) {
            consecutiveCorrect++;
            if (consecutiveCorrect > maxConsecutiveCorrect) {
              maxConsecutiveCorrect = consecutiveCorrect;
            }
          } else {
            consecutiveCorrect = 0;
          }
        }
        if (maxConsecutiveCorrect >= 10) {
          updatedBadgesList.push('🌟 完璧主義者');
          newBadges.push('🌟 完璧主義者');
        }
      }

      // Save updates to mock database
      mockDb.updateUser(userId, {
        currentXp,
        level: currentLevel,
        streakCount: currentStreak,
        lastActiveDate: now.toISOString(),
        badges: updatedBadgesList
      });
    } else {
      // Prisma DB Badge check
      try {
        // Create attempt record
        await prisma.attempt.create({
          data: {
            userId,
            questionId: parsed.questionId,
            isCorrect,
            hintsUsed: parsed.hintsUsed,
            answerSubmitted: parsed.answerSubmitted,
            durationSeconds: parsed.durationSeconds,
            errorType,
            aiDiagnosis
          }
        });

        // Update User stats
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: {
            currentXp,
            level: currentLevel,
            streakCount: currentStreak,
            lastActiveDate: now
          }
        });

        // Query earned badges
        const earnedUserBadges = await prisma.userBadge.findMany({
          where: { userId },
          include: { badge: true }
        });
        const earnedBadgeNames = earnedUserBadges.map(ub => ub.badge.name);

        const dbBadges = await prisma.badge.findMany();

        // 1. XP / Start Badge check
        const startBadge = dbBadges.find(b => b.name === '冒険のはじまり');
        if (startBadge && !earnedBadgeNames.includes('冒険のはじまり')) {
          await prisma.userBadge.create({
            data: { userId, badgeId: startBadge.id }
          });
          newBadges.push(`${startBadge.iconUrl} ${startBadge.name}`);
        }

        // 2. Streak Badge check
        const streakBadge = dbBadges.find(b => b.name === 'あきらめない心');
        if (streakBadge && currentStreak >= streakBadge.threshold && !earnedBadgeNames.includes('あきらめない心')) {
          await prisma.userBadge.create({
            data: { userId, badgeId: streakBadge.id }
          });
          newBadges.push(`${streakBadge.iconUrl} ${streakBadge.name}`);
        }

        // 3. Correct Answers count Badge check
        const correctAnswersBadge = dbBadges.find(b => b.name === '数学マスターの卵');
        if (correctAnswersBadge && !earnedBadgeNames.includes('数学マスターの卵')) {
          const correctCount = await prisma.attempt.count({
            where: { userId, isCorrect: true }
          });
          if (correctCount >= correctAnswersBadge.threshold) {
            await prisma.userBadge.create({
              data: { userId, badgeId: correctAnswersBadge.id }
            });
            newBadges.push(`${correctAnswersBadge.iconUrl} ${correctAnswersBadge.name}`);
          }
        }

        // 4. Gritの達人 check
        const gritBadge = dbBadges.find(b => b.name === 'Gritの達人');
        if (gritBadge && !earnedBadgeNames.includes('Gritの達人')) {
          const allDbAttemptsForUser = await prisma.attempt.findMany({ where: { userId } });
          const gritAttempts = allDbAttemptsForUser.filter(a => a.hintsUsed >= 1);
          const gritSuccess = gritAttempts.filter(a => a.isCorrect);
          const gritScore = gritAttempts.length > 0 ? Math.round((gritSuccess.length / gritAttempts.length) * 100) : 0;
          if (allDbAttemptsForUser.length >= 5 && gritAttempts.length >= 1 && gritScore >= 90) {
            await prisma.userBadge.create({
              data: { userId, badgeId: gritBadge.id }
            });
            newBadges.push(`${gritBadge.iconUrl} ${gritBadge.name}`);
          }
        }

        // 5. 無限の探求者 check
        const explorerBadge = dbBadges.find(b => b.name === '無限の探求者');
        if (explorerBadge && !earnedBadgeNames.includes('無限の探求者')) {
          const allDbAttemptsForUser = await prisma.attempt.findMany({ where: { userId } });
          const totalDurationSeconds = allDbAttemptsForUser.reduce((sum, a) => sum + (a.durationSeconds || 0), 0);
          if (totalDurationSeconds >= 36000) {
            await prisma.userBadge.create({
              data: { userId, badgeId: explorerBadge.id }
            });
            newBadges.push(`${explorerBadge.iconUrl} ${explorerBadge.name}`);
          }
        }

        // 6. ストリークの鬼 check
        const streakDemonBadge = dbBadges.find(b => b.name === 'ストリークの鬼');
        if (streakDemonBadge && currentStreak >= streakDemonBadge.threshold && !earnedBadgeNames.includes('ストリークの鬼')) {
          await prisma.userBadge.create({
            data: { userId, badgeId: streakDemonBadge.id }
          });
          newBadges.push(`${streakDemonBadge.iconUrl} ${streakDemonBadge.name}`);
        }

        // 7. 完璧主義者 check
        const perfectionistBadge = dbBadges.find(b => b.name === '完璧主義者');
        if (perfectionistBadge && !earnedBadgeNames.includes('完璧主義者')) {
          const allDbAttemptsForUser = await prisma.attempt.findMany({ where: { userId } });
          const sortedAttempts = [...allDbAttemptsForUser].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          let consecutiveCorrect = 0;
          let maxConsecutiveCorrect = 0;
          for (const a of sortedAttempts) {
            if (a.isCorrect) {
              consecutiveCorrect++;
              if (consecutiveCorrect > maxConsecutiveCorrect) {
                maxConsecutiveCorrect = consecutiveCorrect;
              }
            } else {
              consecutiveCorrect = 0;
            }
          }
          if (maxConsecutiveCorrect >= perfectionistBadge.threshold) {
            await prisma.userBadge.create({
              data: { userId, badgeId: perfectionistBadge.id }
            });
            newBadges.push(`${perfectionistBadge.iconUrl} ${perfectionistBadge.name}`);
          }
        }

        // Retrieve final complete badges list formatted for UI
        const finalUserBadges = await prisma.userBadge.findMany({
          where: { userId },
          include: { badge: true }
        });
        updatedBadgesList = finalUserBadges.map(ub => `${ub.badge.iconUrl} ${ub.badge.name}`);

      } catch (dbError) {
        console.error('❌ Error updating DB stats. Falling back to in-memory Mock DB values for response.', dbError);
        // Fallback response updates as mock so client doesn't break
        mockDb.createAttempt({
          userId,
          questionId: parsed.questionId,
          isCorrect,
          hintsUsed: parsed.hintsUsed,
          answerSubmitted: parsed.answerSubmitted,
          durationSeconds: parsed.durationSeconds,
        });
        updatedBadgesList = user.badges || [];
      }
    }

    res.json({
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
        isMock: !!isMock
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

const hintSchema = z.object({
  questionId: z.string(),
  hintsUsed: z.number().int().nonnegative(),
  userQuestion: z.string().optional(),
});

const hintCache = new AiResponseCache(24 * 60 * 60 * 1000); // 24 hours TTL
const lastHintRequestTimes = new Map<string, number>();

router.post('/hint', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = hintSchema.parse(req.body);
    const userId = req.userId!;
    const nextStage = (Math.min(3, Math.max(1, parsed.hintsUsed + 1))) as 1 | 2 | 3;

    // --- 1. 連投制限 (Rate Limit - 3s) ---
    const now = Date.now();
    const lastRequestTime = lastHintRequestTimes.get(userId);
    if (process.env.NODE_ENV !== 'test' && lastRequestTime && now - lastRequestTime < 3000) {
      res.json({
        hintText: "**うわっ、ちょっと早すぎるよ！落ち着いて、少し時間を置いてからもう一度聞いてね 🧅**",
        stage: parsed.hintsUsed,
        fromCache: false,
        rateLimited: true
      });
      return;
    }
    lastHintRequestTimes.set(userId, now);

    // --- 2. Abuse不適切入力検知 ---
    if (parsed.userQuestion && SafetyFilter.isAbusive(parsed.userQuestion)) {
      res.json({
        hintText: "**ラッキョくんとはお勉強のお話をしてほしいな！いっしょに問題を解いてみよう 🧅**",
        stage: parsed.hintsUsed,
        fromCache: false,
        isAbusive: true
      });
      return;
    }

    // Bypass cache check if userQuestion is provided to ensure dynamic, real-time responses
    if (!parsed.userQuestion) {
      const cached = hintCache.get(userId, parsed.questionId, nextStage);
      if (cached) {
        res.json({
          hintText: cached.hintText,
          stage: cached.stage,
          fromCache: true
        });
        return;
      }
    }

    let subjectCode = 'math';
    let foundQuestion = null;
    if (!req.isMock) {
      try {
        foundQuestion = await prisma.question.findUnique({
          where: { id: parsed.questionId },
          include: {
            lesson: {
              include: {
                unit: {
                  include: {
                    subject: true
                  }
                }
              }
            }
          }
        });
        if (foundQuestion && (foundQuestion as any).lesson?.unit?.subject?.code) {
          subjectCode = (foundQuestion as any).lesson.unit.subject.code;
        }
      } catch (dbError) {
        console.warn('⚠️ DB query failed for hint question. Falling back to local curriculum.');
      }
    }

    if (!foundQuestion) {
      for (const curriculum of allCurriculums) {
        for (const unit of curriculum.units) {
          for (const lesson of unit.lessons) {
            const q = lesson.questions.find(
              quest => quest.id === parsed.questionId || quest.prompt === parsed.questionId
            );
            if (q) {
              foundQuestion = q;
              subjectCode = curriculum.code;
              break;
            }
          }
          if (foundQuestion) break;
        }
        if (foundQuestion) break;
      }
    }

    if (!foundQuestion) {
      res.status(404).json({ error: '対象の問題が見つかりません。' });
      return;
    }

    // --- 3. AIコスト上限とフォールバック (Cost Control) ---
    const rawMax = process.env.MAX_AI_HINTS_PER_DAY;
    const maxHintsPerDay = (rawMax !== undefined && rawMax !== 'undefined' && rawMax !== '')
      ? Number(rawMax)
      : 20;
    let isMock = req.isMock || false;
    const todayStr = new Date().toISOString().split('T')[0];

    let aiHintCountToday = 0;
    let lastAiHintDate = '';

    if (!isMock) {
      try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user) {
          aiHintCountToday = user.aiHintCountToday;
          lastAiHintDate = user.lastAiHintDate || '';
        }
      } catch (dbError) {
        console.warn('⚠️ DB query failed for User. Falling back to Mock DB.');
        isMock = true;
      }
    }

    if (isMock) {
      const mockUser = mockDb.findUserById(userId);
      if (mockUser) {
        aiHintCountToday = mockUser.aiHintCountToday;
        lastAiHintDate = mockUser.lastAiHintDate || '';
      }
    }

    // 日付が変わっていれば本日のカウントはリセット
    if (lastAiHintDate !== todayStr) {
      aiHintCountToday = 0;
    }

    if (aiHintCountToday >= maxHintsPerDay) {
      // 静的ヒントにフォールバック
      const staticHints = foundQuestion.hints || [];
      const stageIdx = parsed.hintsUsed; // 0, 1, 2
      let staticHintText = "いっしょに考えてみよう！もう一度問題をよく読んでみてね。";
      if (staticHints.length > 0) {
        const idx = Math.min(staticHints.length - 1, stageIdx);
        staticHintText = staticHints[idx];
      }

      res.json({
        hintText: `**今日はたくさんラッキョくんとお勉強したね！AIヒントはお休みだけど、代わりに問題のヒントをあげるよ。いっしょにがんばろう！ 🧅**\n\n${staticHintText}`,
        stage: nextStage,
        fromCache: false,
        limitExceeded: true
      });
      return;
    }

    // Input PII sanitization at API level
    const sanitizedPrompt = SafetyFilter.sanitizeInput(foundQuestion.prompt);

    const provider = AiTutorProviderFactory.getProvider();
    const result = await provider.generateHint({
      prompt: sanitizedPrompt,
      explanation: foundQuestion.explanation,
      answers: foundQuestion.answers,
      hintsUsed: parsed.hintsUsed,
      staticHints: foundQuestion.hints,
      subjectCode,
      userQuestion: parsed.userQuestion,
      isSocratic: parsed.hintsUsed >= 2
    });

    // AI呼び出しが成功したため、使用回数を更新
    const newCount = lastAiHintDate === todayStr ? aiHintCountToday + 1 : 1;
    if (!isMock) {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: {
            aiHintCountToday: newCount,
            lastAiHintDate: todayStr
          }
        });
      } catch (dbError) {
        console.error('Failed to update user AI count in DB:', dbError);
      }
    } else {
      mockDb.updateUser(userId, {
        aiHintCountToday: newCount,
        lastAiHintDate: todayStr
      });
    }

    if (!parsed.userQuestion) {
      hintCache.set(userId, parsed.questionId, nextStage, result.hintText);
    }

    res.json({
      hintText: result.hintText,
      stage: result.stage,
      fromCache: false,
      isMock: result.isMock,
      aiHintCountToday: newCount
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Lessons hint error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  }
});

interface QuestionDetails {
  id: string;
  type: string;
  prompt: string;
  answers: string[];
  options: string[];
  explanation: string;
  hints: string[];
  lessonId: string;
  lessonName: string;
  unitId: string;
  unitName: string;
}

// Helper to get all questions from Prisma or Curriculum static data
async function getAllQuestions(isMock: boolean, subjectCode?: string): Promise<QuestionDetails[]> {
  const list: QuestionDetails[] = [];
  if (!isMock) {
    try {
      const dbUnits = await prisma.unit.findMany({
        where: subjectCode ? { subject: { code: subjectCode } } : undefined,
        include: {
          lessons: {
            include: {
              questions: true
            }
          }
        }
      });
      for (const unit of dbUnits) {
        for (const lesson of unit.lessons) {
          for (const q of lesson.questions) {
            list.push({
              id: q.id,
              type: q.type,
              prompt: q.prompt,
              answers: q.answers,
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
      if (list.length > 0) return list;
    } catch (e) {
      console.warn('⚠️ DB failed in getAllQuestions, falling back to static curriculum.');
    }
  }

  // Fallback to curriculum
  const targetCurriculums = subjectCode 
    ? allCurriculums.filter(c => c.code === subjectCode)
    : allCurriculums;

  for (const curriculum of targetCurriculums) {
    for (const unit of curriculum.units) {
      for (const lesson of unit.lessons) {
        for (const q of lesson.questions) {
          const qId = q.id || q.prompt;
          list.push({
            id: qId,
            type: q.type,
            prompt: q.prompt,
            answers: q.answers,
            options: q.options,
            explanation: q.explanation,
            hints: q.hints,
            lessonId: lesson.name, // Fake lessonId
            lessonName: lesson.name,
            unitId: unit.name, // Fake unitId
            unitName: unit.name
          });
        }
      }
    }
  }
  return list;
}

router.get('/quests', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const isMock = req.isMock;
    const now = new Date();
    const todayStr = getJstDateString(now);

    let attempts: any[] = [];
    if (isMock) {
      attempts = mockDb.getUserAttempts(userId);
    } else {
      try {
        attempts = await prisma.attempt.findMany({ where: { userId } });
      } catch (e) {
        attempts = mockDb.getUserAttempts(userId);
      }
    }

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

// Progress Engine API
router.get('/progress', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const isMock = !!req.isMock;
    const subjectCode = req.query.subject as string | undefined;

    let attempts: any[] = [];
    if (!isMock) {
      try {
        attempts = await prisma.attempt.findMany({
          where: {
            userId,
            question: subjectCode ? {
              lesson: {
                unit: {
                  subject: {
                    code: subjectCode
                  }
                }
              }
            } : undefined
          },
          orderBy: { createdAt: 'asc' }
        });
      } catch (e) {
        console.warn('⚠️ DB attempts fetch failed, falling back to mockDb.');
        attempts = mockDb.getUserAttempts(userId);
      }
    } else {
      attempts = mockDb.getUserAttempts(userId);
    }

    if (subjectCode && (isMock || attempts.length > 0)) {
      const allSubjectQuestions = await getAllQuestions(isMock, subjectCode);
      const subjectQuestionIds = new Set(allSubjectQuestions.map(q => q.id));
      attempts = attempts.filter(att => subjectQuestionIds.has(att.questionId));
    }

    // Group attempts by questionId to find the latest attempt for each question
    const latestAttempts = new Map<string, any>();
    for (const attempt of attempts) {
      latestAttempts.set(attempt.questionId, attempt);
    }

    // Dynamic curriculum structures to return
    let rawUnits: any[] = [];
    if (!isMock) {
      try {
        rawUnits = await prisma.unit.findMany({
          where: subjectCode ? { subject: { code: subjectCode } } : undefined,
          include: {
            lessons: {
              include: {
                questions: true
              }
            }
          },
          orderBy: { order: 'asc' }
        });
      } catch (e) {
        console.warn('⚠️ DB units fetch failed, falling back to static.');
      }
    }

    // Fallback units configuration
    if (rawUnits.length === 0) {
      const targetCurriculums = subjectCode 
        ? allCurriculums.filter(c => c.code === subjectCode)
        : allCurriculums;

      rawUnits = [];
      for (const curriculum of targetCurriculums) {
        const curriculumUnits = curriculum.units.map(u => ({
          id: u.name,
          name: u.name,
          order: u.order,
          description: u.description,
          lessons: u.lessons.map(l => ({
            id: l.name,
            name: l.name,
            order: l.order,
            questions: l.questions.map(q => ({
              id: q.id || q.prompt,
              type: q.type,
              prompt: q.prompt,
              answers: q.answers,
              options: q.options,
              explanation: q.explanation,
              hints: q.hints
            }))
          }))
        }));
        rawUnits.push(...curriculumUnits);
      }
    }

    // Calculate progress
    const unitsProgress = rawUnits.map(unit => {
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

// Review Scheduler API
router.get('/reviews', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const isMock = !!req.isMock;
    const subjectCode = req.query.subject as string | undefined;

    let attempts: any[] = [];
    if (!isMock) {
      try {
        attempts = await prisma.attempt.findMany({
          where: {
            userId,
            question: subjectCode ? {
              lesson: {
                unit: {
                  subject: {
                    code: subjectCode
                  }
                }
              }
            } : undefined
          },
          orderBy: { createdAt: 'asc' }
        });
      } catch (e) {
        console.warn('⚠️ DB attempts fetch failed, falling back to mockDb.');
        attempts = mockDb.getUserAttempts(userId);
      }
    } else {
      attempts = mockDb.getUserAttempts(userId);
    }

    if (subjectCode && (isMock || attempts.length > 0)) {
      const allSubjectQuestions = await getAllQuestions(isMock, subjectCode);
      const subjectQuestionIds = new Set(allSubjectQuestions.map(q => q.id));
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

    // Retrieve full question details for candidates
    const allQuestions = await getAllQuestions(isMock, subjectCode);
    
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

// Administrative endpoint to clear AI tutor hints cache
router.post('/hint/cache/clear', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    hintCache.clear();
    res.json({
      message: 'AIチューターのヒントキャッシュをすべてクリアしました。',
      success: true
    });
  } catch (error) {
    console.error('Lessons cache clear error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  }
});

// 3. POST /lessons/recommend-similar
router.post('/recommend-similar', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const isMock = !!req.isMock;
    const { questionId } = z.object({ questionId: z.string() }).parse(req.body);

    let foundQuestion: any = null;
    let latestAttempt: any = null;

    if (!isMock) {
      try {
        foundQuestion = await prisma.question.findUnique({ where: { id: questionId } });
        latestAttempt = await prisma.attempt.findFirst({
          where: { userId, questionId },
          orderBy: { createdAt: 'desc' }
        });
      } catch (e) {
        console.warn('DB search failed in recommend-similar, falling back to static/mock.');
      }
    }

    if (!foundQuestion) {
      // Search in curriculum
      for (const curriculum of allCurriculums) {
        for (const unit of curriculum.units) {
          for (const lesson of unit.lessons) {
            const q = lesson.questions.find(quest => quest.id === questionId || quest.prompt === questionId);
            if (q) {
              foundQuestion = q;
              break;
            }
          }
          if (foundQuestion) break;
        }
        if (foundQuestion) break;
      }
      latestAttempt = mockDb.getUserAttempts(userId)
        .filter(a => a.questionId === questionId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    }

    if (!foundQuestion) {
      res.status(404).json({ error: '元の問題が見つかりませんでした。' });
      return;
    }

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

    let savedQuestion: any = null;
    if (!isMock) {
      try {
        // Find a lesson to associate the dynamic question with
        const firstLesson = await prisma.lesson.findFirst();
        savedQuestion = await prisma.question.create({
          data: {
            lessonId: foundQuestion.lessonId || firstLesson?.id || 'dynamic-lesson',
            type: foundQuestion.type || 'NUMBER_INPUT',
            prompt: similarQResult.prompt,
            answers: similarQResult.answers,
            options: similarQResult.options,
            explanation: similarQResult.explanation,
            hints: similarQResult.hints,
            isDynamic: true
          }
        });
      } catch (e) {
        console.error('Failed to save dynamic question to DB, falling back to mock:', e);
        savedQuestion = mockDb.createDynamicQuestion(similarQResult);
      }
    } else {
      savedQuestion = mockDb.createDynamicQuestion(similarQResult);
    }

    res.json(savedQuestion);
  } catch (error) {
    console.error('Recommend similar question error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  }
});

// 4. GET /lessons/recommendations
router.get('/recommendations', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const user = req.user;
    const isMock = !!req.isMock;

    let attempts: AttemptSummary[] = [];
    if (!isMock) {
      try {
        const dbAttempts = await prisma.attempt.findMany({
          where: { userId },
          include: { question: { include: { lesson: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10
        });
        attempts = dbAttempts.map(a => ({
          lessonId: a.question?.lessonId || 'unknown',
          lessonName: a.question?.lesson?.name || 'unknown',
          isCorrect: a.isCorrect,
          hintsUsed: a.hintsUsed,
          errorType: a.errorType,
          aiDiagnosis: a.aiDiagnosis,
          createdAt: a.createdAt.toISOString()
        }));
      } catch (e) {
        console.warn('Failed to fetch DB attempts for recommendation, falling back to mockDb.');
      }
    }

    if (attempts.length === 0) {
      const mockAttempts = mockDb.getUserAttempts(userId);
      attempts = mockAttempts.map(a => ({
        lessonId: 'lesson-1', // Mock association
        lessonName: '正負の数の計算',
        isCorrect: a.isCorrect,
        hintsUsed: a.hintsUsed,
        errorType: a.errorType,
        aiDiagnosis: a.aiDiagnosis,
        createdAt: a.createdAt
      }));
    }

    // Collect available lessons
    const availableLessons: { id: string; name: string; unitName: string }[] = [];
    if (!isMock) {
      try {
        const dbLessons = await prisma.lesson.findMany({
          include: { unit: true },
          take: 5
        });
        dbLessons.forEach(l => {
          availableLessons.push({
            id: l.id,
            name: l.name,
            unitName: l.unit.name
          });
        });
      } catch (e) {
        console.warn('DB lessons fetch failed for recommendation, using static.');
      }
    }

    if (availableLessons.length === 0) {
      // Use static curriculums
      for (const curriculum of allCurriculums) {
        for (const unit of curriculum.units) {
          for (const lesson of unit.lessons) {
            availableLessons.push({
              id: lesson.name, // Fake ID
              name: lesson.name,
              unitName: unit.name
            });
          }
        }
      }
    }

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
