import { mathGrade1Curriculum } from './subjects/math';
import { englishGrade1Curriculum } from './subjects/english';
import { scienceGrade1Curriculum } from './subjects/science';
import { socialGrade1Curriculum } from './subjects/social';
import { japaneseGrade1Curriculum } from './subjects/japanese';

export * from './types';
export * from './subjects/math';
export * from './subjects/english';
export * from './subjects/science';
export * from './subjects/social';
export * from './subjects/japanese';

export const allCurriculums = [
  mathGrade1Curriculum,
  englishGrade1Curriculum,
  scienceGrade1Curriculum,
  socialGrade1Curriculum,
  japaneseGrade1Curriculum,
];
