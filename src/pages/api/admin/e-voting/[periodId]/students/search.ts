import type { APIRoute } from 'astro';
import { db } from '../../../../../../lib/prisma';
import { searchStudents } from '../../../../../../lib/voting/candidates';
import { csrfHeader, json, UUID } from '../../../../../../lib/voting/admin-http';

export const prerender = false;

export const GET: APIRoute = async ({ params, url, locals, cookies }) => {
  if (!params.periodId || !UUID.test(params.periodId)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
  try {
    if (!await db.electionPeriod.findUnique({ where: { id: params.periodId }, select: { id: true } })) return json({ error: { code: 'NOT_FOUND' } }, 404);
    const limit = Number(url.searchParams.get('limit') ?? 20);
    const data = await searchStudents(url.searchParams.get('q') ?? '', Number.isFinite(limit) ? limit : 20);
    return json({ data }, 200, { 'X-CSRF-Token': csrfHeader(locals.session!.sub, cookies.get('smkdh_token')?.value ?? '') });
  } catch { return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503); }
};
