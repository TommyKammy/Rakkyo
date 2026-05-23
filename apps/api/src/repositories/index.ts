import { UserRepository } from './UserRepository';
import { CurriculumRepository } from './CurriculumRepository';
import { AttemptRepository } from './AttemptRepository';
import { CollaborativeRepository } from './CollaborativeRepository';
import { AvatarRepository } from './AvatarRepository';

export interface RepositoryContainer {
  users: UserRepository;
  curriculum: CurriculumRepository;
  attempts: AttemptRepository;
  collaborative: CollaborativeRepository;
  avatars: AvatarRepository;
}

export * from './UserRepository';
export * from './CurriculumRepository';
export * from './AttemptRepository';
export * from './CollaborativeRepository';
export * from './AvatarRepository';

