export const IMAGE_WIDTHS = [96, 200, 300, 480, 500, 600, 768, 960, 1200, 1600, 2000] as const;

export function imageWidth(raw: string | null): number | null {
  if (raw === null || raw === '0') return 0;
  if (!/^\d+$/.test(raw)) return null;
  const width = Number(raw);
  if (!Number.isSafeInteger(width) || width < 1 || width > 2000) return null;
  return IMAGE_WIDTHS.find(size => size >= width) ?? null;
}

// Only our own media can be resized; this never proxies an arbitrary remote URL.
export function thumbnailUrl(source: string, width: number, origin: string, mediaBase?: string): string {
  const size = imageWidth(String(width));
  if (!size) throw new Error('Invalid thumbnail width');
  try {
    const url = new URL(source, origin);
    let key: string | undefined;
    if (url.origin === origin && url.pathname.startsWith('/api/image/')) {
      key = url.pathname.slice('/api/image/'.length);
    } else if (mediaBase) {
      const base = new URL(mediaBase.replace(/\/$/, '') + '/', origin);
      if (url.origin === base.origin && url.pathname.startsWith(base.pathname)) key = url.pathname.slice(base.pathname.length);
    }
    if (!key || url.username || url.password || !['http:', 'https:'].includes(url.protocol)) return source;
    url.searchParams.set('w', String(size));
    return `/api/image/${key}${url.search}${url.hash}`;
  } catch { return source; }
}
