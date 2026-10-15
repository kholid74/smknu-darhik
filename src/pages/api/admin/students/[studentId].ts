import type { APIRoute } from 'astro';
import { updateStudent } from '../../../../lib/students';
import { StudentError, validateExpectedStudent, validateStudentInput } from '../../../../lib/students-input';
import { json, readJson, validMutation } from '../../../../lib/voting/admin-http';
import { UUID } from '../../../../lib/voting/admin-http';

export const prerender = false;

export const PATCH: APIRoute = async ({ params, request, locals, cookies }) => {
  if (!params.studentId || !UUID.test(params.studentId)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
  const accountId = locals.session!.sub;
  if (!validMutation(request, accountId, cookies.get('smkdh_token')?.value ?? '')) return json({ error: { code: 'CSRF_REJECTED' } }, 403);
  try {
    const parsed = await readJson(request);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json({ error: { code: 'INVALID_INPUT' } }, 400);
    const body = parsed as Record<string, unknown>;
    const student = await updateStudent(params.studentId, validateStudentInput(body.input), validateExpectedStudent(body.expected), accountId);
    return json({ data: student });
  } catch (error) {
    if (error instanceof StudentError) return json({ error: { code: error.code } },
      error.code === 'NOT_FOUND' ? 404 : ['INVALID_INPUT', 'INVALID_CLASS'].includes(error.code) ? 400 : 409);
    if ((error as { code?: string })?.code === 'P2002') return json({ error: { code: 'DUPLICATE_NISN' } }, 409);
    return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503);
  }
};
