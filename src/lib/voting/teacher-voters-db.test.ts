import {test, before, after, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

const pg = new PGlite();
const legacyPeriod=randomUUID(),legacyStudent=randomUUID(),legacyVoter=randomUUID();
let period: string;
before(async()=>{
  const root=new URL('../../../prisma/migrations/',import.meta.url);
  for(const entry of (await readdir(root,{withFileTypes:true})).filter(item=>item.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))) {
    if(entry.name==='20261016100000_teacher_election_voters') {
      await pg.query(`INSERT INTO "Student" (id,nisn,name,"className") VALUES ($1,'0012345678','Legacy','X')`,[legacyStudent]);
      await pg.query(`INSERT INTO "ElectionPeriod" (id,slug,name,"academicYear","opensAt","closesAt") VALUES ($1,'legacy','Legacy','2026/2027',now()+interval '1 day',now()+interval '2 days')`,[legacyPeriod]);
      await pg.query(`INSERT INTO "ElectionVoter" (id,"periodId","studentId",nisn,name,"className","pinHash","pinFingerprint","pinVersion") VALUES ($1,$2,$3,'0012345678','Legacy','X',$4,$5,3)`,[legacyVoter,legacyPeriod,legacyStudent,'h'.repeat(60),'f'.repeat(64)]);
    }
    await pg.exec(await readFile(new URL(entry.name+'/migration.sql',root),'utf8'));
  }
});
after(()=>pg.close());
beforeEach(async()=>{
  await pg.exec('BEGIN'); period=randomUUID();
  await pg.query(`INSERT INTO "Teacher" (id,name,position) VALUES ('teacher-a','Original Teacher','Guru'),('teacher-b','Teacher B','Guru')`);
  await pg.query(`INSERT INTO "ElectionPeriod" (id,slug,name,"academicYear","isTest","opensAt","closesAt") VALUES ($1,$2,'Mixed test','2026/2027',true,now()+interval '1 day',now()+interval '2 days')`,[period,'mixed-'+period]);
});
afterEach(()=>pg.exec('ROLLBACK'));
async function addTeacher(teacherId='teacher-a',code='GURU-ABCDEF123456') {
  return pg.query(`INSERT INTO "ElectionVoter" (id,"periodId","voterType","teacherId","loginCode",name,"className") VALUES ($1,$2,'TEACHER',$3,$4,'Original Teacher','Guru') RETURNING id`,[randomUUID(),period,teacherId,code]);
}
async function blocked(sql:string,params:unknown[]=[]) {
  await pg.exec('SAVEPOINT rejected');await assert.rejects(pg.query(sql,params));await pg.exec('ROLLBACK TO SAVEPOINT rejected; RELEASE SAVEPOINT rejected');
}
test('migration keeps existing student ownership, PIN hash, fingerprint, version and leading-zero NISN',async()=>{
  const row=(await pg.query<any>('SELECT * FROM "ElectionVoter" WHERE id=$1',[legacyVoter])).rows[0];
  assert.equal(row.voterType,'STUDENT');assert.equal(row.studentId,legacyStudent);assert.equal(row.nisn,'0012345678');
  assert.equal(row.pinHash,'h'.repeat(60));assert.equal(row.pinFingerprint,'f'.repeat(64));assert.equal(row.pinVersion,3);
  assert.equal(row.teacherId,null);assert.equal(row.loginCode,null);
});
test('database enforces exclusive master identity, teacher FK, unique person/code and immutable ownership',async()=>{
  const voter=(await addTeacher()).rows[0];
  await blocked(`INSERT INTO "ElectionVoter" (id,"periodId","voterType",name,"className") VALUES ($1,$2,'TEACHER','Invalid','Guru')`,[randomUUID(),period]);
  await blocked(`INSERT INTO "ElectionVoter" (id,"periodId","voterType","studentId","teacherId","loginCode",nisn,name,"className") VALUES ($1,$2,'TEACHER',$3,'teacher-b','GURU-000000000000','0012345678','Both','Guru')`,[randomUUID(),period,legacyStudent]);
  await blocked(`INSERT INTO "ElectionVoter" (id,"periodId","voterType","teacherId","loginCode",name,"className") VALUES ($1,$2,'TEACHER','missing','GURU-000000000000','Missing','Guru')`,[randomUUID(),period]);
  await blocked(`INSERT INTO "ElectionVoter" (id,"periodId","voterType","teacherId","loginCode",name,"className") VALUES ($1,$2,'TEACHER','teacher-a','GURU-000000000000','Duplicate','Guru')`,[randomUUID(),period]);
  await blocked(`INSERT INTO "ElectionVoter" (id,"periodId","voterType","teacherId","loginCode",name,"className") VALUES ($1,$2,'TEACHER','teacher-b','GURU-ABCDEF123456','Duplicate code','Guru')`,[randomUUID(),period]);
  await blocked(`UPDATE "ElectionVoter" SET "teacherId"='teacher-b' WHERE id=$1`,[voter.id]);
  await blocked(`UPDATE "ElectionVoter" SET "loginCode"='GURU-000000000000' WHERE id=$1`,[voter.id]);
  await blocked(`DELETE FROM "Teacher" WHERE id='teacher-a'`);
});
test('teacher snapshots survive master edits; roster freezes at opening and authorized cleanup preserves both masters',async()=>{
  const voter=(await addTeacher()).rows[0];
  for(const organization of ['OSIS','DEWAN_AMBALAN','IPNU','IPPNU']) {
    await pg.query(`INSERT INTO "ElectionContest" ("periodId",organization) VALUES ($1,$2)`,[period,organization]);
    await pg.query(`INSERT INTO "VoterParticipation" ("voterId","periodId",organization) VALUES ($1,$2,$3)`,[voter.id,period,organization]);
  }
  await pg.exec(`UPDATE "Teacher" SET name='Edited master name' WHERE id='teacher-a'`);
  assert.equal((await pg.query<any>('SELECT name FROM "ElectionVoter" WHERE id=$1',[voter.id])).rows[0].name,'Original Teacher');
  await pg.query(`UPDATE "ElectionPeriod" SET state='SCHEDULED',"opensAt"=now()-interval '1 minute' WHERE id=$1`,[period]);
  await blocked('DELETE FROM "ElectionVoter" WHERE id=$1',[voter.id]);
  await blocked(`INSERT INTO "ElectionVoter" (id,"periodId","voterType","teacherId","loginCode",name,"className") VALUES ($1,$2,'TEACHER','teacher-b','GURU-000000000000','Too late','Guru')`,[randomUUID(),period]);
  await pg.exec(`INSERT INTO "Account" (id,email,"passwordHash") VALUES ('teacher-cleanup','teacher-cleanup@example.test','fixture'); INSERT INTO "AccountRole" (id,"accountId",role) VALUES ('teacher-cleanup-role','teacher-cleanup','superadmin')`);
  const preview=(await pg.query<any>('SELECT evoting_test_cleanup_preview($1) AS data',[period])).rows[0].data;
  const result=(await pg.query<any>('SELECT evoting_delete_test_period($1,$2,$3,$4) AS data',[period,'teacher-cleanup','HAPUS mixed-'+period,preview.version])).rows[0].data;
  assert.equal(result.error,undefined);
  assert.equal((await pg.query('SELECT * FROM "ElectionVoter" WHERE "periodId"=$1',[period])).rows.length,0);
  assert.equal((await pg.query('SELECT * FROM "Teacher"')).rows.length,2);
  assert.equal((await pg.query('SELECT * FROM "Student" WHERE id=$1',[legacyStudent])).rows.length,1);
  assert.equal((await pg.query('SELECT * FROM "VotingAuditEvent" WHERE "periodId"=$1',[period])).rows.length,1);
});

