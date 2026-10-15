import type { APIRoute } from 'astro';
import { json, readJson, UUID } from '../../../../lib/voting/admin-http';
import { votingCsrfSecret } from '../../../../lib/voting/student-auth';
import { extendStudentSession, StudentSessionError } from '../../../../lib/voting/student-session-actions';
import { createStudentSessionCsrfToken, isSameOrigin, verifyStudentSessionCsrfToken } from '../../../../lib/voting/security';
import { VOTING_SESSION_COOKIE } from '../../../../lib/voting/student-session';

export const prerender = false;
const production = process.env.NODE_ENV === 'production';

export const POST: APIRoute = async ({ request, params, locals, cookies }) => {
  const session = locals.votingSession;
  if (!session) return json({ error: { code: 'UNAUTHENTICATED' } }, 401);
  if (!params.periodId || !UUID.test(params.periodId) || params.periodId !== session.periodId) return json({ error: { code: 'FORBIDDEN' } }, 403);
  if (!isSameOrigin(request) || !verifyStudentSessionCsrfToken(votingCsrfSecret(), session.id, request.headers.get('x-csrf-token'))) {
    return json({ error: { code: 'CSRF_INVALID' } }, 403);
  }
  try {
    const value = await readJson(request);
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 0) throw new Error('INVALID_INPUT');
    const result = await extendStudentSession(session.id, session.voterId, session.periodId);
    return json({ ...result, csrfToken: createStudentSessionCsrfToken(votingCsrfSecret(), session.id) });
  } catch (error) {
    if (error instanceof StudentSessionError) {
      if (error.code === 'RATE_LIMITED') return json({ error: { code: error.code } }, 429, { 'Retry-After': '60' });
      if (error.code === 'ELECTION_NOT_OPEN') {
        cookies.delete(VOTING_SESSION_COOKIE, { path: '/', httpOnly: true, secure: production, sameSite: 'strict' });
        return json({ error: { code: error.code } }, 409);
      }
      return json({ error: { code: error.code } }, 401);
    }
    if ((error as Error).message === 'BODY_TOO_LARGE') return json({ error: { code: 'BODY_TOO_LARGE' } }, 413);
    if ((error as Error).message === 'UNSUPPORTED_MEDIA_TYPE') return json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE' } }, 415);
    if ((error as Error).message === 'INVALID_INPUT') return json({ error: { code: 'INVALID_INPUT' } }, 400);
    return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503);
  }
};
