import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../db';
import { mockDb } from '../mockDb';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth';
import { mathGrade1Curriculum } from '@rakkyo/curriculum';
import { GeminiAiTutorProvider } from '@rakkyo/ai-tutor';

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
      for (const unit of mathGrade1Curriculum.units) {
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

    // 3. Process XP and Level Ups if Correct
    let currentXp = user.currentXp || 0;
    let currentLevel = user.level || 1;
    let leveledUp = false;
    
    // Bonus XP: +15 XP for review completion. Normal: 10 XP. Total review: 25 XP.
    const xpAwarded = isCorrect ? (parsed.isReview ? 25 : 10) : 0;

    if (isCorrect) {
      currentXp += xpAwarded;
      let xpNeeded = currentLevel * 100;
      while (currentXp >= xpNeeded) {
        currentXp -= xpNeeded;
        currentLevel += 1;
        leveledUp = true;
        xpNeeded = currentLevel * 100;
      }
    }

    // 4. Badges awarding logic
    const newBadges: string[] = [];
    let updatedBadgesList: string[] = [];

    if (isMock) {
      // Mock Badge check
      const currentBadges = user.badges || [];
      updatedBadgesList = [...currentBadges];

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
      const correctAttempts = mockDb.getUserAttempts(userId).filter(a => a.isCorrect).length + (isCorrect ? 1 : 0);
      if (correctAttempts >= 5 && !updatedBadgesList.includes('📐 数学マスターの卵')) {
        updatedBadgesList.push('📐 数学マスターの卵');
        newBadges.push('📐 数学マスターの卵');
      }

      // Save updates to mock database
      mockDb.updateUser(userId, {
        currentXp,
        level: currentLevel,
        streakCount: currentStreak,
        lastActiveDate: now.toISOString(),
        badges: updatedBadgesList
      });

      mockDb.createAttempt({
        userId,
        questionId: parsed.questionId,
        isCorrect,
        hintsUsed: parsed.hintsUsed,
        answerSubmitted: parsed.answerSubmitted,
        durationSeconds: parsed.durationSeconds,
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
      leveledUp,
      newBadges,
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
});

const hintCache = new Map<string, { hintText: string; generatedAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const aiTutorProvider = new GeminiAiTutorProvider();

router.post('/hint', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = hintSchema.parse(req.body);
    const userId = req.userId!;

    const cacheKey = `${userId}_${parsed.questionId}_${parsed.hintsUsed}`;
    const cached = hintCache.get(cacheKey);
    if (cached && (Date.now() - cached.generatedAt) < CACHE_TTL_MS) {
      res.json({
        hintText: cached.hintText,
        stage: Math.min(3, parsed.hintsUsed + 1),
        fromCache: true
      });
      return;
    }

    let foundQuestion = null;
    if (!req.isMock) {
      try {
        foundQuestion = await prisma.question.findUnique({
          where: { id: parsed.questionId }
        });
      } catch (dbError) {
        console.warn('⚠️ DB query failed for hint question. Falling back to local curriculum.');
      }
    }

    if (!foundQuestion) {
      for (const unit of mathGrade1Curriculum.units) {
        for (const lesson of unit.lessons) {
          const q = lesson.questions.find(
            quest => quest.id === parsed.questionId || quest.prompt === parsed.questionId
          );
          if (q) {
            foundQuestion = q;
            break;
          }
        }
        if (foundQuestion) break;
      }
    }

    if (!foundQuestion) {
      res.status(404).json({ error: '対象の問題が見つかりません。' });
      return;
    }

    const result = await aiTutorProvider.generateHint({
      prompt: foundQuestion.prompt,
      explanation: foundQuestion.explanation,
      answers: foundQuestion.answers,
      hintsUsed: parsed.hintsUsed,
      staticHints: foundQuestion.hints
    });

    hintCache.set(cacheKey, {
      hintText: result.hintText,
      generatedAt: Date.now()
    });

    res.json({
      hintText: result.hintText,
      stage: result.stage,
      fromCache: false,
      isMock: result.isMock
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
async function getAllQuestions(isMock: boolean): Promise<QuestionDetails[]> {
  const list: QuestionDetails[] = [];
  if (!isMock) {
    try {
      const dbUnits = await prisma.unit.findMany({
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
  for (const unit of mathGrade1Curriculum.units) {
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
  return list;
}

// Progress Engine API
router.get('/progress', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
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
      } catch (e) {
        console.warn('⚠️ DB attempts fetch failed, falling back to mockDb.');
        attempts = mockDb.getUserAttempts(userId);
      }
    } else {
      attempts = mockDb.getUserAttempts(userId);
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
      rawUnits = mathGrade1Curriculum.units.map(u => ({
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

    let attempts: any[] = [];
    if (!isMock) {
      try {
        attempts = await prisma.attempt.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' }
        });
      } catch (e) {
        console.warn('⚠️ DB attempts fetch failed, falling back to mockDb.');
        attempts = mockDb.getUserAttempts(userId);
      }
    } else {
      attempts = mockDb.getUserAttempts(userId);
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
    const allQuestions = await getAllQuestions(isMock);
    
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

export default router;
