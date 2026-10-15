import type { APIRoute } from 'astro';
import { csrfHeader, json, UUID } from '../../../../../../lib/voting/admin-http';
import { PeriodError } from '../../../../../../lib/voting/period-input';
import { previewMasterRoster } from '../../../../../../lib/voting/voters';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals, cookies }) => {
  if (!params.periodId || !UUID.test(params.periodId)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
  try {
    return json({ data: await previewMasterRoster(params.periodId) }, 200, {
      'X-CSRF-Token': csrfHeader(locals.session!.sub, cookies.get('smkdh_token')?.value ?? ''),
    });
  } catch (error) {
    if (error instanceof PeriodError) return json({ error: { code: error.code } }, error.code === 'NOT_FOUND' ? 404 : 409);
    return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503);
  }
};
