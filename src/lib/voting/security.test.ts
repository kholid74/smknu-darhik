import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCsrfToken, createPreauthCsrfToken, createStudentSessionCsrfToken, isSameOrigin, verifyCsrfToken, verifyPreauthCsrfToken, verifyStudentSessionCsrfToken } from './security';

test('CSRF token is scoped to account and expires after five minutes', () => {
  const now = Date.UTC(2026, 9, 11, 10);
  const token = createCsrfToken('secret', 'account-a', 'session-a', now);
  assert.equal(verifyCsrfToken('secret', 'account-a', 'session-a', token, now + 299_000), true);
  assert.equal(verifyCsrfToken('secret', 'account-b', 'session-a', token, now), false);
  assert.equal(verifyCsrfToken('secret', 'account-a', 'session-b', token, now), false);
  assert.equal(verifyCsrfToken('other-secret', 'account-a', 'session-a', token, now), false);
  assert.equal(verifyCsrfToken('secret', 'account-a', 'session-a', token, now + 301_000), false);
  assert.equal(verifyCsrfToken('secret', 'account-a', 'session-a', `${token}.extra`, now), false);
});

test('student pre-auth CSRF token binds nonce and expires', () => {
  const now = Date.UTC(2026, 9, 11, 10);
  const token = createPreauthCsrfToken('secret', 'nonce-a', now);
  assert.equal(verifyPreauthCsrfToken('secret', 'nonce-a', token, now), true);
  assert.equal(verifyPreauthCsrfToken('secret', 'nonce-b', token, now), false);
  assert.equal(verifyPreauthCsrfToken('secret', 'nonce-a', token, now + 301_000), false);
});

test('student session CSRF token binds session and stays within the absolute session window', () => {
  const now = Date.UTC(2026, 9, 11, 10);
  const token = createStudentSessionCsrfToken('secret', 'session-a', now);
  assert.equal(verifyStudentSessionCsrfToken('secret', 'session-a', token, now + 899_000), true);
  assert.equal(verifyStudentSessionCsrfToken('secret', 'session-b', token, now), false);
  assert.equal(verifyStudentSessionCsrfToken('secret', 'session-a', token, now + 901_000), false);
});

test('admin mutation origin must match request origin', () => {
  assert.equal(isSameOrigin(new Request('https://school.test/api', { headers: { origin: 'https://school.test' } })), true);
  assert.equal(isSameOrigin(new Request('https://school.test/api', { headers: { origin: 'https://evil.test' } })), false);
  assert.equal(isSameOrigin(new Request('https://school.test/api')), false);
  assert.equal(isSameOrigin(new Request('https://school.test/api', { headers: { referer: 'https://school.test/admin' } })), true);
  assert.equal(isSameOrigin(new Request('https://school.test/api', { headers: { origin: 'https://school.test', 'sec-fetch-site': 'cross-site' } })), false);
});
