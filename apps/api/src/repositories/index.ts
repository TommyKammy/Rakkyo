import { UserRepository } from './UserRepository';
import { CurriculumRepository } from './CurriculumRepository';
import { AttemptRepository } from './AttemptRepository';
import { CollaborativeRepository } from './CollaborativeRepository';

export interface RepositoryContainer {
  users: UserRepository;
  curriculum: CurriculumRepository;
  attempts: AttemptRepository;
  collaborative: CollaborativeRepository;
}

export * from './UserRepository';
export * from './CurriculumRepository';
export * from './AttemptRepository';
export * from './CollaborativeRepository';
