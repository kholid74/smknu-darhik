import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import pgDriver from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import Ajv2020 from 'ajv/dist/2020.js';
import { createContext } from 'astro/middleware';

// Real generated Prisma + official pg adapter + SQL/constraints, with no network/.env.
// The single test connection uses savepoints; this does not prove multi-connection locking or isolation.
const pg = new PGlite();
const statements: string[] = [];
class FixturePool extends pgDriver.Pool {
  async query(config: any, values?: any): Promise<any> {
    const sql = typeof config === 'string' ? config : config.text;
    statements.push(sql);
    if (sql === 'BEGIN') { await pg.exec('SAVEPOINT prisma_service'); return { rows: [], fields: [], rowCount: 0 }; }
    if (sql === 'COMMIT') { await pg.exec('SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED; RELEASE SAVEPOINT prisma_service'); return { rows: [], fields: [], rowCount: 0 }; }
    if (sql === 'ROLLBACK') { await pg.exec('ROLLBACK TO SAVEPOINT prisma_service; RELEASE SAVEPOINT prisma_service'); return { rows: [], fields: [], rowCount: 0 }; }
    if (sql.startsWith('SET TRANSACTION ISOLATION LEVEL')) return { rows: [], fields: [], rowCount: 0 };
    const parsers = config.types ? Object.fromEntries(Object.values(pgDriver.types.builtins).map(oid=>[oid,config.types.getTypeParser(oid,'text')])) : undefined;
    const result = await pg.query(sql, typeof config === 'string' ? values : config.values, { rowMode: config.rowMode, parsers });
    return { ...result, rowCount: result.affectedRows ?? result.rows.length };
  }
  async connect(): Promise<any> {
    const client = new EventEmitter() as any;
    client.query = this.query.bind(this); client.release = () => {};
    return client;
  }
}
const prisma = new PrismaClient({ adapter: new PrismaPg(new FixturePool()) });
const globalDb = globalThis as typeof globalThis & { dynamicVotingDb?: typeof prisma };
globalDb.dynamicVotingDb = prisma;
register('data:text/javascript,' + encodeURIComponent(`
  const mod = source => ({url:'data:text/javascript,'+encodeURIComponent(source),shortCircuit:true});
  export function resolve(specifier,context,nextResolve) {
    if(specifier==='astro:middleware')return nextResolve('astro/middleware',context);
    if(specifier.startsWith('.')){
      const path=new URL(specifier,context.parentURL).pathname;
      if(/\\/lib\\/prisma(?:\\.ts)?$/.test(path))return mod('export const db=globalThis.dynamicVotingDb');
      if(/\\/lib\\/env(?:\\.ts)?$/.test(path))return mod("export const env=()=>undefined; export const requireEnv=()=> 'synthetic-dynamic-secret-'.repeat(3)");
    }
    return nextResolve(specifier,context);
  }
`), import.meta.url);
const services = await import('./election-types');
const { authenticateVoter } = await import('./student-auth');
const { pinHashMaterial } = await import('./pin-input');
const { submitVote } = await import('./votes');
const { getParticipation, getParticipationVoters } = await import('./participation');
const { getStudentDashboard } = await import('./student-dashboard');
const { getStudentVotingStatus } = await import('./student-status');
const { extendStudentSession, revokeStudentSession } = await import('./student-session-actions');
const { getBallotProgress, getOrganizationCandidates } = await import('./ballot-pages');
const { syncTeacherRoster, syncMasterRoster } = await import('./voters');
const { saveCandidatePair, deleteCandidatePair } = await import('./candidates');
const { schedulePeriod, getPeriodSetup, publishPeriod, listPeriods } = await import('./periods');
const { closePeriodTransaction } = await import('./period-close');
const { getPublishedResult, getResultDisplayLogos } = await import('./public-results');
const { deleteMedia, MediaInUseError } = await import('../media-delete');
const { issuePins } = await import('./pins');
const { onRequest } = await import('../../middleware');
const { POST: voteEndpoint } = await import('../../pages/api/e-voting/[periodId]/votes');
const { POST: closeEndpoint } = await import('../../pages/api/admin/e-voting/[periodId]/close');
const { POST: publishEndpoint } = await import('../../pages/api/admin/e-voting/[periodId]/publish');
const { GET: cleanupPreviewEndpoint, POST: cleanupEndpoint } = await import('../../pages/api/admin/e-voting/[periodId]/test-cleanup');
const { GET: publicResultsEndpoint } = await import('../../pages/api/e-voting/[periodId]/results');
const { GET: internalResultsEndpoint } = await import('../../pages/api/admin/e-voting/[periodId]/results');
const { csrfHeader } = await import('./admin-http');
const { signToken } = await import('../auth');
const { createStudentSessionCsrfToken } = await import('./security');
const { VOTING_SESSION_COOKIE } = await import('./student-session');
const five = ['OSIS', 'PRADANA_PUTRA', 'PRADANA_PUTRI', 'IPNU', 'IPPNU'];
const secret = 'synthetic-dynamic-secret-'.repeat(3), pin = '0011223344';
const adminHash=await bcrypt.hash('synthetic-password',4);
const adminToken=await signToken('actor',['superadmin']);
const contract = JSON.parse(await readFile(new URL('../../../docs/e-voting/contracts/e-voting-v2.openapi.json',import.meta.url),'utf8'));
const ajv = new Ajv2020({strict:false});
ajv.addFormat('uuid',/^[0-9a-f-]{36}$/i);ajv.addFormat('date-time',(v:string)=>Number.isFinite(Date.parse(v)));ajv.addFormat('uri-reference',/^(?:https?:\/\/|\/api\/image\/).+/);
ajv.addSchema({...contract,$id:'evoting'});
function conforms(schema:string,data:unknown){const validate=ajv.compile({$ref:'evoting#/components/schemas/'+schema});assert.ok(validate(JSON.parse(JSON.stringify(data))),JSON.stringify(validate.errors));}
before(async () => {
  const root = new URL('../../../prisma/migrations/', import.meta.url);
  for (const entry of (await readdir(root,{withFileTypes:true})).filter(e=>e.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))) {
    await pg.exec(await readFile(new URL(entry.name+'/migration.sql',root),'utf8'));
  }
});
after(async () => { await prisma.$disconnect(); await pg.close(); delete globalDb.dynamicVotingDb; });
beforeEach(async () => {
  statements.length = 0;
  await pg.exec(`BEGIN; INSERT INTO "Account" (id,email,"passwordHash") VALUES ('actor','actor@example.test','synthetic');
    INSERT INTO "Department" (id,slug,name,description,kompetensi,karir) VALUES ('qa-dept','qa-dept','Synthetic','Synthetic','[]','[]');
    INSERT INTO "SchoolClass" (id,"academicYear",name,"departmentId") VALUES ('qa-class','2026/2027','QA','qa-dept');`);
  await pg.query('UPDATE "Account" SET "passwordHash"=$1 WHERE id=$2',[adminHash,'actor']);
});
afterEach(() => pg.exec('ROLLBACK'));

