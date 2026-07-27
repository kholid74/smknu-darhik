import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { db } from './prisma';
import { env } from './env';

const SECRET = new TextEncoder().encode(env('JWT_SECRET') || 'smkdh-dev-secret-change-in-production');
const COOKIE_NAME = 'smkdh_token';

// Hash password
export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

// Verify password
export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

// Sign JWT token
export async function signToken(userId: string, role: string): Promise<string> {
  return new SignJWT({ sub: userId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(SECRET);
}

// Verify JWT token
export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as { sub: string; role: string };
  } catch {
    return null;
  }
}

// Login — validate credentials, return token
export async function login(username: string, password: string): Promise<string | null> {
  const admin = await db.admin.findUnique({ where: { username } });
  if (!admin) return null;
  const valid = await verifyPassword(password, admin.password);
  if (!valid) return null;
  return signToken(admin.id, admin.role);
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
