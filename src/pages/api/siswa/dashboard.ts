import type { APIRoute } from 'astro';
import { json } from '../../../lib/voting/admin-http';
import { getStudentDashboard } from '../../../lib/voting/student-dashboard';
import { createStudentSessionCsrfToken } from '../../../lib/voting/security';
import { votingCsrfSecret } from '../../../lib/voting/student-auth';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const session = locals.votingSession;
  if (!session) return json({ error: { code: 'UNAUTHENTICATED' } }, 401);
  try {
    const data = await getStudentDashboard(session.periodId, session.voterId);
    if (!data) return json({ error: { code: 'UNAUTHENTICATED' } }, 401);
    return json({ data, csrfToken: createStudentSessionCsrfToken(votingCsrfSecret(), session.id) });
  } catch { return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503); }
};