async function setup(n = 5, voterCount = 2, open = true) {
  if (n === 6) await services.createElectionType({code:'NEW_TYPE',name:'New custom type',candidateMode:'SINGLE',chairLabel:'Pemimpin',viceChairLabel:null,logoUrl:null,sortOrder:6,active:true},'actor');
  const codes = n === 1 ? ['PRADANA_PUTRI'] : n === 6 ? [...five, 'NEW_TYPE'] : five;
  const now = Date.now();
  const result = await services.createPeriod({slug:'synthetic-period',name:'Synthetic election',academicYear:'2026/2027',isTest:true,
    opensAt:new Date(now+86400000),closesAt:new Date(now+172800000),organizations:codes},'actor');
  const id = result.id;
  const students = [];
  for(let i=0;i<Math.max(2,voterCount-1);i++)students.push(await prisma.student.create({data:{nisn:String(9900000000+i),name:'Student '+i,className:'QA',schoolClassId:'qa-class'}}));
  await prisma.teacher.create({data:{id:'qa-teacher',name:'Teacher QA',position:'Guru'}});
  await syncMasterRoster(id,'actor',students.slice(0,voterCount-1).map(s=>s.id));
  await syncTeacherRoster(id,['qa-teacher'],'actor');
  for(const code of codes)await saveCandidatePair(id,{organization:code,ballotNumber:1,chair:{studentId:students[0].id},viceChair:null,vision:'Vision',mission:'Mission'},'actor');
  const voters=await prisma.electionVoter.findMany({where:{periodId:id},orderBy:{voterType:'asc'}});
  for(const voter of voters){
    const identifier=voter.nisn??voter.loginCode!;
    await prisma.electionVoter.update({where:{id:voter.id},data:{pinHash:await bcrypt.hash(pinHashMaterial(secret,id,identifier,pin),4),pinFingerprint:randomUUID().replaceAll('-','').repeat(2),credentialEnabled:true,pinVersion:1}});
  }
  assert.equal((await getPeriodSetup(id))!.ready,true);
  await schedulePeriod(id,'actor');
  // Fixture advances opening while still pre-open; production schedule and contest guards remain active.
  if(open)await prisma.electionPeriod.update({where:{id},data:{opensAt:new Date(Date.now()-60000)}});
  return {id,codes,voters,students,candidates:await prisma.candidatePair.findMany({where:{periodId:id}})};
}
const login = (periodId:string,voter:any) => authenticateVoter(periodId,voter.nisn??voter.loginCode,pin,voter.voterType);

async function closeRequest(periodId:string,body:unknown,settings:{cookie?:string;origin?:string;csrf?:string;raw?:string;contentType?:string}={}) {
  const context=createContext({request:new Request('http://localhost:4321/api/admin/e-voting/'+periodId+'/close',{method:'POST',
    headers:{Cookie:settings.cookie??'smkdh_token='+adminToken,Origin:settings.origin??'http://localhost:4321',
      'Content-Type':settings.contentType??'application/json','X-CSRF-Token':settings.csrf??csrfHeader('actor',adminToken)},body:settings.raw??JSON.stringify(body)}),params:{periodId}});
  return onRequest(context,()=>closeEndpoint!(context));
}

test('official Prisma client and pg adapter run generated queries on the isolated dynamic schema',async()=>{
  assert.equal((await prisma.electionType.findMany()).length,5);
  const p=await setup();assert.equal(p.voters.length,2);assert.equal((await prisma.voterParticipation.count({where:{periodId:p.id}})),10);
});

for(const n of [1,5,6])test(n+' types: student and teacher login, partial resume, last-vote revocation, aggregates and v2 publication',async()=>{
  const p=await setup(n);
  const metadata=await services.getPeriodContests(p.id);
  const originalNames=metadata!.contests.map(c=>c.name);
  await services.updateElectionType(p.codes[0],{name:'Changed master only',active:false,expectedRevision:0},'actor');
  for(const voter of p.voters){
    const first=await login(p.id,voter);assert.equal(first.complete,false);if(first.complete)throw Error('missing session');
    let sid=first.sessionId;
    const dashboard=await getStudentDashboard(p.id,voter.id);assert.ok(dashboard);conforms('Dashboard',dashboard);
    assert.deepEqual(dashboard.contests.map(c=>c.name),originalNames);
    const progress=await getBallotProgress(p.id,'synthetic-period',voter.id);assert.equal(progress.nextOrganization,p.codes[0]);
    assert.deepEqual(progress.contests.map(c=>c.organization),p.codes);
    const stored=await prisma.votingSession.findUniqueOrThrow({where:{id:sid}});
    const status=await getStudentVotingStatus({...stored,periodId:p.id});assert.ok(status);conforms('VotingStatus',status);
    for(const [i,code]of p.codes.entries()){
      const candidates=await getOrganizationCandidates(p.id,'synthetic-period',voter.id,code);
      const result=await submitVote(sid,voter.id,p.id,{organization:code,candidateId:candidates.candidates[0].id});
      assert.equal(result.complete,i===p.codes.length-1);assert.equal(result.nextOrganization,p.codes[i+1]??null);
      if(i===0&&n>1){
        await assert.rejects(submitVote(sid,voter.id,p.id,{organization:code,candidateId:candidates.candidates[0].id}),{code:'ALREADY_VOTED'});
        await assert.rejects(getOrganizationCandidates(p.id,'synthetic-period',voter.id,code),{code:'ALREADY_VOTED'});
        const resumed=await login(p.id,voter);assert.equal(resumed.complete,false);if(resumed.complete)throw Error('missing resumed session');
        assert.notEqual(resumed.sessionId,sid);assert.equal(await prisma.votingSession.count({where:{id:sid}}),0);sid=resumed.sessionId;
        const extension=await extendStudentSession(sid,voter.id,p.id);assert.ok(extension.idleExpiresAt<=extension.absoluteExpiresAt);
        const summary=await getParticipation(p.id);assert.ok(summary);assert.equal(summary.partial>=1,true);conforms('ParticipationSummary',summary);
        assert.equal('candidates' in summary,false);
      }
    }
    assert.equal(await prisma.votingSession.count({where:{voterId:voter.id}}),0);
    assert.equal((await login(p.id,voter)).complete,true);
  }
  const summary=await getParticipation(p.id);assert.ok(summary);assert.equal(summary.complete,2);assert.equal(summary.partial,0);
  assert.deepEqual(summary.byOrganization.map(r=>r.organization),p.codes);conforms('ParticipationSummary',summary);
  const page=await getParticipationVoters(p.id,null,1);assert.ok(page?.nextCursor);
  assert.deepEqual(Object.keys(page.data[0].participation),p.codes);
  const next=await getParticipationVoters(p.id,page.nextCursor,1);assert.equal(next?.nextCursor,null);assert.equal(next?.data.length,1);
  const columns=(await pg.query<{column_name:string}>(`SELECT column_name FROM information_schema.columns WHERE table_name='Ballot' ORDER BY ordinal_position`)).rows.map(r=>r.column_name);
  assert.deepEqual(columns,['id','periodId','organization','candidateId']);
  assert.equal(await getPublishedResult({id:p.id}),null);
  await prisma.$transaction(tx=>closePeriodTransaction(tx,p.id,'actor',true,'Keputusan panitia sesuai berita acara'));
  assert.equal(await getPublishedResult({id:p.id}),null);
  await publishPeriod(p.id,'actor','synthetic-password');
  const published=await getPublishedResult({id:p.id});assert.ok(published);conforms('PublicResults',published);
  assert.equal(published.result.version,2);assert.equal(published.result.contests.length,n);
  assert.deepEqual(published.result.contests.map(c=>c.name),originalNames);
  assert.doesNotMatch(JSON.stringify(published.result),/studentId|teacherId|voterId|GURU-|pinHash|nisn/);
});

