CREATE INDEX IF NOT EXISTS "RateLimitEvent_createdAt_idx" ON "RateLimitEvent" ("createdAt");
CREATE INDEX IF NOT EXISTS "RateLimitState_module_idx" ON "RateLimitState" ("module");
CREATE INDEX IF NOT EXISTS "RateLimitState_key_idx" ON "RateLimitState" ("key");
