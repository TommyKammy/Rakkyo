import { RepositoryContainer } from '../index';
import { PrismaUserRepository } from './PrismaUserRepository';
import { PrismaCurriculumRepository } from './PrismaCurriculumRepository';
import { PrismaAttemptRepository } from './PrismaAttemptRepository';
import { PrismaCollaborativeRepository } from './PrismaCollaborativeRepository';
import { PrismaAvatarRepository } from './PrismaAvatarRepository';
import { PrismaSpeechRepository } from './PrismaSpeechRepository';
import { PrismaSyncRepository } from './PrismaSyncRepository';

export const prismaRepos: RepositoryContainer = {
  users: new PrismaUserRepository(),
  curriculum: new PrismaCurriculumRepository(),
  attempts: new PrismaAttemptRepository(),
  collaborative: new PrismaCollaborativeRepository(),
  avatars: new PrismaAvatarRepository(),
  speech: new PrismaSpeechRepository(),
  sync: new PrismaSyncRepository(),
};
