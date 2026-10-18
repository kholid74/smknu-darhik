import type { APIRoute } from 'astro';
import { CandidateError, deleteCandidatePair, saveCandidatePair, validateCandidateInput } from '../../../../../../lib/voting/candidates';
import { validateExpectedCandidate } from '../../../../../../lib/voting/candidate-input';
import { json, readJson, UUID, validMutation } from '../../../../../../lib/voting/admin-http';

export const prerender = false;

function failure(error: unknown) {
  if (error instanceof CandidateError) {
    const status = error.code === 'NOT_FOUND' ? 404 : ['CANDIDATES_LOCKED', 'INVALID_STATE', 'DUPLICATE_CANDIDATE', 'CANDIDATE_HAS_BALLOTS', 'LAST_CANDIDATE', 'STALE_CANDIDATE'].includes(error.code) ? 409 : 400;
    return json({ error: { code: error.code } }, status);
  }
  if ((error as { code?: string })?.code === 'P2002') return json({ error: { code: 'DUPLICATE_CANDIDATE' } }, 409);
  const message = error instanceof Error ? error.message : '';
  if (message === 'BODY_TOO_LARGE') return json({ error: { code: message } }, 413);
  if (message === 'UNSUPPORTED_MEDIA_TYPE') return json({ error: { code: message } }, 415);
  if (message === 'INVALID_INPUT') return json({ error: { code: message } }, 400);
  return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503);
}

function validIds(periodId?: string, candidateId?: string) {
  return !!periodId && !!candidateId && UUID.test(periodId) && UUID.test(candidateId);
}

export const PATCH: APIRoute = async ({ params, request, locals, cookies }) => {
  const accountId = locals.session!.sub;
  if (!validIds(params.periodId, params.candidateId)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
  if (!validMutation(request, accountId, cookies.get('smkdh_token')?.value ?? '')) return json({ error: { code: 'CSRF_INVALID' } }, 403);
  try {
    const body = await readJson(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CandidateError('INVALID_INPUT');
    const payload = body as Record<string, unknown>;
    const expected = validateExpectedCandidate(payload.expected);
    delete payload.expected;
    const input = validateCandidateInput(payload);
    await saveCandidatePair(params.periodId!, input, accountId, params.candidateId, expected);
    return json({ data: { updated: true } });
  } catch (error) { return failure(error); }
};

export const DELETE: APIRoute = async ({ params, request, locals, cookies }) => {
  const accountId = locals.session!.sub;
  if (!validIds(params.periodId, params.candidateId)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
  if (!validMutation(request, accountId, cookies.get('smkdh_token')?.value ?? '')) return json({ error: { code: 'CSRF_INVALID' } }, 403);
  try {
    const body = await readJson(request);
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || !Object.hasOwn(body, 'expected')) throw new CandidateError('INVALID_INPUT');
    const expected = validateExpectedCandidate((body as Record<string, unknown>).expected);
    await deleteCandidatePair(params.periodId!, params.candidateId!, accountId, expected);
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch (error) { return failure(error); }
};
