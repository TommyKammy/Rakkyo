-- Phase 16-D: Offline PWA Sync migration
-- Adds clientEventId unique idempotency key to Attempt table and creates OfflineSyncLog audit table

-- AlterTable
ALTER TABLE "Attempt" ADD COLUMN "clientEventId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_clientEventId_key" ON "Attempt"("clientEventId");

-- CreateTable
CREATE TABLE "OfflineSyncLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "errorDetails" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfflineSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfflineSyncLog_userId_idx" ON "OfflineSyncLog"("userId");

-- AddForeignKey
ALTER TABLE "OfflineSyncLog" ADD CONSTRAINT "OfflineSyncLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
