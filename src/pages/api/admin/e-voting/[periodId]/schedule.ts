import type { APIRoute } from 'astro';
import { schedulePeriod } from '../../../../../lib/voting/periods';
import { PeriodError } from '../../../../../lib/voting/period-input';
import { json, readJson, validMutation, UUID } from '../../../../../lib/voting/admin-http';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, locals, cookies }) => {
  if (!params.periodId || !UUID.test(params.periodId)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
  const actorId = locals.session!.sub;
  if (!validMutation(request, actorId, cookies.get('smkdh_token')?.value ?? '')) return json({ error: { code: 'CSRF_REJECTED' } }, 403);
  try {
    const body = await readJson(request);
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length) return json({ error: { code: 'INVALID_INPUT' } }, 400);
    const data = await schedulePeriod(params.periodId, actorId);
    return json({ data });
  } catch (error) {
    if (error instanceof PeriodError) {
      const status = error.code === 'NOT_FOUND' ? 404 : ['INVALID_STATE', 'INVALID_SCHEDULE', 'NOT_READY', 'ANOTHER_SCHEDULED_PERIOD'].includes(error.code) ? 409 : 400;
      return json({ error: { code: error.code } }, status);
    }
    console.error('E-voting period scheduling failed:', error);
    return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503);
  }
};
