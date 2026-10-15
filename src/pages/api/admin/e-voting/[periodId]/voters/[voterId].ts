import type { APIRoute } from 'astro';
import { can } from '../../../../../../lib/rbac';
import { getPrincipal } from '../../../../../../lib/auth';
import { json, readJson, validMutation, UUID } from '../../../../../../lib/voting/admin-http';
import { PeriodError } from '../../../../../../lib/voting/period-input';
import { RosterError, validatePostOpenRosterCorrection, validateRosterSnapshot } from '../../../../../../lib/voting/voter-roster-input';
import { removeVoterFromRoster, syncVoterFromMaster } from '../../../../../../lib/voting/voters';

export const prerender = false;

function errorResponse(error: unknown) {
  if (error instanceof PeriodError) return json({ error: { code: error.code } }, error.code === 'NOT_FOUND' ? 404 : 409);
  if (error instanceof RosterError) {
    const status = error.code === 'NOT_FOUND' || error.code === 'STUDENT_NOT_FOUND' ? 404 : ['INVALID_INPUT'].includes(error.code) ? 400 : 409;
    return json({ error: { code: error.code } }, status);
  }
  if ((error as { code?: string })?.code === 'P2002') return json({ error: { code: 'NISN_ALREADY_ROSTERED' } }, 409);
  return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503);
}

export const PATCH: APIRoute = async ({ params, request, locals, cookies }) => {
  if (!params.periodId || !UUID.test(params.periodId) || !params.voterId || !UUID.test(params.voterId)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
  const actorId = locals.session!.sub;
  if (!can(locals.principal!, 'evoting.pemilih') || !can(locals.principal!, 'student.kelola')) return json({ error: { code: 'FORBIDDEN' } }, 403);
  if (!validMutation(request, actorId, cookies.get('smkdh_token')?.value ?? '')) return json({ error: { code: 'CSRF_REJECTED' } }, 403);
  try {
    const body = await readJson(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
    const input = body as Record<string, unknown>;
    if ('reviewerAccountId' in input) {
      const correction = validatePostOpenRosterCorrection(body);
      if (correction.reviewerAccountId === actorId) throw new RosterError('TWO_REVIEWERS_REQUIRED');
      const reviewer = await getPrincipal(correction.reviewerAccountId);
      if (!reviewer || !can(reviewer, 'evoting.pemilih') || !can(reviewer, 'student.kelola')) return json({ error: { code: 'TWO_REVIEWERS_REQUIRED' } }, 409);
      return json({ data: await syncVoterFromMaster(params.periodId, params.voterId, correction.expectedSnapshot, actorId,
        correction.adminPassword, { accountId: correction.reviewerAccountId, password: correction.reviewerPassword }) });
    }
    if (Object.keys(input).length !== 2 || input.syncFromMaster !== true || !('expectedSnapshot' in input)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
    const expected = validateRosterSnapshot(input.expectedSnapshot);
    return json({ data: await syncVoterFromMaster(params.periodId, params.voterId, expected, actorId) });
  } catch (error) { return errorResponse(error); }
};

export const DELETE: APIRoute = async ({ params, request, locals, cookies }) => {
  if (!params.periodId || !UUID.test(params.periodId) || !params.voterId || !UUID.test(params.voterId)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
  const actorId = locals.session!.sub;
  if (!can(locals.principal!, 'evoting.pemilih')) return json({ error: { code: 'FORBIDDEN' } }, 403);
  if (!validMutation(request, actorId, cookies.get('smkdh_token')?.value ?? '')) return json({ error: { code: 'CSRF_REJECTED' } }, 403);
  try {
    const body = await readJson(request);
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || !('expectedSnapshot' in body)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
    const expected = validateRosterSnapshot((body as Record<string, unknown>).expectedSnapshot);
    await removeVoterFromRoster(params.periodId, params.voterId, expected, actorId);
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch (error) { return errorResponse(error); }
};
