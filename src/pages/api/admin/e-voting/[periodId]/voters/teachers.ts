import type { APIRoute } from 'astro';
import { json, readJson, validMutation, UUID } from '../../../../../../lib/voting/admin-http';
import { validateTeacherSelection } from '../../../../../../lib/voting/voter-identity';
import { syncTeacherRoster } from '../../../../../../lib/voting/voters';
import { PeriodError } from '../../../../../../lib/voting/period-input';
import { RosterError } from '../../../../../../lib/voting/voter-roster-input';

export const prerender = false;
export const POST: APIRoute = async ({params, request, locals, cookies}) => {
  if (!params.periodId || !UUID.test(params.periodId)) return json({error: {code: 'INVALID_INPUT'}}, 400);
  const actor = locals.session!.sub;
  if (!validMutation(request, actor, cookies.get('smkdh_token')?.value ?? '')) return json({error: {code: 'CSRF_REJECTED'}}, 403);
  try {
    const ids = validateTeacherSelection(await readJson(request));
    return json({data: await syncTeacherRoster(params.periodId, ids, actor)});
  } catch(error) {
    if (error instanceof PeriodError || error instanceof RosterError) return json({error: {code: error.code}}, error.code === 'TEACHER_NOT_FOUND' || error.code === 'NOT_FOUND' ? 404 : error.code === 'INVALID_INPUT' ? 400 : 409);
    if (error instanceof Error && ['INVALID_INPUT', 'BODY_TOO_LARGE', 'UNSUPPORTED_MEDIA_TYPE'].includes(error.message)) return json({error: {code: error.message}}, error.message === 'BODY_TOO_LARGE' ? 413 : error.message === 'UNSUPPORTED_MEDIA_TYPE' ? 415 : 400);
    console.error('E-voting teacher roster sync failed');
    return json({error: {code: 'TEMPORARILY_UNAVAILABLE'}}, 503);
  }
};
