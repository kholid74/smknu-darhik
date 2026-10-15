import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CandidateError, validateCandidateInput, validateExpectedCandidate } from './candidate-input';

const valid = {
  organization: 'OSIS', ballotNumber: 1,
  chair: { studentId: '93f6d4b7-3065-4c9c-8ae0-10353bc52dc4' },
  viceChair: { studentId: '606ca037-363d-4736-9a62-acd43029c891' },
  vision: 'Visi', mission: 'Misi',
};

test('candidate input requires two different Student IDs and accepts only contract fields', () => {
  assert.equal(validateCandidateInput(valid).chair.studentId, valid.chair.studentId);
  assert.throws(() => validateCandidateInput({ ...valid, viceChair: { studentId: valid.chair.studentId } }),
    (error) => error instanceof CandidateError && error.code === 'DUPLICATE_CANDIDATE');
  assert.throws(() => validateCandidateInput({ ...valid, chair: { studentId: 'invalid' } }),
    (error) => error instanceof CandidateError && error.code === 'INVALID_STUDENT');
  assert.throws(() => validateCandidateInput({ ...valid, chairName: 'Free-text name' }),
    (error) => error instanceof CandidateError && error.code === 'INVALID_INPUT');
});

test('candidate pair fields enforce the approved organizations and bounded text', () => {
  assert.throws(() => validateCandidateInput({ ...valid, organization: 'OTHER' }), CandidateError);
  assert.throws(() => validateCandidateInput({ ...valid, ballotNumber: 0 }), CandidateError);
  assert.throws(() => validateCandidateInput({ ...valid, vision: ' ' }), CandidateError);
  assert.throws(() => validateCandidateInput({ ...valid, mission: 'x'.repeat(2001) }), CandidateError);
});

test('candidate edits require the old slate values to reject stale admin forms', () => {
  const expected = {
    ballotNumber: 1, chairStudentId: valid.chair.studentId,
    viceChairStudentId: valid.viceChair.studentId, vision: 'Visi', mission: 'Misi',
  };
  assert.deepEqual(validateExpectedCandidate(expected), expected);
  assert.throws(() => validateExpectedCandidate({ ...expected, viceChairStudentId: valid.chair.studentId }), CandidateError);
  assert.throws(() => validateExpectedCandidate({ ...expected, oldName: 'free text' }), CandidateError);
});
