-- Account Recovery Tables
-- Migration: 20261108000000_account_recovery

CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PasswordResetAudit" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "tokenId" TEXT,
    "action" TEXT NOT NULL, -- 'REQUESTED', 'VERIFIED', 'USED', 'EXPIRED', 'INVALID'
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX "PasswordResetToken_tokenHash_idx" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");
CREATE INDEX "PasswordResetAudit_userId_idx" ON "PasswordResetAudit"("userId");
CREATE INDEX "PasswordResetAudit_createdAt_idx" ON "PasswordResetAudit"("createdAt");

ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PasswordResetAudit" ADD CONSTRAINT "PasswordResetAudit_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PasswordResetAudit" ADD CONSTRAINT "PasswordResetAudit_tokenId_fkey"
    FOREIGN KEY ("tokenId") REFERENCES "PasswordResetToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;