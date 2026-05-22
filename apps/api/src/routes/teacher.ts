import { Router, Response } from 'express';
import prisma from '../db';
import { mockDb } from '../mockDb';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middlewares/auth';
import { calculateParentStats } from '../services/parentStatsService';

const router = Router();

// Apply auth middleware and teacher/tenant_admin role verification globally for all routes in this file
router.use(authMiddleware);
router.use(requireRole(['TEACHER', 'TENANT_ADMIN']));

// GET /classes - Get classes belonging to the logged-in teacher
router.get('/classes', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teacherId = req.userId!;
    const isMock = req.isMock;

    let classes: any[] = [];

    if (!isMock) {
      try {
        const enrollments = await prisma.classEnrollment.findMany({
          where: {
            userId: teacherId,
            role: 'TEACHER',
          },
          include: {
            class: true,
          },
        });
        classes = enrollments.map(e => e.class);
      } catch (dbError) {
        console.warn('⚠️ Teacher classes DB query failed. Falling back to mockDb.');
        classes = mockDb.getTeacherClasses(teacherId);
      }
    } else {
      classes = mockDb.getTeacherClasses(teacherId);
    }

    res.json({ classes });
  } catch (error) {
    console.error('Error fetching teacher classes:', error);
    res.status(500).json({ error: 'クラス一覧の取得中にエラーが発生しました。' });
  }
});

// GET /classes/:classId/students - Get students enrolled in a class with their brief stats
router.get('/classes/:classId/students', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { classId } = req.params;
    const isMock = req.isMock;

    let studentsWithStats: any[] = [];

    if (!isMock) {
      try {
        const enrollments = await prisma.classEnrollment.findMany({
          where: {
            classId,
            role: 'STUDENT',
          },
          include: {
            user: {
              select: {
                id: true,
                nickname: true,
                email: true,
                schoolYear: true,
                level: true,
                currentXp: true,
                streakCount: true,
              },
            },
          },
        });

        const students = enrollments.map(e => e.user);

        studentsWithStats = await Promise.all(
          students.map(async student => {
            const attempts = await prisma.attempt.findMany({
              where: { userId: student.id },
            });
            const totalAttempts = attempts.length;
            const correctAttempts = attempts.filter(a => a.isCorrect).length;
            const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

            return {
              ...student,
              stats: {
                totalAttempts,
                accuracy,
              },
            };
          })
        );
      } catch (dbError) {
        console.warn('⚠️ Class students DB query failed. Falling back to mockDb.');
        const students = mockDb.getClassStudents(classId);
        studentsWithStats = students.map(student => {
          const attempts = mockDb.getUserAttempts(student.id);
          const totalAttempts = attempts.length;
          const correctAttempts = attempts.filter(a => a.isCorrect).length;
          const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

          return {
            id: student.id,
            nickname: student.nickname,
            email: student.email,
            schoolYear: student.schoolYear,
            level: student.level,
            currentXp: student.currentXp,
            streakCount: student.streakCount,
            stats: {
              totalAttempts,
              accuracy,
            },
          };
        });
      }
    } else {
      const students = mockDb.getClassStudents(classId);
      studentsWithStats = students.map(student => {
        const attempts = mockDb.getUserAttempts(student.id);
        const totalAttempts = attempts.length;
        const correctAttempts = attempts.filter(a => a.isCorrect).length;
        const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

        return {
          id: student.id,
          nickname: student.nickname,
          email: student.email,
          schoolYear: student.schoolYear,
          level: student.level,
          currentXp: student.currentXp,
          streakCount: student.streakCount,
          stats: {
            totalAttempts,
            accuracy,
          },
        };
      });
    }

    res.json({ students: studentsWithStats });
  } catch (error) {
    console.error('Error fetching class students:', error);
    res.status(500).json({ error: 'クラス生徒一覧の取得中にエラーが発生しました。' });
  }
});

// GET /students/:studentId/stats - Get detailed learning analytics for a specific student
router.get('/students/:studentId/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { studentId } = req.params;
    const isMock = req.isMock;

    let attempts: any[] = [];

    if (!isMock) {
      try {
        attempts = await prisma.attempt.findMany({
          where: { userId: studentId },
          orderBy: { createdAt: 'asc' },
        });
      } catch (dbError) {
        console.warn('⚠️ Student stats DB query failed. Falling back to mockDb.');
        attempts = mockDb.getUserAttempts(studentId);
      }
    } else {
      attempts = mockDb.getUserAttempts(studentId);
    }

    const stats = calculateParentStats(attempts);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching student stats:', error);
    res.status(500).json({ error: '生徒学習統計の取得中にエラーが発生しました。' });
  }
});

// POST /assignments - Issue a homework assignment to a class
router.post('/assignments', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { classId, title, lessonId, dueDate } = req.body;
    const tenantId = req.tenantId!;
    const isMock = req.isMock;

    if (!classId || !title || !lessonId || !dueDate) {
      res.status(400).json({ error: 'クラスID、タイトル、レッスンID、提出期限は必須項目です。' });
      return;
    }

    let assignment: any;

    if (!isMock) {
      try {
        // Create the assignment
        assignment = await prisma.assignment.create({
          data: {
            tenantId,
            classId,
            title,
            lessonId,
            dueDate: new Date(dueDate),
          },
        });

        // Get all students enrolled in the target class
        const enrollments = await prisma.classEnrollment.findMany({
          where: {
            classId,
            role: 'STUDENT',
          },
        });

        // Auto-create progress records for each student in the class
        if (enrollments.length > 0) {
          await prisma.studentAssignmentProgress.createMany({
            data: enrollments.map(e => ({
              assignmentId: assignment.id,
              studentId: e.userId,
              isCompleted: false,
            })),
          });
        }
      } catch (dbError) {
        console.warn('⚠️ Assignment DB creation failed. Falling back to mockDb.');
        assignment = mockDb.createAssignment(tenantId, classId, title, lessonId, dueDate);
      }
    } else {
      assignment = mockDb.createAssignment(tenantId, classId, title, lessonId, dueDate);
    }

    res.status(201).json({ assignment });
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({ error: '宿題の配信中にエラーが発生しました。' });
  }
});

// GET /assignments - Get assignments for a specific class with completed statistics
router.get('/assignments', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { classId } = req.query;
    const isMock = req.isMock;

    if (!classId || typeof classId !== 'string') {
      res.status(400).json({ error: 'classId パラメータが必要です。' });
      return;
    }

    let assignmentsWithStats: any[] = [];

    if (!isMock) {
      try {
        const assignments = await prisma.assignment.findMany({
          where: {
            classId,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        assignmentsWithStats = await Promise.all(
          assignments.map(async a => {
            const progresses = await prisma.studentAssignmentProgress.findMany({
              where: { assignmentId: a.id },
            });
            const completedCount = progresses.filter(p => p.isCompleted).length;

            return {
              ...a,
              completedCount,
              totalCount: progresses.length,
            };
          })
        );
      } catch (dbError) {
        console.warn('⚠️ Class assignments DB query failed. Falling back to mockDb.');
        assignmentsWithStats = mockDb.getClassAssignments(classId);
      }
    } else {
      assignmentsWithStats = mockDb.getClassAssignments(classId);
    }

    res.json({ assignments: assignmentsWithStats });
  } catch (error) {
    console.error('Error fetching class assignments:', error);
    res.status(500).json({ error: '宿題一覧の取得中にエラーが発生しました。' });
  }
});

export default router;
