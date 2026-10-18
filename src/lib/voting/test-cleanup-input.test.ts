import test from 'node:test';
import assert from 'node:assert/strict';
import {canDeleteTestPeriod, validateTestCleanupInput, assertTestCleanupAllowed, type TestCleanupPreview} from './test-cleanup-input';

test('test cleanup requires superadmin and respects capability revocation', () => {
  assert.equal(canDeleteTestPeriod(null), false);
  assert.equal(canDeleteTestPeriod({roles: ['staf'], grants: ['*']}), false);
  assert.equal(canDeleteTestPeriod({roles: ['superadmin']}), true);
  for (const capability of ['*', 'evoting.*', 'evoting.lihat', 'evoting.kelola', 'evoting.hapus-uji']) {
    assert.equal(canDeleteTestPeriod({roles: ['superadmin'], revokes: [capability]}), false);
  }
});

test('cleanup validates confirmation, preview version, password and rejects extra fields', () => {
  const valid = {confirmation: 'HAPUS periode-uji', previewVersion: 'a'.repeat(32), adminPassword: 'login-password'};
  assert.deepEqual(validateTestCleanupInput(valid), valid);
  for (const input of [null, [], {...valid, confirmation: 'periode-uji'}, {...valid, confirmation: 'HAPUS ../ujian'},
    {...valid, previewVersion: 'tampered'}, {...valid, adminPassword: ''}, {...valid, adminPassword: 'x'.repeat(257)}, {...valid, isTest: true}]) {
    assert.throws(() => validateTestCleanupInput(input));
  }
});

test('testing periods remain eligible after publication and archival; official periods never do', () => {
  const preview = {isTest: true, publishedAt: null} as TestCleanupPreview;
  assert.doesNotThrow(() => assertTestCleanupAllowed(preview));
  assert.throws(() => assertTestCleanupAllowed(null), /NOT_FOUND/);
  assert.throws(() => assertTestCleanupAllowed({...preview, isTest: false}), /TEST_CLEANUP_NOT_ALLOWED/);
  for (const state of ['DRAFT', 'SCHEDULED', 'CLOSED', 'ARCHIVED']) {
    for (const publishedAt of [null, new Date().toISOString()]) {
      assert.doesNotThrow(() => assertTestCleanupAllowed({...preview, state, publishedAt}));
      assert.throws(() => assertTestCleanupAllowed({...preview, state, publishedAt, isTest: false}), /TEST_CLEANUP_NOT_ALLOWED/);
    }
  }
});
