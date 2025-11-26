/*
  Migration: Add code, level, isSystem fields to Role table
  
  This migration:
  1. Creates a new Role table with code column having a temporary default
  2. Copies data from old table
  3. Updates code values based on name for system roles
  4. Creates unique index on code
*/

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Create new table with code having a temporary default
CREATE TABLE "new_Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL DEFAULT 'TEMP_CODE',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT DEFAULT '{}',
    "level" INTEGER NOT NULL DEFAULT 100,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Copy existing data
INSERT INTO "new_Role" ("createdAt", "description", "id", "name", "permissions", "updatedAt") 
SELECT "createdAt", "description", "id", "name", "permissions", "updatedAt" FROM "Role";

-- Update code values based on name (system roles)
UPDATE "new_Role" SET "code" = 'SUPERADMIN', "level" = 0, "isSystem" = true WHERE LOWER("name") = 'superadmin';
UPDATE "new_Role" SET "code" = 'ADMIN', "level" = 10, "isSystem" = true WHERE LOWER("name") = 'admin';
UPDATE "new_Role" SET "code" = 'MANAGER', "level" = 20, "isSystem" = true WHERE LOWER("name") = 'manager';
UPDATE "new_Role" SET "code" = 'EDITOR', "level" = 30, "isSystem" = true WHERE LOWER("name") = 'editor';
UPDATE "new_Role" SET "code" = 'MODERATOR', "level" = 40, "isSystem" = true WHERE LOWER("name") = 'moderator';
UPDATE "new_Role" SET "code" = 'SEO', "level" = 50, "isSystem" = true WHERE LOWER("name") = 'seo';
UPDATE "new_Role" SET "code" = 'MARKETOLOG', "level" = 60, "isSystem" = true WHERE LOWER("name") = 'marketolog';
UPDATE "new_Role" SET "code" = 'SUPPORT', "level" = 70, "isSystem" = true WHERE LOWER("name") = 'support';
UPDATE "new_Role" SET "code" = 'SUBSCRIBER', "level" = 80, "isSystem" = true WHERE LOWER("name") = 'subscriber';
UPDATE "new_Role" SET "code" = 'USER', "level" = 90, "isSystem" = true WHERE LOWER("name") = 'user';

-- For any custom roles, set code to uppercase name
UPDATE "new_Role" SET "code" = UPPER(REPLACE("name", ' ', '_')) WHERE "code" = 'TEMP_CODE';

-- Drop old table and rename new one
DROP TABLE "Role";
ALTER TABLE "new_Role" RENAME TO "Role";

-- Create indexes
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
