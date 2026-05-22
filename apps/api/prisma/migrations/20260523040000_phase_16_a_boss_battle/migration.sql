-- Phase 16-A: Boss Battle Schema
-- Adds the 5 tables required for the cooperative boss-battle feature:
--   Boss, BossBattle, BossBattleParticipant, BossQuestionPool, BossApprovalAudit
-- All user-linked tables use ON DELETE CASCADE so that
-- `DELETE /api/users/me/data` (Right-to-Be-Forgotten) wipes the
-- battle history along with the user.

-- CreateTable: Boss
CREATE TABLE "Boss" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxHp" INTEGER NOT NULL,
    "attribute" TEXT NOT NULL,
    "durationWeeks" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Boss_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BossBattle
CREATE TABLE "BossBattle" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "bossId" TEXT NOT NULL,
    "currentHp" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "defeatedAt" TIMESTAMP(3),
    "isAlive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BossBattle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BossBattle_classId_idx" ON "BossBattle"("classId");
CREATE INDEX "BossBattle_bossId_idx" ON "BossBattle"("bossId");

-- CreateTable: BossBattleParticipant
CREATE TABLE "BossBattleParticipant" (
    "userId" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "totalDamage" INTEGER NOT NULL DEFAULT 0,
    "gritAttemptsCount" INTEGER NOT NULL DEFAULT 0,
    "celebrationSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BossBattleParticipant_pkey" PRIMARY KEY ("userId", "battleId")
);

-- CreateTable: BossQuestionPool
CREATE TABLE "BossQuestionPool" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "questionsJson" TEXT NOT NULL,
    "lastGeneratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BossQuestionPool_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BossQuestionPool_classId_key" ON "BossQuestionPool"("classId");

-- CreateTable: BossApprovalAudit
CREATE TABLE "BossApprovalAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BossApprovalAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BossApprovalAudit_tenantId_idx" ON "BossApprovalAudit"("tenantId");
CREATE INDEX "BossApprovalAudit_userId_idx" ON "BossApprovalAudit"("userId");

-- AddForeignKey
ALTER TABLE "BossBattle" ADD CONSTRAINT "BossBattle_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "Class"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BossBattle" ADD CONSTRAINT "BossBattle_bossId_fkey"
  FOREIGN KEY ("bossId") REFERENCES "Boss"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BossBattleParticipant" ADD CONSTRAINT "BossBattleParticipant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BossBattleParticipant" ADD CONSTRAINT "BossBattleParticipant_battleId_fkey"
  FOREIGN KEY ("battleId") REFERENCES "BossBattle"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BossQuestionPool" ADD CONSTRAINT "BossQuestionPool_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "Class"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BossApprovalAudit" ADD CONSTRAINT "BossApprovalAudit_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
