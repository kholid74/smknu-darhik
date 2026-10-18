import type { APIRoute } from 'astro';
import { createPeriod, listPeriods } from '../../../../lib/voting/periods';
import { validatePeriodInput } from '../../../../lib/voting/period-input';
import { electionTypeFailure } from '../../../../lib/voting/election-type-http';
import { csrfHeader, json, readJson, validMutation } from '../../../../lib/voting/admin-http';

export const prerender = false;

export const GET: APIRoute = async ({ locals, cookies }) => {
  try {
    return json({ data: await listPeriods() }, 200, {
      'X-CSRF-Token': csrfHeader(locals.session!.sub, cookies.get('smkdh_token')?.value ?? ''),
    });
  } catch { return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503); }
};

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const actorId = locals.session!.sub;
  if (!validMutation(request, actorId, cookies.get('smkdh_token')?.value ?? '')) return json({ error: { code: 'CSRF_REJECTED' } }, 403);
  try {
    const input = validatePeriodInput(await readJson(request));
    const data = await createPeriod(input, actorId);
    return json({ data }, 201, { Location: `/api/admin/e-voting/${data.id}` });
  } catch (error) {
    return electionTypeFailure(error);
  }
};
