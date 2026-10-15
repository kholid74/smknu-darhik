import { defineMiddleware } from 'astro:middleware';
import { verifyToken, getPrincipal } from './lib/auth';
import { getAlumniSession } from './lib/alumni-auth';
import { can } from './lib/rbac';
import { db } from './lib/prisma';
import { tokenHash } from './lib/voting/student-auth';
import { isActiveVotingSession, isStudentSessionCookie, studentRouteAccess, VOTING_SESSION_COOKIE } from './lib/voting/student-session';

// Gerbang otorisasi terpusat untuk realm Internal (/admin + API tulis).
// Guard inline di tiap halaman tetap ada sebagai defense-in-depth (dihapus bertahap).
//
// Peta segmen pertama /admin/<seg> -> kapabilitas yang diperlukan.
// Segmen tak terdaftar (mis. dashboard /admin) cukup butuh sesi login yang sah.
const ROUTE_CAP: Record<string, string> = {
  artikel: 'artikel.kelola',
  prestasi: 'prestasi.kelola',
  guru: 'guru.kelola',
  mitra: 'mitra.kelola',
  testimoni: 'testimoni.kelola',
  fasilitas: 'fasilitas.kelola',
  ekskul: 'ekskul.kelola',
  faq: 'faq.kelola',
  download: 'download.kelola',
  jurusan: 'jurusan.kelola',
  halaman: 'halaman.kelola',
  pengumuman: 'pengumuman.kelola',
  galeri: 'galeri.kelola',
  kontribusi: 'kontribusi.kelola',
  media: 'media.kelola',
  'profil-saya': 'profil.edit-sendiri',
  usulan: 'konten.usul',
  alumni: 'alumni.moderasi',
  siswa: 'student.kelola',
  kelas: 'student.kelola',
  'e-voting': 'evoting.lihat',
  pengaturan: 'setting.kelola', // superadmin (*) saja
  pengguna: 'account.kelola', // superadmin (*) saja
};

// API tulis yang butuh proteksi (yang lain — announce, image proxy — publik).
const API_CAP: Record<string, string> = {
  '/api/upload': 'media.kelola',
  '/api/media': 'media.kelola',
  '/api/admin/students': 'student.kelola',
  '/api/admin/classes': 'student.kelola',
};

