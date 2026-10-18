import {test, before, after, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

// Entirely in-memory PostgreSQL: these tests never load environment files or connect to Neon.
const db = new PGlite();
const periodId = '10000000-0000-4000-8000-000000000001';
const otherId = '10000000-0000-4000-8000-000000000002';
const studentId = '20000000-0000-4000-8000-000000000001';
const viceId = '20000000-0000-4000-8000-000000000002';
const legacyIds = ['cfb0e26c-72bb-4593-a7de-ce576357f29e', 'fcf94a5a-bb68-4a5a-bd20-62289691ce48'];
let legacyFlags: Array<{isTest: boolean}>;

before(async () => {
  const root = new URL('../../../prisma/migrations/', import.meta.url);
  // Historical cleanup/classification regression; current guards are tested in dynamic-types-db.
  for (const entry of (await readdir(root, {withFileTypes: true})).filter(entry => entry.isDirectory() && entry.name <= '20261016120000_draft_setup_editability').sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === '20261015140000_test_period_cleanup') {
      for (const [index, id] of legacyIds.entries()) {
        await db.query('INSERT INTO "ElectionPeriod" (id,slug,name,"academicYear",state,"opensAt","closesAt") VALUES ($1,$2,$3,$4,$5,now()+interval \'1 day\',now()+interval \'2 days\')',
          [id, index ? 'pem-osis-2026' : 'osis-2026', 'Synthetic legacy sample', '2026/2027', index ? 'SCHEDULED' : 'DRAFT']);
      }
    }
    await db.exec(await readFile(new URL(entry.name + '/migration.sql', root), 'utf8'));
  }
  legacyFlags = (await db.query<{isTest: boolean}>('SELECT "isTest" FROM "ElectionPeriod" ORDER BY id')).rows;
  await db.query('INSERT INTO "Account" (id,email,"passwordHash") VALUES ($1,$2,$3)', ['migration-admin', 'migration@example.test', 'fixture-hash']);
  await db.query('INSERT INTO "AccountRole" (id,"accountId",role) VALUES ($1,$2,$3)', ['migration-role', 'migration-admin', 'superadmin']);
  for (const [index, id] of legacyIds.entries()) {
    const data = await preview(id);
    assert.equal((await cleanup(id, 'migration-admin', 'HAPUS ' + (index ? 'pem-osis-2026' : 'osis-2026'), data.version)).error, undefined);
  }
});
after(async () => {await db.close();});
beforeEach(async () => {
  await db.exec('BEGIN');
  await db.query('INSERT INTO "Account" (id,email,"passwordHash") VALUES ($1,$2,$3)', ['cleanup-admin', 'admin@example.test', 'fixture-hash']);
  await db.query('INSERT INTO "AccountRole" (id,"accountId",role) VALUES ($1,$2,$3)', ['cleanup-role', 'cleanup-admin', 'superadmin']);
  await db.query('INSERT INTO "Student" (id,nisn,name,"className") VALUES ($1,$2,$3,$4),($5,$6,$7,$8)',
    [studentId, '9900000001', 'Synthetic Chair', 'QA', viceId, '9900000002', 'Synthetic Vice', 'QA']);
  await seedPeriod(periodId, true);
  await seedPeriod(otherId, false);
});
afterEach(async () => {await db.exec('ROLLBACK');});

