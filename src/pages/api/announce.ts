export const prerender = false;
import type { APIRoute } from 'astro';
import { db } from '../../lib/prisma';
import { toTextAnnouncements } from '../../lib/announcements';

// Halaman tanpa data SSR mengambil pengumuman aktif untuk panel global.
export const GET: APIRoute = async () => {
  const now = new Date();
  const rows = await db.announcement.findMany({
    where: {
      active: true,
      imageUrl: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, body: true, linkUrl: true, linkLabel: true, expiresAt: true },
  });

  const data = toTextAnnouncements(rows);

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
