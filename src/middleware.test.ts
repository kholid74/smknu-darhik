import {test, beforeEach, after} from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {createContext} from 'astro/middleware';

// Load the real middleware/auth/endpoint against a synthetic DB; never load .env or connect to Neon.
let lookup: () => Promise<unknown>;
let studentSearch: () => Promise<unknown>;
let lookups = 0;
let candidateTransaction: unknown;
let votingSessionLookup: () => Promise<unknown> = async () => null;
let rawQuery: (...args: unknown[]) => Promise<unknown> = async () => [{now: new Date()}];
const fixtureDb: any = {
  account: {findUnique: () => { lookups++; return lookup(); }},
  electionPeriod: {findUnique: async () => ({id: '10000000-0000-4000-8000-000000000001'})},
  student: {findMany: () => studentSearch()},
  votingSession: {findUnique: () => votingSessionLookup()},
  $queryRaw: (...args: unknown[]) => rawQuery(...args),
  $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(candidateTransaction),
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
const {saveCandidatePair} = await import('./lib/voting/candidates');
const {validateCandidateInput} = await import('./lib/voting/candidate-input');
after(() => { delete globals.middlewareTestDb; });

const account = (overrides: Array<{capability: string; effect: string}> = []) => ({active: true, roles: [{role: 'superadmin'}], overrides});
beforeEach(() => {lookups = 0; lookup = async () => account(); studentSearch = async () => []; votingSessionLookup = async () => null; rawQuery = async () => [{now: new Date()}];});

async function request(path = '/api/admin/e-voting/10000000-0000-4000-8000-000000000001/students/search?q=synthetic', token?: string) {
  const signed = token ?? await signToken('synthetic-admin', ['superadmin']);
  return createContext({request: new Request('http://localhost:4321' + path, {headers: {Cookie: 'smkdh_token=' + signed}}),
    defaultLocale: 'id', params: {periodId: '10000000-0000-4000-8000-000000000001'}});
}

test('real middleware caches only anonymous CMS HTML, bypasses preview and preserves timing headers', async () => {
  for (const path of ['/guru', '/guru?preview=1']) {
    const context = createContext({request: new Request('http://localhost:4321' + path), params: {}});
    const response = await onRequest(context, async () => new Response('Public page', {headers: {'Content-Type': 'text/html', 'Server-Timing': 'query;dur=1'}}));
    assert.equal(response.headers.get('Vercel-CDN-Cache-Control'), path.includes('?') ? 'no-store' : 'public, s-maxage=60, must-revalidate');
    assert.match(response.headers.get('Server-Timing')!, /query;dur=1/);
    assert.match(response.headers.get('Server-Timing')!, /app;dur=[\d.]+/);
    assert.equal(await response.text(), 'Public page');
  }
  assert.equal(lookups, 0);
});

test('pending Astro cookies disable CMS cache before Set-Cookie is serialized', async () => {
  const context = createContext({request: new Request('http://localhost:4321/guru'), params: {}});
  const response = await onRequest(context, async () => {
    context.cookies.set('synthetic', 'test', {path: '/', httpOnly: true});
    return new Response('Public page', {headers: {'Content-Type': 'text/html'}});
  });
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(response.headers.get('Vercel-CDN-Cache-Control'), 'no-store');
  assert.equal([...context.cookies.headers()].length, 1);
});

test('early authorization redirects remain private for admin, student, teacher and alumni portals', async () => {
  for (const path of ['/admin', '/siswa', '/pemilih', '/alumni/portal']) {
    const context = createContext({request: new Request('http://localhost:4321' + path), params: {}});
    let called = false;
    const response = await onRequest(context, async () => {called = true; return new Response('private');});
    assert.equal(called, false);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(response.headers.get('Vercel-CDN-Cache-Control'), 'no-store');
    assert.ok(response.headers.get('Location')?.endsWith('/masuk') || response.headers.get('Location')?.endsWith('/login'));
  }
});

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

test('candidate CRUD creates and edits chair-only entries using master snapshots and nullable stale guards', async () => {
  const chairId='20000000-0000-4000-8000-000000000001',viceId='20000000-0000-4000-8000-000000000002';
  let members: Array<{position: string; studentId: string; nameSnapshot?: string}> = [];
  const audits: unknown[]=[];
  candidateTransaction={
    $queryRawUnsafe: async (sql: string)=>sql.includes('clock_timestamp')?[{now:new Date(100)}]:[{state:'DRAFT',opensAt:new Date(200)}],
    student:{findMany:async ({where}: {where:{id:{in:string[]}}})=>where.id.in.map(id=>({id,name:id===chairId?'Master Chair':'Master Vice',className:'QA'}))},
    media:{findFirst:async()=>null},
    electionContest:{findUnique:async()=>({periodId:'fixture-period'})},
    candidatePair:{create:async()=>({id:'fixture-candidate'}),findFirst:async()=>({id:'fixture-candidate',ballotNumber:1,vision:'Vision',mission:'Mission',members}),update:async()=>({})},
    candidateMember:{deleteMany:async()=>{members=[];},createMany:async ({data}: {data:typeof members})=>{members=data;}},
    votingAuditEvent:{create:async (data: unknown)=>{audits.push(data);}},
  };
  const input=validateCandidateInput({organization:'OSIS',ballotNumber:1,chair:{studentId:chairId},vision:'Vision',mission:'Mission'});
  await saveCandidatePair('fixture-period',input,'fixture-admin');
  assert.equal(members.length,1);
  assert.equal(members[0].nameSnapshot,'Master Chair');
  const expected={ballotNumber:1,chairStudentId:chairId,viceChairStudentId:null,vision:'Vision',mission:'Mission'};
  await saveCandidatePair('fixture-period',{...input,viceChair:{studentId:viceId}},'fixture-admin','fixture-candidate',expected);
  assert.equal(members.length,2);
  await assert.rejects(saveCandidatePair('fixture-period',input,'fixture-admin','fixture-candidate',expected),{code:'STALE_CANDIDATE'});
  await saveCandidatePair('fixture-period',input,'fixture-admin','fixture-candidate',{...expected,viceChairStudentId:viceId});
  assert.equal(members.length,1);
  assert.equal(audits.length,3);
});

test('teacher voting session only enters its own portal and shared vote API; it cannot authorize admin', async()=>{
  const {VOTING_SESSION_COOKIE}=await import('./lib/voting/student-session');
  const now=new Date();
  let type='TEACHER';
  votingSessionLookup=async()=>({id:'session',scope:'ELECTION_VOTING',voterId:'voter',createdAt:now,lastSeenAt:now,expiresAt:new Date(+now+60000),
    voter:{voterType:type,periodId:'10000000-0000-4000-8000-000000000001',credentialEnabled:true,participation:[],period:{slug:'test',state:'SCHEDULED',opensAt:new Date(+now-60000),closesAt:new Date(+now+600000)}}});
  const visit=async(path:string)=>{
    const context=createContext({request:new Request('http://localhost:4321'+path,{headers:{Cookie:VOTING_SESSION_COOKIE+'='+'A'.repeat(43)}})});
    return onRequest(context,async()=>new Response(context.locals.votingSession?.voterType??'next'));
  };
  assert.equal(await (await visit('/pemilih')).text(),'TEACHER');
  assert.equal((await visit('/api/pemilih/dashboard')).status,200);
  assert.equal((await visit('/api/e-voting/10000000-0000-4000-8000-000000000001/status')).status,200);
  assert.equal((await visit('/siswa')).status,403);
  assert.equal((await visit('/api/siswa/dashboard')).status,403);
  assert.equal((await visit('/pemilih/e-voting/wrong/pilih')).status,403);
  assert.equal((await visit('/pemilih/nilai')).status,403);
  assert.equal((await visit('/api/admin/e-voting/10000000-0000-4000-8000-000000000001/voters')).status,401);
  assert.equal((await visit('/admin')).headers.get('location'),'/admin/login');
  type='STUDENT';assert.equal((await visit('/pemilih')).status,403);
  assert.equal(await (await visit('/siswa')).text(),'STUDENT');
  votingSessionLookup=async()=>null;
  assert.equal((await visit('/pemilih')).headers.get('location'),'/pemilih/masuk');
  assert.equal((await visit('/api/pemilih/dashboard')).status,401);
});

test('teacher roster creates four rights from master, is repeatable and checks combined capacity and invalid IDs',async()=>{
  const {syncTeacherRoster}=await import('./lib/voting/voters');
  let state='DRAFT',existing:any[]=[],rights:any[]=[],audits:any[]=[],names='Master Teacher';
  candidateTransaction={
    $queryRawUnsafe:async(sql:string)=>sql.includes('clock_timestamp')?[{now:new Date(100)}]:[{state,opensAt:new Date(200)}],
    teacher:{findMany:async({where}:any)=>where.id.in.filter((id:string)=>id==='teacher-1').map((id:string)=>({id,name:names}))},
    electionVoter:{findMany:async()=>[...existing],createMany:async({data}:any)=>{existing.push(...data);}},
    voterParticipation:{createMany:async({data}:any)=>{rights.push(...data);}},
    votingAuditEvent:{create:async({data}:any)=>{audits.push(data);}},
  };
  const result=await syncTeacherRoster('period',['teacher-1'],'actor');
  assert.deepEqual(result,{added:1,alreadyPresent:0,total:1});assert.equal(rights.length,4);
  assert.equal(existing[0].name,'Master Teacher');assert.equal(existing[0].studentId,undefined);assert.equal(existing[0].nisn,undefined);
  assert.equal(existing[0].voterType,'TEACHER');assert.match(existing[0].loginCode,/^GURU-[A-F0-9]{12}$/);
  const code=existing[0].loginCode;names='Edited master';
  assert.equal((await syncTeacherRoster('period',['teacher-1'],'actor')).added,0);
  assert.equal(rights.length,4);assert.equal(existing[0].name,'Master Teacher');assert.equal(existing[0].loginCode,code);
  assert.equal(audits.length,2);
  await assert.rejects(syncTeacherRoster('period',['missing'],'actor'),{code:'TEACHER_NOT_FOUND'});
  existing=Array.from({length:99},()=>({teacherId:null}));
  await assert.rejects(syncTeacherRoster('period',['teacher-1'],'actor'),{code:'ROSTER_LIMIT'});
  assert.equal(rights.length,4);assert.equal(audits.length,2);
  state='CLOSED';await assert.rejects(syncTeacherRoster('period',['teacher-1'],'actor'),{code:'INVALID_STATE'});
});

test('teacher roster endpoint checks voter-management capability, strict JSON and CSRF before writing',async()=>{
  const {POST}=await import('./pages/api/admin/e-voting/[periodId]/voters/teachers');
  const {csrfHeader}=await import('./lib/voting/admin-http');
  const signed=await signToken('synthetic-admin',['superadmin']);
  const endpoint=async(body:unknown,csrf=true)=>{
    const context=createContext({request:new Request('http://localhost:4321/api/admin/e-voting/10000000-0000-4000-8000-000000000001/voters/teachers',{
      method:'POST',headers:{Cookie:'smkdh_token='+signed,Origin:'http://localhost:4321','Content-Type':'application/json',...(csrf?{'X-CSRF-Token':csrfHeader('synthetic-admin',signed)}:{})},body:JSON.stringify(body),
    }),params:{periodId:'10000000-0000-4000-8000-000000000001'}});
    return onRequest(context,()=>POST!(context));
  };
  assert.equal((await endpoint({teacherIds:['teacher-1']},false)).status,403);
  assert.equal((await endpoint({teacherIds:['teacher-1'],all:true})).status,400);
  lookup=async()=>account([{capability:'evoting.pemilih',effect:'revoke'}]);
  assert.equal((await endpoint({teacherIds:['teacher-1']})).status,403);
  lookup=async()=>account([{capability:'evoting.kelola',effect:'revoke'},{capability:'guru.kelola',effect:'revoke'}]);
  candidateTransaction={
    $queryRawUnsafe:async(sql:string)=>sql.includes('clock_timestamp')?[{now:new Date(100)}]:[{state:'DRAFT',opensAt:new Date(200)}],
    teacher:{findMany:async()=>[]},
  };
  const missing=await endpoint({teacherIds:['missing']});
  assert.equal(missing.status,404);assert.deepEqual(await missing.json(),{error:{code:'TEACHER_NOT_FOUND'}});
});

test('teacher reauth resumes partial votes, replaces one session, and fourth vote revokes without linking ballots',async()=>{
  const bcrypt=(await import('bcryptjs')).default;
  const {pinHashMaterial}=await import('./lib/voting/pin-input');
  const {authenticateVoter}=await import('./lib/voting/student-auth');
  const {submitVote}=await import('./lib/voting/votes');
  const now=new Date(),periodId='10000000-0000-4000-8000-000000000001',identifier='GURU-ABCDEF123456',pin='0011223344';
  const period={id:periodId,state:'SCHEDULED',opensAt:new Date(+now-60000),closesAt:new Date(+now+600000)};
  const voter={id:'20000000-0000-4000-8000-000000000001',voterType:'TEACHER',pinHash:await bcrypt.hash(pinHashMaterial('synthetic-test-secret-'.repeat(4),periodId,identifier,pin),4),credentialEnabled:true,pinVersion:1};
  const participation=['OSIS','DEWAN_AMBALAN','IPNU','IPPNU'].map(organization=>({organization,hasVoted:false}));
  let sessions:any[]=[],ballots:any[]=[],lookupKey:any;
  const original=fixtureDb.electionPeriod.findUnique;
  fixtureDb.electionPeriod.findUnique=async()=>period;
  fixtureDb.electionVoter={findUnique:async({where}:any)=>{lookupKey=where;return where.periodId_loginCode?voter:null;}};
  rawQuery=async()=>[{attempts:1}];
  candidateTransaction={
    $queryRaw:async(parts:TemplateStringsArray)=>{
      const sql=parts.join('?');
      if(sql.includes('clock_timestamp'))return [{now}];
      if(sql.includes('FROM "ElectionPeriod"'))return [period];
      if(sql.includes('FROM "ElectionVoter"'))return [voter];
      if(sql.includes('FROM "VotingSession"'))return sessions;
      throw Error(sql);
    },
    electionPeriod:{findUnique:async()=>period},
    votingSession:{deleteMany:async()=>{sessions=[];},create:async({data}:any)=>{const row={id:'30000000-0000-4000-8000-000000000001',scope:'ELECTION_VOTING',...data};sessions=[row];return row;},delete:async()=>{sessions=[];},update:async({data}:any)=>Object.assign(sessions[0],data)},
    voterParticipation:{findMany:async({where}:any)=>where.hasVoted?participation.filter(row=>row.hasVoted):participation,
      updateMany:async({where}:any)=>{const row=participation.find(row=>row.organization===where.organization&&!row.hasVoted);if(!row)return {count:0};row.hasVoted=true;return {count:1};}},
    candidatePair:{findFirst:async()=>({id:'40000000-0000-4000-8000-000000000001'})},
    ballot:{create:async({data}:any)=>{ballots.push(data);}},
  };
  try {
    const first=await authenticateVoter(periodId,identifier,pin,'TEACHER');assert.equal(first.complete,false);
    assert.equal(lookupKey.periodId_loginCode.loginCode,identifier);assert.equal(sessions.length,1);
    assert.equal((await submitVote(sessions[0].id,voter.id,periodId,{organization:'OSIS',candidateId:'40000000-0000-4000-8000-000000000001'})).complete,false);
    await assert.rejects(submitVote(sessions[0].id,voter.id,periodId,{organization:'OSIS',candidateId:'40000000-0000-4000-8000-000000000001'}),{code:'ALREADY_VOTED'});
    const resumed=await authenticateVoter(periodId,identifier,pin,'TEACHER');assert.equal(resumed.complete,false);
    assert.equal(sessions.length,1);assert.equal(participation.filter(row=>row.hasVoted).length,1);
    assert.notEqual(resumed.complete?null:resumed.token,first.complete?null:first.token);
    for(const organization of ['DEWAN_AMBALAN','IPNU','IPPNU'] as const) await submitVote(sessions[0].id,voter.id,periodId,{organization,candidateId:'40000000-0000-4000-8000-000000000001'});
    assert.equal(sessions.length,0);assert.equal(ballots.length,4);
    assert.deepEqual(Object.keys(ballots[0]).sort(),['candidateId','organization','periodId']);
    assert.equal((await authenticateVoter(periodId,identifier,pin,'TEACHER')).complete,true);
    assert.equal(sessions.length,0);
    await assert.rejects(authenticateVoter(periodId,identifier,'9999999999','TEACHER'),{code:'INVALID_CREDENTIALS'});
    await assert.rejects(authenticateVoter(periodId,'0012345678',pin,'STUDENT'),{code:'INVALID_CREDENTIALS'});
  } finally {fixtureDb.electionPeriod.findUnique=original;}
});

test('expired draft PIN issuance hashes each identifier correctly in a mixed batch and audits both without plaintext',async()=>{
  const bcrypt=(await import('bcryptjs')).default;
  const {issuePins}=await import('./lib/voting/pins');
  const {pinHashMaterial}=await import('./lib/voting/pin-input');
  const periodId='10000000-0000-4000-8000-000000000001',now=new Date();
  const voters=[{id:'20000000-0000-4000-8000-000000000001',voterType:'STUDENT',nisn:'0012345678',loginCode:null,name:'Student',className:'X',pinVersion:0,pinHash:null,credentialEnabled:false,participation:[]},
    {id:'20000000-0000-4000-8000-000000000002',voterType:'TEACHER',nisn:null,loginCode:'GURU-ABCDEF123456',name:'Teacher',className:'Guru',pinVersion:0,pinHash:null,credentialEnabled:false,participation:[]}];
  const password='synthetic-password',passwordHash=await bcrypt.hash(password,4),updated=new Map<string,any>();let audits:any[]=[];
  lookup=async()=>({active:true,passwordHash});rawQuery=async()=>[{attempts:1}];
  fixtureDb.electionVoter={findMany:async()=>voters};
  candidateTransaction={
    $queryRaw:async(parts:TemplateStringsArray)=>parts.join('?').includes('clock_timestamp')?[{now}]:[{state:'DRAFT',opensAt:new Date(+now-600000),closesAt:new Date(+now-300000)}],
    account:{findUnique:async()=>({active:true})},
    electionVoter:{findMany:async()=>voters,findFirst:async()=>null,update:async({where,data}:any)=>{updated.set(where.id,data);}},
    votingSession:{deleteMany:async()=>{}},votingAuditEvent:{createMany:async({data}:any)=>{audits=data;}},
  };
  const slips=await issuePins(periodId,{targets:voters.map(voter=>({voterId:voter.id,pinVersion:0})),mode:'issue',adminPassword:password},'synthetic-admin');
  assert.equal(slips.length,2);assert.notEqual(slips[0].pin,slips[1].pin);
  for(const slip of slips) {
    const stored=updated.get(slip.id),identifier=slip.voterType==='TEACHER'?slip.loginCode!:slip.nisn!;
    assert.ok(await bcrypt.compare(pinHashMaterial('synthetic-test-secret-'.repeat(4),periodId,identifier,slip.pin),stored.pinHash));
    assert.equal(stored.credentialEnabled,true);assert.equal(stored.pinVersion.increment,1);
    assert.ok(!JSON.stringify(audits).includes(slip.pin));
  }
  assert.equal(audits.length,2);
});

test('expired draft can be rescheduled but an opened scheduled period stays locked',async()=>{
  const {updatePeriod}=await import('./lib/voting/periods');
  let state='DRAFT',writes=0;
  const expected={name:'Draft',academicYear:'2026/2027',opensAt:new Date(50),closesAt:new Date(80)};
  const input={...expected,opensAt:new Date(200),closesAt:new Date(300)};
  candidateTransaction={
    $queryRaw:async(parts:TemplateStringsArray)=>parts.join('?').includes('clock_timestamp')?[{now:new Date(100)}]:[{id:'period'}],
    electionPeriod:{findUniqueOrThrow:async()=>({...expected,state}),update:async()=>{writes++;return input;}},
    votingAuditEvent:{create:async()=>{}},
  };
  await updatePeriod('period',input,expected,'actor');
  assert.equal(writes,1);
  await assert.rejects(updatePeriod('period',expected,expected,'actor'),{code:'INVALID_SCHEDULE'});
  state='SCHEDULED';
  await assert.rejects(updatePeriod('period',input,expected,'actor'),{code:'INVALID_STATE'});
  assert.equal(writes,1);
});

test('selected students only are added from the correct academic year, without replacing existing voters',async()=>{
  const {syncMasterRoster}=await import('./lib/voting/voters');
  const a={id:'20000000-0000-4000-8000-000000000001',nisn:'0012345678',name:'Student A',className:'X'},
    b={id:'20000000-0000-4000-8000-000000000002',nisn:'0012345679',name:'Student B',className:'X'};
  let state='DRAFT',records:any[]=[],rights:any[]=[],audits:any[]=[];
  candidateTransaction={
    $queryRawUnsafe:async(sql:string)=>sql.includes('clock_timestamp')?[{now:new Date(100)}]:[{state,opensAt:new Date(50)}],
    electionPeriod:{findUniqueOrThrow:async()=>({academicYear:'2026/2027'})},
    student:{findMany:async({where}:any)=>{
      assert.equal(where.schoolClass.academicYear,'2026/2027');
      return [a,b].filter(student=>!where.id || where.id.in.includes(student.id));
    }},
    electionVoter:{findMany:async()=>[...records],createMany:async({data}:any)=>{records.push(...data);}},
    voterParticipation:{createMany:async({data}:any)=>{rights.push(...data);}},
    votingAuditEvent:{create:async({data}:any)=>{audits.push(data);}},
  };
  const first=await syncMasterRoster('period','actor',[a.id]);
  assert.equal(first.added,1);assert.deepEqual(records.map(row=>row.studentId),[a.id]);assert.equal(rights.length,4);
  assert.equal((await syncMasterRoster('period','actor',[a.id])).added,0);
  await syncMasterRoster('period','actor',[b.id]);
  assert.equal(records.length,2);assert.equal(rights.length,8);
  await assert.rejects(syncMasterRoster('period','actor',['20000000-0000-4000-8000-000000000003']),{code:'STUDENT_NOT_ELIGIBLE'});
  records=Array.from({length:99},()=>({studentId:null,nisn:null}));
  await assert.rejects(syncMasterRoster('period','actor',[a.id]),{code:'ROSTER_LIMIT'});
  state='SCHEDULED';await assert.rejects(syncMasterRoster('period','actor',[a.id]),{code:'INVALID_STATE'});
  assert.equal(audits.length,3);
});

test('student roster endpoint requires explicit IDs, CSRF and voter permissions; it never falls back to all students',async()=>{
  const {POST}=await import('./pages/api/admin/e-voting/[periodId]/voters/index');
  const {csrfHeader}=await import('./lib/voting/admin-http');
  const signed=await signToken('synthetic-admin',['superadmin']),id='20000000-0000-4000-8000-000000000001';
  let writes=0;
  candidateTransaction={
    $queryRawUnsafe:async(sql:string)=>sql.includes('clock_timestamp')?[{now:new Date(100)}]:[{state:'DRAFT',opensAt:new Date(50)}],
    electionPeriod:{findUniqueOrThrow:async()=>({academicYear:'2026/2027'})},
    student:{findMany:async({where}:any)=>where.id.in.includes(id)?[{id,nisn:'0012345678',name:'Selected Student',className:'X'}]:[]},
    electionVoter:{findMany:async()=>[],createMany:async()=>{writes++;}},
    voterParticipation:{createMany:async()=>{}},votingAuditEvent:{create:async()=>{}},
  };
  const endpoint=async(body:unknown,csrf=true)=>{
    const context=createContext({request:new Request('http://localhost:4321/api/admin/e-voting/10000000-0000-4000-8000-000000000001/voters',{
      method:'POST',headers:{Cookie:'smkdh_token='+signed,Origin:'http://localhost:4321','Content-Type':'application/json',...(csrf?{'X-CSRF-Token':csrfHeader('synthetic-admin',signed)}:{})},body:JSON.stringify(body),
    }),params:{periodId:'10000000-0000-4000-8000-000000000001'}});
    return onRequest(context,()=>POST!(context));
  };
  assert.equal((await endpoint({})).status,400);
  assert.equal((await endpoint({studentIds:[id]},false)).status,403);
  assert.equal((await endpoint({studentIds:[id],all:true})).status,400);
  lookup=async()=>account([{capability:'evoting.pemilih',effect:'revoke'}]);
  assert.equal((await endpoint({studentIds:[id]})).status,403);
  lookup=async()=>account([{capability:'student.kelola',effect:'revoke'},{capability:'evoting.kelola',effect:'revoke'}]);
  assert.equal((await endpoint({studentIds:['20000000-0000-4000-8000-000000000002']})).status,404);
  assert.equal(writes,0);
  const response=await endpoint({studentIds:[id]});
  assert.equal(response.status,200);assert.equal((await response.json()).data.added,1);assert.equal(writes,1);
});
