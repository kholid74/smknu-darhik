import type { APIRoute } from 'astro';
import { can } from '../../../../../lib/rbac';
import { closePeriod } from '../../../../../lib/voting/periods';
import { PeriodError, validatePeriodClose } from '../../../../../lib/voting/period-input';
import { json, readJson, validMutation, UUID } from '../../../../../lib/voting/admin-http';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, locals, cookies }) => {
  if (!params.periodId || !UUID.test(params.periodId)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
  if (!locals.principal || !can(locals.principal, 'evoting.tutup')) return json({ error: { code: 'FORBIDDEN' } }, 403);
  const actorId = locals.session!.sub;
  if (!validMutation(request, actorId, cookies.get('smkdh_token')?.value ?? '')) return json({ error: { code: 'CSRF_REJECTED' } }, 403);
  try {
    const { adminPassword, early, reason } = validatePeriodClose(await readJson(request));
    const data = await closePeriod(params.periodId, actorId, adminPassword, early, reason);
    return json({ data });
  } catch (error) {
    if (error instanceof PeriodError) {
      const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'INVALID_REAUTH' ? 401 : error.code === 'RATE_LIMITED' ? 429 : ['BEFORE_DEADLINE', 'INVALID_STATE', 'RECONCILIATION_FAILED'].includes(error.code) ? 409 : 400;
      return json({ error: { code: error.code } }, status);
    }
    const message = error instanceof Error ? error.message : '';
    if (['INVALID_INPUT', 'BODY_TOO_LARGE', 'UNSUPPORTED_MEDIA_TYPE'].includes(message)) {
      return json({ error: { code: message } }, message === 'BODY_TOO_LARGE' ? 413 : message === 'UNSUPPORTED_MEDIA_TYPE' ? 415 : 400);
    }
    return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503);
  }
};
