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
    const { adminPassword, early } = validatePeriodClose(await readJson(request));
    const data = await closePeriod(params.periodId, actorId, adminPassword, early);
    return json({ data });
  } catch (error) {
    if (error instanceof PeriodError) {
      const status = error.code === 'NOT_FOUND' ? 404 : ['BEFORE_DEADLINE', 'EARLY_CLOSE_INCOMPLETE', 'INVALID_STATE', 'RECONCILIATION_FAILED', 'RATE_LIMITED', 'INVALID_REAUTH'].includes(error.code) ? 409 : 400;
      return json({ error: { code: error.code } }, status);
    }
    return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503);
  }
};
