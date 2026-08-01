-- CreateTable
CREATE TABLE "Province" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Province_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Regency" (
    "id" TEXT NOT NULL,
    "provinceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Regency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Regency_provinceId_idx" ON "Regency"("provinceId");
