import type { APIRoute } from 'astro';
import { createSchoolClass, listSchoolClasses } from '../../../lib/students';
import { StudentError, validateSchoolClassInput } from '../../../lib/students-input';
import { csrfHeader, json, readJson, validMutation } from '../../../lib/voting/admin-http';

export const prerender = false;

export const GET: APIRoute = async ({ locals, cookies }) => {
  try {
    return json({ data: await listSchoolClasses() }, 200, {
      'X-CSRF-Token': csrfHeader(locals.session!.sub, cookies.get('smkdh_token')?.value ?? ''),
    });
  } catch { return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503); }
};

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const accountId = locals.session!.sub;
  if (!validMutation(request, accountId, cookies.get('smkdh_token')?.value ?? '')) return json({ error: { code: 'CSRF_REJECTED' } }, 403);
  try { return json({ data: await createSchoolClass(validateSchoolClassInput(await readJson(request))) }, 201); }
  catch (error) {
    if (error instanceof StudentError) return json({ error: { code: error.code } }, 400);
    if ((error as { code?: string })?.code === 'P2002') return json({ error: { code: 'DUPLICATE_CLASS' } }, 409);
    return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503);
  }
};
