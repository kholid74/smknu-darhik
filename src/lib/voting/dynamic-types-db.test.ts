import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

// SQL-only PostgreSQL instances: no dotenv, adapter, network or real master data.
const pg = new PGlite();
const root = new URL('../../../prisma/migrations/', import.meta.url);
const current = '20261017090000_dynamic_election_types';
const five = ['OSIS', 'PRADANA_PUTRA', 'PRADANA_PUTRI', 'IPNU', 'IPPNU'];
const migration = await readFile(new URL(`${current}/migration.sql`, root), 'utf8');
const cleanup = await readFile(new URL('../../../scripts/sql/evoting-sample-cleanup.sql', import.meta.url), 'utf8');
let sequence = 0;
async function baseline(db: PGlite) {
  for (const entry of (await readdir(root, { withFileTypes: true })).filter(e => e.isDirectory() && e.name < current).sort((a, b) => a.name.localeCompare(b.name))) {
    await db.exec(await readFile(new URL(`${entry.name}/migration.sql`, root), 'utf8'));
  }
}
before(async () => { await baseline(pg); await pg.exec(migration); });
after(() => pg.close());
beforeEach(() => pg.exec('BEGIN'));
afterEach(() => pg.exec('ROLLBACK'));
async function verify() { await pg.exec('SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED'); }
async function rejected(action: () => Promise<unknown>, code?: string) {
  await pg.exec('SAVEPOINT rejected');
  await assert.rejects(action, error => !code || (error as { code: string }).code === code);
  await pg.exec('ROLLBACK TO SAVEPOINT rejected; RELEASE SAVEPOINT rejected');
}
async function type(code: string, mode = 'SINGLE') {
  await pg.query(`INSERT INTO "ElectionType" (code,name,"candidateMode","chairLabel","viceChairLabel","sortOrder") VALUES ($1,$1,$2,'Ketua',$3,10)`, [code, mode, mode === 'SINGLE' ? null : 'Wakil Ketua']);
}
async function period(codes = ['OSIS']) {
  const id = randomUUID();
  await pg.query(`INSERT INTO "ElectionPeriod" (id,slug,name,"academicYear","isTest","opensAt","closesAt") VALUES ($1::uuid,$1::text,'Synthetic period','2026/2027',true,now()+interval '1 day',now()+interval '2 days')`, [id]);
  for (const [i, code] of codes.entries()) await pg.query(`INSERT INTO "ElectionContest" ("periodId",organization,"sortOrder") VALUES ($1,$2,$3)`, [id, code, i + 1]);
  return id;
}
async function student() {
  const id = randomUUID(), nisn = String(9900000000 + ++sequence);
  await pg.query(`INSERT INTO "Student" (id,nisn,name,"className") VALUES ($1,$2,'Original name','Original class')`, [id, nisn]);
  return id;
}
async function voter(periodId: string, teacher = false) {
  const id = randomUUID(), studentId = teacher ? null : await student();
  if (teacher) await pg.query(`INSERT INTO "Teacher" (id,name,position) VALUES ($1,'Teacher synthetic','Guru')`, [id]);
  const fingerprint = randomUUID().replaceAll('-', '').repeat(2);
  await pg.query(`INSERT INTO "ElectionVoter" (id,"periodId","voterType","studentId","teacherId","loginCode",nisn,name,"className","pinHash","pinFingerprint","pinVersion")
    VALUES ($1,$2,$3,$4,$5,$6,(SELECT nisn FROM "Student" WHERE id=$4),'Synthetic voter','QA',$7,$8,1)`,
  [id, periodId, teacher ? 'TEACHER' : 'STUDENT', studentId, teacher ? id : null, teacher ? 'GURU-' + id.replaceAll('-', '').slice(0, 12).toUpperCase() : null, 'x'.repeat(60), fingerprint]);
  await pg.query(`INSERT INTO "VoterParticipation" ("voterId","periodId",organization) SELECT $1,"periodId",organization FROM "ElectionContest" WHERE "periodId"=$2`, [id, periodId]);
  return id;
}
async function candidate(periodId: string, organization: string, chair = '', vice: string | null = null, number = 1) {
  const id = randomUUID();
  await pg.query(`INSERT INTO "CandidatePair" (id,"periodId",organization,"ballotNumber",vision,mission) VALUES ($1,$2,$3,$4,'Vision','Mission')`, [id, periodId, organization, number]);
  for (const [position, member] of [['CHAIR', chair || await student()], ...(vice ? [['VICE_CHAIR', vice]] : [])]) {
    await pg.query(`INSERT INTO "CandidateMember" ("candidatePairId","periodId",organization,"studentId",position,"nameSnapshot","classSnapshot")
      SELECT $1,$2,$3,id,$4,name,"className" FROM "Student" WHERE id=$5`, [id, periodId, organization, position, member]);
  }
  return id;
}
async function ready(codes = ['OSIS']) {
  const id = await period(codes), voterId = await voter(id);
  const candidates: string[] = [];
  for (const code of codes) candidates.push(await candidate(id, code));
  await verify();
  await pg.query(`UPDATE "ElectionPeriod" SET state='SCHEDULED',"opensAt"=now()-interval '1 hour' WHERE id=$1`, [id]);
  await verify();
  return { id, voterId, candidates };
}

