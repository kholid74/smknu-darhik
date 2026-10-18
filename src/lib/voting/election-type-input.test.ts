import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePeriodInput } from './period-input';
import { validateTypeInput, validateTypePatch, validateRevision, validateContestInput, validateOrganizations, validateTypeQuery, encodeTypeCursor, isSchoolMediaUrl } from './election-type-input';

const input = { code: 'PRADANA_PUTRA', name: ' Pradana Putra ', logoUrl: null, candidateMode: 'SINGLE', chairLabel: ' Pradana ', viceChairLabel: null, active: true, sortOrder: 1 };
test('type fields are bounded, explicit and mode-aware with immutable code on patches', () => {
  assert.equal(validateTypeInput(input).name, 'Pradana Putra');
  assert.equal(validateTypeInput({ ...input, candidateMode: 'OPTIONAL_VICE', viceChairLabel: 'Wakil' }).viceChairLabel, 'Wakil');
  for (const value of [null, [], {}, { ...input, code: 'lower' }, { ...input, code: 'A' }, { ...input, code: 'X'.repeat(33) },
    { ...input, name: ' ' }, { ...input, name: 'x'.repeat(121) }, { ...input, logoUrl: '' }, { ...input, logoUrl: 'x'.repeat(1025) },
    { ...input, chairLabel: 'x'.repeat(81) }, { ...input, candidateMode: 'PAIR' }, { ...input, viceChairLabel: 'Wakil' },
    { ...input, candidateMode: 'OPTIONAL_VICE' }, { ...input, active: 'true' }, { ...input, sortOrder: -1 },
    { ...input, sortOrder: 10000 }, { ...input, sortOrder: 1.5 }, { ...input, revision: 0 }]) assert.throws(() => validateTypeInput(value));
  assert.deepEqual(validateTypePatch({ expectedRevision: 0, active: false }), { expectedRevision: 0, active: false });
  for (const value of [{}, { active: true }, { expectedRevision: 0 }, { expectedRevision: 0, code: 'NEW' }, { expectedRevision: -1, active: true }, { expectedRevision: 0, active: 1 }]) assert.throws(() => validateTypePatch(value));
});
test('membership and delete require optimistic revisions and explicit ordered unique codes', () => {
  assert.deepEqual(validateContestInput({ organizations: ['PRADANA_PUTRI', 'OSIS'], expectedRevision: 2 }), { organizations: ['PRADANA_PUTRI', 'OSIS'], expectedRevision: 2 });
  assert.equal(validateRevision({ expectedRevision: 0 }), 0);
  for (const value of [undefined, [], ['OSIS', 'OSIS'], ['bad'], Array.from({ length: 21 }, (_, i) => `TYPE_${i}`)]) assert.throws(() => validateOrganizations(value));
  for (const value of [{}, { expectedRevision: '0' }, { expectedRevision: 0, code: 'OSIS' }]) assert.throws(() => validateRevision(value));
  assert.throws(() => validateContestInput({ organizations: ['OSIS'] }));
  const period = { slug: 'example', name: 'Example', academicYear: '2026/2027', opensAt: '2035-01-01T00:00:00Z', closesAt: '2035-01-01T01:00:00Z' };
  assert.throws(() => validatePeriodInput(period));
  assert.deepEqual(validatePeriodInput({ ...period, organizations: ['NEW_TYPE'] }).organizations, ['NEW_TYPE']);
});
test('cursor pagination accepts only canonical bounded tuples and unambiguous filters', () => {
  const cursor = encodeTypeCursor({ sortOrder: 5, code: 'OSIS' });
  assert.deepEqual(validateTypeQuery(new URLSearchParams({ q: '  Osis ', active: 'false', limit: '100', cursor })), { q: 'Osis', active: false, limit: 100, cursor: { sortOrder: 5, code: 'OSIS' } });
  assert.equal(validateTypeQuery(new URLSearchParams()).limit, 20);
  for (const query of ['limit=0', 'limit=101', 'limit=1.2', 'limit=1e2', 'active=1', 'active=true&active=false', 'limit=1&limit=2', 'sort=code', 'cursor=', 'cursor=abc', 'q=' + 'x'.repeat(121)]) assert.throws(() => validateTypeQuery(new URLSearchParams(query)));
  assert.throws(() => validateTypeQuery(new URLSearchParams({ cursor: cursor + '=' })));
});
test('media allowlist requires own image path or exact configured base, not arbitrary URL schemes or prefix lookalikes', () => {
  const origin = 'https://school.test', media = 'https://media.school.test/assets';
  for (const url of ['/api/image/logo.webp', 'https://school.test/api/image/logo.webp', 'https://media.school.test/assets/logo.webp']) assert.ok(isSchoolMediaUrl(url, origin, media), url);
  for (const url of ['https://evil.test/logo.webp', '//evil.test/logo.webp', 'javascript:alert(1)', 'data:image/png;base64,x', '/api/image/', '/api/image/../admin', 'https://school.test.evil.test/api/image/logo.webp', 'https://user:pass@media.school.test/assets/logo.webp', 'https://media.school.test/assetsevil/logo.webp']) assert.equal(isSchoolMediaUrl(url, origin, media), false, url);
  assert.equal(isSchoolMediaUrl('https://relative.school.invalid/api/image/logo.webp', undefined, '/api/image'), false);
});
