import type { APIRoute } from 'astro';
import { json, UUID } from '../../../../lib/voting/admin-http';
import { getStudentVotingStatus } from '../../../../lib/voting/student-status';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  const session = locals.votingSession;
  if (!session) return json({ error: { code: 'UNAUTHENTICATED' } }, 401);
  if (!params.periodId || !UUID.test(params.periodId) || params.periodId !== session.periodId) return json({ error: { code: 'FORBIDDEN' } }, 403);
  try {
    const data = await getStudentVotingStatus(session);
    if (!data) return json({ error: { code: 'ELECTION_NOT_OPEN' } }, 409);
    return json({ data });
  } catch { return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503); }
};