test('migration seeds exactly five official types, without dummy periods or fabricated logos', async () => {
  const rows = (await pg.query<{ code: string; candidateMode: string; logoUrl: string | null }>('SELECT code,"candidateMode","logoUrl" FROM "ElectionType" ORDER BY "sortOrder"')).rows;
  assert.deepEqual(rows.map(r => r.code), five);
  assert.deepEqual(rows.map(r => r.candidateMode), ['OPTIONAL_VICE', 'SINGLE', 'SINGLE', 'OPTIONAL_VICE', 'OPTIONAL_VICE']);
  assert.ok(rows.every(r => r.logoUrl === null));
  assert.equal((await pg.query(`SELECT to_regtype('"VotingOrganization"') AS legacy`)).rows[0].legacy, null);
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM "ElectionPeriod"')).rows[0].n, 0);
});

test('master enforces codes, mode labels, immutable identity and effective revisions', async () => {
  await rejected(() => type('lower case'), '23514');
  await rejected(() => type('OSIS'), '23505');
  await rejected(() => pg.exec(`UPDATE "ElectionType" SET code='NEW' WHERE code='OSIS'`), '23514');
  await rejected(() => pg.exec(`UPDATE "ElectionType" SET name='Changed' WHERE code='OSIS'`), '23514');
  await rejected(() => pg.exec(`UPDATE "ElectionType" SET "revision"=1 WHERE code='OSIS'`), '23514');
  await rejected(() => pg.exec(`UPDATE "ElectionType" SET "candidateMode"='SINGLE',revision=1 WHERE code='OSIS'`), '23514');
  await pg.exec(`UPDATE "ElectionType" SET name='Changed',revision=1 WHERE code='OSIS'`);
  await pg.exec(`UPDATE "ElectionType" SET name='Changed',revision=1 WHERE code='OSIS'`);
  assert.equal((await pg.query(`SELECT revision FROM "ElectionType" WHERE code='OSIS'`)).rows[0].revision, 1);
  await type('UNUSED'); await pg.exec(`DELETE FROM "ElectionType" WHERE code='UNUSED'`);
});

for (const n of [1, 5, 6]) test(`period with ${n} types has exact rights for both student and teacher`, async () => {
  if (n === 6) await type('NEW_SIXTH');
  const id = await period([...five, 'NEW_SIXTH'].slice(0, n));
  await voter(id); await voter(id, true); await verify();
  const rights = (await pg.query(`SELECT "voterId",count(*)::int AS n FROM "VoterParticipation" WHERE "periodId"=$1 GROUP BY "voterId"`, [id])).rows;
  assert.deepEqual(rights.map(r => r.n), [n, n]);
  assert.equal((await pg.query('SELECT "contestsRevision" FROM "ElectionPeriod" WHERE id=$1', [id])).rows[0].contestsRevision, 0);
});

