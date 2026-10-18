import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '@prisma/client';
import bcrypt from 'bcryptjs';

const connection=process.env.SMKDH_TEST_DATABASE_URL;
if(!connection)test('real PostgreSQL concurrency (run scripts/test-voting-postgres.mjs)',{skip:'requires explicitly isolated local PostgreSQL'},()=>{});
else{
 let target:URL;try{target=new URL(connection);}catch{throw Error('Invalid isolated test database configuration');}
 if(target.hostname!=='127.0.0.1'||target.pathname!=='/smkdh_voting_t11_only')throw Error('Concurrency tests require the exact isolated local target');
 const pool=new pg.Pool({connectionString:connection,max:12,application_name:'smkdh-t11-isolated',connectionTimeoutMillis:5000});
 const prisma=new PrismaClient({adapter:new PrismaPg(pool)});
 const globals=globalThis as typeof globalThis & {realPgVotingDb?:typeof prisma};globals.realPgVotingDb=prisma;
 register('data:text/javascript,'+encodeURIComponent(`
  const mod=s=>({url:'data:text/javascript,'+encodeURIComponent(s),shortCircuit:true});
  export function resolve(s,c,next){if(s.startsWith('.')){const p=new URL(s,c.parentURL).pathname;
   if(p.endsWith('/lib/prisma')||p.endsWith('/lib/prisma.ts'))return mod('export const db=globalThis.realPgVotingDb');
   if(p.endsWith('/lib/env')||p.endsWith('/lib/env.ts'))return mod("export const env=()=>undefined;export const requireEnv=()=> 'synthetic-concurrency-secret-'.repeat(3)");
   if(p.endsWith('/lib/r2')||p.endsWith('/lib/r2.ts'))return mod('export const deleteFromR2=async()=>{}');
  }return next(s,c)}
 `),import.meta.url);
 const {createPeriod,createElectionType}=await import('./election-types');
 const {deleteMedia}=await import('../media-delete');
 const {syncMasterRoster}=await import('./voters');const {saveCandidatePair}=await import('./candidates');
 const {schedulePeriod,closePeriod}=await import('./periods');const {authenticateVoter}=await import('./student-auth');
 const {pinHashMaterial}=await import('./pin-input');const {submitVote}=await import('./votes');
 const password='synthetic-admin-password',pin='0011223344';
 let migrations:string[]=[];
 before(async()=>{
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name,'smkdh_voting_t11_only');
  const root=new URL('../../../prisma/migrations/',import.meta.url);
  for(const e of (await readdir(root,{withFileTypes:true})).filter(e=>e.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name)))migrations.push(await readFile(new URL(e.name+'/migration.sql',root),'utf8'));
 });
 beforeEach(async()=>{
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');for(const sql of migrations)await pool.query(sql);
  await prisma.account.create({data:{id:'qa-actor',email:'qa@example.test',passwordHash:await bcrypt.hash(password,4)}});
  await prisma.department.create({data:{id:'qa-dept',slug:'qa-dept',name:'QA',description:'Synthetic',kompetensi:'[]',karir:'[]'}});
  await prisma.schoolClass.create({data:{id:'qa-class',academicYear:'2026/2027',name:'QA',departmentId:'qa-dept'}});
 });
 after(async()=>{await prisma.$disconnect();await pool.end();delete globals.realPgVotingDb;});
 async function setup(count=2){
  const now=Date.now(),p=await createPeriod({slug:'isolated-concurrency',name:'Synthetic concurrency',academicYear:'2026/2027',isTest:true,opensAt:new Date(now+86400000),closesAt:new Date(now+172800000),organizations:['OSIS']},'qa-actor');
  const students=[];for(let i=0;i<count;i++)students.push(await prisma.student.create({data:{nisn:String(9900000000+i),name:'QA '+i,className:'QA',schoolClassId:'qa-class'}}));
  await syncMasterRoster(p.id,'qa-actor',students.map(s=>s.id));
  const candidate=await saveCandidatePair(p.id,{organization:'OSIS',ballotNumber:1,chair:{studentId:students[0].id},viceChair:null,vision:'Vision',mission:'Mission'},'qa-actor');
  const voters=await prisma.electionVoter.findMany({where:{periodId:p.id}});
  for(const voter of voters)await prisma.electionVoter.update({where:{id:voter.id},data:{pinHash:await bcrypt.hash(pinHashMaterial('synthetic-concurrency-secret-'.repeat(3),p.id,voter.nisn!,pin),4),pinFingerprint:randomUUID().replaceAll('-','').repeat(2),credentialEnabled:true,pinVersion:1}});
  await schedulePeriod(p.id,'qa-actor');await prisma.electionPeriod.update({where:{id:p.id},data:{opensAt:new Date(Date.now()-60000)}});
  return {id:p.id,voters,candidate};
 }
 async function session(p:Awaited<ReturnType<typeof setup>>,index=0){const s=await authenticateVoter(p.id,p.voters[index].nisn!,pin,'STUDENT');if(s.complete)throw Error('Missing test voting session');return s;}
 async function blocked(fragment:string){
  for(let i=0;i<100;i++){
   const {rows}=await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND application_name='smkdh-t11-isolated' AND wait_event_type='Lock' AND query LIKE $1",['%'+fragment+'%']);
   if(rows[0].n)return;await new Promise(done=>setTimeout(done,20));
  }throw Error('Expected database lock was not observed: '+fragment);
 }
 const captured=<T>(work:Promise<T>)=>work.then(value=>({ok:true as const,value}),error=>({ok:false as const,error}));
 test('four concurrent logins reserve exactly three global sessions on separate connections',async()=>{
  const p=await setup(4);const results=await Promise.all(p.voters.map(v=>captured(authenticateVoter(p.id,v.nisn!,pin,'STUDENT'))));
  assert.equal(results.filter(r=>r.ok).length,3);assert.equal(results.filter(r=>!r.ok&&r.error.code==='SESSION_CAPACITY').length,1);assert.equal(await prisma.votingSession.count(),3);
 });
 test('two simultaneous final votes record one ballot, one right and revoke the session atomically',async()=>{
  const p=await setup(),s=await session(p),vote=()=>submitVote(s.sessionId,p.voters[0].id,p.id,{organization:'OSIS',candidateId:p.candidate.id});
  const results=await Promise.all([captured(vote()),captured(vote())]);assert.equal(results.filter(r=>r.ok).length,1);
  assert.equal(await prisma.ballot.count(),1);assert.equal(await prisma.voterParticipation.count({where:{hasVoted:true}}),1);assert.equal(await prisma.votingSession.count(),0);
  assert.ok(results.some(r=>!r.ok&&['ALREADY_VOTED','UNAUTHENTICATED'].includes(r.error.code)));
 });
 for(const first of ['vote','close'])test(first+' locks first: concurrent close/vote preserves exactly the acknowledged ballots',async()=>{
  const p=await setup(),s=await session(p),holder=await pool.connect(),key=first==='vote'?1:2;
  await holder.query('SELECT pg_advisory_lock(91827,$1)',[key]);
  try{
   await pool.query(first==='vote'?`CREATE FUNCTION qa_pause_vote() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(91827,1); RETURN NEW; END $$; CREATE TRIGGER qa_pause_vote AFTER INSERT ON "Ballot" FOR EACH ROW EXECUTE FUNCTION qa_pause_vote()`:`CREATE FUNCTION qa_pause_close() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state='CLOSED' THEN PERFORM pg_advisory_xact_lock(91827,2); END IF; RETURN NEW; END $$; CREATE TRIGGER qa_pause_close BEFORE UPDATE ON "ElectionPeriod" FOR EACH ROW EXECUTE FUNCTION qa_pause_close()`);
   const vote=()=>captured(submitVote(s.sessionId,p.voters[0].id,p.id,{organization:'OSIS',candidateId:p.candidate.id}));
   const close=()=>captured(closePeriod(p.id,'qa-actor',password,true,'Synthetic concurrent close verified locally'));
   let v,c;
   if(first==='vote'){v=vote();await blocked('Ballot');c=close();await blocked('FOR UPDATE');}
   else{c=close();await blocked('UPDATE');v=vote();await blocked('FOR SHARE');}
   await holder.query('SELECT pg_advisory_unlock(91827,$1)',[key]);
   const [voteResult,closeResult]=await Promise.all([v!,c!]);assert.equal(closeResult.ok,true);assert.equal(voteResult.ok,first==='vote');
   const period=await prisma.electionPeriod.findUniqueOrThrow({where:{id:p.id}}),snapshot=period.resultSnapshot as any;
   assert.equal(period.state,'CLOSED');assert.equal(period.publishedAt,null);assert.equal(await prisma.ballot.count(),first==='vote'?1:0);assert.equal(snapshot.contests[0].votesCast,first==='vote'?1:0);
   assert.equal(await prisma.votingSession.count(),0);assert.equal(await prisma.votingAuditEvent.count({where:{event:'PERIOD_CLOSED'}}),1);
  }finally{await holder.query('SELECT pg_advisory_unlock_all()');holder.release();}
 });
 for(const first of ['attach','delete'])test(first+' locks media first: concurrent logo creation/deletion never commits a dangling reference',async()=>{
  const media=await prisma.media.create({data:{url:'/api/image/qa/concurrency.webp',filename:'synthetic.webp',kind:'image'}}),holder=await pool.connect();
  await holder.query('SELECT pg_advisory_lock(91828,1)');
  try{
   await pool.query(first==='attach'?`CREATE FUNCTION qa_pause_attach() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(91828,1); RETURN NEW; END $$; CREATE TRIGGER qa_pause_attach BEFORE INSERT ON "ElectionType" FOR EACH ROW EXECUTE FUNCTION qa_pause_attach()`:`CREATE FUNCTION qa_pause_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(91828,1); RETURN OLD; END $$; CREATE TRIGGER qa_pause_delete BEFORE DELETE ON "Media" FOR EACH ROW EXECUTE FUNCTION qa_pause_delete()`);
   const attach=()=>captured(createElectionType({code:'LOCKED_TYPE',name:'Synthetic logo',logoUrl:media.url,candidateMode:'SINGLE',chairLabel:'Ketua',viceChairLabel:null,active:true,sortOrder:6},'qa-actor','http://localhost:4321'));
   const remove=()=>captured(deleteMedia(media.id,'http://localhost:4321'));
   let a,d;
   if(first==='attach'){a=attach();await blocked('INSERT INTO "ElectionType"');d=remove();await blocked('FOR UPDATE');}
   else{d=remove();await blocked('DELETE FROM "Media"');a=attach();await blocked('FOR SHARE');}
   await holder.query('SELECT pg_advisory_unlock(91828,1)');
   const [attached,deleted]=await Promise.all([a!,d!]);
   assert.equal(attached.ok,first==='attach');assert.equal(deleted.ok,first==='delete');
   assert.equal(await prisma.media.count(),first==='attach'?1:0);
   assert.equal(await prisma.electionType.count({where:{code:'LOCKED_TYPE'}}),first==='attach'?1:0);
   if(!attached.ok)assert.equal(attached.error.code,'INVALID_LOGO');
  }finally{await holder.query('SELECT pg_advisory_unlock_all()');holder.release();}
 });
}
