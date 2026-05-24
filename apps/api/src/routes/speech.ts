import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth';
import { z } from 'zod';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { speechAnalysisService } from '../services/SpeechAnalysisService';
import { SPEECH_TEMP_DIR } from '../services/SpeechFileSweeper';

const router = Router();

const consentSchema = z.object({
  consentVersion: z.string().max(50),
  userAgent: z.string().max(255)
});

const settingsSchema = z.object({
  speechAnalysisEnabled: z.boolean()
});

const consentOptInSchema = z.object({
  speechAnalyticsConsent: z.boolean()
});

const analyzeSchema = z.object({
  audioBase64: z.string(),
  expectedText: z.string().min(1).max(500),
  languageCode: z.enum(['en-US', 'ja-JP']),
  lessonId: z.string().uuid().optional()
});

// 1. POST /api/speech/consent - Record microphone safety consent
router.post('/consent', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { consentVersion, userAgent } = consentSchema.parse(req.body);
    const userId = req.user!.id;
    const repos = req.repos!;
    
    // Hash IP address to prevent PII exposure in the database logs (standards-compliant)
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const ipHash = crypto.createHash('sha256').update(clientIp).digest('hex');

    const consent = await repos.speech.saveConsent({
      userId,
      consentVersion,
      userAgent,
      ipHash
    });

    res.json({ success: true, consent });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors });
    }
    console.error('Error saving microphone consent:', err);
    res.status(500).json({ error: 'マイク同意情報の保存中にエラーが発生しました。' });
  }
});

// 2. POST /api/speech/settings - Toggle speech analysis enabled/disabled (inclusion override)
router.post('/settings', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { speechAnalysisEnabled } = settingsSchema.parse(req.body);
    const userId = req.user!.id;
    const repos = req.repos!;

    const updatedUser = await repos.users.updateUser(userId, {
      speechAnalysisEnabled
    });

    res.json({
      success: true,
      speechAnalysisEnabled: updatedUser.speechAnalysisEnabled
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors });
    }
    console.error('Error saving speech settings:', err);
    res.status(500).json({ error: '音声分析設定の保存中にエラーが発生しました。' });
  }
});

// 3. POST /api/speech/consent-opt-in - Toggle parent speech tracking opt-in/opt-out
router.post('/consent-opt-in', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { speechAnalyticsConsent } = consentOptInSchema.parse(req.body);
    const userId = req.user!.id;
    const repos = req.repos!;

    const updatedUser = await repos.users.updateUser(userId, {
      speechAnalyticsConsent
    });

    res.json({
      success: true,
      speechAnalyticsConsent: updatedUser.speechAnalyticsConsent
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors });
    }
    console.error('Error saving consent opt-in settings:', err);
    res.status(500).json({ error: 'つまずき診断の同意設定中にエラーが発生しました。' });
  }
});

