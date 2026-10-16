// No deadlines, election state, unpublished articles, or personalized content on this list.
// shortcut: CMS edits wait for CDN revalidation; exclude pages requiring immediate updates.
const CMS_PAGES = new Set(['/fasilitas', '/guru', '/galeri', '/prestasi', '/jurusan', '/faq']);

export function applyPageCache(request: Request, response: Response, cookiesChanged = false): Response {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '') || '/';
  const cms = CMS_PAGES.has(path);
  const sensitive = /^\/(admin|siswa|pemilih|alumni|verify|e-voting)(\/|$)/.test(path) ||
    (path.startsWith('/api/') && !path.startsWith('/api/image/'));
  const fresh = path === '/' || /^\/berita(?:\/|$)/.test(path);
  if (!cms && !sensitive && !fresh && !cookiesChanged && !response.headers.has('Set-Cookie')) return response;

  const headers = new Headers(response.headers);
  const current = headers.get('Cache-Control') || '';
  const shared = cms && ['GET', 'HEAD'].includes(request.method) && !url.search && response.status === 200 &&
    headers.get('Content-Type')?.startsWith('text/html') && !cookiesChanged && !headers.has('Set-Cookie') &&
    !request.headers.has('Cookie') && !request.headers.has('Authorization') && !request.headers.has('Range') &&
    !/private|no-store|no-cache/i.test(current) && !headers.has('Vary');
  headers.set('Cache-Control', shared ? 'public, max-age=0, must-revalidate' : 'private, no-store');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Vercel-CDN-Cache-Control', shared ? 'public, s-maxage=60, must-revalidate' : 'no-store');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
