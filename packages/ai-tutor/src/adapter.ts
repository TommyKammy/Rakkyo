export interface HintContext {
  prompt: string;
  explanation: string;
  answers: string[];
  hintsUsed: number; // 0, 1, 2 (the next hint to fetch will be hintsUsed + 1)
  staticHints?: string[]; // curriculum fallback hints
  subjectCode?: string;
  userQuestion?: string;
  isSocratic?: boolean; // If true, trigger Socratic scaffolding prompt
}

export interface HintResult {
  hintText: string;
  stage: 1 | 2 | 3;
  isMock: boolean;
}

// 1. Precise Mistake Diagnosis
export interface DiagnoseContext {
  prompt: string;
  explanation: string;
  answers: string[];
  answerSubmitted: string;
  subjectCode?: string;
}

export interface DiagnosisResult {
  errorType: 'careless_mistake' | 'conceptual_error';
  aiDiagnosis: string; // Detailed diagnosis text in Rakkyo tone
  isMock: boolean;
}

// 2. Personalized Dynamic Question Generation
export interface SimilarQuestionContext {
  prompt: string;
  explanation: string;
  answers: string[];
  errorType: 'careless_mistake' | 'conceptual_error';
  aiDiagnosis: string;
  subjectCode?: string;
}

export interface SimilarQuestionResult {
  prompt: string;
  answers: string[];
  options: string[];
  explanation: string;
  hints: string[];
  isMock: boolean;
}

// 3. Autonomous Recommendation
export interface AttemptSummary {
  lessonId: string;
  lessonName: string;
  isCorrect: boolean;
  hintsUsed: number;
  errorType?: string | null;
  aiDiagnosis?: string | null;
  createdAt: string;
}

export interface RecommendationContext {
  studentNickname: string;
  attempts: AttemptSummary[];
  availableLessons: { id: string; name: string; unitName: string }[];
}

export interface RecommendationResult {
  recommendedLessonId: string;
  recommendedLessonName: string;
  reason: string; // Encouraging, personalized recommendation reason
  isMock: boolean;
}

export interface BossQuestion {
  id: string;
  prompt: string;
  answers: string[];
  options: string[];
  explanation: string;
  hints: string[];
  difficulty: number;
}

export interface AiTutorProvider {
  generateHint(context: HintContext): Promise<HintResult>;
  diagnoseMistake(context: DiagnoseContext): Promise<DiagnosisResult>;
  generateSimilarQuestion(context: SimilarQuestionContext): Promise<SimilarQuestionResult>;
  generateRecommendation(context: RecommendationContext): Promise<RecommendationResult>;
  generateBossQuestionPool(attribute: string, classLevel: number): Promise<{ questions: BossQuestion[]; isMock: boolean }>;
}

export class MockAiTutorProvider implements AiTutorProvider {
  async generateHint(context: HintContext): Promise<HintResult> {
    const nextStage = (Math.min(3, Math.max(1, context.hintsUsed + 1))) as 1 | 2 | 3;

    // Socratic Scaffolding override
    if (context.isSocratic) {
      return {
        hintText: `**うーん、答えを直接考える前に、ちょっと立ち止まってみよう！ 🧅**
例えば、この問題「${context.prompt}」で、いま一番つまずきそうな部分はどこかな？
まずは「${context.prompt.includes('+') || context.prompt.includes('-') ? '符号のルール' : '言葉の意味'}」について、どう考えたらいいか教えてほしいな！いっしょにステップを踏んでいこう！`,
        stage: nextStage,
        isMock: true
      };
    }

    // If userQuestion is supplied, provide a dynamic mock answer bypassing standard stage logic
    if (context.userQuestion) {
      return {
        hintText: `【ラッキョくんへの質問回答】
「${context.userQuestion}」という質問だね！
うーん、とってもいいところに気づいたね！
問題「${context.prompt}」について、答えを直接教えることはできないけれど、一緒に考えてみよう。
まずは、問題文に書かれている言葉の意味や、何を求めたいのかをもう一度整理してみるとヒントが見えてくるかも！`,
        stage: nextStage,
        isMock: true
      };
    }

    // 1. If static curriculum hints are provided, use them directly
    if (context.staticHints && context.staticHints.length >= nextStage) {
      return {
        hintText: context.staticHints[nextStage - 1],
        stage: nextStage,
        isMock: true
      };
    }

    // 2. Generic fallback logic if static hints are missing
    let hintText = "";
    switch (nextStage) {
      case 1:
        hintText = `【ヒント1: 問題のいいかえ】
「${context.prompt}」という問題だね！
まずは、問題が何を聞いているのか整理してみよう。言葉の定義を思い出すといいよ。`;
        break;
      case 2:
        hintText = `【ヒント2: 考え方の図解】
数直線や天秤をイメージしてみよう。
例えば、マイナスの数を引くということは、数直線上ではどちらの方向に進むことになるかな？`;
        break;
      case 3:
        hintText = `【ヒント3: 解き方のステップ】
ステップ1: 符号を決めよう。
ステップ2: 絶対値の計算をしよう。
正解のヒントは、「${context.answers.join(" または ")}」に近づく計算だよ。最後まであきらめずにやってみよう！`;
        break;
    }

    return {
      hintText,
      stage: nextStage,
      isMock: true
    };
  }

