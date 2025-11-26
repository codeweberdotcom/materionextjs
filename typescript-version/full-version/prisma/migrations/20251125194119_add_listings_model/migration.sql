-- CreateTable
CREATE TABLE "listings" (
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "listing_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "listings_ownerId_idx" ON "listings"("ownerId");

-- CreateIndex
CREATE INDEX "listings_status_idx" ON "listings"("status");

-- CreateIndex
CREATE INDEX "listings_categoryId_idx" ON "listings"("categoryId");

-- CreateIndex
CREATE INDEX "listings_status_createdAt_idx" ON "listings"("status", "createdAt");

-- CreateIndex
CREATE INDEX "listings_ownerId_status_idx" ON "listings"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "listing_categories_name_key" ON "listing_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "listing_categories_slug_key" ON "listing_categories"("slug");

-- CreateIndex
CREATE INDEX "listing_categories_parentId_idx" ON "listing_categories"("parentId");

-- CreateIndex
CREATE INDEX "listing_categories_isActive_sortOrder_idx" ON "listing_categories"("isActive", "sortOrder");