test('result display fills missing logos from the master without rewriting historical logos, names, totals or API snapshots',async()=>{
  const p=await setup();
  await prisma.$transaction(tx=>closePeriodTransaction(tx,p.id,'actor',true,'Penutupan sesuai keputusan panitia'));
  await publishPeriod(p.id,'actor','synthetic-password');
  const before=await getPublishedResult({id:p.id});assert.ok(before);
  const stored=(await prisma.electionPeriod.findUniqueOrThrow({where:{id:p.id}})).resultSnapshot;
  for(const code of ['OSIS','PRADANA_PUTRA']){
    const url='/api/image/qa/logo-'+code+'.webp';
    await prisma.media.create({data:{url,filename:code+'.webp',kind:'image'}});
    await services.updateElectionType(code,{logoUrl:url,name:'Changed master '+code,active:false,expectedRevision:0},'actor','http://localhost:4321');
  }
  const start=statements.length,logos=await getResultDisplayLogos(before.result.contests,'http://localhost:4321');
  assert.equal(logos.get('OSIS'),'/api/image/qa/logo-OSIS.webp');assert.equal(logos.get('PRADANA_PUTRA'),'/api/image/qa/logo-PRADANA_PUTRA.webp');
  assert.equal(logos.get('IPNU'),null);
  assert.ok(!statements.slice(start).some(sql=>/FROM "(?:Ballot|Student|Teacher|CandidatePair|ElectionVoter)"/.test(sql)));
  assert.deepEqual(await getPublishedResult({id:p.id}),before);
  assert.deepEqual((await prisma.electionPeriod.findUniqueOrThrow({where:{id:p.id}})).resultSnapshot,stored);
  const historical=[{organization:'OSIS',logoUrl:'/api/image/qa/original-logo.webp'}],queries=statements.length;
  assert.equal((await getResultDisplayLogos(historical,'http://localhost:4321')).get('OSIS'),historical[0].logoUrl);
  assert.equal(statements.length,queries);
  const findMany=prisma.electionType.findMany;
  try {
    prisma.electionType.findMany=async()=>{throw new Error('Private database detail')};
    assert.equal((await getResultDisplayLogos(before.result.contests,'http://localhost:4321')).get('OSIS'),null);
  } finally {prisma.electionType.findMany=findMany;}
});

for (const [state,published] of [['CLOSED',true],['ARCHIVED',true],['ARCHIVED',false]] as const) test(`test cleanup permits ${state} published=${published}, preserves masters/audit and rejects unsafe requests`,async()=>{
  const p=await setup(),voter=p.voters[0],session=await login(p.id,voter);if(session.complete)throw Error('missing session');
  await prisma.accountRole.create({data:{accountId:'actor',role:'superadmin'}});
  await submitVote(session.sessionId,voter.id,p.id,{organization:p.codes[0],candidateId:p.candidates.find(c=>c.organization===p.codes[0])!.id});
  await prisma.$transaction(tx=>closePeriodTransaction(tx,p.id,'actor',true,'Pemilihan uji selesai sesuai panitia'));
  if(published)await publishPeriod(p.id,'actor','synthetic-password');
  const other=await services.createPeriod({slug:'preserve-official',name:'Official',academicYear:'2026/2027',isTest:false,opensAt:new Date(Date.now()+86400000),closesAt:new Date(Date.now()+172800000),organizations:['OSIS']},'actor');
  const masterBefore={students:await prisma.student.findMany(),teachers:await prisma.teacher.findMany(),accounts:await prisma.account.findMany(),classes:await prisma.schoolClass.findMany(),departments:await prisma.department.findMany(),types:await prisma.electionType.findMany(),media:await prisma.media.findMany()};
  const visit=async(method='GET',body?:unknown,csrf=true,id=p.id)=>{
    const context=createContext({request:new Request('http://localhost:4321/api/admin/e-voting/'+id+'/test-cleanup',{method,headers:{Cookie:'smkdh_token='+adminToken,...(method==='POST'?{Origin:'http://localhost:4321','Content-Type':'application/json',...(csrf?{'X-CSRF-Token':csrfHeader('actor',adminToken)}:{})}:{})},...(body?{body:JSON.stringify(body)}:{})}),params:{periodId:id}});
    return onRequest(context,()=>method==='GET'?cleanupPreviewEndpoint!(context):cleanupEndpoint!(context));
  };
  const previewResponse=await visit();assert.equal(previewResponse.status,200);const preview=(await previewResponse.json()).data;
  assert.equal(preview.ballots,1);assert.equal(!!preview.publishedAt,published);
  for(const sql of ['DELETE FROM "Ballot" WHERE "periodId"=$1','UPDATE "Ballot" SET id=gen_random_uuid() WHERE "periodId"=$1','DELETE FROM "VotingAuditEvent" WHERE "periodId"=$1']){
    await pg.exec('SAVEPOINT published_guards');await assert.rejects(pg.query(sql,[p.id]));await pg.exec('ROLLBACK TO SAVEPOINT published_guards; RELEASE SAVEPOINT published_guards');
  }
  await prisma.account.update({where:{id:'actor'},data:{active:false}});
  assert.equal((await pg.query<{data:{error:string}}>('SELECT evoting_delete_test_period($1,$2,$3,$4) AS data',[p.id,'actor','HAPUS synthetic-period',preview.version])).rows[0].data.error,'FORBIDDEN');
  await prisma.account.update({where:{id:'actor'},data:{active:true}});
  const body={confirmation:'HAPUS synthetic-period',previewVersion:preview.version,adminPassword:'synthetic-password'};
  assert.equal((await visit('POST',body,false)).status,403);
  assert.equal((await visit('POST',{...body,adminPassword:'wrong'})).status,401);
  assert.equal((await visit('POST',{...body,confirmation:'HAPUS preserve-official'})).status,409);
  await prisma.accountOverride.create({data:{accountId:'actor',capability:'evoting.hapus-uji',effect:'revoke'}});
  assert.equal((await visit('POST',body)).status,403);await prisma.accountOverride.deleteMany();
  if(state==='ARCHIVED')await prisma.electionPeriod.update({where:{id:p.id},data:{state:'ARCHIVED'}});
  else await prisma.votingAuditEvent.create({data:{periodId:p.id,event:'CLEANUP_PREVIEW_CHANGED',actorAccountId:'actor'}});
  assert.equal((await visit('POST',body)).status,409);
  const fresh=(await (await visit()).json()).data;
  const auditBefore=await prisma.votingAuditEvent.findMany({where:{periodId:p.id},orderBy:{id:'asc'}});
  if(state==='CLOSED'){
    await pg.exec(`CREATE FUNCTION fail_published_cleanup() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic cleanup rollback'; END $$;
      CREATE TRIGGER fail_published_cleanup BEFORE DELETE ON "ElectionVoter" FOR EACH ROW EXECUTE FUNCTION fail_published_cleanup();`);
    assert.equal((await visit('POST',{...body,previewVersion:fresh.version})).status,503);
    assert.equal(await prisma.ballot.count({where:{periodId:p.id}}),1);
    assert.deepEqual(await prisma.votingAuditEvent.findMany({where:{periodId:p.id},orderBy:{id:'asc'}}),auditBefore);
    await pg.exec('DROP TRIGGER fail_published_cleanup ON "ElectionVoter"; DROP FUNCTION fail_published_cleanup();');
    assert.equal((await visit('POST',{...body,previewVersion:fresh.version})).status,429);
    await prisma.votingRateBucket.updateMany({data:{expiresAt:new Date(Date.now()-1000)}});
  }
  assert.equal((await visit('POST',{...body,previewVersion:fresh.version})).status,204);
  await pg.exec('SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED');
  for(const model of ['electionVoter','voterParticipation','ballot','candidateMember','candidatePair','electionContest'] as const)assert.equal(await prisma[model].count({where:{periodId:p.id}}),0,model);
  assert.equal(await prisma.electionPeriod.count({where:{id:p.id}}),0);assert.equal(await prisma.votingSession.count(),0);
  assert.ok(await prisma.votingRateBucket.count());
  assert.equal(await getPublishedResult({id:p.id}),null);
  assert.ok(await prisma.electionPeriod.findUnique({where:{id:other.id}}));
  assert.deepEqual({students:await prisma.student.findMany(),teachers:await prisma.teacher.findMany(),accounts:await prisma.account.findMany(),classes:await prisma.schoolClass.findMany(),departments:await prisma.department.findMany(),types:await prisma.electionType.findMany(),media:await prisma.media.findMany()},masterBefore);
  const events=await prisma.votingAuditEvent.findMany({where:{periodId:p.id}}),deleted=events.find(e=>e.event==='TEST_PERIOD_DELETED')!;
  assert.deepEqual(events.filter(e=>e.event!=='TEST_PERIOD_DELETED').sort((a,b)=>a.id.localeCompare(b.id)),auditBefore);
  assert.equal((deleted.detail as any).state,state);assert.equal(!!(deleted.detail as any).publishedAt,published);assert.equal((deleted.detail as any).ballots,1);
  assert.equal((await visit('GET',undefined,true,other.id)).status,409);
  assert.equal((await pg.query<{data:{error:string}}>('SELECT evoting_delete_test_period($1,$2,$3,$4) AS data',[other.id,'actor','HAPUS preserve-official','0'.repeat(32)])).rows[0].data.error,'TEST_CLEANUP_NOT_ALLOWED');
});