  async diagnoseMistake(context: DiagnoseContext): Promise<DiagnosisResult> {
    const isCareless = context.answerSubmitted.trim() === '3' || context.answerSubmitted.trim() === '11' || context.answerSubmitted.includes('-');
    
    let aiDiagnosis = "";
    let errorType: 'careless_mistake' | 'conceptual_error' = 'careless_mistake';

    if (isCareless) {
      errorType = 'careless_mistake';
      aiDiagnosis = `**惜しい！計算の途中で少しだけうっかりミスをしちゃったみたいだね 🧅**
計算自体はバッチリできているから、もう一度だけ符号（プラスとマイナス）や代入の掛け算をゆっくり確かめてみてね。次は絶対に正解できるよ！`;
    } else {
      errorType = 'conceptual_error';
      aiDiagnosis = `**なるほど！この問題は、計算の「ルール（概念）」をもう一度整理するチャンスだよ！ 🧅**
例えば、負の数をかけるときの符号の決め方や、文字式の足し算・引き算のきまりを数直線などのイメージで振り返ってみよう。焦らなくて大丈夫、一歩ずつ進もう！`;
    }

    return {
      errorType,
      aiDiagnosis,
      isMock: true
    };
  }

  async generateSimilarQuestion(context: SimilarQuestionContext): Promise<SimilarQuestionResult> {
    // Generate a similar step-down question dynamically
    let prompt = `$-3 + 5$ を計算しなさい。`;
    let answers = ['2'];
    let explanation = `負の数と正の数の足し算は、絶対値が大きい方の符号（プラス）になり、絶対値の差を計算します。$5 - 3 = 2$ だね！`;
    let hints = [
      'プラスの玉が5個、マイナスの玉が3個あって、打ち消し合うと何個残るか考えてみよう。',
      '数直線上で $-3$ から右に $5$ 進んだ位置はどこかな？',
      'まずは絶対値の差（$5 - 3$）を計算し、大きい方（プラス）の符号をつけよう！'
    ];

    if (context.prompt.includes('x')) {
      prompt = `式 $2x - 6 - 5x + 1$ を簡潔にしなさい。`;
      answers = ['-3x-5', '-3x - 5'];
      explanation = `$x$がついている項同士（$2x - 5x = -3x$）と、数字の項同士（$-6 + 1 = -5$）をそれぞれ計算するよ！`;
      hints = [
        '$x$がついているお友達と、数字だけのお友達を分けて整理してみよう。',
        '$2x - 5x$ と $-6 + 1$ を別々に計算してみてね。',
        '$2 - 5$ は $-3$、$-6 + 1$ は $-5$ だね。つなげてみよう！'
      ];
    } else if (context.prompt.includes('\\times') || context.prompt.includes('\\div')) {
      prompt = `$-8 \\div 2$ を計算しなさい。`;
      answers = ['-4'];
      explanation = `負の数を正の数で割ると、答えの符号はマイナス（$-$）になります。$8 \\div 2 = 4$ なので、答えは $-4$ だよ！`;
      hints = [
        'マイナスの数が奇数個（1つ）あるときは、答えの符号はどちらになるかな？',
        '割り算の計算自体は $8 \\div 2$ だよ。',
        '答えの符号をマイナスにして、計算した数とつなげよう！'
      ];
    }

    return {
      prompt,
      answers,
      options: [],
      explanation,
      hints,
      isMock: true
    };
  }

