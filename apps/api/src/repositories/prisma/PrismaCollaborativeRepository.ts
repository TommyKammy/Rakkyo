import { CollaborativeRepository } from '../CollaborativeRepository';
import prisma from '../../db';

export class PrismaCollaborativeRepository implements CollaborativeRepository {
  async findPeerStampsReceived(userId: string): Promise<any[]> {
    const received = await prisma.peerStamp.findMany({
      where: { receiverId: userId },
      include: { sender: true },
      orderBy: { createdAt: 'desc' }
    });
    return received.map(s => ({
      id: s.id,
      senderId: s.senderId,
      sender: {
        nickname: s.sender.nickname
      },
      stampType: s.stampType,
      createdAt: s.createdAt.toISOString()
    }));
  }

  async findPeerStampsSent(userId: string): Promise<any[]> {
    const sent = await prisma.peerStamp.findMany({
      where: { senderId: userId },
      include: { receiver: true },
      orderBy: { createdAt: 'desc' }
    });
    return sent.map(s => ({
      id: s.id,
      receiverId: s.receiverId,
      receiver: {
        nickname: s.receiver.nickname
      },
      stampType: s.stampType,
      createdAt: s.createdAt.toISOString()
    }));
  }

  async createPeerStamp(data: {
    senderId: string;
    receiverId: string;
    stampType: string;
  }): Promise<any> {
    return prisma.peerStamp.create({
      data
    });
  }

  async findClassMissions(classId: string): Promise<any[]> {
    return prisma.classMission.findMany({
      where: { classId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createClassMission(data: {
    id: string;
    classId: string;
    title: string;
    targetMinutes: number;
    currentMinutes: number;
    dueDate: Date;
  }): Promise<any> {
    return prisma.classMission.create({
      data
    });
  }

  async incrementClassMissionMinutes(classId: string, minutes: number): Promise<void> {
    // If a mission exists, increment currentMinutes
    await prisma.classMission.updateMany({
      where: { classId },
      data: {
        currentMinutes: {
          increment: minutes
        }
      }
    });
  }

  async findHiramekiTips(classId: string): Promise<any[]> {
    return prisma.hiramekiTip.findMany({
      where: { classId, isSafe: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createHiramekiTip(data: {
    classId: string;
    userId: string;
    nickname: string;
    content: string;
    isSafe: boolean;
  }): Promise<any> {
    return prisma.hiramekiTip.create({
      data
    });
  }

  async createParentalCelebration(data: {
    childId: string;
    attemptId: string;
    token: string;
    isResponded: boolean;
    expiresAt: Date;
  }): Promise<any> {
    return prisma.parentalCelebration.create({
      data
    });
  }

  async findParentalCelebrationByToken(token: string): Promise<any | null> {
    return prisma.parentalCelebration.findUnique({
      where: { token },
      include: {
        child: true,
        attempt: {
          include: {
            question: true
          }
        }
      }
    });
  }

  async updateParentalCelebration(token: string, data: {
    parentStamp: string;
    parentComment: string | null;
    isResponded: boolean;
  }): Promise<any> {
    return prisma.parentalCelebration.update({
      where: { token },
      data
    });
  }

  async createParentMessage(userId: string, message: string): Promise<any> {
    return prisma.parentMessage.create({
      data: {
        userId,
        message,
        isRead: false
      }
    });
  }

  async findParentMessages(userId: string): Promise<any[]> {
    return prisma.parentMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async markParentMessagesAsRead(userId: string): Promise<void> {
    await prisma.parentMessage.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });
  }

  async createAssignment(data: {
    tenantId: string;
    classId: string;
    title: string;
    lessonId: string;
    dueDate: Date;
  }): Promise<any> {
    return prisma.assignment.create({
      data
    });
  }

  async findAssignmentsByClass(classId: string): Promise<any[]> {
    return prisma.assignment.findMany({
      where: { classId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createAssignmentProgressMany(progresses: {
    assignmentId: string;
    studentId: string;
    isCompleted: boolean;
  }[]): Promise<void> {
    await prisma.studentAssignmentProgress.createMany({
      data: progresses
    });
  }

  async findAssignmentProgresses(assignmentId: string): Promise<any[]> {
    return prisma.studentAssignmentProgress.findMany({
      where: { assignmentId }
    });
  }

  async createSafetyAlert(data: {
    childUserId: string;
    alertType: string;
    payload: string;
  }): Promise<any> {
    return (prisma as any).safetyAlert.create({
      data: {
        childUserId: data.childUserId,
        alertType: data.alertType,
        payload: data.payload,
        status: 'QUEUED'
      }
    });
  }

  async findSafetyAlertsByChild(childUserId: string): Promise<any[]> {
    return (prisma as any).safetyAlert.findMany({
      where: { childUserId },
      orderBy: { createdAt: 'desc' }
    });
  }
}
