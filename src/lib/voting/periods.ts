import { closePeriodTransaction } from './period-close';
import { canEditElectionSetup, electionSetup } from './setup-readiness';
import { VotingOrganization } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { db } from '../prisma';
import { requireEnv } from '../env';
import { verifyPassword } from '../auth';
import { PeriodError, type PeriodConfig, type PeriodInput } from './period-input';

export async function listPeriods() {
  return db.electionPeriod.findMany({
    select: { id: true, slug: true, name: true, academicYear: true, isTest: true, state: true, opensAt: true, closesAt: true, createdAt: true },
    orderBy: [{ opensAt: 'desc' }, { id: 'desc' }],
  });
}

export async function createPeriod(input: PeriodInput, actorAccountId: string) {
  return db.$transaction(async (tx) => {
    const [{ now }] = await tx.$queryRaw<[{ now: Date }]>`SELECT clock_timestamp() AS "now"`;
    if (input.opensAt <= now) throw Object.assign(new Error('INVALID_SCHEDULE'), { code: 'INVALID_SCHEDULE' });
    const period = await tx.electionPeriod.create({ data: {
      ...input,
      contests: { create: Object.values(VotingOrganization).map((organization) => ({ organization })) },
    } });
    await tx.votingAuditEvent.create({ data: {
      periodId: period.id, actorAccountId, event: 'PERIOD_CREATED', targetId: period.id,
      detail: { slug: period.slug, isTest: period.isTest, organizations: Object.values(VotingOrganization) },
    } });
    return period;
  });
}

export async function getPeriod(periodId: string) {
  return db.electionPeriod.findUnique({
    where: { id: periodId },
    select: { id: true, slug: true, name: true, academicYear: true, isTest: true, state: true, opensAt: true, closesAt: true, extensionUsedAt: true, closedAt: true, publishedAt: true,
      contests: { select: { organization: true, _count: { select: { candidates: true } } }, orderBy: { organization: 'asc' } } },
  });
}

export async function getPeriodSetup(periodId:string){
  return db.$transaction(async tx=>{
    const period=await tx.electionPeriod.findUnique({where:{id:periodId},select:{
      opensAt:true,closesAt:true,
      contests:{select:{organization:true,candidates:{select:{members:{select:{position:true,studentId:true}}}}}},
      voters:{select:{credentialEnabled:true,pinHash:true,pinFingerprint:true,participation:{select:{organization:true}}}},
    }});
    if(!period)return null;
    const [{now}]=await tx.$queryRaw<[{now:Date}]>`SELECT clock_timestamp() AS "now"`;
    return electionSetup(period,now);
  });
}

export async function updatePeriod(periodId: string, input: PeriodConfig, expected: PeriodConfig, actorAccountId: string) {
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "ElectionPeriod" WHERE "id" = ${periodId}::uuid FOR UPDATE`;
    if (!locked.length) throw new PeriodError('NOT_FOUND');
    const current = await tx.electionPeriod.findUniqueOrThrow({ where: { id: periodId } });
    if (current.name !== expected.name || current.academicYear !== expected.academicYear ||
        current.opensAt.getTime() !== expected.opensAt.getTime() || current.closesAt.getTime() !== expected.closesAt.getTime()) {
      throw new PeriodError('STALE_CONFIG');
    }
    const [{ now }] = await tx.$queryRaw<[{ now: Date }]>`SELECT clock_timestamp() AS "now"`;
    if (!canEditElectionSetup(current, now)) throw new PeriodError('INVALID_STATE');
    if (input.opensAt <= now || input.closesAt <= input.opensAt) throw new PeriodError('INVALID_SCHEDULE');
    const updated = await tx.electionPeriod.update({ where: { id: periodId }, data: input });
    await tx.votingAuditEvent.create({ data: {
      periodId, actorAccountId, event: 'PERIOD_UPDATED', targetId: periodId,
      detail: { before: { name: current.name, academicYear: current.academicYear, opensAt: current.opensAt, closesAt: current.closesAt },
        after: { name: input.name, academicYear: input.academicYear, opensAt: input.opensAt, closesAt: input.closesAt } },
    } });
    return updated;
  });
}

export async function schedulePeriod(periodId: string, actorAccountId: string) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(74190231)`;
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "ElectionPeriod" WHERE "id" = ${periodId}::uuid FOR UPDATE`;
    if (!locked.length) throw new PeriodError('NOT_FOUND');
    const period = await tx.electionPeriod.findUniqueOrThrow({ where: { id: periodId }, include: {
      contests: { include: { candidates: { include: { members: { select: { position: true, studentId: true } } } } } },
      voters: { select: { credentialEnabled: true, pinHash: true, pinFingerprint: true, participation: { select: { organization: true } } } },
    } });
    if (period.state !== 'DRAFT') throw new PeriodError('INVALID_STATE');
    const [{ now }] = await tx.$queryRaw<[{ now: Date }]>`SELECT clock_timestamp() AS "now"`;
    if (period.opensAt <= now || period.closesAt <= period.opensAt) throw new PeriodError('INVALID_SCHEDULE');
    const organizations = Object.values(VotingOrganization);
    if (!electionSetup(period,now).ready) throw new PeriodError('NOT_READY');
    const otherScheduled = await tx.electionPeriod.findFirst({ where: { id: { not: periodId }, state: 'SCHEDULED' }, select: { id: true } });
    if (otherScheduled) throw new PeriodError('ANOTHER_SCHEDULED_PERIOD');
    await tx.electionPeriod.update({ where: { id: periodId }, data: { state: 'SCHEDULED' } });
    await tx.votingAuditEvent.create({ data: {
      periodId, actorAccountId, event: 'PERIOD_SCHEDULED', targetId: periodId,
      detail: { voterCount: period.voters.length, organizations, candidateCounts: period.contests.map(({ organization, candidates }) => ({ organization, count: candidates.length })) },
    } });
    return { state: 'SCHEDULED' as const };
  });
}

export async function archivePeriod(periodId: string, actorAccountId: string) {
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "ElectionPeriod" WHERE "id" = ${periodId}::uuid FOR UPDATE`;
    if (!locked.length) throw new PeriodError('NOT_FOUND');
    const period = await tx.electionPeriod.findUniqueOrThrow({ where: { id: periodId }, select: { state: true } });
    if (period.state === 'ARCHIVED') return { state: 'ARCHIVED' as const };
    if (period.state !== 'CLOSED') throw new PeriodError('INVALID_STATE');
    await tx.electionPeriod.update({ where: { id: periodId }, data: { state: 'ARCHIVED' } });
    await tx.votingAuditEvent.create({ data: {
      periodId, actorAccountId, event: 'PERIOD_ARCHIVED', targetId: periodId, detail: {},
    } });
    return { state: 'ARCHIVED' as const };
  });
}

