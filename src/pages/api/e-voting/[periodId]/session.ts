import type { APIRoute } from 'astro';
import { db } from '../../../../lib/prisma';
import { json, readJson, UUID } from '../../../../lib/voting/admin-http';
import { StudentAuthError, authenticateVoter, newOpaqueToken, preauthCsrf, votingCsrfSecret } from '../../../../lib/voting/student-auth';
import { createStudentSessionCsrfToken, isSameOrigin, verifyPreauthCsrfToken } from '../../../../lib/voting/security';
import { VOTING_SESSION_COOKIE } from '../../../../lib/voting/student-session';
import { validateVoterLogin, voterPortal } from '../../../../lib/voting/voter-identity';

export const prerender = false;
const production = process.env.NODE_ENV === 'production';
const preauthCookie = production ? '__Host-smkdh_vote_pre' : 'smkdh_vote_pre_dev';

export const GET: APIRoute = async ({ params, cookies }) => {
  if (!params.periodId || !UUID.test(params.periodId)) return json({ error: { code: 'NOT_FOUND' } }, 404);
  try {
    const period = await db.electionPeriod.findUnique({ where: { id: params.periodId }, select: { id: true, state: true, opensAt: true, closesAt: true } });
    if (!period) return json({ error: { code: 'NOT_FOUND' } }, 404);
    const now = Date.now();
    const phase = period.state !== 'SCHEDULED' ? 'CLOSED' : now < period.opensAt.getTime() ? 'BEFORE_OPEN' : now >= period.closesAt.getTime() ? 'CLOSED' : 'OPEN';
    const nonce = newOpaqueToken();
    cookies.set(preauthCookie, nonce, { httpOnly: true, secure: production, sameSite: 'strict', path: '/', maxAge: 300 });
    return json({ csrfToken: preauthCsrf(votingCsrfSecret(), nonce), phase });
  } catch { return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503); }
};

export const POST: APIRoute = async ({ request, params, cookies }) => {
  const nonce = cookies.get(preauthCookie)?.value;
  if (!nonce || !isSameOrigin(request) || !verifyPreauthCsrfToken(votingCsrfSecret(), nonce, request.headers.get('x-csrf-token'))) {
    return json({ error: { code: 'CSRF_INVALID' } }, 403);
  }
  if (!params.periodId || !UUID.test(params.periodId)) return json({ error: { code: 'NOT_FOUND' } }, 404);
  try {
    const { voterType, identifier, pin } = validateVoterLogin(await readJson(request));
    const base = voterPortal(voterType);
    const result = await authenticateVoter(params.periodId, identifier, pin, voterType);
    cookies.delete(preauthCookie, { path: '/', httpOnly: true, secure: production, sameSite: 'strict' });
    if (result.complete) {
      cookies.delete(VOTING_SESSION_COOKIE, { path: '/', httpOnly: true, secure: production, sameSite: 'strict' });
      return json({ complete: true, redirectTo: `${base}/selesai` });
    }
    cookies.set(VOTING_SESSION_COOKIE, result.token, { httpOnly: true, secure: production, sameSite: 'strict', path: '/' });
    return json({ complete: false, redirectTo: base, csrfToken: createStudentSessionCsrfToken(votingCsrfSecret(), result.sessionId) });
  } catch (error) {
    if (error instanceof StudentAuthError) {
      if (error.code === 'ELECTION_NOT_OPEN') return json({ error: { code: error.code } }, 409);
      if (error.code === 'SESSION_CAPACITY') return json({ error: { code: error.code } }, 409);
      if (error.code === 'RATE_LIMITED') return json({ error: { code: error.code } }, 429, { 'Retry-After': '900' });
      return json({ error: { code: 'INVALID_CREDENTIALS' } }, 401);
    }
    if ((error as Error).message === 'BODY_TOO_LARGE') return json({ error: { code: 'BODY_TOO_LARGE' } }, 413);
    if ((error as Error).message === 'UNSUPPORTED_MEDIA_TYPE') return json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE' } }, 415);
    if ((error as Error).message === 'INVALID_INPUT') return json({ error: { code: 'INVALID_INPUT' } }, 400);
    return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503);
  }
};
