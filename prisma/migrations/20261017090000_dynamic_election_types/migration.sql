BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

-- Maintenance release: clean only manifested samples first; never backfill/split old votes.
LOCK TABLE "ElectionPeriod", "ElectionContest", "CandidatePair", "CandidateMember",
  "ElectionVoter", "VoterParticipation", "Ballot", "VotingSession" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ElectionPeriod") OR EXISTS (SELECT 1 FROM "ElectionContest")
    OR EXISTS (SELECT 1 FROM "CandidatePair") OR EXISTS (SELECT 1 FROM "CandidateMember")
    OR EXISTS (SELECT 1 FROM "ElectionVoter") OR EXISTS (SELECT 1 FROM "VoterParticipation")
    OR EXISTS (SELECT 1 FROM "Ballot") OR EXISTS (SELECT 1 FROM "VotingSession") THEN
    RAISE EXCEPTION 'EVOTING_MIGRATION_REQUIRES_EMPTY_ELECTION_DATA: review sample manifest before migration' USING ERRCODE = '55000';
  END IF;
END $$;

CREATE TYPE "CandidateMode" AS ENUM ('SINGLE', 'OPTIONAL_VICE');
CREATE TABLE "ElectionType" (
  "code" VARCHAR(32) PRIMARY KEY,
  "name" VARCHAR(120) NOT NULL,
  "logoUrl" VARCHAR(1024),
  "candidateMode" "CandidateMode" NOT NULL,
  "chairLabel" VARCHAR(80) NOT NULL,
  "viceChairLabel" VARCHAR(80),
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ElectionType_code_check" CHECK ("code" ~ '^[A-Z][A-Z0-9_]{1,31}$'),
  CONSTRAINT "ElectionType_labels_check" CHECK (length(btrim("name")) > 0 AND length(btrim("chairLabel")) > 0),
  CONSTRAINT "ElectionType_mode_check" CHECK (
    ("candidateMode" = 'SINGLE' AND "viceChairLabel" IS NULL) OR
    ("candidateMode" = 'OPTIONAL_VICE' AND "viceChairLabel" IS NOT NULL AND length(btrim("viceChairLabel")) > 0)),
  CONSTRAINT "ElectionType_order_check" CHECK ("sortOrder" BETWEEN 0 AND 9999),
  CONSTRAINT "ElectionType_revision_check" CHECK ("revision" >= 0),
  CONSTRAINT "ElectionType_logo_check" CHECK ("logoUrl" IS NULL OR length(btrim("logoUrl")) > 0)
);
CREATE INDEX "ElectionType_active_sortOrder_code_idx" ON "ElectionType" ("active", "sortOrder", "code");
INSERT INTO "ElectionType" ("code", "name", "candidateMode", "chairLabel", "viceChairLabel", "sortOrder") VALUES
  ('OSIS', 'OSIS', 'OPTIONAL_VICE', 'Ketua', 'Wakil Ketua', 1),
  ('PRADANA_PUTRA', 'Pradana Putra', 'SINGLE', 'Pradana Putra', NULL, 2),
  ('PRADANA_PUTRI', 'Pradana Putri', 'SINGLE', 'Pradana Putri', NULL, 3),
  ('IPNU', 'IPNU', 'OPTIONAL_VICE', 'Ketua', 'Wakil Ketua', 4),
  ('IPPNU', 'IPPNU', 'OPTIONAL_VICE', 'Ketua', 'Wakil Ketua', 5);

ALTER TABLE "CandidateMember" DROP CONSTRAINT "CandidateMember_pair_fkey";
ALTER TABLE "Ballot" DROP CONSTRAINT "Ballot_candidate_scope_fkey";
ALTER TABLE "CandidatePair" DROP CONSTRAINT "CandidatePair_contest_fkey";
ALTER TABLE "VoterParticipation" DROP CONSTRAINT "VoterParticipation_contest_fkey";
ALTER TABLE "ElectionContest" ALTER COLUMN "organization" TYPE VARCHAR(32) USING "organization"::text;
ALTER TABLE "CandidatePair" ALTER COLUMN "organization" TYPE VARCHAR(32) USING "organization"::text;
ALTER TABLE "CandidateMember" ALTER COLUMN "organization" TYPE VARCHAR(32) USING "organization"::text;
ALTER TABLE "VoterParticipation" ALTER COLUMN "organization" TYPE VARCHAR(32) USING "organization"::text;
ALTER TABLE "Ballot" ALTER COLUMN "organization" TYPE VARCHAR(32) USING "organization"::text;
DROP TYPE "VotingOrganization";