async function seedPeriod(id: string, isTest: boolean) {
  const candidateId = randomUUID(), voterId = randomUUID();
  await db.query('INSERT INTO "ElectionPeriod" (id,slug,name,"academicYear","isTest","opensAt","closesAt") VALUES ($1,$2,$3,$4,$5,now()+interval \'1 day\',now()+interval \'2 days\')',
    [id, id === periodId ? 'periode-uji' : 'periode-resmi', 'Synthetic period', '2026/2027', isTest]);
  await db.query('INSERT INTO "ElectionContest" ("periodId",organization) VALUES ($1,$2)', [id, 'OSIS']);
  await db.query('INSERT INTO "CandidatePair" (id,"periodId",organization,"ballotNumber",vision,mission) VALUES ($1,$2,$3,1,$4,$5)', [candidateId, id, 'OSIS', 'Vision', 'Mission']);
  await db.query('INSERT INTO "CandidateMember" ("candidatePairId","periodId",organization,"studentId",position,"nameSnapshot","classSnapshot") VALUES ($1,$2,$3,$4,$5,$6,$7),($1,$2,$3,$8,$9,$10,$7)',
    [candidateId, id, 'OSIS', studentId, 'CHAIR', 'Synthetic Chair', 'QA', viceId, 'VICE_CHAIR', 'Synthetic Vice']);
  await db.query('INSERT INTO "ElectionVoter" (id,"studentId","periodId",nisn,name,"className","pinHash","pinFingerprint") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [voterId, studentId, id, '9900000001', 'Synthetic Chair', 'QA', 'x'.repeat(60), 'a'.repeat(64)]);
  await db.query('INSERT INTO "VoterParticipation" ("voterId","periodId",organization,"hasVoted") VALUES ($1,$2,$3,true)', [voterId, id, 'OSIS']);
  await db.query('INSERT INTO "Ballot" (id,"periodId",organization,"candidateId") VALUES ($1,$2,$3,$4)', [randomUUID(), id, 'OSIS', candidateId]);
  await db.query('INSERT INTO "VotingSession" (id,"voterId","tokenHash","lastSeenAt","expiresAt") VALUES ($1,$2,$3,now(),now()+interval \'5 minutes\')', [randomUUID(), voterId, (id === periodId ? 'a' : 'b').repeat(64)]);
  await db.query('INSERT INTO "VotingAuditEvent" (id,"periodId",event) VALUES ($1,$2,$3)', [randomUUID(), id, 'PERIOD_CREATED']);
  await db.query('UPDATE "ElectionPeriod" SET state=$2,"opensAt"=now()-interval \'1 hour\',"closesAt"=now()+interval \'1 hour\' WHERE id=$1', [id, id === periodId ? 'SCHEDULED' : 'CLOSED']);
}

async function preview(id = periodId) {
  return (await db.query<{data: {version: string; ballots: number}}>('SELECT evoting_test_cleanup_preview($1) AS data', [id])).rows[0].data;
}
async function cleanup(id = periodId, actor = 'cleanup-admin', confirmation = 'HAPUS periode-uji', version?: string) {
  return (await db.query<{data: {error?: string; ballots?: number}}>('SELECT evoting_delete_test_period($1,$2,$3,$4) AS data',
    [id, actor, confirmation, version ?? (await preview(id)).version])).rows[0].data;
}
async function blocked(sql: string, params: unknown[] = []) {
  await db.exec('SAVEPOINT blocked');
  await assert.rejects(db.query(sql, params));
  await db.exec('ROLLBACK TO SAVEPOINT blocked; RELEASE SAVEPOINT blocked');
}
async function count(table: string, id = periodId) {
  assert.ok(['ElectionPeriod', 'ElectionContest', 'CandidatePair', 'CandidateMember', 'ElectionVoter', 'VoterParticipation', 'Ballot', 'VotingAuditEvent'].includes(table));
  return Number((await db.query<{count: number}>(`SELECT count(*)::int AS count FROM "${table}" WHERE "${table === 'ElectionPeriod' ? 'id' : 'periodId'}"=$1`, [id])).rows[0].count);
}

test('migration classifies the two confirmed legacy samples without deleting either period', () => {
  assert.equal(legacyFlags.length, 2);
  assert.ok(legacyFlags.every(period => period.isTest));
});

test('cleanup deletes the selected running test period, preserves master, other election and append-only audit', async () => {
  assert.equal((await cleanup()).ballots, 1);
  await db.exec('SET CONSTRAINTS ALL IMMEDIATE');
  for (const table of ['ElectionPeriod', 'ElectionContest', 'CandidatePair', 'CandidateMember', 'ElectionVoter', 'VoterParticipation', 'Ballot']) {
    assert.equal(await count(table), 0, table);
    assert.equal(await count(table, otherId), table === 'CandidateMember' ? 2 : 1, 'other ' + table);
  }
  assert.equal((await db.query('SELECT id FROM "Student"')).rows.length, 2);
  assert.equal((await db.query('SELECT id FROM "VotingSession"')).rows.length, 1);
  assert.equal(await count('VotingAuditEvent'), 2);
  const audit = (await db.query<{detail: {ballots: number}; event: string}>('SELECT event,detail FROM "VotingAuditEvent" WHERE "periodId"=$1 AND event=$2', [periodId, 'TEST_PERIOD_DELETED'])).rows[0];
  assert.equal(audit.detail.ballots, 1);
  await blocked('DELETE FROM "VotingAuditEvent" WHERE "periodId"=$1', [periodId]);
  await blocked('UPDATE "VotingAuditEvent" SET event=$2 WHERE "periodId"=$1', [periodId, 'changed']);
  assert.equal((await cleanup(periodId, 'cleanup-admin', 'HAPUS periode-uji', 'a'.repeat(32))).error, 'NOT_FOUND');
});

test('official periods cannot be cleaned, relabelled, or bypassed by a forged cleanup context', async () => {
  assert.equal((await cleanup(otherId, 'cleanup-admin', 'HAPUS periode-resmi')).error, 'TEST_CLEANUP_NOT_ALLOWED');
  await blocked('UPDATE "ElectionPeriod" SET "isTest"=true WHERE id=$1', [otherId]);
  await db.query("SELECT set_config('smkdh.test_cleanup_period',$1,true),set_config('smkdh.test_cleanup_transaction',txid_current()::text,true)", [otherId]);
  await blocked('DELETE FROM "Ballot" WHERE "periodId"=$1', [otherId]);
  await blocked('DELETE FROM "ElectionPeriod" WHERE id=$1', [otherId]);
});

test('ordinary deletes and all ballot updates remain blocked even on testing data', async () => {
  await blocked('DELETE FROM "Ballot" WHERE "periodId"=$1', [periodId]);
  await blocked('UPDATE "Ballot" SET id=$2 WHERE "periodId"=$1', [periodId, randomUUID()]);
  await blocked('DELETE FROM "CandidateMember" WHERE "periodId"=$1', [periodId]);
  await blocked('DELETE FROM "VoterParticipation" WHERE "periodId"=$1', [periodId]);
  await blocked('DELETE FROM "ElectionPeriod" WHERE id=$1', [periodId]);
});

test('confirmation mismatch and stale preview leave data untouched', async () => {
  assert.equal((await cleanup(periodId, 'cleanup-admin', 'HAPUS periode-resmi')).error, 'CONFIRMATION_MISMATCH');
  const old = await preview();
  await db.query('INSERT INTO "VotingAuditEvent" (id,"periodId",event) VALUES ($1,$2,$3)', [randomUUID(), periodId, 'PIN_RESET']);
  assert.equal((await cleanup(periodId, 'cleanup-admin', 'HAPUS periode-uji', old.version)).error, 'STALE_CLEANUP_PREVIEW');
  assert.equal(await count('Ballot'), 1);
  assert.equal(await count('ElectionPeriod'), 1);
});

test('a new ballot invalidates the preview even when no admin audit event changed', async () => {
  const old = await preview();
  const candidate = (await db.query<{id: string}>('SELECT id FROM "CandidatePair" WHERE "periodId"=$1', [periodId])).rows[0];
  await db.query('INSERT INTO "Ballot" (id,"periodId",organization,"candidateId") VALUES ($1,$2,$3,$4)', [randomUUID(), periodId, 'OSIS', candidate.id]);
  assert.equal((await cleanup(periodId, 'cleanup-admin', 'HAPUS periode-uji', old.version)).error, 'STALE_CLEANUP_PREVIEW');
  assert.equal(await count('Ballot'), 2);
});

test('database rejects inactive, revoked and non-superadmin actors and published test results', async () => {
  await db.query('UPDATE "AccountRole" SET role=$1 WHERE "accountId"=$2', ['staf', 'cleanup-admin']);
  assert.equal((await cleanup()).error, 'FORBIDDEN');
  await db.query('UPDATE "AccountRole" SET role=$1 WHERE "accountId"=$2', ['superadmin', 'cleanup-admin']);
  await db.query('INSERT INTO "AccountOverride" (id,"accountId",capability,effect) VALUES ($1,$2,$3,$4)', ['revoked', 'cleanup-admin', 'evoting.hapus-uji', 'revoke']);
  assert.equal((await cleanup()).error, 'FORBIDDEN');
  await db.query('DELETE FROM "AccountOverride" WHERE id=$1', ['revoked']);
  await db.query('UPDATE "Account" SET active=false WHERE id=$1', ['cleanup-admin']);
  assert.equal((await cleanup()).error, 'FORBIDDEN');
  await db.query('UPDATE "Account" SET active=true WHERE id=$1', ['cleanup-admin']);
  await db.query('UPDATE "ElectionPeriod" SET "publishedAt"=now() WHERE id=$1', [periodId]);
  assert.equal((await cleanup()).error, 'TEST_CLEANUP_NOT_ALLOWED');
});

test('a failure after ballot deletion rolls back every deletion and the new audit event', async () => {
  await db.exec(`CREATE FUNCTION force_cleanup_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced fixture failure'; END $$;
    CREATE TRIGGER force_cleanup_failure BEFORE DELETE ON "ElectionVoter" FOR EACH ROW EXECUTE FUNCTION force_cleanup_failure();`);
  await db.exec('SAVEPOINT atomic_cleanup');
  await assert.rejects(cleanup());
  await db.exec('ROLLBACK TO SAVEPOINT atomic_cleanup; RELEASE SAVEPOINT atomic_cleanup');
  assert.equal(await count('Ballot'), 1);
  assert.equal(await count('CandidatePair'), 1);
  assert.equal(await count('ElectionVoter'), 1);
  assert.equal(await count('VotingAuditEvent'), 1);
  assert.equal(await count('ElectionPeriod'), 1);
});
