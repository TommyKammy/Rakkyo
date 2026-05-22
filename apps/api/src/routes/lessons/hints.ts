import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthenticatedRequest } from '../../middlewares/auth';
import { allCurriculums } from '@rakkyo/curriculum';
import { AiTutorProviderFactory, AiResponseCache, SafetyFilter } from '@rakkyo/ai-tutor';
import { recordAbuseStrike } from '../../utils/abuseTracker';

const router = Router();

const hintSchema = z.object({
  questionId: z.string(),
  hintsUsed: z.number().int().nonnegative(),
  userQuestion: z.string().optional(),
  isSocraticPreferred: z.boolean().optional(),
});

const hintCache = new AiResponseCache(24 * 60 * 60 * 1000); // 24 hours TTL
const lastHintRequestTimes = new Map<string, number>();

router.post('/hint', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = hintSchema.parse(req.body);
    const userId = req.userId!;
    const repos = req.repos!;
    const nextStage = (Math.min(3, Math.max(1, parsed.hintsUsed + 1))) as 1 | 2 | 3;
    const isSocratic = parsed.isSocraticPreferred === true || parsed.hintsUsed >= 2;
    const metaDescription = isSocratic
      ? "いっしょに考えるモードに入ったよ！ここからはラッキョくんが少しずつ問いかけるから、ゆっくり考えてみてね。焦らなくて大丈夫だよ！🧅"
      : undefined;

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
    // NOTE: We intentionally do NOT reset abuseCount on a clean follow-up
    // input. The counter decays purely via the 1-hour rolling window
    // inside recordAbuseStrike, so an attacker cannot alternate
    // abuse/clean to dodge the hard-lock.
    if (parsed.userQuestion && SafetyFilter.isAbusive(parsed.userQuestion)) {
      const strike = await recordAbuseStrike(repos, userId, 'hint');

      if (strike.isLocked) {
        res.json({
          hintText: "**安全確保のため、アカウントが24時間ロックされました。保護者または先生に確認してね 🧅**",
          stage: parsed.hintsUsed,
          fromCache: false,
          isAbusive: true,
          locked: true
        });
        return;
      }

      res.json({
        hintText: `**ラッキョくんとはお勉強のお話をしてほしいな！不適切な入力を続けると、安全のため一時的にロックされるよ（警告: ${strike.newCount}/3）🧅**`,
        stage: parsed.hintsUsed,
        fromCache: false,
        isAbusive: true,
        warningCount: strike.newCount
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
          fromCache: true,
          metaDescription
        });
        return;
      }
    }

    let subjectCode = 'math';
    const foundQuestion = await repos.curriculum.findQuestionById(parsed.questionId);

    if (!foundQuestion) {
      res.status(404).json({ error: '対象の問題が見つかりません。' });
      return;
    }

    // static curriculumから code などを取得するフォールバックロジック
    if (foundQuestion.lesson?.unit?.subject?.code) {
      subjectCode = foundQuestion.lesson.unit.subject.code;
    } else {
      // Find subjectCode in static data
      for (const curriculum of allCurriculums) {
        for (const unit of curriculum.units) {
          for (const lesson of unit.lessons) {
            const q = lesson.questions.find(
              quest => quest.id === parsed.questionId || quest.prompt === parsed.questionId
            );
            if (q) {
              subjectCode = curriculum.code;
              break;
            }
          }
          if (subjectCode !== 'math') break;
        }
        if (subjectCode !== 'math') break;
      }
    }

    // --- 3. AIコスト上限とフォールバック (Cost Control) ---
    const rawMax = process.env.MAX_AI_HINTS_PER_DAY;
    const maxHintsPerDay = (rawMax !== undefined && rawMax !== 'undefined' && rawMax !== '')
      ? Number(rawMax)
      : 20;
    const todayStr = new Date().toISOString().split('T')[0];

    const user = await repos.users.findById(userId);
    let aiHintCountToday = user ? user.aiHintCountToday : 0;
    let lastAiHintDate = user ? (user.lastAiHintDate || '') : '';

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
        limitExceeded: true,
        metaDescription
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
      isSocratic
    });

    // AI呼び出しが成功したため、使用回数を更新
    const newCount = lastAiHintDate === todayStr ? aiHintCountToday + 1 : 1;
    await repos.users.updateUser(userId, {
      aiHintCountToday: newCount,
      lastAiHintDate: todayStr
    });

    if (!parsed.userQuestion) {
      hintCache.set(userId, parsed.questionId, nextStage, result.hintText);
    }

    res.json({
      hintText: result.hintText,
      stage: result.stage,
      fromCache: false,
      isMock: result.isMock,
      aiHintCountToday: newCount,
      metaDescription
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

export default router;
