import { db } from '../prisma';
import { isActiveVotingSession } from './student-session';
import { contestSelect, publicContests, votingProgress } from './contests';

export async function getStudentVotingStatus(session: {
  id: string; voterId: string; periodId: string; createdAt: Date; expiresAt: Date; scope: string;
}) {
  const [{ now }] = await db.$queryRaw<[{ now: Date }]>`SELECT clock_timestamp() AS "now"`;
  const voter = await db.electionVoter.findFirst({ where: { id: session.voterId, periodId: session.periodId }, select: {
    credentialEnabled: true,
    participation: { select: { organization: true, hasVoted: true } },
    period: { select: { state: true, opensAt: true, closesAt: true, contests: { select: contestSelect } } },
  } });
  if (!voter) return null;
  const contests = publicContests(voter.period.contests);
  const { participation, complete, nextOrganization } = votingProgress(contests, voter.participation);
  if (!isActiveVotingSession({ scope: session.scope, createdAt: session.createdAt, expiresAt: session.expiresAt,
    credentialEnabled: voter.credentialEnabled, periodState: voter.period.state,
    opensAt: voter.period.opensAt, closesAt: voter.period.closesAt, completed: complete }, now)) return null;
  return {
    phase: 'OPEN', contests, participation, complete, nextOrganization,
    idleExpiresAt: session.expiresAt,
    absoluteExpiresAt: new Date(Math.min(session.createdAt.getTime() + 15 * 60_000, voter.period.closesAt.getTime())),
  };
}
