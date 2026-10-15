import assert from 'node:assert/strict';
import test from 'node:test';
import { publicResultSnapshot } from './result-snapshot';

const organizations = ['OSIS', 'DEWAN_AMBALAN', 'IPNU', 'IPPNU'];
const candidate = { candidateId: '123e4567-e89b-42d3-a456-426614174000', ballotNumber: 1, vision: 'Visi', mission: 'Misi', votes: 0,
  chair: { name: 'Siswa A', className: 'X RPL', photoUrl: null, studentId: 'private-id' },
  viceChair: { name: 'Siswa B', className: 'X RPL', photoUrl: null } };

test('public result projection allows only aggregate candidate fields', () => {
  const snapshot = publicResultSnapshot({ version: 1, eligibleVoters: 1, notStarted: 1, partial: 0, complete: 0,
    contests: organizations.map((organization) => ({ organization, votesCast: 0, candidates: [{ ...candidate }] })) });
  assert.ok(snapshot);
  assert.equal('studentId' in snapshot.contests[0].candidates[0].chair, false);
  assert.equal(snapshot.contests.length, 4);
});

test('public result projection rejects mismatched participation totals', () => {
  assert.equal(publicResultSnapshot({ version: 1, eligibleVoters: 2, notStarted: 0, partial: 0, complete: 1, contests: [] }), null);
});
