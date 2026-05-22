import { RepositoryContainer } from '../index';
import { PrismaUserRepository } from './PrismaUserRepository';
import { PrismaCurriculumRepository } from './PrismaCurriculumRepository';
import { PrismaAttemptRepository } from './PrismaAttemptRepository';
import { PrismaCollaborativeRepository } from './PrismaCollaborativeRepository';

export const prismaRepos: RepositoryContainer = {
  users: new PrismaUserRepository(),
  curriculum: new PrismaCurriculumRepository(),
  attempts: new PrismaAttemptRepository(),
  collaborative: new PrismaCollaborativeRepository()
};
