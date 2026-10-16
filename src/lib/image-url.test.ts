import test from 'node:test';
import assert from 'node:assert/strict';
import { IMAGE_WIDTHS, imageWidth, thumbnailUrl } from './image-url';

test('widths are bounded, canonical, and retain the existing thumbnail sizes', () => {
  assert.equal(imageWidth(null), 0);
  assert.equal(imageWidth('0'), 0);
  for (const size of IMAGE_WIDTHS) assert.equal(imageWidth(String(size)), size);
  assert.equal(imageWidth('400'), 480);
  for (const raw of ['', '-1', '600oops', '1.5', '2001', 'Infinity', '999999999999999999999']) assert.equal(imageWidth(raw), null);
});

test('thumbnail URLs preserve queries/hashes and resize only own media', () => {
  const origin = 'https://school.example';
  const thumb = (source: string, base?: string) => thumbnailUrl(source, 600, origin, base);
  assert.equal(thumb('/api/image/a.jpg?version=2&w=500#photo'), '/api/image/a.jpg?version=2&w=600#photo');
  assert.equal(thumb(origin + '/api/image/a.jpg'), '/api/image/a.jpg?w=600');
  assert.equal(thumb('https://media.example/school/a.jpg?q=2', 'https://media.example/school'), '/api/image/a.jpg?q=2&w=600');
  assert.equal(thumb('/media/a.jpg', '/media'), '/api/image/a.jpg?w=600');
  for (const source of ['https://other.example/api/image/a.jpg', '//other.example/api/image/a.jpg', 'https://media.example/school-other/a.jpg', 'https://media.example.evil/school/a.jpg', '/assets/logo.png', '/api/image-other/a.jpg', 'data:image/png;base64,abc', 'javascript:alert(1)', 'https://user:pass@media.example/school/a.jpg']) {
    assert.equal(thumb(source, 'https://media.example/school'), source);
  }
  assert.throws(() => thumbnailUrl('/api/image/a.jpg', 3000, origin));
});
