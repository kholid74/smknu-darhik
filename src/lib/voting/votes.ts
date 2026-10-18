import { createHmac } from 'node:crypto';
import { db } from '../prisma';
import { requireEnv } from '../env';
import { nextStudentSessionExpiry } from './student-session';
import type { VoteInput } from './vote-input';
import { votingProgress } from './contests';

export class VoteError extends Error {
  constructor(public code: string) { super(code); }
}

async function checkVoteRate(sessionId: string) {
  const secret = requireEnv('VOTING_RATE_SECRET');
  if (Buffer.byteLength(secret) < 32) throw new Error('VOTING_RATE_SECRET must contain at least 32 bytes');
  const key = createHmac('sha256', secret).update(`student-vote\0${sessionId}`).digest('hex');
  const [{ attempts }] = await db.$queryRaw<[{ attempts: number }]>`
    INSERT INTO "VotingRateBucket" ("key", "attempts", "expiresAt") VALUES (${key}, 1, clock_timestamp() + interval '1 minute')
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN "VotingRateBucket"."expiresAt" <= clock_timestamp() THEN 1 ELSE "VotingRateBucket"."attempts" + 1 END,
      "expiresAt" = CASE WHEN "VotingRateBucket"."expiresAt" <= clock_timestamp() THEN clock_timestamp() + interval '1 minute' ELSE "VotingRateBucket"."expiresAt" END
    RETURNING "attempts"
  `;
  if (attempts > 60) throw new VoteError('RATE_LIMITED');
}

export async function submitVote(sessionId: string, voterId: string, periodId: string, input: VoteInput) {
  await checkVoteRate(sessionId);
  const result = await db.$transaction(async (tx) => {
    const periods = await tx.$queryRaw<Array<{ state: string; opensAt: Date; closesAt: Date }>>`
      SELECT "state", "opensAt", "closesAt" FROM "ElectionPeriod" WHERE "id" = ${periodId}::uuid FOR SHARE`;
    if (!periods.length) return { error: 'ELECTION_NOT_OPEN' as const };
    const voters = await tx.$queryRaw<Array<{ credentialEnabled: boolean }>>`
      SELECT "credentialEnabled" FROM "ElectionVoter" WHERE "id" = ${voterId}::uuid AND "periodId" = ${periodId}::uuid FOR UPDATE`;
    if (!voters.length) return { error: 'UNAUTHENTICATED' as const };
    const sessions = await tx.$queryRaw<Array<{ scope: string; createdAt: Date; expiresAt: Date }>>`
      SELECT "scope", "createdAt", "expiresAt" FROM "VotingSession" WHERE "id" = ${sessionId}::uuid AND "voterId" = ${voterId}::uuid FOR UPDATE`;
    const [{ now }] = await tx.$queryRaw<[{ now: Date }]>`SELECT clock_timestamp() AS "now"`;
    const session = sessions[0];
    if (!session || session.scope !== 'ELECTION_VOTING' || !voters[0].credentialEnabled ||
        session.expiresAt <= now || session.createdAt.getTime() + 15 * 60_000 <= now.getTime()) {
      await tx.votingSession.deleteMany({ where: { id: sessionId, voterId } });
      return { error: 'UNAUTHENTICATED' as const };
    }
    const period = periods[0];
    if (period.state !== 'SCHEDULED' || period.opensAt > now || period.closesAt <= now) {
      await tx.votingSession.deleteMany({ where: { id: sessionId, voterId } });
      return { error: 'ELECTION_NOT_OPEN' as const };
    }
    const contests = await tx.electionContest.findMany({ where: { periodId }, select: { organization: true, sortOrder: true } });
    const rights = await tx.voterParticipation.findMany({ where: { voterId, periodId }, select: { organization: true, hasVoted: true } });
    votingProgress(contests, rights);
    if (!contests.some(c => c.organization === input.organization)) throw new VoteError('INVALID_ORGANIZATION');
    const candidate = await tx.candidatePair.findFirst({ where: { id: input.candidateId, periodId, organization: input.organization }, select: { id: true } });
    if (!candidate) throw new VoteError('INVALID_CANDIDATE');
    const updated = await tx.voterParticipation.updateMany({
      where: { voterId, periodId, organization: input.organization, hasVoted: false },
      data: { hasVoted: true },
    });
    if (updated.count !== 1) throw new VoteError('ALREADY_VOTED');
    await tx.ballot.create({ data: { periodId, organization: input.organization, candidateId: candidate.id } });
    const participation = await tx.voterParticipation.findMany({ where: { voterId, periodId }, select: { organization: true, hasVoted: true } });
    const { complete, nextOrganization } = votingProgress(contests, participation);
    if (complete) await tx.votingSession.delete({ where: { id: sessionId } });
    else {
      const expiry = nextStudentSessionExpiry(session.createdAt, now, period.closesAt);
      await tx.votingSession.update({ where: { id: sessionId }, data: { lastSeenAt: now, expiresAt: expiry.idleExpiresAt } });
    }
    return { recorded: true as const, complete, nextOrganization };
  }, { maxWait: 2_000, timeout: 5_000 });
  if ('error' in result) throw new VoteError(result.error);
  return result;
}
