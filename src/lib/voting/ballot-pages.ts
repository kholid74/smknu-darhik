import { db } from '../prisma';
import { contestSelect, publicContests, votingProgress } from './contests';

export class BallotPageError extends Error {
  constructor(public code: string) { super(code); }
}

async function resolveVoter(periodId: string, slug: string, voterId: string) {
  const [{ now }] = await db.$queryRaw<[{ now: Date }]>`SELECT clock_timestamp() AS "now"`;
  const period = await db.electionPeriod.findFirst({ where: { id: periodId, slug, state: 'SCHEDULED' },
    select: { id: true, slug: true, name: true, opensAt: true, closesAt: true,
      contests: { select: { ...contestSelect, _count: { select: { candidates: true } } }, orderBy: { sortOrder: 'asc' } } } });
  if (!period || period.opensAt > now || period.closesAt <= now) throw new BallotPageError('ELECTION_NOT_OPEN');
  const voter = await db.electionVoter.findFirst({ where: { id: voterId, periodId, credentialEnabled: true },
    select: { participation: { select: { organization: true, hasVoted: true } } } });
  if (!voter) throw new BallotPageError('UNAUTHENTICATED');
  const contests = publicContests(period.contests);
  return { period, contests, ...votingProgress(contests, voter.participation) };
}

export async function getBallotProgress(periodId: string, slug: string, voterId: string) {
  const data = await resolveVoter(periodId, slug, voterId);
  return { ...data,
    candidateCounts: Object.fromEntries(data.period.contests.map((contest) => [contest.organization, contest._count.candidates])) };
}

export async function getOrganizationCandidates(periodId: string, slug: string, voterId: string, organization: string) {
  const { period, contests, participation } = await resolveVoter(periodId, slug, voterId);
  if (!contests.some(c=>c.organization===organization)) throw new BallotPageError('INVALID_ORGANIZATION');
  if (participation[organization]) throw new BallotPageError('ALREADY_VOTED');
  const candidates = await db.candidatePair.findMany({ where: { periodId, organization }, orderBy: { ballotNumber: 'asc' },
    select: { id: true, ballotNumber: true, vision: true, mission: true,
      members: { select: { position: true, nameSnapshot: true, classSnapshot: true, photoUrl: true } } } });
  if (!candidates.length) throw new BallotPageError('NO_CANDIDATES');
  return { period, contests, candidates, participation };
}
