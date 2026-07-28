-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'image';

-- CreateIndex
CREATE INDEX "Media_kind_idx" ON "Media"("kind");