function apiCapability(path: string, method: string): string | undefined {
  const exactOrPrefix = Object.entries(API_CAP).find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1];
  if (exactOrPrefix) return exactOrPrefix;
  if (path.startsWith('/api/admin/e-voting/')) {
    if (/\/test-cleanup\/?$/.test(path)) return 'evoting.hapus-uji';
    if (method === 'GET' && /\/participation\/voters\/?$/.test(path)) return 'evoting.partisipasi';
    if (method === 'GET' && /\/participation\/?$/.test(path)) return 'evoting.partisipasi';
    if (method === 'POST' && /\/voters\/?$/.test(path)) return 'evoting.pemilih';
    if (['PATCH', 'DELETE'].includes(method) && /\/voters\/[0-9a-f-]+\/?$/i.test(path)) return 'evoting.pemilih';
    if (method === 'POST' && /\/close\/?$/.test(path)) return 'evoting.tutup';
    if (method === 'POST' && /\/publish\/?$/.test(path)) return 'evoting.publikasi';
    if (method === 'POST' && /\/extend\/?$/.test(path)) return 'evoting.perpanjang';
    if (method === 'GET' && /\/students\/search\/?$/.test(path)) return 'evoting.pemilih';
    if (method === 'GET' && /\/voters\/master-preview\/?$/.test(path)) return 'evoting.pemilih';
    if (method === 'GET' && /\/voters\/?$/.test(path)) return 'evoting.pemilih';
    if (method === 'POST' && /\/pins\/?$/.test(path)) return 'evoting.pin';
    return method === 'GET' ? 'evoting.lihat' : 'evoting.kelola';
  }
  return undefined;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;

  // Realm ALUMNI: gerbang portal (sesi terpisah, bukan RBAC internal).
  if (path.startsWith('/alumni/portal')) {
    const alumni = await getAlumniSession(context.cookies);
    if (!alumni) return context.redirect('/alumni/masuk');
    context.locals.alumniId = alumni.sub;
    return next();
  }

  const studentAccess = studentRouteAccess(path);
  if (studentAccess === 'forbidden') return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'private, no-store' } });
  if (studentAccess === 'protected') {
    const rawToken = context.cookies.get(VOTING_SESSION_COOKIE)?.value;
    const record = isStudentSessionCookie(rawToken) ? await db.votingSession.findUnique({
      where: { tokenHash: tokenHash(rawToken) },
      select: { id: true, scope: true, voterId: true, createdAt: true, lastSeenAt: true, expiresAt: true,
        voter: { select: { periodId: true, credentialEnabled: true,
          participation: { where: { hasVoted: true }, select: { organization: true } },
          period: { select: { slug: true, state: true, opensAt: true, closesAt: true } },
        } },
      },
    }) : null;
    const [{ now }] = await db.$queryRaw<[{ now: Date }]>`SELECT clock_timestamp() AS "now"`;
    const active = record && isActiveVotingSession({
      scope: record.scope, createdAt: record.createdAt, expiresAt: record.expiresAt,
      credentialEnabled: record.voter.credentialEnabled, periodState: record.voter.period.state,
      opensAt: record.voter.period.opensAt, closesAt: record.voter.period.closesAt,
      completed: record.voter.participation.length >= 4,
    }, now);
    if (!active) {
      if (rawToken) context.cookies.delete(VOTING_SESSION_COOKIE, { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
      if (path.startsWith('/api/')) return new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }), {
        status: 401, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' },
      });
      return context.redirect('/siswa/masuk');
    }
    const periodApi = path.match(/^\/api\/e-voting\/([^/]+)\/(status|activity|votes)$/);
    const studentPeriodPage = path.match(/^\/siswa\/e-voting\/([^/]+)(?:\/|$)/);
    if ((periodApi && periodApi[1] !== record.voter.periodId) ||
        (studentPeriodPage && studentPeriodPage[1] !== record.voter.period.slug)) {
      return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'private, no-store' } });
    }
    context.locals.votingSession = {
      id: record.id, scope: record.scope, voterId: record.voterId, periodId: record.voter.periodId,
      createdAt: record.createdAt, lastSeenAt: record.lastSeenAt, expiresAt: record.expiresAt,
    };
  }

  const isAdmin = path.startsWith('/admin');
  const apiCap = apiCapability(path, context.request.method);
  if (!isAdmin && !apiCap) return next();

  // Pintu login/logout tak dijaga.
  if (path === '/admin/login' || path === '/admin/logout') return next();

  const token = context.cookies.get('smkdh_token')?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) {
    if (apiCap) return new Response('Unauthorized', { status: 401 });
    return context.redirect('/admin/login');
  }

  // Override dibaca dari DB (akun bisa nonaktif / izin dicabut sejak token terbit).
  const principal = await getPrincipal(session.sub);
  if (!principal) {
    if (apiCap) return new Response('Unauthorized', { status: 401 });
    return context.redirect('/admin/login');
  }

  // Kapabilitas yang diperlukan: dari API atau dari segmen pertama /admin.
  let cap: string | undefined = apiCap;
  if (isAdmin) {
    const seg = path.split('/')[2]; // /admin/<seg>/...
    cap = seg ? ROUTE_CAP[seg] : undefined; // dashboard & segmen tak terpeta: cukup login
  }

  const needsVoterManagement =
    (isAdmin && path.startsWith('/admin/e-voting/') && path.endsWith('/calon')) ||
    (isAdmin && path.startsWith('/admin/e-voting/') && path.endsWith('/pemilih')) ||
    (isAdmin && path.startsWith('/admin/e-voting/') && path.endsWith('/pin')) ||
    (path.startsWith('/api/admin/e-voting/') && (/\/students\/search\/?$/.test(path) || /\/candidates(?:\/|$)/.test(path) || /\/voters(?:\/|$)/.test(path) || /\/participation\/voters\/?$/.test(path)));
  const needsVotingManagement =
    (isAdmin && path.startsWith('/admin/e-voting/') && path.endsWith('/calon')) ||
    (path.startsWith('/api/admin/e-voting/') && /\/candidates(?:\/|$)/.test(path));
  const needsPinManagement = (isAdmin && path.startsWith('/admin/e-voting/') && path.endsWith('/pin')) ||
    (path.startsWith('/api/admin/e-voting/') && /\/pins\/?$/.test(path));
  const isVotingAdmin = (isAdmin && (path === '/admin/e-voting' || path.startsWith('/admin/e-voting/'))) || path.startsWith('/api/admin/e-voting/');

  if ((cap && !can(principal, cap)) ||
      (isVotingAdmin && !can(principal, 'evoting.lihat')) ||
      (needsVoterManagement && !can(principal, 'evoting.pemilih')) ||
      (needsVotingManagement && !can(principal, 'evoting.kelola')) ||
      (needsPinManagement && (!can(principal, 'evoting.pin') || !can(principal, 'evoting.pemilih')))) {
    if (apiCap) return new Response('Forbidden', { status: 403 });
    return context.redirect('/admin?forbidden=1');
  }

  // Sediakan ke halaman (mis. AdminLayout menyaring menu via can()) tanpa query ulang.
  context.locals.session = session;
  context.locals.principal = principal;
  return next();
});
