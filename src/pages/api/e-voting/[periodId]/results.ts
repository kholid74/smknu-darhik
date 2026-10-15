import type { APIRoute } from 'astro';
import { json, UUID } from '../../../../lib/voting/admin-http';
import { getPublishedResult } from '../../../../lib/voting/public-results';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  if (!params.periodId || !UUID.test(params.periodId)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
  try {
    const data = await getPublishedResult({ id: params.periodId });
    return data ? json({ data }) : json({ error: { code: 'NOT_FOUND' } }, 404);
  } catch { return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503); }
};
