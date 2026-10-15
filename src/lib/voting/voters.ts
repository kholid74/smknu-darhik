import { db } from '../prisma';
import { VotingOrganization } from '@prisma/client';
import { PeriodError } from './period-input';
import { RosterError, type RosterStudentInput } from './voter-roster-input';
import { reauthenticateAdmin } from './periods';
import { buildMasterRosterInserts, planMasterRoster } from './master-roster';

async function assertRosterEditable(tx: any, periodId: string, lock: boolean) {
  const rows = lock
    ? await tx.$queryRawUnsafe('SELECT "state", "opensAt" FROM "ElectionPeriod" WHERE "id" = $1 FOR UPDATE', periodId)
    : await tx.$queryRawUnsafe('SELECT "state", "opensAt" FROM "ElectionPeriod" WHERE "id" = $1', periodId);
  if (!rows[0]) throw new PeriodError('NOT_FOUND');
  const [{ now }] = await tx.$queryRawUnsafe('SELECT clock_timestamp() AS "now"');
  if (!['DRAFT', 'SCHEDULED'].includes(rows[0].state) || new Date(now) >= new Date(rows[0].opensAt)) throw new PeriodError('INVALID_STATE');
}

export async function previewMasterRoster(periodId: string) {
  const period = await db.electionPeriod.findUnique({ where: { id: periodId }, select: { academicYear: true, state: true, opensAt: true } });
  if (!period) throw new PeriodError('NOT_FOUND');
  const [{ now }] = await db.$queryRaw<[{ now: Date }]>`SELECT clock_timestamp() AS "now"`;
  if (!['DRAFT', 'SCHEDULED'].includes(period.state) || now >= period.opensAt) throw new PeriodError('INVALID_STATE');
  const [students, currentCount, existing] = await Promise.all([
    db.student.findMany({ where: { schoolClass: { academicYear: period.academicYear } }, select: { id: true, nisn: true, name: true, className: true } }),
    db.electionVoter.count({ where: { periodId } }),
    db.electionVoter.findMany({ where: { periodId }, select: { studentId: true, nisn: true } }),
  ]);
  const plan = planMasterRoster(students, existing);
  return { academicYear: period.academicYear, eligibleCount: students.length, currentCount,
    alreadyPresent: plan.alreadyPresent, additions: plan.additions.length,
    projectedCount: currentCount + plan.additions.length, canSync: !plan.nisnConflict && currentCount + plan.additions.length <= 99 };
}

export async function syncMasterRoster(periodId: string, actorAccountId: string) {
  return db.$transaction(async (tx) => {
    await assertRosterEditable(tx, periodId, true);
    const period = await tx.electionPeriod.findUniqueOrThrow({ where: { id: periodId }, select: { academicYear: true } });
    const students = await tx.student.findMany({ where: { schoolClass: { academicYear: period.academicYear } }, select: { id: true, nisn: true, name: true, className: true } });
    const existing = await tx.electionVoter.findMany({ where: { periodId }, select: { studentId: true, nisn: true } });
    const plan = planMasterRoster(students, existing);
    if (plan.nisnConflict) throw new RosterError('NISN_ALREADY_ROSTERED');
    if (existing.length + plan.additions.length > 99) throw new RosterError('ROSTER_LIMIT');
    if (plan.additions.length) {
      const inserts = buildMasterRosterInserts(periodId, plan.additions, Object.values(VotingOrganization));
      await tx.electionVoter.createMany({ data: inserts.voters });
      await tx.voterParticipation.createMany({ data: inserts.participation });
    }
    await tx.votingAuditEvent.create({ data: { periodId, actorAccountId, event: 'ROSTER_MASTER_SYNCED', targetId: periodId,
      detail: { academicYear: period.academicYear, eligible: students.length, added: plan.additions.length, alreadyPresent: plan.alreadyPresent } } });
    return { academicYear: period.academicYear, eligible: students.length, added: plan.additions.length,
      alreadyPresent: plan.alreadyPresent, total: existing.length + plan.additions.length };
  }, { timeout: 15_000 });
}

export async function listVoters(periodId: string, cursor: string | null, limit: number, className: string | null) {
  return db.electionVoter.findMany({
    where: { periodId, ...(className ? { className } : {}) },
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, nisn: true, name: true, className: true, credentialEnabled: true, pinVersion: true, pinHash: true },
    orderBy: [{ className: 'asc' }, { name: 'asc' }, { id: 'asc' }], take: Math.min(Math.max(limit, 1), 100),
  }).then((rows) => rows.map(({ pinHash, ...row }) => ({ ...row, pinIssued: pinHash !== null })));
}

