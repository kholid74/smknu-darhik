import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isActiveVotingSession, isStudentSessionCookie, nextStudentSessionExpiry, studentRouteAccess } from './student-session';

const now = new Date('2026-10-11T10:00:00Z');
const valid = {
  scope: 'ELECTION_VOTING', createdAt: new Date(now.getTime() - 60_000), expiresAt: new Date(now.getTime() + 60_000),
  credentialEnabled: true, periodState: 'SCHEDULED', opensAt: new Date(now.getTime() - 60_000),
  closesAt: new Date(now.getTime() + 60_000), completed: false,
};

test('student session guard limits access to election routes', () => {
  assert.equal(studentRouteAccess('/siswa'), 'protected');
  assert.equal(studentRouteAccess('/siswa/e-voting/2026/pilih/OSIS'), 'protected');
  assert.equal(studentRouteAccess('/siswa/masuk'), 'public');
  assert.equal(studentRouteAccess('/api/e-voting/00000000-0000-4000-8000-000000000000/session'), 'public');
  assert.equal(studentRouteAccess('/api/e-voting/00000000-0000-4000-8000-000000000000/votes'), 'protected');
  assert.equal(studentRouteAccess('/siswa/nilai'), 'forbidden');
  assert.equal(studentRouteAccess('/api/siswa/profile'), 'forbidden');
  assert.equal(studentRouteAccess('/admin'), 'unrelated');
});

test('student session guard checks scope, credentials, completion, expiry and election window', () => {
  assert.equal(isActiveVotingSession(valid, now), true);
  assert.equal(isActiveVotingSession({ ...valid, scope: 'PORTAL' }, now), false);
  assert.equal(isActiveVotingSession({ ...valid, credentialEnabled: false }, now), false);
  assert.equal(isActiveVotingSession({ ...valid, completed: true }, now), false);
  assert.equal(isActiveVotingSession({ ...valid, expiresAt: now }, now), false);
  assert.equal(isActiveVotingSession({ ...valid, createdAt: new Date(now.getTime() - 15 * 60_000) }, now), false);
  assert.equal(isActiveVotingSession({ ...valid, closesAt: now }, now), false);
  assert.equal(isActiveVotingSession({ ...valid, periodState: 'CLOSED' }, now), false);
});

test('session cookie accepts only the 32-byte base64url token shape', () => {
  assert.equal(isStudentSessionCookie('A'.repeat(43)), true);
  assert.equal(isStudentSessionCookie('A'.repeat(42)), false);
  assert.equal(isStudentSessionCookie(undefined), false);
});

test('session activity extends idle expiry without crossing absolute or election deadlines', () => {
  const created = new Date(now.getTime() - 14 * 60_000);
  const expiry = nextStudentSessionExpiry(created, now, new Date(now.getTime() + 60 * 60_000));
  assert.equal(expiry.idleExpiresAt.getTime(), created.getTime() + 15 * 60_000);
  assert.equal(expiry.absoluteExpiresAt.getTime(), created.getTime() + 15 * 60_000);
  const electionExpiry = nextStudentSessionExpiry(now, now, new Date(now.getTime() + 2 * 60_000));
  assert.equal(electionExpiry.idleExpiresAt.getTime(), now.getTime() + 2 * 60_000);
});
