// Pure QR Code encoder (byte mode) -> SVG string. No runtime dependencies.
// Faithful implementation of the QR spec: GF(256) + Reed-Solomon ECC, versions 1-10,
// EC levels L/M/Q/H, all 8 data masks (lowest-penalty picked). Enough for short URLs.

export type EcLevel = 'L' | 'M' | 'Q' | 'H';
const EC_ORDER: EcLevel[] = ['L', 'M', 'Q', 'H'];

// ---- Galois field GF(256), primitive poly 0x11d ----
const EXP = new Uint8Array(256);
const LOG = new Uint8Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
})();
function gexp(n: number): number { while (n < 0) n += 255; while (n >= 255) n -= 255; return EXP[n]; }
function glog(n: number): number { if (n < 1) throw new Error('glog(' + n + ')'); return LOG[n]; }

// ---- Reed-Solomon ----
function polyMul(a: number[], b: number[]): number[] {
  const r = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++)
      r[i + j] ^= gexp(glog(a[i]) + glog(b[j]));
  return r;
}
function rsGenerator(n: number): number[] {
  let g = [1];
  for (let i = 0; i < n; i++) g = polyMul(g, [1, gexp(i)]);
  return g;
}
function polyMod(data: number[], gen: number[]): number[] {
  const res = data.slice();
  while (res.length >= gen.length) {
    const coef = res[0];
    if (coef !== 0) {
      const lead = glog(coef);
      for (let i = 0; i < gen.length; i++) res[i] ^= gexp(glog(gen[i]) + lead);
    }
    res.shift();
  }
  return res;
}
function rsEncode(data: number[], ecLen: number): number[] {
  const rem = polyMod(data.concat(new Array(ecLen).fill(0)), rsGenerator(ecLen));
  const out = new Array(ecLen).fill(0);
  for (let i = 0; i < rem.length; i++) out[ecLen - rem.length + i] = rem[i];
  return out;
}

// ---- RS block table (version -> [L,M,Q,H] -> [numBlocks, totalCount, dataCount][]) ----
const RS_BLOCKS: Record<number, [number, number, number][][]> = {
  1: [[[1, 26, 19]], [[1, 26, 16]], [[1, 26, 13]], [[1, 26, 9]]],
  2: [[[1, 44, 34]], [[1, 44, 28]], [[1, 44, 22]], [[1, 44, 16]]],
  3: [[[1, 70, 55]], [[1, 70, 44]], [[2, 35, 17]], [[2, 35, 13]]],
  4: [[[1, 100, 80]], [[2, 50, 32]], [[2, 50, 24]], [[4, 25, 9]]],
  5: [[[1, 134, 108]], [[2, 67, 43]], [[2, 33, 15], [2, 34, 16]], [[2, 33, 11], [2, 34, 12]]],
  6: [[[2, 86, 68]], [[4, 43, 27]], [[4, 43, 19]], [[4, 43, 15]]],
  7: [[[2, 98, 78]], [[4, 49, 31]], [[2, 32, 14], [4, 33, 15]], [[4, 39, 13], [1, 40, 14]]],
  8: [[[2, 121, 97]], [[2, 60, 38], [2, 61, 39]], [[4, 40, 18], [2, 41, 19]], [[4, 40, 14], [2, 41, 15]]],
  9: [[[2, 146, 116]], [[3, 58, 36], [2, 59, 37]], [[4, 36, 16], [4, 37, 17]], [[4, 36, 12], [4, 37, 13]]],
  10: [[[2, 86, 68], [2, 87, 69]], [[4, 69, 43], [1, 70, 44]], [[6, 43, 19], [2, 44, 20]], [[6, 43, 15], [2, 44, 16]]],
};

// Alignment pattern center positions per version (v1 has none).
const ALIGN_POS: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

// ---- BCH format/version info ----
function bitLen(n: number): number { let b = 0; while (n !== 0) { b++; n >>>= 1; } return b; }
const G15 = 0x537, G15_MASK = 0x5412, G18 = 0x1f25;
function bchTypeInfo(data5: number): number {
  let d = data5 << 10;
  while (bitLen(d) - bitLen(G15) >= 0) d ^= G15 << (bitLen(d) - bitLen(G15));
  return ((data5 << 10) | d) ^ G15_MASK;
}
function bchVersionInfo(version: number): number {
  let d = version << 12;
  while (bitLen(d) - bitLen(G18) >= 0) d ^= G18 << (bitLen(d) - bitLen(G18));
  return (version << 12) | d;
}
const FORMAT_EC_BITS = [1, 0, 3, 2]; // ecIndex L,M,Q,H -> format bits

