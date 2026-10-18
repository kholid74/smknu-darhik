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

test('candidate pair fields accept dynamic codes and enforce bounded text', () => {
  assert.equal(validateCandidateInput({ ...valid, organization: 'NEW_TYPE' }).organization,'NEW_TYPE');
  assert.throws(() => validateCandidateInput({ ...valid, organization: 'invalid-code' }), CandidateError);
  assert.throws(() => validateCandidateInput({ ...valid, ballotNumber: 0 }), CandidateError);
  assert.throws(() => validateCandidateInput({ ...valid, vision: ' ' }), CandidateError);
  assert.throws(() => validateCandidateInput({ ...valid, mission: 'x'.repeat(2001) }), CandidateError);
});

test('candidate edits require the old slate values to reject stale admin forms', () => {
  const expected = {
    ballotNumber: 1, chairStudentId: valid.chair.studentId,
    viceChairStudentId: valid.viceChair.studentId, chairPhotoUrl: null, viceChairPhotoUrl: null, vision: 'Visi', mission: 'Misi',
  };
  assert.deepEqual(validateExpectedCandidate(expected), expected);
  assert.throws(() => validateExpectedCandidate({ ...expected, viceChairStudentId: valid.chair.studentId }), CandidateError);
  assert.throws(() => validateExpectedCandidate({ ...expected, oldName: 'free text' }), CandidateError);
});

test('chair remains required, vice chair may be omitted or null but never malformed', () => {
  const {viceChair, ...chairOnly} = valid;
  assert.equal(validateCandidateInput(chairOnly).viceChair, null);
  assert.equal(validateCandidateInput({...valid, viceChair: null}).viceChair, null);
  for (const value of [{}, {studentId: ''}, {studentId: 'invalid'}, 'free text']) {
    assert.throws(() => validateCandidateInput({...valid, viceChair: value}), CandidateError);
  }
  assert.throws(() => validateCandidateInput({...valid, chair: null}), CandidateError);
  const expected = {ballotNumber: 1, chairStudentId: valid.chair.studentId, viceChairStudentId: null, chairPhotoUrl: null, viceChairPhotoUrl: null, vision: 'Visi', mission: 'Misi'};
  assert.deepEqual(validateExpectedCandidate(expected), expected);
  assert.throws(() => validateExpectedCandidate({...expected, viceChairStudentId: undefined}), CandidateError);
});

test('photo removal is nullable, old photo values are required and UUID case cannot bypass duplicate checks', () => {
  assert.equal(validateCandidateInput({...valid, chair: {...valid.chair, photoUrl: null}}).chair.photoUrl, null);
  for (const photoUrl of ['', ' ', 123, 'x'.repeat(1025)]) assert.throws(() => validateCandidateInput({...valid, chair: {...valid.chair, photoUrl}}), CandidateError);
  assert.throws(() => validateCandidateInput({...valid, viceChair: {studentId: valid.chair.studentId.toUpperCase()}}), {code: 'DUPLICATE_CANDIDATE'});
  assert.throws(() => validateCandidateInput({...valid, ballotNumber: 2147483648}), CandidateError);
  const old = {ballotNumber: 1, chairStudentId: valid.chair.studentId, viceChairStudentId: null, chairPhotoUrl: null, viceChairPhotoUrl: null, vision: 'Visi', mission: 'Misi'};
  for (const expected of [{...old, chairPhotoUrl: undefined}, {...old, viceChairPhotoUrl: '/api/image/old.jpg'}, {...old, extra: true}]) assert.throws(() => validateExpectedCandidate(expected), CandidateError);
});
