import type { APIRoute } from 'astro';
import { can } from '../../../../../../lib/rbac';
import { json, UUID } from '../../../../../../lib/voting/admin-http';
import { getParticipation } from '../../../../../../lib/voting/participation';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  if (!params.periodId || !UUID.test(params.periodId)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
  if (!locals.principal || !can(locals.principal, 'evoting.partisipasi')) return json({ error: { code: 'FORBIDDEN' } }, 403);
  try {
    const data = await getParticipation(params.periodId);
    return data ? json({ data }) : json({ error: { code: 'NOT_FOUND' } }, 404);
  } catch { return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503); }
};
