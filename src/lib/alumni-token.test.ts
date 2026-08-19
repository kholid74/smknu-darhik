import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashToken, tokenState } from './alumni-token';

test('hashToken: deterministik, 64-hex, beda input beda hash', () => {
  const a = hashToken('abc');
  assert.equal(a, hashToken('abc'));
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, hashToken('abd'));
});

test('hashToken: tak menyimpan/membocorkan token mentah', () => {
  const raw = 'super-secret-token';
  assert.ok(!hashToken(raw).includes(raw));
});

const now = new Date('2026-08-19T10:00:00Z');

test('tokenState: missing bila row null', () => {
  assert.equal(tokenState(null, now), 'missing');
});

test('tokenState: valid bila belum used & belum exp', () => {
  const row = { usedAt: null, expiresAt: new Date(now.getTime() + 60_000) };
  assert.equal(tokenState(row, now), 'valid');
});

test('tokenState: used menang atas exp (walau belum kedaluwarsa)', () => {
  const row = { usedAt: new Date(now.getTime() - 1000), expiresAt: new Date(now.getTime() + 60_000) };
  assert.equal(tokenState(row, now), 'used');
});

test('tokenState: expired bila lewat expiresAt & belum used', () => {
  const row = { usedAt: null, expiresAt: new Date(now.getTime() - 1) };
  assert.equal(tokenState(row, now), 'expired');
});

test('tokenState: batas tepat expiresAt == now dianggap expired', () => {
  const row = { usedAt: null, expiresAt: new Date(now.getTime()) };
  assert.equal(tokenState(row, now), 'expired');
});
