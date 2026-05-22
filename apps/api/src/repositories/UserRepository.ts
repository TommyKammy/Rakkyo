import { User, Tenant, ClassEnrollment } from '@prisma/client';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  createUser(data: {
    id: string;
    tenantId: string;
    email: string;
    passwordHash: string;
    nickname: string;
    role: string;
    schoolYear: number;
    parentalConsent: boolean;
  }): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User>;
  deleteUser(id: string): Promise<User>;
  findTenantById(id: string): Promise<Tenant | null>;
  findTenantByCode(code: string): Promise<Tenant | null>;
  createTenant(data: {
    id: string;
    name: string;
    code: string;
    plan: string;
  }): Promise<Tenant>;
  findEnrollment(userId: string, role: string): Promise<(ClassEnrollment & { class: any }) | null>;
  findEnrollmentsByUser(userId: string, role: string): Promise<any[]>;
  findEnrollmentsByClass(classId: string, role: string): Promise<any[]>;
  createEnrollment(data: {
    id: string;
    classId: string;
    userId: string;
    role: string;
  }): Promise<ClassEnrollment>;
  deleteUserData(userId: string): Promise<void>; // 忘れられる権利
  findParentMessages(userId: string): Promise<any[]>;
  createParentMessage(userId: string, message: string): Promise<any>;
  markParentMessageAsRead(id: string): Promise<boolean>;
}
