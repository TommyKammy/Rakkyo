import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { tenantStorage } from '../db';
import { RepositoryContainer } from '../repositories';
import { requireSecret } from '../utils/secrets';

const JWT_SECRET = requireSecret('NEXTAUTH_SECRET', 'rakkyo-super-secret-key-12345');

export interface AuthenticatedRequest extends Request {
  userId?: string;
  tenantId?: string;
  role?: string;
  user?: any;
  isMock?: boolean;
  repos?: RepositoryContainer;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    const authHeader = authReq.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: '認証トークンが必要です。' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; tenantId?: string; role?: string };

    const tenantId = decoded.tenantId || 'default-b2c';
    const role = decoded.role || 'STUDENT';

    authReq.userId = decoded.userId;
    authReq.tenantId = tenantId;
    authReq.role = role;

    // The repositoryMiddleware should have set req.repos before authMiddleware runs.
    // We intentionally do NOT fall back to InMemory here: a missing repo container
    // means the middleware chain is misconfigured and we want loud failure rather
    // than silent demo-data leakage in production.
    if (!authReq.repos) {
      console.error(
        'FATAL: authMiddleware invoked before repositoryMiddleware. Refusing to authenticate.'
      );
      res.status(500).json({ error: 'サーバー設定エラーが発生しました。' });
      return;
    }

    const proceed = async () => {
      let user;
      try {
        user = await authReq.repos!.users.findById(decoded.userId);
      } catch (dbError) {
        // Database errors must surface as 500, never as a silent switch to
        // an in-memory store that may contain seeded demo accounts.
        console.error('authMiddleware DB lookup failed:', dbError);
        res.status(500).json({ error: '一時的にサインインできません。少し時間をおいてからもう一度試してください。' });
        return;
      }

      if (!user) {
        res.status(401).json({ error: 'ユーザーが見つかりません。' });
        return;
      }
      authReq.user = user;

      // 24時間ハードロックのチェック
      if (user.lockedUntil) {
        const lockedUntilDate = new Date(user.lockedUntil);
        if (lockedUntilDate > new Date()) {
          res.status(403).json({
            error: 'safety_lock',
            message: '安全確保のため、アカウントが24時間ロックされています。保護者または先生に確認してね 🧅'
          });
          return;
        }
      }

      next();
    };

    // Run query executions in tenant context using AsyncLocalStorage
    tenantStorage.run({ tenantId }, proceed);

  } catch (error) {
    res.status(401).json({ error: 'トークンが無効または期限切れです。' });
  }
}

// Role-Based Access Control (RBAC) middleware
export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role || req.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      res.status(403).json({ error: 'この操作を行う権限がありません。ラッキョくんも悲しんでいるよ 🧅' });
      return;
    }
    next();
  };
}

