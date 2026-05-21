import { SubjectPromptRouter } from './router';

describe('SubjectPromptRouter', () => {
  describe('getPromptConfig', () => {
    it('should return math configuration for math or 数学 keys case-insensitively', () => {
      const mathConfig1 = SubjectPromptRouter.getPromptConfig('math');
      const mathConfig2 = SubjectPromptRouter.getPromptConfig('数学');
      const mathConfig3 = SubjectPromptRouter.getPromptConfig('  MATH  ');

      expect(mathConfig1.mascotName).toBe('ラッキョくん');
      expect(mathConfig1.tone).toContain('数学');
      expect(mathConfig1.systemInstruction).toContain('中学1年生向け');

      expect(mathConfig2).toBe(mathConfig1);
      expect(mathConfig3).toBe(mathConfig1);
    });

    it('should return correct configuration for newly added subjects', () => {
      const englishConfig = SubjectPromptRouter.getPromptConfig('english');
      const scienceConfig = SubjectPromptRouter.getPromptConfig('理科');
      const socialConfig = SubjectPromptRouter.getPromptConfig('social');
      const japaneseConfig = SubjectPromptRouter.getPromptConfig('国語');

      expect(englishConfig.tone).toContain('英語');
      expect(scienceConfig.tone).toContain('理科');
      expect(socialConfig.tone).toContain('社会');
      expect(japaneseConfig.tone).toContain('国語');
    });

    it('should fallback gracefully for unknown subject codes', () => {
      const config = SubjectPromptRouter.getPromptConfig('history_advanced');
      expect(config.mascotName).toBe('ラッキョくん');
      expect(config.tone).toContain('AI家庭教師');
      expect(config.systemInstruction).toContain('絶対に正解を直接教えたり');
    });
  });

  describe('getHintInstruction for Math', () => {
    const mathConfig = SubjectPromptRouter.getPromptConfig('math');

    it('should return stage 1 prompt which focuses on math terminology and question clarification', () => {
      const instruction = mathConfig.getHintInstruction(1);
      expect(instruction).toContain('ヒントのステージ 1');
      expect(instruction).toContain('答えや計算式には一切触れず');
    });

    it('should return stage 2 prompt which focuses on visual drawings and analogies', () => {
      const instruction = mathConfig.getHintInstruction(2);
      expect(instruction).toContain('ヒントのステージ 2');
      expect(instruction).toContain('数直線');
    });

    it('should return stage 3 prompt which focuses on steps without solving the final computation', () => {
      const instruction = mathConfig.getHintInstruction(3);
      expect(instruction).toContain('ヒントのステージ 3');
      expect(instruction).toContain('符号を決めよう');
    });
  });

  describe('getHintInstruction for other subjects', () => {
    it('should check english dynamic hints', () => {
      const config = SubjectPromptRouter.getPromptConfig('english');
      expect(config.getHintInstruction(2)).toContain('語順の違い');
    });

    it('should check science dynamic hints', () => {
      const config = SubjectPromptRouter.getPromptConfig('science');
      expect(config.getHintInstruction(2)).toContain('イメージや例え話');
    });

    it('should check social dynamic hints', () => {
      const config = SubjectPromptRouter.getPromptConfig('social');
      expect(config.getHintInstruction(2)).toContain('歴史の流れ');
    });

    it('should check japanese dynamic hints', () => {
      const config = SubjectPromptRouter.getPromptConfig('japanese');
      expect(config.getHintInstruction(2)).toContain('本文中');
    });
  });
});

