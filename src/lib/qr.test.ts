import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qrMatrix, qrSvg, verifyPath, _internal } from './qr';

const { gexp, glog, rsEncode, rsGenerator, polyMod, bchTypeInfo, chooseVersion } = _internal;

test('GF(256): gexp/glog round-trip', () => {
  for (let x = 1; x < 256; x++) assert.equal(gexp(glog(x)), x);
  assert.equal(gexp(0), 1);
});

test('RS: codeword polynomial is divisible by generator (remainder 0)', () => {
  const data = [16, 32, 12, 86, 97, 128, 236, 17, 236, 17]; // arbitrary data codewords
  const ecLen = 10;
  const ec = rsEncode(data, ecLen);
  assert.equal(ec.length, ecLen);
  const rem = polyMod(data.concat(ec), rsGenerator(ecLen));
  assert.ok(rem.every((b) => b === 0), 'remainder must be all zero');
});

test('BCH format info matches known vector (EC=M, mask=0 -> 0x5412)', () => {
  // FORMAT_EC_BITS[M]=0, mask 0 -> data5 = 0
  assert.equal(bchTypeInfo(0), 0x5412);
});

test('version selection grows with data length', () => {
  const short = chooseVersion(1, 20); // M
  const long = chooseVersion(1, 60);
  assert.ok(short >= 1 && short <= 10);
  assert.ok(long > short);
});

test('qrMatrix: square, correct module count, boolean cells', () => {
  const m = qrMatrix('https://smknudarulhikam.local/verify/AbC123', 'M');
  const n = m.length;
  assert.equal((n - 17) % 4, 0); // n = version*4+17
  assert.ok(m.every((row) => row.length === n));
  assert.ok(m.every((row) => row.every((c) => typeof c === 'boolean')));
});

test('qrMatrix: finder patterns present at 3 corners', () => {
  const m = qrMatrix('hello world', 'M');
  const n = m.length;
  const finderCorner = (r0: number, c0: number) => {
    // outer ring dark, inner 3x3 dark, ring gap light
    assert.ok(m[r0][c0] && m[r0][c0 + 6] && m[r0 + 6][c0]); // corners dark
    assert.ok(!m[r0 + 1][c0 + 1]); // gap light
    assert.ok(m[r0 + 3][c0 + 3]); // center dark
  };
  finderCorner(0, 0);
  finderCorner(0, n - 7);
  finderCorner(n - 7, 0);
});

test('qrMatrix: deterministic for same input', () => {
  const a = qrMatrix('SMKSDH-0042', 'M');
  const b = qrMatrix('SMKSDH-0042', 'M');
  assert.deepEqual(a, b);
});

test('qrSvg: self-contained svg, no external refs', () => {
  const svg = qrSvg('https://x.test/verify/tok', { scale: 4, margin: 4 });
  assert.match(svg, /^<svg/);
  assert.match(svg, /<path d="M/);
  assert.ok(!svg.includes('http://www.w3.org/1999/xlink'));
  assert.ok(!/href=/.test(svg));
});

test('verifyPath builds relative verify path', () => {
  assert.equal(verifyPath('AbC-123'), '/verify/AbC-123');
});