  async generateRecommendation(context: RecommendationContext): Promise<RecommendationResult> {
    // Find a lesson where the student struggled, or just recommend the next one
    const incorrectAttempt = context.attempts.find(a => !a.isCorrect);
    
    let recommendedLessonId = context.availableLessons[0]?.id || "lesson-1";
    let recommendedLessonName = context.availableLessons[0]?.name || "正負の数の計算";
    let reason = "";

    if (incorrectAttempt) {
      const matchedLesson = context.availableLessons.find(l => l.id === incorrectAttempt.lessonId || l.name === incorrectAttempt.lessonName);
      if (matchedLesson) {
        recommendedLessonId = matchedLesson.id;
        recommendedLessonName = matchedLesson.name;
      }
      reason = `**やっほー、${context.studentNickname}ちゃん！昨日がんばって解いた「${recommendedLessonName}」だけど、もう少しで完璧になりそうだよ！ 🧅**
AIのつまずき分析によると、符号のきまりをちょっとだけ整理するとスッキリ解決するみたい。今日いっしょにここを復習して、ニガテをトクイにしちゃおう！`;
    } else {
      // If all correct, recommend next lesson
      const completedLessonIds = context.attempts.map(a => a.lessonId);
      const nextLesson = context.availableLessons.find(l => !completedLessonIds.includes(l.id));
      if (nextLesson) {
        recommendedLessonId = nextLesson.id;
        recommendedLessonName = nextLesson.name;
      }
      reason = `**すばらしい調子だね、${context.studentNickname}ちゃん！ 🧅**
いま正負の計算はバッチリ理解できているから、今日は新しく「${recommendedLessonName}」にチャレンジしてみない？一歩ずつ新しい大冒険に出発しよう！ラッキョくんがいつでも応援しているよ！`;
    }

    return {
      recommendedLessonId,
      recommendedLessonName,
      reason,
      isMock: true
    };
  }

  async generateBossQuestionPool(attribute: string, classLevel: number): Promise<{ questions: BossQuestion[]; isMock: boolean }> {
    const questions: BossQuestion[] = [];
    const topics = [
      { name: '正負の数', formula: (i: number) => `$-${i} + ${i * 2}$`, ans: (i: number) => `${i}` },
      { name: '文字と式', formula: (i: number) => `$${i}x - ${i * 3}x$`, ans: (i: number) => `-${i * 2}x` },
      { name: '一次方程式', formula: (i: number) => `$x - ${i} = ${i * 2}$`, ans: (i: number) => `${i * 3}` }
    ];

    for (let i = 1; i <= 100; i++) {
      const topic = topics[i % topics.length];
      const diff = Math.min(5, Math.max(1, Math.floor((i - 1) / 20) + 1)); // difficulty 1 to 5
      const prompt = `問${i}: ${topic.formula(i)} を計算しなさい。`;
      const ans = topic.ans(i);

      questions.push({
        id: `bq_${i}`,
        prompt,
        answers: [ans, ans.replace(/\s+/g, '')],
        options: [],
        explanation: `これは${topic.name}の練習問題です。難易度は ${diff} だよ。`,
        hints: [
          `まずは ${topic.name} の基本を思い出してみよう！`,
          `数直線や文字のまとめ方のきまりを意識してみてね。`,
          `答えはズバリ ${ans} になるように計算してみよう！`
        ],
        difficulty: diff
      });
    }

    return {
      questions,
      isMock: true
    };
  }
}
