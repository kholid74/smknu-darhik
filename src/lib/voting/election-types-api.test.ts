import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createContext } from 'astro/middleware';
import { PGlite } from '@electric-sql/pglite';
import Ajv2020 from 'ajv/dist/2020.js';

// Real service SQL, middleware and handlers; only the DB transport/environment are replaced.
// Savepoints + immediate deferred checks emulate service commit inside each test's rollback.
// PGlite is one connection: these tests do not prove PostgreSQL interconnection lock behavior.
const pg = new PGlite();
let failAudit = false, failRead = false, transactionTail = Promise.resolve<unknown>(undefined);
const statements: string[] = [];
const options: unknown[] = [];
async function raw(strings: TemplateStringsArray, ...params: unknown[]) {
  const sql = strings.reduce((result, part, i) => result + (i ? '$' + i : '') + part, '');
  statements.push(sql);
  if (failRead || (failAudit && sql.startsWith('INSERT INTO "VotingAuditEvent"'))) throw new Error('Private database details');
  return pg.query(sql, params);
}
const transport = {
  $queryRaw: async (...args: Parameters<typeof raw>) => (await raw(...args)).rows,
  $executeRaw: async (...args: Parameters<typeof raw>) => (await raw(...args)).affectedRows ?? 0,
  $queryRawUnsafe: async (sql: string, ...params: unknown[]) => (await pg.query(sql, params)).rows,
  candidatePair: {
    findFirst: async ({ where }: any) => {
      const [row] = (await pg.query(`SELECT id,organization,"ballotNumber",vision,mission,(SELECT count(*)::integer FROM "Ballot" b WHERE b."candidateId"=c.id) AS ballots FROM "CandidatePair" c WHERE id=$1 AND "periodId"=$2`, [where.id, where.periodId])).rows;
      return row ? { ...row, members: (await pg.query('SELECT * FROM "CandidateMember" WHERE "candidatePairId"=$1', [where.id])).rows, _count: { ballots: row.ballots } } : null;
    },
    count: async ({ where }: any) => (await pg.query('SELECT count(*)::integer AS n FROM "CandidatePair" WHERE "periodId"=$1 AND organization=$2', [where.periodId, where.organization])).rows[0].n,
    delete: async ({ where }: any) => pg.query('DELETE FROM "CandidatePair" WHERE id=$1', [where.id]),
  },
  candidateMember: { deleteMany: async ({ where }: any) => pg.query('DELETE FROM "CandidateMember" WHERE "candidatePairId"=$1', [where.candidatePairId]) },
  votingAuditEvent: { create: async ({ data }: any) => pg.query('INSERT INTO "VotingAuditEvent" (id,"periodId","actorAccountId",event,"targetId",detail) VALUES ($1,$2,$3,$4,$5,$6::jsonb)', [randomUUID(), data.periodId, data.actorAccountId, data.event, data.targetId, JSON.stringify(data.detail)]) },
};
const fixtureDb = {
  ...transport,
  account: { findUnique: async ({ where }: { where: { id: string } }) => {
    const [account] = (await pg.query('SELECT id,active FROM "Account" WHERE id=$1', [where.id])).rows;
    if (!account) return null;
    return { ...account, roles: (await pg.query('SELECT role FROM "AccountRole" WHERE "accountId"=$1', [where.id])).rows,
      overrides: (await pg.query('SELECT capability,effect FROM "AccountOverride" WHERE "accountId"=$1', [where.id])).rows };
  } },
  $transaction: async (callback: (tx: typeof transport) => Promise<unknown>, settings?: unknown) => {
    options.push(settings);
    const result = transactionTail.then(async () => {
      await pg.exec('SAVEPOINT service_transaction');
      try {
        const data = await callback(transport);
        await pg.exec('SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED; RELEASE SAVEPOINT service_transaction');
        return data;
      } catch (error) {
        await pg.exec('ROLLBACK TO SAVEPOINT service_transaction; RELEASE SAVEPOINT service_transaction');
        throw error;
      }
    });
    transactionTail = result.catch(() => {});
    return result;
  },
};
const globals = globalThis as typeof globalThis & { electionTypeFixture?: typeof fixtureDb };
globals.electionTypeFixture = fixtureDb;
register('data:text/javascript,' + encodeURIComponent(`
  const module = source => ({url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true});
  export function resolve(specifier, context, nextResolve) {
    if (specifier === 'astro:middleware') return nextResolve('astro/middleware', context);
    if (specifier.startsWith('.')) {
      const path = new URL(specifier, context.parentURL).pathname;
      if (/\\/lib\\/prisma(?:\\.ts)?$/.test(path)) return module('export const db = globalThis.electionTypeFixture');
      if (/\\/lib\\/env(?:\\.ts)?$/.test(path)) return module("export const env = key => ({PUBLIC_SITE_URL:'http://localhost:4321',R2_PUBLIC_URL:'https://media.school.test/assets'}[key]); export const requireEnv = () => 'synthetic-type-test-secret-'.repeat(3)");
    }
    return nextResolve(specifier, context);
  }
`), import.meta.url);
const { onRequest } = await import('../../middleware');
const { signToken } = await import('../auth');
const { csrfHeader } = await import('./admin-http');
const services = await import('./election-types');
const collection = await import('../../pages/api/admin/e-voting/types/index');
const item = await import('../../pages/api/admin/e-voting/types/[code]');
const membership = await import('../../pages/api/admin/e-voting/[periodId]/contests');
const periods = await import('../../pages/api/admin/e-voting/periods');
const candidates = await import('../../pages/api/admin/e-voting/[periodId]/candidates/[candidateId]');
let token: string, viewer: string;
before(async () => {
  const root = new URL('../../../prisma/migrations/', import.meta.url);
  for (const entry of (await readdir(root, { withFileTypes: true })).filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    await pg.exec(await readFile(new URL(`${entry.name}/migration.sql`, root), 'utf8'));
  }
  token = await signToken('actor', ['superadmin']); viewer = await signToken('viewer', ['superadmin']);
});
after(async () => { await pg.close(); delete globals.electionTypeFixture; });
beforeEach(async () => {
  failAudit = false; failRead = false; statements.length = 0; options.length = 0;
  await pg.exec(`BEGIN; INSERT INTO "Account" (id,email,"passwordHash") VALUES ('actor','actor@example.test','synthetic'),('viewer','viewer@example.test','synthetic');
    INSERT INTO "AccountRole" (id,"accountId",role) VALUES ('actor-role','actor','superadmin'),('viewer-role','viewer','staf');
    INSERT INTO "AccountOverride" (id,"accountId",capability,effect) VALUES ('viewer-grant','viewer','evoting.lihat','grant')`);
});
afterEach(() => pg.exec('ROLLBACK'));
const input = (code = 'CLUB') => ({ code, name: 'Club synthetic', logoUrl: null, candidateMode: 'SINGLE' as const, chairLabel: 'Ketua', viceChairLabel: null, active: true, sortOrder: 10 });
async function request(path: string, method = 'GET', body?: unknown, settings: { token?: string | null; cookie?: string; origin?: string; csrf?: string | null; contentType?: string; rawBody?: string } = {}) {
  const signed = settings.token === undefined ? token : settings.token;
  const headers: Record<string, string> = {};
  if (signed) headers.Cookie = 'smkdh_token=' + signed;
  if (settings.cookie) headers.Cookie = settings.cookie;
  if (method !== 'GET') {
    headers.Origin = settings.origin ?? 'http://localhost:4321';
    headers['Content-Type'] = settings.contentType ?? 'application/json';
    if (settings.csrf !== null) headers['X-CSRF-Token'] = settings.csrf ?? csrfHeader(signed === viewer ? 'viewer' : 'actor', signed ?? '');
  }
  const context = createContext({ request: new Request('http://localhost:4321' + path, { method, headers, ...(method === 'GET' ? {} : { body: settings.rawBody ?? JSON.stringify(body) }) }), params: {} });
  let handler: (context: any) => unknown;
  const base = '/api/admin/e-voting/';
  if (path.startsWith(base + 'types/')) { context.params.code = path.slice((base + 'types/').length).split('?')[0]; handler = item[method as 'PATCH' | 'DELETE'] as any; }
  else if (path.startsWith(base + 'types')) handler = collection[method as 'GET' | 'POST'] as any;
  else if (path.startsWith(base + 'periods')) handler = periods[method as 'GET' | 'POST'] as any;
  else {
    context.params.periodId = path.slice(base.length).split('/')[0];
    if (path.includes('/candidates/')) { context.params.candidateId = path.split('/').at(-1); handler = candidates.DELETE as any; }
    else handler = membership[method as 'GET' | 'PUT'] as any;
  }
  return onRequest(context, () => handler(context) as Promise<Response>);
}
async function data(response: Response, status = 200) {
  assert.equal(response.status, status, await response.clone().text());
  assert.match(response.headers.get('cache-control')!, /no-store/);
  return (await response.json()).data;
}
async function error(response: Response, code: string, status: number) {
  assert.equal(response.status, status, await response.clone().text());
  assert.deepEqual(await response.json(), { error: { code } });
}
async function draft(codes = ['OSIS', 'PRADANA_PUTRA']) {
  return data(await request('/api/admin/e-voting/periods', 'POST', { slug: 'period-' + randomUUID(), name: 'Synthetic', academicYear: '2026/2027', opensAt: new Date(Date.now() + 86400000).toISOString(), closesAt: new Date(Date.now() + 172800000).toISOString(), isTest: true, organizations: codes }), 201);
}
async function voter(periodId: string, teacher = false) {
  const id = randomUUID(), master = randomUUID();
  if (teacher) await pg.query(`INSERT INTO "Teacher" (id,name,position) VALUES ($1,'Synthetic teacher','Guru')`, [master]);
  else await pg.query(`INSERT INTO "Student" (id,nisn,name,"className") VALUES ($1,'9900000001','Synthetic student','X')`, [master]);
  await pg.query(`INSERT INTO "ElectionVoter" (id,"periodId","voterType","studentId","teacherId","loginCode",nisn,name,"className","pinHash","pinFingerprint","pinVersion") VALUES ($1,$2,$3,$4,$5,$6,$7,'Snapshot','X',$8,$9,1)`, [id, periodId, teacher ? 'TEACHER' : 'STUDENT', teacher ? null : master, teacher ? master : null, teacher ? 'GURU-ABCDEF123456' : null, teacher ? null : '9900000001', 'h'.repeat(60), (teacher ? 'a' : 'b').repeat(64)]);
  await pg.query(`INSERT INTO "VoterParticipation" ("voterId","periodId",organization) SELECT $1,"periodId",organization FROM "ElectionContest" WHERE "periodId"=$2`, [id, periodId]);
  return id;
}
async function pair(periodId: string, organization: string) {
  const id = randomUUID(), master = randomUUID();
  await pg.query(`INSERT INTO "Student" (id,nisn,name,"className") VALUES ($1,$2,'Candidate synthetic','X')`, [master, '98' + master.replace(/[^0-9]/g, '').slice(0, 8).padEnd(8, '0')]);
  await pg.query(`INSERT INTO "CandidatePair" (id,"periodId",organization,"ballotNumber",vision,mission) VALUES ($1,$2,$3,1,'Vision','Mission')`, [id, periodId, organization]);
  await pg.query(`INSERT INTO "CandidateMember" ("candidatePairId","periodId",organization,"studentId",position,"nameSnapshot","classSnapshot") VALUES ($1,$2,$3,$4,'CHAIR','Candidate synthetic','X')`, [id, periodId, organization, master]);
  return id;
}
async function auditCount() { return (await pg.query<{ n: number }>('SELECT count(*)::integer AS n FROM "VotingAuditEvent"')).rows[0].n; }

