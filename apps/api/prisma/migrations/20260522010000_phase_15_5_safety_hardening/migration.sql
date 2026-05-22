-- Phase 15.5 Safety Hardening
-- 1. Re-create FK constraints with ON DELETE CASCADE for the three
--    user-linked tables that were missing cascade, so Right-to-Be-Forgotten
--    deletions can never leave dangling personal data.
-- 2. Create the SafetyAlert queue table used by the abuse hard-lock to
--    notify out-of-band workers (email/LINE/push).

-- DropForeignKey
ALTER TABLE "Attempt" DROP CONSTRAINT IF EXISTS "Attempt_userId_fkey";
ALTER TABLE "UserBadge" DROP CONSTRAINT IF EXISTS "UserBadge_userId_fkey";
ALTER TABLE "ParentMessage" DROP CONSTRAINT IF EXISTS "ParentMessage_userId_fkey";

-- AddForeignKey with Cascade
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentMessage" ADD CONSTRAINT "ParentMessage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: SafetyAlert
CREATE TABLE "SafetyAlert" (
    "id" TEXT NOT NULL,
    "childUserId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "SafetyAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SafetyAlert_childUserId_idx" ON "SafetyAlert"("childUserId");
CREATE INDEX "SafetyAlert_status_idx" ON "SafetyAlert"("status");

-- AddForeignKey
ALTER TABLE "SafetyAlert" ADD CONSTRAINT "SafetyAlert_childUserId_fkey"
  FOREIGN KEY ("childUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