export async function syncVoterFromMaster(periodId: string, voterId: string, expected: RosterStudentInput, actorAccountId: string,
  adminPassword?: string, reviewer?: { accountId: string; password: string }) {
  if (reviewer) {
    if (reviewer.accountId === actorAccountId) throw new RosterError('TWO_REVIEWERS_REQUIRED');
    if (!adminPassword) throw new RosterError('INVALID_INPUT');
    await reauthenticateAdmin(actorAccountId, adminPassword);
    await reauthenticateAdmin(reviewer.accountId, reviewer.password);
  }
  return db.$transaction(async (tx) => {
    const lockedPeriod = await tx.$queryRaw<Array<{ state: string; opensAt: Date; closesAt: Date }>>`SELECT "state", "opensAt", "closesAt" FROM "ElectionPeriod" WHERE "id" = ${periodId}::uuid FOR UPDATE`;
    if (!lockedPeriod.length) throw new PeriodError('NOT_FOUND');
    const [{ now }] = await tx.$queryRaw<[{ now: Date }]>`SELECT clock_timestamp() AS "now"`;
    const beforeOpen = ['DRAFT', 'SCHEDULED'].includes(lockedPeriod[0].state) && now < lockedPeriod[0].opensAt;
    const afterOpenCorrection = !!reviewer && lockedPeriod[0].state === 'SCHEDULED' && now >= lockedPeriod[0].opensAt && now < lockedPeriod[0].closesAt;
    if (!beforeOpen && !afterOpenCorrection) throw new PeriodError('INVALID_STATE');
    const lockedVoter = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "ElectionVoter" WHERE "id" = ${voterId}::uuid AND "periodId" = ${periodId}::uuid FOR UPDATE`;
    if (!lockedVoter.length) throw new RosterError('NOT_FOUND');
    const voter = await tx.electionVoter.findUniqueOrThrow({ where: { id: voterId }, select: {
      studentId: true, nisn: true, name: true, className: true, pinHash: true,
      participation: { where: { hasVoted: true }, select: { organization: true } },
    } });
    if (voter.nisn !== expected.nisn || voter.name !== expected.name || voter.className !== expected.className) throw new RosterError('STALE_ROSTER');
    if (voter.participation.length) throw new RosterError('VOTER_ALREADY_PARTICIPATED');
    const student = await tx.student.findUnique({ where: { id: voter.studentId }, select: { nisn: true, name: true, className: true } });
    if (!student) throw new RosterError('STUDENT_NOT_FOUND');
    if (afterOpenCorrection) {
      if (student.nisn === voter.nisn || student.name !== voter.name || student.className !== voter.className) throw new RosterError('POSTOPEN_NISN_ONLY');
      const activeReviewers = await tx.account.count({ where: { id: { in: [actorAccountId, reviewer!.accountId] }, active: true } });
      if (activeReviewers !== 2) throw new RosterError('TWO_REVIEWERS_REQUIRED');
      const updated = await tx.electionVoter.update({ where: { id: voterId }, data: {
        nisn: student.nisn, pinHash: null, pinFingerprint: null, credentialEnabled: false, pinVersion: { increment: 1 },
      } });
      await tx.votingSession.deleteMany({ where: { voterId } });
      await tx.votingAuditEvent.create({ data: {
        periodId, actorAccountId, event: 'VOTER_NISN_CORRECTED', targetId: voterId, reasonCode: 'OFFICIAL_NISN_CORRECTION',
        detail: { changedFields: ['nisn'], reviewerAccountId: reviewer!.accountId, pinRevoked: !!voter.pinHash },
      } });
      return { id: updated.id, nisn: updated.nisn, name: updated.name, className: updated.className, pinRevoked: true };
    }
    if (student.nisn === voter.nisn && student.name === voter.name && student.className === voter.className) {
      return { id: voterId, ...student, pinRevoked: false };
    }
    const updated = await tx.electionVoter.update({ where: { id: voterId }, data: {
      ...student, pinHash: null, pinFingerprint: null, credentialEnabled: false,
      ...(voter.pinHash ? { pinVersion: { increment: 1 } } : {}),
    } });
    if (student.nisn !== voter.nisn || student.name !== voter.name || student.className !== voter.className) {
      await tx.votingSession.deleteMany({ where: { voterId } });
      await tx.votingAuditEvent.create({ data: {
        periodId, actorAccountId, event: 'ROSTER_CORRECTED', targetId: voterId,
        detail: { changedFields: ['nisn', 'name', 'className'], pinRevoked: !!voter.pinHash },
      } });
    }
    return { id: updated.id, nisn: updated.nisn, name: updated.name, className: updated.className, pinRevoked: !!voter.pinHash };
  });
}

export async function removeVoterFromRoster(periodId: string, voterId: string, expected: RosterStudentInput, actorAccountId: string) {
  return db.$transaction(async (tx) => {
    const lockedPeriod = await tx.$queryRaw<Array<{ state: string; opensAt: Date }>>`SELECT "state", "opensAt" FROM "ElectionPeriod" WHERE "id" = ${periodId}::uuid FOR UPDATE`;
    if (!lockedPeriod.length) throw new PeriodError('NOT_FOUND');
    const [{ now }] = await tx.$queryRaw<[{ now: Date }]>`SELECT clock_timestamp() AS "now"`;
    if (!['DRAFT', 'SCHEDULED'].includes(lockedPeriod[0].state) || now >= lockedPeriod[0].opensAt) throw new PeriodError('INVALID_STATE');
    const lockedVoter = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "ElectionVoter" WHERE "id" = ${voterId}::uuid AND "periodId" = ${periodId}::uuid FOR UPDATE`;
    if (!lockedVoter.length) throw new RosterError('NOT_FOUND');
    const voter = await tx.electionVoter.findUniqueOrThrow({ where: { id: voterId }, select: {
      nisn: true, name: true, className: true,
      participation: { where: { hasVoted: true }, select: { organization: true } },
    } });
    if (voter.nisn !== expected.nisn || voter.name !== expected.name || voter.className !== expected.className) throw new RosterError('STALE_ROSTER');
    if (voter.participation.length) throw new RosterError('VOTER_ALREADY_PARTICIPATED');
    await tx.votingAuditEvent.create({ data: { periodId, actorAccountId, event: 'ROSTER_VOTER_REMOVED', targetId: voterId, detail: {} } });
    await tx.voterParticipation.deleteMany({ where: { voterId, periodId, hasVoted: false } });
    await tx.electionVoter.delete({ where: { id: voterId } });
  });
}