test('expired draft permits roster, unvoted participation removal and candidate edits; scheduled opening still freezes all',async()=>{
  await pg.query(`UPDATE "ElectionPeriod" SET "opensAt"=now()-interval '2 days',"closesAt"=now()-interval '1 day' WHERE id=$1`,[period]);
  const voter=(await addTeacher()).rows[0],candidate=randomUUID();
  for(const organization of ['OSIS','DEWAN_AMBALAN','IPNU','IPPNU']) {
    await pg.query(`INSERT INTO "ElectionContest" ("periodId",organization) VALUES ($1,$2)`,[period,organization]);
    await pg.query(`INSERT INTO "VoterParticipation" ("voterId","periodId",organization) VALUES ($1,$2,$3)`,[voter.id,period,organization]);
  }
  await pg.query(`INSERT INTO "CandidatePair" (id,"periodId",organization,"ballotNumber",vision,mission) VALUES ($1,$2,'OSIS',1,'Vision','Mission')`,[candidate,period]);
  await pg.query(`INSERT INTO "CandidateMember" ("candidatePairId","periodId",organization,"studentId",position,"nameSnapshot","classSnapshot") VALUES ($1,$2,'OSIS',$3,'CHAIR','Legacy','X')`,[candidate,period,legacyStudent]);
  await pg.query(`UPDATE "CandidatePair" SET vision='New vision' WHERE id=$1`,[candidate]);
  await pg.query('DELETE FROM "VoterParticipation" WHERE "voterId"=$1',[voter.id]);
  await pg.query('DELETE FROM "ElectionVoter" WHERE id=$1',[voter.id]);
  const second=(await addTeacher()).rows[0];
  await pg.query(`INSERT INTO "VoterParticipation" ("voterId","periodId",organization,"hasVoted") VALUES ($1,$2,'OSIS',true)`,[second.id,period]);
  await blocked('DELETE FROM "VoterParticipation" WHERE "voterId"=$1',[second.id]);
  await blocked('UPDATE "VoterParticipation" SET "hasVoted"=false WHERE "voterId"=$1',[second.id]);
  await pg.query(`UPDATE "ElectionPeriod" SET state='SCHEDULED',"closesAt"=now()+interval '1 day' WHERE id=$1`,[period]);
  await blocked(`UPDATE "CandidatePair" SET vision='Forbidden' WHERE id=$1`,[candidate]);
  await blocked(`INSERT INTO "ElectionVoter" (id,"periodId","voterType","teacherId","loginCode",name,"className") VALUES ($1,$2,'TEACHER','teacher-b','GURU-000000000000','Too late','Guru')`,[randomUUID(),period]);
});
