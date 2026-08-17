// RBAC realm Internal — matriks izin statik + resolusi izin efektif.
// Jantung otorisasi: pure & teruji (rbac.test.ts). Tanpa akses DB/IO.
//
// Model izin:
//   izin dasar per role (statik di sini) + override per-akun (grant/revoke, dari DB).
//   can() = ada pola allow yang cocok  DAN  tak ada revoke yang cocok (deny-overrides).

export type Role = 'superadmin' | 'staf' | 'guru' | 'siswa';

export const ROLES: readonly Role[] = ['superadmin', 'staf', 'guru', 'siswa'] as const;

// Urutan kuasa (tinggi -> rendah). Dipakai memilih role utama untuk tampilan/kompat.
const ROLE_RANK: readonly Role[] = ['superadmin', 'staf', 'guru', 'siswa'] as const;

// Role utama sebuah akun (yang tertinggi kuasanya). Untuk badge & kompat `session.role`.
export function primaryRole(roles: string[]): string {
  for (const r of ROLE_RANK) if (roles.includes(r)) return r;
  return roles[0] ?? '';
}

// Prinsipal yang diperiksa. Dilepas dari tipe Prisma supaya murni & mudah dites.
// roles: peran yang dimiliki. grants: izin ekstra. revokes: izin dicabut.
export interface Principal {
  roles: string[];
  grants?: string[];
  revokes?: string[];
}

// Matriks role -> pola kapabilitas. Wildcard: 'x.*' cocok 'x.apa-saja', '*' cocok semua.
// Konten operasional dipetakan per menu admin agar T4 (middleware) bisa route -> cap.
export const CAPS: Record<Role, string[]> = {
  superadmin: ['*'],
  staf: [
    'artikel.*',
    'prestasi.*',
    'guru.*', // profil guru (konten publik), bukan akun
    'mitra.*',
    'testimoni.*',
    'fasilitas.*',
    'ekskul.*',
    'faq.*',
    'download.*',
    'jurusan.*',
    'halaman.*',
    'pengumuman.*',
    'galeri.*',
    'kontribusi.*',
    'media.*', // upload/pustaka media untuk form konten
    'ppdb.kelola',
    'alumni.moderasi',
    'statistik.lihat',
  ],
  guru: ['profil.edit-sendiri', 'konten.usul', 'soal.*', 'materi.*', 'nilai.input', 'kelas.lihat'],
  siswa: ['materi.baca', 'soal.jawab', 'nilai.lihat-sendiri'],
};

// Apakah pola kapabilitas mencakup suatu aksi. '*' = semua; 'x.*' = prefix; selain itu = persis.
export function matches(pattern: string, action: string): boolean {
  if (pattern === '*') return true;
  if (pattern.endsWith('.*')) return action.startsWith(pattern.slice(0, -1)); // 'artikel.'
  return pattern === action;
}

// Pola allow: gabungan izin dari semua role yang dikenal + grant. (Belum termasuk revoke.)
export function effectiveCaps(p: Principal): string[] {
  const out = new Set<string>();
  for (const r of p.roles) {
    const caps = CAPS[r as Role];
    if (caps) for (const c of caps) out.add(c);
  }
  for (const g of p.grants ?? []) out.add(g);
  return [...out];
}

// Boleh melakukan aksi? Revoke menang atas apa pun (deny-overrides).
export function can(p: Principal, action: string): boolean {
  for (const rv of p.revokes ?? []) if (matches(rv, action)) return false;
  return effectiveCaps(p).some((pat) => matches(pat, action));
}
