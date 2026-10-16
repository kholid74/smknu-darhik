BEGIN;
CREATE TYPE "ElectionVoterType" AS ENUM ('STUDENT', 'TEACHER');
ALTER TABLE "ElectionVoter"
  ADD COLUMN "voterType" "ElectionVoterType" NOT NULL DEFAULT 'STUDENT',
  ADD COLUMN "teacherId" TEXT,
  ADD COLUMN "loginCode" VARCHAR(32),
  ALTER COLUMN "studentId" DROP NOT NULL,
  ALTER COLUMN "nisn" DROP NOT NULL;
ALTER TABLE "ElectionVoter" ADD CONSTRAINT "ElectionVoter_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE UNIQUE INDEX "ElectionVoter_periodId_teacherId_key" ON "ElectionVoter"("periodId", "teacherId");
CREATE UNIQUE INDEX "ElectionVoter_periodId_loginCode_key" ON "ElectionVoter"("periodId", "loginCode");
ALTER TABLE "ElectionVoter" ADD CONSTRAINT "ElectionVoter_identity_check" CHECK (
  ("voterType" = 'STUDENT' AND "studentId" IS NOT NULL AND "teacherId" IS NULL AND "loginCode" IS NULL
    AND "nisn" IS NOT NULL AND "nisn" ~ '^[0-9]{10}$') OR
  ("voterType" = 'TEACHER' AND "studentId" IS NULL AND "teacherId" IS NOT NULL AND "nisn" IS NULL
    AND "loginCode" IS NOT NULL AND "loginCode" ~ '^GURU-[A-F0-9]{12}$')
);

-- Credentials and historical student PIN material remain unchanged.
CREATE FUNCTION evoting_protect_voter_identity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE election_id UUID; election_state "ElectionState"; open_at TIMESTAMPTZ;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW."voterType",NEW."studentId",NEW."teacherId",NEW."loginCode",NEW."periodId")
       IS DISTINCT FROM (OLD."voterType",OLD."studentId",OLD."teacherId",OLD."loginCode",OLD."periodId") THEN
      RAISE EXCEPTION 'voter ownership and login code are immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  election_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."periodId" ELSE NEW."periodId" END;
  IF TG_OP = 'DELETE' AND evoting_test_cleanup_allowed(election_id) THEN RETURN OLD; END IF;
  SELECT "state","opensAt" INTO election_state,open_at FROM "ElectionPeriod" WHERE id=election_id FOR SHARE;
  IF election_state NOT IN ('DRAFT','SCHEDULED') OR open_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'voter membership is frozen' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ElectionVoter_protect_identity" BEFORE INSERT OR UPDATE OR DELETE ON "ElectionVoter"
FOR EACH ROW EXECUTE FUNCTION evoting_protect_voter_identity();
COMMIT;
