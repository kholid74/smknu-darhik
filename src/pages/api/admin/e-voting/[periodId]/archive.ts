import type { APIRoute } from 'astro';
import { archivePeriod } from '../../../../../lib/voting/periods';
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
    return json({ data: await archivePeriod(params.periodId, actorId) });
  } catch (error) {
    if (error instanceof PeriodError) return json({ error: { code: error.code } }, error.code === 'NOT_FOUND' ? 404 : error.code === 'INVALID_STATE' ? 409 : 400);
    return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503);
  }
};
