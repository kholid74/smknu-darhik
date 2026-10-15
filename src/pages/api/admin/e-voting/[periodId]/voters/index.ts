import type { APIRoute } from 'astro';
import { db } from '../../../../../../lib/prisma';
import { PeriodError } from '../../../../../../lib/voting/period-input';
import { csrfHeader, json, readJson, validMutation, UUID } from '../../../../../../lib/voting/admin-http';
import { listVoters, syncMasterRoster } from '../../../../../../lib/voting/voters';
import { RosterError } from '../../../../../../lib/voting/voter-roster-input';

export const prerender = false;

function failure(error: unknown) {
  if (error instanceof PeriodError) return json({ error: { code: error.code } }, error.code === 'NOT_FOUND' ? 404 : 409);
  if (error instanceof RosterError) {
    const conflict = error.code !== 'INVALID_INPUT';
    return json({ error: { code: error.code } }, conflict ? 409 : 400);
  }
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : 'UNKNOWN';
  console.error('E-voting roster sync failed:', error instanceof Error ? error.name : 'UnknownError', code);
  return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503);
}

export const GET: APIRoute = async ({ params, url, locals, cookies }) => {
  if (!params.periodId || !UUID.test(params.periodId)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
  const cursor = url.searchParams.get('cursor');
  const limit = Number(url.searchParams.get('limit') ?? 50);
  const className = url.searchParams.get('className');
  if ((cursor !== null && !UUID.test(cursor)) || (className && className.length > 40)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
  try {
    if (!await db.electionPeriod.findUnique({ where: { id: params.periodId }, select: { id: true } })) return json({ error: { code: 'NOT_FOUND' } }, 404);
    const data = await listVoters(params.periodId, cursor, Number.isFinite(limit) ? limit : 50, className);
    return json({ data, nextCursor: data.length === Math.min(Math.max(limit, 1), 100) ? data.at(-1)?.id : null }, 200, {
      'X-CSRF-Token': csrfHeader(locals.session!.sub, cookies.get('smkdh_token')?.value ?? ''),
    });
  } catch { return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503); }
};

export const POST: APIRoute = async ({ params, request, locals, cookies }) => {
  if (!params.periodId || !UUID.test(params.periodId)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
  const actorId = locals.session!.sub;
  if (!validMutation(request, actorId, cookies.get('smkdh_token')?.value ?? '')) return json({ error: { code: 'CSRF_REJECTED' } }, 403);
  try {
    const body = await readJson(request, 1024);
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length) return json({ error: { code: 'INVALID_INPUT' } }, 400);
    const result = await syncMasterRoster(params.periodId, actorId);
    return json({ data: result });
  } catch (error) { return failure(error); }
};
