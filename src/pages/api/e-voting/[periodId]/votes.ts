import type { APIRoute } from 'astro';
import { json, readJson, UUID } from '../../../../lib/voting/admin-http';
import { votingCsrfSecret } from '../../../../lib/voting/student-auth';
import { createStudentSessionCsrfToken, isSameOrigin, verifyStudentSessionCsrfToken } from '../../../../lib/voting/security';
import { VOTING_SESSION_COOKIE } from '../../../../lib/voting/student-session';
import { submitVote, VoteError } from '../../../../lib/voting/votes';
import { validateVoteInput, VoteInputError } from '../../../../lib/voting/vote-input';

import { voterPortal } from '../../../../lib/voting/voter-identity';
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
    const input = validateVoteInput(await readJson(request));
    const data = await submitVote(session.id, session.voterId, session.periodId, input);
    if (data.complete) cookies.delete(VOTING_SESSION_COOKIE, { path: '/', httpOnly: true, secure: production, sameSite: 'strict' });
    return json({ data: { ...data, ...(data.complete ? { redirectTo: `${voterPortal(session.voterType)}/selesai` } : {}) } }, 201);
  } catch (error) {
    if (error instanceof VoteInputError) return json({ error: { code: error.code } }, 400);
    if (error instanceof VoteError) {
      if (error.code === 'RATE_LIMITED') return json({ error: { code: error.code } }, 429, { 'Retry-After': '60' });
      if (error.code === 'ALREADY_VOTED' || error.code === 'ELECTION_NOT_OPEN') {
        if (error.code === 'ELECTION_NOT_OPEN') cookies.delete(VOTING_SESSION_COOKIE, { path: '/', httpOnly: true, secure: production, sameSite: 'strict' });
        return json({ error: { code: error.code } }, 409);
      }
      if (error.code === 'UNAUTHENTICATED') {
        cookies.delete(VOTING_SESSION_COOKIE, { path: '/', httpOnly: true, secure: production, sameSite: 'strict' });
        return json({ error: { code: error.code } }, 401);
      }
      if (error.code === 'INVALID_CANDIDATE') return json({ error: { code: error.code } }, 400);
    }
    return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503);
  }
};
