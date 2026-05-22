import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma, { tenantStorage } from '../db';
import { mockDb, UserMock } from '../mockDb';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'rakkyo-super-secret-key-12345';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  tenantId?: string;
  role?: string;
  user?: any; // Can be Prisma User or UserMock
  isMock?: boolean;
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: '認証トークンが必要です。' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; tenantId?: string; role?: string };

    const tenantId = decoded.tenantId || 'default-b2c';
    const role = decoded.role || 'STUDENT';

    req.userId = decoded.userId;
    req.tenantId = tenantId;
    req.role = role;
    req.isMock = false;

    const proceed = async () => {
      try {
        if (process.env.NODE_ENV === 'test') {
          throw new Error('Test environment: Forcing Mock DB');
        }
        
        // Under tenant context, Prisma client extension will implicitly filter by tenantId.
        // For finding a user by ID at authentication step, we run under this tenantStorage context safely.
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId }
        });
        if (user) {
          req.user = user;
        } else {
          // If not found in Prisma, try mockDb
          const mockUser = mockDb.findUserById(decoded.userId);
          if (mockUser) {
            req.user = mockUser;
            req.isMock = true;
          } else {
            res.status(401).json({ error: 'ユーザーが見つかりません。' });
            return;
          }
        }
      } catch (dbError) {
        console.warn('⚠️ Database connection failed in authMiddleware. Falling back to Mock DB.');
        req.isMock = true;
        const mockUser = mockDb.findUserById(decoded.userId);
        if (mockUser) {
          req.user = mockUser;
        } else {
          res.status(401).json({ error: 'ユーザーが見つかりません。(Mock)' });
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
