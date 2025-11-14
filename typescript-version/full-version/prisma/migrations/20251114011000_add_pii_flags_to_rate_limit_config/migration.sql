-- Add PII control flags to RateLimitConfig
ALTER TABLE "RateLimitConfig"
ADD COLUMN "storeEmailInEvents" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "RateLimitConfig"
ADD COLUMN "storeIpInEvents" BOOLEAN NOT NULL DEFAULT true;
