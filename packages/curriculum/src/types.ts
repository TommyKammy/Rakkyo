export interface QuestionData {
  id?: string;
  type: 'MULTIPLE_CHOICE' | 'NUMBER_INPUT' | 'FILL_IN_BLANK' | 'SINGLE_CHOICE' | 'NUMERIC' | 'TEXT_SHORT' | 'FILL_BLANK';
  prompt: string;
  answers: string[];
  options: string[];
  explanation: string;
  hints: string[];
}

export interface Lessondata {
  name: string;
  order: number;
  questions: QuestionData[];
}

export interface UnitData {
  name: string;
  order: number;
  description: string;
  lessons: Lessondata[];
}

export interface SubjectData {
  name: string;
  code: string;
  units: UnitData[];
}
