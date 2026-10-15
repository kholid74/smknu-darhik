import type { APIRoute } from 'astro';
import { createPeriod, listPeriods } from '../../../../lib/voting/periods';
import { PeriodError, validatePeriodInput } from '../../../../lib/voting/period-input';
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
    return json({ data: await createPeriod(input, actorId) }, 201);
  } catch (error) {
    if (error instanceof PeriodError) return json({ error: { code: error.code } }, 400);
    if ((error as { code?: string })?.code === 'P2002') return json({ error: { code: 'DUPLICATE_SLUG' } }, 409);
    if ((error as { code?: string })?.code === 'INVALID_SCHEDULE') return json({ error: { code: 'INVALID_SCHEDULE' } }, 400);
    return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503);
  }
};
