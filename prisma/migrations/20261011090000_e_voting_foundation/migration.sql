CREATE TYPE "ElectionState" AS ENUM ('DRAFT', 'SCHEDULED', 'CLOSED', 'ARCHIVED');
CREATE TYPE "VotingOrganization" AS ENUM ('OSIS', 'DEWAN_AMBALAN', 'IPNU', 'IPPNU');
CREATE TYPE "CandidatePosition" AS ENUM ('CHAIR', 'VICE_CHAIR');
CREATE TYPE "VotingSessionScope" AS ENUM ('ELECTION_VOTING');

CREATE TABLE "Student" (
  "id" UUID NOT NULL,
  "nisn" VARCHAR(10) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "className" VARCHAR(40) NOT NULL,
  CONSTRAINT "Student_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Student_nisn_check" CHECK ("nisn" ~ '^[0-9]{10}$')
);
CREATE UNIQUE INDEX "Student_nisn_key" ON "Student"("nisn");

CREATE TABLE "StudentAuditEvent" (
  "id" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "actorAccountId" TEXT NOT NULL,
  "event" VARCHAR(32) NOT NULL,
  "changedFields" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentAuditEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentAuditEvent_student_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "StudentAuditEvent_actor_fkey" FOREIGN KEY ("actorAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX "StudentAuditEvent_student_created_idx" ON "StudentAuditEvent"("studentId", "createdAt");
CREATE INDEX "StudentAuditEvent_actor_created_idx" ON "StudentAuditEvent"("actorAccountId", "createdAt");

CREATE TABLE "ElectionPeriod" (
  "id" UUID NOT NULL,
  "slug" VARCHAR(64) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "academicYear" VARCHAR(20) NOT NULL,
  "state" "ElectionState" NOT NULL DEFAULT 'DRAFT',
  "opensAt" TIMESTAMPTZ(3) NOT NULL,
  "closesAt" TIMESTAMPTZ(3) NOT NULL,
  "extensionUsedAt" TIMESTAMPTZ(3),
  "closedAt" TIMESTAMPTZ(3),
  "publishedAt" TIMESTAMPTZ(3),
  "resultSnapshot" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ElectionPeriod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ElectionPeriod_schedule_check" CHECK ("opensAt" < "closesAt")
);
CREATE UNIQUE INDEX "ElectionPeriod_slug_key" ON "ElectionPeriod"("slug");
CREATE UNIQUE INDEX "ElectionPeriod_one_scheduled" ON "ElectionPeriod"("state") WHERE "state" = 'SCHEDULED';

CREATE TABLE "ElectionContest" (
  "periodId" UUID NOT NULL,
  "organization" "VotingOrganization" NOT NULL,
  CONSTRAINT "ElectionContest_pkey" PRIMARY KEY ("periodId", "organization"),
  CONSTRAINT "ElectionContest_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "ElectionPeriod"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE "CandidatePair" (
  "id" UUID NOT NULL,
  "periodId" UUID NOT NULL,
  "organization" "VotingOrganization" NOT NULL,
  "ballotNumber" INTEGER NOT NULL,
  "vision" VARCHAR(2000) NOT NULL,
  "mission" VARCHAR(2000) NOT NULL,
  CONSTRAINT "CandidatePair_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CandidatePair_number_check" CHECK ("ballotNumber" > 0),
  CONSTRAINT "CandidatePair_contest_fkey" FOREIGN KEY ("periodId", "organization") REFERENCES "ElectionContest"("periodId", "organization") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "CandidatePair_scope_number_key" ON "CandidatePair"("periodId", "organization", "ballotNumber");
CREATE UNIQUE INDEX "CandidatePair_id_scope_key" ON "CandidatePair"("id", "periodId", "organization");

CREATE TABLE "CandidateMember" (
  "candidatePairId" UUID NOT NULL,
  "periodId" UUID NOT NULL,
  "organization" "VotingOrganization" NOT NULL,
  "studentId" UUID NOT NULL,
  "position" "CandidatePosition" NOT NULL,
  "nameSnapshot" VARCHAR(120) NOT NULL,
  "classSnapshot" VARCHAR(40) NOT NULL,
  "photoUrl" VARCHAR(1024),
  CONSTRAINT "CandidateMember_pkey" PRIMARY KEY ("candidatePairId", "position"),
  CONSTRAINT "CandidateMember_pair_fkey" FOREIGN KEY ("candidatePairId", "periodId", "organization") REFERENCES "CandidatePair"("id", "periodId", "organization") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "CandidateMember_student_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "CandidateMember_period_org_student_key" ON "CandidateMember"("periodId", "organization", "studentId");
CREATE INDEX "CandidateMember_student_period_idx" ON "CandidateMember"("studentId", "periodId");

CREATE TABLE "ElectionVoter" (
  "id" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "periodId" UUID NOT NULL,
  "nisn" VARCHAR(10) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "className" VARCHAR(40) NOT NULL,
  "credentialEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "pinHash" VARCHAR(60),
  "pinFingerprint" CHAR(64),
  "pinVersion" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ElectionVoter_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ElectionVoter_nisn_check" CHECK ("nisn" ~ '^[0-9]{10}$'),
  CONSTRAINT "ElectionVoter_pin_check" CHECK (("pinHash" IS NULL) = ("pinFingerprint" IS NULL)),
  CONSTRAINT "ElectionVoter_pin_version_check" CHECK ("pinVersion" >= 0),
  CONSTRAINT "ElectionVoter_period_fkey" FOREIGN KEY ("periodId") REFERENCES "ElectionPeriod"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "ElectionVoter_student_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "ElectionVoter_period_nisn_key" ON "ElectionVoter"("periodId", "nisn");
CREATE UNIQUE INDEX "ElectionVoter_period_student_key" ON "ElectionVoter"("periodId", "studentId");
CREATE UNIQUE INDEX "ElectionVoter_period_pin_key" ON "ElectionVoter"("periodId", "pinFingerprint");
CREATE UNIQUE INDEX "ElectionVoter_id_period_key" ON "ElectionVoter"("id", "periodId");
CREATE INDEX "ElectionVoter_student_idx" ON "ElectionVoter"("studentId");
CREATE INDEX "ElectionVoter_period_class_idx" ON "ElectionVoter"("periodId", "className");

CREATE TABLE "VoterParticipation" (
  "voterId" UUID NOT NULL,
  "periodId" UUID NOT NULL,
  "organization" "VotingOrganization" NOT NULL,
  "hasVoted" BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT "VoterParticipation_pkey" PRIMARY KEY ("voterId", "organization"),
  CONSTRAINT "VoterParticipation_voter_fkey" FOREIGN KEY ("voterId", "periodId") REFERENCES "ElectionVoter"("id", "periodId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "VoterParticipation_contest_fkey" FOREIGN KEY ("periodId", "organization") REFERENCES "ElectionContest"("periodId", "organization") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX "VoterParticipation_scope_voted_idx" ON "VoterParticipation"("periodId", "organization", "hasVoted");

CREATE TABLE "Ballot" (
  "id" UUID NOT NULL,
  "periodId" UUID NOT NULL,
  "organization" "VotingOrganization" NOT NULL,
  "candidateId" UUID NOT NULL,
  CONSTRAINT "Ballot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Ballot_candidate_scope_fkey" FOREIGN KEY ("candidateId", "periodId", "organization") REFERENCES "CandidatePair"("id", "periodId", "organization") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX "Ballot_tally_idx" ON "Ballot"("periodId", "organization", "candidateId");

CREATE TABLE "VotingSession" (
  "id" UUID NOT NULL,
  "scope" "VotingSessionScope" NOT NULL DEFAULT 'ELECTION_VOTING',
  "voterId" UUID NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMPTZ(3) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "VotingSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VotingSession_voter_fkey" FOREIGN KEY ("voterId") REFERENCES "ElectionVoter"("id") ON DELETE CASCADE ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "VotingSession_voter_key" ON "VotingSession"("voterId");
CREATE UNIQUE INDEX "VotingSession_tokenHash_key" ON "VotingSession"("tokenHash");
CREATE INDEX "VotingSession_expiry_idx" ON "VotingSession"("expiresAt");

CREATE TABLE "VotingRateBucket" (
  "key" CHAR(64) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "VotingRateBucket_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "VotingRateBucket_attempts_check" CHECK ("attempts" >= 0)
);
CREATE INDEX "VotingRateBucket_expiry_idx" ON "VotingRateBucket"("expiresAt");

CREATE TABLE "VotingAuditEvent" (
  "id" UUID NOT NULL,
  "periodId" UUID,
  "actorAccountId" TEXT,
  "event" VARCHAR(64) NOT NULL,
  "targetId" VARCHAR(64),
  "reasonCode" VARCHAR(64),
  "detail" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VotingAuditEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VotingAuditEvent_period_fkey" FOREIGN KEY ("periodId") REFERENCES "ElectionPeriod"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "VotingAuditEvent_actor_fkey" FOREIGN KEY ("actorAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX "VotingAuditEvent_period_created_idx" ON "VotingAuditEvent"("periodId", "createdAt");
CREATE INDEX "VotingAuditEvent_actor_created_idx" ON "VotingAuditEvent"("actorAccountId", "createdAt");

CREATE FUNCTION evoting_validate_candidate_pair_id(pair_id UUID) RETURNS void LANGUAGE plpgsql AS $$
DECLARE chair_count INTEGER; vice_count INTEGER; student_count INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "CandidatePair" WHERE "id" = pair_id) THEN RETURN; END IF;
  SELECT count(*) FILTER (WHERE "position" = 'CHAIR'),
         count(*) FILTER (WHERE "position" = 'VICE_CHAIR'), count(DISTINCT "studentId")
    INTO chair_count, vice_count, student_count
    FROM "CandidateMember" WHERE "candidatePairId" = pair_id;
  IF chair_count <> 1 OR vice_count <> 1 OR student_count <> 2 THEN
    RAISE EXCEPTION 'candidate pair must have one distinct student per position' USING ERRCODE = '23514';
  END IF;
  RETURN;
END $$;
CREATE FUNCTION evoting_validate_candidate_member() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM evoting_validate_candidate_pair_id(COALESCE(NEW."candidatePairId", OLD."candidatePairId"));
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "CandidateMember_complete_pair"
AFTER INSERT OR UPDATE OR DELETE ON "CandidateMember" DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION evoting_validate_candidate_member();
CREATE FUNCTION evoting_validate_candidate_pair_row() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM evoting_validate_candidate_pair_id(COALESCE(NEW."id", OLD."id"));
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "CandidatePair_complete_pair"
AFTER INSERT OR UPDATE ON "CandidatePair" DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION evoting_validate_candidate_pair_row();

CREATE FUNCTION evoting_lock_candidate_before_open() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE election_id UUID; open_at TIMESTAMPTZ; election_state "ElectionState";
BEGIN
  election_id := COALESCE(NEW."periodId", OLD."periodId");
  SELECT "opensAt", "state" INTO open_at, election_state FROM "ElectionPeriod" WHERE "id" = election_id FOR UPDATE;
  IF open_at IS NULL OR election_state NOT IN ('DRAFT', 'SCHEDULED') OR clock_timestamp() >= open_at THEN
    RAISE EXCEPTION 'candidate slate is frozen at election opening' USING ERRCODE = '55000';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER "CandidatePair_frozen_before_open" BEFORE INSERT OR UPDATE OR DELETE ON "CandidatePair"
FOR EACH ROW EXECUTE FUNCTION evoting_lock_candidate_before_open();
CREATE TRIGGER "CandidateMember_frozen_before_open" BEFORE INSERT OR UPDATE OR DELETE ON "CandidateMember"
FOR EACH ROW EXECUTE FUNCTION evoting_lock_candidate_before_open();

CREATE FUNCTION evoting_reject_ballot_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ballots are immutable' USING ERRCODE = '55000';
END $$;
CREATE TRIGGER "Ballot_immutable" BEFORE UPDATE OR DELETE ON "Ballot"
FOR EACH ROW EXECUTE FUNCTION evoting_reject_ballot_change();

CREATE FUNCTION evoting_participation_monotonic() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE open_at TIMESTAMPTZ;
BEGIN
  IF TG_OP = 'DELETE' THEN
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
CREATE TRIGGER "VoterParticipation_monotonic" BEFORE UPDATE OR DELETE ON "VoterParticipation"
FOR EACH ROW EXECUTE FUNCTION evoting_participation_monotonic();

CREATE FUNCTION evoting_audit_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'voting audit is append-only' USING ERRCODE = '55000';
END $$;
CREATE TRIGGER "VotingAuditEvent_append_only" BEFORE UPDATE OR DELETE ON "VotingAuditEvent"
FOR EACH ROW EXECUTE FUNCTION evoting_audit_append_only();
CREATE TRIGGER "StudentAuditEvent_append_only" BEFORE UPDATE OR DELETE ON "StudentAuditEvent"
FOR EACH ROW EXECUTE FUNCTION evoting_audit_append_only();
