-- CreateTable
CREATE TABLE "TestConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testId" TEXT NOT NULL,
    "timeout" INTEGER NOT NULL DEFAULT 30000,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "TestConfig_testId_key" ON "TestConfig"("testId");

-- CreateIndex
CREATE INDEX "TestConfig_testId_idx" ON "TestConfig"("testId");

-- CreateIndex
CREATE INDEX "TestConfig_isActive_idx" ON "TestConfig"("isActive");
