-- AlterTable: Make email optional and add phone fields
-- Note: SQLite doesn't support ALTER COLUMN directly, so we need to recreate the table

-- Step 1: Create new User table with updated schema
CREATE TABLE "User_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "phoneVerified" DATETIME,
    "image" TEXT,
    "roleId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'Russian',
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "country" TEXT NOT NULL DEFAULT 'russia',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeen" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Step 2: Copy existing data from old table to new table
INSERT INTO "User_new" (
    "id", "name", "email", "password", "emailVerified", "image", 
    "roleId", "language", "currency", "country", "isActive", "lastSeen", 
    "createdAt", "updatedAt"
)
SELECT 
    "id", "name", "email", "password", "emailVerified", "image",
    "roleId", "language", "currency", "country", "isActive", "lastSeen",
    "createdAt", "updatedAt"
FROM "User";

-- Step 3: Drop old table
DROP TABLE "User";

-- Step 4: Rename new table to User
ALTER TABLE "User_new" RENAME TO "User";

-- Step 5: Create unique indexes for email and phone (nullable fields can have unique indexes in SQLite)
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- Step 6: Create regular indexes for email and phone
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- Step 7: Recreate foreign key indexes
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateTable: VerificationCode
CREATE TABLE "VerificationCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VerificationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex: VerificationCode indexes
CREATE INDEX "VerificationCode_identifier_type_idx" ON "VerificationCode"("identifier", "type");
CREATE INDEX "VerificationCode_code_idx" ON "VerificationCode"("code");
CREATE INDEX "VerificationCode_userId_idx" ON "VerificationCode"("userId");
CREATE INDEX "VerificationCode_type_verified_idx" ON "VerificationCode"("type", "verified");
CREATE INDEX "VerificationCode_expires_idx" ON "VerificationCode"("expires");

-- CreateTable: RegistrationSettings
CREATE TABLE "RegistrationSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "registrationMode" TEXT NOT NULL DEFAULT 'email_or_phone',
    "requirePhoneVerification" BOOLEAN NOT NULL DEFAULT true,
    "requireEmailVerification" BOOLEAN NOT NULL DEFAULT true,
    "smsProvider" TEXT NOT NULL DEFAULT 'smsru',
    "updatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex: RegistrationSettings unique constraint
CREATE UNIQUE INDEX "RegistrationSettings_id_key" ON "RegistrationSettings"("id");

