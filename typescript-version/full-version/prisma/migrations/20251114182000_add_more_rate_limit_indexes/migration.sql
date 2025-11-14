CREATE INDEX IF NOT EXISTS "Message_createdAt_idx" ON "Message" ("createdAt");

CREATE INDEX IF NOT EXISTS "RateLimitState_module_updatedAt_idx" ON "RateLimitState" ("module", "updatedAt");
CREATE INDEX IF NOT EXISTS "RateLimitState_blockedUntil_idx" ON "RateLimitState" ("blockedUntil");

CREATE INDEX IF NOT EXISTS "RateLimitEvent_module_key_eventType_mode_windowStart_idx"
ON "RateLimitEvent" ("module", "key", "eventType", "mode", "windowStart");
