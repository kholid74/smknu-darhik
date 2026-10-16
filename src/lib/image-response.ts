import sharp from 'sharp';
import { imageWidth } from './image-url';

type MediaFile = { bytes: Uint8Array; contentType: string };
export async function imageResponse(request: Request, key: string, load: (key: string) => Promise<MediaFile | null>): Promise<Response> {
  // shortcut: Extra query parameters retain separate cache keys; canonicalize if fragmentation is measured.
  const url = new URL(request.url);
  const raw = url.searchParams.get('w');
  const width = imageWidth(raw);
  const noStore = { 'Cache-Control': 'no-store' };
  if (width === null) return new Response('Invalid image width', { status: 400, headers: noStore });
  if (width > 0 && raw !== String(width)) {
    url.searchParams.set('w', String(width));
    return new Response(null, { status: 307, headers: { ...noStore, Location: url.pathname + url.search } });
  }
  const result = await load(key);
  if (!result) return new Response('Not found', { status: 404, headers: noStore });
  let { bytes, contentType } = result;
  let cache = 'public, max-age=31536000, immutable';
  if (width > 0) {
    try {
      bytes = await sharp(Buffer.from(bytes)).resize({ width, withoutEnlargement: true }).webp({ quality: 70 }).toBuffer();
      contentType = 'image/webp';
    } catch {
      // A temporary resize failure must not poison the immutable thumbnail cache.
      cache = 'no-store';
    }
  }
  return new Response(bytes, { headers: { 'Content-Type': contentType, 'Cache-Control': cache } });
}
