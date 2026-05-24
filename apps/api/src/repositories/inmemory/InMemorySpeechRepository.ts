import { SpeechRepository } from '../SpeechRepository';
import { MicrophoneConsent, SpeechDailyQuota, PhonemeStruggle, SpeechAnalysis } from '@prisma/client';
import { inMemoryState } from './state';
import crypto from 'crypto';

export class InMemorySpeechRepository implements SpeechRepository {
  async findConsentByUserId(userId: string): Promise<MicrophoneConsent | null> {
    const consent = inMemoryState.microphoneConsents.find(c => c.userId === userId);
    return consent ? (consent as any as MicrophoneConsent) : null;
  }

  async saveConsent(data: {
    userId: string;
    consentVersion: string;
    userAgent: string;
    ipHash: string;
  }): Promise<MicrophoneConsent> {
    const existingIdx = inMemoryState.microphoneConsents.findIndex(c => c.userId === data.userId);
    const nowStr = new Date().toISOString();
    
    if (existingIdx !== -1) {
      const existing = inMemoryState.microphoneConsents[existingIdx];
      existing.consentVersion = data.consentVersion;
      existing.userAgent = data.userAgent;
      existing.ipHash = data.ipHash;
      existing.consentedAt = nowStr;
      return existing as any as MicrophoneConsent;
    } else {
      const newConsent = {
        id: 'consent_' + crypto.randomUUID(),
        ...data,
        consentedAt: nowStr,
        createdAt: nowStr
      };
      inMemoryState.microphoneConsents.push(newConsent);
      return newConsent as any as MicrophoneConsent;
    }
  }

  async findDailyQuota(userId: string, dayBucket: string): Promise<SpeechDailyQuota | null> {
    const quota = inMemoryState.speechDailyQuotas.find(
      q => q.userId === userId && q.dayBucket === dayBucket
    );
    return quota ? (quota as any as SpeechDailyQuota) : null;
  }

  async incrementDailyQuota(userId: string, dayBucket: string, resetAt: Date): Promise<SpeechDailyQuota> {
    const existing = inMemoryState.speechDailyQuotas.find(
      q => q.userId === userId && q.dayBucket === dayBucket
    );

    const nowStr = new Date().toISOString();
    if (existing) {
      existing.count += 1;
      existing.updatedAt = nowStr;
      return existing as any as SpeechDailyQuota;
    } else {
      const newQuota = {
        id: 'quota_' + crypto.randomUUID(),
        userId,
        dayBucket,
        count: 1,
        resetAt: resetAt.toISOString(),
        createdAt: nowStr,
        updatedAt: nowStr
      };
      inMemoryState.speechDailyQuotas.push(newQuota);
      return newQuota as any as SpeechDailyQuota;
    }
  }

  async findPhonemeStruggles(userId: string): Promise<PhonemeStruggle[]> {
    const struggles = inMemoryState.phonemeStruggles.filter(s => s.userId === userId);
    return struggles as any as PhonemeStruggle[];
  }

  async incrementPhonemeStruggle(userId: string, phoneme: string): Promise<PhonemeStruggle> {
    const existing = inMemoryState.phonemeStruggles.find(
      s => s.userId === userId && s.phoneme === phoneme
    );

    const nowStr = new Date().toISOString();
    if (existing) {
      existing.struggleCount += 1;
      existing.updatedAt = nowStr;
      return existing as any as PhonemeStruggle;
    } else {
      const newStruggle = {
        id: 'struggle_' + crypto.randomUUID(),
        userId,
        phoneme,
        struggleCount: 1,
        updatedAt: nowStr
      };
      inMemoryState.phonemeStruggles.push(newStruggle);
      return newStruggle as any as PhonemeStruggle;
    }
  }

  async createSpeechAnalysisAudit(userId: string, lessonId?: string | null): Promise<SpeechAnalysis> {
    const nowStr = new Date().toISOString();
    const newAudit = {
      id: 'audit_' + crypto.randomUUID(),
      userId,
      lessonId: lessonId || null,
      audioDeletedAt: null,
      createdAt: nowStr
    };
    inMemoryState.speechAnalyses.push(newAudit);
    return newAudit as any as SpeechAnalysis;
  }

  async updateSpeechAnalysisAuditDeleted(id: string, deletedAt: Date): Promise<SpeechAnalysis> {
    const audit = inMemoryState.speechAnalyses.find(a => a.id === id);
    if (!audit) {
      throw new Error(`SpeechAnalysis audit not found: ${id}`);
    }
    audit.audioDeletedAt = deletedAt.toISOString();
    return audit as any as SpeechAnalysis;
  }
}
