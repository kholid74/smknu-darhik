import { defineMiddleware } from 'astro:middleware';
import { verifyToken, getPrincipal } from './lib/auth';
import { can } from './lib/rbac';

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
  alumni: 'alumni.moderasi',
  pengaturan: 'setting.kelola', // superadmin (*) saja
  pengguna: 'account.kelola', // superadmin (*) saja
};

// API tulis yang butuh proteksi (yang lain — announce, image proxy — publik).
const API_CAP: Record<string, string> = {
  '/api/upload': 'media.kelola',
  '/api/media': 'media.kelola',
};

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;

  const isAdmin = path.startsWith('/admin');
  const apiCap = API_CAP[path];
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

  if (cap && !can(principal, cap)) {
    if (apiCap) return new Response('Forbidden', { status: 403 });
    return context.redirect('/admin?forbidden=1');
  }

  // Sediakan ke halaman (mis. AdminLayout menyaring menu via can()) tanpa query ulang.
  context.locals.session = session;
  context.locals.principal = principal;
  return next();
});
