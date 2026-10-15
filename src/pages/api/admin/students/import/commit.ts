import type { APIRoute } from 'astro';
import { importStudents } from '../../../../../lib/students';
import { readStudentCsv } from '../../../../../lib/student-import-http';
import { StudentError } from '../../../../../lib/students-input';
import { json, validMutation } from '../../../../../lib/voting/admin-http';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const accountId = locals.session!.sub;
  if (!validMutation(request, accountId, cookies.get('smkdh_token')?.value ?? '')) return json({ error: { code: 'CSRF_REJECTED' } }, 403);
  try { return json({ data: await importStudents(await readStudentCsv(request), accountId) }, 201); }
  catch (error) {
    if (error instanceof StudentError) {
      if (error.code === 'IMPORT_VALIDATION_FAILED') return json({ error: { code: error.code }, data: error.details }, 422);
      const status = error.code === 'UNSUPPORTED_MEDIA_TYPE' ? 415 : error.code === 'FILE_TOO_LARGE' ? 413 : 400;
      return json({ error: { code: error.code } }, status);
    }
    if ((error as { code?: string })?.code === 'P2002') return json({ error: { code: 'DUPLICATE_NISN' } }, 409);
    return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503);
  }
};
