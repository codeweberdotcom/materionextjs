-- CreateTable
CREATE TABLE "CronJobStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "lastRunAt" DATETIME,
    "lastSuccessAt" DATETIME,
    "lastResult" TEXT,
    "lastCount" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CronJobStatus_name_key" ON "CronJobStatus"("name");
