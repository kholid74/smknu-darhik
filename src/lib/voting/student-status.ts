import { db } from '../prisma';
import { isActiveVotingSession } from './student-session';
import { ORGANIZATIONS } from './ballot-pages';

export async function getStudentVotingStatus(session: {
  id: string; voterId: string; periodId: string; createdAt: Date; expiresAt: Date; scope: string;
}) {
  const [{ now }] = await db.$queryRaw<[{ now: Date }]>`SELECT clock_timestamp() AS "now"`;
  const voter = await db.electionVoter.findFirst({ where: { id: session.voterId, periodId: session.periodId }, select: {
    credentialEnabled: true,
    participation: { select: { organization: true, hasVoted: true } },
    period: { select: { state: true, opensAt: true, closesAt: true } },
  } });
  if (!voter) return null;
  const complete = voter.participation.length === 4 && voter.participation.every((row) => row.hasVoted);
  if (!isActiveVotingSession({ scope: session.scope, createdAt: session.createdAt, expiresAt: session.expiresAt,
    credentialEnabled: voter.credentialEnabled, periodState: voter.period.state,
    opensAt: voter.period.opensAt, closesAt: voter.period.closesAt, completed: complete }, now)) return null;
  const participation = Object.fromEntries(ORGANIZATIONS.map(({ id }) => [id,
    voter.participation.some((row) => row.organization === id && row.hasVoted)])) as Record<typeof ORGANIZATIONS[number]['id'], boolean>;
  const nextOrganization = ORGANIZATIONS.find(({ id }) => !participation[id])?.id ?? null;
  return {
    phase: 'OPEN', participation, complete, nextOrganization,
    idleExpiresAt: session.expiresAt,
    absoluteExpiresAt: new Date(Math.min(session.createdAt.getTime() + 15 * 60_000, voter.period.closesAt.getTime())),
  };
}