test('empty, duplicate, unknown, oversized and noncontiguous contests are rejected at constraint boundaries', async () => {
  await rejected(async () => { await period([]); await verify(); }, '23514');
  await rejected(() => period(['OSIS', 'OSIS']), '23505');
  await rejected(() => period(['UNKNOWN']), '23503');
  await rejected(async () => { const id = await period(); await pg.query(`UPDATE "ElectionContest" SET "sortOrder"=2 WHERE "periodId"=$1`, [id]); await verify(); }, '23514');
  await rejected(async () => {
    for (let i = 0; i < 21; i++) await type(`TYPE_${i}`);
    await period(Array.from({ length: 21 }, (_, i) => `TYPE_${i}`)); await verify();
  }, '23514');
  for (let i = 0; i < 20; i++) await type(`VALID_${i}`);
  await period(Array.from({ length: 20 }, (_, i) => `VALID_${i}`)); await verify();
});

test('snapshot is captured once, retained on reorder/master edits/deactivation, and master delete is restricted', async () => {
  const id = await period(['OSIS', 'IPNU']); await voter(id); await verify();
  const before = (await pg.query('SELECT "nameSnapshot","candidateModeSnapshot","logoUrlSnapshot" FROM "ElectionContest" WHERE "periodId"=$1 AND organization=\'OSIS\'', [id])).rows[0];
  await pg.exec(`UPDATE "ElectionType" SET name='New label',"candidateMode"='SINGLE',"viceChairLabel"=NULL,active=false,revision=1 WHERE code='OSIS'`);
  await rejected(() => pg.exec(`DELETE FROM "ElectionType" WHERE code='OSIS'`), '23503');
  await rejected(() => period(['OSIS']), '55000');
  await pg.query(`UPDATE "ElectionContest" SET "sortOrder"=3-"sortOrder" WHERE "periodId"=$1`, [id]); await verify();
  assert.deepEqual((await pg.query('SELECT "nameSnapshot","candidateModeSnapshot","logoUrlSnapshot" FROM "ElectionContest" WHERE "periodId"=$1 AND organization=\'OSIS\'', [id])).rows[0], before);
  await rejected(() => pg.query(`UPDATE "ElectionContest" SET "nameSnapshot"='Override' WHERE "periodId"=$1`, [id]), '23514');
});

test('maximum 99 voters and 20 contests validate 1980 rights on the actual deferred constraints', async context => {
  const codes = Array.from({ length: 20 }, (_, i) => `MAX_${i}`);
  for (const code of codes) await type(code);
  const id = await period(codes);
  for (let i = 0; i < 99; i++) await voter(id, i % 2 === 0);
  const started = performance.now(); await verify();
  context.diagnostic(`Deferred validation for 99 x 20 rights: ${Math.round(performance.now() - started)}ms in PGlite; not a Neon latency estimate.`);
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM "VoterParticipation" WHERE "periodId"=$1', [id])).rows[0].n, 1980);
});

test('membership replacement is atomic with rights and preserves PINs and voter snapshots', async () => {
  const id = await period(), voterId = await voter(id);
  const before = (await pg.query('SELECT to_jsonb(v) AS data FROM "ElectionVoter" v WHERE id=$1', [voterId])).rows[0];
  await rejected(async () => { await pg.query('DELETE FROM "VoterParticipation" WHERE "voterId"=$1', [voterId]); await verify(); }, '23514');
  await rejected(async () => {
    const other = await voter(id);
    await pg.query(`INSERT INTO "ElectionContest" ("periodId",organization,"sortOrder") VALUES ($1,'PRADANA_PUTRA',2)`, [id]);
    await pg.query(`INSERT INTO "VoterParticipation" ("voterId","periodId",organization) VALUES ($1,$2,'PRADANA_PUTRA')`, [other, id]);
    // The unchanged first voter has no row event; the contest event must catch its missing right.
    await verify();
  }, '23514');
  await pg.query(`INSERT INTO "ElectionContest" ("periodId",organization,"sortOrder") VALUES ($1,'PRADANA_PUTRA',2)`, [id]);
  await pg.query(`INSERT INTO "VoterParticipation" ("voterId","periodId",organization) VALUES ($1,$2,'PRADANA_PUTRA')`, [voterId, id]);
  await pg.query(`DELETE FROM "VoterParticipation" WHERE "voterId"=$1 AND organization='OSIS'`, [voterId]);
  await pg.query(`DELETE FROM "ElectionContest" WHERE "periodId"=$1 AND organization='OSIS'`, [id]);
  await pg.query(`UPDATE "ElectionContest" SET "sortOrder"=1 WHERE "periodId"=$1`, [id]);
  await pg.query(`UPDATE "ElectionPeriod" SET "contestsRevision"=1 WHERE id=$1`, [id]); await verify();
  assert.deepEqual((await pg.query('SELECT to_jsonb(v) AS data FROM "ElectionVoter" v WHERE id=$1', [voterId])).rows[0], before);
  assert.deepEqual((await pg.query('SELECT organization FROM "VoterParticipation" WHERE "voterId"=$1', [voterId])).rows, [{ organization: 'PRADANA_PUTRA' }]);
});