test('a fourth voter is refused, same voter may replace its session, logout/expiry release a slot',async()=>{
  const p=await setup(5,4),sessions=[];
  for(const voter of p.voters.slice(0,3)){const result=await login(p.id,voter);assert.equal(result.complete,false);if(!result.complete)sessions.push(result);}
  await assert.rejects(login(p.id,p.voters[3]),{code:'SESSION_CAPACITY'});
  assert.equal(await prisma.votingSession.count(),3);
  const replacement=await login(p.id,p.voters[0]);assert.equal(replacement.complete,false);
  assert.equal(await prisma.votingSession.count(),3);assert.equal(await prisma.votingSession.count({where:{id:sessions[0].sessionId}}),0);
  const old=await prisma.votingSession.findUniqueOrThrow({where:{id:sessions[1].sessionId}});
  assert.equal(await revokeStudentSession(old.tokenHash),true);assert.equal(await revokeStudentSession(old.tokenHash),false);
  const fourth=await login(p.id,p.voters[3]);assert.equal(fourth.complete,false);
  await prisma.votingSession.update({where:{id:sessions[2].sessionId},data:{expiresAt:new Date(Date.now()-1000)}});
  assert.equal((await login(p.id,p.voters[1])).complete,false);
  assert.ok(statements.some(s=>s.includes('pg_advisory_xact_lock(74190232)')));
});

test('wrong type/candidate and ballot failure cannot consume a right or extend/revoke the session',async()=>{
  const p=await setup(),voter=p.voters[0],session=await login(p.id,voter);if(session.complete)throw Error('missing session');
  await assert.rejects(submitVote(session.sessionId,voter.id,p.id,{organization:'NOT_ATTACHED',candidateId:p.candidates[0].id}),{code:'INVALID_ORGANIZATION'});
  const wrong=p.candidates.find(c=>c.organization!==p.codes[0])!;
  await assert.rejects(submitVote(session.sessionId,voter.id,p.id,{organization:p.codes[0],candidateId:wrong.id}),{code:'INVALID_CANDIDATE'});
  await assert.rejects(getOrganizationCandidates(p.id,'synthetic-period',voter.id,'NOT_ATTACHED'),{code:'INVALID_ORGANIZATION'});
  await pg.exec(`CREATE FUNCTION fail_ballot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic ballot failure'; END $$;
    CREATE TRIGGER fail_ballot BEFORE INSERT ON "Ballot" FOR EACH ROW EXECUTE FUNCTION fail_ballot();`);
  const before=await prisma.votingSession.findUniqueOrThrow({where:{id:session.sessionId}});
  await assert.rejects(submitVote(session.sessionId,voter.id,p.id,{organization:p.codes[0],candidateId:p.candidates.find(c=>c.organization===p.codes[0])!.id}));
  assert.equal(await prisma.voterParticipation.count({where:{hasVoted:true}}),0);assert.equal(await prisma.ballot.count(),0);
  assert.deepEqual(await prisma.votingSession.findUniqueOrThrow({where:{id:session.sessionId}}),before);
});

test('single mode and opened candidate edits are rejected; Student master changes do not rewrite snapshots',async()=>{
  const p=await setup(5,2,false),candidate=p.candidates.find(c=>c.organization==='PRADANA_PUTRA')!;
  const invalid={organization:'PRADANA_PUTRA',ballotNumber:2,chair:{studentId:p.students[0].id},viceChair:{studentId:p.students[1].id},vision:'New',mission:'New'};
  await assert.rejects(saveCandidatePair(p.id,invalid,'actor'),{code:'INVALID_CANDIDATE_MODE'});
  await prisma.electionPeriod.update({where:{id:p.id},data:{opensAt:new Date(Date.now()-60000)}});
  await prisma.student.update({where:{id:p.students[0].id},data:{name:'Changed master',className:'New class'}});
  await assert.rejects(saveCandidatePair(p.id,invalid,'actor'),{code:'CANDIDATES_LOCKED'});
  const members=await prisma.candidateMember.findMany({where:{candidatePairId:candidate.id}});
  assert.equal(members[0].nameSnapshot,'Student 0');assert.equal(members[0].classSnapshot,'QA');assert.equal(members.length,1);
});

test('candidate edits preserve existing student snapshots, replace only new members and compare both old photos', async () => {
  const p=await setup(5,2,false), candidate=p.candidates.find(c=>c.organization==='OSIS')!;
  const read=()=>prisma.candidatePair.findUniqueOrThrow({where:{id:candidate.id},include:{members:true}});
  const expected=(pair:Awaited<ReturnType<typeof read>>)=>{
    const chair=pair.members.find(m=>m.position==='CHAIR')!,vice=pair.members.find(m=>m.position==='VICE_CHAIR');
    return {ballotNumber:pair.ballotNumber,vision:pair.vision,mission:pair.mission,chairStudentId:chair.studentId,viceChairStudentId:vice?.studentId??null,chairPhotoUrl:chair.photoUrl,viceChairPhotoUrl:vice?.photoUrl??null};
  };
  const input={organization:'OSIS',ballotNumber:1,chair:{studentId:p.students[0].id,photoUrl:'/api/image/qa/chair.jpg'},viceChair:{studentId:p.students[1].id,photoUrl:'/api/image/qa/vice.jpg'},vision:'Edited vision',mission:'Edited mission'};
  for(const url of [input.chair.photoUrl,input.viceChair.photoUrl])await prisma.media.create({data:{url,filename:'synthetic.jpg',kind:'image'}});
  const original=expected(await read());
  await prisma.student.update({where:{id:p.students[0].id},data:{name:'Changed master',className:'Changed class'}});
  await prisma.student.update({where:{id:p.students[1].id},data:{name:'New vice master',className:'New class'}});
  await saveCandidatePair(p.id,input,'actor',candidate.id,original);
  const edited=await read(),chair=edited.members.find(m=>m.position==='CHAIR')!,vice=edited.members.find(m=>m.position==='VICE_CHAIR')!;
  assert.equal(chair.nameSnapshot,'Student 0');assert.equal(chair.classSnapshot,'QA');assert.equal(chair.photoUrl,input.chair.photoUrl);
  assert.equal(vice.nameSnapshot,'New vice master');assert.equal(vice.classSnapshot,'New class');
  const current=expected(edited),auditCount=await prisma.votingAuditEvent.count();
  for(const field of ['chairPhotoUrl','viceChairPhotoUrl']) {
    const stale={...current,[field]:null};
    await assert.rejects(saveCandidatePair(p.id,{...input,vision:'Stale edit'},'actor',candidate.id,stale),{code:'STALE_CANDIDATE'});
    await assert.rejects(deleteCandidatePair(p.id,candidate.id,'actor',stale),{code:'STALE_CANDIDATE'});
  }
  await assert.rejects(saveCandidatePair(p.id,{...input,chair:{studentId:randomUUID()}},'actor',candidate.id,current),{code:'INVALID_STUDENT'});
  await assert.rejects(saveCandidatePair(p.id,{...input,chair:{...input.chair,photoUrl:'/api/image/unregistered.jpg'}},'actor',candidate.id,current),{code:'INVALID_PHOTO'});
  await assert.rejects(saveCandidatePair(p.id,{...input,ballotNumber:2},'actor'),{code:'P2002'});
  assert.equal(await prisma.votingAuditEvent.count(),auditCount);assert.deepEqual(await read(),edited);
  await saveCandidatePair(p.id,{...input,chair:{studentId:p.students[1].id,photoUrl:null},viceChair:null},'actor',candidate.id,current);
  const single=await read();assert.equal(single.members.length,1);assert.equal(single.members[0].nameSnapshot,'New vice master');assert.equal(single.members[0].photoUrl,null);
  await prisma.electionPeriod.update({where:{id:p.id},data:{opensAt:new Date(Date.now()-1)}});
  const finalAudit=await prisma.votingAuditEvent.count();
  await assert.rejects(saveCandidatePair(p.id,{...input,viceChair:null},'actor',candidate.id,expected(single)),{code:'CANDIDATES_LOCKED'});
  await assert.rejects(deleteCandidatePair(p.id,candidate.id,'actor',expected(single)),{code:'CANDIDATES_LOCKED'});
  assert.equal(await prisma.votingAuditEvent.count(),finalAudit);assert.deepEqual(await read(),single);
});

