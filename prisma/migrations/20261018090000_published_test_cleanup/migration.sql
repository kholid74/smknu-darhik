BEGIN;

-- Publication and archival do not make an explicitly classified test election official.
-- Preserve the existing transaction-scoped deletion guard and immutable classification.
CREATE OR REPLACE FUNCTION evoting_test_cleanup_allowed(election_id UUID) RETURNS BOOLEAN
LANGUAGE sql VOLATILE AS $$
  SELECT current_setting('smkdh.test_cleanup_period', true) = election_id::text
    AND current_setting('smkdh.test_cleanup_transaction', true) = txid_current()::text
    AND EXISTS (SELECT 1 FROM "ElectionPeriod" WHERE "id" = election_id AND "isTest")
$$;

CREATE OR REPLACE FUNCTION evoting_delete_test_period(election_id UUID, actor_id TEXT, confirmation TEXT, expected_version TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE summary JSONB; previous_period TEXT; previous_transaction TEXT;
BEGIN
  PERFORM 1 FROM "ElectionPeriod" WHERE "id" = election_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'NOT_FOUND'); END IF;
  IF NOT EXISTS (SELECT 1 FROM "Account" a JOIN "AccountRole" r ON r."accountId" = a."id"
      WHERE a."id" = actor_id AND a."active" AND r."role" = 'superadmin')
    OR EXISTS (SELECT 1 FROM "AccountOverride" WHERE "accountId" = actor_id AND "effect" = 'revoke'
      AND "capability" IN ('*', 'evoting.*', 'evoting.lihat', 'evoting.kelola', 'evoting.hapus-uji')) THEN
    RETURN jsonb_build_object('error', 'FORBIDDEN');
  END IF;
  summary := evoting_test_cleanup_preview(election_id);
  IF (summary->>'isTest')::boolean IS DISTINCT FROM TRUE THEN
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
