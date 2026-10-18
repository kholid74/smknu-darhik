import { db } from '../prisma';
import { buildStudentDashboard } from './student-dashboard-model';
import { contestSelect, publicContests } from './contests';

export async function getStudentDashboard(periodId: string, voterId: string) {
  const voter = await db.electionVoter.findFirst({
    where: { id: voterId, periodId, credentialEnabled: true },
    select: {
      voterType: true,
      participation: { select: { organization: true, hasVoted: true } },
      period: { select: { id: true, slug: true, name: true, opensAt: true, closesAt: true, state: true, contests: { select: contestSelect, orderBy: { sortOrder: 'asc' } } } },
    },
  });
  if (!voter || voter.period.state !== 'SCHEDULED') return null;
  return buildStudentDashboard(
    { id: voter.period.id, slug: voter.period.slug, name: voter.period.name, opensAt: voter.period.opensAt, closesAt: voter.period.closesAt },
    publicContests(voter.period.contests), voter.participation, voter.voterType,
  );
}