// ---- bit buffer ----
class BitBuffer {
  bits: number[] = [];
  put(num: number, len: number) { for (let i = len - 1; i >= 0; i--) this.bits.push((num >>> i) & 1); }
  get length() { return this.bits.length; }
}

function utf8Bytes(s: string): number[] { return Array.from(new TextEncoder().encode(s)); }

function dataCapacityCodewords(version: number, ecIndex: number): number {
  let n = 0;
  for (const [nb, , dc] of RS_BLOCKS[version][ecIndex]) n += nb * dc;
  return n;
}
function chooseVersion(ecIndex: number, byteLen: number): number {
  for (let v = 1; v <= 10; v++) {
    const ccBits = v <= 9 ? 8 : 16;
    if (4 + ccBits + byteLen * 8 <= dataCapacityCodewords(v, ecIndex) * 8) return v;
  }
  throw new Error('QR: data terlalu panjang (>v10)');
}

function createData(version: number, ecIndex: number, bytes: number[]): number[] {
  const buf = new BitBuffer();
  buf.put(4, 4); // byte mode
  buf.put(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) buf.put(b, 8);
  const totalBits = dataCapacityCodewords(version, ecIndex) * 8;
  if (buf.length > totalBits) throw new Error('QR: overflow');
  for (let i = 0; i < 4 && buf.length < totalBits; i++) buf.bits.push(0); // terminator
  while (buf.length % 8 !== 0) buf.bits.push(0); // byte align
  const PAD = [0xec, 0x11];
  for (let pi = 0; buf.length < totalBits; pi ^= 1) buf.put(PAD[pi], 8);
  const codewords: number[] = [];
  for (let i = 0; i < buf.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | buf.bits[i + j];
    codewords.push(v);
  }
  return interleave(codewords, version, ecIndex);
}

function interleave(dataCodewords: number[], version: number, ecIndex: number): number[] {
  const dataBlocks: number[][] = [], ecBlocks: number[][] = [];
  let offset = 0;
  for (const [nb, total, dc] of RS_BLOCKS[version][ecIndex]) {
    for (let i = 0; i < nb; i++) {
      const d = dataCodewords.slice(offset, offset + dc);
      offset += dc;
      dataBlocks.push(d);
      ecBlocks.push(rsEncode(d, total - dc));
    }
  }
  const out: number[] = [];
  const maxData = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++) for (const b of dataBlocks) if (i < b.length) out.push(b[i]);
  const maxEc = Math.max(...ecBlocks.map((b) => b.length));
  for (let i = 0; i < maxEc; i++) for (const b of ecBlocks) if (i < b.length) out.push(b[i]);
  return out;
}

// ---- matrix construction ----
function maskFn(mask: number, i: number, j: number): boolean {
  switch (mask) {
    case 0: return (i + j) % 2 === 0;
    case 1: return i % 2 === 0;
    case 2: return j % 3 === 0;
    case 3: return (i + j) % 3 === 0;
    case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
    case 5: return ((i * j) % 2) + ((i * j) % 3) === 0;
    case 6: return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
    default: return (((i * j) % 3) + ((i + j) % 2)) % 2 === 0;
  }
}

function buildMatrix(version: number, ecIndex: number, data: number[], mask: number): (boolean | null)[][] {
  const size = version * 4 + 17;
  const m: (boolean | null)[][] = Array.from({ length: size }, () => new Array(size).fill(null));

  const finder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const rr = row + r, cc = col + c;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
      m[rr][cc] = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
        (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
        (r >= 2 && r <= 4 && c >= 2 && c <= 4);
    }
  };
  finder(0, 0); finder(size - 7, 0); finder(0, size - 7);

  // alignment
  for (const r of ALIGN_POS[version]) for (const c of ALIGN_POS[version]) {
    if (m[r][c] !== null) continue; // overlaps finder
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++)
      m[r + dr][c + dc] = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
  }
  // timing
  for (let i = 8; i < size - 8; i++) {
    if (m[6][i] === null) m[6][i] = i % 2 === 0;
    if (m[i][6] === null) m[i][6] = i % 2 === 0;
  }
  // dark module
  m[size - 8][8] = true;

  // format info (2 EC bits + 3 mask bits) -> 15 bits
  const fmt = bchTypeInfo((FORMAT_EC_BITS[ecIndex] << 3) | mask);
  for (let i = 0; i < 15; i++) {
    const bit = ((fmt >> i) & 1) === 1;
    // vertical (top-left down + bottom-left up)
    if (i < 6) m[i][8] = bit;
    else if (i < 8) m[i + 1][8] = bit;
    else m[size - 15 + i][8] = bit;
    // horizontal (top-left right + top-right left)
    if (i < 8) m[8][size - i - 1] = bit;
    else if (i < 9) m[8][15 - i] = bit;
    else m[8][15 - i - 1] = bit;
  }

  // version info (v>=7): 18 bits in two 6x3 blocks
  if (version >= 7) {
    const vi = bchVersionInfo(version);
    for (let i = 0; i < 18; i++) {
      const bit = ((vi >> i) & 1) === 1;
      const a = Math.floor(i / 3), b = (i % 3) + size - 11;
      m[a][b] = bit;
      m[b][a] = bit;
    }
  }

  // data placement (zigzag from bottom-right), masked
  let inc = -1, row = size - 1, bitIndex = 7, byteIndex = 0;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--; // skip vertical timing
    for (; ;) {
      for (let c = 0; c < 2; c++) {
        const cc = col - c;
        if (m[row][cc] !== null) continue;
        let dark = byteIndex < data.length && ((data[byteIndex] >>> bitIndex) & 1) === 1;
        if (maskFn(mask, row, cc)) dark = !dark;
        m[row][cc] = dark;
        if (--bitIndex === -1) { byteIndex++; bitIndex = 7; }
      }
      row += inc;
      if (row < 0 || row >= size) { row -= inc; inc = -inc; break; }
    }
  }
  return m;
}

