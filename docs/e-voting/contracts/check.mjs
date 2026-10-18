// Checks the documentation contract and examples, not application or SQL behavior.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';

const spec = JSON.parse(fs.readFileSync(new URL('./e-voting-v2.openapi.json', import.meta.url), 'utf8'));
assert.equal(spec.openapi, '3.1.0');
const resolveRef = pointer => pointer.slice(2).split('/').reduce((node, key) => node?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], spec);
function walk(node) {
  if (!node || typeof node !== 'object') return;
  if (node.$ref) {
    assert.ok(node.$ref.startsWith('#/'), `External ref: ${node.$ref}`);
    assert.ok(resolveRef(node.$ref), `Unresolved: ${node.$ref}`);
  }
  for (const value of Object.values(node)) walk(value);
}
walk(spec);
const internalResults=spec.paths['/api/admin/e-voting/{periodId}/results'].get;
assert.ok(internalResults['x-required-capabilities'].includes('evoting.hasil'));
assert.ok(internalResults.responses['200'].content['application/json'].schema.properties.data.$ref.endsWith('/ResultSnapshot'));
for(const status of ['401','429','400','413','415'])assert.ok(spec.paths['/api/admin/e-voting/{periodId}/publish'].post.responses[status]);
let operations = 0;
const operationIds = new Set();
for (const [path, methods] of Object.entries(spec.paths)) {
  for (const [method, operation] of Object.entries(methods)) {
    operations++;
    assert.ok(!operationIds.has(operation.operationId));
    operationIds.add(operation.operationId);
    for (const match of path.matchAll(/\{([^}]+)\}/g)) {
      assert.ok(operation.parameters.some(p => p.in === 'path' && p.name === match[1] && p.required));
    }
    if (method !== 'get') {
      for (const name of ['Origin', 'X-CSRF-Token']) assert.ok(operation.parameters.some(p => p.name === name && p.required));
      assert.ok(operation.requestBody?.required);
    }
    if (path.startsWith('/api/admin/')) {
      assert.ok(operation.security.some(s => s.adminSession));
      assert.ok(operation['x-required-capabilities'].includes('evoting.lihat'));
    }
    for (const [status, response] of Object.entries(operation.responses)) {
      assert.equal(response.headers['Cache-Control'].schema.const, 'private, no-store');
      if (status === '204') assert.equal(response.content, undefined);
    }
  }
}
assert.equal(operations, 21);

const ajv = new Ajv2020({ strict: false, allErrors: true });
ajv.addFormat('uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
ajv.addFormat('date-time', value => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)));
ajv.addFormat('uri', value => { try { new URL(value); return true; } catch { return false; } });
ajv.addFormat('uri-reference', value => { try { new URL(value, 'https://school.test'); return true; } catch { return false; } });
ajv.addSchema(spec, 'contract');
const validators = new Map(Object.keys(spec.components.schemas).map(name => [name, ajv.compile({ $ref: `contract#/components/schemas/${name}` })]));
let examples = 0;
function check(name, input, expected = true) {
  examples++;
  const validator = validators.get(name);
  assert.equal(validator(input), expected, `${name}: ${JSON.stringify(validator.errors)}`);
}
const copy = value => structuredClone(value);
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const type = { code: 'PRADANA_PUTRA', name: 'Pradana Putra', logoUrl: null, candidateMode: 'SINGLE', chairLabel: 'Pradana Putra', viceChairLabel: null, active: true, sortOrder: 2 };
check('TypeCreate', type);
check('TypeCreate', { ...type, candidateMode: 'OPTIONAL_VICE', viceChairLabel: 'Wakil Ketua' });
check('TypeCreate', { ...type, viceChairLabel: 'Wakil' }, false);
check('TypeCreate', { ...type, candidateMode: 'OPTIONAL_VICE' }, false);
check('TypeCreate', { ...type, code: 'dewan ambalan' }, false);
check('TypePatch', { expectedRevision: 0, name: 'Nama baru' });
check('TypePatch', { expectedRevision: 0 }, false);
check('TypePatch', { expectedRevision: 0, code: 'NEW' }, false);
check('ContestsInput', { organizations: ['OSIS', 'PRADANA_PUTRA', 'PRADANA_PUTRI', 'IPNU', 'IPPNU'], expectedRevision: 0 });
check('ContestsInput', { organizations: [], expectedRevision: 0 }, false);
check('ContestsInput', { organizations: ['OSIS', 'OSIS'], expectedRevision: 0 }, false);
check('ContestsInput', { organizations: ['OSIS'] }, false);
check('ContestsInput', { organizations: Array.from({ length: 21 }, (_, i) => `TYPE_${i}`), expectedRevision: 0 }, false);
const candidate = { organization: 'OSIS', ballotNumber: 1, chair: { studentId: id(1) }, vision: 'Visi', mission: 'Misi' };
check('CandidateInput', candidate);
check('CandidateInput', { ...candidate, chair: { name: 'Nama bebas', className: 'X' } }, false);
check('CandidateInput', { ...candidate, viceChair: {} }, false);
check('CandidateInput', { ...candidate, chair: { studentId: 'bad-id' } }, false);
check('CloseInput', { adminPassword: 'synthetic-only' });
check('CloseInput', { adminPassword: 'x'.repeat(256) });
check('CloseInput', { adminPassword: 'x'.repeat(257) }, false);
check('CloseInput', { adminPassword: 'synthetic-only', early: true, reason: 'Siswa tidak hadir sesuai berita acara' });
check('CloseInput', { adminPassword: 'synthetic-only', early: true }, false);
check('CloseInput', { adminPassword: 'synthetic-only', early: true, reason: 'singkat' }, false);
check('CloseInput', { adminPassword: 'synthetic-only', early: 'true' }, false);
check('VoteInput', { organization: 'TYPE_6', candidateId: id(1) });
check('VoteInput', { organization: 'TYPE_6', candidateId: id(1), voterId: id(2) }, false);
check('MediaUrl', '/api/image/logo.webp');
check('MediaUrl', 'https://media.school.test/logo.webp');
check('MediaUrl', 'javascript:alert(1)', false);
check('MediaUrl', 'data:image/png;base64,x', false);
const voter = { voterType: 'STUDENT', name: 'Siswa sintetis', nisn: '0000000001', loginCode: null, className: 'X', participation: { OSIS: false } };
check('VoterStatus', voter);
check('VoterStatus', { ...voter, code: null }, false);
const summary = { period: { id: id(1), name: 'Contoh', academicYear: '2026/2027', state: 'DRAFT' }, eligible: 1, notStarted: 1, partial: 0, complete: 0, contests: [{ organization: 'OSIS', name: 'OSIS', logoUrl: null, candidateMode: 'OPTIONAL_VICE', chairLabel: 'Ketua', viceChairLabel: 'Wakil Ketua', sortOrder: 1 }], byOrganization: [{ organization: 'OSIS', eligible: 1, voted: 0, pending: 1 }] };
check('ParticipationSummary', summary);
check('ParticipationSummary', { ...summary, byOrganization: { OSIS: 0 } }, false);

