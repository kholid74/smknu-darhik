import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can, matches, effectiveCaps, primaryRole, ROLES, type Principal } from './rbac';

// ── primaryRole ──
test('primaryRole pilih yang tertinggi kuasanya', () => {
  assert.equal(primaryRole(['guru', 'superadmin']), 'superadmin');
  assert.equal(primaryRole(['siswa', 'guru']), 'guru');
  assert.equal(primaryRole(['staf']), 'staf');
});
test('primaryRole: role tak dikenal -> ambil pertama', () => {
  assert.equal(primaryRole(['hantu']), 'hantu');
  assert.equal(primaryRole([]), '');
});

// ── matches (wildcard) ──
test('matches: exact', () => {
  assert.equal(matches('artikel.hapus', 'artikel.hapus'), true);
  assert.equal(matches('artikel.hapus', 'artikel.edit'), false);
});
test('matches: prefix wildcard', () => {
  assert.equal(matches('artikel.*', 'artikel.hapus'), true);
  assert.equal(matches('artikel.*', 'artikel.sub.aksi'), true);
  assert.equal(matches('artikel.*', 'galeri.hapus'), false);
});
test('matches: global wildcard', () => {
  assert.equal(matches('*', 'apa.saja'), true);
});

// ── role caps ──
test('superadmin bisa apa saja', () => {
  const p: Principal = { roles: ['superadmin'] };
  assert.equal(can(p, 'account.create'), true);
  assert.equal(can(p, 'artikel.hapus'), true);
  assert.equal(can(p, 'soal.buat'), true);
});
test('staf: konten boleh, akun tidak', () => {
  const p: Principal = { roles: ['staf'] };
  assert.equal(can(p, 'artikel.hapus'), true);
  assert.equal(can(p, 'alumni.moderasi'), true);
  assert.equal(can(p, 'account.create'), false);
  assert.equal(can(p, 'soal.buat'), false);
});
test('guru: e-learning boleh, konten admin tidak', () => {
  const p: Principal = { roles: ['guru'] };
  assert.equal(can(p, 'soal.buat'), true);
  assert.equal(can(p, 'nilai.input'), true);
  assert.equal(can(p, 'artikel.hapus'), false);
  assert.equal(can(p, 'account.create'), false);
});
test('siswa: konsumen belajar', () => {
  const p: Principal = { roles: ['siswa'] };
  assert.equal(can(p, 'materi.baca'), true);
  assert.equal(can(p, 'soal.buat'), false);
  assert.equal(can(p, 'nilai.input'), false);
});

// ── multi-role (gabungan) ──
test('multi-role gabungkan kapabilitas', () => {
  const p: Principal = { roles: ['staf', 'guru'] };
  assert.equal(can(p, 'artikel.hapus'), true); // dari staf
  assert.equal(can(p, 'soal.buat'), true); // dari guru
  assert.equal(can(p, 'account.create'), false); // tak ada yang punya
});

// ── override ──
test('grant menambah izin di luar role', () => {
  const p: Principal = { roles: ['guru'], grants: ['ppdb.kelola'] };
  assert.equal(can(p, 'ppdb.kelola'), true);
});
test('revoke mengalahkan role & grant (deny-overrides)', () => {
  const p: Principal = { roles: ['staf'], revokes: ['artikel.hapus'] };
  assert.equal(can(p, 'artikel.hapus'), false); // dicabut meski artikel.* memberi
  assert.equal(can(p, 'artikel.edit'), true); // yang lain tetap
});
test('revoke wildcard memblok satu domain', () => {
  const p: Principal = { roles: ['staf'], revokes: ['galeri.*'] };
  assert.equal(can(p, 'galeri.upload'), false);
});
test('revoke menang atas grant', () => {
  const p: Principal = { roles: ['siswa'], grants: ['nilai.input'], revokes: ['nilai.input'] };
  assert.equal(can(p, 'nilai.input'), false);
});

// ── edge ──
test('role tak dikenal diabaikan', () => {
  const p: Principal = { roles: ['hantu'] };
  assert.equal(can(p, 'artikel.hapus'), false);
});
test('tanpa role tak punya izin', () => {
  const p: Principal = { roles: [] };
  assert.equal(can(p, 'artikel.hapus'), false);
});
test('effectiveCaps daftar pola allow (untuk UI)', () => {
  const p: Principal = { roles: ['guru'], grants: ['ppdb.kelola'] };
  const caps = effectiveCaps(p);
  assert.ok(caps.includes('soal.*'));
  assert.ok(caps.includes('ppdb.kelola'));
});
test('ROLES berisi 4 peran internal', () => {
  assert.deepEqual([...ROLES].sort(), ['guru', 'siswa', 'staf', 'superadmin']);
});
