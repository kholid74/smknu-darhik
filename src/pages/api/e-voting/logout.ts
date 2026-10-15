import type { APIRoute } from 'astro';
import { db } from '../../../lib/prisma';
import { json, readJson } from '../../../lib/voting/admin-http';
import { revokeStudentSession } from '../../../lib/voting/student-session-actions';
import { isSameOrigin, verifyPreauthCsrfToken, verifyStudentSessionCsrfToken } from '../../../lib/voting/security';
import { isStudentSessionCookie, VOTING_SESSION_COOKIE } from '../../../lib/voting/student-session';
import { tokenHash, votingCsrfSecret } from '../../../lib/voting/student-auth';

export const prerender = false;
const production = process.env.NODE_ENV === 'production';
const preauthCookie = production ? '__Host-smkdh_vote_pre' : 'smkdh_vote_pre_dev';

export const POST: APIRoute = async ({ request, cookies }) => {
  const secret = votingCsrfSecret();
  const rawToken = cookies.get(VOTING_SESSION_COOKIE)?.value;
  const nonce = cookies.get(preauthCookie)?.value;
  if (!isSameOrigin(request)) return json({ error: { code: 'CSRF_INVALID' } }, 403);
  try {
    const value = await readJson(request);
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 0) throw new Error('INVALID_INPUT');
    const tokenDigest = isStudentSessionCookie(rawToken) ? tokenHash(rawToken) : null;
    const session = tokenDigest ? await db.votingSession.findUnique({ where: { tokenHash: tokenDigest }, select: { id: true } }) : null;
    const validCsrf = session
      ? verifyStudentSessionCsrfToken(secret, session.id, request.headers.get('x-csrf-token'))
      : !!nonce && verifyPreauthCsrfToken(secret, nonce, request.headers.get('x-csrf-token'));
    if (!validCsrf) return json({ error: { code: 'CSRF_INVALID' } }, 403);
    if (tokenDigest) await revokeStudentSession(tokenDigest);
    cookies.delete(VOTING_SESSION_COOKIE, { path: '/', httpOnly: true, secure: production, sameSite: 'strict' });
    cookies.delete(preauthCookie, { path: '/', httpOnly: true, secure: production, sameSite: 'strict' });
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch (error) {
    if ((error as Error).message === 'BODY_TOO_LARGE') return json({ error: { code: 'BODY_TOO_LARGE' } }, 413);
    if ((error as Error).message === 'UNSUPPORTED_MEDIA_TYPE') return json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE' } }, 415);
    if ((error as Error).message === 'INVALID_INPUT') return json({ error: { code: 'INVALID_INPUT' } }, 400);
    return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503);
  }
};
