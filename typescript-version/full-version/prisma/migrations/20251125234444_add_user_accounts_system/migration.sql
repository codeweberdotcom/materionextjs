-- CreateTable
CREATE TABLE "tariff_plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "features" TEXT NOT NULL DEFAULT '{}',
    "maxAccounts" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "user_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tariffPlanId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" TEXT DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_accounts_tariffPlanId_fkey" FOREIGN KEY ("tariffPlanId") REFERENCES "tariff_plans" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "user_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_accounts_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "account_managers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canManage" BOOLEAN NOT NULL DEFAULT true,
    "canEdit" BOOLEAN NOT NULL DEFAULT true,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT NOT NULL,
    "revokedAt" DATETIME,
    "revokedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "account_managers_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "user_accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "account_managers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "account_transfers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromAccountId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedBy" TEXT NOT NULL,
    "acceptedAt" DATETIME,
    "rejectedAt" DATETIME,
    "cancelledAt" DATETIME,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "account_transfers_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "user_accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "account_transfers_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "phoneVerified" DATETIME,
    "documentsVerified" DATETIME,
    "documentsVerifiedBy" TEXT,
    "documentsRejectedAt" DATETIME,
    "documentsRejectedReason" TEXT,
    "image" TEXT,
    "roleId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'Russian',
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "country" TEXT NOT NULL DEFAULT 'russia',
    "status" TEXT NOT NULL DEFAULT 'active',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeen" DATETIME,
    "telegramChatId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_User" ("country", "createdAt", "currency", "documentsRejectedAt", "documentsRejectedReason", "documentsVerified", "documentsVerifiedBy", "email", "emailVerified", "id", "image", "isActive", "language", "lastSeen", "name", "password", "phone", "phoneVerified", "roleId", "status", "telegramChatId", "updatedAt") SELECT "country", "createdAt", "currency", "documentsRejectedAt", "documentsRejectedReason", "documentsVerified", "documentsVerifiedBy", "email", "emailVerified", "id", "image", "isActive", "language", "lastSeen", "name", "password", "phone", "phoneVerified", "roleId", coalesce("status", 'active') AS "status", "telegramChatId", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_phone_idx" ON "User"("phone");
CREATE INDEX "User_telegramChatId_idx" ON "User"("telegramChatId");
CREATE INDEX "User_documentsVerified_idx" ON "User"("documentsVerified");
CREATE INDEX "User_status_idx" ON "User"("status");
CREATE TABLE "new_listing_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "listing_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "listing_categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_listing_categories" ("createdAt", "description", "icon", "id", "isActive", "name", "parentId", "slug", "sortOrder", "updatedAt") SELECT "createdAt", "description", "icon", "id", "isActive", "name", "parentId", "slug", "sortOrder", "updatedAt" FROM "listing_categories";
DROP TABLE "listing_categories";
ALTER TABLE "new_listing_categories" RENAME TO "listing_categories";
CREATE UNIQUE INDEX "listing_categories_name_key" ON "listing_categories"("name");
CREATE UNIQUE INDEX "listing_categories_slug_key" ON "listing_categories"("slug");
CREATE INDEX "listing_categories_parentId_idx" ON "listing_categories"("parentId");
CREATE INDEX "listing_categories_isActive_sortOrder_idx" ON "listing_categories"("isActive", "sortOrder");
CREATE TABLE "new_listings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" REAL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "categoryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "ownerId" TEXT NOT NULL,
    "moderatorId" TEXT,
    "moderatedAt" DATETIME,
    "rejectionReason" TEXT,
    "images" TEXT DEFAULT '[]',
    "location" TEXT,
    "contacts" TEXT DEFAULT '{}',
    "metadata" TEXT DEFAULT '{}',
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" DATETIME,
    "soldAt" DATETIME,
    "archivedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "listings_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "listing_categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_listings" ("archivedAt", "categoryId", "contacts", "createdAt", "currency", "description", "expiresAt", "id", "images", "location", "metadata", "moderatedAt", "moderatorId", "ownerId", "price", "publishedAt", "rejectionReason", "soldAt", "status", "title", "updatedAt", "viewsCount") SELECT "archivedAt", "categoryId", "contacts", "createdAt", "currency", "description", "expiresAt", "id", "images", "location", "metadata", "moderatedAt", "moderatorId", "ownerId", "price", "publishedAt", "rejectionReason", "soldAt", "status", "title", "updatedAt", "viewsCount" FROM "listings";
DROP TABLE "listings";
ALTER TABLE "new_listings" RENAME TO "listings";
CREATE INDEX "listings_ownerId_idx" ON "listings"("ownerId");
CREATE INDEX "listings_status_idx" ON "listings"("status");
CREATE INDEX "listings_categoryId_idx" ON "listings"("categoryId");
CREATE INDEX "listings_status_createdAt_idx" ON "listings"("status", "createdAt");
CREATE INDEX "listings_ownerId_status_idx" ON "listings"("ownerId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "tariff_plans_code_key" ON "tariff_plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tariff_plans_name_key" ON "tariff_plans"("name");

-- CreateIndex
CREATE INDEX "tariff_plans_code_idx" ON "tariff_plans"("code");

-- CreateIndex
CREATE INDEX "tariff_plans_isActive_idx" ON "tariff_plans"("isActive");

-- CreateIndex
CREATE INDEX "user_accounts_userId_idx" ON "user_accounts"("userId");

-- CreateIndex
CREATE INDEX "user_accounts_ownerId_idx" ON "user_accounts"("ownerId");

-- CreateIndex
CREATE INDEX "user_accounts_type_idx" ON "user_accounts"("type");

-- CreateIndex
CREATE INDEX "user_accounts_status_idx" ON "user_accounts"("status");

-- CreateIndex
CREATE INDEX "user_accounts_tariffPlanId_idx" ON "user_accounts"("tariffPlanId");

-- CreateIndex
CREATE INDEX "account_managers_userId_idx" ON "account_managers"("userId");

-- CreateIndex
CREATE INDEX "account_managers_accountId_idx" ON "account_managers"("accountId");

-- CreateIndex
CREATE INDEX "account_managers_canManage_idx" ON "account_managers"("canManage");

-- CreateIndex
CREATE UNIQUE INDEX "account_managers_accountId_userId_key" ON "account_managers"("accountId", "userId");

-- CreateIndex
CREATE INDEX "account_transfers_fromAccountId_idx" ON "account_transfers"("fromAccountId");

-- CreateIndex
CREATE INDEX "account_transfers_toUserId_idx" ON "account_transfers"("toUserId");

-- CreateIndex
CREATE INDEX "account_transfers_status_idx" ON "account_transfers"("status");
