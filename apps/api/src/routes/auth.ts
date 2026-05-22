import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../db';
import { mockDb } from '../mockDb';

const router = Router();
const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'rakkyo-super-secret-key-12345';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  nickname: z.string().min(1),
  schoolYear: z.number().int().min(1).max(3).optional().default(1),
  parentalConsent: z.boolean().refine(val => val === true, { message: '保護者の同意が必要です。' })
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

// Register
router.post('/register', async (req, res, next) => {
  try {
    const parsed = registerSchema.parse(req.body);
    const passwordHash = bcrypt.hashSync(parsed.password, 10);

    let user;
    let isMock = false;

    try {
      if (process.env.NODE_ENV === 'test') {
        throw new Error('Test environment: Forcing Mock DB');
      }
      const existingUser = await prisma.user.findUnique({
        where: { email: parsed.email }
      });
      if (existingUser) {
        res.status(400).json({ error: 'このメールアドレスは既に登録されています。' });
        return;
      }

      user = await prisma.user.create({
        data: {
          email: parsed.email,
          password: passwordHash,
          nickname: parsed.nickname,
          schoolYear: parsed.schoolYear,
          parentalConsent: parsed.parentalConsent
        }
      });
    } catch (dbError) {
      console.warn('⚠️ Database connection failed. Falling back to Mock DB.');
      isMock = true;

      const existingUser = mockDb.findUserByEmail(parsed.email);
      if (existingUser) {
        res.status(400).json({ error: 'このメールアドレスは既に登録されています。(Mock)' });
        return;
      }

      user = mockDb.createUser({
        email: parsed.email,
        passwordHash,
        nickname: parsed.nickname,
        schoolYear: parsed.schoolYear,
        parentalConsent: parsed.parentalConsent
      });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        schoolYear: user.schoolYear,
        parentalConsent: 'parentalConsent' in user ? user.parentalConsent : false,
        currentXp: 'currentXp' in user ? user.currentXp : 0,
        level: 'level' in user ? user.level : 1,
        streakCount: 'streakCount' in user ? user.streakCount : 0,
        isMock
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.parse(req.body);

    let user = null;
    let isMock = false;

    try {
      if (process.env.NODE_ENV === 'test') {
        throw new Error('Test environment: Forcing Mock DB');
      }
      user = await prisma.user.findUnique({
        where: { email: parsed.email }
      });
    } catch (dbError) {
      console.warn('⚠️ Database connection failed. Falling back to Mock DB.');
      isMock = true;
      user = mockDb.findUserByEmail(parsed.email);
    }

    if (!user) {
      res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません。' });
      return;
    }

    const passwordHash = 'password' in user ? user.password : user.passwordHash;
    const isPasswordValid = bcrypt.compareSync(parsed.password, passwordHash);

    if (!isPasswordValid) {
      res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません。' });
      return;
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        schoolYear: user.schoolYear,
        parentalConsent: 'parentalConsent' in user ? user.parentalConsent : false,
        currentXp: 'currentXp' in user ? user.currentXp : 0,
        level: 'level' in user ? user.level : 1,
        streakCount: 'streakCount' in user ? user.streakCount : 0,
        isMock
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  }
});

export default router;
