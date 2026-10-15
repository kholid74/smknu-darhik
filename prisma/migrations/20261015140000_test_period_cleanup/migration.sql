BEGIN;
ALTER TABLE "ElectionPeriod" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT FALSE;

-- These two legacy periods were explicitly confirmed as testing by the operator.
WITH marked AS (
  UPDATE "ElectionPeriod" SET "isTest" = TRUE
  WHERE ("id", "slug") IN (
    ('cfb0e26c-72bb-4593-a7de-ce576357f29e'::uuid, 'osis-2026'),
    ('fcf94a5a-bb68-4a5a-bd20-62289691ce48'::uuid, 'pem-osis-2026')
  ) AND "publishedAt" IS NULL AND "state" IN ('DRAFT', 'SCHEDULED')
  RETURNING "id", "slug"
)
INSERT INTO "VotingAuditEvent" ("id", "periodId", "event", "targetId", "reasonCode", "detail")
SELECT gen_random_uuid(), "id", 'TEST_PERIOD_CLASSIFIED', "id"::text, 'OPERATOR_CONFIRMED_TEST',
  jsonb_build_object('slug', "slug", 'migration', '20261015140000_test_period_cleanup') FROM marked;

-- Audit keeps the original UUID after a test period is deleted; rows remain append-only.
ALTER TABLE "VotingAuditEvent" DROP CONSTRAINT "VotingAuditEvent_period_fkey";
CREATE FUNCTION evoting_audit_existing_period() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."periodId" IS NOT NULL THEN
    PERFORM 1 FROM "ElectionPeriod" WHERE "id" = NEW."periodId" FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'audit period does not exist' USING ERRCODE = '23503'; END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "VotingAuditEvent_existing_period" BEFORE INSERT ON "VotingAuditEvent"
FOR EACH ROW EXECUTE FUNCTION evoting_audit_existing_period();

CREATE FUNCTION evoting_test_cleanup_allowed(election_id UUID) RETURNS BOOLEAN
LANGUAGE sql VOLATILE AS $$
  SELECT current_setting('smkdh.test_cleanup_period', true) = election_id::text
    AND current_setting('smkdh.test_cleanup_transaction', true) = txid_current()::text
    AND EXISTS (SELECT 1 FROM "ElectionPeriod" WHERE "id" = election_id AND "isTest" AND "publishedAt" IS NULL)
$$;

CREATE FUNCTION evoting_protect_period_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT COALESCE(evoting_test_cleanup_allowed(OLD."id"), FALSE) THEN
      RAISE EXCEPTION 'period deletion requires test cleanup' USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW."isTest" IS DISTINCT FROM OLD."isTest" THEN
    RAISE EXCEPTION 'period test classification is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ElectionPeriod_protect_identity" BEFORE UPDATE OR DELETE ON "ElectionPeriod"
FOR EACH ROW EXECUTE FUNCTION evoting_protect_period_identity();

CREATE OR REPLACE FUNCTION evoting_lock_candidate_before_open() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE election_id UUID; open_at TIMESTAMPTZ; election_state "ElectionState";
BEGIN
  election_id := COALESCE(NEW."periodId", OLD."periodId");
  IF TG_OP = 'DELETE' AND COALESCE(evoting_test_cleanup_allowed(election_id), FALSE) THEN RETURN OLD; END IF;
  SELECT "opensAt", "state" INTO open_at, election_state FROM "ElectionPeriod" WHERE "id" = election_id FOR UPDATE;
  IF open_at IS NULL OR election_state NOT IN ('DRAFT', 'SCHEDULED') OR clock_timestamp() >= open_at THEN
    RAISE EXCEPTION 'candidate slate is frozen at election opening' USING ERRCODE = '55000';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE OR REPLACE FUNCTION evoting_reject_ballot_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND COALESCE(evoting_test_cleanup_allowed(OLD."periodId"), FALSE) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'ballots are immutable' USING ERRCODE = '55000';
END $$;

CREATE OR REPLACE FUNCTION evoting_participation_monotonic() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE open_at TIMESTAMPTZ;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF COALESCE(evoting_test_cleanup_allowed(OLD."periodId"), FALSE) THEN RETURN OLD; END IF;
    SELECT "opensAt" INTO open_at FROM "ElectionPeriod" WHERE "id" = OLD."periodId" FOR UPDATE;
    IF OLD."hasVoted" OR clock_timestamp() >= open_at THEN
      RAISE EXCEPTION 'participation cannot be deleted' USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW."voterId", NEW."periodId", NEW."organization") IS DISTINCT FROM (OLD."voterId", OLD."periodId", OLD."organization") THEN
    RAISE EXCEPTION 'participation key is immutable' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."hasVoted" AND NOT NEW."hasVoted" THEN
    RAISE EXCEPTION 'participation is monotonic' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION evoting_test_cleanup_preview(election_id UUID) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE summary JSONB;
