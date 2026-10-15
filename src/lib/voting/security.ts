import { createHmac, timingSafeEqual } from 'node:crypto';

export function createCsrfToken(secret: string, accountId: string, sessionBinding: string, now = Date.now()): string {
  const issuedAt = Math.floor(now / 1000);
  const signature = createHmac('sha256', secret).update(`admin:${accountId}:${sessionBinding}:${issuedAt}`).digest('base64url');
  return `${issuedAt}.${signature}`;
}

export function createPreauthCsrfToken(secret: string, nonce: string, now = Date.now()): string {
  const issuedAt = Math.floor(now / 1000);
  const signature = createHmac('sha256', secret).update(`student-preauth:${nonce}:${issuedAt}`).digest('base64url');
  return `${issuedAt}.${signature}`;
}

export function verifyPreauthCsrfToken(secret: string, nonce: string, token: string | null, now = Date.now()): boolean {
  if (!token) return false;
  const [rawTime, signature, extra] = token.split('.');
  if (!rawTime || !signature || extra !== undefined || !/^\d+$/.test(rawTime)) return false;
  const issuedAt = Number(rawTime);
  const current = Math.floor(now / 1000);
  if (!Number.isSafeInteger(issuedAt) || issuedAt > current + 30 || current - issuedAt > 300) return false;
  const expected = createHmac('sha256', secret).update(`student-preauth:${nonce}:${issuedAt}`).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(signature, 'base64url'); } catch { return false; }
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function createStudentSessionCsrfToken(secret: string, sessionId: string, now = Date.now()): string {
  const issuedAt = Math.floor(now / 1000);
  const signature = createHmac('sha256', secret).update(`student-session:${sessionId}:${issuedAt}`).digest('base64url');
  return `${issuedAt}.${signature}`;
}

export function verifyStudentSessionCsrfToken(secret: string, sessionId: string, token: string | null, now = Date.now()): boolean {
  if (!token) return false;
  const [rawTime, signature, extra] = token.split('.');
  if (!rawTime || !signature || extra !== undefined || !/^\d+$/.test(rawTime)) return false;
  const issuedAt = Number(rawTime);
  const current = Math.floor(now / 1000);
  if (!Number.isSafeInteger(issuedAt) || issuedAt > current + 30 || current - issuedAt > 900) return false;
  const expected = createHmac('sha256', secret).update(`student-session:${sessionId}:${issuedAt}`).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(signature, 'base64url'); } catch { return false; }
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function verifyCsrfToken(secret: string, accountId: string, sessionBinding: string, token: string | null, now = Date.now()): boolean {
  if (!token) return false;
  const [rawTime, signature, extra] = token.split('.');
  if (!rawTime || !signature || extra !== undefined || !/^\d+$/.test(rawTime)) return false;
  const issuedAt = Number(rawTime);
  const current = Math.floor(now / 1000);
  if (!Number.isSafeInteger(issuedAt) || issuedAt > current + 30 || current - issuedAt > 300) return false;
  const expected = createHmac('sha256', secret).update(`admin:${accountId}:${sessionBinding}:${issuedAt}`).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(signature, 'base64url'); } catch { return false; }
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function isSameOrigin(request: Request): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') return false;
  const origin = request.headers.get('origin') ?? request.headers.get('referer');
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
