import { AiTutorProvider, HintContext, HintResult, MockAiTutorProvider } from '../adapter';

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
      
      const systemInstruction = `
あなたは中学1年生向けの優しくフレンドリーな数学のAI家庭教師「ラッキョくん」です。
ユーザー（中学1年生）が数学の問題を解くのを助けるために、適切なヒントを提供します。

【超重要制約ルール】
1. 絶対に正解（数値や最終的な答え）を直接教えてはいけません！
2. 絶対に最終的な計算式（例: -5 + 3 = -2 など）そのものを教えないでください！
3. 優しく、ひらがなを交えながら、やる気を引き出すように励ましてください。語尾は「〜だよ」「〜かな？」などを使い、親しみやすいキャラクターとして振る舞ってください。

【ヒントの3つの段階】
今回生成すべきヒントは「ステージ ${nextStage}」です。以下のルールに従って1つだけのヒントを生成してください：

- ステージ 1（hintsUsed = 0 のとき）: 問題のいいかえ
  - 答えや計算式には一切触れず、問題に出てくる数学用語の意味や、「何を聞かれているのか」を優しく噛み砕いて整理してあげてください。
- ステージ 2（hintsUsed = 1 のとき）: 考え方の図解・比喩
  - 概念を理解するための視覚的なイメージ（数直線、天秤、プラスとマイナスの玉の打ち消し合いなど）を使って説明してください。具体的な計算式は示さないでください。
- ステージ 3（hintsUsed = 2 のとき）: 解き方のステップ
  - 答えを導くための手順（ステップ1、ステップ2）を説明してください。「まず符号を決めよう」「次に絶対値を計算しよう」のように誘導し、最後の計算自体はユーザー自身に行わせてください。
`;

      const promptText = `
【問題】
${context.prompt}

【この問題の解説（参考情報）】
${context.explanation}

【正解（非公開）】
${context.answers.join(' または ')}

【既に提示されたヒントの数】
${context.hintsUsed}

【ステージ】
ステージ ${nextStage} のヒントを生成してください。答えは絶対に含めないでください。
`;

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
      let sanitizedText = hintText;
      for (const answer of context.answers) {
        // If the LLM accidentally leaked the exact raw answer, strip it or fallback
        if (hintText.includes(`答えは ${answer}`) || hintText.includes(`＝ ${answer}`) || hintText.includes(`= ${answer}`)) {
          console.warn('⚠️ Leaked answer detected in Gemini response. Triggering mock fallback.');
          return this.mockFallback.generateHint(context);
        }
      }

      return {
        hintText: sanitizedText,
        stage: nextStage,
        isMock: false
      };

    } catch (apiError) {
      console.warn('❌ Gemini API call failed. Falling back to MockAiTutorProvider.', apiError);
      return this.mockFallback.generateHint(context);
    }
  }
}