ALTER TABLE "ElectionPeriod" ADD COLUMN "contestsRevision" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "ElectionPeriod_revision_check" CHECK ("contestsRevision" >= 0),
  ADD CONSTRAINT "ElectionPeriod_snapshot_version_check" CHECK ("resultSnapshot" IS NULL OR
    (jsonb_typeof("resultSnapshot") = 'object' AND "resultSnapshot"->'version' = '2'::jsonb) IS TRUE),
  ADD CONSTRAINT "ElectionPeriod_result_state_check" CHECK (
    ("state" IN ('DRAFT', 'SCHEDULED') AND "closedAt" IS NULL AND "publishedAt" IS NULL AND "resultSnapshot" IS NULL) OR
    ("state" IN ('CLOSED', 'ARCHIVED') AND "closedAt" IS NOT NULL AND "closedAt" >= "opensAt"
      AND "resultSnapshot" IS NOT NULL AND "resultSnapshot" <> 'null'::jsonb
      AND ("publishedAt" IS NULL OR "publishedAt" >= "closedAt")));
ALTER TABLE "ElectionContest"
  ADD COLUMN "nameSnapshot" VARCHAR(120) NOT NULL,
  ADD COLUMN "logoUrlSnapshot" VARCHAR(1024),
  ADD COLUMN "candidateModeSnapshot" "CandidateMode" NOT NULL,
  ADD COLUMN "chairLabelSnapshot" VARCHAR(80) NOT NULL,
  ADD COLUMN "viceChairLabelSnapshot" VARCHAR(80),
  ADD COLUMN "sortOrder" INTEGER NOT NULL,
  ADD CONSTRAINT "ElectionContest_type_fkey" FOREIGN KEY ("organization") REFERENCES "ElectionType" ("code") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "ElectionContest_order_check" CHECK ("sortOrder" BETWEEN 1 AND 20),
  ADD CONSTRAINT "ElectionContest_period_order_key" UNIQUE ("periodId", "sortOrder") DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT "ElectionContest_labels_check" CHECK (length(btrim("nameSnapshot")) > 0 AND length(btrim("chairLabelSnapshot")) > 0),
  ADD CONSTRAINT "ElectionContest_mode_check" CHECK (
    ("candidateModeSnapshot" = 'SINGLE' AND "viceChairLabelSnapshot" IS NULL) OR
    ("candidateModeSnapshot" = 'OPTIONAL_VICE' AND "viceChairLabelSnapshot" IS NOT NULL AND length(btrim("viceChairLabelSnapshot")) > 0));
CREATE INDEX "ElectionContest_organization_idx" ON "ElectionContest" ("organization");
ALTER TABLE "CandidatePair" ADD CONSTRAINT "CandidatePair_contest_fkey" FOREIGN KEY ("periodId", "organization") REFERENCES "ElectionContest" ("periodId", "organization") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "CandidateMember" ADD CONSTRAINT "CandidateMember_pair_fkey" FOREIGN KEY ("candidatePairId", "periodId", "organization") REFERENCES "CandidatePair" ("id", "periodId", "organization") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "VoterParticipation" ADD CONSTRAINT "VoterParticipation_contest_fkey" FOREIGN KEY ("periodId", "organization") REFERENCES "ElectionContest" ("periodId", "organization") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Ballot" ADD CONSTRAINT "Ballot_candidate_scope_fkey" FOREIGN KEY ("candidateId", "periodId", "organization") REFERENCES "CandidatePair" ("id", "periodId", "organization") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "Ballot_contest_fkey" FOREIGN KEY ("periodId", "organization") REFERENCES "ElectionContest" ("periodId", "organization") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE FUNCTION evoting_protect_type() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW."code", NEW."createdAt") IS DISTINCT FROM (OLD."code", OLD."createdAt") THEN
    RAISE EXCEPTION 'election type identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF (to_jsonb(NEW) - 'revision') IS DISTINCT FROM (to_jsonb(OLD) - 'revision') THEN
    IF NEW."revision" <> OLD."revision" + 1 THEN
      RAISE EXCEPTION 'election type revision must advance once' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."revision" <> OLD."revision" THEN
    RAISE EXCEPTION 'no-op cannot advance revision' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ElectionType_protect_identity" BEFORE UPDATE ON "ElectionType" FOR EACH ROW EXECUTE FUNCTION evoting_protect_type();

