import type { APIRoute } from 'astro';
import { csrfHeader, json, readJson, UUID, validMutation } from '../../../../../lib/voting/admin-http';
import { validateContestInput } from '../../../../../lib/voting/election-type-input';
import { getPeriodContests, replacePeriodContests } from '../../../../../lib/voting/election-types';
import { electionTypeFailure } from '../../../../../lib/voting/election-type-http';

export const prerender = false;
export const GET: APIRoute = async ({ params, locals, cookies }) => {
  if (!params.periodId || !UUID.test(params.periodId)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
  try {
    const data = await getPeriodContests(params.periodId);
    return json({ data }, 200, { 'X-CSRF-Token': csrfHeader(locals.session!.sub, cookies.get('smkdh_token')?.value ?? '') });
  } catch (error) { return electionTypeFailure(error); }
};
export const PUT: APIRoute = async ({ params, request, locals, cookies }) => {
  if (!params.periodId || !UUID.test(params.periodId)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
  const actor = locals.session!.sub;
  if (!validMutation(request, actor, cookies.get('smkdh_token')?.value ?? '')) return json({ error: { code: 'CSRF_REJECTED' } }, 403);
  try {
    const input = validateContestInput(await readJson(request));
    return json({ data: await replacePeriodContests(params.periodId, input.organizations, input.expectedRevision, actor) });
  } catch (error) { return electionTypeFailure(error); }
};
