import type {APIRoute} from 'astro';
import {deleteTestPeriod, previewTestCleanup} from '../../../../../lib/voting/test-cleanup';
import {canDeleteTestPeriod, validateTestCleanupInput} from '../../../../../lib/voting/test-cleanup-input';
import {PeriodError} from '../../../../../lib/voting/period-input';
import {csrfHeader, json, readJson, UUID, validMutation} from '../../../../../lib/voting/admin-http';

export const prerender = false;

function failure(error: unknown) {
  if (error instanceof PeriodError) {
    const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'FORBIDDEN' ? 403 : error.code === 'INVALID_REAUTH' ? 401
      : error.code === 'RATE_LIMITED' ? 429 : ['TEST_CLEANUP_NOT_ALLOWED', 'STALE_CLEANUP_PREVIEW', 'CONFIRMATION_MISMATCH'].includes(error.code) ? 409 : 400;
    return json({error: {code: error.code}}, status);
  }
  if (error instanceof Error && ['INVALID_INPUT', 'UNSUPPORTED_MEDIA_TYPE', 'BODY_TOO_LARGE'].includes(error.message)) {
    return json({error: {code: error.message}}, error.message === 'BODY_TOO_LARGE' ? 413 : error.message === 'UNSUPPORTED_MEDIA_TYPE' ? 415 : 400);
  }
  return json({error: {code: 'TEMPORARILY_UNAVAILABLE'}}, 503);
}

export const GET: APIRoute = async ({params, locals, cookies}) => {
  if (!locals.session || !canDeleteTestPeriod(locals.principal)) return json({error: {code: 'FORBIDDEN'}}, 403);
  if (!params.periodId || !UUID.test(params.periodId)) return json({error: {code: 'INVALID_INPUT'}}, 400);
  try {
    return json({data: await previewTestCleanup(params.periodId)}, 200, {
      'X-CSRF-Token': csrfHeader(locals.session.sub, cookies.get('smkdh_token')?.value ?? ''),
    });
  } catch (error) { return failure(error); }
};

export const POST: APIRoute = async ({params, request, locals, cookies}) => {
  if (!locals.session || !canDeleteTestPeriod(locals.principal)) return json({error: {code: 'FORBIDDEN'}}, 403);
  if (!params.periodId || !UUID.test(params.periodId)) return json({error: {code: 'INVALID_INPUT'}}, 400);
  if (!validMutation(request, locals.session.sub, cookies.get('smkdh_token')?.value ?? '')) return json({error: {code: 'CSRF_REJECTED'}}, 403);
  try {
    const input = validateTestCleanupInput(await readJson(request));
    await deleteTestPeriod(params.periodId, locals.session.sub, input);
    return new Response(null, {status: 204, headers: {'Cache-Control': 'private, no-store'}});
  } catch (error) { return failure(error); }
};