CREATE FUNCTION evoting_protect_contest() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE election_id UUID; election_state "ElectionState"; master "ElectionType"%ROWTYPE;
BEGIN
  election_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."periodId" ELSE NEW."periodId" END;
  IF TG_OP = 'DELETE' AND COALESCE(evoting_test_cleanup_allowed(election_id), FALSE) THEN RETURN OLD; END IF;
  SELECT "state" INTO election_state FROM "ElectionPeriod" WHERE "id" = election_id FOR UPDATE;
  IF election_state IS DISTINCT FROM 'DRAFT'::"ElectionState" THEN
    RAISE EXCEPTION 'contest membership is frozen after scheduling' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT "code", "name", "logoUrl", "candidateMode", "chairLabel", "viceChairLabel", "active", "sortOrder", "revision", "createdAt"
      INTO master FROM "ElectionType" WHERE "code" = NEW."organization" FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'unknown election type' USING ERRCODE = '23503'; END IF;
    IF NOT master."active" THEN RAISE EXCEPTION 'inactive election type' USING ERRCODE = '55000'; END IF;
    NEW."nameSnapshot" := master."name";
    NEW."logoUrlSnapshot" := master."logoUrl";
    NEW."candidateModeSnapshot" := master."candidateMode";
    NEW."chairLabelSnapshot" := master."chairLabel";
    NEW."viceChairLabelSnapshot" := master."viceChairLabel";
  ELSIF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - 'sortOrder') IS DISTINCT FROM (to_jsonb(OLD) - 'sortOrder') THEN
      RAISE EXCEPTION 'contest snapshot and identity are immutable' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM "CandidatePair" WHERE "periodId" = election_id AND "organization" = OLD."organization")
      OR EXISTS (SELECT 1 FROM "VoterParticipation" WHERE "periodId" = election_id AND "organization" = OLD."organization" AND "hasVoted")
      OR EXISTS (SELECT 1 FROM "Ballot" WHERE "periodId" = election_id AND "organization" = OLD."organization") THEN
      RAISE EXCEPTION 'contest still has candidates or votes' USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ElectionContest_protect_snapshot" BEFORE INSERT OR UPDATE OR DELETE ON "ElectionContest" FOR EACH ROW EXECUTE FUNCTION evoting_protect_contest();

CREATE OR REPLACE FUNCTION evoting_lock_candidate_before_open() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE election_id UUID; election_state "ElectionState"; open_at TIMESTAMPTZ;
BEGIN
  election_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."periodId" ELSE NEW."periodId" END;
  IF TG_OP = 'DELETE' AND COALESCE(evoting_test_cleanup_allowed(election_id), FALSE) THEN RETURN OLD; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW."periodId" IS DISTINCT FROM OLD."periodId" OR NEW."organization" IS DISTINCT FROM OLD."organization" THEN
      RAISE EXCEPTION 'candidate scope is immutable' USING ERRCODE = '23514';
    END IF;
    IF TG_TABLE_NAME = 'CandidatePair' THEN
      IF NEW."id" IS DISTINCT FROM OLD."id" THEN RAISE EXCEPTION 'candidate identity is immutable' USING ERRCODE = '23514'; END IF;
    ELSIF (NEW."candidatePairId", NEW."position") IS DISTINCT FROM (OLD."candidatePairId", OLD."position") THEN
      RAISE EXCEPTION 'member position and pair are immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  SELECT "state", "opensAt" INTO election_state, open_at FROM "ElectionPeriod" WHERE "id" = election_id FOR UPDATE;
  IF election_state IS NULL OR NOT (election_state = 'DRAFT' OR (election_state = 'SCHEDULED' AND clock_timestamp() < open_at)) THEN
    RAISE EXCEPTION 'candidate slate is frozen at election opening' USING ERRCODE = '55000';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE OR REPLACE FUNCTION evoting_participation_monotonic() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE open_at TIMESTAMPTZ; close_at TIMESTAMPTZ; election_state "ElectionState";
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF COALESCE(evoting_test_cleanup_allowed(OLD."periodId"), FALSE) THEN RETURN OLD; END IF;
    SELECT "opensAt", "state" INTO open_at, election_state FROM "ElectionPeriod" WHERE "id" = OLD."periodId" FOR UPDATE;
    IF OLD."hasVoted" OR election_state IS NULL OR NOT (election_state = 'DRAFT' OR (election_state = 'SCHEDULED' AND clock_timestamp() < open_at)) THEN
      RAISE EXCEPTION 'participation cannot be deleted' USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT "opensAt", "state" INTO open_at, election_state FROM "ElectionPeriod" WHERE "id" = NEW."periodId" FOR UPDATE;
    IF NEW."hasVoted" OR election_state IS NULL OR NOT (election_state = 'DRAFT' OR (election_state = 'SCHEDULED' AND clock_timestamp() < open_at)) THEN
      RAISE EXCEPTION 'new voting right must be unvoted and before opening' USING ERRCODE = '55000';
    END IF;
  ELSE
    IF (NEW."voterId", NEW."periodId", NEW."organization") IS DISTINCT FROM (OLD."voterId", OLD."periodId", OLD."organization") OR (OLD."hasVoted" AND NOT NEW."hasVoted") THEN
      RAISE EXCEPTION 'participation keys and recorded votes are immutable' USING ERRCODE = '55000';
    END IF;
    IF NEW."hasVoted" IS DISTINCT FROM OLD."hasVoted" THEN
      SELECT "opensAt", "closesAt", "state" INTO open_at, close_at, election_state FROM "ElectionPeriod" WHERE "id" = NEW."periodId" FOR SHARE;
      IF election_state IS DISTINCT FROM 'SCHEDULED'::"ElectionState" OR clock_timestamp() < open_at OR clock_timestamp() >= close_at THEN
        RAISE EXCEPTION 'voting period is not open' USING ERRCODE = '55000';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "VoterParticipation_before_insert" BEFORE INSERT ON "VoterParticipation" FOR EACH ROW EXECUTE FUNCTION evoting_participation_monotonic();

