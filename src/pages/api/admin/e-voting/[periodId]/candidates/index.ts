import type { APIRoute } from 'astro';
import { CandidateError, saveCandidatePair, validateCandidateInput } from '../../../../../../lib/voting/candidates';
import { json, readJson, UUID, validMutation } from '../../../../../../lib/voting/admin-http';

export const prerender = false;

function failure(error: unknown) {
  if (error instanceof CandidateError) {
    const status = error.code === 'NOT_FOUND' ? 404 : ['CANDIDATES_LOCKED', 'INVALID_STATE', 'DUPLICATE_CANDIDATE'].includes(error.code) ? 409 : 400;
    return json({ error: { code: error.code } }, status);
  }
  if ((error as { code?: string })?.code === 'P2002') return json({ error: { code: 'DUPLICATE_CANDIDATE' } }, 409);
  const message = error instanceof Error ? error.message : '';
  if (message === 'BODY_TOO_LARGE') return json({ error: { code: message } }, 413);
  if (message === 'UNSUPPORTED_MEDIA_TYPE') return json({ error: { code: message } }, 415);
  if (message === 'INVALID_INPUT') return json({ error: { code: message } }, 400);
  return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503);
}

export const POST: APIRoute = async ({ params, request, locals, cookies }) => {
  const accountId = locals.session!.sub;
  if (!params.periodId || !UUID.test(params.periodId)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
  if (!validMutation(request, accountId, cookies.get('smkdh_token')?.value ?? '')) return json({ error: { code: 'CSRF_INVALID' } }, 403);
  try {
    const input = validateCandidateInput(await readJson(request));
    const pair = await saveCandidatePair(params.periodId, input, accountId);
    return json({ data: { candidateId: pair.id } }, 201);
  } catch (error) { return failure(error); }
};
