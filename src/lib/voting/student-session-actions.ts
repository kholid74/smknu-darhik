import { createHmac } from 'node:crypto';
import { db } from '../prisma';
import { requireEnv } from '../env';
import { isActiveVotingSession, nextStudentSessionExpiry } from './student-session';
import { votingProgress } from './contests';

export class StudentSessionError extends Error {
  constructor(public code: string) { super(code); }
}

async function checkActivityRate(sessionId: string) {
  const secret = requireEnv('VOTING_RATE_SECRET');
  if (Buffer.byteLength(secret) < 32) throw new Error('VOTING_RATE_SECRET must contain at least 32 bytes');
  const key = createHmac('sha256', secret).update(`student-activity\0${sessionId}`).digest('hex');
  const [{ attempts }] = await db.$queryRaw<[{ attempts: number }]>`
    INSERT INTO "VotingRateBucket" ("key", "attempts", "expiresAt") VALUES (${key}, 1, clock_timestamp() + interval '1 minute')
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN "VotingRateBucket"."expiresAt" <= clock_timestamp() THEN 1 ELSE "VotingRateBucket"."attempts" + 1 END,
      "expiresAt" = CASE WHEN "VotingRateBucket"."expiresAt" <= clock_timestamp() THEN clock_timestamp() + interval '1 minute' ELSE "VotingRateBucket"."expiresAt" END
    RETURNING "attempts"
  `;
  if (attempts > 60) throw new StudentSessionError('RATE_LIMITED');
}

export async function extendStudentSession(sessionId: string, voterId: string, periodId: string) {
  await checkActivityRate(sessionId);
  const result = await db.$transaction(async (tx) => {
    const period = await tx.$queryRaw<Array<{ state: string; opensAt: Date; closesAt: Date }>>`
      SELECT "state", "opensAt", "closesAt" FROM "ElectionPeriod" WHERE "id" = ${periodId}::uuid FOR SHARE`;
    if (!period.length) throw new StudentSessionError('UNAUTHENTICATED');
    await tx.$queryRaw`SELECT "id" FROM "ElectionVoter" WHERE "id" = ${voterId}::uuid AND "periodId" = ${periodId}::uuid FOR UPDATE`;
    const sessions = await tx.$queryRaw<Array<{ id: string; scope: string; createdAt: Date; expiresAt: Date }>>`
      SELECT "id", "scope", "createdAt", "expiresAt" FROM "VotingSession" WHERE "id" = ${sessionId}::uuid AND "voterId" = ${voterId}::uuid FOR UPDATE`;
    const [{ now }] = await tx.$queryRaw<[{ now: Date }]>`SELECT clock_timestamp() AS "now"`;
    const voter = await tx.electionVoter.findUnique({ where: { id: voterId }, select: {
      credentialEnabled: true,
      participation: { select: { organization: true, hasVoted: true } },
    } });
    const contests = await tx.electionContest.findMany({ where: { periodId }, select: { organization: true, sortOrder: true } });
    const complete = voter ? votingProgress(contests, voter.participation).complete : false;
    if (!sessions.length || !voter || !isActiveVotingSession({
      scope: sessions[0].scope, createdAt: sessions[0].createdAt, expiresAt: sessions[0].expiresAt,
      credentialEnabled: voter.credentialEnabled, periodState: period[0].state,
      opensAt: period[0].opensAt, closesAt: period[0].closesAt,
      completed: complete,
    }, now)) {
      await tx.votingSession.deleteMany({ where: { id: sessionId, voterId } });
      return null;
    }
    const expiry = nextStudentSessionExpiry(sessions[0].createdAt, now, period[0].closesAt);
    await tx.votingSession.update({ where: { id: sessionId }, data: { lastSeenAt: now, expiresAt: expiry.idleExpiresAt } });
    return expiry;
  });
  if (!result) throw new StudentSessionError('ELECTION_NOT_OPEN');
  return result;
}

export async function revokeStudentSession(tokenHash: string) {
  const session = await db.votingSession.findUnique({ where: { tokenHash }, select: { id: true, voterId: true, voter: { select: { periodId: true } } } });
  if (!session) return false;
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "ElectionPeriod" WHERE "id" = ${session.voter.periodId}::uuid FOR SHARE`;
    await tx.$queryRaw`SELECT "id" FROM "ElectionVoter" WHERE "id" = ${session.voterId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "VotingSession" WHERE "id" = ${session.id}::uuid FOR UPDATE`;
    const deleted = await tx.votingSession.deleteMany({ where: { id: session.id, tokenHash } });
    return deleted.count === 1;
  });
}