test('failed candidate audit rolls back metadata and members together', async () => {
  const p=await setup(5,2,false),candidate=p.candidates.find(c=>c.organization==='OSIS')!;
  const before=await prisma.candidateMember.findMany({where:{candidatePairId:candidate.id}});
  const count=await prisma.votingAuditEvent.count();
  await pg.exec(`CREATE FUNCTION fail_candidate_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event='CANDIDATE_UPDATED' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fail_candidate_audit BEFORE INSERT ON "VotingAuditEvent" FOR EACH ROW EXECUTE FUNCTION fail_candidate_audit();`);
  await assert.rejects(saveCandidatePair(p.id,{organization:'OSIS',ballotNumber:2,chair:{studentId:p.students[1].id},viceChair:null,vision:'Changed',mission:'Changed'},'actor',candidate.id,
    {ballotNumber:1,chairStudentId:p.students[0].id,viceChairStudentId:null,chairPhotoUrl:null,viceChairPhotoUrl:null,vision:'Vision',mission:'Mission'}));
  assert.deepEqual(await prisma.candidateMember.findMany({where:{candidatePairId:candidate.id}}),before);
  assert.deepEqual(await prisma.candidatePair.findUniqueOrThrow({where:{id:candidate.id}}),candidate);
  assert.equal(await prisma.votingAuditEvent.count(),count);
});

test('paired candidacy and teacher voting follow the attached snapshot after the master mode changes', async () => {
  const p=await setup(5,2,false),candidate=p.candidates.find(c=>c.organization==='OSIS')!;
  await services.updateElectionType('OSIS',{candidateMode:'SINGLE',viceChairLabel:null,expectedRevision:0},'actor');
  await saveCandidatePair(p.id,{organization:'OSIS',ballotNumber:1,chair:{studentId:p.students[0].id},viceChair:{studentId:p.students[1].id},vision:'Vision',mission:'Mission'},'actor',candidate.id,
    {ballotNumber:1,chairStudentId:p.students[0].id,viceChairStudentId:null,chairPhotoUrl:null,viceChairPhotoUrl:null,vision:'Vision',mission:'Mission'});
  await prisma.electionPeriod.update({where:{id:p.id},data:{opensAt:new Date(Date.now()-60000)}});
  const voter=p.voters.find(v=>v.voterType==='TEACHER')!;
  const data=await getOrganizationCandidates(p.id,'synthetic-period',voter.id,'OSIS');
  assert.equal(data.contests.find(c=>c.organization==='OSIS')!.candidateMode,'OPTIONAL_VICE');
  assert.equal(data.candidates[0].members.length,2);
  const session=await login(p.id,voter);if(session.complete)throw Error('missing session');
  await submitVote(session.sessionId,voter.id,p.id,{organization:'OSIS',candidateId:candidate.id});
  const ballot=await prisma.ballot.findFirstOrThrow();assert.deepEqual(Object.keys(ballot).sort(),['candidateId','id','organization','periodId']);
  assert.equal(ballot.candidateId,candidate.id);assert.equal(await prisma.voterParticipation.count({where:{voterId:voter.id,hasVoted:true}}),1);
});

test('PIN reset permits four of five completed rights, revokes old session, but rejects five of five',async()=>{
  const p=await setup(),voter=p.voters[0],first=await login(p.id,voter);if(first.complete)throw Error('missing session');
  for(const code of p.codes.slice(0,4))await submitVote(first.sessionId,voter.id,p.id,{organization:code,candidateId:p.candidates.find(c=>c.organization===code)!.id});
  const request={mode:'reset' as const,reasonCode:'LOST_SLIP',adminPassword:'synthetic-password',targets:[{voterId:voter.id,pinVersion:1}]};
  const slips=await issuePins(p.id,request,'actor');assert.equal(slips.length,1);
  assert.equal(await prisma.votingSession.count({where:{id:first.sessionId}}),0);
  const resumed=await authenticateVoter(p.id,voter.nisn??voter.loginCode!,slips[0].pin,voter.voterType);if(resumed.complete)throw Error('missing resumed session');
  assert.equal((await submitVote(resumed.sessionId,voter.id,p.id,{organization:p.codes[4],candidateId:p.candidates.find(c=>c.organization===p.codes[4])!.id})).complete,true);
  await assert.rejects(issuePins(p.id,{...request,targets:[{voterId:voter.id,pinVersion:2}]},'actor'),{code:'COMPLETED_VOTER'});
  assert.equal((await prisma.electionVoter.findUniqueOrThrow({where:{id:voter.id}})).pinVersion,2);
  assert.equal(await prisma.ballot.count(),5);
});

test('idle and absolute expiration fail closed and preserve anonymous ballots',async()=>{
  const p=await setup(),voter=p.voters[0];
  for(const absolute of [false,true]){
    const session=await login(p.id,voter);if(session.complete)throw Error('missing session');
    await prisma.votingSession.update({where:{id:session.sessionId},data:absolute?{createdAt:new Date(Date.now()-16*60000)}:{expiresAt:new Date(Date.now()-1000)}});
    const stored=await prisma.votingSession.findUniqueOrThrow({where:{id:session.sessionId}});
    assert.equal(await getStudentVotingStatus({...stored,periodId:p.id}),null);
    await assert.rejects(submitVote(session.sessionId,voter.id,p.id,{organization:p.codes[0],candidateId:p.candidates.find(c=>c.organization===p.codes[0])!.id}),{code:'UNAUTHENTICATED'});
    assert.equal(await prisma.votingSession.count({where:{id:session.sessionId}}),0);
  }
  assert.equal(await prisma.ballot.count(),0);
});

