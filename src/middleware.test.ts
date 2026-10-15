import {test, beforeEach, after} from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {createContext} from 'astro/middleware';

// Load the real middleware/auth/endpoint against a synthetic DB; never load .env or connect to Neon.
let lookup: () => Promise<unknown>;
let studentSearch: () => Promise<unknown>;
let lookups = 0;
const fixtureDb = {
  account: {findUnique: () => { lookups++; return lookup(); }},
  electionPeriod: {findUnique: async () => ({id: '10000000-0000-4000-8000-000000000001'})},
  student: {findMany: () => studentSearch()},
};
const globals = globalThis as typeof globalThis & {middlewareTestDb?: typeof fixtureDb};
globals.middlewareTestDb = fixtureDb;
register('data:text/javascript,' + encodeURIComponent(`
  const dataModule = source => ({url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true});
  export function resolve(specifier, context, nextResolve) {
    if (specifier === 'astro:middleware') return nextResolve('astro/middleware', context);
    if (specifier.startsWith('.') && context.parentURL?.includes('/src/')) {
      const path = new URL(specifier, context.parentURL).pathname;
      if (path.endsWith('/lib/prisma') || path.endsWith('/lib/prisma.ts')) return dataModule('export const db = globalThis.middlewareTestDb');
      if (path.endsWith('/lib/env') || path.endsWith('/lib/env.ts')) return dataModule("export const env = () => undefined; export const requireEnv = () => 'synthetic-test-secret-'.repeat(4)");
    }
    return nextResolve(specifier, context);
  }
`), import.meta.url);
const {onRequest} = await import('./middleware');
const {signToken} = await import('./lib/auth');
const {GET: search} = await import('./pages/api/admin/e-voting/[periodId]/students/search');
after(() => { delete globals.middlewareTestDb; });

const account = (overrides: Array<{capability: string; effect: string}> = []) => ({active: true, roles: [{role: 'superadmin'}], overrides});
beforeEach(() => {lookups = 0; lookup = async () => account(); studentSearch = async () => [];});

async function request(path = '/api/admin/e-voting/10000000-0000-4000-8000-000000000001/students/search?q=synthetic', token?: string) {
  const signed = token ?? await signToken('synthetic-admin', ['superadmin']);
  return createContext({request: new Request('http://localhost:4321' + path, {headers: {Cookie: 'smkdh_token=' + signed}}),
    defaultLocale: 'id', params: {periodId: '10000000-0000-4000-8000-000000000001'}});
}

test('candidate search recovers from one permission DB read failure and still checks current overrides', async () => {
  lookup = async () => {if (lookups === 1) throw Object.assign(new Error(), {clientVersion: '7.9.0'}); return account();};
  const context = await request();
  const response = await onRequest(context, () => search!(context));
  assert.equal(response.status, 200);
  assert.equal(lookups, 2);
  assert.ok(response.headers.get('x-csrf-token'));
  assert.deepEqual(await response.json(), {data: []});
});

test('persistent permission DB failure returns safe no-store JSON 503 without invoking search', async () => {
  const rawError = {clientVersion: '7.9.0', message: 'private query or credentials'};
  lookup = async () => {throw rawError;};
  let called = false;
  const response = await onRequest(await request(), async () => {called = true; return new Response('unsafe');});
  assert.equal(response.status, 503);
  assert.equal(called, false);
  assert.equal(lookups, 2);
  assert.match(response.headers.get('cache-control')!, /no-store/);
  assert.equal(response.headers.get('retry-after'), '1');
  assert.deepEqual(await response.json(), {error: {code: 'TEMPORARILY_UNAVAILABLE'}});
});

test('permission recovery never falls back to token roles or a previously allowed principal', async () => {
  const context = await request();
  lookup = async () => {if (lookups === 1) throw new Error(); return account([{capability: 'evoting.pemilih', effect: 'revoke'}]);};
  let called = false;
  assert.equal((await onRequest(context, async () => {called = true; return new Response('unsafe');})).status, 403);
  assert.equal(called, false);
  lookup = async () => null;
  assert.equal((await onRequest(await request(), async () => new Response('unsafe'))).status, 401);
  assert.equal(lookups, 3);
});

test('admin page lookup failures return a safe service error and invalid sessions never query the DB', async () => {
  lookup = async () => {throw new Error('private connection information');};
  const response = await onRequest(await request('/admin/e-voting'), async () => new Response('unsafe'));
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('private connection information'));
  assert.equal((await onRequest(await request(undefined, 'invalid-token'), async () => new Response('unsafe'))).status, 401);
  assert.equal(lookups, 2);
});

test('candidate student query retries once on a failed read and returns only the endpoint data', async () => {
  let searches = 0;
  const data = [{id: '20000000-0000-4000-8000-000000000001', name: 'Synthetic Student', nisn: '9900000001', className: 'QA'}];
  studentSearch = async () => {if (++searches === 1) throw new Error(); return data;};
  const context = await request();
  const response = await onRequest(context, () => search!(context));
  assert.equal(response.status, 200);
  assert.equal(searches, 2);
  assert.deepEqual(await response.json(), {data});
});

test('persistent candidate student query failure returns safe JSON without retrying the whole request', async () => {
  let searches = 0;
  studentSearch = async () => {searches++; throw {clientVersion: '7.9.0'};};
  const context = await request();
  const response = await onRequest(context, () => search!(context));
  assert.equal(response.status, 503);
  assert.equal(searches, 2);
  assert.equal(lookups, 1);
  assert.equal(response.headers.get('retry-after'), '1');
  assert.deepEqual(await response.json(), {error: {code: 'TEMPORARILY_UNAVAILABLE'}});
});

test('permission retry cannot replay a downstream mutation after its response is lost', async () => {
  let writes = 0;
  const context = await request('/api/admin/e-voting/10000000-0000-4000-8000-000000000001/schedule');
  await assert.rejects(onRequest(context, async () => {writes++; throw new Error('fixture lost response');}), /fixture lost response/);
  assert.equal(writes, 1);
  assert.equal(lookups, 1);
});