// 4. POST /api/speech/analyze - Analyze pronunciation with strict 7-second audio self-destruction
router.post('/analyze', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const repos = req.repos!;
  
  let tempFilePath = '';
  let auditRecordId = '';

  try {
    // A. Parse request payload
    const { audioBase64, expectedText, languageCode, lessonId } = analyzeSchema.parse(req.body);
    
    // B. Check speech analysis inclusion override flag (Constraint C-8)
    const userRecord = await repos.users.findById(userId);
    if (!userRecord) {
      return res.status(404).json({ error: 'ユーザーが見つかりません。' });
    }

    if (!userRecord.speechAnalysisEnabled) {
      // In dry-run mode, we return a mock fallback without verifying consents, charging quotas, or running STT
      return res.json({
        success: true,
        dryRun: true,
        words: expectedText.trim().split(/\s+/).map(w => ({
          word: w.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ""),
          phonemes: [{ phoneme: 'any', level: 'strong' }]
        }))
      });
    }

    // C. Verify microphone safety consent (Constraint C-5: yield 403 if missing)
    const consent = await repos.speech.findConsentByUserId(userId);
    if (!consent) {
      return res.status(403).json({
        error: 'マイク使用への同意が得られていません。先に同意手続きを行ってください。'
      });
    }

    // D. Enforce atomic daily request quota cap of 50 per user (Constraint C-2)
    // Anchored JST timezone day bucket (JST = UTC + 9)
    const jstTime = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const dayBucket = jstTime.toISOString().split('T')[0];
    
    // We compute JST midnight for next quota bucket reset time
    const nextJstMidnight = new Date(jstTime);
    nextJstMidnight.setUTCHours(24, 0, 0, 0);
    const nextUtcReset = new Date(nextJstMidnight.getTime() - 9 * 60 * 60 * 1000);

    const quota = await repos.speech.findDailyQuota(userId, dayBucket);
    if (quota && quota.count >= 50) {
      return res.status(429).json({
        error: '本日の発音練習の上限（50回）に達しました。また明日練習しましょう！ Onion 🧅'
      });
    }

    // E. Max 30 seconds audio size verification (Constraint C-2)
    // 30 seconds 16kHz 16-bit PCM WAV is ~960KB; Base64 size of 960KB is ~1.28MB.
    // Assert maximum string length of 1.5MB to safeguard S3 files and compute cost bounds.
    if (audioBase64.length > 1500000) {
      return res.status(400).json({ error: '録音時間は最大30秒までです。' });
    }

    const audioBuffer = Buffer.from(audioBase64, 'base64');
    // Sanity check empty files
    if (audioBuffer.length === 0) {
      return res.status(400).json({ error: '音声データが空です。' });
    }

    // F. Symmetrical Deletion Audit Logging (Constraint C-1)
    const audit = await repos.speech.createSpeechAnalysisAudit(userId, lessonId);
    auditRecordId = audit.id;

    // G. Write temporary WAV file to safe local buffer dir (UUID opaque keys to protect student PII)
    if (!fs.existsSync(SPEECH_TEMP_DIR)) {
      fs.mkdirSync(SPEECH_TEMP_DIR, { recursive: true });
    }
    const fileUUID = crypto.randomUUID();
    tempFilePath = path.join(SPEECH_TEMP_DIR, `speech_${fileUUID}.wav`);
    fs.writeFileSync(tempFilePath, audioBuffer);

    // H. Increment quota atomically
    await repos.speech.incrementDailyQuota(userId, dayBucket, nextUtcReset);

    // I. Speech-to-Text Phoneme Alignment Processing
    const analysisResult = await speechAnalysisService.analyzePronunciation(
      tempFilePath,
      expectedText,
      languageCode
    );

    // J. Parent Analytics Opt-In: Accumulate Phoneme Struggles (Constraint C-4: default OFF)
    if (userRecord.speechAnalyticsConsent) {
      for (const w of analysisResult.words) {
        for (const p of w.phonemes) {
          if (p.level === 'unclear' || p.level === 'soft') {
            await repos.speech.incrementPhonemeStruggle(userId, p.phoneme);
          }
        }
      }
    }

    res.json({
      success: true,
      words: analysisResult.words
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors });
    }
    console.error('Error during pronunciation analysis:', err);
    res.status(500).json({ error: '音声解析の実行中にエラーが発生しました。' });
  } finally {
    // K. Concentric Defense 1: Synchronous Physical self-destruction of raw voice files (Constraint C-1)
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.info(`[Speech API] Synchronously unlinked temporary file: ${tempFilePath}`);
      } catch (unlinkErr) {
        console.error(`[Speech API] Failed to synchronously unlink ${tempFilePath}:`, unlinkErr);
      }
    }

    // L. Update Deletion Audit Trail
    if (auditRecordId) {
      try {
        await repos.speech.updateSpeechAnalysisAuditDeleted(auditRecordId, new Date());
      } catch (auditErr) {
        console.error(`[Speech API] Failed to update deletion audit trail for ${auditRecordId}:`, auditErr);
      }
    }
  }
});

export default router;
