import { contestSelect, publicContests, votingProgress } from './contests';
import { db } from '../prisma';
import { decodeVoterCursor, encodeVoterCursor } from './voter-cursor';

export async function getParticipation(periodId: string) {
  return db.$transaction(async (tx) => {
    const record = await tx.electionPeriod.findUnique({ where: { id: periodId }, select: { id: true, name: true, academicYear: true, state: true, contests: { select: contestSelect } } });
    if (!record) return null;
    const { contests: stored, ...period } = record;
    const contests = publicContests(stored);
    const n = contests.length;
    const [totals] = await tx.$queryRaw<Array<{ eligible: bigint; notStarted: bigint; partial: bigint; complete: bigint }>>`
      SELECT COUNT(*) AS "eligible", COUNT(*) FILTER (WHERE votes = 0) AS "notStarted",
        COUNT(*) FILTER (WHERE votes > 0 AND votes < ${n}) AS "partial", COUNT(*) FILTER (WHERE votes = ${n}) AS "complete"
      FROM (SELECT v."id", COUNT(*) FILTER (WHERE p."hasVoted" IS TRUE) AS votes
        FROM "ElectionVoter" v LEFT JOIN "VoterParticipation" p ON p."voterId" = v."id" AND p."periodId" = v."periodId"
        WHERE v."periodId" = ${periodId}::uuid GROUP BY v."id") roster
    `;
    const organizations = await tx.$queryRaw<Array<{ organization: string; eligible: bigint; voted: bigint }>>`
      SELECT c."organization", COUNT(p."voterId") AS "eligible", COUNT(*) FILTER (WHERE p."hasVoted" IS TRUE) AS "voted"
      FROM "ElectionContest" c LEFT JOIN "VoterParticipation" p ON p."periodId" = c."periodId" AND p."organization" = c."organization"
      WHERE c."periodId" = ${periodId}::uuid GROUP BY c."organization", c."sortOrder" ORDER BY c."sortOrder"
    `;
    if (Number(totals.eligible) !== Number(totals.notStarted + totals.partial + totals.complete) || organizations.some(r => r.eligible !== totals.eligible)) throw new ParticipationError('RECONCILIATION_FAILED');
    return { period, contests, eligible: Number(totals.eligible), notStarted: Number(totals.notStarted), partial: Number(totals.partial), complete: Number(totals.complete),
      byOrganization: organizations.map((item) => ({ organization: item.organization, eligible: Number(item.eligible), voted: Number(item.voted), pending: Number(item.eligible - item.voted) })) };
  }, { isolationLevel: 'RepeatableRead' });
}

export class ParticipationError extends Error {
  constructor(public code: string) { super(code); }
}

export async function getParticipationVoters(periodId: string, cursor: string | null, limit: number) {
  let afterId: string | undefined;
  try { afterId = decodeVoterCursor(cursor); }
  catch { throw new ParticipationError('INVALID_CURSOR'); }
  return db.$transaction(async tx => {
  const period = await tx.electionPeriod.findUnique({ where: { id: periodId }, select: { id: true, contests: { select: contestSelect } } });
  if (!period) return null;
  const rows = await tx.electionVoter.findMany({ where: { periodId, ...(afterId ? { id: { gt: afterId } } : {}) },
    orderBy: { id: 'asc' }, take: limit + 1,
    select: { id: true, voterType: true, loginCode: true, nisn: true, name: true, className: true, participation: { select: { organization: true, hasVoted: true } } },
  });
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const contests = publicContests(period.contests);
  const data = page.map(({ id, voterType, loginCode, nisn, name, className, participation }) => {
    return { voterType, loginCode, nisn, name, className, participation: votingProgress(contests, participation).participation };
  });
  return { data, nextCursor: hasMore && page.length ? encodeVoterCursor(page[page.length - 1].id) : null };
  }, { isolationLevel: 'RepeatableRead' });
}
