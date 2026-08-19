import { randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { AstroCookies } from 'astro';
import { db } from './prisma';
import { requireEnv, env } from './env';
import { sendEmail } from './email';
import { hashToken } from './alumni-token';

export { hashToken, tokenState, type TokenState } from './alumni-token';

// Realm ALUMNI — terpisah dari Internal (Account). Alumni tak punya password:
// login via magic-link email single-use, lalu sesi cookie sendiri.

const SECRET = new TextEncoder().encode(requireEnv('JWT_SECRET'));
export const ALUMNI_COOKIE = 'smkdh_alumni';
const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 menit
const RESEND_COOLDOWN_MS = 60 * 1000; // anti-spam: 1 menit antar permintaan
const SESSION_TTL = '30d';

// ---- sesi (JWT cookie smkdh_alumni) ----
export async function signAlumniSession(alumniId: string): Promise<string> {
  return new SignJWT({ sub: alumniId, kind: 'alumni' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(SECRET);
}

export async function verifyAlumniSession(token: string): Promise<{ sub: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if ((payload as any).kind !== 'alumni' || !payload.sub) return null;
    return { sub: String(payload.sub) };
  } catch {
    return null;
  }
}

export async function getAlumniSession(cookies: AstroCookies): Promise<{ sub: string } | null> {
  const token = cookies.get(ALUMNI_COOKIE)?.value;
  return token ? verifyAlumniSession(token) : null;
}

export function alumniCookieOpts(maxAge: number) {
  return { httpOnly: true, path: '/', maxAge, sameSite: 'lax' as const, secure: (env('PUBLIC_SITE_URL') || '').startsWith('https') };
}

// ---- magic-link ----
// Selalu selesai tanpa membocorkan apakah email terdaftar (anti user-enumeration).
export async function requestMagicLink(emailRaw: string, origin: string): Promise<void> {
  const email = emailRaw.trim().toLowerCase();
  if (!email) return;
  const alumni = await db.alumni.findFirst({ where: { email, verified: true }, select: { id: true } });
  if (!alumni) return;

  // Rate-limit: sudah ada token belum-terpakai yang dibuat <60 dtk lalu -> jangan kirim lagi.
  const recent = await db.alumniLoginToken.findFirst({
    where: { alumniId: alumni.id, usedAt: null, createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) } },
    select: { id: true },
  });
  if (recent) return;

  const raw = randomBytes(32).toString('base64url');
  await db.alumniLoginToken.create({
    data: { alumniId: alumni.id, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });

  const link = new URL(`/alumni/masuk/${raw}`, origin).toString();
  await sendEmail({
    to: email,
    subject: 'Link masuk portal alumni — SMKS NU Darul Hikam',
    text: `Klik untuk masuk ke portal alumni (berlaku 15 menit, sekali pakai):\n${link}\n\nAbaikan email ini bila Anda tidak meminta.`,
    html: magicLinkHtml(link),
  });
}

// Konsumsi token: valid & belum dipakai & belum kedaluwarsa -> tandai used (atomik) -> alumniId.
export async function consumeMagicLink(raw: string): Promise<string | null> {
  if (!raw) return null;
  const hash = hashToken(raw);
  const row = await db.alumniLoginToken.findUnique({ where: { tokenHash: hash }, select: { id: true, alumniId: true } });
  if (!row) return null;
  // Update bersyarat = kunci single-use tahan race (hanya sukses bila masih valid).
  const res = await db.alumniLoginToken.updateMany({
    where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (res.count !== 1) return null;
  return row.alumniId;
}

function magicLinkHtml(link: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#1c1b1b">
  <h2 style="color:#1B7A3D;font-size:18px">Portal Alumni SMKS NU Darul Hikam</h2>
  <p style="font-size:14px;line-height:1.6">Klik tombol di bawah untuk masuk ke portal alumni. Tautan berlaku <strong>15 menit</strong> dan hanya bisa dipakai sekali.</p>
  <p style="margin:24px 0"><a href="${link}" style="background:#1B7A3D;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:14px;display:inline-block">Masuk ke Portal</a></p>
  <p style="font-size:12px;color:#6f7a6e;line-height:1.6">Bila tombol tak berfungsi, salin tautan ini:<br><span style="word-break:break-all">${link}</span></p>
  <p style="font-size:12px;color:#6f7a6e;margin-top:20px">Abaikan email ini bila Anda tidak meminta tautan masuk.</p>
</div>`;
}
