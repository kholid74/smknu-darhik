import { db } from './prisma';

// Beri ID kartu alumni (SMKSDH-0001) saat alumni sudah verified & belum punya ID.
// Permanen. Nomor urut = max existing + 1. Retry bila bentrok unik (race).
export async function assignAlumniIdIfNeeded(id: string): Promise<void> {
  const a = await db.alumni.findUnique({ where: { id }, select: { verified: true, alumniId: true } });
  if (!a || !a.verified || a.alumniId) return;

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
