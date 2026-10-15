import { db } from '../prisma';

export const ORGANIZATIONS = [
  { id: 'OSIS', label: 'OSIS' },
  { id: 'DEWAN_AMBALAN', label: 'Dewan Ambalan' },
  { id: 'IPNU', label: 'IPNU' },
  { id: 'IPPNU', label: 'IPPNU' },
] as const;

export class BallotPageError extends Error {
  constructor(public code: string) { super(code); }
}

async function resolveVoter(periodId: string, slug: string, voterId: string) {
  const [{ now }] = await db.$queryRaw<[{ now: Date }]>`SELECT clock_timestamp() AS "now"`;
  const period = await db.electionPeriod.findFirst({ where: { id: periodId, slug, state: 'SCHEDULED' },
    select: { id: true, slug: true, name: true, opensAt: true, closesAt: true,
      contests: { select: { organization: true, _count: { select: { candidates: true } } } } } });
  if (!period || period.opensAt > now || period.closesAt <= now) throw new BallotPageError('ELECTION_NOT_OPEN');
  const voter = await db.electionVoter.findFirst({ where: { id: voterId, periodId, credentialEnabled: true },
    select: { participation: { select: { organization: true, hasVoted: true } } } });
  if (!voter) throw new BallotPageError('UNAUTHENTICATED');
  const participation = Object.fromEntries(ORGANIZATIONS.map(({ id }) => [id,
    voter.participation.some((row) => row.organization === id && row.hasVoted)])) as Record<typeof ORGANIZATIONS[number]['id'], boolean>;
  return { period, participation };
}

export async function getBallotProgress(periodId: string, slug: string, voterId: string) {
  const { period, participation } = await resolveVoter(periodId, slug, voterId);
  const nextOrganization = ORGANIZATIONS.find(({ id }) => !participation[id])?.id ?? null;
  return { period, participation, nextOrganization,
    candidateCounts: Object.fromEntries(period.contests.map((contest) => [contest.organization, contest._count.candidates])) };
}

export async function getOrganizationCandidates(periodId: string, slug: string, voterId: string, organization: typeof ORGANIZATIONS[number]['id']) {
  const { period, participation } = await resolveVoter(periodId, slug, voterId);
  if (participation[organization]) throw new BallotPageError('ALREADY_VOTED');
  const candidates = await db.candidatePair.findMany({ where: { periodId, organization }, orderBy: { ballotNumber: 'asc' },
    select: { id: true, ballotNumber: true, vision: true, mission: true,
      members: { select: { position: true, nameSnapshot: true, classSnapshot: true, photoUrl: true } } } });
  if (!candidates.length) throw new BallotPageError('NO_CANDIDATES');
  return { period, candidates };
}