test('real middleware and vote endpoint use dynamic rights, bound CSRF and revoke the final cookie',async()=>{
  const p=await setup(1),voter=p.voters[0],session=await login(p.id,voter);if(session.complete)throw Error('missing session');
  const visit=async(path:string,mutation=false,csrf=true)=>{
    const context=createContext({request:new Request('http://localhost:4321'+path,{method:mutation?'POST':'GET',headers:{Cookie:VOTING_SESSION_COOKIE+'='+session.token,
      ...(mutation?{Origin:'http://localhost:4321','Content-Type':'application/json',...(csrf?{'X-CSRF-Token':createStudentSessionCsrfToken(secret,session.sessionId)}:{})}:{})},
      ...(mutation?{body:JSON.stringify({organization:p.codes[0],candidateId:p.candidates[0].id})}:{})}),params:{periodId:p.id}});
    const response=await onRequest(context,()=>mutation?voteEndpoint!(context):Promise.resolve(new Response('private')));
    return {response,context};
  };
  assert.equal((await visit('/siswa')).response.status,200);
  assert.equal((await visit('/pemilih')).response.status,403);assert.equal((await visit('/siswa/nilai')).response.status,403);
  assert.equal((await visit('/api/admin/e-voting/types')).response.status,401);
  const path='/api/e-voting/'+p.id+'/votes';
  assert.equal((await visit(path,true,false)).response.status,403);assert.equal(await prisma.ballot.count(),0);
  const {response,context}=await visit(path,true);
  assert.equal(response.status,201);assert.match(response.headers.get('Cache-Control')!,/no-store/);
  const payload=await response.json();assert.equal(payload.data.complete,true);assert.equal(payload.data.redirectTo,'/siswa/selesai');
  conforms('VoteRecorded',payload.data);assert.equal(await prisma.votingSession.count({where:{voterId:voter.id}}),0);
  const cleared=[...context.cookies.headers()].find(value=>value.startsWith(VOTING_SESSION_COOKIE+'='));
  assert.ok(cleared);assert.ok(Date.parse(cleared.match(/expires=([^;]+)/i)![1])<Date.now());assert.equal(context.cookies.get(VOTING_SESSION_COOKIE),undefined);
  assert.equal((await visit(path,true)).response.status,401);assert.equal(await prisma.ballot.count(),1);
});

test('close API accepts complete/partial/absent turnout, revokes only its sessions, audits once and keeps results private',async()=>{
  const p=await setup(5,3),before=await prisma.electionPeriod.findUniqueOrThrow({where:{id:p.id}});
  await prisma.accountRole.create({data:{accountId:'actor',role:'superadmin'}});
  for(const [index,voter]of p.voters.entries()){
    const session=await login(p.id,voter);if(session.complete)throw Error('missing session');
    for(const code of p.codes.slice(0,index===0?5:index===1?2:0))await submitVote(session.sessionId,voter.id,p.id,{organization:code,candidateId:p.candidates.find(c=>c.organization===code)!.id});
  }
  const sessions=await prisma.votingSession.findMany();assert.equal(sessions.length,2);
  const request={adminPassword:'synthetic-password',early:true,reason:'  Keputusan panitia karena pemilih absen  '};conforms('CloseInput',request);
  const response=await closeRequest(p.id,request);assert.equal(response.status,200,await response.clone().text());
  assert.match(response.headers.get('Cache-Control')!,/no-store/);conforms('Closed',(await response.json()).data);
  const closed=await prisma.electionPeriod.findUniqueOrThrow({where:{id:p.id}}),snapshot=closed.resultSnapshot as any;
  assert.equal(closed.state,'CLOSED');assert.equal(closed.publishedAt,null);assert.deepEqual(closed.closesAt,before.closesAt);
  assert.deepEqual([snapshot.eligibleVoters,snapshot.complete,snapshot.partial,snapshot.notStarted],[3,1,1,1]);
  assert.deepEqual(snapshot.contests.map((c:any)=>c.votesCast),[2,2,1,1,1]);assert.equal(await prisma.ballot.count(),7);assert.equal(await prisma.electionVoter.count(),3);
  assert.equal(await prisma.votingSession.count(),0);assert.equal(await getPublishedResult({id:p.id}),null);
  const audit=await prisma.votingAuditEvent.findFirstOrThrow({where:{event:'PERIOD_CLOSED'}});
  assert.equal(audit.reasonCode,'COMMITTEE_EARLY_CLOSE');assert.equal((audit.detail as any).reason,request.reason.trim());
  assert.doesNotMatch(JSON.stringify(audit.detail),/password|synthetic-password|voterId|studentId|teacherId|nisn/);
  const checkpoint=statements.length;
  assert.equal((await closeRequest(p.id,{adminPassword:'synthetic-password'})).status,200);
  assert.deepEqual(await prisma.electionPeriod.findUniqueOrThrow({where:{id:p.id}}),closed);
  assert.equal(await prisma.votingAuditEvent.count({where:{event:'PERIOD_CLOSED'}}),1);
  assert.ok(!statements.slice(checkpoint).some(sql=>sql.includes('FROM "Ballot"')));
  assert.equal((await closeRequest(p.id,{...request,adminPassword:'wrong-password'})).status,401);
  await assert.rejects(submitVote(sessions[0].id,sessions[0].voterId,p.id,{organization:p.codes[2],candidateId:p.candidates.find(c=>c.organization===p.codes[2])!.id}),{code:'UNAUTHENTICATED'});
  assert.equal(await prisma.ballot.count(),7);assert.equal(await getPublishedResult({id:p.id}),null);
  assert.ok(statements.some(sql=>sql.includes('FOR SHARE')));assert.ok(statements.some(sql=>sql.includes('FOR UPDATE')));
});

test('close API denies missing/revoked permissions, PIN realm, CSRF, bad origins and malformed bodies before mutation',async()=>{
  const p=await setup(),request={adminPassword:'synthetic-password',early:true,reason:'Keputusan panitia sesuai berita acara'};
  await prisma.accountRole.create({data:{accountId:'actor',role:'superadmin'}});
  const reject=async(body:unknown,settings:any,status:number,code:string)=>{
    const response=await closeRequest(p.id,body,settings);assert.equal(response.status,status,await response.clone().text());assert.equal((await response.json()).error.code,code);
  };
  await reject(request,{csrf:'wrong'},403,'CSRF_REJECTED');await reject(request,{origin:'https://foreign.example'},403,'CSRF_REJECTED');
  await reject(request,{cookie:VOTING_SESSION_COOKIE+'=synthetic-pin-cookie'},401,'UNAUTHORIZED');
  await prisma.accountOverride.create({data:{accountId:'actor',capability:'evoting.tutup',effect:'revoke'}});
  await reject(request,{},403,'FORBIDDEN');await prisma.accountOverride.deleteMany();
  await reject({...request,reason:' '},{},400,'INVALID_INPUT');await reject({...request,force:true},{},400,'INVALID_INPUT');
  await reject(request,{raw:'{'},400,'INVALID_INPUT');await reject(request,{raw:'x'.repeat(16385)},413,'BODY_TOO_LARGE');await reject(request,{contentType:'text/plain'},415,'UNSUPPORTED_MEDIA_TYPE');
  assert.equal(await prisma.votingRateBucket.count(),0);assert.equal(await prisma.votingAuditEvent.count({where:{event:'PERIOD_CLOSED'}}),0);
  assert.equal((await prisma.electionPeriod.findUniqueOrThrow({where:{id:p.id}})).state,'SCHEDULED');
});