export async function reauthenticateAdmin(actorAccountId: string, adminPassword: string) {
  const secret = requireEnv('VOTING_RATE_SECRET');
  if (Buffer.byteLength(secret) < 32) throw new Error('VOTING_RATE_SECRET must contain at least 32 bytes');
  const key = createHmac('sha256', secret).update(`admin-reauth\0${actorAccountId}`).digest('hex');
  const [{ attempts }] = await db.$queryRaw<[{ attempts: number }]>`
    INSERT INTO "VotingRateBucket" ("key", "attempts", "expiresAt") VALUES (${key}, 1, clock_timestamp() + interval '15 minutes')
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN "VotingRateBucket"."expiresAt" <= clock_timestamp() THEN 1 ELSE "VotingRateBucket"."attempts" + 1 END,
      "expiresAt" = CASE WHEN "VotingRateBucket"."expiresAt" <= clock_timestamp() THEN clock_timestamp() + interval '15 minutes' ELSE "VotingRateBucket"."expiresAt" END
    RETURNING "attempts"
  `;
  if (attempts > 5) throw new PeriodError('RATE_LIMITED');
  const account = await db.account.findUnique({ where: { id: actorAccountId }, select: { active: true, passwordHash: true } });
  if (!account?.active || !await verifyPassword(adminPassword, account.passwordHash)) throw new PeriodError('INVALID_REAUTH');
}

export async function extendPeriod(periodId: string, actorAccountId: string, adminPassword: string, reasonCode: string) {
  await reauthenticateAdmin(actorAccountId, adminPassword);
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "ElectionPeriod" WHERE "id" = ${periodId}::uuid FOR UPDATE`;
    if (!locked.length) throw new PeriodError('NOT_FOUND');
    const period = await tx.electionPeriod.findUniqueOrThrow({ where: { id: periodId }, select: { state: true, opensAt: true, closesAt: true, extensionUsedAt: true } });
    const [{ now }] = await tx.$queryRaw<[{ now: Date }]>`SELECT clock_timestamp() AS "now"`;
    if (period.state !== 'SCHEDULED' || period.extensionUsedAt || period.opensAt > now || period.closesAt <= now) {
      throw new PeriodError('EXTENSION_UNAVAILABLE');
    }
    const activeActor = await tx.account.findUnique({ where: { id: actorAccountId }, select: { active: true } });
    if (!activeActor?.active) throw new PeriodError('INVALID_REAUTH');
    const closesAt = new Date(period.closesAt.getTime() + 60 * 60_000);
    await tx.electionPeriod.update({ where: { id: periodId }, data: { closesAt, extensionUsedAt: now } });
    await tx.votingAuditEvent.create({ data: {
      periodId, actorAccountId, event: 'PERIOD_EXTENDED', targetId: periodId, reasonCode,
      detail: { previousClosesAt: period.closesAt, closesAt, extensionMinutes: 60 },
    } });
    return { closesAt, extensionUsedAt: now };
  });
}

export async function closePeriod(periodId: string, actorAccountId: string, adminPassword: string, early = false) {
  await reauthenticateAdmin(actorAccountId, adminPassword);
  return db.$transaction((tx) => closePeriodTransaction(tx, periodId, actorAccountId, early), { maxWait: 2_000, timeout: 10_000 });
}

export async function publishPeriod(periodId: string, actorAccountId: string, adminPassword: string) {
  await reauthenticateAdmin(actorAccountId, adminPassword);
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "ElectionPeriod" WHERE "id" = ${periodId}::uuid FOR UPDATE`;
    if (!locked.length) throw new PeriodError('NOT_FOUND');
    const period = await tx.electionPeriod.findUniqueOrThrow({ where: { id: periodId }, select: { state: true, publishedAt: true, resultSnapshot: true } });
    const activeActor = await tx.account.findUnique({ where: { id: actorAccountId }, select: { active: true } });
    if (!activeActor?.active) throw new PeriodError('INVALID_REAUTH');
    if (period.publishedAt) return { publishedAt: period.publishedAt };
    if (period.state !== 'CLOSED' || !period.resultSnapshot) throw new PeriodError('INVALID_STATE');
    const [{ now }] = await tx.$queryRaw<[{ now: Date }]>`SELECT clock_timestamp() AS "now"`;
    const updated = await tx.electionPeriod.update({ where: { id: periodId }, data: { publishedAt: now } });
    await tx.votingAuditEvent.create({ data: {
      periodId, actorAccountId, event: 'PERIOD_PUBLISHED', targetId: periodId, detail: {},
    } });
    return { publishedAt: updated.publishedAt! };
  });
}
