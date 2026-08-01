export const prerender = false;
import type { APIRoute } from 'astro';
import { db } from '../../lib/prisma';

// Semua pengumuman teks aktif (tanpa gambar) untuk top bar global — dirotasi di klien.
export const GET: APIRoute = async () => {
  const now = new Date();
  const rows = await db.announcement.findMany({
    where: {
      active: true,
      imageUrl: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, body: true, linkUrl: true, linkLabel: true },
  });

  const data = rows.map((a) => ({
    id: a.id,
    text: a.body || a.title,
    linkUrl: a.linkUrl,
    linkLabel: a.linkLabel || 'Selengkapnya',
  }));

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
