import {test, before, after, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {VotingOrganization, type Prisma} from '@prisma/client';
import {closePeriodTransaction} from './period-close';

// Real PostgreSQL aggregates and rollback, with only the Prisma delegates replaced; no environment or Neon access.
const pg = new PGlite();
const periodId = '10000000-0000-4000-8000-000000000010';
const studentIds = [randomUUID(), randomUUID()];
const organizations = Object.values(VotingOrganization);
let queries: string[];

before(async () => {
  const root = new URL('../../../prisma/migrations/', import.meta.url);
  for (const entry of (await readdir(root, {withFileTypes: true})).filter(item => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    await pg.exec(await readFile(new URL(entry.name + '/migration.sql', root), 'utf8'));
  }
});
after(async () => { await pg.close(); });
beforeEach(async () => {
  queries = [];
  await pg.exec('BEGIN');
  await pg.query('INSERT INTO "Account" (id,email,"passwordHash") VALUES ($1,$2,$3)', ['close-admin', 'close@example.test', 'fixture-hash']);
  for (const [index, id] of studentIds.entries()) {
    await pg.query('INSERT INTO "Student" (id,nisn,name,"className") VALUES ($1,$2,$3,$4)', [id, '990000000' + index, 'Synthetic Student ' + index, 'QA']);
  }
});
afterEach(async () => { await pg.exec('ROLLBACK'); });

async function seed(votes = [4, 4], id = periodId, chairOnly = false, teacherIndex = -1) {
  await pg.query(`INSERT INTO "ElectionPeriod" (id,slug,name,"academicYear","opensAt","closesAt")
    VALUES ($1,$2,'Synthetic close test','2026/2027',now()+interval '1 day',now()+interval '2 days')`, [id, 'test-' + id]);
  for (const organization of organizations) {
    const candidateId = randomUUID();
    await pg.query('INSERT INTO "ElectionContest" ("periodId",organization) VALUES ($1,$2)', [id, organization]);
    await pg.query('INSERT INTO "CandidatePair" (id,"periodId",organization,"ballotNumber",vision,mission) VALUES ($1,$2,$3,1,$4,$5)', [candidateId, id, organization, 'Vision', 'Mission']);
    for (const [index, studentId] of studentIds.entries()) {
      if (chairOnly && index === 1) continue;
      await pg.query(`INSERT INTO "CandidateMember" ("candidatePairId","periodId",organization,"studentId",position,"nameSnapshot","classSnapshot")
        VALUES ($1,$2,$3,$4,$5,$6,'QA')`, [candidateId, id, organization, studentId, index ? 'VICE_CHAIR' : 'CHAIR', 'Historical Student ' + index]);
    }
  }
  for (const [index, voteCount] of votes.entries()) {
    const voterId = randomUUID();
    if(index === teacherIndex) {
      await pg.query(`INSERT INTO "Teacher" (id,name,position) VALUES ('close-teacher','Synthetic Teacher','Guru')`);
      await pg.query(`INSERT INTO "ElectionVoter" (id,"teacherId","voterType","periodId","loginCode",name,"className") VALUES ($1,'close-teacher','TEACHER',$2,'GURU-ABCDEF123456','Synthetic Teacher','Guru')`,[voterId,id]);
    } else {
      await pg.query(`INSERT INTO "ElectionVoter" (id,"studentId","periodId",nisn,name,"className") VALUES ($1,$2,$3,$4,$5,'QA')`,
        [voterId, studentIds[index], id, '990000000' + index, 'Synthetic Student ' + index]);
    }
    for (const [orgIndex, organization] of organizations.entries()) {
      const voted = orgIndex < voteCount;
      await pg.query('INSERT INTO "VoterParticipation" ("voterId","periodId",organization,"hasVoted") VALUES ($1,$2,$3,$4)', [voterId, id, organization, voted]);
      if (voted) await pg.query(`INSERT INTO "Ballot" (id,"periodId",organization,"candidateId")
        SELECT $1,$2,$3,id FROM "CandidatePair" WHERE "periodId"=$2 AND organization=$3`, [randomUUID(), id, organization]);
    }
    await pg.query(`INSERT INTO "VotingSession" (id,"voterId","tokenHash","lastSeenAt","expiresAt") VALUES ($1,$2,$3,now(),now()+interval '5 minutes')`, [randomUUID(), voterId, randomUUID().replaceAll('-', '').repeat(2)]);
  }
  if (id === periodId) await pg.query(`UPDATE "ElectionPeriod" SET state='SCHEDULED',"opensAt"=now()-interval '1 hour',"closesAt"=now()+interval '1 hour' WHERE id=$1`, [id]);
  await pg.exec('SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED');
}

// The facade executes the service's tagged SQL unchanged and persists its mutations in the same test transaction.
const tx = {
  $queryRaw: async (strings: TemplateStringsArray, ...params: unknown[]) => {
    const sql = strings.reduce((result, part, index) => result + (index ? '$' + index : '') + part, '');
    queries.push(sql);
    return (await pg.query(sql, params)).rows;
  },
  electionPeriod: {
    findUniqueOrThrow: async ({where}: {where: {id: string}}) => {
      const period = (await pg.query('SELECT * FROM "ElectionPeriod" WHERE id=$1', [where.id])).rows[0];
      const voters = (await pg.query('SELECT id FROM "ElectionVoter" WHERE "periodId"=$1', [where.id])).rows;
      const candidates = (await pg.query<{id: string; organization: string}>('SELECT * FROM "CandidatePair" WHERE "periodId"=$1', [where.id])).rows;
      const members = (await pg.query<{candidatePairId: string}>('SELECT * FROM "CandidateMember" WHERE "periodId"=$1', [where.id])).rows;
      return {...period, voters, contests: organizations.map(organization => ({organization,
        candidates: candidates.filter(item => item.organization === organization).map(candidate => ({...candidate, members: members.filter(member => member.candidatePairId === candidate.id)}))}))};
    },
    update: async ({where, data}: {where: {id: string}; data: {state: string; closedAt: Date; resultSnapshot: unknown}}) =>
      pg.query('UPDATE "ElectionPeriod" SET state=$2,"closedAt"=$3,"resultSnapshot"=$4::jsonb WHERE id=$1', [where.id, data.state, data.closedAt, JSON.stringify(data.resultSnapshot)]),
  },
  account: {findUnique: async ({where}: {where: {id: string}}) => (await pg.query('SELECT active FROM "Account" WHERE id=$1', [where.id])).rows[0]},
  votingSession: {deleteMany: async ({where}: {where: {voter: {periodId: string}}}) =>
    pg.query('DELETE FROM "VotingSession" WHERE "voterId" IN (SELECT id FROM "ElectionVoter" WHERE "periodId"=$1)', [where.voter.periodId])},
  votingAuditEvent: {create: async ({data}: {data: {periodId: string; actorAccountId: string; event: string; targetId: string; reasonCode: string; detail: unknown}}) =>
    pg.query('INSERT INTO "VotingAuditEvent" (id,"periodId","actorAccountId",event,"targetId","reasonCode",detail) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)',
      [randomUUID(), data.periodId, data.actorAccountId, data.event, data.targetId, data.reasonCode, JSON.stringify(data.detail)])},
} as unknown as Prisma.TransactionClient;

async function close(early = true) {
  await pg.exec('SAVEPOINT close_attempt');
  try {
    const result = await closePeriodTransaction(tx, periodId, 'close-admin', early);
    await pg.exec('RELEASE SAVEPOINT close_attempt');
    return result;
  } catch (error) {
    await pg.exec('ROLLBACK TO SAVEPOINT close_attempt; RELEASE SAVEPOINT close_attempt');
    throw error;
  }
}
async function storedPeriod() {
  return (await pg.query<{state: string; closesAt: Date; closedAt: Date | null; publishedAt: Date | null; resultSnapshot: {eligibleVoters: number; complete: number; partial: number; contests: Array<{votesCast: number; candidates: Array<{chair: {name: string}}>}>} | null}>(
    'SELECT * FROM "ElectionPeriod" WHERE id=$1', [periodId])).rows[0];
}
async function assertOpen() {
  const period = await storedPeriod();
  assert.equal(period.state, 'SCHEDULED');
  assert.equal(period.closedAt, null);
  assert.equal(period.resultSnapshot, null);
  assert.equal((await pg.query('SELECT * FROM "VotingAuditEvent"')).rows.length, 0);
}

test('all four votes per voter permit early closure; schedule, master, anonymous ballots and other sessions survive', async () => {
  await seed();
  await seed([0], randomUUID());
  const originalSchedule = (await storedPeriod()).closesAt;
  await pg.query('UPDATE "Student" SET name=$1', ['Changed master name']);
  assert.equal((await close()).state, 'CLOSED');
  const period = await storedPeriod();
  assert.ok(period.closedAt! < period.closesAt);
  assert.deepEqual(period.closesAt, originalSchedule);
  assert.equal(period.publishedAt, null);
  assert.equal(period.resultSnapshot!.eligibleVoters, 2);
  assert.equal(period.resultSnapshot!.complete, 2);
  assert.ok(period.resultSnapshot!.contests.every(contest => contest.votesCast === 2 && contest.candidates[0].chair.name === 'Historical Student 0'));
  assert.equal((await pg.query('SELECT * FROM "Ballot"')).rows.length, 8);
  assert.equal((await pg.query('SELECT * FROM "Student"')).rows.length, 2);
  assert.equal((await pg.query('SELECT * FROM "VotingSession"')).rows.length, 1);
  const audit = (await pg.query<{reasonCode: string; detail: {earlyClose: boolean; scheduledClosesAt: string}}> ('SELECT * FROM "VotingAuditEvent"')).rows[0];
  assert.equal(audit.reasonCode, 'ALL_VOTERS_COMPLETED');
  assert.equal(audit.detail.earlyClose, true);
  assert.equal(audit.detail.scheduledClosesAt, originalSchedule.toISOString());
  await close();
  await pg.query('UPDATE "ElectionPeriod" SET state=$2 WHERE id=$1', [periodId, 'ARCHIVED']);
  assert.equal((await close()).state, 'ARCHIVED');
  assert.equal((await pg.query('SELECT * FROM "VotingAuditEvent"')).rows.length, 1);
});

test('early close waits for teachers as well as students and publishes one combined tally',async()=>{
  await seed([4,3],periodId,true,1);
  await assert.rejects(close(),{code:'EARLY_CLOSE_INCOMPLETE'});
  assert.ok(!queries.some(sql=>sql.includes('FROM "Ballot"')));
  await pg.query(`UPDATE "VoterParticipation" SET "hasVoted"=true WHERE "periodId"=$1 AND organization='IPPNU'`,[periodId]);
  await pg.query(`INSERT INTO "Ballot" (id,"periodId",organization,"candidateId") SELECT $1,"periodId",organization,id FROM "CandidatePair" WHERE "periodId"=$2 AND organization='IPPNU'`,[randomUUID(),periodId]);
  await close();
  const snapshot=(await storedPeriod()).resultSnapshot!;
  assert.equal(snapshot.eligibleVoters,2);assert.equal(snapshot.complete,2);
  assert.ok(snapshot.contests.every(contest=>contest.votesCast===2));
  assert.doesNotMatch(JSON.stringify(snapshot),/teacherId|studentId|voterType|byType|GURU-/);
});

for (const votes of [[4, 3], [4, 0], []]) {
  test('early closure rejects incomplete/empty roster before reading candidate tally: ' + JSON.stringify(votes), async () => {
    await seed(votes);
    await pg.query('UPDATE "ElectionVoter" SET "credentialEnabled"=false,"pinHash"=NULL,"pinFingerprint"=NULL WHERE nisn=$1', ['9900000001']);
    await assert.rejects(close(), {code: 'EARLY_CLOSE_INCOMPLETE'});
    assert.ok(!queries.some(sql => sql.includes('FROM "Ballot"')));
    assert.equal((await pg.query('SELECT * FROM "VotingSession"')).rows.length, votes.length);
    await assertOpen();
  });
}

test('early closure requires explicit opt-in, an opened period and an active actor', async () => {
  await seed();
  await assert.rejects(close(false), {code: 'BEFORE_DEADLINE'});
  await pg.query(`UPDATE "ElectionPeriod" SET "opensAt"=now()+interval '10 minutes' WHERE id=$1`, [periodId]);
  await assert.rejects(close(), {code: 'BEFORE_DEADLINE'});
  await pg.query(`UPDATE "ElectionPeriod" SET "opensAt"=now()-interval '1 hour' WHERE id=$1`, [periodId]);
  await pg.query('UPDATE "Account" SET active=false');
  await assert.rejects(close(), {code: 'INVALID_REAUTH'});
  await assertOpen();
});

for (const early of [false, true]) {
  test('normal deadline closure preserves partial turnout, including a stale early-close form: ' + early, async () => {
    await seed([4, 2]);
    await pg.query(`UPDATE "ElectionPeriod" SET "closesAt"=now()-interval '1 minute' WHERE id=$1`, [periodId]);
    await close(early);
    assert.equal((await storedPeriod()).resultSnapshot!.partial, 1);
    assert.equal((await pg.query<{reasonCode: string}>('SELECT "reasonCode" FROM "VotingAuditEvent"')).rows[0].reasonCode, 'DEADLINE_REACHED');
  });
}

test('completion does not bypass ballot reconciliation', async () => {
  await seed();
  await pg.query(`INSERT INTO "Ballot" (id,"periodId",organization,"candidateId") SELECT $1,"periodId",organization,id FROM "CandidatePair" WHERE "periodId"=$2 LIMIT 1`, [randomUUID(), periodId]);
  await assert.rejects(close(), {code: 'RECONCILIATION_FAILED'});
  await assertOpen();
});

test('audit failure rolls back closed state, snapshot and session revocation together', async () => {
  await seed();
  await pg.exec(`CREATE FUNCTION force_close_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture audit failure'; END $$;
    CREATE TRIGGER force_close_failure BEFORE INSERT ON "VotingAuditEvent" FOR EACH ROW EXECUTE FUNCTION force_close_failure();`);
  await assert.rejects(close(), /fixture audit failure/);
  await assertOpen();
  assert.equal((await pg.query('SELECT * FROM "VotingSession"')).rows.length, 2);
  assert.equal((await pg.query('SELECT * FROM "Ballot"')).rows.length, 8);
});

test('chair-only candidates pass deferred DB constraints, close and project as a valid public snapshot', async () => {
  await seed([4,4], periodId, true);
  await close();
  const {publicResultSnapshot} = await import('./result-snapshot');
  const snapshot=publicResultSnapshot((await storedPeriod()).resultSnapshot);
  assert.ok(snapshot);
  assert.ok(snapshot.contests.every(contest=>contest.candidates.every(candidate=>candidate.viceChair===null)));
  assert.equal((await pg.query('SELECT * FROM "Ballot"')).rows.length,8);
});

test('database still rejects a vice without a chair and prevents editing a running candidate', async () => {
  await seed([0,0],periodId,true);
  await pg.exec('SAVEPOINT frozen_candidate');
  await assert.rejects(pg.query('DELETE FROM "CandidateMember" WHERE "periodId"=$1',[periodId]));
  await pg.exec('ROLLBACK TO SAVEPOINT frozen_candidate; RELEASE SAVEPOINT frozen_candidate');
  await pg.exec('SAVEPOINT invalid_candidate');
  const draftId=randomUUID(),candidateId=randomUUID();
  await pg.query(`INSERT INTO "ElectionPeriod" (id,slug,name,"academicYear","opensAt","closesAt") VALUES ($1,$2,'Draft','2026/2027',now()+interval '1 day',now()+interval '2 days')`,[draftId,'draft-'+draftId]);
  await pg.query('INSERT INTO "ElectionContest" ("periodId",organization) VALUES ($1,$2)',[draftId,'OSIS']);
  await pg.query('INSERT INTO "CandidatePair" (id,"periodId",organization,"ballotNumber",vision,mission) VALUES ($1,$2,$3,1,$4,$5)',[candidateId,draftId,'OSIS','Vision','Mission']);
  await pg.query(`INSERT INTO "CandidateMember" ("candidatePairId","periodId",organization,"studentId",position,"nameSnapshot","classSnapshot") VALUES ($1,$2,$3,$4,'VICE_CHAIR','Synthetic','QA')`,[candidateId,draftId,'OSIS',studentIds[0]]);
  await assert.rejects(pg.exec('SET CONSTRAINTS ALL IMMEDIATE'),/one chair/);
  await pg.exec('ROLLBACK TO SAVEPOINT invalid_candidate; RELEASE SAVEPOINT invalid_candidate');
});
