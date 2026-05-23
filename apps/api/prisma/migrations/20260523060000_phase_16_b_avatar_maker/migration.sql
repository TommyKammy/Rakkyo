-- Phase 16-B: AI Avatar Maker schema
-- Adds the four tables required for the avatar feature:
--   ParentChildRelation (was added to schema in an earlier phase but never
--     migrated; backfilled here so production picks it up alongside the
--     avatar models that depend on it for the B2C parent-relation guard)
--   Avatar, AvatarGenerationQuota, AvatarApprovalAudit
--
-- Cascade strategy:
--   - User → Avatar / AvatarGenerationQuota: CASCADE (GDPR Right-to-Be-Forgotten)
--   - Avatar → AvatarApprovalAudit: SET NULL so the audit trail survives
--     avatar deletion (cron cleanup records audit then deletes the avatar
--     in the same request; cascading would erase the audit it just wrote).

-- ──────────────────────────────────────────────────────────
-- ParentChildRelation
-- ──────────────────────────────────────────────────────────
CREATE TABLE "ParentChildRelation" (
    "id"       TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "childId"  TEXT NOT NULL,

    CONSTRAINT "ParentChildRelation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ParentChildRelation_parentId_childId_key"
    ON "ParentChildRelation"("parentId", "childId");

ALTER TABLE "ParentChildRelation" ADD CONSTRAINT "ParentChildRelation_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentChildRelation" ADD CONSTRAINT "ParentChildRelation_childId_fkey"
    FOREIGN KEY ("childId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────
-- Avatar
-- ──────────────────────────────────────────────────────────
CREATE TABLE "Avatar" (
    "id"              TEXT         NOT NULL,
    "userId"          TEXT         NOT NULL,
    "status"          TEXT         NOT NULL,
    "baseVegetable"   TEXT         NOT NULL,
    "mainColor"       TEXT         NOT NULL,
    "facialFeatures"  TEXT         NOT NULL,
    "clothing"        TEXT         NOT NULL,
    "expression"      TEXT         NOT NULL,
    "prompt"          TEXT         NOT NULL,
    "objectKey"       TEXT         NOT NULL,
    "rejectionReason" TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Avatar_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Avatar_objectKey_key" ON "Avatar"("objectKey");
CREATE INDEX        "Avatar_userId_idx"    ON "Avatar"("userId");

ALTER TABLE "Avatar" ADD CONSTRAINT "Avatar_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────
-- AvatarGenerationQuota
-- ──────────────────────────────────────────────────────────
CREATE TABLE "AvatarGenerationQuota" (
    "id"         TEXT         NOT NULL,
    "userId"     TEXT         NOT NULL,
    "weekBucket" TEXT         NOT NULL,
    "count"      INTEGER      NOT NULL DEFAULT 0,
    "resetAt"    TIMESTAMP(3) NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvatarGenerationQuota_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AvatarGenerationQuota_userId_weekBucket_key"
    ON "AvatarGenerationQuota"("userId", "weekBucket");
CREATE INDEX "AvatarGenerationQuota_userId_idx"
    ON "AvatarGenerationQuota"("userId");

ALTER TABLE "AvatarGenerationQuota" ADD CONSTRAINT "AvatarGenerationQuota_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────
-- AvatarApprovalAudit
-- ──────────────────────────────────────────────────────────
CREATE TABLE "AvatarApprovalAudit" (
    "id"          TEXT         NOT NULL,
    "avatarId"    TEXT,
    "moderatorId" TEXT         NOT NULL,
    "action"      TEXT         NOT NULL,
    "imageHash"   TEXT         NOT NULL,
    "reason"      TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvatarApprovalAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AvatarApprovalAudit_avatarId_idx"
    ON "AvatarApprovalAudit"("avatarId");
CREATE INDEX "AvatarApprovalAudit_moderatorId_idx"
    ON "AvatarApprovalAudit"("moderatorId");

-- SET NULL on delete preserves the audit row when the linked Avatar
-- is purged (e.g. by cron-cleanup), so the compliance trail outlives
-- the asset it described.
ALTER TABLE "AvatarApprovalAudit" ADD CONSTRAINT "AvatarApprovalAudit_avatarId_fkey"
    FOREIGN KEY ("avatarId") REFERENCES "Avatar"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
