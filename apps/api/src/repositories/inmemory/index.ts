import { RepositoryContainer } from '../index';
import { InMemoryUserRepository } from './InMemoryUserRepository';
import { InMemoryCurriculumRepository } from './InMemoryCurriculumRepository';
import { InMemoryAttemptRepository } from './InMemoryAttemptRepository';
import { InMemoryCollaborativeRepository } from './InMemoryCollaborativeRepository';
import { InMemoryAvatarRepository } from './InMemoryAvatarRepository';
import { InMemorySpeechRepository } from './InMemorySpeechRepository';
import { InMemorySyncRepository } from './InMemorySyncRepository';

export const inMemoryRepos: RepositoryContainer = {
  users: new InMemoryUserRepository(),
  curriculum: new InMemoryCurriculumRepository(),
  attempts: new InMemoryAttemptRepository(),
  collaborative: new InMemoryCollaborativeRepository(),
  avatars: new InMemoryAvatarRepository(),
  speech: new InMemorySpeechRepository(),
  sync: new InMemorySyncRepository(),
};

export * from './state';