// Arithmetic examples encode the documented close-time aggregate invariants.
function snapshotValid(value) {
  if (!validators.get('ResultSnapshot')(value)) return false;
  const n = value.contests.length;
  if (value.notStarted + value.partial + value.complete !== value.eligibleVoters || (n === 1 && value.partial !== 0)) return false;
  if (new Set(value.contests.map(c => c.organization)).size !== n) return false;
  let total = 0;
  for (const [index, c] of value.contests.entries()) {
    if (c.sortOrder !== index + 1 || c.votesCast < value.complete || c.votesCast > value.complete + value.partial) return false;
    if (new Set(c.candidates.map(p => p.candidateId)).size !== c.candidates.length || new Set(c.candidates.map(p => p.ballotNumber)).size !== c.candidates.length) return false;
    if (c.candidates.reduce((sum, p) => sum + p.votes, 0) !== c.votesCast) return false;
    total += c.votesCast;
  }
  return total >= value.complete * n + value.partial && total <= value.complete * n + value.partial * (n - 1);
}
for (const n of [1, 5, 6]) {
  const snapshot = { version: 2, eligibleVoters: 3, notStarted: 1, partial: n === 1 ? 0 : 1, complete: n === 1 ? 2 : 1, contests: Array.from({ length: n }, (_, i) => ({ organization: `TYPE_${i}`, name: `Jenis ${i}`, logoUrl: null, candidateMode: 'SINGLE', chairLabel: 'Ketua', viceChairLabel: null, sortOrder: i + 1, votesCast: n === 1 || i === 0 ? 2 : 1, candidates: [{ candidateId: id(i + 1), ballotNumber: 1, vision: 'Visi', mission: 'Misi', chair: { name: 'Siswa sintetis', className: 'X', photoUrl: null }, viceChair: null, votes: n === 1 || i === 0 ? 2 : 1 }] })) };
  check('ResultSnapshot', snapshot);
  assert.ok(snapshotValid(snapshot));
  const zero = copy(snapshot);
  Object.assign(zero, { notStarted: 3, partial: 0, complete: 0 });
  zero.contests.forEach(c => { c.votesCast = 0; c.candidates[0].votes = 0; });
  assert.ok(snapshotValid(zero));
  for (const mutate of [s => { s.version = 1; }, s => { s.contests[0].voterId = id(99); }, s => { s.contests[0].votesCast++; }, s => { s.contests[0].sortOrder = 2; }, s => { s.complete = 3; }, s => { s.contests[0].candidates[0].viceChair = s.contests[0].candidates[0].chair; }]) {
    const invalid = copy(snapshot); mutate(invalid); assert.ok(!snapshotValid(invalid)); examples++;
  }
  if (n > 1) {
    const duplicate = copy(snapshot); duplicate.contests[1].organization = duplicate.contests[0].organization;
    assert.ok(!snapshotValid(duplicate)); examples++;
  }
  const status = { phase: 'OPEN', contests: snapshot.contests.map(({ votesCast, candidates, ...meta }) => meta), participation: Object.fromEntries(snapshot.contests.map(c => [c.organization, false])), complete: false, nextOrganization: snapshot.contests[0].organization, idleExpiresAt: '2026-10-20T01:05:00.000Z', absoluteExpiresAt: '2026-10-20T01:15:00.000Z' };
  check('VotingStatus', status);
  const dashboard = { data: { scope: 'ELECTION_VOTING', period: { id: id(99), name: 'Contoh', slug: 'contoh', opensAt: '2026-10-20T01:00:00Z', closesAt: '2026-10-20T02:00:00Z' }, contests: status.contests, participation: status.participation, complete: false, nextOrganization: status.nextOrganization, services: [{ id: 'e-voting', status: 'available', href: '/siswa/e-voting/contoh/pilih' }, { id: 'academic', label: 'Akademik', status: 'coming_soon' }] }, csrfToken: 'synthetic-token' };
  check('DashboardResponse', dashboard);
  const leaked = copy(dashboard); leaked.data.services[1].href = '/nilai'; check('DashboardResponse', leaked, false);
}
console.log(`Contract checks passed: ${operations} operations, ${validators.size} schemas, ${examples} examples; dynamic 1/5/6 and zero-vote snapshots. No application/DB tests executed.`);