// penalty score (lower = better) for mask selection
function lostPoint(m: (boolean | null)[][]): number {
  const n = m.length;
  const at = (r: number, c: number) => m[r][c] === true;
  let lost = 0;
  // rule 1: runs of >=5 same in row/col
  for (let r = 0; r < n; r++) for (let axis = 0; axis < 2; axis++) {
    let run = 1, prev = axis ? at(0, r) : at(r, 0);
    for (let i = 1; i < n; i++) {
      const v = axis ? at(i, r) : at(r, i);
      if (v === prev) { run++; if (run === 5) lost += 3; else if (run > 5) lost++; }
      else { run = 1; prev = v; }
    }
  }
  // rule 2: 2x2 blocks
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
    const v = at(r, c);
    if (v === at(r, c + 1) && v === at(r + 1, c) && v === at(r + 1, c + 1)) lost += 3;
  }
  // rule 3: finder-like 1:1:3:1:1 patterns
  const pat = [true, false, true, true, true, false, true];
  const check = (get: (i: number) => boolean, i: number) => {
    for (let k = 0; k < 7; k++) if (get(i + k) !== pat[k]) return false;
    return true;
  };
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (c + 10 < n) {
      if (check((i) => at(r, i), c) && (c + 7 >= n || (!at(r, c + 7) && !at(r, c + 8) && !at(r, c + 9) && !at(r, c + 10)))) lost += 40;
    }
    if (r + 10 < n) {
      if (check((i) => at(i, c), r) && (r + 7 >= n || (!at(r + 7, c) && !at(r + 8, c) && !at(r + 9, c) && !at(r + 10, c)))) lost += 40;
    }
  }
  // rule 4: dark ratio
  let dark = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (at(r, c)) dark++;
  const ratio = Math.abs((dark * 100) / (n * n) - 50);
  lost += Math.floor(ratio / 5) * 10;
  return lost;
}

export function qrMatrix(text: string, ec: EcLevel = 'M'): boolean[][] {
  const bytes = utf8Bytes(text);
  const ecIndex = EC_ORDER.indexOf(ec);
  const version = chooseVersion(ecIndex, bytes.length);
  const data = createData(version, ecIndex, bytes);
  let best: (boolean | null)[][] | null = null, bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const cand = buildMatrix(version, ecIndex, data, mask);
    const s = lostPoint(cand);
    if (s < bestScore) { bestScore = s; best = cand; }
  }
  return best!.map((row) => row.map((c) => c === true));
}

// Render QR as a self-contained SVG string (no external refs). Suitable for inline SSR + PNG export.
export function qrSvg(text: string, opts: { ec?: EcLevel; scale?: number; margin?: number; dark?: string; light?: string } = {}): string {
  const { ec = 'M', scale = 4, margin = 4, dark = '#0f1a12', light = '#ffffff' } = opts;
  const m = qrMatrix(text, ec);
  const n = m.length;
  const dim = (n + margin * 2) * scale;
  let path = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
    if (m[r][c]) path += `M${(c + margin) * scale} ${(r + margin) * scale}h${scale}v${scale}h-${scale}z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img" aria-label="QR verifikasi"><rect width="${dim}" height="${dim}" fill="${light}"/><path d="${path}" fill="${dark}"/></svg>`;
}

// Path (relative) halaman verify publik. URL absolut dibangun di pemanggil (butuh origin produksi).
export function verifyPath(token: string): string { return `/verify/${token}`; }

// Diekspos untuk pengujian unit.
export const _internal = { gexp, glog, rsEncode, rsGenerator, polyMod, bchTypeInfo, chooseVersion, dataCapacityCodewords };
