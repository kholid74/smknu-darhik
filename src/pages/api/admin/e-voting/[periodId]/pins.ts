import type { APIRoute } from 'astro';
import { db } from '../../../../../lib/prisma';
import { json, readJson, validMutation, UUID } from '../../../../../lib/voting/admin-http';
import { PinError, validatePinRequest } from '../../../../../lib/voting/pin-input';
import { issuePins } from '../../../../../lib/voting/pins';
import { renderPinSlips } from '../../../../../lib/voting/pin-slips';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, locals, cookies, url }) => {
  if (!params.periodId || !UUID.test(params.periodId)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
  const actorId = locals.session!.sub;
  if (!validMutation(request, actorId, cookies.get('smkdh_token')?.value ?? '')) return json({ error: { code: 'CSRF_REJECTED' } }, 403);
  try {
    const input = validatePinRequest(await readJson(request));
    const period = await db.electionPeriod.findUnique({ where: { id: params.periodId }, select: { name: true, slug: true, opensAt: true, closesAt: true } });
    if (!period) return json({ error: { code: 'NOT_FOUND' } }, 404);
    const slips = await issuePins(params.periodId, input, actorId);
    return new Response(renderPinSlips(period, slips, url.origin), { status: 200, headers: {
      'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store, max-age=0',
      'Pragma': 'no-cache', 'Expires': '0', 'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    } });
  } catch (error) {
    if (error instanceof PinError) {
      const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'INVALID_REAUTH' ? 401 : error.code === 'INVALID_INPUT' ? 400 : error.code === 'PIN_COLLISION' ? 503 : error.code === 'RATE_LIMITED' ? 429 : 409;
      return json({ error: { code: error.code } }, status, error.code === 'RATE_LIMITED' ? { 'Retry-After': '900' } : {});
    }
    return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503);
  }
};