test('CRUD returns contract fields, updates only on matching revision, and delete does not rewrite audit', async () => {
  const created = await data(await request('/api/admin/e-voting/types', 'POST', input()), 201);
  assert.equal(created.revision, 0); assert.equal(created.code, 'CLUB'); assert.equal(await auditCount(), 1);
  const updated = await data(await request('/api/admin/e-voting/types/CLUB', 'PATCH', { expectedRevision: 0, active: false }));
  assert.equal(updated.active, false); assert.equal(updated.revision, 1);
  await data(await request('/api/admin/e-voting/types/CLUB', 'PATCH', { expectedRevision: 1, active: false }));
  assert.equal(await auditCount(), 2);
  await error(await request('/api/admin/e-voting/types/CLUB', 'PATCH', { expectedRevision: 0, active: false }), 'STALE_CONFIG', 409);
  await error(await request('/api/admin/e-voting/types', 'POST', input()), 'DUPLICATE_TYPE', 409);
  assert.equal((await request('/api/admin/e-voting/types/CLUB', 'DELETE', { expectedRevision: 1 })).status, 204);
  await error(await request('/api/admin/e-voting/types/CLUB', 'DELETE', { expectedRevision: 1 }), 'NOT_FOUND', 404);
  assert.equal(await auditCount(), 3);
});
test('master queries preserve pagination, case-insensitive literal search, active filter and CSRF header', async () => {
  const response = await request('/api/admin/e-voting/types?limit=2&active=true'); assert.ok(response.headers.get('x-csrf-token'));
  const first = await data(response); assert.equal(first.data.length, 2); assert.ok(first.nextCursor);
  const next = await data(await request('/api/admin/e-voting/types?limit=2&cursor=' + first.nextCursor));
  assert.ok(next.data.every((row: any) => !first.data.some((old: any) => row.code === old.code)));
  assert.equal((await data(await request('/api/admin/e-voting/types?q=pradana'))).data.length, 2);
  assert.equal((await data(await request('/api/admin/e-voting/types?q=%25'))).data.length, 0);
  await error(await request('/api/admin/e-voting/types?cursor=bogus'), 'INVALID_CURSOR', 400);
  await error(await request('/api/admin/e-voting/types?limit=101'), 'INVALID_INPUT', 400);
});
test('logos require a registered image on a trusted media base and invalid mode merges cannot mutate master', async () => {
  await pg.exec("INSERT INTO \"Media\" (id,url,filename,kind) VALUES ('relative-logo','/api/image/logo.webp','logo.webp','image')");
  await pg.exec(`INSERT INTO "Media" (id,url,filename,kind) VALUES ('logo','https://media.school.test/assets/logo.webp','logo.webp','image'),('file','/api/image/book.pdf','book.pdf','file')`);
  await data(await request('/api/admin/e-voting/types', 'POST', { ...input(), logoUrl: 'https://media.school.test/assets/logo.webp' }), 201);
  for (const logoUrl of ['https://evil.test/logo.webp', '/api/image/not-indexed.webp', '/api/image/book.pdf', 'javascript:alert(1)']) await error(await request('/api/admin/e-voting/types/CLUB', 'PATCH', { expectedRevision: 0, logoUrl }), 'INVALID_LOGO', 400);
  await error(await request('/api/admin/e-voting/types/CLUB', 'PATCH', { expectedRevision: 0, candidateMode: 'OPTIONAL_VICE' }), 'INVALID_INPUT', 400);
  assert.equal(await auditCount(), 1);
  const relative = await data(await request('/api/admin/e-voting/types', 'POST', { ...input('RELATIVE'), logoUrl: '/api/image/logo.webp' }), 201);
  assert.equal(relative.logoUrl, '/api/image/logo.webp');
});
test('create period requires explicit live types, snapshots their metadata, and does not attach later types', async () => {
  const period = await draft(); assert.equal(period.contestsRevision, 0); assert.equal(period.contests.length, 2);
  assert.deepEqual(period.contests.map((c: any) => c.organization), ['OSIS', 'PRADANA_PUTRA']);
  await data(await request('/api/admin/e-voting/types', 'POST', input()), 201);
  const current = await data(await request(`/api/admin/e-voting/${period.id}/contests`)); assert.equal(current.contests.length, 2);
  assert.ok((options.at(-1) as any).isolationLevel === 'RepeatableRead');
  const changed = await data(await request(`/api/admin/e-voting/${period.id}/contests`, 'PUT', { expectedRevision: 0, organizations: ['OSIS', 'CLUB'] }));
  assert.deepEqual(changed.contests.map((c: any) => c.organization), ['OSIS', 'CLUB']);
  assert.equal(changed.contestsRevision, 1);
});
test('master edits/deactivation do not refresh retained snapshots; used master delete and inactive attachment conflict', async () => {
  const period = await draft();
  await data(await request('/api/admin/e-voting/types/OSIS', 'PATCH', { expectedRevision: 0, name: 'Changed master', active: false }));
  const path = `/api/admin/e-voting/${period.id}/contests`;
  const changed = await data(await request(path, 'PUT', { expectedRevision: 0, organizations: ['PRADANA_PUTRA', 'OSIS'] }));
  assert.equal(changed.contests[1].name, 'OSIS');
  await error(await request('/api/admin/e-voting/types/OSIS', 'DELETE', { expectedRevision: 1 }), 'TYPE_IN_USE', 409);
  const raw = { slug: 'inactive', name: 'Test', academicYear: '2026/2027', opensAt: new Date(Date.now() + 86400000).toISOString(), closesAt: new Date(Date.now() + 172800000).toISOString(), organizations: ['OSIS'] };
  await error(await request('/api/admin/e-voting/periods', 'POST', raw), 'TYPE_INACTIVE', 409);
  assert.equal((await pg.query(`SELECT count(*)::integer AS n FROM "ElectionPeriod" WHERE slug='inactive'`)).rows[0].n, 0);
  await error(await request(path, 'PUT', { expectedRevision: 0, organizations: ['PRADANA_PUTRA', 'OSIS'] }), 'STALE_CONFIG', 409);
});
test('replace adds/removes false rights for mixed roster atomically and preserves PIN/identity snapshots', async () => {
  const period = await draft(), path = `/api/admin/e-voting/${period.id}/contests`;
  await voter(period.id); await voter(period.id, true);
  const before = (await pg.query('SELECT to_jsonb(v) AS data FROM "ElectionVoter" v ORDER BY id')).rows;
  const changed = await data(await request(path, 'PUT', { expectedRevision: 0, organizations: ['PRADANA_PUTRA', 'IPNU', 'IPPNU'] }));
  assert.equal(changed.contestsRevision, 1);
  const rights = (await pg.query('SELECT "voterId",count(*)::integer AS n FROM "VoterParticipation" GROUP BY "voterId"')).rows;
  assert.ok(rights.every(r => r.n === 3)); assert.equal(rights.length, 2);
  assert.deepEqual((await pg.query('SELECT to_jsonb(v) AS data FROM "ElectionVoter" v ORDER BY id')).rows, before);
  const count = await auditCount(); await data(await request(path, 'PUT', { expectedRevision: 1, organizations: ['PRADANA_PUTRA', 'IPNU', 'IPPNU'] })); assert.equal(await auditCount(), count);
});
test('candidate/ballot integrity and scheduled state prevent unsafe removal without changing revisions', async () => {
  const period = await draft(), path = `/api/admin/e-voting/${period.id}/contests`;
  const candidate = await pair(period.id, 'OSIS');
  await error(await request(path, 'PUT', { expectedRevision: 0, organizations: ['PRADANA_PUTRA'] }), 'CONTEST_HAS_CANDIDATES', 409);
  await pg.query(`INSERT INTO "Ballot" (id,"periodId",organization,"candidateId") VALUES ($1,$2,'OSIS',$3)`, [randomUUID(), period.id, candidate]);
  await error(await request(path, 'PUT', { expectedRevision: 0, organizations: ['PRADANA_PUTRA', 'OSIS'] }), 'RECONCILIATION_FAILED', 409);
  assert.equal((await data(await request(path))).contestsRevision, 0);
  await pair(period.id, 'PRADANA_PUTRA'); await voter(period.id);
  await pg.query(`UPDATE "ElectionPeriod" SET state='SCHEDULED' WHERE id=$1`, [period.id]);
  await error(await request(path, 'PUT', { expectedRevision: 0, organizations: ['OSIS', 'PRADANA_PUTRA'] }), 'INVALID_STATE', 409);
});
test('last draft candidate can be removed through the authorized API so its type can be detached', async () => {
  const period = await draft(), candidate = await pair(period.id, 'OSIS');
  const old = async (id: string) => {
    const member = (await pg.query('SELECT "studentId" FROM "CandidateMember" WHERE "candidatePairId"=$1', [id])).rows[0];
    return {expected: {ballotNumber: 1, chairStudentId: member.studentId, viceChairStudentId: null, chairPhotoUrl: null, viceChairPhotoUrl: null, vision: 'Vision', mission: 'Mission'}};
  };
  await error(await request(`/api/admin/e-voting/${period.id}/candidates/${candidate}`, 'DELETE', {}), 'INVALID_INPUT', 400);
  const expected = await old(candidate);
  await error(await request(`/api/admin/e-voting/${period.id}/candidates/${candidate}`, 'DELETE', {expected: {...expected.expected, chairPhotoUrl: '/api/image/stale.jpg'}}), 'STALE_CANDIDATE', 409);
  assert.equal((await request(`/api/admin/e-voting/${period.id}/candidates/${candidate}`, 'DELETE', expected)).status, 204);
  const current = await data(await request(`/api/admin/e-voting/${period.id}/contests`, 'PUT', { expectedRevision: 0, organizations: ['PRADANA_PUTRA'] }));
  assert.deepEqual(current.contests.map((c: any) => c.organization), ['PRADANA_PUTRA']);
  const retained = await pair(period.id, 'PRADANA_PUTRA'); await voter(period.id);
  await pg.query("UPDATE \"ElectionPeriod\" SET state='SCHEDULED' WHERE id=$1", [period.id]);
  await error(await request('/api/admin/e-voting/'+period.id+'/candidates/'+retained, 'DELETE', await old(retained)), 'LAST_CANDIDATE', 409);
});
test('audit failure rolls back master creation and membership rights/revision together', async () => {
  failAudit = true; await error(await request('/api/admin/e-voting/types', 'POST', input()), 'TEMPORARILY_UNAVAILABLE', 503); failAudit = false;
  assert.equal((await pg.query(`SELECT count(*)::integer AS n FROM "ElectionType" WHERE code='CLUB'`)).rows[0].n, 0);
  const period = await draft(); await voter(period.id);
  const before = (await pg.query('SELECT to_jsonb(p) AS data FROM "VoterParticipation" p ORDER BY organization')).rows;
  const count = await auditCount(); failAudit = true;
  await error(await request(`/api/admin/e-voting/${period.id}/contests`, 'PUT', { expectedRevision: 0, organizations: ['IPNU'] }), 'TEMPORARILY_UNAVAILABLE', 503); failAudit = false;
  assert.equal((await data(await request(`/api/admin/e-voting/${period.id}/contests`))).contestsRevision, 0);
  assert.deepEqual((await pg.query('SELECT to_jsonb(p) AS data FROM "VoterParticipation" p ORDER BY organization')).rows, before); assert.equal(await auditCount(), count);
});
test('revision is checked after row lock for competing master and membership calls', async () => {
  await services.createElectionType(input(), 'actor');
  const results = await Promise.allSettled([services.updateElectionType('CLUB', { expectedRevision: 0, name: 'First' }, 'actor'), services.updateElectionType('CLUB', { expectedRevision: 0, name: 'Second' }, 'actor')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason.code, 'STALE_CONFIG');
  const period = await draft(['OSIS']);
  const mutations = await Promise.allSettled([services.replacePeriodContests(period.id, ['IPNU'], 0, 'actor'), services.replacePeriodContests(period.id, ['IPPNU'], 0, 'actor')]);
  assert.equal(mutations.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((mutations.find(r => r.status === 'rejected') as PromiseRejectedResult).reason.code, 'STALE_CONFIG');
  assert.ok(statements.some(sql => sql.includes('FROM "ElectionType" WHERE code=') && sql.endsWith('FOR UPDATE')));
  assert.ok(statements.some(sql => sql.includes('FROM "ElectionPeriod" WHERE id=') && sql.endsWith('FOR UPDATE')));
});
test('middleware enforces current permissions/realm and handlers reject CSRF, wrong origin and malformed bodies', async () => {
  await error(await request('/api/admin/e-voting/types', 'GET', undefined, { token: null }), 'UNAUTHORIZED', 401);
  for (const cookie of ['smkdh_vote_dev=synthetic-voting-token', 'smkdh_alumni=synthetic-alumni-token']) {
    await error(await request('/api/admin/e-voting/types', 'GET', undefined, { token: null, cookie }), 'UNAUTHORIZED', 401);
  }
  await data(await request('/api/admin/e-voting/types', 'GET', undefined, { token: viewer }));
  await error(await request('/api/admin/e-voting/types', 'POST', input(), { token: viewer }), 'FORBIDDEN', 403);
  await pg.exec(`INSERT INTO "AccountOverride" (id,"accountId",capability,effect) VALUES ('revoked','actor','evoting.kelola','revoke')`);
  assert.equal((await request('/api/admin/e-voting/types', 'POST', input())).status, 403);
  await pg.exec(`DELETE FROM "AccountOverride" WHERE id='revoked'`);
  await error(await request('/api/admin/e-voting/types', 'POST', input(), { csrf: null }), 'CSRF_REJECTED', 403);
  await error(await request('/api/admin/e-voting/types', 'POST', input(), { origin: 'https://evil.test' }), 'CSRF_REJECTED', 403);
  await error(await request('/api/admin/e-voting/types', 'POST', input(), { csrf: csrfHeader('viewer', viewer) }), 'CSRF_REJECTED', 403);
  await error(await request('/api/admin/e-voting/types', 'POST', input(), { contentType: 'text/plain' }), 'UNSUPPORTED_MEDIA_TYPE', 415);
  await error(await request('/api/admin/e-voting/types', 'POST', input(), { rawBody: '{broken' }), 'INVALID_INPUT', 400);
  await error(await request('/api/admin/e-voting/types', 'POST', input(), { rawBody: 'x'.repeat(17000) }), 'BODY_TOO_LARGE', 413);
  await pg.exec(`UPDATE "Account" SET active=false WHERE id='actor'`);
  assert.equal((await request('/api/admin/e-voting/types')).status, 401);
});
test('invalid/missing resources and storage errors return safe codes without querying or leaking PII', async () => {
  await error(await request('/api/admin/e-voting/types/CLUB', 'PATCH', { expectedRevision: 0, active: false }), 'NOT_FOUND', 404);
  await error(await request(`/api/admin/e-voting/${randomUUID()}/contests`), 'NOT_FOUND', 404);
  await error(await request('/api/admin/e-voting/not-a-uuid/contests'), 'INVALID_INPUT', 400);
  failRead = true; await error(await request('/api/admin/e-voting/types'), 'TEMPORARILY_UNAVAILABLE', 503); failRead = false;
  assert.equal(await auditCount(), 0);
});
test('actual master, creation and membership response payloads conform to the documented JSON schemas', async () => {
  const contract = JSON.parse(await readFile(new URL('../../../docs/e-voting/contracts/e-voting-v2.openapi.json', import.meta.url), 'utf8'));
  const ajv = new Ajv2020({ strict: false, validateFormats: false }); ajv.addSchema(contract, 'contract');
  const check = (schema: string, value: unknown) => {
    const validate = ajv.compile({ $ref: `contract#/components/schemas/${schema}` });
    assert.ok(validate(value), JSON.stringify(validate.errors));
  };
  check('ElectionType', await data(await request('/api/admin/e-voting/types', 'POST', input()), 201));
  const period = await draft(['OSIS', 'CLUB']); check('PeriodConfig', period);
  check('Contests', await data(await request(`/api/admin/e-voting/${period.id}/contests`)));
});
