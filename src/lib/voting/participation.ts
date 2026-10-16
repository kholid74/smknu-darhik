import { VotingOrganization } from '@prisma/client';
import { db } from '../prisma';
import { decodeVoterCursor, encodeVoterCursor } from './voter-cursor';

export async function getParticipation(periodId: string) {
  return db.$transaction(async (tx) => {
    const period = await tx.electionPeriod.findUnique({ where: { id: periodId }, select: { id: true, name: true, academicYear: true, state: true } });
    if (!period) return null;
    const [totals] = await tx.$queryRaw<Array<{ eligible: bigint; notStarted: bigint; partial: bigint; complete: bigint }>>`
      SELECT COUNT(*) AS "eligible", COUNT(*) FILTER (WHERE votes = 0) AS "notStarted",
        COUNT(*) FILTER (WHERE votes BETWEEN 1 AND 3) AS "partial", COUNT(*) FILTER (WHERE votes = 4) AS "complete"
      FROM (SELECT v."id", COUNT(*) FILTER (WHERE p."hasVoted" IS TRUE) AS votes
        FROM "ElectionVoter" v LEFT JOIN "VoterParticipation" p ON p."voterId" = v."id" AND p."periodId" = v."periodId"
        WHERE v."periodId" = ${periodId}::uuid GROUP BY v."id") roster
    `;
    const organizations = await tx.$queryRaw<Array<{ organization: VotingOrganization; eligible: bigint; voted: bigint }>>`
      SELECT c."organization", COUNT(p."voterId") AS "eligible", COUNT(*) FILTER (WHERE p."hasVoted" IS TRUE) AS "voted"
      FROM "ElectionContest" c LEFT JOIN "VoterParticipation" p ON p."periodId" = c."periodId" AND p."organization" = c."organization"
      WHERE c."periodId" = ${periodId}::uuid GROUP BY c."organization" ORDER BY c."organization"
    `;
    return { period, eligible: Number(totals.eligible), notStarted: Number(totals.notStarted), partial: Number(totals.partial), complete: Number(totals.complete),
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
  const period = await db.electionPeriod.findUnique({ where: { id: periodId }, select: { id: true } });
  if (!period) return null;
  const rows = await db.electionVoter.findMany({ where: { periodId, ...(afterId ? { id: { gt: afterId } } : {}) },
    orderBy: { id: 'asc' }, take: limit + 1,
    select: { id: true, voterType: true, loginCode: true, nisn: true, name: true, className: true, participation: { select: { organization: true, hasVoted: true } } },
  });
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const organizations = Object.values(VotingOrganization);
  const data = page.map(({ id, voterType, loginCode, nisn, name, className, participation }) => {
    if (participation.length !== organizations.length || organizations.some((organization) => !participation.some((row) => row.organization === organization))) {
      throw new ParticipationError('RECONCILIATION_FAILED');
    }
    return { voterType, loginCode, nisn, name, className, participation: Object.fromEntries(participation.map((row) => [row.organization, row.hasVoted])) };
  });
  return { data, nextCursor: hasMore && page.length ? encodeVoterCursor(page[page.length - 1].id) : null };
}
