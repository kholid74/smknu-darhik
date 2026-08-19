import { randomBytes } from 'node:crypto';
import { db } from './prisma';

// Token acak url-safe untuk QR/URL verify publik (tak-tertebak, anti-enumerasi).
export function newVerifyToken(): string {
  return randomBytes(24).toString('base64url'); // ~32 char url-safe
}

// Beri ID kartu alumni (SMKSDH-0001) + verifyToken saat alumni sudah verified & belum punya.
// Keduanya permanen. Nomor urut = max existing + 1. Retry bila bentrok unik (race).
export async function assignAlumniIdIfNeeded(id: string): Promise<void> {
  const a = await db.alumni.findUnique({ where: { id }, select: { verified: true, alumniId: true, verifyToken: true } });
  if (!a || !a.verified) return;

  // Token verify: mint sekali bila belum ada (jalur independen dari alumniId).
  if (!a.verifyToken) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await db.alumni.update({ where: { id }, data: { verifyToken: newVerifyToken() } });
        break;
      } catch (e: any) {
        if (e?.code !== 'P2002') throw e; // selain bentrok unik -> lempar
        // bentrok (sangat jarang): coba token baru
      }
    }
  }

  if (a.alumniId) return;

  for (let attempt = 0; attempt < 5; attempt++) {
    // ID zero-padded + prefix tetap -> urutan leksikografis = urutan numerik.
    const last = await db.alumni.findFirst({
      where: { alumniId: { not: null } },
      orderBy: { alumniId: 'desc' },
      select: { alumniId: true },
    });
    const n = last?.alumniId ? parseInt(last.alumniId.replace(/\D/g, ''), 10) || 0 : 0;
    const next = `SMKSDH-${String(n + 1).padStart(4, '0')}`;
    try {
      await db.alumni.update({ where: { id }, data: { alumniId: next } });
      return;
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e; // selain bentrok unik -> lempar
      // bentrok: coba lagi dengan nomor berikutnya
    }
  }
}
