import { createHash } from 'node:crypto';

// Helper murni magic-link alumni (tanpa IO/env) — jantung keamanan single-use, diuji unit.

// Token mentah hanya ada di email; DB simpan sha256-nya. Cari = hash lalu cocokkan.
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export type TokenState = 'valid' | 'used' | 'expired' | 'missing';

// State token relatif waktu `now`. Urutan cek: ada -> belum used -> belum exp.
export function tokenState(
  row: { usedAt: Date | null; expiresAt: Date } | null,
  now: Date
): TokenState {
  if (!row) return 'missing';
  if (row.usedAt) return 'used';
  if (row.expiresAt.getTime() <= now.getTime()) return 'expired';
  return 'valid';
}
