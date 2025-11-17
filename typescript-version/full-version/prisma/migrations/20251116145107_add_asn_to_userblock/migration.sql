-- AlterTable
ALTER TABLE "UserBlock" ADD COLUMN "asn" TEXT;

-- CreateIndex
CREATE INDEX "UserBlock_asn_idx" ON "UserBlock"("asn");
