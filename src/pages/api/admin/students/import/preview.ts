import type { APIRoute } from 'astro';
import { previewStudentImport } from '../../../../../lib/students';
import { readStudentCsv } from '../../../../../lib/student-import-http';
import { StudentError } from '../../../../../lib/students-input';
import { json, validMutation } from '../../../../../lib/voting/admin-http';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const accountId = locals.session!.sub;
  if (!validMutation(request, accountId, cookies.get('smkdh_token')?.value ?? '')) return json({ error: { code: 'CSRF_REJECTED' } }, 403);
  try { return json({ data: await previewStudentImport(await readStudentCsv(request)) }); }
  catch (error) {
    if (error instanceof StudentError) {
      const status = error.code === 'UNSUPPORTED_MEDIA_TYPE' ? 415 : error.code === 'FILE_TOO_LARGE' ? 413 : 400;
      return json({ error: { code: error.code } }, status);
    }
    return json({ error: { code: 'TEMPORARILY_UNAVAILABLE' } }, 503);
  }
};
