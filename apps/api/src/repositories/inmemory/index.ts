import { RepositoryContainer } from '../index';
import { InMemoryUserRepository } from './InMemoryUserRepository';
import { InMemoryCurriculumRepository } from './InMemoryCurriculumRepository';
import { InMemoryAttemptRepository } from './InMemoryAttemptRepository';
import { InMemoryCollaborativeRepository } from './InMemoryCollaborativeRepository';

export const inMemoryRepos: RepositoryContainer = {
  users: new InMemoryUserRepository(),
  curriculum: new InMemoryCurriculumRepository(),
  attempts: new InMemoryAttemptRepository(),
  collaborative: new InMemoryCollaborativeRepository()
};

export * from './state';
