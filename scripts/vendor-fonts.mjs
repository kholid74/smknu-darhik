import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = resolve(root, 'public/fonts');
const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36' };
async function download(url) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, url);
  return Buffer.from(await response.arrayBuffer());
}
async function sources(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'generated') continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sources(path));
    else if (/\.(astro|ts|css)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) files.push(await readFile(path, 'utf8'));
  }
  return files;
}
const [codepoints, sourceFiles] = await Promise.all([
  download('https://raw.githubusercontent.com/google/material-design-icons/master/variablefont/MaterialSymbolsOutlined%5BFILL,GRAD,opsz,wght%5D.codepoints'),
  sources(resolve(root, 'src')),
]);
const available = new Set(codepoints.toString().trim().split('\n').map(line => line.split(' ')[0]));
const source = sourceFiles.join('\n');
const names = new Set();
for (const match of source.matchAll(/["'`]([a-z][a-z0-9_]+)["'`]|material-symbols-outlined[^>]*>\s*([a-z][a-z0-9_]+)\s*</g)) {
  const name = match[1] ?? match[2];
  if (available.has(name)) names.add(name);
}
const icons = [...names].sort();
assert.ok(icons.includes('menu') && icons.includes('visibility_off') && icons.includes('mosque'), 'Static, scripted and picker icons included');
await mkdir(directory, { recursive: true });
const variants = [
  ['plus-jakarta-sans-latin-v1.woff2', 'Plus+Jakarta+Sans:wght@400..800', 40_000],
  ['material-symbols-subset-v1.woff2', 'Material+Symbols+Outlined:wght,FILL@500,0&icon_names=' + icons.join(','), 30_000],
  ['material-symbols-full-v1.woff2', 'Material+Symbols+Outlined:wght,FILL@500,0', 500_000],
];
for (const [filename, family, budget] of variants) {
  const url = 'https://fonts.googleapis.com/css2?family=' + family + '&display=swap';
  const css = (await download(url)).toString();
  const faces = [...css.matchAll(/@font-face\s*\{[^}]+\}/g)].map(match => match[0]);
  const face = filename.startsWith('plus-') ? faces.find(face => /U\+0000-00FF/i.test(face)) ?? faces.at(-1) : faces[0];
  const fontUrl = face?.match(/url\((https:\/\/[^)]+)\)\s*format\(['"]?woff2['"]?\)/)?.[1];
  assert.ok(fontUrl?.startsWith('https://fonts.gstatic.com/'), 'Expected WOFF2 source: ' + filename);
  const bytes = await download(fontUrl);
  assert.equal(bytes.toString('ascii', 0, 4), 'wOF2', filename);
  assert.ok(bytes.length <= budget, filename + ': byte budget');
  await writeFile(resolve(directory, filename), bytes);
  console.log(filename + ': ' + bytes.length + ' bytes');
}
for (const [filename, url] of [
  ['PlusJakartaSans-OFL.txt', 'https://raw.githubusercontent.com/google/fonts/main/ofl/plusjakartasans/OFL.txt'],
  ['MaterialSymbols-LICENSE.txt', 'https://raw.githubusercontent.com/google/material-design-icons/master/LICENSE'],
]) {
  const license = await download(url);
  assert.match(license.toString(), /SIL OPEN FONT LICENSE|Apache License/);
  await writeFile(resolve(directory, filename), license);
}
await writeFile(resolve(root, 'src/data/font-icons.json'), JSON.stringify(icons, null, 2) + '\n');
console.log(icons.length + ' supported subset icons; full font preserves custom CMS names.');
