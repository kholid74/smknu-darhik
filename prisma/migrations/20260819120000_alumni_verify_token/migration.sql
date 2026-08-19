-- Token acak untuk QR/URL verify publik alumni (anti-enumerasi).
ALTER TABLE "Alumni" ADD COLUMN "verifyToken" TEXT;
CREATE UNIQUE INDEX "Alumni_verifyToken_key" ON "Alumni"("verifyToken");
