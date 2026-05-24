import { SpeechRepository } from '../SpeechRepository';
import { MicrophoneConsent, SpeechDailyQuota, PhonemeStruggle, SpeechAnalysis } from '@prisma/client';
import prisma from '../../db';

export class PrismaSpeechRepository implements SpeechRepository {
  async findConsentByUserId(userId: string): Promise<MicrophoneConsent | null> {
    return prisma.microphoneConsent.findUnique({
      where: { userId }
    });
  }

  async saveConsent(data: {
    userId: string;
    consentVersion: string;
    userAgent: string;
    ipHash: string;
  }): Promise<MicrophoneConsent> {
    return prisma.microphoneConsent.upsert({
      where: { userId: data.userId },
      create: data,
      update: {
        consentVersion: data.consentVersion,
        userAgent: data.userAgent,
        ipHash: data.ipHash,
        consentedAt: new Date()
      }
    });
  }

  async findDailyQuota(userId: string, dayBucket: string): Promise<SpeechDailyQuota | null> {
    return prisma.speechDailyQuota.findUnique({
      where: {
        userId_dayBucket: { userId, dayBucket }
      }
    });
  }

  async incrementDailyQuota(userId: string, dayBucket: string, resetAt: Date): Promise<SpeechDailyQuota> {
    // Wrap in serializable transaction to prevent concurrent quota races
    return prisma.$transaction(async (tx) => {
      const existing = await tx.speechDailyQuota.findUnique({
        where: {
          userId_dayBucket: { userId, dayBucket }
        }
      });

      if (existing) {
        return tx.speechDailyQuota.update({
          where: { id: existing.id },
          data: {
            count: { increment: 1 }
          }
        });
      } else {
        return tx.speechDailyQuota.create({
          data: {
            userId,
            dayBucket,
            count: 1,
            resetAt
          }
        });
      }
    }, { isolationLevel: 'Serializable' });
  }

  async findPhonemeStruggles(userId: string): Promise<PhonemeStruggle[]> {
    return prisma.phonemeStruggle.findMany({
      where: { userId }
    });
  }

  async incrementPhonemeStruggle(userId: string, phoneme: string): Promise<PhonemeStruggle> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.phonemeStruggle.findUnique({
        where: {
          userId_phoneme: { userId, phoneme }
        }
      });

      if (existing) {
        return tx.phonemeStruggle.update({
          where: { id: existing.id },
          data: {
            struggleCount: { increment: 1 }
          }
        });
      } else {
        return tx.phonemeStruggle.create({
          data: {
            userId,
            phoneme,
            struggleCount: 1
          }
        });
      }
    }, { isolationLevel: 'Serializable' });
  }

  async createSpeechAnalysisAudit(userId: string, lessonId?: string | null): Promise<SpeechAnalysis> {
    return prisma.speechAnalysis.create({
      data: {
        userId,
        lessonId: lessonId || null,
        audioDeletedAt: null
      }
    });
  }

  async updateSpeechAnalysisAuditDeleted(id: string, deletedAt: Date): Promise<SpeechAnalysis> {
    return prisma.speechAnalysis.update({
      where: { id },
      data: {
        audioDeletedAt: deletedAt
      }
    });
  }
}
