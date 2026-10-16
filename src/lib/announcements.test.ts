import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAnnouncements, toTextAnnouncements } from './announcements';

test('announcement payload drops invalid/expired entries and unsafe links without treating text as HTML', () => {
  const now = Date.parse('2026-10-16T10:00:00Z');
  const entry = { id: 'active', text: '<img src=x onerror=alert(1)>', linkUrl: 'javascript:alert(1)' };
  const rows = parseAnnouncements([null, {}, entry, { ...entry, id: 'expired', expiresAt: new Date(now).toISOString() }, { ...entry, expiresAt: 'invalid' }], now);
  assert.deepEqual(rows, [{ ...entry, linkUrl: null, linkLabel: 'Selengkapnya', expiresAt: null }]);
  assert.deepEqual(parseAnnouncements({}), []);
  assert.equal(parseAnnouncements([{ ...entry, linkUrl: '/ppdb' }])[0].linkUrl, '/ppdb');
  assert.equal(parseAnnouncements([{ ...entry, linkUrl: 'https://example.com' }])[0].linkUrl, 'https://example.com');
});

test('SSR and API use the same active text announcements, title fallback and expiry boundary', () => {
  const now = Date.parse('2026-10-16T10:00:00Z');
  const row = { id: 'a', title: 'Info sekolah', body: null, linkUrl: null, linkLabel: null, expiresAt: null };
  const result = toTextAnnouncements([row, { ...row, active: false }, { ...row, imageUrl: '/photo.webp' }, { ...row, expiresAt: new Date(now) }], now);
  assert.equal(result.length, 1);
  assert.equal(result[0].text, row.title);
  assert.equal(result[0].linkLabel, 'Selengkapnya');
  assert.equal(toTextAnnouncements([{ ...row, expiresAt: new Date(now + 1000) }], now)[0].expiresAt, new Date(now + 1000).toISOString());
});
