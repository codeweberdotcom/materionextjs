ALTER TABLE "RateLimitConfig" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'enforce';

CREATE TABLE "RateLimitEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "module" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "userId" TEXT,
  "ipAddress" TEXT,
  "eventType" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'enforce',
  "count" INTEGER NOT NULL,
  "maxRequests" INTEGER NOT NULL,
  "windowStart" DATETIME NOT NULL,
  "windowEnd" DATETIME NOT NULL,
  "blockedUntil" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "RateLimitEvent_module_eventType_createdAt_idx" ON "RateLimitEvent" ("module", "eventType", "createdAt");
CREATE INDEX "RateLimitEvent_key_module_idx" ON "RateLimitEvent" ("key", "module");
CREATE INDEX "RateLimitEvent_userId_module_idx" ON "RateLimitEvent" ("userId", "module");
