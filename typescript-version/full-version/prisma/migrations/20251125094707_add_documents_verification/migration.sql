-- DropIndex
DROP INDEX "User_roleId_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN "documentsRejectedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "documentsRejectedReason" TEXT;
ALTER TABLE "User" ADD COLUMN "documentsVerified" DATETIME;
ALTER TABLE "User" ADD COLUMN "documentsVerifiedBy" TEXT;
ALTER TABLE "User" ADD COLUMN "telegramChatId" TEXT;

-- CreateTable
CREATE TABLE "NotificationScenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "trigger" TEXT NOT NULL DEFAULT '{}',
    "actions" TEXT NOT NULL DEFAULT '[]',
    "conditions" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT
);

-- CreateTable
CREATE TABLE "NotificationExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenarioId" TEXT NOT NULL,
    "eventId" TEXT,
    "status" TEXT NOT NULL,
    "result" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "NotificationExecution_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "NotificationScenario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataSanitizationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operationId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "requestedBy" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "duration" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "NotificationScenario_enabled_idx" ON "NotificationScenario"("enabled");

-- CreateIndex
CREATE INDEX "NotificationScenario_priority_idx" ON "NotificationScenario"("priority");

-- CreateIndex
CREATE INDEX "NotificationScenario_createdAt_idx" ON "NotificationScenario"("createdAt");

-- CreateIndex
CREATE INDEX "NotificationExecution_scenarioId_idx" ON "NotificationExecution"("scenarioId");

-- CreateIndex
CREATE INDEX "NotificationExecution_status_idx" ON "NotificationExecution"("status");

-- CreateIndex
CREATE INDEX "NotificationExecution_createdAt_idx" ON "NotificationExecution"("createdAt");

-- CreateIndex
CREATE INDEX "NotificationExecution_scheduledAt_idx" ON "NotificationExecution"("scheduledAt");

-- CreateIndex
CREATE INDEX "NotificationExecution_eventId_idx" ON "NotificationExecution"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "DataSanitizationLog_operationId_key" ON "DataSanitizationLog"("operationId");

-- CreateIndex
CREATE INDEX "DataSanitizationLog_operationId_idx" ON "DataSanitizationLog"("operationId");

-- CreateIndex
CREATE INDEX "DataSanitizationLog_requestedBy_idx" ON "DataSanitizationLog"("requestedBy");

-- CreateIndex
CREATE INDEX "DataSanitizationLog_createdAt_idx" ON "DataSanitizationLog"("createdAt");

-- CreateIndex
CREATE INDEX "DataSanitizationLog_success_idx" ON "DataSanitizationLog"("success");

-- CreateIndex
CREATE INDEX "User_telegramChatId_idx" ON "User"("telegramChatId");

-- CreateIndex
CREATE INDEX "User_documentsVerified_idx" ON "User"("documentsVerified");
