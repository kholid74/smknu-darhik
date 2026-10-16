-- Existing pairs remain valid; no historical members or ballots are changed.
CREATE OR REPLACE FUNCTION evoting_validate_candidate_pair_id(pair_id UUID) RETURNS void LANGUAGE plpgsql AS $$
DECLARE chair_count INTEGER; vice_count INTEGER; student_count INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "CandidatePair" WHERE "id" = pair_id) THEN RETURN; END IF;
  SELECT count(*) FILTER (WHERE "position" = 'CHAIR'),
         count(*) FILTER (WHERE "position" = 'VICE_CHAIR'), count(DISTINCT "studentId")
    INTO chair_count, vice_count, student_count
    FROM "CandidateMember" WHERE "candidatePairId" = pair_id;
  IF chair_count <> 1 OR vice_count > 1 OR student_count <> 1 + vice_count THEN
    RAISE EXCEPTION 'candidate must have one chair and an optional distinct vice chair' USING ERRCODE = '23514';
  END IF;
  RETURN;
END $$;
