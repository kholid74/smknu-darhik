import type { APIRoute } from 'astro';
import { can } from '../../../../../lib/rbac';
import { publishPeriod } from '../../../../../lib/voting/periods';
import { PeriodError } from '../../../../../lib/voting/period-input';
import { json, readJson, validMutation, UUID } from '../../../../../lib/voting/admin-http';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, locals, cookies }) => {
  if (!params.periodId || !UUID.test(params.periodId)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
  if (!locals.principal || !can(locals.principal, 'evoting.publikasi')) return json({ error: { code: 'FORBIDDEN' } }, 403);
  const actorId = locals.session!.sub;
  if (!validMutation(request, actorId, cookies.get('smkdh_token')?.value ?? '')) return json({ error: { code: 'CSRF_REJECTED' } }, 403);
  try {
    const body = await readJson(request);
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 ||
        typeof (body as Record<string, unknown>).adminPassword !== 'string' || !String((body as Record<string, unknown>).adminPassword).length ||
        String((body as Record<string, unknown>).adminPassword).length > 256) return json({ error: { code: 'INVALID_INPUT' } }, 400);
    return json({ data: await publishPeriod(params.periodId, actorId, (body as { adminPassword: string }).adminPassword) });
  } catch (error) {
    if (error instanceof PeriodError) {
      const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'INVALID_REAUTH' ? 401 : error.code === 'RATE_LIMITED' ? 429 : error.code === 'INVALID_STATE' ? 409 : 400;
      return json({ error: { code: error.code } }, status);
    }
    const code=error instanceof Error?error.message:'';
    if(['INVALID_INPUT','BODY_TOO_LARGE','UNSUPPORTED_MEDIA_TYPE'].includes(code))return json({error:{code}},code==='BODY_TOO_LARGE'?413:code==='UNSUPPORTED_MEDIA_TYPE'?415:400);
    return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503);
  }
};
