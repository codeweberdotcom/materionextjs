-- CreateTable
CREATE TABLE "service_configurations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER,
    "protocol" TEXT,
    "basePath" TEXT,
    "username" TEXT,
    "password" TEXT,
    "token" TEXT,
    "tlsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "tlsCert" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "lastCheck" DATETIME,
    "lastError" TEXT,
    "metadata" TEXT DEFAULT '{}',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT DEFAULT '{}',
    "level" INTEGER NOT NULL DEFAULT 100,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Role" ("code", "createdAt", "description", "id", "isSystem", "level", "name", "permissions", "updatedAt") SELECT "code", "createdAt", "description", "id", "isSystem", "level", "name", "permissions", "updatedAt" FROM "Role";
DROP TABLE "Role";
ALTER TABLE "new_Role" RENAME TO "Role";
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "service_configurations_name_key" ON "service_configurations"("name");

-- CreateIndex
CREATE INDEX "service_configurations_type_idx" ON "service_configurations"("type");

-- CreateIndex
CREATE INDEX "service_configurations_enabled_idx" ON "service_configurations"("enabled");

-- CreateIndex
CREATE INDEX "service_configurations_status_idx" ON "service_configurations"("status");
