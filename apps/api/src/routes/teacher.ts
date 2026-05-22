import { Router, Response } from 'express';
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
    const repos = req.repos!;
    
    const enrollments = await repos.users.findEnrollmentsByUser(teacherId, 'TEACHER');
    const classes = enrollments.map(e => e.class);

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
    const repos = req.repos!;

    const enrollments = await repos.users.findEnrollmentsByClass(classId, 'STUDENT');
    const students = enrollments.map(e => e.user);

    const studentsWithStats = await Promise.all(
      students.map(async student => {
        const attempts = await repos.attempts.findAttemptsByUser(student.id);
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
      })
    );

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
    const repos = req.repos!;

    const attempts = await repos.attempts.findAttemptsByUser(studentId);
    const sortedAttempts = [...attempts].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const stats = calculateParentStats(sortedAttempts);
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
    const repos = req.repos!;

    if (!classId || !title || !lessonId || !dueDate) {
      res.status(400).json({ error: 'クラスID、タイトル、レッスンID、提出期限は必須項目です。' });
      return;
    }

    // Create the assignment
    const assignment = await repos.collaborative.createAssignment({
      tenantId,
      classId,
      title,
      lessonId,
      dueDate: new Date(dueDate),
    });

    // Get all students enrolled in the target class
    const enrollments = await repos.users.findEnrollmentsByClass(classId, 'STUDENT');

    // Auto-create progress records for each student in the class
    if (enrollments.length > 0) {
      await repos.collaborative.createAssignmentProgressMany(
        enrollments.map(e => ({
          assignmentId: assignment.id,
          studentId: e.userId,
          isCompleted: false,
        }))
      );
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
    const repos = req.repos!;

    if (!classId || typeof classId !== 'string') {
      res.status(400).json({ error: 'classId パラメータが必要です。' });
      return;
    }

    const assignments = await repos.collaborative.findAssignmentsByClass(classId);

    const assignmentsWithStats = await Promise.all(
      assignments.map(async (a: any) => {
        const progresses = await repos.collaborative.findAssignmentProgresses(a.id);
        const completedCount = progresses.filter((p: any) => p.isCompleted).length;

        return {
          ...a,
          completedCount,
          totalCount: progresses.length,
        };
      })
    );

    res.json({ assignments: assignmentsWithStats });
  } catch (error) {
    console.error('Error fetching class assignments:', error);
    res.status(500).json({ error: '宿題一覧の取得中にエラーが発生しました。' });
  }
});

export default router;
