import type { APIRoute } from 'astro';
import { verifyToken } from '../../lib/auth';
import { db } from '../../lib/prisma';

export const prerender = false;

// JSON list of media for the MediaPicker. Admin-only.
export const GET: APIRoute = async ({ request }) => {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/smkdh_token=([^;]+)/);
  if (!match || !(await verifyToken(match[1]))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim() || '';
  const kind = url.searchParams.get('kind')?.trim() || ''; // '' = all, 'image', 'file'
  const where: any = {};
  if (q) where.filename = { contains: q, mode: 'insensitive' };
  if (kind) where.kind = kind;
  const items = await db.media.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
  const data = items.map((i) => ({ id: i.id, url: i.url, filename: i.filename, size: i.size, kind: i.kind }));
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
};
