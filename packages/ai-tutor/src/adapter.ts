export interface HintContext {
  prompt: string;
  explanation: string;
  answers: string[];
  hintsUsed: number; // 0, 1, 2 (the next hint to fetch will be hintsUsed + 1)
  staticHints?: string[]; // curriculum fallback hints
  subjectCode?: string;
  userQuestion?: string;
}

export interface HintResult {
  hintText: string;
  stage: 1 | 2 | 3;
  isMock: boolean;
}

export interface AiTutorProvider {
  generateHint(context: HintContext): Promise<HintResult>;
}

export class MockAiTutorProvider implements AiTutorProvider {
  async generateHint(context: HintContext): Promise<HintResult> {
    const nextStage = (Math.min(3, Math.max(1, context.hintsUsed + 1))) as 1 | 2 | 3;

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
}
