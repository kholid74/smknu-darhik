import test from 'node:test';
import assert from 'node:assert/strict';
import { RosterError, validatePostOpenRosterCorrection, validateRosterSnapshot } from './voter-roster-input';

test('roster correction requires an exact valid expected identity snapshot', () => {
  assert.deepEqual(validateRosterSnapshot({ nisn: '0012345678', name: 'Siti', className: 'X' }), { nisn: '0012345678', name: 'Siti', className: 'X' });
  assert.throws(() => validateRosterSnapshot({ nisn: '0012345678', name: 'Siti', className: 'X', pinHash: 'secret' }), RosterError);
});

test('post-open NISN correction requires a distinct reviewer and both reauthentication passwords', () => {
  const request = { syncFromMaster: true, expectedSnapshot: { nisn: '0012345678', name: 'Siti', className: 'X' },
    adminPassword: 'admin-secret', reviewerAccountId: 'reviewer-1', reviewerPassword: 'reviewer-secret' };
  assert.deepEqual(validatePostOpenRosterCorrection(request), {
    expectedSnapshot: request.expectedSnapshot, adminPassword: 'admin-secret', reviewerAccountId: 'reviewer-1', reviewerPassword: 'reviewer-secret',
  });
  assert.throws(() => validatePostOpenRosterCorrection({ ...request, reviewerPassword: '' }), RosterError);
  assert.throws(() => validatePostOpenRosterCorrection({ ...request, extra: true }), RosterError);
});
