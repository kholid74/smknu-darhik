import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPageCache } from './page-cache';

const html = (headers: Record<string, string> = {}, status = 200) => new Response('<p>Public CMS</p>', { status, headers: { 'Content-Type': 'text/html; charset=utf-8', ...headers } });
const request = (path: string, init?: RequestInit) => new Request('https://school.example' + path, init);
function privateResponse(response: Response) {
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(response.headers.get('CDN-Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Vercel-CDN-Cache-Control'), 'no-store');
}

test('only exact anonymous CMS list pages use 60s Vercel cache with browser revalidation', () => {
  for (const path of ['/fasilitas', '/guru', '/galeri', '/prestasi', '/jurusan', '/faq/']) {
    for (const method of ['GET', 'HEAD']) {
      const response = applyPageCache(request(path, { method }), html());
      assert.equal(response.headers.get('Cache-Control'), 'public, max-age=0, must-revalidate');
      assert.equal(response.headers.get('Vercel-CDN-Cache-Control'), 'public, s-maxage=60, must-revalidate');
      assert.equal(response.headers.get('CDN-Cache-Control'), 'no-store');
    }
  }
  for (const path of ['/guru/one', '/gurus', '/facilities']) {
    const response = html();
    assert.equal(applyPageCache(request(path), response), response);
  }
});

test('sensitive, deadline-dependent, preview, session, mutation and error responses never use shared cache', async () => {
  for (const path of ['/', '/berita', '/berita/unpublished', '/admin', '/admin/login', '/siswa', '/siswa/masuk', '/pemilih', '/alumni/masuk', '/verify/token', '/e-voting/test/hasil', '/api/admin/students', '/api/e-voting/period/status', '/api/siswa/session', '/api/announce', '/galeri?album=Sekolah', '/guru?preview=1', '/faq?_fresh=123']) privateResponse(applyPageCache(request(path), html()));
  for (const headers of [{ Cookie: 'session=synthetic' }, { Authorization: 'Bearer synthetic' }, { Range: 'bytes=0-99' }]) privateResponse(applyPageCache(request('/guru', { headers }), html()));
  for (const method of ['POST', 'PATCH', 'DELETE']) privateResponse(applyPageCache(request('/guru', { method }), html()));
  for (const status of [302, 401, 403, 404, 500, 503]) privateResponse(applyPageCache(request('/guru'), html({}, status)));
  for (const headers of [{ 'Cache-Control': 'private, no-store' }, { 'Cache-Control': 'no-cache' }, { 'Set-Cookie': 'session=synthetic' }, { Vary: 'Cookie' }, { 'Content-Type': 'application/json' }]) privateResponse(applyPageCache(request('/guru'), html(headers)));
  privateResponse(applyPageCache(request('/guru'), html(), true));
  const redirect = applyPageCache(request('/admin'), Response.redirect('https://school.example/admin/login'));
  privateResponse(redirect);
  assert.equal(redirect.headers.get('Location'), 'https://school.example/admin/login');
  const image = new Response('image', { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } });
  assert.equal(applyPageCache(request('/api/image/a.jpg?w=600'), image), image);
  assert.equal(await applyPageCache(request('/guru'), html()).text(), '<p>Public CMS</p>');
});