CREATE OR REPLACE FUNCTION evoting_validate_candidate_pair_id(pair_id UUID) RETURNS void LANGUAGE plpgsql AS $$
DECLARE chair_count INTEGER; vice_count INTEGER; student_count INTEGER; mode "CandidateMode";
BEGIN
  SELECT c."candidateModeSnapshot" INTO mode FROM "CandidatePair" p JOIN "ElectionContest" c
    ON (c."periodId", c."organization") = (p."periodId", p."organization") WHERE p."id" = pair_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT count(*) FILTER (WHERE "position" = 'CHAIR'), count(*) FILTER (WHERE "position" = 'VICE_CHAIR'), count(DISTINCT "studentId")
    INTO chair_count, vice_count, student_count FROM "CandidateMember" WHERE "candidatePairId" = pair_id;
  IF chair_count <> 1 OR vice_count > 1 OR student_count <> 1 + vice_count OR (mode = 'SINGLE' AND vice_count <> 0) THEN
    RAISE EXCEPTION 'candidate composition does not match contest mode' USING ERRCODE = '23514';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION evoting_protect_voter_identity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE election_id UUID; election_state "ElectionState"; open_at TIMESTAMPTZ; close_at TIMESTAMPTZ;
BEGIN
  election_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."periodId" ELSE NEW."periodId" END;
  IF TG_OP = 'DELETE' AND COALESCE(evoting_test_cleanup_allowed(election_id), FALSE) THEN RETURN OLD; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (NEW."id", NEW."voterType", NEW."studentId", NEW."teacherId", NEW."loginCode", NEW."periodId")
      IS DISTINCT FROM (OLD."id", OLD."voterType", OLD."studentId", OLD."teacherId", OLD."loginCode", OLD."periodId") THEN
      RAISE EXCEPTION 'voter ownership and login code are immutable' USING ERRCODE = '23514';
    END IF;
    IF (NEW."nisn", NEW."name", NEW."className") IS NOT DISTINCT FROM (OLD."nisn", OLD."name", OLD."className") THEN RETURN NEW; END IF;
  END IF;
  SELECT "state", "opensAt", "closesAt" INTO election_state, open_at, close_at FROM "ElectionPeriod" WHERE "id" = election_id FOR UPDATE;
  IF election_state = 'DRAFT' OR (election_state = 'SCHEDULED' AND clock_timestamp() < open_at) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  -- The service must additionally require two authenticated reviewers for this exception.
  IF TG_OP = 'UPDATE' AND election_state = 'SCHEDULED' AND clock_timestamp() < close_at
    AND NEW."voterType" = 'STUDENT' AND (NEW."name", NEW."className") IS NOT DISTINCT FROM (OLD."name", OLD."className")
    AND NOT EXISTS (SELECT 1 FROM "VoterParticipation" WHERE "voterId" = OLD."id" AND "hasVoted") THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'voter membership and historical identity are frozen' USING ERRCODE = '23514';
