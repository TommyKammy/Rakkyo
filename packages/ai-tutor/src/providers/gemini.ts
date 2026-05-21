import { AiTutorProvider, HintContext, HintResult, MockAiTutorProvider } from '../adapter';
import { SubjectPromptRouter } from '../router';
import { SafetyFilter } from '../safety';

export class GeminiAiTutorProvider implements AiTutorProvider {
  private apiKey: string | undefined;
  private mockFallback: MockAiTutorProvider;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.mockFallback = new MockAiTutorProvider();
  }

  async generateHint(context: HintContext): Promise<HintResult> {
    const nextStage = (Math.min(3, Math.max(1, context.hintsUsed + 1))) as 1 | 2 | 3;

    // Fallback if API key is not configured
    if (!this.apiKey) {
      console.warn('⚠️ GEMINI_API_KEY is not defined. Falling back to MockAiTutorProvider.');
      return this.mockFallback.generateHint(context);
    }

    try {
      // Dynamic import to prevent runtime crash if SDK package is not installed/loaded
      const { GoogleGenAI } = await import('@google/genai');
      
      const ai = new GoogleGenAI({ apiKey: this.apiKey });
      
      const promptConfig = SubjectPromptRouter.getPromptConfig(context.subjectCode || 'math');
      const sanitizedPrompt = SafetyFilter.sanitizeInput(context.prompt);
      const sanitizedUserQuestion = context.userQuestion
        ? SafetyFilter.sanitizeInput(context.userQuestion)
        : undefined;

      const systemInstruction = `
${promptConfig.systemInstruction}

${promptConfig.getHintInstruction(nextStage)}
`;

      let promptText = `
【問題】
${sanitizedPrompt}

【この問題の解説（参考情報）】
${context.explanation}

【正解（非公開）】
${context.answers.join(' または ')}

【既に提示されたヒントの数】
${context.hintsUsed}
`;

      if (sanitizedUserQuestion) {
        promptText += `
【生徒からの追加質問】
生徒が直接あなたに質問をしてきました。この質問に対して、直接の答えを教えずに、数学のAI家庭教師「ラッキョくん」の中学生向けフレンドリーな口調（「〜だよ」「〜かな？」）で優しく解説・ヒントを答えてください。
質問: "${sanitizedUserQuestion}"
`;
      } else {
        promptText += `
【ステージ】
ステージ ${nextStage} のヒントを生成してください。答えは絶対に含めないでください。
`;
      }

      // Call Google Gemini API (gemini-2.5-flash or gemini-2.0-flash is the standard rapid model)
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: promptText,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        }
      });

      const hintText = response.text || '';
      
      // Sanitization: Double check to prevent answer leak in generated text
      if (SafetyFilter.isAnswerLeaked(hintText, context.answers)) {
        console.warn('⚠️ Leaked answer detected in Gemini response. Triggering mock fallback.');
        return this.mockFallback.generateHint(context);
      }

      return {
        hintText: hintText,
        stage: nextStage,
        isMock: false
      };

    } catch (apiError) {
      console.warn('❌ Gemini API call failed. Falling back to MockAiTutorProvider.', apiError);
      return this.mockFallback.generateHint(context);
    }
  }
}
