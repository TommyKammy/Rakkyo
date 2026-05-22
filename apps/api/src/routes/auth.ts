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
  parentalConsent: z.boolean().refine(val => val === true, { message: '保護者の同意が必要です。' }),
  tenantCode: z.string().optional(),
  role: z.enum(['STUDENT', 'TEACHER', 'PARENT']).optional().default('STUDENT')
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  tenantCode: z.string().optional()
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

      const targetCode = (parsed.tenantCode || 'b2c').trim().toLowerCase();
      let tenant = await prisma.tenant.findUnique({
        where: { code: targetCode }
      });

      if (!tenant) {
        if (targetCode === 'b2c') {
          tenant = await prisma.tenant.upsert({
            where: { code: 'b2c' },
            update: {},
            create: {
              id: 'default-b2c',
              name: 'デフォルト個人テナント',
              code: 'b2c'
            }
          });
        } else {
          res.status(400).json({ error: '指定された塾・学校コードが存在しません。管理者に確認してね 🧅' });
          return;
        }
      }

      const tenantId = tenant.id;

      const existingUser = await prisma.user.findUnique({
        where: {
          tenantId_email: {
            tenantId,
            email: parsed.email
          }
        }
      });

      if (existingUser) {
        res.status(400).json({ error: 'このメールアドレスは既に登録されています。' });
        return;
      }

      user = await prisma.user.create({
        data: {
          tenantId,
          email: parsed.email,
          password: passwordHash,
          nickname: parsed.nickname,
          role: parsed.role,
          schoolYear: parsed.schoolYear,
          parentalConsent: parsed.parentalConsent
        }
      });
    } catch (dbError) {
      console.warn('⚠️ Database connection failed. Falling back to Mock DB.');
      isMock = true;

      const targetCode = (parsed.tenantCode || 'b2c').trim().toLowerCase();
      let tenant = mockDb.findTenantByCode(targetCode);

      if (!tenant) {
        if (targetCode === 'b2c') {
          tenant = mockDb.findTenantById('default-b2c');
          if (!tenant) {
            tenant = mockDb.createTenant('デフォルト個人テナント', 'b2c');
            tenant.id = 'default-b2c';
          }
        } else {
          res.status(400).json({ error: '指定された塾・学校コードが存在しません。管理者に確認してね 🧅' });
          return;
        }
      }

      const tenantId = tenant.id;

      const existingUser = mockDb.findUserByEmail(parsed.email, tenantId);
      if (existingUser) {
        res.status(400).json({ error: 'このメールアドレスは既に登録されています。(Mock)' });
        return;
      }

      user = mockDb.createUser({
        tenantId,
        email: parsed.email,
        passwordHash,
        nickname: parsed.nickname,
        role: parsed.role,
        schoolYear: parsed.schoolYear,
        parentalConsent: parsed.parentalConsent
      });
    }

    const token = jwt.sign(
      { 
        userId: user.id, 
        tenantId: user.tenantId, 
        role: user.role 
      }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        tenantId: user.tenantId,
        role: user.role,
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
    const targetCode = (parsed.tenantCode || 'b2c').trim().toLowerCase();

    try {
      if (process.env.NODE_ENV === 'test') {
        throw new Error('Test environment: Forcing Mock DB');
      }

      let tenant = await prisma.tenant.findUnique({
        where: { code: targetCode }
      });

      if (!tenant) {
        if (targetCode === 'b2c') {
          tenant = await prisma.tenant.upsert({
            where: { code: 'b2c' },
            update: {},
            create: {
              id: 'default-b2c',
              name: 'デフォルト個人テナント',
              code: 'b2c'
            }
          });
        } else {
          res.status(401).json({ error: '塾・学校コードが正しくありません。' });
          return;
        }
      }

      user = await prisma.user.findUnique({
        where: {
          tenantId_email: {
            tenantId: tenant.id,
            email: parsed.email
          }
        }
      });
    } catch (dbError) {
      console.warn('⚠️ Database connection failed. Falling back to Mock DB.');
      isMock = true;

      let tenant = mockDb.findTenantByCode(targetCode);
      if (!tenant) {
        if (targetCode === 'b2c') {
          tenant = mockDb.findTenantById('default-b2c');
        } else {
          res.status(401).json({ error: '塾・学校コードが正しくありません。' });
          return;
        }
      }

      if (tenant) {
        user = mockDb.findUserByEmail(parsed.email, tenant.id);
      }
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

    const token = jwt.sign(
      { 
        userId: user.id, 
        tenantId: user.tenantId, 
        role: user.role 
      }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        tenantId: user.tenantId,
        role: user.role,
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
