import { AiTutorProvider, HintContext, HintResult, MockAiTutorProvider, DiagnoseContext, DiagnosisResult, SimilarQuestionContext, SimilarQuestionResult, RecommendationContext, RecommendationResult } from '../adapter';
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

      let systemInstruction = `
${promptConfig.systemInstruction}

${promptConfig.getHintInstruction(nextStage)}
`;

      if (context.isSocratic) {
        systemInstruction += `
【超重要: ソクラテス式問いかけモード】
現在、生徒は自分で考えずにヒントボタンを連打している傾向（ヒント依存）にあります。
答えのヒントや解き方の具体的なステップを直接説明するのではなく、逆に優しく問いかけて、生徒自身に考えさせてください。
例えば、「〜の部分はどうなるかな？」「まずはここを計算してみよう！」など、生徒に短いアウトプットや最初の小さなステップを促す問いかけを1つだけ行い、自分で考えさせるように誘導してください。
`;
      }

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

  async diagnoseMistake(context: DiagnoseContext): Promise<DiagnosisResult> {
    if (!this.apiKey) {
      return this.mockFallback.diagnoseMistake(context);
    }

    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: this.apiKey });

      const promptConfig = SubjectPromptRouter.getPromptConfig(context.subjectCode || 'math');

      const systemInstruction = `
${promptConfig.systemInstruction}

【あなたのタスク】
生徒の誤答を精密に分析し、つまずきを診断してください。
1. 生徒の誤答（answerSubmitted）が、単なる符号の付け忘れや単純な掛け算ミスなどの「ケアレスミス（careless_mistake）」なのか、
   それとも正負の数の四則演算や文字式の同類項のまとめ方などの根本的な公式・概念の理解不足（conceptual_error）なのかを判別してください。
2. 生徒に向けて、診断結果とこれからのアドバイスを、ラッキョくんの優しく温かい口調（「〜だよ」「〜かな？」）で語りかけてください。
   答えは教えず、つまずいたポイントに優しく気づかせてあげるような診断テキストにしてください。

【出力フォーマット】
以下のJSONフォーマットで回答してください。
{
  "errorType": "careless_mistake" または "conceptual_error",
  "aiDiagnosis": "ラッキョくんからの優しい診断メッセージ"
}
`;

      const promptText = `
【問題】
${context.prompt}

【解説】
${context.explanation}

【正解】
${context.answers.join(' または ')}

【生徒の誤答】
${context.answerSubmitted}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: promptText,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.5,
          responseMimeType: 'application/json',
        }
      });

      const resText = response.text || '';
      const parsed = JSON.parse(resText);

      return {
        errorType: parsed.errorType === 'conceptual_error' ? 'conceptual_error' : 'careless_mistake',
        aiDiagnosis: parsed.aiDiagnosis || '惜しい！もう一度ゆっくり考えてみてね。',
        isMock: false
      };

    } catch (error) {
      console.warn('❌ Gemini diagnoseMistake failed. Falling back to mock.', error);
      return this.mockFallback.diagnoseMistake(context);
    }
  }

  async generateSimilarQuestion(context: SimilarQuestionContext): Promise<SimilarQuestionResult> {
    if (!this.apiKey) {
      return this.mockFallback.generateSimilarQuestion(context);
    }

    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: this.apiKey });

      const promptConfig = SubjectPromptRouter.getPromptConfig(context.subjectCode || 'math');

      const systemInstruction = `
あなたは中学1年生向けの優しくフレンドリーな数学のAI家庭教師「ラッキョくん」です。
生徒のつまずき状況（errorType, aiDiagnosis）をもとに、つまずきを解消するための類題（スモールステップ問題）を1問動的に生成してください。

【問題作成のガイドライン】
1. 元の問題とよく似たテーマ・難易度の問題（または一歩難易度を下げたスモールステップ問題）を作成してください。
2. 問題形式は、元の問題と同様の「NUMBER_INPUT（数値入力式）」または「TEXT_SHORT（テキスト入力）」に適した形にしてください。
3. LaTeX形式（例: $-3 + 5$ などの $ マークで囲む形式）を適切に使用して、数式を描画してください。
4. 丁寧な解説（explanation）と、3つの段階的なヒント（hints。ヒント1: 問題のいいかえ、ヒント2: 図解や比喩、ヒント3: 解き方のステップ。答えは絶対に書かないこと）を作成してください。

