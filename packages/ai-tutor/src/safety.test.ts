import { SafetyFilter } from './safety';

describe('SafetyFilter', () => {
  describe('sanitizeInput (PII Masking)', () => {
    it('should redact emails', () => {
      const input = 'ぼくのメールアドレスは student@example.com です。';
      const output = SafetyFilter.sanitizeInput(input);
      expect(output).toBe('ぼくのメールアドレスは [メールアドレス] です。');
    });

    it('should redact typical Japanese phone numbers', () => {
      const inputs = [
        '電話番号は 090-1234-5678 です。',
        '連絡先は 03-1234-5678 になります。',
        '080-9876-5432'
      ];
      expect(SafetyFilter.sanitizeInput(inputs[0])).toBe('電話番号は [電話番号] です。');
      expect(SafetyFilter.sanitizeInput(inputs[1])).toBe('連絡先は [電話番号] になります。');
      expect(SafetyFilter.sanitizeInput(inputs[2])).toBe('[電話番号]');
    });

    it('should redact typical Japanese name introductions', () => {
      const inputs = [
        '私の名前は佐藤太郎です。',
        '鈴木と申します。どうぞよろしく。',
        '私の名は佐藤太郎だよ。'
      ];
      expect(SafetyFilter.sanitizeInput(inputs[0])).toBe('私の名前は[お名前]です。');
      expect(SafetyFilter.sanitizeInput(inputs[1])).toBe('[お名前]と申します。どうぞよろしく。');
      expect(SafetyFilter.sanitizeInput(inputs[2])).toBe('私の名は[お名前]だよ。');
    });

    it('should leave normal text untouched', () => {
      const input = '$-5 + 3$ を計算しなさい。';
      const output = SafetyFilter.sanitizeInput(input);
      expect(output).toBe('$-5 + 3$ を計算しなさい。');
    });
  });

  describe('isAnswerLeaked', () => {
    const answers = ['-2', '10', 'x = 3'];

    it('should detect when output exactly matches the answer', () => {
      expect(SafetyFilter.isAnswerLeaked('-2', answers)).toBe(true);
      expect(SafetyFilter.isAnswerLeaked('10', answers)).toBe(true);
    });

    it('should detect when output contains answer with leaky phrases', () => {
      const leaks = [
        '答えは -2 だよ',
        '正解は-2です',
        '＝ -2 になるよ',
        '数値は 10 です',
        '答は-2'
      ];
      leaks.forEach(leak => {
        expect(SafetyFilter.isAnswerLeaked(leak, answers)).toBe(true);
      });
    });

    it('should not flag outputs that do not leak the answer', () => {
      const safeTexts = [
        'まずは符号を確認しよう。マイナスの数が大きいね。',
        '答えを求めるために、絶対値を引き算してみよう！',
        '10より小さい数になるかな？'
      ];
      safeTexts.forEach(safe => {
        expect(SafetyFilter.isAnswerLeaked(safe, answers)).toBe(false);
      });
    });
  });
});
