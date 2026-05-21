import { allCurriculums } from './data';

describe('curriculum validation for all subjects', () => {
  it('should have 5 subjects defined', () => {
    expect(allCurriculums.length).toBe(5);
  });

  allCurriculums.forEach((subject) => {
    describe(`${subject.name} (${subject.code}) validation`, () => {
      it('should be a valid subject structure', () => {
        expect(subject.name).toBeTruthy();
        expect(subject.code).toBeTruthy();
        expect(subject.units.length).toBeGreaterThanOrEqual(3);
      });

      it('should have correct details in each unit', () => {
        subject.units.forEach((unit) => {
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
  });
});

