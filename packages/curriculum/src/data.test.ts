import { mathGrade1Curriculum } from './data';

describe('mathGrade1Curriculum validation', () => {
  it('should be a valid subject structure', () => {
    expect(mathGrade1Curriculum.name).toBe('数学');
    expect(mathGrade1Curriculum.code).toBe('math');
    expect(mathGrade1Curriculum.units.length).toBeGreaterThanOrEqual(3);
  });

  it('should have correct details in each unit', () => {
    mathGrade1Curriculum.units.forEach((unit) => {
      expect(unit.name).toBeTruthy();
      expect(unit.order).toBeGreaterThan(0);
      expect(unit.description).toBeTruthy();
      expect(unit.lessons.length).toBeGreaterThanOrEqual(1);

      unit.lessons.forEach((lesson) => {
        expect(lesson.name).toBeTruthy();
        expect(lesson.order).toBeGreaterThan(0);
        expect(lesson.questions.length).toBeGreaterThanOrEqual(10);

        lesson.questions.forEach((q) => {
          expect(q.prompt).toBeTruthy();
          expect(q.answers.length).toBeGreaterThanOrEqual(1);
          expect(q.hints.length).toBe(3);
          expect(q.explanation).toBeTruthy();
        });
      });
    });
  });
});