test('single/optional modes, different Student members and duplicate assignments are enforced', async () => {
  const id = await period(['OSIS', 'PRADANA_PUTRA']), chair = await student(), vice = await student();
  await candidate(id, 'OSIS', chair, vice); await candidate(id, 'PRADANA_PUTRA', chair); await verify();
  await rejected(() => candidate(id, 'OSIS', chair, null, 2), '23505');
  await rejected(async () => { await candidate(id, 'PRADANA_PUTRA', await student(), await student(), 2); await verify(); }, '23514');
  await rejected(async () => candidate(id, 'OSIS', await student(), chair, 2), '23505');
  const other = await period(); await candidate(other, 'OSIS', chair); await verify();
});

test('invalid Student ID, missing chair, same student twice and cross-period candidate references fail', async () => {
  const id = await period(), other = await period(), pair = await candidate(id, 'OSIS'); await verify();
  await rejected(() => pg.query(`INSERT INTO "CandidateMember" ("candidatePairId","periodId",organization,"studentId",position,"nameSnapshot","classSnapshot") VALUES ($1,$2,'OSIS',$3,'VICE_CHAIR','Fake','X')`, [pair, id, randomUUID()]), '23503');
  await rejected(async () => { await pg.query(`DELETE FROM "CandidateMember" WHERE "candidatePairId"=$1`, [pair]); await verify(); }, '23514');
  const chair = (await pg.query('SELECT "studentId" FROM "CandidateMember" WHERE "candidatePairId"=$1', [pair])).rows[0].studentId;
  await rejected(() => pg.query(`INSERT INTO "CandidateMember" ("candidatePairId","periodId",organization,"studentId",position,"nameSnapshot","classSnapshot") VALUES ($1,$2,'OSIS',$3,'VICE_CHAIR','Fake','X')`, [pair, id, chair]), '23505');
  await rejected(() => pg.query(`INSERT INTO "Ballot" (id,"periodId",organization,"candidateId") VALUES ($1,$2,'OSIS',$3)`, [randomUUID(), other, pair]), '23503');
});

test('Student edits do not change candidate history or snapshot name/class', async () => {
  const id = await period(), member = await student(); await candidate(id, 'OSIS', member); await verify();
  await pg.query(`UPDATE "Student" SET name='Updated master',"className"='New class' WHERE id=$1`, [member]);
  const rows = (await pg.query('SELECT "nameSnapshot","classSnapshot" FROM "CandidateMember" WHERE "studentId"=$1', [member])).rows;
  assert.deepEqual(rows, [{ nameSnapshot: 'Original name', classSnapshot: 'Original class' }]);
  await rejected(() => pg.query('DELETE FROM "Student" WHERE id=$1', [member]), '23503');
});

