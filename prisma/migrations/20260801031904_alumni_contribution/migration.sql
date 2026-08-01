-- CreateTable
CREATE TABLE "AlumniContribution" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "kontak" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'baru',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlumniContribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlumniContribution_status_idx" ON "AlumniContribution"("status");

-- CreateIndex
CREATE INDEX "AlumniContribution_createdAt_idx" ON "AlumniContribution"("createdAt");
