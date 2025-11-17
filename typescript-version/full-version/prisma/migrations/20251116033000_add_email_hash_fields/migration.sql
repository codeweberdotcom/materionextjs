-- Add email hash columns
ALTER TABLE "UserBlock" ADD COLUMN "emailHash" TEXT;
ALTER TABLE "RateLimitEvent" ADD COLUMN "emailHash" TEXT;

-- Indexes for email hash
CREATE INDEX "UserBlock_emailHash_idx" ON "UserBlock"("emailHash");
CREATE INDEX "RateLimitEvent_emailHash_idx" ON "RateLimitEvent"("emailHash");
