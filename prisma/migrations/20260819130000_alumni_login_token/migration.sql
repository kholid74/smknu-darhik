-- Token magic-link login alumni (single-use, hash disimpan, TTL).
CREATE TABLE "AlumniLoginToken" (
  "id" TEXT NOT NULL,
  "alumniId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AlumniLoginToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AlumniLoginToken_tokenHash_key" ON "AlumniLoginToken"("tokenHash");
CREATE INDEX "AlumniLoginToken_alumniId_idx" ON "AlumniLoginToken"("alumniId");
CREATE INDEX "AlumniLoginToken_expiresAt_idx" ON "AlumniLoginToken"("expiresAt");
ALTER TABLE "AlumniLoginToken" ADD CONSTRAINT "AlumniLoginToken_alumniId_fkey"
  FOREIGN KEY ("alumniId") REFERENCES "Alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;
