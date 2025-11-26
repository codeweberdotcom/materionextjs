-- Step 1: Add new status column with default value
ALTER TABLE "User" ADD COLUMN "status" TEXT DEFAULT 'active';

-- Step 2: Migrate data from isActive to status
-- isActive = true  → status = 'active'
-- isActive = false → status = 'suspended'
UPDATE "User" SET "status" = CASE 
  WHEN "isActive" = 1 THEN 'active'
  ELSE 'suspended'
END;

-- Step 3: Create index on status
CREATE INDEX "User_status_idx" ON "User"("status");

-- Step 4: Remove old isActive column (commented out for safety - uncomment after verification)
-- ALTER TABLE "User" DROP COLUMN "isActive";



