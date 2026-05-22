import { useCallback } from 'react';

export type RakkyoEmotion = 'correct' | 'incorrect' | 'celebrate' | 'neutral';

export function useRakkyoVoice() {
  const speak = useCallback((text: string, emotion: RakkyoEmotion = 'neutral', onEnd?: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('⚠️ Web Speech API is not supported in this environment.');
      return;
    }

    // Cancel any ongoing speech first to avoid overlapping voices
    window.speechSynthesis.cancel();

    // Clean text: remove markdown like bold **, LaTeX symbols $, etc., for a natural voice
    const cleanText = text
      .replace(/\*\*/g, '')
      .replace(/\$/g, '')
      .replace(/🧅/g, '')
      .replace(/🤩/g, '')
      .replace(/🤔/g, '')
      .replace(/⚡/g, '')
      .replace(/🔥/g, '')
      .replace(/🧮/g, '')
      .replace(/🌟/g, '')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);

    if (onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
    }

    // Find a Japanese voice
    const voices = window.speechSynthesis.getVoices();
    const jaVoice = voices.find(voice => voice.lang.startsWith('ja') || voice.lang.includes('JP'));
    if (jaVoice) {
      utterance.voice = jaVoice;
    }

    // Emotion parameter tuning
    switch (emotion) {
      case 'correct':
        utterance.pitch = 1.4;
        utterance.rate = 1.25;
        utterance.volume = 1.0;
        break;
      case 'incorrect':
        utterance.pitch = 0.95;
        utterance.rate = 0.95;
        utterance.volume = 0.9;
        break;
      case 'celebrate':
        utterance.pitch = 1.5;
        utterance.rate = 1.35;
        utterance.volume = 1.0;
        break;
      case 'neutral':
      default:
        utterance.pitch = 1.1;
        utterance.rate = 1.05;
        utterance.volume = 1.0;
        break;
    }

    window.speechSynthesis.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return { speak, stop };
}

