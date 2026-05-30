import { CurriculumRepository } from '../CurriculumRepository';
import { inMemoryState } from './state';
import { allCurriculums } from '@rakkyo/curriculum';
import crypto from 'crypto';

export class InMemoryCurriculumRepository implements CurriculumRepository {
  async findQuestionById(id: string): Promise<any | null> {
    // 1. Search in dynamic questions
    const dynamicQ = inMemoryState.dynamicQuestions.find(q => q.id === id);
    if (dynamicQ) return dynamicQ;

    // 2. Search static curriculum
    for (const curriculum of allCurriculums) {
      for (const unit of curriculum.units) {
        for (const lesson of unit.lessons) {
          const q = lesson.questions.find(quest => quest.id === id || quest.prompt === id);
          if (q) {
            return q;
          }
        }
      }
    }
    return null;
  }

  async findAssignmentProgress(studentId: string, assignmentId: string): Promise<any | null> {
    const progress = inMemoryState.assignmentProgresses.find(
      p => p.studentId === studentId && p.assignmentId === assignmentId
    );
    return progress || null;
  }

  async updateAssignmentProgress(id: string, data: { isCompleted: boolean; completedAt: Date | null }): Promise<any> {
    const progress = inMemoryState.assignmentProgresses.find(p => p.id === id);
    if (progress) {
      progress.isCompleted = data.isCompleted;
      progress.completedAt = data.completedAt ? data.completedAt.toISOString() : null;
    }
    return progress;
  }

  async findAssignmentsByClass(classId: string): Promise<any[]> {
    const classAss = inMemoryState.assignments.filter(a => a.classId === classId);
    return classAss.map(a => {
      const progresses = inMemoryState.assignmentProgresses.filter(p => p.assignmentId === a.id);
      const completedCount = progresses.filter(p => p.isCompleted).length;
      return {
        ...a,
        completedCount,
        totalCount: progresses.length
      };
    });
  }

  async createAssignment(data: {
    id: string;
    tenantId: string;
    classId: string;
    title: string;
    lessonId: string;
    dueDate: Date;
  }): Promise<any> {
    const newAssignment = {
      ...data,
      dueDate: data.dueDate.toISOString(),
      createdAt: new Date().toISOString()
    };
    inMemoryState.assignments.push(newAssignment);

    // Auto-create assignment progresses for all students in the class
    const studentEnrollments = inMemoryState.classEnrollments.filter(
      e => e.classId === data.classId && e.role === 'STUDENT'
    );
    studentEnrollments.forEach(s => {
      inMemoryState.assignmentProgresses.push({
        id: 'progress_' + crypto.randomUUID(),
        assignmentId: newAssignment.id,
        studentId: s.userId,
        isCompleted: false,
        completedAt: null
      });
    });

    return newAssignment;
  }

  async findAssignmentById(id: string): Promise<any | null> {
    const assignment = inMemoryState.assignments.find(a => a.id === id);
    return assignment || null;
  }

  async findClassById(id: string): Promise<any | null> {
    const cls = inMemoryState.classes.find(c => c.id === id);
    return cls || null;
  }

  async createClass(data: {
    id: string;
    tenantId: string;
    name: string;
    grade: number;
  }): Promise<any> {
    inMemoryState.classes.push(data);
    return data;
  }

  async createDynamicQuestion(data: any): Promise<any> {
    const newQ = {
      ...data,
      id: 'q_dynamic_' + crypto.randomUUID(),
      isDynamic: true
    };
    inMemoryState.dynamicQuestions.push(newQ);
    return newQ;
  }

  async findAllUnits(subjectCode?: string): Promise<any[]> {
    const targetCurriculums = subjectCode 
      ? allCurriculums.filter(c => c.code === subjectCode)
      : allCurriculums;

    const rawUnits: any[] = [];
    for (const curriculum of targetCurriculums) {
      const curriculumUnits = curriculum.units.map(u => ({
        id: u.name,
        name: u.name,
        order: u.order,
        description: u.description,
        lessons: u.lessons.map(l => ({
          id: l.name,
          name: l.name,
          order: l.order,
          questions: l.questions.map(q => ({
            id: q.id || q.prompt,
            type: q.type,
            prompt: q.prompt,
            answers: q.answers,
            options: q.options,
            explanation: q.explanation,
            hints: q.hints
          }))
        }))
      }));
      rawUnits.push(...curriculumUnits);
    }
    return rawUnits;
  }

  async findLessons(limit?: number): Promise<any[]> {
    const lessons: any[] = [];
    for (const curriculum of allCurriculums) {
      for (const unit of curriculum.units) {
        for (const lesson of unit.lessons) {
          lessons.push({
            id: lesson.name,
            name: lesson.name,
            order: lesson.order,
            unit: {
              id: unit.name,
              name: unit.name
            }
          });
        }
      }
    }
    return limit ? lessons.slice(0, limit) : lessons;
  }

  async findQuestionsByLessonId(lessonIdOrName: string): Promise<any[]> {
    // P2: Accept either canonical Lesson.id or lesson name. The in-memory
    // store keys dynamic questions by name (mirrors the static curriculum
    // identifier the web client carries), so a single name comparison
    // matches both forms here.
    const dynamicQs = inMemoryState.dynamicQuestions.filter(q => q.lessonId === lessonIdOrName);

    const staticQs: any[] = [];
    for (const curriculum of allCurriculums) {
      for (const unit of curriculum.units) {
        for (const lesson of unit.lessons) {
          if (lesson.name === lessonIdOrName) {
            staticQs.push(...lesson.questions.map(q => ({
              id: q.id || q.prompt,
              // P2: carry the prompt so the hints route can also expose a
              // prompt-keyed cache entry (symmetric with the Prisma repo).
              prompt: q.prompt,
              hints: q.hints || []
            })));
          }
        }
      }
    }
    
    // Merge and deduplicate by ID / prompt (P2-10)
    const merged = [...dynamicQs];
    for (const sq of staticQs) {
      if (!merged.some(mq => mq.id === sq.id || mq.prompt === sq.id)) {
        merged.push(sq);
      }
    }
    return merged;
  }
}

