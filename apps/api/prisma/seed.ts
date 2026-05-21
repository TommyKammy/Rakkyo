import { PrismaClient, QuestionType } from '@prisma/client';
import { mathGrade1Curriculum } from '@rakkyo/curriculum';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database from @rakkyo/curriculum...');

  // 1. Delete existing data
  await prisma.userBadge.deleteMany({});
  await prisma.badge.deleteMany({});
  await prisma.attempt.deleteMany({});
  await prisma.question.deleteMany({});
  await prisma.lesson.deleteMany({});
  await prisma.unit.deleteMany({});
  await prisma.subject.deleteMany({});
  await prisma.user.deleteMany({});

  // 2. Create the main subject
  const subject = await prisma.subject.create({
    data: {
      name: mathGrade1Curriculum.name,
      code: mathGrade1Curriculum.code,
      grade: 1,
      isEnabled: true,
    },
  });

  // Create other subject placeholders
  await prisma.subject.createMany({
    data: [
      { name: '国語', code: 'japanese', grade: 1, isEnabled: false },
      { name: '英語', code: 'english', grade: 1, isEnabled: false },
      { name: '理科', code: 'science', grade: 1, isEnabled: false },
      { name: '社会', code: 'social', grade: 1, isEnabled: false },
    ],
  });

  // 3. Iterate and create units, lessons, and questions
  for (const unitData of mathGrade1Curriculum.units) {
    const unit = await prisma.unit.create({
      data: {
        subjectId: subject.id,
        name: unitData.name,
        order: unitData.order,
        description: unitData.description,
        isLocked: false,
      },
    });

    for (const lessonData of unitData.lessons) {
      const lesson = await prisma.lesson.create({
        data: {
          unitId: unit.id,
          name: lessonData.name,
          order: lessonData.order,
        },
      });

      for (const q of lessonData.questions) {
        let qType: QuestionType;
        if (q.type === 'MULTIPLE_CHOICE') {
          qType = QuestionType.MULTIPLE_CHOICE;
        } else if (q.type === 'NUMBER_INPUT') {
          qType = QuestionType.NUMBER_INPUT;
        } else if (q.type === 'FILL_IN_BLANK') {
          qType = QuestionType.FILL_IN_BLANK;
        } else if ((q.type as string) === 'SINGLE_CHOICE') {
          qType = QuestionType.SINGLE_CHOICE;
        } else if ((q.type as string) === 'NUMERIC') {
          qType = QuestionType.NUMERIC;
        } else if ((q.type as string) === 'TEXT_SHORT') {
          qType = QuestionType.TEXT_SHORT;
        } else if ((q.type as string) === 'FILL_BLANK') {
          qType = QuestionType.FILL_BLANK;
        } else {
          qType = QuestionType.FILL_IN_BLANK;
        }

        await prisma.question.create({
          data: {
            lessonId: lesson.id,
            type: qType,
            prompt: q.prompt,
            answers: q.answers,
            options: q.options,
            explanation: q.explanation,
            hints: q.hints,
          },
        });
      }
    }
  }

  // 4. Seed Badges
  await prisma.badge.createMany({
    data: [
      {
        name: '冒険のはじまり',
        iconUrl: '🎉',
        conditionType: 'XP',
        threshold: 10,
      },
      {
        name: '数学マスターの卵',
        iconUrl: '📐',
        conditionType: 'CORRECT_ANSWERS',
        threshold: 5,
      },
      {
        name: 'あきらめない心',
        iconUrl: '🔥',
        conditionType: 'STREAK',
        threshold: 3,
      },
    ],
  });

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
