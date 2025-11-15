-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "actorType" TEXT,
    "actorId" TEXT,
    "subjectType" TEXT,
    "subjectId" TEXT,
    "key" TEXT,
    "message" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "correlationId" TEXT,
    "metadata" TEXT DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Event_source_createdAt_idx" ON "Event"("source", "createdAt");

-- CreateIndex
CREATE INDEX "Event_module_type_createdAt_idx" ON "Event"("module", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Event_key_idx" ON "Event"("key");

-- CreateIndex
CREATE INDEX "Event_actorType_actorId_idx" ON "Event"("actorType", "actorId");

-- CreateIndex
CREATE INDEX "Event_subjectType_subjectId_idx" ON "Event"("subjectType", "subjectId");
