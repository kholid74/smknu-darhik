import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const assets = new URL('../public/assets/', import.meta.url);
// Originals stay intact; bump the version when replacing a published derivative.
const variants = [
  ['logo', 'logo-v1.webp', 113, 20_000],
  ['logo', 'favicon-v1.png', 32, 5_000],
  ['hero-siswa', 'hero-siswa-480-v1.webp', 480, 80_000],
  ['hero-siswa', 'hero-siswa-768-v1.webp', 768, 80_000],
  ['hero-siswa', 'hero-siswa-947-v1.webp', 947, 80_000],
  ['kepala-sekolah', 'kepala-sekolah-240-v1.webp', 240, 15_000],
  ['kepala-sekolah', 'kepala-sekolah-440-v1.webp', 440, 15_000],
];
const results = [];
for (const [name, filename, width, maxBytes] of variants) {
  const source = new URL(name + '.png', assets);
  const original = await readFile(source);
  const before = await sharp(original).metadata();
  const pipeline = sharp(original).resize({ width, withoutEnlargement: true });
  const png = filename.endsWith('.png');
  const output = await (png ? pipeline.png() : pipeline.webp(name === 'logo' ? { lossless: true } : { quality: 80 })).toBuffer();
  const after = await sharp(output).metadata();
  assert.equal(after.format, png ? 'png' : 'webp', filename);
  assert.equal(after.width, Math.min(width, before.width), filename);
  assert.ok(Math.abs(after.height / after.width - before.height / before.width) <= 1 / after.width, filename + ': aspect ratio');
  assert.ok(output.length <= maxBytes, filename + ': byte budget');
  if (!(await sharp(original).stats()).isOpaque) {
    assert.equal(after.hasAlpha, true, filename + ': transparency');
  }
  if (name === 'logo' && !png) {
    const background = { r: 255, g: 255, b: 255 };
    assert.deepEqual(await sharp(output).flatten({ background }).raw().toBuffer(), await sharp(original).flatten({ background }).raw().toBuffer(), 'Logo must remain lossless');
  }
  await writeFile(new URL(filename, assets), output);
  assert.deepEqual(await readFile(source), original, 'Original must stay intact');
  results.push({ filename, width: after.width, height: after.height, bytes: output.length });
}
console.table(results);
