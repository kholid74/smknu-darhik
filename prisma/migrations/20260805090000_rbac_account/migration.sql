-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountRole" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "AccountRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountOverride" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "effect" TEXT NOT NULL,

    CONSTRAINT "AccountOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_username_key" ON "Account"("username");

-- CreateIndex
CREATE INDEX "AccountRole_role_idx" ON "AccountRole"("role");

-- CreateIndex
CREATE UNIQUE INDEX "AccountRole_accountId_role_key" ON "AccountRole"("accountId", "role");

-- CreateIndex
CREATE INDEX "AccountOverride_accountId_idx" ON "AccountOverride"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountOverride_accountId_capability_effect_key" ON "AccountOverride"("accountId", "capability", "effect");

-- AddForeignKey
ALTER TABLE "AccountRole" ADD CONSTRAINT "AccountRole_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountOverride" ADD CONSTRAINT "AccountOverride_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: Admin -> Account (reuse id, assign placeholder email, carry bcrypt hash)
INSERT INTO "Account" ("id", "email", "username", "passwordHash", "active", "createdAt")
SELECT "id", "username" || '@smksnudarhik.local', "username", "password", true, CURRENT_TIMESTAMP
FROM "Admin"
ON CONFLICT ("id") DO NOTHING;

-- DataMigration: role mapping (superadmin -> superadmin, editor/lainnya -> staf)
INSERT INTO "AccountRole" ("id", "accountId", "role")
SELECT gen_random_uuid()::text, "id", CASE WHEN "role" = 'superadmin' THEN 'superadmin' ELSE 'staf' END
FROM "Admin"
ON CONFLICT ("accountId", "role") DO NOTHING;
