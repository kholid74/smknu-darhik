ALTER TABLE "Alumni" ADD COLUMN "alumniId" TEXT;
CREATE UNIQUE INDEX "Alumni_alumniId_key" ON "Alumni"("alumniId");
