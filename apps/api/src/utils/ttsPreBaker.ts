import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const CACHE_DIR = path.join(__dirname, '../../public/cache/tts');

// Crucial phrases that we want pre-baked to eliminate cold-start or run-time latency
const PRE_BAKED_PHRASES = [
  { text: 'せいかい！すごいよ！🎉', emotion: 'excited' },
  { text: 'おしい！もういちど考えてみよう！💪', emotion: 'calm' },
  { text: 'いっしょに考えるモードに入ったよ！ここからはラッキョくんが少しずつ問いかけるから、ゆっくり考えてみてね。焦らなくて大丈夫だよ！🧅', emotion: 'calm' },
  { text: 'あれっ、もう少し優しい言葉を使ってみようかな？ Onion君も悲しんじゃうかも。🧅', emotion: 'calm' }
];

export async function preBakeTTS(): Promise<void> {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.info('ℹ️ No TTS API Key found. Writing mock pre-baked metadata only.');
      // Create empty mock or metadata placeholder just to indicate prebake ran
      fs.writeFileSync(path.join(CACHE_DIR, '.prebaked'), JSON.stringify({ prebakedAt: new Date().toISOString() }));
      return;
    }

    console.info(`🎙️ Pre-baking ${PRE_BAKED_PHRASES.length} critical TTS phrases...`);

    for (const phrase of PRE_BAKED_PHRASES) {
      const cleanText = phrase.text.replace(/<[^>]*>/g, '').trim();
      const hash = crypto.createHash('md5').update(cleanText + phrase.emotion).digest('hex');
      const fileName = `${hash}.mp3`;
      const filePath = path.join(CACHE_DIR, fileName);

      if (fs.existsSync(filePath)) {
        continue; // Already cached
      }

      const ttsUrl = 'https://texttospeech.googleapis.com/v1/text:synthesize';
      let speakingRate = 1.0;
      let pitch = 0.0;
      if (phrase.emotion === 'excited') {
        speakingRate = 1.1;
        pitch = 2.0;
      } else if (phrase.emotion === 'calm') {
        speakingRate = 0.95;
        pitch = -0.5;
      }

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
            name: 'ja-JP-Neural2-B'
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate,
            pitch
          }
        })
      });

      if (response.ok) {
        const data = await response.json() as any;
        if (data.audioContent) {
          const audioBuffer = Buffer.from(data.audioContent, 'base64');
          fs.writeFileSync(filePath, audioBuffer);
          console.info(`✓ Pre-baked TTS: "${phrase.text.substring(0, 10)}..." -> ${fileName}`);
        }
      } else {
        console.warn(`⚠️ Failed to pre-bake: "${phrase.text.substring(0, 10)}..."`, await response.text());
      }
    }

    console.info('🎙️ TTS Pre-baking complete.');
  } catch (error) {
    console.error('❌ Error pre-baking TTS phrases:', error);
  }
}
