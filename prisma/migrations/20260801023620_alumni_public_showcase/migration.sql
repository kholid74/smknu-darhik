-- AlterTable
ALTER TABLE "Alumni" ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicOptIn" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Alumni_featured_idx" ON "Alumni"("featured");
