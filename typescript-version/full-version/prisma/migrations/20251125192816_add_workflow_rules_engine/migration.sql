-- CreateTable
CREATE TABLE "workflow_instances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "context" TEXT DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "workflow_transitions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instanceId" TEXT NOT NULL,
    "fromState" TEXT NOT NULL,
    "toState" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" TEXT,
    "metadata" TEXT DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workflow_transitions_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "workflow_instances" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "business_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "conditions" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT
);

-- CreateTable
CREATE TABLE "rule_executions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "facts" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "duration" INTEGER NOT NULL,
    "error" TEXT,
    "actorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rule_executions_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "business_rules" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "workflow_instances_type_state_idx" ON "workflow_instances"("type", "state");

-- CreateIndex
CREATE INDEX "workflow_instances_updatedAt_idx" ON "workflow_instances"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_instances_type_entityId_key" ON "workflow_instances"("type", "entityId");

-- CreateIndex
CREATE INDEX "workflow_transitions_instanceId_idx" ON "workflow_transitions"("instanceId");

-- CreateIndex
CREATE INDEX "workflow_transitions_createdAt_idx" ON "workflow_transitions"("createdAt");

-- CreateIndex
CREATE INDEX "workflow_transitions_event_idx" ON "workflow_transitions"("event");

-- CreateIndex
CREATE INDEX "workflow_transitions_actorId_idx" ON "workflow_transitions"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "business_rules_name_key" ON "business_rules"("name");

-- CreateIndex
CREATE INDEX "business_rules_category_enabled_idx" ON "business_rules"("category", "enabled");

-- CreateIndex
CREATE INDEX "business_rules_priority_idx" ON "business_rules"("priority");

-- CreateIndex
CREATE INDEX "business_rules_enabled_idx" ON "business_rules"("enabled");

-- CreateIndex
CREATE INDEX "rule_executions_ruleId_idx" ON "rule_executions"("ruleId");

-- CreateIndex
CREATE INDEX "rule_executions_createdAt_idx" ON "rule_executions"("createdAt");

-- CreateIndex
CREATE INDEX "rule_executions_success_idx" ON "rule_executions"("success");
