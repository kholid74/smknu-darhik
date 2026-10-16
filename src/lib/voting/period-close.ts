import { VotingOrganization, type Prisma } from '@prisma/client';
import { PeriodError } from './period-input';

export async function closePeriodTransaction(tx: Prisma.TransactionClient, periodId: string, actorAccountId: string, early = false) {
  const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "ElectionPeriod" WHERE "id" = ${periodId}::uuid FOR UPDATE`;
  if (!locked.length) throw new PeriodError('NOT_FOUND');
  const period = await tx.electionPeriod.findUniqueOrThrow({ where: { id: periodId }, include: {
    voters: { select: { id: true } },
    contests: { include: { candidates: { include: { members: { select: { position: true, nameSnapshot: true, classSnapshot: true, photoUrl: true } } } } } },
  } });
  if (period.state === 'CLOSED' || period.state === 'ARCHIVED') return { state: period.state, closedAt: period.closedAt };
  if (period.state !== 'SCHEDULED') throw new PeriodError('INVALID_STATE');
  const [{ now }] = await tx.$queryRaw<[{ now: Date }]>`SELECT clock_timestamp() AS "now"`;
  const earlyClose = period.closesAt > now;
  if (period.opensAt > now || (earlyClose && !early)) throw new PeriodError('BEFORE_DEADLINE');
  const activeActor = await tx.account.findUnique({ where: { id: actorAccountId }, select: { active: true } });
  if (!activeActor?.active) throw new PeriodError('INVALID_REAUTH');

  const organizations = Object.values(VotingOrganization);
  const [totals] = await tx.$queryRaw<Array<{ eligible: bigint; notStarted: bigint; partial: bigint; complete: bigint }>>`SELECT COUNT(*) AS "eligible", COUNT(*) FILTER (WHERE votes = 0) AS "notStarted", COUNT(*) FILTER (WHERE votes BETWEEN 1 AND 3) AS "partial", COUNT(*) FILTER (WHERE votes = 4) AS "complete" FROM (SELECT v."id", COUNT(*) FILTER (WHERE p."hasVoted" IS TRUE) AS votes FROM "ElectionVoter" v LEFT JOIN "VoterParticipation" p ON p."voterId" = v."id" AND p."periodId" = v."periodId" WHERE v."periodId" = ${periodId}::uuid GROUP BY v."id") roster`;
  const eligibleVoters = Number(totals.eligible);
  const notStarted = Number(totals.notStarted);
  const partial = Number(totals.partial);
  const complete = Number(totals.complete);
  // Check completion before reading candidate tallies; disabled credentials still count in the roster.
  if (earlyClose && (!eligibleVoters || complete !== eligibleVoters || notStarted || partial)) throw new PeriodError('EARLY_CLOSE_INCOMPLETE');
  if (notStarted + partial + complete !== eligibleVoters || eligibleVoters !== period.voters.length) throw new PeriodError('RECONCILIATION_FAILED');
  const [participationCounts, ballotCounts] = await Promise.all([
    tx.$queryRaw<Array<{ organization: VotingOrganization; count: bigint }>>`SELECT "organization", COUNT(*) AS "count" FROM "VoterParticipation" WHERE "periodId" = ${periodId}::uuid AND "hasVoted" GROUP BY "organization"`,
    tx.$queryRaw<Array<{ organization: VotingOrganization; candidateId: string; count: bigint }>>`SELECT "organization", "candidateId", COUNT(*) AS "count" FROM "Ballot" WHERE "periodId" = ${periodId}::uuid GROUP BY "organization", "candidateId"`,
  ]);
  if (period.contests.length !== organizations.length || period.voters.length === 0 || period.voters.length > 99) throw new PeriodError('RECONCILIATION_FAILED');
  const participation = new Map(participationCounts.map((row) => [row.organization, Number(row.count)]));
  const ballots = new Map<string, number>();
  for (const row of ballotCounts) ballots.set(`${row.organization}:${row.candidateId}`, Number(row.count));
  const contests = period.contests.map((contest) => {
    if (!organizations.includes(contest.organization) || !contest.candidates.length) throw new PeriodError('RECONCILIATION_FAILED');
    const candidates = contest.candidates.map((candidate) => {
      const chair = candidate.members.find((member) => member.position === 'CHAIR');
      const viceChair = candidate.members.find((member) => member.position === 'VICE_CHAIR');
      if (!chair || candidate.members.length !== (viceChair ? 2 : 1)) throw new PeriodError('RECONCILIATION_FAILED');
      return { candidateId: candidate.id, ballotNumber: candidate.ballotNumber, vision: candidate.vision, mission: candidate.mission,
        chair: { name: chair.nameSnapshot, className: chair.classSnapshot, photoUrl: chair.photoUrl },
        viceChair: viceChair ? { name: viceChair.nameSnapshot, className: viceChair.classSnapshot, photoUrl: viceChair.photoUrl } : null,
        votes: ballots.get(`${contest.organization}:${candidate.id}`) ?? 0 };
    });
    const votesCast = candidates.reduce((total, candidate) => total + candidate.votes, 0);
    if (votesCast !== (participation.get(contest.organization) ?? 0)) throw new PeriodError('RECONCILIATION_FAILED');
    return { organization: contest.organization, votesCast, candidates };
  });
  const snapshot = { version: 1, eligibleVoters, notStarted, partial, complete, contests };
  const closedAt = now;
  await tx.electionPeriod.update({ where: { id: periodId }, data: { state: 'CLOSED', closedAt, resultSnapshot: snapshot } });
  await tx.votingSession.deleteMany({ where: { voter: { periodId } } });
  await tx.votingAuditEvent.create({ data: {
    periodId, actorAccountId, event: 'PERIOD_CLOSED', targetId: periodId,
    reasonCode: earlyClose ? 'ALL_VOTERS_COMPLETED' : 'DEADLINE_REACHED',
    detail: { earlyClose, scheduledClosesAt: period.closesAt.toISOString(), closedAt: closedAt.toISOString(), eligibleVoters, notStarted, partial, complete, votesCast: contests.map(({ organization, votesCast }) => ({ organization, votesCast })) },
  } });
  return { state: 'CLOSED' as const, closedAt };
}
