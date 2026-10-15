import type { APIRoute } from 'astro';
import { getPeriod, updatePeriod } from '../../../../../lib/voting/periods';
import { PeriodError, validateExpectedPeriodConfig, validatePeriodConfig } from '../../../../../lib/voting/period-input';
import { csrfHeader, json, readJson, validMutation, UUID } from '../../../../../lib/voting/admin-http';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals, cookies }) => {
  if (!params.periodId || !UUID.test(params.periodId)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
  try {
    const data = await getPeriod(params.periodId);
    if (!data) return json({ error: { code: 'NOT_FOUND' } }, 404);
    return json({ data }, 200, { 'X-CSRF-Token': csrfHeader(locals.session!.sub, cookies.get('smkdh_token')?.value ?? '') });
  } catch { return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503); }
};

export const PATCH: APIRoute = async ({ params, request, locals, cookies }) => {
  if (!params.periodId || !UUID.test(params.periodId)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
  const actorId = locals.session!.sub;
  if (!validMutation(request, actorId, cookies.get('smkdh_token')?.value ?? '')) return json({ error: { code: 'CSRF_REJECTED' } }, 403);
  try {
    const body = await readJson(request);
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 2 || !('input' in body) || !('expected' in body)) {
      return json({ error: { code: 'INVALID_INPUT' } }, 400);
    }
    const data = await updatePeriod(params.periodId, validatePeriodConfig(body.input), validateExpectedPeriodConfig(body.expected), actorId);
    return json({ data });
  } catch (error) {
    if (error instanceof PeriodError) {
      const status = error.code === 'NOT_FOUND' ? 404 : ['STALE_CONFIG', 'INVALID_STATE'].includes(error.code) ? 409 : 400;
      return json({ error: { code: error.code } }, status);
    }
    return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503);
  }
};
