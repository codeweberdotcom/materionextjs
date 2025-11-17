-- CreateIndex
CREATE INDEX "RateLimitEvent_module_idx" ON "RateLimitEvent"("module");

-- CreateIndex
CREATE INDEX "RateLimitEvent_eventType_idx" ON "RateLimitEvent"("eventType");

-- CreateIndex
CREATE INDEX "RateLimitEvent_mode_idx" ON "RateLimitEvent"("mode");

-- CreateIndex
CREATE INDEX "RateLimitEvent_key_idx" ON "RateLimitEvent"("key");

-- CreateIndex
CREATE INDEX "RateLimitState_module_blockedUntil_idx" ON "RateLimitState"("module", "blockedUntil");

-- CreateIndex
CREATE INDEX "UserBlock_module_isActive_idx" ON "UserBlock"("module", "isActive");
