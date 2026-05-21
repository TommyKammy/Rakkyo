import { AiTutorProvider, MockAiTutorProvider } from './adapter';
import { GeminiAiTutorProvider } from './providers/gemini';

export class AiTutorProviderFactory {
  static getProvider(): AiTutorProvider {
    const providerType = (process.env.AI_PROVIDER || 'gemini').toLowerCase().trim();

    if (providerType === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn('⚠️ GEMINI_API_KEY is not defined in environments. Falling back to MockAiTutorProvider.');
        return new MockAiTutorProvider();
      }
      return new GeminiAiTutorProvider();
    }

    // Default or mock fallback
    return new MockAiTutorProvider();
  }
}
