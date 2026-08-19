import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { qrMatrix, verifyPath } from './qr';

// Bangun kartu alumni sebagai SVG mandiri (logo+foto di-embed sebagai data URL),
// siap ditampilkan inline lalu dirasterisasi ke PNG di klien. Dipakai admin & portal.

export interface CardAlumni {
  nama: string;
  jurusan: string;
  angkatan: number;
  photoUrl: string | null;
  alumniId: string;
  verifyToken: string;
}

async function logoDataUrl(): Promise<string> {
  try {
    const buf = await readFile('public/assets/logo.png');
    const out = await sharp(buf).resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
    return `data:image/png;base64,${out.toString('base64')}`;
  } catch { return ''; }
}
async function photoDataUrl(url: string, origin: string): Promise<string> {
  try {
    const abs = new URL(url, origin).toString();
    const res = await fetch(abs);
    if (!res.ok) return '';
    const buf = Buffer.from(await res.arrayBuffer());
    const out = await sharp(buf).resize(520, 640, { fit: 'cover' }).jpeg({ quality: 84 }).toBuffer();
    return `data:image/jpeg;base64,${out.toString('base64')}`;
  } catch { return ''; }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function buildAlumniCard(a: CardAlumni, origin: string): Promise<{ svg: string; filename: string }> {
  const verifyUrl = new URL(verifyPath(a.verifyToken), origin).toString();
  const [logo, photo] = await Promise.all([logoDataUrl(), a.photoUrl ? photoDataUrl(a.photoUrl, origin) : Promise.resolve('')]);

  const W = 1000, H = 620;
  const m = qrMatrix(verifyUrl, 'M');
  const n = m.length;
  const qMod = 5;
  const qSize = n * qMod;
  const qPad = qMod * 2;
  const qBox = qSize + qPad * 2;
  const qBoxX = W - 60 - qBox, qBoxY = 300;
  const qx = qBoxX + qPad, qy = qBoxY + qPad;
  let qrPath = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
    if (m[r][c]) qrPath += `M${qx + c * qMod} ${qy + r * qMod}h${qMod}v${qMod}h-${qMod}z`;

  const namaLen = a.nama.length;
  const namaSize = namaLen <= 16 ? 44 : namaLen <= 22 ? 34 : namaLen <= 30 ? 27 : 22;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'Plus Jakarta Sans', Arial, sans-serif">
  <defs>
    <clipPath id="card"><rect x="0" y="0" width="${W}" height="${H}" rx="28"/></clipPath>
    <clipPath id="photo"><rect x="50" y="175" width="260" height="320" rx="18"/></clipPath>
    <linearGradient id="hdr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1B7A3D"/><stop offset="1" stop-color="#0f5027"/></linearGradient>
  </defs>
  <g clip-path="url(#card)">
    <rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>
    <rect x="0" y="0" width="${W}" height="140" fill="url(#hdr)"/>
    ${logo ? `<image href="${logo}" x="40" y="28" width="84" height="84"/>` : ''}
    <text x="140" y="66" fill="#ffffff" font-size="30" font-weight="800" letter-spacing="0.5">SMKS NU DARUL HIKAM</text>
    <text x="140" y="98" fill="#eaf5ec" font-size="16" font-weight="600">KARTU ALUMNI · Karanggeneng, Lamongan</text>
    ${photo
      ? `<image href="${photo}" x="50" y="175" width="260" height="320" clip-path="url(#photo)" preserveAspectRatio="xMidYMid slice"/>`
      : `<rect x="50" y="175" width="260" height="320" rx="18" fill="#eef2ee"/><g fill="#b8c2b6"><circle cx="180" cy="300" r="42"/><path d="M112 435 a68 68 0 0 1 136 0 z"/></g>`}
    <rect x="50" y="175" width="260" height="320" rx="18" fill="none" stroke="#e3e8e2" stroke-width="2"/>
    <text x="350" y="230" fill="#1c1b1b" font-size="${namaSize}" font-weight="800">${esc(a.nama)}</text>
    <text x="350" y="272" fill="#6f7a6e" font-size="22" font-weight="600">${esc(a.jurusan)} · Angkatan ${a.angkatan}</text>
    <rect x="350" y="300" width="${18 + a.alumniId.length * 13}" height="40" rx="20" fill="#eef7f0" stroke="#cfe6d4"/>
    <text x="${350 + (18 + a.alumniId.length * 13) / 2}" y="326" fill="#1B7A3D" font-size="19" font-weight="800" letter-spacing="1" text-anchor="middle">${esc(a.alumniId)}</text>
    <g><text x="350" y="410" fill="#8a938a" font-size="14" font-weight="600">STATUS</text>
    <text x="350" y="438" fill="#1c1b1b" font-size="20" font-weight="700">✓ Alumni Terverifikasi</text></g>
    <rect x="${qBoxX}" y="${qBoxY}" width="${qBox}" height="${qBox}" rx="12" fill="#ffffff" stroke="#e3e8e2" stroke-width="2"/>
    <path d="${qrPath}" fill="#0f1a12"/>
    <text x="${qBoxX + qBox / 2}" y="${qBoxY + qBox + 26}" fill="#6f7a6e" font-size="15" font-weight="600" text-anchor="middle">Scan untuk verifikasi</text>
    <rect x="0" y="${H - 46}" width="${W}" height="46" fill="#f7faf7"/>
    <text x="50" y="${H - 18}" fill="#8a938a" font-size="14" font-weight="600">Identitas resmi alumni · Terampil, Beriman, Siap Kerja</text>
  </g>
</svg>`;

  return { svg, filename: `kartu-${a.alumniId}.png` };
}