【出力フォーマット】
以下のJSONフォーマットで回答してください。
{
  "prompt": "問題文（LaTeXを適切に使用してください）",
  "answers": ["許容する正解文字列1", "許容する正解文字列2"],
  "options": [],
  "explanation": "丁寧な解説",
  "hints": [
    "ヒントステージ1（問題のいいかえ・言葉の整理）",
    "ヒントステージ2（視覚的イメージ・数直線などの比喩）",
    "ヒントステージ3（答えを出す直前までのステップ）"
  ]
}
`;

      const promptText = `
【元の問題】
${context.prompt}

【正解】
${context.answers.join(' または ')}

【生徒のつまずき傾向】
エラー分類: ${context.errorType}
診断内容: ${context.aiDiagnosis}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: promptText,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
          responseMimeType: 'application/json',
        }
      });

      const resText = response.text || '';
      const parsed = JSON.parse(resText);

      return {
        prompt: parsed.prompt || '$-3 + 5$ を計算しなさい。',
        answers: parsed.answers || ['2'],
        options: parsed.options || [],
        explanation: parsed.explanation || '解説です。',
        hints: parsed.hints || ['ヒント1', 'ヒント2', 'ヒント3'],
        isMock: false
      };

    } catch (error) {
      console.warn('❌ Gemini generateSimilarQuestion failed. Falling back to mock.', error);
      return this.mockFallback.generateSimilarQuestion(context);
    }
  }

  async generateRecommendation(context: RecommendationContext): Promise<RecommendationResult> {
    if (!this.apiKey) {
      return this.mockFallback.generateRecommendation(context);
    }

    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: this.apiKey });

      const promptConfig = SubjectPromptRouter.getPromptConfig('math');

      const systemInstruction = `
${promptConfig.systemInstruction}

【あなたのタスク】
生徒の過去の学習履歴（attempts）を分析し、現在のアベイラブルなレッスンリスト（availableLessons）の中から、
今日最も取り組むべきおすすめのレッスンを1つ自律的に選定し、親身な推薦理由（reason）を提示してください。

【選定基準】
1. 過去に間違えた問題（isCorrect = false）やヒントの多いレッスンがあれば、その復習（Grit克服）を優先的に推薦してください。
2. すべての学習が順調な場合は、まだ挑戦していない新しいレッスンを推薦し、挑戦を促してください。
3. 推薦理由（reason）は、ラッキョくんの愛らしく温かい口調（「〜だよ」「がんばろう！」）で、生徒のニックネーム（studentNickname）を呼びかけながら語りかけてください。

【出力フォーマット】
以下のJSONフォーマットで回答してください。
{
  "recommendedLessonId": "選定したレッスンのID",
  "recommendedLessonName": "選定したレッスンの名前",
  "reason": "ラッキョくんからの親身で励ます推薦理由"
}
`;

      const promptText = `
生徒名: ${context.studentNickname}

【学習履歴 (直近)】
${JSON.stringify(context.attempts, null, 2)}

【選択可能なレッスン候補リスト】
${JSON.stringify(context.availableLessons, null, 2)}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: promptText,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.6,
          responseMimeType: 'application/json',
        }
      });

      const resText = response.text || '';
      const parsed = JSON.parse(resText);

      return {
        recommendedLessonId: parsed.recommendedLessonId || context.availableLessons[0]?.id || 'lesson-1',
        recommendedLessonName: parsed.recommendedLessonName || context.availableLessons[0]?.name || '正負の数の計算',
        reason: parsed.reason || '今日はいっしょにがんばろうね！ 🧅',
        isMock: false
      };

    } catch (error) {
      console.warn('❌ Gemini generateRecommendation failed. Falling back to mock.', error);
      return this.mockFallback.generateRecommendation(context);
    }
  }
}
