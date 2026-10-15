import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPinSlips } from './pin-slips';

test('PIN slips escape master fields and expose manual print only', () => {
  const html = renderPinSlips({ name: '<Pemilihan>', slug: 'osis-2026', opensAt: new Date('2026-11-01T01:00:00Z'), closesAt: new Date('2026-11-01T03:00:00Z') }, [
    { name: '<Siswa>', nisn: '0012345678', className: 'X & RPL', pin: '0011223344' },
  ]);
  assert.match(html, /&lt;Pemilihan&gt;/);
  assert.match(html, /&lt;Siswa&gt;/);
  assert.match(html, /X &amp; RPL/);
  assert.match(html, /0011223344/);
  assert.match(html, /onclick="window\.print\(\)"/);
  assert.doesNotMatch(html, /onload=/i);
  assert.match(html, /\/siswa\/masuk\?periode=osis-2026/);
});
