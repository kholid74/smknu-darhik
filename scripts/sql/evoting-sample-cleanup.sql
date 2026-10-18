-- Offline migrator only, in maintenance. No function/grant/bypass is installed.
-- Caller must BEGIN, create/fill both pg_temp tables below, execute this file, then COMMIT.
-- _EvotingCleanupContext(actorAccountId text, reason text, confirmation text)
-- _EvotingCleanupManifest(periodId uuid PRIMARY KEY, slug text, previewVersion text)
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE "ElectionPeriod", "ElectionContest", "CandidatePair", "CandidateMember",
  "ElectionVoter", "VoterParticipation", "Ballot", "VotingSession" IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE target RECORD; context RECORD; preview JSONB;
BEGIN
  IF to_regclass('pg_temp."_EvotingCleanupManifest"') IS NULL OR to_regclass('pg_temp."_EvotingCleanupContext"') IS NULL THEN
    RAISE EXCEPTION 'CLEANUP_MANIFEST_REQUIRED';
  END IF;
  IF (SELECT count(*) FROM pg_temp."_EvotingCleanupContext") <> 1 OR (SELECT count(*) FROM pg_temp."_EvotingCleanupManifest") NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'CLEANUP_INVALID_SCOPE';
  END IF;
  SELECT "actorAccountId", reason, confirmation INTO context FROM pg_temp."_EvotingCleanupContext";
  IF context.confirmation IS DISTINCT FROM 'HAPUS SAMPEL UNTUK JENIS DINAMIS' OR length(btrim(COALESCE(context.reason, ''))) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'CLEANUP_CONFIRMATION_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "Account" a JOIN "AccountRole" r ON r."accountId" = a.id
    WHERE a.id = context."actorAccountId" AND a.active AND r.role = 'superadmin') THEN
    RAISE EXCEPTION 'CLEANUP_ACTOR_REQUIRED';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public'
    AND c.relname IN ('ElectionPeriod', 'ElectionContest', 'CandidatePair', 'CandidateMember', 'ElectionVoter', 'VoterParticipation', 'Ballot')
    AND NOT pg_has_role(current_user, c.relowner, 'USAGE')) THEN
    RAISE EXCEPTION 'CLEANUP_REQUIRES_TABLE_OWNER';
  END IF;
  FOR target IN SELECT "periodId", slug, "previewVersion" FROM pg_temp."_EvotingCleanupManifest" ORDER BY "periodId" LOOP
    preview := evoting_test_cleanup_preview(target."periodId");
    IF preview IS NULL OR preview->>'slug' IS DISTINCT FROM target.slug OR preview->>'version' IS DISTINCT FROM target."previewVersion" THEN
      RAISE EXCEPTION 'CLEANUP_STALE_MANIFEST';
    END IF;
  END LOOP;
END $$;

CREATE TEMP TABLE "_EvotingCleanupTriggers" ON COMMIT DROP AS
SELECT c.relname AS "tableName", t.tgname AS "triggerName", pg_get_triggerdef(t.oid, true) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND (c.relname, t.tgname) IN (
  ('Ballot', 'Ballot_immutable'), ('VoterParticipation', 'VoterParticipation_monotonic'),
  ('CandidateMember', 'CandidateMember_frozen_before_open'), ('CandidatePair', 'CandidatePair_frozen_before_open'),
  ('ElectionVoter', 'ElectionVoter_protect_identity'), ('ElectionPeriod', 'ElectionPeriod_protect_identity'),
  ('ElectionContest', 'ElectionContest_protect_snapshot'));
DO $$
DECLARE item RECORD; expected INTEGER;
BEGIN
  expected := CASE WHEN to_regclass('public."ElectionType"') IS NULL THEN 6 ELSE 7 END;
  IF (SELECT count(*) FROM pg_temp."_EvotingCleanupTriggers") <> expected THEN RAISE EXCEPTION 'CLEANUP_GUARD_INVENTORY_MISMATCH'; END IF;
  FOR item IN SELECT "tableName", "triggerName" FROM pg_temp."_EvotingCleanupTriggers" LOOP
    EXECUTE format('DROP TRIGGER %I ON public.%I', item."triggerName", item."tableName");
  END LOOP;
END $$;

INSERT INTO "VotingAuditEvent" (id, "periodId", "actorAccountId", event, "targetId", "reasonCode", detail)
SELECT gen_random_uuid(), m."periodId", c."actorAccountId", 'MIGRATION_SAMPLE_DELETED', m."periodId"::text,
  'AUTHORIZED_SAMPLE_MIGRATION', jsonb_build_object('reason', c.reason, 'preview', evoting_test_cleanup_preview(m."periodId"))
FROM pg_temp."_EvotingCleanupManifest" m CROSS JOIN pg_temp."_EvotingCleanupContext" c;
DELETE FROM "VotingSession" s USING "ElectionVoter" v, pg_temp."_EvotingCleanupManifest" m WHERE s."voterId" = v.id AND v."periodId" = m."periodId";
DELETE FROM "Ballot" t USING pg_temp."_EvotingCleanupManifest" m WHERE t."periodId" = m."periodId";
DELETE FROM "VoterParticipation" t USING pg_temp."_EvotingCleanupManifest" m WHERE t."periodId" = m."periodId";
DELETE FROM "CandidateMember" t USING pg_temp."_EvotingCleanupManifest" m WHERE t."periodId" = m."periodId";
DELETE FROM "CandidatePair" t USING pg_temp."_EvotingCleanupManifest" m WHERE t."periodId" = m."periodId";
DELETE FROM "ElectionVoter" t USING pg_temp."_EvotingCleanupManifest" m WHERE t."periodId" = m."periodId";
DELETE FROM "ElectionContest" t USING pg_temp."_EvotingCleanupManifest" m WHERE t."periodId" = m."periodId";
DELETE FROM "ElectionPeriod" t USING pg_temp."_EvotingCleanupManifest" m WHERE t.id = m."periodId";
DO $$ DECLARE item RECORD;
BEGIN
  FOR item IN SELECT definition FROM pg_temp."_EvotingCleanupTriggers" LOOP EXECUTE item.definition; END LOOP;
END $$;
