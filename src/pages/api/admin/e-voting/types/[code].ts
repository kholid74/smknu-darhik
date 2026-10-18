import type { APIRoute } from 'astro';
import { json, readJson, validMutation } from '../../../../../lib/voting/admin-http';
import { validateRevision, validateTypeCode, validateTypePatch } from '../../../../../lib/voting/election-type-input';
import { deleteElectionType, updateElectionType } from '../../../../../lib/voting/election-types';
import { electionTypeFailure } from '../../../../../lib/voting/election-type-http';

export const prerender = false;
export const PATCH: APIRoute = async ({ params, request, locals, cookies, url }) => {
  const actor = locals.session!.sub;
  if (!validMutation(request, actor, cookies.get('smkdh_token')?.value ?? '')) return json({ error: { code: 'CSRF_REJECTED' } }, 403);
  try {
    const data = await updateElectionType(validateTypeCode(params.code), validateTypePatch(await readJson(request)), actor, url.origin);
    return json({ data });
  } catch (error) { return electionTypeFailure(error); }
};
export const DELETE: APIRoute = async ({ params, request, locals, cookies }) => {
  const actor = locals.session!.sub;
  if (!validMutation(request, actor, cookies.get('smkdh_token')?.value ?? '')) return json({ error: { code: 'CSRF_REJECTED' } }, 403);
  try {
    await deleteElectionType(validateTypeCode(params.code), validateRevision(await readJson(request)), actor);
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch (error) { return electionTypeFailure(error); }
};