END $$;

CREATE FUNCTION evoting_validate_period_shape(election_id UUID) RETURNS void LANGUAGE plpgsql AS $$
DECLARE n INTEGER; first_order INTEGER; last_order INTEGER; voters INTEGER; election_state "ElectionState";
BEGIN
  SELECT "state" INTO election_state FROM "ElectionPeriod" WHERE "id" = election_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT count(*), min("sortOrder"), max("sortOrder") INTO n, first_order, last_order FROM "ElectionContest" WHERE "periodId" = election_id;
  IF n NOT BETWEEN 1 AND 20 OR first_order <> 1 OR last_order <> n THEN
    RAISE EXCEPTION 'period must have 1..20 contiguous contests' USING ERRCODE = '23514';
  END IF;
  SELECT count(*) INTO voters FROM "ElectionVoter" WHERE "periodId" = election_id;
  IF voters > 99 OR (election_state <> 'DRAFT' AND voters = 0) THEN
    RAISE EXCEPTION 'invalid combined voter count' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT v."id" FROM "ElectionVoter" v LEFT JOIN "VoterParticipation" p
    ON p."voterId" = v."id" AND p."periodId" = v."periodId" WHERE v."periodId" = election_id
    GROUP BY v."id" HAVING count(p."organization") <> n) THEN
    RAISE EXCEPTION 'each voter must have exactly the period contest set' USING ERRCODE = '23514';
  END IF;
  IF election_state <> 'DRAFT' AND EXISTS (SELECT 1 FROM "ElectionContest" c WHERE c."periodId" = election_id AND
    NOT EXISTS (SELECT 1 FROM "CandidatePair" p WHERE (p."periodId", p."organization") = (c."periodId", c."organization"))) THEN
    RAISE EXCEPTION 'scheduled contest must retain a candidate' USING ERRCODE = '23514';
  END IF;
END $$;
CREATE FUNCTION evoting_period_shape_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE election_id UUID; voter_id UUID; n INTEGER; rights INTEGER; voters INTEGER; election_state "ElectionState";
BEGIN
  IF TG_TABLE_NAME = 'ElectionPeriod' THEN
    election_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."id" ELSE NEW."id" END;
  ELSE
    election_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."periodId" ELSE NEW."periodId" END;
  END IF;
  -- Per-right events validate one voter; contest/period events validate the full set.
  IF TG_TABLE_NAME IN ('ElectionVoter', 'VoterParticipation') THEN
    SELECT "state" INTO election_state FROM "ElectionPeriod" WHERE "id" = election_id;
    IF NOT FOUND THEN RETURN NULL; END IF;
    IF TG_TABLE_NAME = 'ElectionVoter' THEN
      SELECT count(*) INTO voters FROM "ElectionVoter" WHERE "periodId" = election_id;
      IF voters > 99 OR (election_state <> 'DRAFT' AND voters = 0) THEN
        RAISE EXCEPTION 'invalid combined voter count' USING ERRCODE = '23514';
      END IF;
      voter_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."id" ELSE NEW."id" END;
    ELSE
      voter_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."voterId" ELSE NEW."voterId" END;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM "ElectionVoter" WHERE "id" = voter_id AND "periodId" = election_id) THEN RETURN NULL; END IF;
    SELECT count(*) INTO n FROM "ElectionContest" WHERE "periodId" = election_id;
    SELECT count(*) INTO rights FROM "VoterParticipation" WHERE "voterId" = voter_id AND "periodId" = election_id;
    IF n NOT BETWEEN 1 AND 20 OR rights <> n THEN
      RAISE EXCEPTION 'each voter must have exactly the period contest set' USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
  END IF;
  PERFORM evoting_validate_period_shape(election_id);
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "ElectionPeriod_complete_shape" AFTER INSERT OR UPDATE ON "ElectionPeriod" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION evoting_period_shape_trigger();
CREATE CONSTRAINT TRIGGER "ElectionContest_complete_shape" AFTER INSERT OR UPDATE OR DELETE ON "ElectionContest" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION evoting_period_shape_trigger();
CREATE CONSTRAINT TRIGGER "ElectionVoter_complete_shape" AFTER INSERT OR UPDATE OR DELETE ON "ElectionVoter" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION evoting_period_shape_trigger();
CREATE CONSTRAINT TRIGGER "VoterParticipation_complete_shape" AFTER INSERT OR UPDATE OR DELETE ON "VoterParticipation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION evoting_period_shape_trigger();
CREATE CONSTRAINT TRIGGER "CandidatePair_period_shape" AFTER DELETE ON "CandidatePair" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION evoting_period_shape_trigger();

