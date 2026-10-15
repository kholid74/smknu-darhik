import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateVoteInput, VoteInputError } from './vote-input';

test('vote input accepts only a known organization and candidate UUID', () => {
  const valid = { organization: 'OSIS', candidateId: '00000000-0000-4000-8000-000000000001' };
  assert.deepEqual(validateVoteInput(valid), valid);
  for (const input of [
    { ...valid, voterId: '00000000-0000-4000-8000-000000000002' },
    { ...valid, organization: 'UNKNOWN' },
    { ...valid, candidateId: 'not-a-uuid' },
    { organization: 'OSIS', candidateId: valid.candidateId, periodId: 'other-period' },
  ]) assert.throws(() => validateVoteInput(input), VoteInputError);
});
