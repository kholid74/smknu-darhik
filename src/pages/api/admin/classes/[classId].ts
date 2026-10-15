import type { APIRoute } from 'astro';
import { deleteSchoolClass, updateSchoolClass } from '../../../../lib/students';
import { StudentError, validateSchoolClassInput } from '../../../../lib/students-input';
import { json, readJson, validMutation } from '../../../../lib/voting/admin-http';

export const prerender = false;
const validId = (id: string | undefined): id is string => !!id && /^[a-zA-Z0-9_-]{1,30}$/.test(id);

export const PATCH: APIRoute = async ({ params, request, locals, cookies }) => {
  if (!validId(params.classId)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
  const accountId = locals.session!.sub;
  if (!validMutation(request, accountId, cookies.get('smkdh_token')?.value ?? '')) return json({ error: { code: 'CSRF_REJECTED' } }, 403);
  try {
    return json({ data: await updateSchoolClass(params.classId, validateSchoolClassInput(await readJson(request)), accountId) });
  } catch (error) {
    if (error instanceof StudentError) return json({ error: { code: error.code } }, error.code === 'NOT_FOUND' ? 404 : 400);
    if ((error as { code?: string })?.code === 'P2002') return json({ error: { code: 'DUPLICATE_CLASS' } }, 409);
    return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503);
  }
};

export const DELETE: APIRoute = async ({ params, request, locals, cookies }) => {
  if (!validId(params.classId)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
  const accountId = locals.session!.sub;
  if (!validMutation(request, accountId, cookies.get('smkdh_token')?.value ?? '')) return json({ error: { code: 'CSRF_REJECTED' } }, 403);
  try {
    await deleteSchoolClass(params.classId);
    return json({ data: { deleted: true } });
  } catch (error) {
    if (error instanceof StudentError) return json({ error: { code: error.code } }, error.code === 'NOT_FOUND' ? 404 : 409);
    if ((error as { code?: string })?.code === 'P2003') return json({ error: { code: 'CLASS_HAS_STUDENTS' } }, 409);
    return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503);
  }
};
