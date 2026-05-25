import { CurriculumRepository } from '../CurriculumRepository';
import prisma from '../../db';
import { allCurriculums } from '@rakkyo/curriculum';

export class PrismaCurriculumRepository implements CurriculumRepository {
  async findQuestionById(id: string): Promise<any | null> {
    try {
      // 1. Search DB question
      const dbQ = await prisma.question.findUnique({
        where: { id }
      });
      if (dbQ) return dbQ;
    } catch (e) {
      console.warn('⚠️ Database query failed when finding question. Falling back to local curriculum search.', e);
    }

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
    return prisma.studentAssignmentProgress.findFirst({
      where: { studentId, assignmentId }
    });
  }

  async updateAssignmentProgress(id: string, data: { isCompleted: boolean; completedAt: Date | null }): Promise<any> {
    return prisma.studentAssignmentProgress.update({
      where: { id },
      data
    });
  }

  async findAssignmentsByClass(classId: string): Promise<any[]> {
    const assignments = await prisma.assignment.findMany({
      where: { classId }
    });
    
    // Fetch progress stats for each assignment
    return Promise.all(
      assignments.map(async (a) => {
        const progresses = await prisma.studentAssignmentProgress.findMany({
          where: { assignmentId: a.id }
        });
        const completedCount = progresses.filter(p => p.isCompleted).length;
        return {
          ...a,
          completedCount,
          totalCount: progresses.length
        };
      })
    );
  }

  async createAssignment(data: {
    id: string;
    tenantId: string;
    classId: string;
    title: string;
    lessonId: string;
    dueDate: Date;
  }): Promise<any> {
    const assignment = await prisma.assignment.create({
      data
    });

    // Auto-create assignment progresses for all students in the class
    const studentEnrollments = await prisma.classEnrollment.findMany({
      where: { classId: data.classId, role: 'STUDENT' }
    });
    
    await Promise.all(
      studentEnrollments.map(s => 
        prisma.studentAssignmentProgress.create({
          data: {
            assignmentId: assignment.id,
            studentId: s.userId,
            isCompleted: false,
            completedAt: null
          }
        })
      )
    );

    return assignment;
  }

  async findAssignmentById(id: string): Promise<any | null> {
    return prisma.assignment.findUnique({
      where: { id }
    });
  }

  async findClassById(id: string): Promise<any | null> {
    return prisma.class.findUnique({
      where: { id }
    });
  }

  async createClass(data: {
    id: string;
    tenantId: string;
    name: string;
    grade: number;
  }): Promise<any> {
    return prisma.class.create({
      data
    });
  }

  async createDynamicQuestion(data: {
    lessonId: string;
    type: string;
    prompt: string;
    answers: string[];
    options: string[];
    explanation: string;
    hints: string[];
    isDynamic: boolean;
  }): Promise<any> {
    return prisma.question.create({
      data: {
        ...data,
        type: data.type as any
      }
    });
  }

  async findAllUnits(subjectCode?: string): Promise<any[]> {
    return prisma.unit.findMany({
      where: subjectCode ? { subject: { code: subjectCode } } : undefined,
      include: {
        lessons: {
          include: {
            questions: true
          }
        }
      },
      orderBy: { order: 'asc' }
    });
  }

  async findLessons(limit?: number): Promise<any[]> {
    return prisma.lesson.findMany({
      include: { unit: true },
      take: limit
    });
  }

  async findQuestionsByLessonId(lessonId: string): Promise<any[]> {
    try {
      const dbQs = await prisma.question.findMany({
        where: { lessonId }
      });
      if (dbQs && dbQs.length > 0) return dbQs;
    } catch (e) {
      console.warn('⚠️ Database query failed when finding questions by lesson ID. Falling back to local curriculum search.', e);
    }

    for (const curriculum of allCurriculums) {
      for (const unit of curriculum.units) {
        for (const lesson of unit.lessons) {
          if (lesson.name === lessonId) {
            return lesson.questions.map(q => ({
              id: q.id || q.prompt,
              hints: q.hints || []
            }));
          }
        }
      }
    }
    return [];
  }
}