test('close reauthentication limiter is durable and never closes on wrong password or throttling',async()=>{
  const p=await setup();await prisma.accountRole.create({data:{accountId:'actor',role:'superadmin'}});
  const request={adminPassword:'wrong-password',early:true,reason:'Keputusan panitia sesuai berita acara'};
  for(let i=0;i<5;i++)assert.equal((await closeRequest(p.id,request)).status,401);
  const limited=await closeRequest(p.id,{...request,adminPassword:'synthetic-password'});assert.equal(limited.status,429);assert.equal((await limited.json()).error.code,'RATE_LIMITED');
  assert.equal((await prisma.electionPeriod.findUniqueOrThrow({where:{id:p.id}})).closedAt,null);assert.equal(await prisma.votingAuditEvent.count({where:{event:'PERIOD_CLOSED'}}),0);
});

test('closing before a delayed vote prevents any new ballot and zero turnout remains valid',async()=>{
  const p=await setup(1),voter=p.voters[0],session=await login(p.id,voter);if(session.complete)throw Error('missing session');
  await prisma.accountRole.create({data:{accountId:'actor',role:'superadmin'}});
  const response=await closeRequest(p.id,{adminPassword:'synthetic-password',early:true,reason:'Pemilih tidak hadir sesuai berita acara'});assert.equal(response.status,200);
  await assert.rejects(submitVote(session.sessionId,voter.id,p.id,{organization:p.codes[0],candidateId:p.candidates[0].id}),{code:'UNAUTHENTICATED'});
  const snapshot=(await prisma.electionPeriod.findUniqueOrThrow({where:{id:p.id}})).resultSnapshot as any;
  conforms('ResultSnapshot',snapshot);assert.equal(snapshot.notStarted,2);assert.equal(snapshot.contests[0].votesCast,0);assert.equal(snapshot.contests[0].candidates[0].votes,0);assert.equal(await prisma.ballot.count(),0);
});

test('media deletion preserves current logos, historical contest snapshots and candidate photos using real SQL',async()=>{
  const logo='/api/image/qa/logo.webp',photo='/api/image/qa/photo.webp';
  const logoMedia=await prisma.media.create({data:{url:logo,filename:'logo.png',kind:'image'}});
  const photoMedia=await prisma.media.create({data:{url:photo,filename:'photo.jpg',kind:'image'}});
  await services.updateElectionType('OSIS',{logoUrl:logo,expectedRevision:0},'actor','http://localhost:4321');
  await assert.rejects(deleteMedia(logoMedia.id,'http://localhost:4321'),MediaInUseError);
  const p=await setup(5,2,false),candidate=p.candidates.find(c=>c.organization==='OSIS')!;
  await services.updateElectionType('OSIS',{logoUrl:null,expectedRevision:1},'actor');
  await assert.rejects(deleteMedia(logoMedia.id,'http://localhost:4321'),MediaInUseError);
  await saveCandidatePair(p.id,{organization:'OSIS',ballotNumber:1,chair:{studentId:p.students[0].id,photoUrl:photo},viceChair:null,vision:'Vision',mission:'Mission'},'actor',candidate.id,
    {ballotNumber:1,chairStudentId:p.students[0].id,viceChairStudentId:null,chairPhotoUrl:null,viceChairPhotoUrl:null,vision:'Vision',mission:'Mission'});
  await assert.rejects(deleteMedia(photoMedia.id,'http://localhost:4321'),MediaInUseError);
  assert.equal(await prisma.media.count(),2);
  assert.ok(statements.some(sql=>sql.includes('FROM "Media"')&&sql.includes('FOR SHARE')));
  assert.ok(statements.some(sql=>sql.includes('FROM "Media"')&&sql.includes('FOR UPDATE')));
  assert.deepEqual(await deleteMedia('nonexistent','http://localhost:4321'),{storageDeleted:true});
});

test('internal results require current view/result permissions and a closed state, without reading a live tally',async()=>{
  const p=await setup(1);await prisma.accountRole.create({data:{accountId:'actor',role:'superadmin'}});
  const visit=async(id=p.id,cookie='smkdh_token='+adminToken)=>{
    const context=createContext({request:new Request('http://localhost:4321/api/admin/e-voting/'+id+'/results',{headers:{Cookie:cookie}}),params:{periodId:id}});
    const start=statements.length,response=await onRequest(context,()=>internalResultsEndpoint!(context));
    assert.match(response.headers.get('Cache-Control')!,/private, no-store/);
    assert.ok(!statements.slice(start).some(sql=>/FROM "(?:Ballot|Student|Teacher|CandidatePair|ElectionType|ElectionVoter|VoterParticipation)"/.test(sql)));
    return response;
  };
  const unavailable=await visit();assert.equal(unavailable.status,409);assert.equal((await unavailable.json()).error.code,'RESULTS_NOT_AVAILABLE');
  const draft=await services.createPeriod({slug:'unpublished-draft',name:'Draft fixture',academicYear:'2026/2027',isTest:true,opensAt:new Date(Date.now()+86400000),closesAt:new Date(Date.now()+172800000),organizations:['OSIS']},'actor');
  assert.equal((await visit(draft.id)).status,409);
  assert.equal((await visit(p.id,VOTING_SESSION_COOKIE+'=synthetic-pin-session')).status,401);
  await prisma.accountOverride.create({data:{accountId:'actor',capability:'evoting.hasil',effect:'revoke'}});
  assert.equal((await visit()).status,403);await prisma.accountOverride.deleteMany();
  await prisma.accountOverride.create({data:{accountId:'actor',capability:'evoting.lihat',effect:'revoke'}});
  assert.equal((await visit()).status,403);await prisma.accountOverride.deleteMany();
  await prisma.$transaction(tx=>closePeriodTransaction(tx,p.id,'actor',true,'Pemilih absen sesuai keputusan panitia'));
  const closed=await visit();assert.equal(closed.status,200);const data=(await closed.json()).data;conforms('ResultSnapshot',data);
  assert.equal(data.notStarted,2);assert.doesNotMatch(JSON.stringify(data),/studentId|teacherId|voterId|nisn|pinHash/);
  assert.equal(await getPublishedResult({id:p.id}),null);
  await prisma.electionPeriod.update({where:{id:p.id},data:{state:'ARCHIVED'}});
  const archived=await visit();assert.equal(archived.status,200);assert.deepEqual((await archived.json()).data,data);
  assert.equal((await visit(randomUUID())).status,404);
  await prisma.account.update({where:{id:'actor'},data:{active:false}});assert.equal((await visit()).status,401);
});

test('internal results reject corrupt snapshots and storage failures without exposing database details',async()=>{
  const p=await setup(1);await prisma.accountRole.create({data:{accountId:'actor',role:'superadmin'}});
  await prisma.$transaction(tx=>closePeriodTransaction(tx,p.id,'actor',true,'Pemilih absen sesuai keputusan panitia'));
  const visit=async()=>{const context=createContext({request:new Request('http://localhost:4321/api/admin/e-voting/'+p.id+'/results',{headers:{Cookie:'smkdh_token='+adminToken}}),params:{periodId:p.id}});return onRequest(context,()=>internalResultsEndpoint!(context));};
  await pg.exec('SAVEPOINT corrupt_fixture; ALTER TABLE "ElectionPeriod" DISABLE TRIGGER "ElectionPeriod_protect_identity"');
  await pg.query('UPDATE "ElectionPeriod" SET "resultSnapshot"=$1::jsonb WHERE id=$2',[JSON.stringify({version:2,privateDebug:'do-not-expose'}),p.id]);
  const corrupt=await visit();assert.equal(corrupt.status,503);assert.deepEqual(await corrupt.json(),{error:{code:'TEMPORARILY_UNAVAILABLE'}});
  await pg.exec('ROLLBACK TO SAVEPOINT corrupt_fixture; ALTER TABLE "ElectionPeriod" RENAME TO "UnavailableElectionFixture"');
  const failed=await visit();assert.equal(failed.status,503);assert.deepEqual(await failed.json(),{error:{code:'TEMPORARILY_UNAVAILABLE'}});
});

