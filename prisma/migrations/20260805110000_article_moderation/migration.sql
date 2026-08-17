-- Moderasi usulan konten guru pada Article.
ALTER TABLE "Article" ADD COLUMN "authorId" TEXT;
ALTER TABLE "Article" ADD COLUMN "reviewStatus" TEXT;
ALTER TABLE "Article" ADD COLUMN "reviewNote" TEXT;

-- CreateIndex
CREATE INDEX "Article_authorId_idx" ON "Article"("authorId");
CREATE INDEX "Article_reviewStatus_idx" ON "Article"("reviewStatus");

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
