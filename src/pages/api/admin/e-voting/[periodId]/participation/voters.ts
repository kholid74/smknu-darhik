import type { APIRoute } from 'astro';
import { can } from '../../../../../../lib/rbac';
import { json, UUID } from '../../../../../../lib/voting/admin-http';
import { getParticipationVoters, ParticipationError } from '../../../../../../lib/voting/participation';

export const prerender = false;

export const GET: APIRoute = async ({ params, url, locals }) => {
  if (!params.periodId || !UUID.test(params.periodId)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
  if (!locals.principal || !can(locals.principal, 'evoting.partisipasi') || !can(locals.principal, 'evoting.pemilih')) {
    return json({ error: { code: 'FORBIDDEN' } }, 403);
  }
  const limitValue = url.searchParams.get('limit');
  const limit = limitValue === null ? 50 : Number(limitValue);
  const cursor = url.searchParams.get('cursor');
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || url.searchParams.getAll('cursor').length > 1 || url.searchParams.getAll('limit').length > 1) {
    return json({ error: { code: 'INVALID_INPUT' } }, 400);
  }
  try {
    const data = await getParticipationVoters(params.periodId, cursor, limit);
    return data ? json({ data }) : json({ error: { code: 'NOT_FOUND' } }, 404);
  } catch (error) {
    if (error instanceof ParticipationError) return json({ error: { code: error.code } }, error.code === 'INVALID_CURSOR' ? 400 : 503);
    return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503);
  }
};
