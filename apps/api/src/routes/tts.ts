import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { authMiddleware, AuthenticatedRequest } from '../middlewares/auth';
import { SafetyFilter } from '@rakkyo/ai-tutor';

const router = Router();

const CACHE_DIR = path.join(__dirname, '../../public/cache/tts');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Quota Manager — daily limit of 500 requests per user.
//
// NOTE: This is intentionally an in-process Map for the current
// single-instance deployment. The moment we scale horizontally
// (multiple API replicas behind a load balancer) this must move to
// Redis (or another shared store) so the per-user quota is global
// rather than per-replica.
// TODO(phase-16): swap the Map below for ioredis-backed counters
// keyed by `tts:quota:${userId}:${todayStr}` with INCR + EXPIRE.
class QuotaManager {
  private dailyUsage = new Map<string, { count: number; dateStr: string }>();

  isQuotaExceeded(userId: string): boolean {
    const todayStr = new Date().toISOString().split('T')[0];
    const usage = this.dailyUsage.get(userId);
    if (!usage || usage.dateStr !== todayStr) {
      this.dailyUsage.set(userId, { count: 1, dateStr: todayStr });
      return false;
    }
    if (usage.count >= 500) {
      return true;
    }
    usage.count += 1;
    return false;
  }
}
const quotaManager = new QuotaManager();

// LRU cache eviction (Max 1GB)
function evictCacheIfNeeded() {
  try {
    if (!fs.existsSync(CACHE_DIR)) return;
    const files = fs.readdirSync(CACHE_DIR)
      .map(file => {
        const filePath = path.join(CACHE_DIR, file);
        const stats = fs.statSync(filePath);
        return { name: file, path: filePath, size: stats.size, mtime: stats.mtimeMs };
      })
      .filter(f => f.name.endsWith('.mp3'));

    let totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const limit = 1024 * 1024 * 1024; // 1GB

    if (totalSize > limit) {
      // Sort by mtime (oldest first)
      files.sort((a, b) => a.mtime - b.mtime);
      for (const file of files) {
        if (totalSize <= limit) break;
        fs.unlinkSync(file.path);
        totalSize -= file.size;
        console.log(`[TTS Cache Eviction] Removed old cache file: ${file.name}`);
      }
    }
  } catch (err) {
    console.error('Error during TTS cache eviction:', err);
  }
}

// REST API endpoint to generate/get TTS audio (Protected)
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    
    // Check Daily Quota (500 per day)
    if (quotaManager.isQuotaExceeded(userId)) {
      return res.status(429).json({ error: '今日の読み上げクォータ（500回）を超過しました。明日また使ってね 🧅' });
    }

    const { text, emotion } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: '読み上げテキストを入力してください。' });
    }

    // Safety checks
    if (text.length > 200) {
      return res.status(400).json({ error: '読み上げるテキストは200文字以内で入力してください。🧅' });
    }

    const cleanText = text.replace(/<[^>]*>/g, '').trim(); // Remove simple markup
    if (!cleanText) {
      return res.status(400).json({ error: 'テキストが空です。' });
    }

    if (SafetyFilter.isAbusive(cleanText)) {
      return res.status(400).json({ error: '不適切な言葉が含まれています。 Onion君も悲しんじゃうかも。🧅' });
    }

    // Choose voice configuration depending on emotion
    let speakingRate = 1.0;
    let pitch = 0.0;
    if (emotion === 'happy') {
      speakingRate = 1.05;
      pitch = 1.5;
    } else if (emotion === 'calm') {
      speakingRate = 0.95;
      pitch = -0.5;
    } else if (emotion === 'excited') {
      speakingRate = 1.1;
      pitch = 2.0;
    }

    // Compute MD5 hash of voice settings to check cache
    const version = 'v1';
    const hash = crypto.createHash('md5')
      .update(`${cleanText}:${emotion || 'neutral'}:${speakingRate}:${pitch}:${version}`)
      .digest('hex');
    const fileName = `${hash}.mp3`;
    const filePath = path.join(CACHE_DIR, fileName);

    // 1. Check if cached file exists
    if (fs.existsSync(filePath)) {
      return res.json({
        success: true,
        url: `/cache/tts/${fileName}`,
        cached: true
      });
    }

    // 2. TTS API key check
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      // Return fallback response to client to use Web Speech API
      return res.json({
        success: false,
        fallbackToWebSpeech: true,
        reason: 'API_KEY_NOT_FOUND'
      });
    }

    // 3. Request Google Cloud Text-to-Speech REST API directly.
    // The API key is sent via the X-Goog-Api-Key header rather than the
    // URL query string so it cannot leak into access logs / Sentry / CDN
    // logs / browser history.
    const ttsUrl = 'https://texttospeech.googleapis.com/v1/text:synthesize';

    const response = await fetch(ttsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify({
        input: { text: cleanText },
        voice: {
          languageCode: 'ja-JP',
          name: 'ja-JP-Neural2-B' // Clear and cheerful male voice for Rakkyo-kun
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate,
          pitch
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn('Google TTS API Error Response:', errorText);
      return res.json({
        success: false,
        fallbackToWebSpeech: true,
        reason: 'TTS_API_ERROR',
        details: errorText
      });
    }

    const data = await response.json() as any;
    if (!data.audioContent) {
      return res.json({
        success: false,
        fallbackToWebSpeech: true,
        reason: 'NO_AUDIO_CONTENT'
      });
    }

    // Decode base64 audioContent and write to cache file
    const audioBuffer = Buffer.from(data.audioContent, 'base64');
    
    // Evict old cache if limit reached
    evictCacheIfNeeded();
    
    fs.writeFileSync(filePath, audioBuffer);

    res.json({
      success: true,
      url: `/cache/tts/${fileName}`,
      cached: false
    });

  } catch (error: any) {
    console.error('TTS Route Error:', error);
    res.json({
      success: false,
      fallbackToWebSpeech: true,
      reason: 'SERVER_ERROR',
      details: error.message
    });
  }
});

export default router;
