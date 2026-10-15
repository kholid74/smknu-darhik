import { requireEnv } from '../env';
import { createCsrfToken, isSameOrigin, verifyCsrfToken } from './security';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function csrfSecret() {
  const secret = requireEnv('VOTING_CSRF_SECRET');
  if (Buffer.byteLength(secret) < 32) throw new Error('VOTING_CSRF_SECRET must contain at least 32 bytes');
  return secret;
}

export function json(data: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(data), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'Referrer-Policy': 'no-referrer',
    ...extraHeaders,
  } });
}

export function csrfHeader(accountId: string, sessionBinding: string) {
  return createCsrfToken(csrfSecret(), accountId, sessionBinding);
}

export function validMutation(request: Request, accountId: string, sessionBinding: string) {
  return isSameOrigin(request) && verifyCsrfToken(
    csrfSecret(), accountId, sessionBinding, request.headers.get('x-csrf-token'),
  );
}

export async function readJson(request: Request, maxBytes = 16 * 1024): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') throw new Error('UNSUPPORTED_MEDIA_TYPE');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('INVALID_INPUT');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel();
      throw new Error('BODY_TOO_LARGE');
    }
    chunks.push(value);
  }
  try {
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch { throw new Error('INVALID_INPUT'); }
}