BEGIN
  SELECT jsonb_build_object('id', p."id", 'slug', p."slug", 'name', p."name", 'state', p."state",
    'academicYear', p."academicYear", 'opensAt', p."opensAt", 'closesAt', p."closesAt",
    'isTest', p."isTest", 'publishedAt', p."publishedAt",
    'contests', (SELECT count(*) FROM "ElectionContest" WHERE "periodId" = election_id),
    'candidates', (SELECT count(*) FROM "CandidatePair" WHERE "periodId" = election_id),
    'members', (SELECT count(*) FROM "CandidateMember" WHERE "periodId" = election_id),
    'voters', (SELECT count(*) FROM "ElectionVoter" WHERE "periodId" = election_id),
    'pins', (SELECT count(*) FROM "ElectionVoter" WHERE "periodId" = election_id AND "pinHash" IS NOT NULL),
    'participation', (SELECT count(*) FROM "VoterParticipation" WHERE "periodId" = election_id),
    'ballots', (SELECT count(*) FROM "Ballot" WHERE "periodId" = election_id),
    'sessions', (SELECT count(*) FROM "VotingSession" s JOIN "ElectionVoter" v ON v."id" = s."voterId" WHERE v."periodId" = election_id),
    'auditEvents', (SELECT count(*) FROM "VotingAuditEvent" WHERE "periodId" = election_id),
    'lastAuditId', (SELECT "id" FROM "VotingAuditEvent" WHERE "periodId" = election_id ORDER BY "createdAt" DESC, "id" DESC LIMIT 1)
  ) INTO summary FROM "ElectionPeriod" p WHERE p."id" = election_id;
  IF summary IS NULL THEN RETURN NULL; END IF;
  RETURN summary || jsonb_build_object('version', md5(summary::text));
END $$;

CREATE FUNCTION evoting_delete_test_period(election_id UUID, actor_id TEXT, confirmation TEXT, expected_version TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE summary JSONB; previous_period TEXT; previous_transaction TEXT;
BEGIN
  -- Same lock order as vote submission: period first, then its dependent records.
  PERFORM 1 FROM "ElectionPeriod" WHERE "id" = election_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'NOT_FOUND'); END IF;
  IF NOT EXISTS (SELECT 1 FROM "Account" a JOIN "AccountRole" r ON r."accountId" = a."id"
      WHERE a."id" = actor_id AND a."active" AND r."role" = 'superadmin')
    OR EXISTS (SELECT 1 FROM "AccountOverride" WHERE "accountId" = actor_id AND "effect" = 'revoke'
      AND "capability" IN ('*', 'evoting.*', 'evoting.lihat', 'evoting.kelola', 'evoting.hapus-uji')) THEN
    RETURN jsonb_build_object('error', 'FORBIDDEN');
  END IF;
  summary := evoting_test_cleanup_preview(election_id);
  IF NOT (summary->>'isTest')::boolean OR summary->>'publishedAt' IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'TEST_CLEANUP_NOT_ALLOWED');
  END IF;
  IF confirmation IS DISTINCT FROM 'HAPUS ' || (summary->>'slug') THEN
    RETURN jsonb_build_object('error', 'CONFIRMATION_MISMATCH');
  END IF;
  IF expected_version IS DISTINCT FROM summary->>'version' THEN
    RETURN jsonb_build_object('error', 'STALE_CLEANUP_PREVIEW');
  END IF;
  INSERT INTO "VotingAuditEvent" ("id", "periodId", "actorAccountId", "event", "targetId", "reasonCode", "detail")
    VALUES (gen_random_uuid(), election_id, actor_id, 'TEST_PERIOD_DELETED', election_id::text, 'TEST_DATA_CLEANUP', summary);
  previous_period := current_setting('smkdh.test_cleanup_period', true);
  previous_transaction := current_setting('smkdh.test_cleanup_transaction', true);
  PERFORM set_config('smkdh.test_cleanup_period', election_id::text, true);
  PERFORM set_config('smkdh.test_cleanup_transaction', txid_current()::text, true);
  DELETE FROM "VotingSession" WHERE "voterId" IN (SELECT "id" FROM "ElectionVoter" WHERE "periodId" = election_id);
  DELETE FROM "Ballot" WHERE "periodId" = election_id;
  DELETE FROM "VoterParticipation" WHERE "periodId" = election_id;
  DELETE FROM "CandidateMember" WHERE "periodId" = election_id;
  DELETE FROM "CandidatePair" WHERE "periodId" = election_id;
  DELETE FROM "ElectionVoter" WHERE "periodId" = election_id;
  DELETE FROM "ElectionContest" WHERE "periodId" = election_id;
  DELETE FROM "ElectionPeriod" WHERE "id" = election_id;
  PERFORM set_config('smkdh.test_cleanup_period', COALESCE(previous_period, ''), true);
  PERFORM set_config('smkdh.test_cleanup_transaction', COALESCE(previous_transaction, ''), true);
  RETURN summary;
END $$;

COMMIT;
