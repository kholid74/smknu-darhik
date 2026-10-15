import type { APIRoute } from 'astro';
import { createStudent, listStudents } from '../../../../lib/students';
import { StudentError, validateStudentInput } from '../../../../lib/students-input';
import { csrfHeader, json, validMutation, UUID } from '../../../../lib/voting/admin-http';

export const prerender = false;

export const GET: APIRoute = async ({ url, locals, cookies }) => {
  const q = url.searchParams.get('q') ?? '';
  const cursor = url.searchParams.get('cursor');
  if (q.length > 120 || (cursor !== null && !UUID.test(cursor))) return json({ error: { code: 'INVALID_INPUT' } }, 400);
  try {
    const limit = Number(url.searchParams.get('limit') ?? 50);
    const data = await listStudents(q, cursor, Number.isFinite(limit) ? limit : 50);
    return json({ data, nextCursor: data.length === Math.min(Math.max(limit, 1), 100) ? data.at(-1)?.id : null }, 200, {
      'X-CSRF-Token': csrfHeader(locals.session!.sub, cookies.get('smkdh_token')?.value ?? ''),
    });
  } catch { return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503); }
};

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const accountId = locals.session!.sub;
  const binding = cookies.get('smkdh_token')?.value ?? '';
  if (!validMutation(request, accountId, binding)) return json({ error: { code: 'CSRF_REJECTED' } }, 403);
  try {
    const input = validateStudentInput(await readJson(request));
    const student = await createStudent(input, accountId);
    return json({ data: student }, 201);
  } catch (error) {
    if (error instanceof StudentError) return json({ error: { code: error.code } }, 400);
    if ((error as { code?: string })?.code === 'P2002') return json({ error: { code: 'DUPLICATE_NISN' } }, 409);
    return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503);
  }
};
