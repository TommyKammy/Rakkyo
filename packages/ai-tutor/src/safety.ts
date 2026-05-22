export class SafetyFilter {
  /**
   * Scans input text for Personally Identifiable Information (PII) like Japanese names, phone numbers, or emails, and redacts them.
   */
  static sanitizeInput(input: string): string {
    let sanitized = input;

    // Redact emails
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    sanitized = sanitized.replace(emailRegex, "[メールアドレス]");

    // Redact typical Japanese phone numbers (e.g. 090-1234-5678, 03-1234-5678)
    const phoneRegex = /0[789]0-\d{4}-\d{4}|0\d{1,4}-\d{1,4}-\d{4}/g;
    sanitized = sanitized.replace(phoneRegex, "[電話番号]");

    // Redact name announcements (e.g. "私の名前は佐藤太郎です", "佐藤と申します", "佐藤太郎だよ")
    const nameRegexes = [
      /(名前は|名は)\s*([^\s。丁だです]+)\s*(です|だよ|と申します)/g,
      /([^\s。丁だです]{2,4})\s*(と申します|です、よろしく)/g
    ];

    for (const regex of nameRegexes) {
      sanitized = sanitized.replace(regex, (match, p1, p2, p3) => {
        if (p3) {
          return `${p1}[お名前]${p3}`;
        }
        return `[お名前]${p2}`;
      });
    }

    return sanitized;
  }

  /**
   * Evaluates the output to check for potential answer leaks (numerical values, direct equations).
   * Returns true if a leak is detected, false otherwise.
   */
  static isAnswerLeaked(output: string, answers: string[]): boolean {
    const cleanedOutput = output.toLowerCase().trim();
    
    for (const answer of answers) {
      const cleanAns = answer.toLowerCase().trim();
      
      // Basic checks for leaks like "答えは -2", "＝ -2", "= -2"
      const leakPatterns = [
        `答えは ${cleanAns}`,
        `答えは${cleanAns}`,
        `＝ ${cleanAns}`,
        `＝${cleanAns}`,
        `= ${cleanAns}`,
        `=${cleanAns}`,
        `答は ${cleanAns}`,
        `答は${cleanAns}`,
        `正解は ${cleanAns}`,
        `正解は${cleanAns}`,
        `数値は ${cleanAns}`,
        `数値は${cleanAns}`
      ];

      for (const pattern of leakPatterns) {
        if (cleanedOutput.includes(pattern.toLowerCase())) {
          return true;
        }
      }

      // Exact match check (if LLM output is exactly the answer)
      if (cleanedOutput === cleanAns) {
        return true;
      }
    }

    return false;
  }

  /**
   * Scans input text for inappropriate content (abusive words, violence, sexual language, or study-unrelated requests).
   * Returns true if inappropriate content is detected, false otherwise.
   */
  static isAbusive(input: string): boolean {
    const cleaned = input.toLowerCase().trim();
    if (!cleaned) return false;

    const abusiveKeywords = [
      // 罵倒・不適切表現 (Abusive / offensive Japanese)
      "死ね", "ばか", "バカ", "馬鹿", "うんこ", "うんち", "殺す", "きもい", "キモい", "クソ", "糞", "ゴミ", "ごみ",
      // セクシャル (Sexual / sensitive terms)
      "エッチ", "えっち", "セックス", "せっくす", "ちんちん", "おっぱい", "変態", "へんたい",
      // お勉強外の対話強要 (Non-educational prompts / bypass attempts)
      "ゲームしよう", "ゲームして", "遊ぼう", "あそぼう", "宿題やって", "宿題解いて",
      "答えを教えて", "答え教えて", "答えだけ", "答えをだして", "答えだして"
    ];

    for (const keyword of abusiveKeywords) {
      if (cleaned.includes(keyword)) {
        return true;
      }
    }

    return false;
  }
}
