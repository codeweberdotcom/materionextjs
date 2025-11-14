-- Add isFallback flag to RateLimitConfig to mark auto-generated monitor configs
ALTER TABLE "RateLimitConfig"
ADD COLUMN "isFallback" BOOLEAN NOT NULL DEFAULT false;
