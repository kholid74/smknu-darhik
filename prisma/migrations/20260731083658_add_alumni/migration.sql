-- CreateTable
CREATE TABLE "Alumni" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "angkatan" INTEGER NOT NULL,
    "jurusan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Bekerja',
    "pekerjaan" TEXT,
    "instansi" TEXT,
    "cerita" TEXT,
    "wa" TEXT,
    "photoUrl" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alumni_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Alumni_verified_idx" ON "Alumni"("verified");

-- CreateIndex
CREATE INDEX "Alumni_angkatan_idx" ON "Alumni"("angkatan");
