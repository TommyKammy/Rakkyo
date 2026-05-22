import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { prismaRepos } from '../repositories/prisma';
import { inMemoryRepos } from '../repositories/inmemory';

export function repositoryMiddleware(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  const isProd = process.env.NODE_ENV === 'production';
  const isMockHeader = !isProd && authReq.headers['x-mock-db'] === 'true';
  const isTest = process.env.NODE_ENV === 'test';
  
  authReq.isMock = isTest || isMockHeader;
  authReq.repos = authReq.isMock ? inMemoryRepos : prismaRepos;
  
  next();
}
