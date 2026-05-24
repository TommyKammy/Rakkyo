import { MicrophoneConsent, SpeechDailyQuota, PhonemeStruggle, SpeechAnalysis } from '@prisma/client';

export interface SpeechRepository {
  findConsentByUserId(userId: string): Promise<MicrophoneConsent | null>;
  saveConsent(data: {
    userId: string;
    consentVersion: string;
    userAgent: string;
    ipHash: string;
  }): Promise<MicrophoneConsent>;
  
  findDailyQuota(userId: string, dayBucket: string): Promise<SpeechDailyQuota | null>;
  incrementDailyQuota(userId: string, dayBucket: string, resetAt: Date): Promise<SpeechDailyQuota>;
  
  findPhonemeStruggles(userId: string): Promise<PhonemeStruggle[]>;
  incrementPhonemeStruggle(userId: string, phoneme: string): Promise<PhonemeStruggle>;
  
  createSpeechAnalysisAudit(userId: string, lessonId?: string | null): Promise<SpeechAnalysis>;
  updateSpeechAnalysisAuditDeleted(id: string, deletedAt: Date): Promise<SpeechAnalysis>;
}
