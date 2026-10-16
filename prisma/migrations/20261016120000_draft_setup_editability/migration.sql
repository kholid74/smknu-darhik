BEGIN;
-- A draft has never opened; only a scheduled period freezes at opensAt.
CREATE OR REPLACE FUNCTION evoting_lock_candidate_before_open() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE election_id UUID; open_at TIMESTAMPTZ; election_state "ElectionState";
BEGIN
  election_id := COALESCE(NEW."periodId", OLD."periodId");
  IF TG_OP = 'DELETE' AND COALESCE(evoting_test_cleanup_allowed(election_id), FALSE) THEN RETURN OLD; END IF;
  SELECT "opensAt", "state" INTO open_at, election_state FROM "ElectionPeriod" WHERE "id" = election_id FOR UPDATE;
  IF election_state IS NULL OR NOT (election_state = 'DRAFT' OR (election_state = 'SCHEDULED' AND clock_timestamp() < open_at)) THEN
    RAISE EXCEPTION 'candidate slate is frozen at election opening' USING ERRCODE = '55000';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE OR REPLACE FUNCTION evoting_protect_voter_identity() RETURNS trigger LANGUAGE plpgsql AS $$
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
  IF TG_OP = 'DELETE' AND COALESCE(evoting_test_cleanup_allowed(election_id), FALSE) THEN RETURN OLD; END IF;
  SELECT "state","opensAt" INTO election_state,open_at FROM "ElectionPeriod" WHERE id=election_id FOR SHARE;
  IF election_state IS NULL OR NOT (election_state = 'DRAFT' OR (election_state = 'SCHEDULED' AND clock_timestamp() < open_at)) THEN
    RAISE EXCEPTION 'voter membership is frozen' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION evoting_participation_monotonic() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE open_at TIMESTAMPTZ; election_state "ElectionState";
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF COALESCE(evoting_test_cleanup_allowed(OLD."periodId"), FALSE) THEN RETURN OLD; END IF;
    SELECT "opensAt","state" INTO open_at,election_state FROM "ElectionPeriod" WHERE "id" = OLD."periodId" FOR UPDATE;
    IF OLD."hasVoted" OR election_state IS NULL OR NOT (election_state = 'DRAFT' OR (election_state = 'SCHEDULED' AND clock_timestamp() < open_at)) THEN
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
COMMIT;
