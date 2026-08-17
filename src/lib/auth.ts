import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { db } from './prisma';
import { requireEnv } from './env';
import { primaryRole, type Principal } from './rbac';

// Isi sesi terverifikasi. `role` (utama) dipertahankan untuk kompat halaman lama;
// `roles` (semua peran) yang jadi acuan otorisasi.
export interface Session {
  sub: string;
  roles: string[];
  role: string;
}

// No committed fallback: a hardcoded default secret in a public repo lets
// anyone forge a superadmin token. Fail loudly if JWT_SECRET is unset.
const SECRET = new TextEncoder().encode(requireEnv('JWT_SECRET'));
const COOKIE_NAME = 'smkdh_token';

// Hash password
export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

// Verify password
export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

// Sign JWT token — bawa semua roles; role utama diturunkan untuk kompat.
export async function signToken(accountId: string, roles: string[]): Promise<string> {
  return new SignJWT({ sub: accountId, roles, role: primaryRole(roles) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(SECRET);
}

// Verify JWT token. Token lama (hanya `role`) di-normalisasi jadi roles=[role].
export async function verifyToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    const p = payload as { sub: string; roles?: string[]; role?: string };
    const roles = p.roles ?? (p.role ? [p.role] : []);
    return { sub: p.sub, roles, role: p.role ?? primaryRole(roles) };
  } catch {
    return null;
  }
}

// Login — identifier = email atau username. Cek akun aktif, cocokkan hash.
export async function login(identifier: string, password: string): Promise<string | null> {
  const id = identifier.trim();
  const account = await db.account.findFirst({
    where: { OR: [{ email: id }, { username: id }] },
    include: { roles: true },
  });
  if (!account || !account.active) return null;
  const valid = await verifyPassword(password, account.passwordHash);
  if (!valid) return null;
  return signToken(
    account.id,
    account.roles.map((r) => r.role)
  );
}

// Bentuk Principal (untuk rbac.can) dari DB: roles + override grant/revoke.
// Override dibaca saat pengecekan (bukan dari token) agar cabut izin langsung berlaku.
export async function getPrincipal(accountId: string): Promise<Principal | null> {
  const account = await db.account.findUnique({
    where: { id: accountId },
    include: { roles: true, overrides: true },
  });
  if (!account || !account.active) return null;
  return {
    roles: account.roles.map((r) => r.role),
    grants: account.overrides.filter((o) => o.effect === 'grant').map((o) => o.capability),
    revokes: account.overrides.filter((o) => o.effect === 'revoke').map((o) => o.capability),
  };
}

// Get current session from request
export async function getSession(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  return verifyToken(match[1]);
}

// Cookie options
export function authCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax`;
}

export function clearCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

// Generate bcrypt hash for seed
export async function generateSeedHash() {
  return hashPassword('admin123');
}
