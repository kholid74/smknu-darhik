import type { APIRoute } from 'astro';
import { csrfHeader, json, readJson, validMutation } from '../../../../../lib/voting/admin-http';
import { validateTypeInput, validateTypeQuery } from '../../../../../lib/voting/election-type-input';
import { createElectionType, listElectionTypes } from '../../../../../lib/voting/election-types';
import { electionTypeFailure } from '../../../../../lib/voting/election-type-http';

export const prerender = false;
export const GET: APIRoute = async ({ url, locals, cookies }) => {
  try {
    const data = await listElectionTypes(validateTypeQuery(url.searchParams));
    return json({ data }, 200, { 'X-CSRF-Token': csrfHeader(locals.session!.sub, cookies.get('smkdh_token')?.value ?? '') });
  } catch (error) { return electionTypeFailure(error); }
};
export const POST: APIRoute = async ({ request, locals, cookies, url }) => {
  const actor = locals.session!.sub;
  if (!validMutation(request, actor, cookies.get('smkdh_token')?.value ?? '')) return json({ error: { code: 'CSRF_REJECTED' } }, 403);
  try {
    const data = await createElectionType(validateTypeInput(await readJson(request)), actor, url.origin);
    return json({ data }, 201, { Location: `/api/admin/e-voting/types/${data.code}` });
  } catch (error) { return electionTypeFailure(error); }
};
