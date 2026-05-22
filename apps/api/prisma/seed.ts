import { PrismaClient, QuestionType } from '@prisma/client';
import { allCurriculums } from '@rakkyo/curriculum';

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

  // 2. Iterate and create all subjects, units, lessons, and questions
  for (const curriculum of allCurriculums) {
    console.log(`📚 Seeding subject: ${curriculum.name} (${curriculum.code})...`);
    
    const subject = await prisma.subject.create({
      data: {
        name: curriculum.name,
        code: curriculum.code,
        grade: 1,
        isEnabled: true,
      },
    });

    for (const unitData of curriculum.units) {
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
  }

  // 3. Seed Badges
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
      {
        name: 'Gritの達人',
        iconUrl: '🔥',
        conditionType: 'GRIT',
        threshold: 90,
      },
      {
        name: '無限の探求者',
        iconUrl: '⌛',
        conditionType: 'STUDY_TIME',
        threshold: 600,
      },
      {
        name: 'ストリークの鬼',
        iconUrl: '⚡',
        conditionType: 'STREAK',
        threshold: 7,
      },
      {
        name: '完璧主義者',
        iconUrl: '🌟',
        conditionType: 'CONSECUTIVE_CORRECT',
        threshold: 10,
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
