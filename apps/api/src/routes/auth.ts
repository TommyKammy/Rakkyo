import { Router, Request } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middlewares/auth';
import { requireSecret } from '../utils/secrets';

const router = Router();
const JWT_SECRET = requireSecret('NEXTAUTH_SECRET', 'rakkyo-super-secret-key-12345');

// Timing attack prevention
const DUMMY_HASH = bcrypt.hashSync('dummy-password-hash-to-prevent-timing-attacks', 10);

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
router.post('/register', async (req: Request, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const parsed = registerSchema.parse(authReq.body);
    const passwordHash = bcrypt.hashSync(parsed.password, 10);

    const targetCode = (parsed.tenantCode || 'b2c').trim().toLowerCase();
    let tenant = await authReq.repos!.users.findTenantByCode(targetCode);

    if (!tenant) {
      if (targetCode === 'b2c') {
        tenant = await authReq.repos!.users.createTenant({
          id: 'default-b2c',
          name: 'デフォルト個人テナント',
          code: 'b2c',
          plan: 'FREE'
        });
      } else {
        res.status(400).json({ error: '指定された塾・学校コードが存在しません。管理者に確認してね 🧅' });
        return;
      }
    }

    const tenantId = tenant.id;

    const existingUser = await authReq.repos!.users.findByEmail(parsed.email);
    if (existingUser && existingUser.tenantId === tenantId) {
      res.status(400).json({ error: 'このメールアドレスは既に登録されています。' });
      return;
    }

    const user = await authReq.repos!.users.createUser({
      id: 'user_' + Math.random().toString(36).substr(2, 9),
      tenantId,
      email: parsed.email,
      passwordHash,
      nickname: parsed.nickname,
      role: parsed.role,
      schoolYear: parsed.schoolYear,
      parentalConsent: parsed.parentalConsent
    });

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
        parentalConsent: user.parentalConsent,
        currentXp: user.currentXp,
        level: user.level,
        streakCount: user.streakCount,
        ...(process.env.NODE_ENV !== 'production' ? { isMock: !!authReq.isMock } : {})
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  }
});

// Login
router.post('/login', async (req: Request, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const parsed = loginSchema.parse(authReq.body);
    const targetCode = (parsed.tenantCode || 'b2c').trim().toLowerCase();

    let tenant = await authReq.repos!.users.findTenantByCode(targetCode);

    if (!tenant) {
      if (targetCode === 'b2c') {
        tenant = await authReq.repos!.users.createTenant({
          id: 'default-b2c',
          name: 'デフォルト個人テナント',
          code: 'b2c',
          plan: 'FREE'
        });
      } else {
        // テナントが存在しない場合もタイミングを均一化するためダミー比較を実行
        bcrypt.compareSync(parsed.password, DUMMY_HASH);
        res.status(401).json({ error: '塾・学校コードが正しくありません。' });
        return;
      }
    }

    const user = await authReq.repos!.users.findByEmail(parsed.email);
    
    // ユーザーが存在し、且つテナントが一致するかどうかを論理チェック
    const isValidUser = user !== null && user.tenantId === tenant.id;
    const passwordHash = isValidUser ? user!.password : DUMMY_HASH;
    
    // 常に bcrypt 比較を実行
    const isPasswordValid = bcrypt.compareSync(parsed.password, passwordHash);

    if (!isValidUser || !isPasswordValid) {
      res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません。' });
      return;
    }

    const token = jwt.sign(
      { 
        userId: user!.id, 
        tenantId: user!.tenantId, 
        role: user!.role 
      }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user!.id,
        tenantId: user!.tenantId,
        role: user!.role,
        email: user!.email,
        nickname: user!.nickname,
        schoolYear: user!.schoolYear,
        parentalConsent: user!.parentalConsent,
        currentXp: user!.currentXp,
        level: user!.level,
        streakCount: user!.streakCount,
        ...(process.env.NODE_ENV !== 'production' ? { isMock: !!authReq.isMock } : {})
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  }
});

export default router;
