import type { Prisma } from '@prisma/client';
import { publicResultSnapshot } from './result-snapshot';
import { publicContests, votingProgress } from './contests';
import { PeriodError, validateCloseReason } from './period-input';

export async function closePeriodTransaction(tx: Prisma.TransactionClient, periodId: string, actorAccountId: string, early = false, reason?: string) {
  const closeReason = validateCloseReason(early, reason);
  const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "ElectionPeriod" WHERE "id" = ${periodId}::uuid FOR UPDATE`;
  if (!locked.length) throw new PeriodError('NOT_FOUND');
  const period = await tx.electionPeriod.findUniqueOrThrow({ where: { id: periodId }, include: {
    voters: { select: { id: true, participation: { select: { organization: true, hasVoted: true } } } },
    contests: { orderBy: { sortOrder: 'asc' }, include: { candidates: { include: { members: { select: { position: true, studentId: true, nameSnapshot: true, classSnapshot: true, photoUrl: true } } } } } },
  } });
  const activeActor = await tx.account.findUnique({ where: { id: actorAccountId }, select: { active: true } });
  if (!activeActor?.active) throw new PeriodError('INVALID_REAUTH');
  if (period.state === 'CLOSED' || period.state === 'ARCHIVED') return { state: period.state, closedAt: period.closedAt };
  if (period.state !== 'SCHEDULED') throw new PeriodError('INVALID_STATE');
  const [{ now }] = await tx.$queryRaw<[{ now: Date }]>`SELECT clock_timestamp() AS "now"`;
  const earlyClose = period.closesAt > now;
  if (period.opensAt > now || (earlyClose && !early)) throw new PeriodError('BEFORE_DEADLINE');

  let metadata: ReturnType<typeof publicContests>;
  try {
    metadata = publicContests(period.contests);
    period.voters.forEach(voter => votingProgress(metadata, voter.participation));
  } catch (error) {
    if (error instanceof Error && error.message === 'RECONCILIATION_FAILED') throw new PeriodError('RECONCILIATION_FAILED');
    throw error;
  }
  const organizations = metadata.map(c => c.organization), n = organizations.length;
  const [totals] = await tx.$queryRaw<Array<{ eligible: bigint; notStarted: bigint; partial: bigint; complete: bigint }>>`SELECT COUNT(*) AS "eligible", COUNT(*) FILTER (WHERE votes = 0) AS "notStarted", COUNT(*) FILTER (WHERE votes > 0 AND votes < ${n}) AS "partial", COUNT(*) FILTER (WHERE votes = ${n}) AS "complete" FROM (SELECT v."id", COUNT(*) FILTER (WHERE p."hasVoted" IS TRUE) AS votes FROM "ElectionVoter" v LEFT JOIN "VoterParticipation" p ON p."voterId" = v."id" AND p."periodId" = v."periodId" WHERE v."periodId" = ${periodId}::uuid GROUP BY v."id") roster`;
  const eligibleVoters = Number(totals.eligible);
  const notStarted = Number(totals.notStarted);
  const partial = Number(totals.partial);
  const complete = Number(totals.complete);
  if (notStarted + partial + complete !== eligibleVoters || eligibleVoters !== period.voters.length) throw new PeriodError('RECONCILIATION_FAILED');
  const [participationCounts, ballotCounts] = await Promise.all([
    tx.$queryRaw<Array<{ organization: string; count: bigint }>>`SELECT "organization", COUNT(*) AS "count" FROM "VoterParticipation" WHERE "periodId" = ${periodId}::uuid AND "hasVoted" GROUP BY "organization"`,
    tx.$queryRaw<Array<{ organization: string; candidateId: string; count: bigint }>>`SELECT "organization", "candidateId", COUNT(*) AS "count" FROM "Ballot" WHERE "periodId" = ${periodId}::uuid GROUP BY "organization", "candidateId"`,
  ]);
  if (period.contests.length !== organizations.length || period.voters.length === 0 || period.voters.length > 99) throw new PeriodError('RECONCILIATION_FAILED');
  const participation = new Map(participationCounts.map((row) => [row.organization, Number(row.count)]));
  const ballots = new Map<string, number>();
  for (const row of ballotCounts) ballots.set(`${row.organization}:${row.candidateId}`, Number(row.count));
  const candidateIds = new Set(period.contests.flatMap(c=>c.candidates.map(p=>p.id)));
  if (participationCounts.some(r=>!organizations.includes(r.organization)) || ballotCounts.some(r=>!organizations.includes(r.organization)||!candidateIds.has(r.candidateId))) throw new PeriodError('RECONCILIATION_FAILED');
  const contests = period.contests.map((contest, index) => {
    if (!organizations.includes(contest.organization) || !contest.candidates.length) throw new PeriodError('RECONCILIATION_FAILED');
    const candidates = contest.candidates.map((candidate) => {
      const chair = candidate.members.find((member) => member.position === 'CHAIR');
      const viceChair = candidate.members.find((member) => member.position === 'VICE_CHAIR');
      if (!chair || candidate.members.length !== (viceChair ? 2 : 1) || (viceChair && chair.studentId===viceChair.studentId)) throw new PeriodError('RECONCILIATION_FAILED');
      return { candidateId: candidate.id, ballotNumber: candidate.ballotNumber, vision: candidate.vision, mission: candidate.mission,
        chair: { name: chair.nameSnapshot, className: chair.classSnapshot, photoUrl: chair.photoUrl },
        viceChair: viceChair ? { name: viceChair.nameSnapshot, className: viceChair.classSnapshot, photoUrl: viceChair.photoUrl } : null,
        votes: ballots.get(`${contest.organization}:${candidate.id}`) ?? 0 };
    });
    const votesCast = candidates.reduce((total, candidate) => total + candidate.votes, 0);
    if (votesCast !== (participation.get(contest.organization) ?? 0)) throw new PeriodError('RECONCILIATION_FAILED');
    return { ...metadata[index], votesCast, candidates };
  });
  const snapshot = publicResultSnapshot({ version: 2, eligibleVoters, notStarted, partial, complete, contests });
  if (!snapshot) throw new PeriodError('RECONCILIATION_FAILED');
  const closedAt = now;
  await tx.electionPeriod.update({ where: { id: periodId }, data: { state: 'CLOSED', closedAt, resultSnapshot: snapshot } });
  await tx.votingSession.deleteMany({ where: { voter: { periodId } } });
  await tx.votingAuditEvent.create({ data: {
    periodId, actorAccountId, event: 'PERIOD_CLOSED', targetId: periodId,
    reasonCode: earlyClose ? 'COMMITTEE_EARLY_CLOSE' : 'DEADLINE_REACHED',
    detail: { earlyClose, ...(closeReason === undefined ? {} : { reason: closeReason }), scheduledClosesAt: period.closesAt.toISOString(), closedAt: closedAt.toISOString(), eligibleVoters, notStarted, partial, complete, votesCast: contests.map(({ organization, votesCast }) => ({ organization, votesCast })) },
  } });
  return { state: 'CLOSED' as const, closedAt };
}
