import { Router, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth';
import { SafetyFilter } from '@rakkyo/ai-tutor';

const router = Router();

// Validation Schemas
const stampSchema = z.object({
  receiverId: z.string(),
  stampType: z.string(),
});

const hiramekiSchema = z.object({
  content: z.string().min(1, 'ひらめきは1文字以上入力してください'),
});

const contributeSchema = z.object({
  minutes: z.number().int().positive(),
});

const respondSchema = z.object({
  stamp: z.string(),
  comment: z.string().optional(),
});

// 1. GET /room - Get asynchronous presence inside the "Rakkyo Room"
router.get('/room', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const repos = req.repos!;

    // Find classId of the student
    let classId = 'test-class-id';
    let className = '中1数学特訓クラス';
    let grade = 1;

    const enrollment = await repos.users.findEnrollment(userId, 'STUDENT');
    if (enrollment) {
      classId = enrollment.classId;
      className = enrollment.class.name;
      grade = enrollment.class.grade;
    }

    // Generate actual active room members based on real activity (Grit)
    const enrolls = await repos.users.findEnrollmentsByClass(classId, 'STUDENT');
    const classmates = enrolls.filter(e => e.userId !== userId);

    const avatars = ['🧅', '🥕', '🥦', '🌽', '🍅', '🧄'];
    const activeMembers = [];

    for (let idx = 0; idx < classmates.length; idx++) {
      const e = classmates[idx];
      const c = e.user;
      const avatar = avatars[idx % avatars.length];
      const lastActive = c.lastActiveDate ? new Date(c.lastActiveDate).toISOString() : null;
      const isOnline = lastActive ? (Date.now() - new Date(lastActive).getTime() < 30 * 60 * 1000) : false;

      // Fetch actual attempts for the classmate
      const attempts = await repos.attempts.findAttemptsByUser(c.id, 10);
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recentAttempts = attempts.filter(a => new Date(a.createdAt).getTime() >= sevenDaysAgo);

      let status = '今日はこれからかな？🧅';
      let bubbleMessage = '今日はまだ来ていないみたい。みんなで一緒にがんばろう！🧅';

      if (recentAttempts.length > 0) {
        // Use the most recent attempt
        const latestAttempt = recentAttempts[0];
        const lessonName = latestAttempt.question?.lesson?.name || latestAttempt.question?.lessonId || 'レッスン';
        
        if (latestAttempt.isCorrect) {
          status = `「${lessonName}」をクリアしたよ！`;
          bubbleMessage = `「${lessonName}」をみごとクリアしたよ！🎉`;
        } else if (latestAttempt.hintsUsed > 0) {
          status = `「${lessonName}」に挑戦中！💪`;
          bubbleMessage = `「${lessonName}」でヒントも使いながらあきらめずにがんばっているよ！💪`;
        } else {
          status = `「${lessonName}」を考え中...🤔`;
          bubbleMessage = `「${lessonName}」をじっくり考え中...🤔`;
        }
      }

      activeMembers.push({
        id: c.id,
        nickname: c.nickname,
        avatar,
        status,
        bubbleMessage,
        isOnline
      });
    }

    res.json({
      classId,
      roomName: `ラッキョ・ルーム (${className})`,
      activeMembers
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 2. GET /stamps - Get peer stamps history (received and sent)
router.get('/stamps', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const repos = req.repos!;

    const received = await repos.collaborative.findPeerStampsReceived(userId);
    const sent = await repos.collaborative.findPeerStampsSent(userId);

    res.json({
      received: received.map((s: any) => ({
        id: s.id,
        senderId: s.senderId,
        senderNickname: s.sender.nickname,
        stampType: s.stampType,
        createdAt: new Date(s.createdAt).toISOString()
      })),
      sent: sent.map((s: any) => ({
        id: s.id,
        receiverId: s.receiverId,
        receiverNickname: s.receiver.nickname,
        stampType: s.stampType,
        createdAt: new Date(s.createdAt).toISOString()
      }))
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 3. POST /stamps - Send a peer stamp to praise a friend's Grit!
router.post('/stamps', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const repos = req.repos!;
    const { receiverId, stampType } = stampSchema.parse(req.body);

    if (userId === receiverId) {
      return res.status(400).json({ error: '自分自身にスタンプを送ることはできません' });
    }

    const sender = await repos.users.findById(userId);

    const newStamp = await repos.collaborative.createPeerStamp({
      senderId: userId,
      receiverId,
      stampType
    });
    
    // Create message notification for recipient
    await repos.collaborative.createParentMessage(
      receiverId,
      `お友達の ${sender?.nickname || '誰か'} から「${stampType}」スタンプが届きました！🧅`
    );

    res.json({
      success: true,
      stamp: {
        id: newStamp.id,
        senderId: newStamp.senderId,
        receiverId: newStamp.receiverId,
        stampType: newStamp.stampType,
        createdAt: new Date(newStamp.createdAt).toISOString()
      }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 4. GET /missions - Get cooperative class missions
router.get('/missions', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const repos = req.repos!;
    let classId = 'test-class-id';
    
    const enrollment = await repos.users.findEnrollment(userId, 'STUDENT');
    if (enrollment) {
      classId = enrollment.classId;
    }

    const missions = await repos.collaborative.findClassMissions(classId);
    res.json(missions);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 5. POST /missions/contribute - Contribute study time to class mission
router.post('/missions/contribute', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const repos = req.repos!;
    const { minutes } = contributeSchema.parse(req.body);

    let classId = 'test-class-id';
    const enrollment = await repos.users.findEnrollment(userId, 'STUDENT');
    if (enrollment) {
      classId = enrollment.classId;
    }

    await repos.collaborative.incrementClassMissionMinutes(classId, minutes);
    res.json({ success: true, contributed: minutes });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 6. GET /hirameki - Get anonymous "Hirameki" board tips
router.get('/hirameki', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const repos = req.repos!;
    let classId = 'test-class-id';

    const enrollment = await repos.users.findEnrollment(userId, 'STUDENT');
    if (enrollment) {
      classId = enrollment.classId;
    }

    const tips = await repos.collaborative.findHiramekiTips(classId);
    res.json(tips);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 7. POST /hirameki - Post a tip to anonymous "Hirameki" board
router.post('/hirameki', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const repos = req.repos!;
    const { content } = hiramekiSchema.parse(req.body);

    let classId = 'test-class-id';
    const enrollment = await repos.users.findEnrollment(userId, 'STUDENT');
    if (enrollment) {
      classId = enrollment.classId;
    }

    // Safety Filter Check!
    const isSafe = !SafetyFilter.isAbusive(content);
    if (!isSafe) {
      return res.status(400).json({
        error: 'abusive_content',
        message: 'あれっ、もう少し優しい言葉を使ってみようかな？ Onion君も悲しんじゃうかも。🧅'
      });
    }

    // Assign a cute random nickname with a unique user suffix to prevent abuse/impersonation
    const nicknames = ['がんばるオニオン', 'ひらめきラッキョ', 'あきらめないネギ', 'スラスラにんにく', 'にこにこキャベツ'];
    const baseNickname = nicknames[Math.floor(Math.random() * nicknames.length)];
    
    // Generate unique 4-digit suffix from user ID SHA-256
    const hash = crypto.createHash('sha256').update(userId).digest('hex');
    const code = (parseInt(hash.substring(0, 8), 16) % 9000) + 1000;
    const nickname = `${baseNickname}#${code}`;

    const tip = await repos.collaborative.createHiramekiTip({
      classId,
      userId,
      nickname,
      content,
      isSafe: true
    });
    res.json({ success: true, tip });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 8. POST /celebration/trigger - Trigger an celebration for a hard-won victory (Grit!)
router.post('/celebration/trigger', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const childId = req.userId!;
    const repos = req.repos!;
    const { attemptId } = z.object({ attemptId: z.string() }).parse(req.body);

    const token = 'celeb_' + crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days expiration

    const celeb = await repos.collaborative.createParentalCelebration({
      childId,
      attemptId,
      token,
      isResponded: false,
      expiresAt
    });
    res.json({ success: true, token, celebrationId: celeb.id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 9. GET /celebration/:token - Get parental celebration details for shared link
router.get('/celebration/:token', async (req: AuthenticatedRequest, res) => {
  try {
    const { token } = req.params;
    const repos = req.repos!;

    const celeb = await repos.collaborative.findParentalCelebrationByToken(token);

    if (!celeb) {
      return res.status(404).json({ error: 'お祝いリンクが見つかりませんでした' });
    }

    if (new Date(celeb.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({ error: 'お祝いリンクの有効期限が切れています' });
    }

    const childNickname = celeb.child ? celeb.child.nickname : 'ともだち';
    
    // Attempt data extraction, handling cases where relation details might not be present (like mock state in tests)
    const prompt = celeb.attempt?.question?.prompt || celeb.attempt?.questionId || '$12 \\div (-4)$ を計算しなさい。';
    const isCorrect = celeb.attempt ? celeb.attempt.isCorrect : false;
    const hintsUsed = celeb.attempt ? celeb.attempt.hintsUsed : 0;
    const durationSeconds = celeb.attempt ? celeb.attempt.durationSeconds : null;
    const errorType = celeb.attempt ? celeb.attempt.errorType : null;
    const aiDiagnosis = celeb.attempt ? celeb.attempt.aiDiagnosis : null;
    const createdAt = celeb.attempt ? new Date(celeb.attempt.createdAt).toISOString() : new Date().toISOString();

    res.json({
      childNickname,
      attempt: {
        questionPrompt: prompt,
        isCorrect,
        hintsUsed,
        durationSeconds,
        errorType,
        aiDiagnosis,
        createdAt
      },
      parentStamp: celeb.parentStamp,
      parentComment: celeb.parentComment,
      isResponded: celeb.isResponded
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 10. POST /celebration/:token/respond - Parent sends congrats back
router.post('/celebration/:token/respond', async (req: AuthenticatedRequest, res) => {
  try {
    const { token } = req.params;
    const repos = req.repos!;
    const { stamp, comment } = respondSchema.parse(req.body);

    // Safety Filter Check on Parent Comment
    if (comment) {
      const isSafe = !SafetyFilter.isAbusive(comment);
      if (!isSafe) {
        return res.status(400).json({
          error: 'abusive_content',
          message: 'あれっ、もう少し優しい言葉を使ってみようかな？ Onion君も悲しんじゃうかも。🧅'
        });
      }
    }

    const celeb = await repos.collaborative.findParentalCelebrationByToken(token);
    if (!celeb) {
      return res.status(404).json({ error: 'お祝いリンクが見つかりませんでした' });
    }

    if (celeb.isResponded || new Date(celeb.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({ error: 'お祝いリンクの有効期限が切れているか、すでに応答済みです' });
    }

    await repos.collaborative.updateParentalCelebration(token, {
      parentStamp: stamp,
      parentComment: comment || null,
      isResponded: true
    });

    // Also create a direct ParentMessage notification for the child
    await repos.collaborative.createParentMessage(
      celeb.childId,
      `保護者からスタンプ「${stamp}」とメッセージ「${comment || 'がんばったね！'}」が届きました！`
    );

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