CREATE OR REPLACE FUNCTION evoting_protect_period_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT COALESCE(evoting_test_cleanup_allowed(OLD."id"), FALSE) THEN
      RAISE EXCEPTION 'period deletion requires test cleanup' USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;
  IF (NEW."id", NEW."slug", NEW."isTest", NEW."createdAt") IS DISTINCT FROM (OLD."id", OLD."slug", OLD."isTest", OLD."createdAt") THEN
    RAISE EXCEPTION 'period identity is immutable' USING ERRCODE = '55000';
  END IF;
  IF NEW."contestsRevision" <> OLD."contestsRevision" AND (OLD."state" <> 'DRAFT' OR NEW."state" <> 'DRAFT' OR NEW."contestsRevision" <> OLD."contestsRevision" + 1) THEN
    RAISE EXCEPTION 'invalid contest revision change' USING ERRCODE = '23514';
  END IF;
  IF NOT ((OLD."state" = 'DRAFT' AND NEW."state" IN ('DRAFT', 'SCHEDULED'))
    OR (OLD."state" = 'SCHEDULED' AND NEW."state" IN ('SCHEDULED', 'CLOSED'))
    OR (OLD."state" = 'CLOSED' AND NEW."state" IN ('CLOSED', 'ARCHIVED'))
    OR (OLD."state" = 'ARCHIVED' AND NEW."state" = 'ARCHIVED')) THEN
    RAISE EXCEPTION 'invalid election state transition' USING ERRCODE = '55000';
  END IF;
  IF OLD."state" = 'SCHEDULED' AND clock_timestamp() >= OLD."opensAt" THEN
    IF (NEW."name", NEW."academicYear", NEW."opensAt") IS DISTINCT FROM (OLD."name", OLD."academicYear", OLD."opensAt") THEN
      RAISE EXCEPTION 'opened election configuration is frozen' USING ERRCODE = '55000';
    END IF;
    IF NEW."closesAt" IS DISTINCT FROM OLD."closesAt" AND (NEW."state" <> 'SCHEDULED' OR OLD."extensionUsedAt" IS NOT NULL
      OR NEW."extensionUsedAt" IS NULL OR NEW."closesAt" <= OLD."closesAt" OR NEW."closesAt" > OLD."closesAt" + interval '60 minutes') THEN
      RAISE EXCEPTION 'only one bounded extension may change the deadline' USING ERRCODE = '55000';
    END IF;
  END IF;
  IF NEW."extensionUsedAt" IS DISTINCT FROM OLD."extensionUsedAt" AND (OLD."extensionUsedAt" IS NOT NULL OR NEW."extensionUsedAt" IS NULL
    OR NEW."state" <> 'SCHEDULED' OR NEW."closesAt" <= OLD."closesAt" OR NEW."closesAt" > OLD."closesAt" + interval '60 minutes') THEN
    RAISE EXCEPTION 'invalid extension marker' USING ERRCODE = '23514';
  END IF;
  IF OLD."state" IN ('CLOSED', 'ARCHIVED') THEN
    IF (to_jsonb(NEW) - 'state' - 'publishedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'state' - 'publishedAt')
      OR (NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt" AND (OLD."state" <> 'CLOSED' OR OLD."publishedAt" IS NOT NULL OR NEW."publishedAt" IS NULL OR NEW."state" <> 'CLOSED')) THEN
      RAISE EXCEPTION 'closed election is immutable except publication and archive' USING ERRCODE = '55000';
    END IF;
  END IF;
  IF NEW."state" = 'CLOSED' AND OLD."state" = 'SCHEDULED' AND NEW."closedAt" > clock_timestamp() THEN
    RAISE EXCEPTION 'close time cannot be in the future' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
COMMIT;