test('raw key moves, premature rights, reopen and closed snapshot edits remain blocked', async () => {
  const id = await period(), voterId = await voter(id), pair = await candidate(id, 'OSIS'); await verify();
  await rejected(() => pg.query(`UPDATE "VoterParticipation" SET "hasVoted"=true WHERE "voterId"=$1`, [voterId]), '55000');
  await rejected(() => pg.query(`UPDATE "CandidateMember" SET position='VICE_CHAIR' WHERE "candidatePairId"=$1`, [pair]), '23514');
  await rejected(() => pg.query(`UPDATE "CandidatePair" SET organization='IPNU' WHERE id=$1`, [pair]), '23514');
  await rejected(() => pg.query(`UPDATE "CandidateMember" SET "candidatePairId"=$1 WHERE "candidatePairId"=$2`, [randomUUID(), pair]), '23514');
  await pg.query(`UPDATE "ElectionPeriod" SET state='SCHEDULED',"opensAt"=now()-interval '1 hour' WHERE id=$1`, [id]); await verify();
  await rejected(() => pg.query('DELETE FROM "VoterParticipation" WHERE "voterId"=$1', [voterId]), '55000');
  await rejected(() => pg.query(`UPDATE "ElectionVoter" SET name='Changed historical name' WHERE id=$1`, [voterId]), '23514');
  await rejected(() => pg.query(`UPDATE "ElectionPeriod" SET "opensAt"=now()+interval '1 day' WHERE id=$1`, [id]), '55000');
  await rejected(() => pg.query(`UPDATE "ElectionPeriod" SET "closesAt"="closesAt"+interval '61 minutes',"extensionUsedAt"=now() WHERE id=$1`, [id]), '55000');
  await pg.query(`UPDATE "ElectionPeriod" SET "closesAt"="closesAt"+interval '30 minutes',"extensionUsedAt"=now() WHERE id=$1`, [id]);
  await rejected(() => pg.query(`UPDATE "ElectionPeriod" SET "closesAt"="closesAt"+interval '30 minutes',"extensionUsedAt"=clock_timestamp() WHERE id=$1`, [id]), '55000');
  await rejected(() => pg.query(`UPDATE "ElectionPeriod" SET state='DRAFT' WHERE id=$1`, [id]), '55000');
  const snapshot = { version: 2, eligibleVoters: 1, notStarted: 1, partial: 0, complete: 0, contests: [{ organization: 'OSIS', name: 'OSIS', logoUrl: null, candidateMode: 'OPTIONAL_VICE', chairLabel: 'Ketua', viceChairLabel: 'Wakil Ketua', sortOrder: 1, votesCast: 0, candidates: [{ candidateId: pair, ballotNumber: 1, vision: 'Vision', mission: 'Mission', chair: { name: 'Original name', className: 'Original class', photoUrl: null }, viceChair: null, votes: 0 }] }] };
  await rejected(() => pg.query(`UPDATE "ElectionPeriod" SET state='CLOSED',"closedAt"=clock_timestamp(),"resultSnapshot"='{"version":1}' WHERE id=$1`, [id]), '23514');
  await pg.query(`UPDATE "ElectionPeriod" SET state='CLOSED',"closedAt"=clock_timestamp(),"resultSnapshot"=$2::jsonb WHERE id=$1`, [id, JSON.stringify(snapshot)]); await verify();
  await rejected(() => pg.query(`UPDATE "ElectionPeriod" SET name='Changed' WHERE id=$1`, [id]), '55000');
  await rejected(() => pg.query(`UPDATE "ElectionPeriod" SET "resultSnapshot"='{"version":2}' WHERE id=$1`, [id]), '55000');
  await pg.query(`UPDATE "ElectionPeriod" SET "publishedAt"=clock_timestamp() WHERE id=$1`, [id]);
  await pg.query(`UPDATE "ElectionPeriod" SET state='ARCHIVED' WHERE id=$1`, [id]); await verify();
  await rejected(() => pg.query(`UPDATE "ElectionPeriod" SET "publishedAt"=NULL WHERE id=$1`, [id]), '55000');
  await rejected(() => pg.query(`UPDATE "ElectionPeriod" SET state='SCHEDULED' WHERE id=$1`, [id]), '55000');
});

