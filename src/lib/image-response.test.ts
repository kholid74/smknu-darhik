import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { imageResponse } from './image-response';

test('image endpoint retains originals, emits small WebP thumbnails, never enlarges, and keeps immutable success cache', async () => {
  const bytes = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#187a3d' } }).jpeg().toBuffer();
  const load = async () => ({ bytes, contentType: 'image/jpeg' });
  const request = (query = '') => new Request('https://school.example/api/image/test.jpg' + query);
  const original = await imageResponse(request(), 'test.jpg', load);
  assert.deepEqual(Buffer.from(await original.arrayBuffer()), bytes);
  for (const width of [600, 1600]) {
    const response = await imageResponse(request('?w=' + width), 'test.jpg', load);
    const result = Buffer.from(await response.arrayBuffer());
    const meta = await sharp(result).metadata();
    assert.equal(meta.width, Math.min(width, 1200));
    assert.equal(meta.format, 'webp');
    assert.equal(response.headers.get('Content-Type'), 'image/webp');
    assert.match(response.headers.get('Cache-Control')!, /immutable/);
    if (width === 600) assert.ok(result.length < bytes.length);
  }
});

test('bad sizes and canonical redirects avoid storage reads; missing/failed thumbnails are not cached', async () => {
  let reads = 0;
  const missing = async () => { reads++; return null; };
  for (const query of ['?w=-1', '?w=600oops', '?w=2001', '?w=']) {
    const response = await imageResponse(new Request('https://school.example/api/image/test.jpg' + query), 'test.jpg', missing);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
  const canonical = await imageResponse(new Request('https://school.example/api/image/test.jpg?w=400&version=2'), 'test.jpg', missing);
  assert.equal(canonical.status, 307);
  assert.equal(canonical.headers.get('Location'), '/api/image/test.jpg?w=480&version=2');
  assert.equal(reads, 0);
  const notFound = await imageResponse(new Request('https://school.example/api/image/missing.jpg?w=600'), 'missing.jpg', missing);
  assert.equal(notFound.status, 404);
  assert.equal(notFound.headers.get('Cache-Control'), 'no-store');
  const bad = await imageResponse(new Request('https://school.example/api/image/bad.jpg?w=600'), 'bad.jpg', async () => ({ bytes: Buffer.from('not an image'), contentType: 'application/octet-stream' }));
  assert.equal(await bad.text(), 'not an image');
  assert.equal(bad.headers.get('Cache-Control'), 'no-store');
});
