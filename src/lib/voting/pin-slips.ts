import { voterIdentifier, voterPortal } from './voter-identity';
type Slip = { name: string; nisn: string | null; voterType?: string; loginCode?: string | null; className: string; pin: string };

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!));

const dateLabel = (date: Date) => new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta',
}).format(date);

export function renderPinSlips(period: { name: string; slug: string; opensAt: Date; closesAt: Date }, slips: Slip[], baseUrl: string) {
  const cards = slips.map((slip) => {
    const teacher = slip.voterType === 'TEACHER';
    const loginUrl = new URL(`${voterPortal(slip.voterType)}/masuk`, baseUrl);
    if (!['http:', 'https:'].includes(loginUrl.protocol)) throw new Error('INVALID_PORTAL_URL');
    loginUrl.searchParams.set('periode', period.slug);
    return `<article class="slip"><header><strong>${escapeHtml(period.name)}</strong><span>PIN E-Voting Periode Ini</span></header>
    <p>Nama: <b>${escapeHtml(slip.name)}</b><br>${teacher ? 'Kelompok' : 'Kelas'}: ${escapeHtml(slip.className)}<br>${teacher ? 'Kode guru' : 'NISN'}: ${escapeHtml(voterIdentifier(slip))}</p>
    <p class="pin">${escapeHtml(slip.pin)}</p><p style="overflow-wrap:anywhere">Masuk ke Portal ${teacher ? 'Pemilih' : 'Siswa'}: <b>${escapeHtml(loginUrl.href)}</b></p>
    <p>Pemilihan: ${escapeHtml(dateLabel(period.opensAt))} – ${escapeHtml(dateLabel(period.closesAt))} WIB</p>
    <footer>PIN ini hanya untuk E-Voting periode ini. Simpan dengan aman dan jangan bagikan kepada orang lain.</footer></article>`;
  }).join('');
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Slip PIN E-Voting</title><style>
    *{box-sizing:border-box}body{margin:0;background:#eef2ee;color:#172018;font:14px Arial,sans-serif}.toolbar{position:sticky;top:0;padding:12px;text-align:center;background:#fff;border-bottom:1px solid #d9e2d9}.toolbar button{padding:10px 18px;border:0;border-radius:6px;background:#31573c;color:#fff;font-weight:700;cursor:pointer}.slips{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;max-width:1000px;margin:16px auto;padding:0 12px}.slip{background:white;border:1px dashed #718272;border-radius:8px;padding:16px;break-inside:avoid}.slip header{display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid #dfe5df;padding-bottom:9px}.slip header span,.slip p{font-size:12px}.pin{text-align:center;font:700 28px ui-monospace,monospace;letter-spacing:5px;background:#f3f7f3;padding:10px;border-radius:6px}.slip footer{border-top:1px solid #dfe5df;padding-top:8px;font-size:11px;color:#455247}@media print{body{background:white}.toolbar{display:none}.slips{display:block;margin:0;padding:0}.slip{display:inline-block;width:48%;margin:1%;vertical-align:top;border-radius:0}}
  </style></head><body><div class="toolbar"><button type="button" onclick="window.print()">Cetak slip</button> <span>Respons ini hanya tersedia sekarang. Pastikan hasil cetak tersimpan dengan aman.</span></div><main class="slips">${cards}</main></body></html>`;
}
