-- Add PII-minimization fields to UserBlock
ALTER TABLE "UserBlock" ADD COLUMN "ipHash" TEXT;
ALTER TABLE "UserBlock" ADD COLUMN "ipPrefix" TEXT;
ALTER TABLE "UserBlock" ADD COLUMN "hashVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "UserBlock" ADD COLUMN "cidr" TEXT;

-- Add PII-minimization fields to RateLimitEvent
ALTER TABLE "RateLimitEvent" ADD COLUMN "ipHash" TEXT;
ALTER TABLE "RateLimitEvent" ADD COLUMN "ipPrefix" TEXT;
ALTER TABLE "RateLimitEvent" ADD COLUMN "hashVersion" INTEGER NOT NULL DEFAULT 1;

-- Indexes for new fields
CREATE INDEX "UserBlock_ipHash_idx" ON "UserBlock"("ipHash");
CREATE INDEX "UserBlock_ipPrefix_idx" ON "UserBlock"("ipPrefix");
CREATE INDEX "RateLimitEvent_ipHash_idx" ON "RateLimitEvent"("ipHash");
CREATE INDEX "RateLimitEvent_ipPrefix_idx" ON "RateLimitEvent"("ipPrefix");