test('publication input errors use400/413/415 before reauthentication or database mutations',async()=>{
  const p=await setup(1);await prisma.accountRole.create({data:{accountId:'actor',role:'superadmin'}});
  for(const [body,type,status]of [['{','application/json',400],['x'.repeat(16385),'application/json',413],['{}','text/plain',415],[JSON.stringify({adminPassword:'synthetic-password',force:true}),'application/json',400]] as const){
    const context=createContext({request:new Request('http://localhost:4321/api/admin/e-voting/'+p.id+'/publish',{method:'POST',headers:{Cookie:'smkdh_token='+adminToken,Origin:'http://localhost:4321','Content-Type':type,'X-CSRF-Token':csrfHeader('actor',adminToken)},body}),params:{periodId:p.id}});
    assert.equal((await onRequest(context,()=>publishEndpoint!(context))).status,status);
  }
  assert.equal(await prisma.votingRateBucket.count(),0);assert.equal(await prisma.votingAuditEvent.count({where:{event:'PERIOD_PUBLISHED'}}),0);
});

test('publication limiter returns429 after five wrong-password401 responses without publishing',async()=>{
  const p=await setup(1);await prisma.accountRole.create({data:{accountId:'actor',role:'superadmin'}});
  await prisma.$transaction(tx=>closePeriodTransaction(tx,p.id,'actor',true,'Pemilih absen sesuai keputusan panitia'));
  const visit=async(password:string)=>{const context=createContext({request:new Request('http://localhost:4321/api/admin/e-voting/'+p.id+'/publish',{method:'POST',headers:{Cookie:'smkdh_token='+adminToken,Origin:'http://localhost:4321','Content-Type':'application/json','X-CSRF-Token':csrfHeader('actor',adminToken)},body:JSON.stringify({adminPassword:password})}),params:{periodId:p.id}});return onRequest(context,()=>publishEndpoint!(context));};
  for(let i=0;i<5;i++)assert.equal((await visit('wrong-password')).status,401);
  const limited=await visit('synthetic-password');assert.equal(limited.status,429);assert.equal((await limited.json()).error.code,'RATE_LIMITED');
  assert.equal(await getPublishedResult({id:p.id}),null);assert.equal(await prisma.votingAuditEvent.count({where:{event:'PERIOD_PUBLISHED'}}),0);
});

test('publication API enforces current permissions, CSRF, state and password before exposing the snapshot and audits once',async()=>{
  const p=await setup(1);
  const visit=async(password='synthetic-password',csrf=csrfHeader('actor',adminToken))=>{
    const context=createContext({request:new Request('http://localhost:4321/api/admin/e-voting/'+p.id+'/publish',{method:'POST',
      headers:{Cookie:'smkdh_token='+adminToken,Origin:'http://localhost:4321','Content-Type':'application/json','X-CSRF-Token':csrf},
      body:JSON.stringify({adminPassword:password})}),params:{periodId:p.id}});
    return onRequest(context,()=>publishEndpoint!(context));
  };
  await prisma.accountRole.create({data:{accountId:'actor',role:'guru'}});
  assert.equal((await visit()).status,403);
  await prisma.accountRole.deleteMany();await prisma.accountRole.create({data:{accountId:'actor',role:'superadmin'}});
  const unavailable=await visit();assert.equal(unavailable.status,409);assert.equal((await unavailable.json()).error.code,'INVALID_STATE');
  await prisma.$transaction(tx=>closePeriodTransaction(tx,p.id,'actor',true,'Keputusan panitia sesuai berita acara'));
  assert.equal((await visit('synthetic-password','wrong-csrf')).status,403);
  const wrong=await visit('wrong-password');assert.equal(wrong.status,401);assert.equal((await wrong.json()).error.code,'INVALID_REAUTH');
  assert.equal(await getPublishedResult({id:p.id}),null);assert.equal(await prisma.votingAuditEvent.count({where:{event:'PERIOD_PUBLISHED'}}),0);
  const published=await visit();assert.equal(published.status,200);assert.match(published.headers.get('Cache-Control')!,/no-store/);
  const timestamp=(await published.json()).data.publishedAt;
  assert.ok(await getPublishedResult({id:p.id}));
  const repeated=await visit();assert.equal(repeated.status,200);assert.equal((await repeated.json()).data.publishedAt,timestamp);
  assert.equal(await prisma.votingAuditEvent.count({where:{event:'PERIOD_PUBLISHED'}}),1);
  await prisma.accountOverride.create({data:{accountId:'actor',capability:'evoting.publikasi',effect:'revoke'}});
  assert.equal((await visit()).status,403);assert.equal(await prisma.votingAuditEvent.count({where:{event:'PERIOD_PUBLISHED'}}),1);
});

test('anonymous result API requires official publication and serves immutable historical data for closed and archived periods',async()=>{
  const p=await setup(),voter=p.voters[0],session=await login(p.id,voter);if(session.complete)throw Error('missing session');
  const visit=async(id=p.id)=>{
    const context=createContext({request:new Request('http://localhost:4321/api/e-voting/'+id+'/results'),params:{periodId:id}});
    const start=statements.length;
    const response=await onRequest(context,()=>publicResultsEndpoint!(context));
    assert.match(response.headers.get('Cache-Control')!,/private, no-store/);
    assert.ok(!statements.slice(start).some(sql=>/FROM "(?:Ballot|Student|Teacher|CandidatePair|ElectionType)"/.test(sql)));
    return response;
  };
  assert.equal((await visit()).status,404);
  await submitVote(session.sessionId,voter.id,p.id,{organization:p.codes[0],candidateId:p.candidates.find(c=>c.organization===p.codes[0])!.id});
  await prisma.$transaction(tx=>closePeriodTransaction(tx,p.id,'actor',true,'Keputusan panitia sesuai berita acara'));
  assert.equal((await visit()).status,404);
  const beforePublication = await listPeriods();
  assert.equal(beforePublication.find(period=>period.id===p.id)?.publishedAt,null);
  await publishPeriod(p.id,'actor','synthetic-password');
  const listStart = statements.length;
  const listed = (await listPeriods()).find(period=>period.id===p.id)!;
  assert.ok(listed.publishedAt instanceof Date);assert.equal(listed.state,'CLOSED');
  assert.ok(!('resultSnapshot' in listed));
  assert.ok(!statements.slice(listStart).some(sql=>/resultSnapshot|FROM "(?:Ballot|Student|Teacher|CandidatePair|ElectionType)"/.test(sql)));
  const response=await visit();assert.equal(response.status,200);const published=(await response.json()).data;conforms('PublicResults',published);
  assert.equal(published.result.partial,1);assert.equal(published.result.notStarted,1);assert.equal(published.result.contests[0].votesCast,1);
  assert.doesNotMatch(JSON.stringify(published),/studentId|teacherId|voterId|nisn|pinHash|voterType|byType|GURU-/);
  await prisma.student.updateMany({data:{name:'Changed live Student',className:'Changed live class'}});
  await services.updateElectionType('OSIS',{name:'Changed live master',active:false,expectedRevision:0},'actor');
  await prisma.electionPeriod.update({where:{id:p.id},data:{state:'ARCHIVED'}});
  const archivedList = (await listPeriods()).find(period=>period.id===p.id)!;
  assert.equal(archivedList.state,'ARCHIVED');assert.deepEqual(archivedList.publishedAt,listed.publishedAt);
  const archived=await visit();assert.equal(archived.status,200);assert.deepEqual((await archived.json()).data,published);
  assert.equal((await visit(randomUUID())).status,404);assert.equal((await visit('invalid-id')).status,403);
});
