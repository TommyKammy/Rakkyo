import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const router = Router();

const CACHE_DIR = path.join(__dirname, '../../public/cache/tts');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// REST API endpoint to generate/get TTS audio
router.post('/', async (req: Request, res: Response) => {
  try {
    const { text, emotion } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: '読み上げテキストを入力してください。' });
    }

    const cleanText = text.replace(/<[^>]*>/g, '').trim(); // Remove simple markup
    if (!cleanText) {
      return res.status(400).json({ error: 'テキストが空です。' });
    }

    // Compute MD5 hash of clean text to check cache
    const hash = crypto.createHash('md5').update(cleanText + (emotion || '')).digest('hex');
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

    // 3. Request Google Cloud Text-to-Speech REST API directly
    const ttsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
    
    // Choose voice configuration depending on emotion (default is neutral/friendly male voice for Rakkyo-kun)
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

    const response = await fetch(ttsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
