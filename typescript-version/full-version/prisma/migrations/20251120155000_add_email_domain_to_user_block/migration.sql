ALTER TABLE "UserBlock" ADD COLUMN "mailDomain" TEXT;

CREATE INDEX "UserBlock_mailDomain_idx" ON "UserBlock"("mailDomain");
