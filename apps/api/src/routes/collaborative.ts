import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../db';
import { mockDb } from '../mockDb';
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
    const isMock = req.isMock || process.env.NODE_ENV === 'test';

    // Find classId of the student
    let classId = 'test-class-id';
    let className = '中1数学特訓クラス';
    let grade = 1;

    if (!isMock) {
      const enrollment = await prisma.classEnrollment.findFirst({
        where: { userId, role: 'STUDENT' },
        include: { class: true }
      });
      if (enrollment) {
        classId = enrollment.classId;
        className = enrollment.class.name;
        grade = enrollment.class.grade;
      }
    } else {
      const enrollment = mockDb.classEnrollments.find(e => e.userId === userId && e.role === 'STUDENT');
      if (enrollment) {
        const cls = mockDb.classes.find(c => c.id === enrollment.classId);
        if (cls) {
          classId = cls.id;
          className = cls.name;
          grade = cls.grade;
        }
      }
    }

    // Generate simulated active room members
    // We get real classmates who were active recently, and mix with cute simulation states
    let classmates: { id: string; nickname: string; lastActive: string | null }[] = [];

    if (!isMock) {
      const enrolls = await prisma.classEnrollment.findMany({
        where: { classId, role: 'STUDENT', NOT: { userId } },
        include: { user: true }
      });
      classmates = enrolls.map(e => ({
        id: e.user.id,
        nickname: e.user.nickname,
        lastActive: e.user.lastActiveDate ? e.user.lastActiveDate.toISOString() : null
      }));
    } else {
      const enrolls = mockDb.classEnrollments.filter(e => e.classId === classId && e.role === 'STUDENT' && e.userId !== userId);
      classmates = enrolls.map(e => {
        const u = mockDb.findUserById(e.userId);
        return {
          id: e.userId,
          nickname: u ? u.nickname : 'クラスメイト',
          lastActive: u ? u.lastActiveDate : null
        };
      });
    }

    // Add playful active states & avatar
    const avatars = ['🧅', '🥕', '🥦', '🌽', '🍅', '🧄'];
    const simulatedActivities = [
      { status: '方程式に挑戦中！', action: 'を解いているよ！' },
      { status: 'ヒントをみてひらめいた！✨', action: 'でひらめきを得たよ！' },
      { status: 'にがて克服ミッションに挑戦中！💪', action: 'をがんばっているよ！' },
      { status: 'じっくり考え中...🤔', action: 'を考えているよ！' },
      { status: 'レッスンクリア！大はしゃぎ中！🎉', action: 'をクリアしたよ！' }
    ];

    const lessonsList = [
      '正の数と負の数', '文字を使った式', '等式と不等式', '方程式の解き方',
      'be動詞のつかいかた', '一般動詞の会話', '植物の体のつくり', '光と音の性質'
    ];

    const activeMembers = classmates.map((c, idx) => {
      const avatar = avatars[idx % avatars.length];
      const activity = simulatedActivities[(idx + 3) % simulatedActivities.length];
      const lesson = lessonsList[(idx + 2) % lessonsList.length];
      
      return {
        id: c.id,
        nickname: c.nickname,
        avatar,
        status: activity.status,
        bubbleMessage: `今、隣で「${lesson}」${activity.action}`,
        isOnline: c.lastActive ? (Date.now() - new Date(c.lastActive).getTime() < 30 * 60 * 1000) : false
      };
    });

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
    const isMock = req.isMock || process.env.NODE_ENV === 'test';

    if (!isMock) {
      const received = await prisma.peerStamp.findMany({
        where: { receiverId: userId },
        include: { sender: true },
        orderBy: { createdAt: 'desc' }
      });
      const sent = await prisma.peerStamp.findMany({
        where: { senderId: userId },
        include: { receiver: true },
        orderBy: { createdAt: 'desc' }
      });

      res.json({
        received: received.map(s => ({
          id: s.id,
          senderId: s.senderId,
          senderNickname: s.sender.nickname,
          stampType: s.stampType,
          createdAt: s.createdAt.toISOString()
        })),
        sent: sent.map(s => ({
          id: s.id,
          receiverId: s.receiverId,
          receiverNickname: s.receiver.nickname,
          stampType: s.stampType,
          createdAt: s.createdAt.toISOString()
        }))
      });
    } else {
      const received = mockDb.getUserReceivedStamps(userId);
      const sent = mockDb.peerStamps
        .filter(s => s.senderId === userId)
        .map(s => {
          const rec = mockDb.findUserById(s.receiverId);
          return {
            ...s,
            receiverNickname: rec ? rec.nickname : 'ともだち'
          };
        });

      res.json({ received, sent });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 3. POST /stamps - Send a peer stamp to praise a friend's Grit!
router.post('/stamps', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const isMock = req.isMock || process.env.NODE_ENV === 'test';
    const { receiverId, stampType } = stampSchema.parse(req.body);

    if (userId === receiverId) {
      return res.status(400).json({ error: '自分自身にスタンプを送ることはできません' });
    }

    if (!isMock) {
      const newStamp = await prisma.peerStamp.create({
        data: {
          senderId: userId,
          receiverId,
          stampType
        },
        include: { receiver: true }
      });
      
      // Create message notification for recipient
      const sender = await prisma.user.findUnique({ where: { id: userId } });
      await prisma.parentMessage.create({
        data: {
          userId: receiverId,
          message: `お友達の ${sender?.nickname || '誰か'} から「${stampType}」スタンプが届きました！🧅`,
          isRead: false
        }
      });

      res.json({
        success: true,
        stamp: {
          id: newStamp.id,
          senderId: newStamp.senderId,
          receiverId: newStamp.receiverId,
          stampType: newStamp.stampType,
          createdAt: newStamp.createdAt.toISOString()
        }
      });
    } else {
      const stamp = mockDb.createPeerStamp(userId, receiverId, stampType);
      const sender = mockDb.findUserById(userId);
      // Create message notification for recipient
      mockDb.createParentMessage(receiverId, `お友達の ${sender?.nickname || '誰か'} から「${stampType}」スタンプが届きました！🧅`);

      res.json({ success: true, stamp });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 4. GET /missions - Get cooperative class missions
router.get('/missions', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const isMock = req.isMock || process.env.NODE_ENV === 'test';

    let classId = 'test-class-id';
    if (!isMock) {
      const enrollment = await prisma.classEnrollment.findFirst({
        where: { userId, role: 'STUDENT' }
      });
      if (enrollment) {
        classId = enrollment.classId;
      }
    } else {
      const enrollment = mockDb.classEnrollments.find(e => e.userId === userId && e.role === 'STUDENT');
      if (enrollment) {
        classId = enrollment.classId;
      }
    }

    if (!isMock) {
      const missions = await prisma.classMission.findMany({
        where: { classId },
        orderBy: { createdAt: 'desc' }
      });
      res.json(missions);
    } else {
      const missions = mockDb.getClassMissions(classId);
      res.json(missions);
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 5. POST /missions/contribute - Contribute study time to class mission
router.post('/missions/contribute', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const isMock = req.isMock || process.env.NODE_ENV === 'test';
    const { minutes } = contributeSchema.parse(req.body);

    let classId = 'test-class-id';
    if (!isMock) {
      const enrollment = await prisma.classEnrollment.findFirst({
        where: { userId, role: 'STUDENT' }
      });
      if (enrollment) {
        classId = enrollment.classId;
      }
    } else {
      const enrollment = mockDb.classEnrollments.find(e => e.userId === userId && e.role === 'STUDENT');
      if (enrollment) {
        classId = enrollment.classId;
      }
    }

    if (!isMock) {
      const missions = await prisma.classMission.findMany({ where: { classId } });
      if (missions.length > 0) {
        await prisma.classMission.updateMany({
          where: { classId },
          data: {
            currentMinutes: {
              increment: minutes
            }
          }
        });
      }
      res.json({ success: true, contributed: minutes });
    } else {
      const success = mockDb.contributeToClassMission(classId, minutes);
      res.json({ success, contributed: minutes });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 6. GET /hirameki - Get anonymous "Hirameki" board tips
router.get('/hirameki', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const isMock = req.isMock || process.env.NODE_ENV === 'test';

    let classId = 'test-class-id';
    if (!isMock) {
      const enrollment = await prisma.classEnrollment.findFirst({
        where: { userId, role: 'STUDENT' }
      });
      if (enrollment) {
        classId = enrollment.classId;
      }
    } else {
      const enrollment = mockDb.classEnrollments.find(e => e.userId === userId && e.role === 'STUDENT');
      if (enrollment) {
        classId = enrollment.classId;
      }
    }

    if (!isMock) {
      const tips = await prisma.hiramekiTip.findMany({
        where: { classId, isSafe: true },
        orderBy: { createdAt: 'desc' }
      });
      res.json(tips);
    } else {
      const tips = mockDb.getClassHiramekiTips(classId);
      res.json(tips);
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 7. POST /hirameki - Post a tip to anonymous "Hirameki" board
router.post('/hirameki', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const isMock = req.isMock || process.env.NODE_ENV === 'test';
    const { content } = hiramekiSchema.parse(req.body);

    let classId = 'test-class-id';
    if (!isMock) {
      const enrollment = await prisma.classEnrollment.findFirst({
        where: { userId, role: 'STUDENT' }
      });
      if (enrollment) {
        classId = enrollment.classId;
      }
    } else {
      const enrollment = mockDb.classEnrollments.find(e => e.userId === userId && e.role === 'STUDENT');
      if (enrollment) {
        classId = enrollment.classId;
      }
    }

    // Safety Filter Check!
    const isSafe = !SafetyFilter.isAbusive(content);
    if (!isSafe) {
      return res.status(400).json({
        error: 'abusive_content',
        message: 'あれっ、もう少し優しい言葉を使ってみようかな？ Onion君も悲しんじゃうかも。🧅'
      });
    }

    // Assign a cute random nickname
    const nicknames = ['がんばるオニオン', 'ひらめきラッキョ', 'あきらめないネギ', 'スラスラにんにく', 'にこにこキャベツ'];
    const nickname = nicknames[Math.floor(Math.random() * nicknames.length)];

    if (!isMock) {
      const tip = await prisma.hiramekiTip.create({
        data: {
          classId,
          userId,
          nickname,
          content,
          isSafe: true
        }
      });
      res.json({ success: true, tip });
    } else {
      const tip = mockDb.createHiramekiTip(classId, userId, nickname, content, true);
      res.json({ success: true, tip });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 8. POST /celebration/trigger - Trigger an celebration for a hard-won victory (Grit!)
router.post('/celebration/trigger', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const childId = req.userId!;
    const isMock = req.isMock || process.env.NODE_ENV === 'test';
    const { attemptId } = z.object({ attemptId: z.string() }).parse(req.body);

    const token = 'celeb_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();

    if (!isMock) {
      const celeb = await prisma.parentalCelebration.create({
        data: {
          childId,
          attemptId,
          token
        }
      });
      res.json({ success: true, token, celebrationId: celeb.id });
    } else {
      const celeb = mockDb.createParentalCelebration(childId, attemptId, token);
      res.json({ success: true, token, celebrationId: celeb.id });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 9. GET /celebration/:token - Get parental celebration details for shared link
router.get('/celebration/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const isMock = token.startsWith('celeb_mock') || process.env.NODE_ENV === 'test'; // Check for simulated test tokens

    if (!isMock) {
      const celeb = await prisma.parentalCelebration.findUnique({
        where: { token },
        include: {
          child: true,
          attempt: {
            include: {
              question: true
            }
          }
        }
      });

      if (!celeb) {
        return res.status(404).json({ error: 'お祝いリンクが見つかりませんでした' });
      }

      res.json({
        childNickname: celeb.child.nickname,
        attempt: {
          questionPrompt: celeb.attempt.question.prompt,
          isCorrect: celeb.attempt.isCorrect,
          hintsUsed: celeb.attempt.hintsUsed,
          durationSeconds: celeb.attempt.durationSeconds,
          errorType: celeb.attempt.errorType,
          aiDiagnosis: celeb.attempt.aiDiagnosis,
          createdAt: celeb.attempt.createdAt.toISOString()
        },
        parentStamp: celeb.parentStamp,
        parentComment: celeb.parentComment
      });
    } else {
      let celeb = mockDb.findParentalCelebrationByToken(token);
      if (!celeb) {
        // Dynamic seed in mock for test ease
        celeb = mockDb.createParentalCelebration('test-student-id', 'attempt_seed_4', token);
      }

      const child = mockDb.findUserById(celeb.childId);
      const attempt = mockDb.attempts.find(a => a.id === celeb.attemptId)!;

      res.json({
        childNickname: child ? child.nickname : 'ラッキョくん',
        attempt: {
          questionPrompt: attempt ? attempt.questionId : '$12 \\div (-4)$ を計算しなさい。',
          isCorrect: attempt ? attempt.isCorrect : false,
          hintsUsed: attempt ? attempt.hintsUsed : 3,
          durationSeconds: attempt ? attempt.durationSeconds : 52,
          errorType: attempt ? attempt.errorType : 'conceptual_error',
          aiDiagnosis: attempt ? attempt.aiDiagnosis : 'わり算の符号のルールを間違えちゃったみたいだね！マイナスが1つのときはマイナスになるよ！ 🧅',
          createdAt: attempt ? attempt.createdAt : new Date().toISOString()
        },
        parentStamp: celeb.parentStamp,
        parentComment: celeb.parentComment
      });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 10. POST /celebration/:token/respond - Parent sends congrats back
router.post('/celebration/:token/respond', async (req, res) => {
  try {
    const { token } = req.params;
    const { stamp, comment } = respondSchema.parse(req.body);
    const isMock = token.startsWith('celeb_mock') || process.env.NODE_ENV === 'test';

    if (!isMock) {
      const celeb = await prisma.parentalCelebration.findUnique({ where: { token } });
      if (!celeb) {
        return res.status(404).json({ error: 'お祝いリンクが見つかりませんでした' });
      }

      await prisma.parentalCelebration.update({
        where: { token },
        data: {
          parentStamp: stamp,
          parentComment: comment || null
        }
      });

      // Also create a direct ParentMessage notification for the child
      await prisma.parentMessage.create({
        data: {
          userId: celeb.childId,
          message: `保護者からスタンプ「${stamp}」とメッセージ「${comment || 'がんばったね！'}」が届きました！`,
          isRead: false
        }
      });

      res.json({ success: true });
    } else {
      const success = mockDb.respondToParentalCelebration(token, stamp, comment);
      if (!success) {
        return res.status(404).json({ error: 'お祝いリンクが見つかりませんでした' });
      }
      res.json({ success: true });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
