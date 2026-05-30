export interface CurriculumRepository {
  findQuestionById(id: string): Promise<any | null>;
  findAssignmentProgress(studentId: string, assignmentId: string): Promise<any | null>;
  updateAssignmentProgress(id: string, data: { isCompleted: boolean; completedAt: Date | null }): Promise<any>;
  findAssignmentsByClass(classId: string): Promise<any[]>;
  createAssignment(data: {
    id: string;
    tenantId: string;
    classId: string;
    title: string;
    lessonId: string;
    dueDate: Date;
  }): Promise<any>;
  findAssignmentById(id: string): Promise<any | null>;
  findClassById(id: string): Promise<any | null>;
  createClass(data: {
    id: string;
    tenantId: string;
    name: string;
    grade: number;
  }): Promise<any>;
  createDynamicQuestion(data: {
    lessonId: string;
    type: string;
    prompt: string;
    answers: string[];
    options: string[];
    explanation: string;
    hints: string[];
    isDynamic: boolean;
  }): Promise<any>;
  findAllUnits(subjectCode?: string): Promise<any[]>;
  findLessons(limit?: number): Promise<any[]>;
  findQuestionsByLessonId(lessonId: string): Promise<any[]>;
}