test('contests lock at schedule, candidates at opening; last scheduled candidate cannot disappear', async () => {
  const id = await period(), pair = await candidate(id, 'OSIS'); await voter(id); await verify();
  await pg.query(`UPDATE "ElectionPeriod" SET state='SCHEDULED' WHERE id=$1`, [id]); await verify();
  await pg.query(`UPDATE "CandidatePair" SET vision='Before opening' WHERE id=$1`, [pair]);
  await rejected(() => pg.query(`UPDATE "ElectionContest" SET "sortOrder"=1 WHERE "periodId"=$1`, [id]), '55000');
  await rejected(async () => { await pg.query('DELETE FROM "CandidateMember" WHERE "candidatePairId"=$1', [pair]); await pg.query('DELETE FROM "CandidatePair" WHERE id=$1', [pair]); await verify(); }, '23514');
  await pg.query(`UPDATE "ElectionPeriod" SET "opensAt"=now()-interval '1 hour' WHERE id=$1`, [id]);
  await rejected(() => pg.query(`UPDATE "CandidatePair" SET vision='Too late' WHERE id=$1`, [pair]), '55000');
  await rejected(() => voter(id), '23514');
});

test('combined roster cap, anonymous Ballot columns, append-only audit and monotonic rights survive', async () => {
  const { id, voterId, candidates } = await ready();
  const columns = (await pg.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_name='Ballot' ORDER BY ordinal_position`)).rows.map(r => r.column_name);
  assert.deepEqual(columns, ['id', 'periodId', 'organization', 'candidateId']);
  await pg.query(`UPDATE "VoterParticipation" SET "hasVoted"=true WHERE "voterId"=$1`, [voterId]);
  await pg.query(`INSERT INTO "Ballot" (id,"periodId",organization,"candidateId") VALUES ($1,$2,'OSIS',$3)`, [randomUUID(), id, candidates[0]]);
  await rejected(() => pg.query(`UPDATE "VoterParticipation" SET "hasVoted"=false WHERE "voterId"=$1`, [voterId]), '55000');
  await rejected(() => pg.query('DELETE FROM "Ballot" WHERE "periodId"=$1', [id]), '55000');
  await rejected(() => pg.query(`UPDATE "Ballot" SET "candidateId"=$1 WHERE "periodId"=$2`, [candidates[0], id]), '55000');
  const audit = randomUUID(); await pg.query(`INSERT INTO "VotingAuditEvent" (id,"periodId",event) VALUES ($1,$2,'TEST')`, [audit, id]);
  await rejected(() => pg.query('DELETE FROM "VotingAuditEvent" WHERE id=$1', [audit]), '55000');
  await verify();
  const draft = await period(); for (let i = 0; i < 99; i++) await voter(draft, i % 2 === 0); await verify();
  await rejected(async () => { await voter(draft); await verify(); }, '23514');
});

test('authorized runtime test cleanup restores guards and preserves masters and append-only audit', async () => {
  const { id } = await ready();
  await pg.exec(`INSERT INTO "Account" (id,email,"passwordHash") VALUES ('cleanup-owner','cleanup@example.test','synthetic'); INSERT INTO "AccountRole" (id,"accountId",role) VALUES ('cleanup-role','cleanup-owner','superadmin')`);
  const preview = (await pg.query<{ data: { version: string } }>('SELECT evoting_test_cleanup_preview($1) AS data', [id])).rows[0].data;
  const result = (await pg.query<{ data: { error?: string } }>('SELECT evoting_delete_test_period($1,$2,$3,$4) AS data', [id, 'cleanup-owner', 'HAPUS ' + id, preview.version])).rows[0].data;
  assert.equal(result.error, undefined); await verify();
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM "Student"')).rows[0].n, 2);
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM "VotingAuditEvent" WHERE "periodId"=$1', [id])).rows[0].n, 1);
});

test('offline manifest cleanup handles published samples, preserves other data/audit, restores guards and backup', async () => {
  const db = new PGlite();
  let backup: Blob;
  try {
    await baseline(db);
    await db.exec(`INSERT INTO "Account" (id,email,"passwordHash") VALUES ('owner','owner@example.test','synthetic'); INSERT INTO "AccountRole" (id,"accountId",role) VALUES ('owner-role','owner','superadmin'); INSERT INTO "Student" (id,nisn,name,"className") VALUES ('20000000-0000-4000-8000-000000000099','9900000099','Keep master','X'); INSERT INTO "Teacher" (id,name,position) VALUES ('keep-teacher','Keep teacher','Guru')`);
    await db.exec(`INSERT INTO "Department" (id,slug,name,description,kompetensi,karir) VALUES ('keep-department','keep-department','Keep department','Synthetic','[]','[]'); INSERT INTO "SchoolClass" (id,"academicYear",name,"departmentId") VALUES ('keep-class','2026/2027','X','keep-department'); INSERT INTO "Media" (id,url,filename) VALUES ('keep-media','https://example.test/keep.webp','keep.webp'); INSERT INTO "Faq" (id,question,answer) VALUES ('keep-faq','Keep question','Keep answer')`);
    const target = randomUUID(), untouched = randomUUID();
    for (const id of [target, untouched]) {
      const pair = randomUUID(), voter = randomUUID();
      await db.exec('BEGIN');
      await db.query(`INSERT INTO "ElectionPeriod" (id,slug,name,"academicYear","opensAt","closesAt") VALUES ($1::uuid,$1::text,'Historical sample','2026/2027',now()+interval '1 day',now()+interval '2 days')`, [id]);
      await db.query(`INSERT INTO "ElectionContest" ("periodId",organization) VALUES ($1,'OSIS')`, [id]);
      await db.query(`INSERT INTO "CandidatePair" (id,"periodId",organization,"ballotNumber",vision,mission) VALUES ($1,$2,'OSIS',1,'Vision','Mission')`, [pair, id]);
      await db.query(`INSERT INTO "CandidateMember" ("candidatePairId","periodId",organization,"studentId",position,"nameSnapshot","classSnapshot") VALUES ($1,$2,'OSIS','20000000-0000-4000-8000-000000000099','CHAIR','Keep master','X')`, [pair, id]);
      await db.query(`INSERT INTO "ElectionVoter" (id,"periodId","studentId",nisn,name,"className") VALUES ($1,$2,'20000000-0000-4000-8000-000000000099','9900000099','Keep master','X')`, [voter, id]);
      await db.query(`INSERT INTO "VoterParticipation" ("voterId","periodId",organization,"hasVoted") VALUES ($1,$2,'OSIS',true)`, [voter, id]);
      await db.query(`INSERT INTO "Ballot" (id,"periodId",organization,"candidateId") VALUES ($1,$2,'OSIS',$3)`, [randomUUID(), id, pair]);
      await db.query(`INSERT INTO "VotingSession" (id,"voterId","tokenHash","lastSeenAt","expiresAt") VALUES ($1,$2,$3,now(),now()+interval '5 minutes')`, [randomUUID(), voter, voter.replaceAll('-', '').repeat(2)]);
      await db.query(`INSERT INTO "VotingAuditEvent" (id,"periodId",event) VALUES ($1,$2,'SAMPLE_CREATED')`, [randomUUID(), id]);
      await db.query(`UPDATE "ElectionPeriod" SET state='CLOSED',"opensAt"=now()-interval '2 days',"closesAt"=now()-interval '1 day',"closedAt"=now()-interval '1 day',"publishedAt"=now(),"resultSnapshot"='{"version":1}' WHERE id=$1`, [id]);
      await db.exec('COMMIT');
    }
    backup = await db.dumpDataDir();
    const guards = (await db.query(`SELECT pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname`)).rows;
    await db.exec('BEGIN');
    await db.exec(`CREATE TEMP TABLE "_EvotingCleanupManifest" ("periodId" uuid PRIMARY KEY,slug text,"previewVersion" text) ON COMMIT DROP; CREATE TEMP TABLE "_EvotingCleanupContext" ("actorAccountId" text,reason text,confirmation text) ON COMMIT DROP; INSERT INTO "_EvotingCleanupContext" VALUES ('owner','Confirmed samples for dynamic election migration','HAPUS SAMPEL UNTUK JENIS DINAMIS')`);
    const preview = (await db.query<{ data: { version: string } }>('SELECT evoting_test_cleanup_preview($1) AS data', [target])).rows[0].data;
    await db.query(`INSERT INTO "_EvotingCleanupManifest" VALUES ($1::uuid,$1::text,'stale')`, [target]);
    await db.exec('SAVEPOINT stale'); await assert.rejects(db.exec(cleanup), /CLEANUP_STALE_MANIFEST/); await db.exec('ROLLBACK TO SAVEPOINT stale; RELEASE SAVEPOINT stale');
    await db.query(`UPDATE "_EvotingCleanupManifest" SET "previewVersion"=$1`, [preview.version]);
    await db.exec('SAVEPOINT injected_failure');
    await assert.rejects(db.exec(cleanup.replace('DELETE FROM "ElectionPeriod"', () => `DO $$ BEGIN RAISE EXCEPTION 'INJECTED_FAILURE'; END $$; DELETE FROM "ElectionPeriod"`)), /INJECTED_FAILURE/);
    await db.exec('ROLLBACK TO SAVEPOINT injected_failure; RELEASE SAVEPOINT injected_failure');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM "Ballot"')).rows[0].n, 2);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM "VotingAuditEvent"')).rows[0].n, 2);
    assert.deepEqual((await db.query(`SELECT pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname`)).rows, guards);
    await db.exec(cleanup); await db.exec('COMMIT');
    assert.equal((await db.query('SELECT id FROM "ElectionPeriod" WHERE id=$1', [target])).rows.length, 0);
    assert.equal((await db.query('SELECT id FROM "ElectionPeriod" WHERE id=$1', [untouched])).rows.length, 1);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM "Student"')).rows[0].n, 1);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM "Teacher"')).rows[0].n, 1);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM "VotingAuditEvent" WHERE "periodId"=$1', [target])).rows[0].n, 2);
    assert.deepEqual((await db.query(`SELECT pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname`)).rows, guards);
    await assert.rejects(db.exec(migration), /EVOTING_MIGRATION_REQUIRES_EMPTY_ELECTION_DATA/); await db.exec('ROLLBACK');
    assert.equal((await db.query(`SELECT to_regclass('"ElectionType"') AS name`)).rows[0].name, null);
    assert.equal((await db.query('SELECT id FROM "ElectionPeriod" WHERE id=$1', [untouched])).rows.length, 1);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM "Ballot"')).rows[0].n, 1);
    await db.exec('BEGIN');
    await db.exec(`CREATE TEMP TABLE "_EvotingCleanupManifest" ("periodId" uuid PRIMARY KEY,slug text,"previewVersion" text) ON COMMIT DROP; CREATE TEMP TABLE "_EvotingCleanupContext" ("actorAccountId" text,reason text,confirmation text) ON COMMIT DROP; INSERT INTO "_EvotingCleanupContext" VALUES ('owner','Second explicitly confirmed sample for migration','HAPUS SAMPEL UNTUK JENIS DINAMIS')`);
    await db.query(`INSERT INTO "_EvotingCleanupManifest" SELECT id,slug,evoting_test_cleanup_preview(id)->>'version' FROM "ElectionPeriod" WHERE id=$1`, [untouched]);
    await db.exec(cleanup); await db.exec('COMMIT'); await db.exec(migration);
    for (const table of ['Student', 'Teacher', 'Department', 'SchoolClass', 'Account', 'AccountRole', 'Media', 'Faq']) {
      assert.equal((await db.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n, 1, table);
    }
    assert.equal((await db.query('SELECT count(*)::int AS n FROM "VotingAuditEvent"')).rows[0].n, 4);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM "ElectionType"')).rows[0].n, 5);
  } finally { await db.close(); }
  const restored = new PGlite({ loadDataDir: backup! });
  try {
    assert.equal((await restored.query('SELECT count(*)::int AS n FROM "ElectionPeriod"')).rows[0].n, 2);
    assert.equal((await restored.query(`SELECT to_regtype('"VotingOrganization"') AS name`)).rows[0].name, '"VotingOrganization"');
    assert.equal((await restored.query('SELECT count(*)::int AS n FROM "VotingAuditEvent"')).rows[0].n, 2);
    assert.equal((await restored.query('SELECT count(*)::int AS n FROM "Ballot"')).rows[0].n, 2);
  } finally { await restored.close(); }
});
