# Kartu Alumni Digital + ID Alumni — Desain (PARKED)

Status: **belum dibangun** (hasil sesi grilling). Dokumen ini merekam keputusan
desain supaya bisa langsung dieksekusi saat siap. Tidak ada kode yang ditulis.

---

## Tujuan

**A + C**: identitas alumni + (nantinya) akses.

- **Identitas**: bukti seseorang alumni resmi SMKS NU Darul Hikam.
- **Akses (fase lanjut)**: alumni punya **dashboard login sendiri** → bisa
  **download kartunya**.
- **Kegunaan konkret**: event sekolah — bazar, reuni, dll (kartu buat
  identifikasi/masuk).
- **Verify**: TIDAK wajib login admin. Pakai **halaman verify publik** yang
  aman dari enumerasi (lihat QR di bawah). Bukan direktori publik.

## ID Alumni

- **Format**: flat sequential — `SMKSDH-0001` (prefix + 4 digit zero-pad).
- **Kapan diberi**: saat **admin approve** (`verified = true`). Sebelum approve
  belum ada ID.
- **Permanen & unik**: sekali diberi tidak berubah walau data diedit. `@unique`.
- **Untuk siapa**: **semua alumni `verified`**, lepas dari `publicOptIn`/
  `featured`. ID/kartu = identitas pribadi (buat dirinya + event), beda urusan
  dari etalase publik showcase.
- **Nomor urut**: `max(existing)+1` atau counter — dijaga agar tidak dobel
  (unik).

### Kenapa flat, bukan encode jurusan/angkatan

Ditolak format `SMKSDH-DKV-19-0001`. Alasan: **jangan encode atribut yang bisa
berubah ke identifier permanen.** Jurusan & angkatan adalah field yang bisa
diedit/salah input; kalau dibekukan di ID, ID bisa "berbohong". Jurusan
"Lainnya"/lama juga tak punya kode bersih. **Solusi**: ID flat (kanonik, stabil)
+ **label kaya dirender live** di kartu (`SMKSDH-0001 · DKV · Angkatan 2019`) —
bagian jurusan/angkatan baca field terkini, selalu akurat.

## Kartu

- **Isi**: logo sekolah, foto alumni, nama, ID (`SMKSDH-0001`), label live
  (jurusan · angkatan), QR.
- **Render**: halaman HTML kartu bergaya + tombol "Download PNG" (html-to-image
  di klien, tanpa dependency berat). Detail implementasi menyusul.

## QR & Verify (anti-enumerasi)

- **2 field** di model Alumni:
  - `alumniId` — untuk tampilan manusia (`SMKSDH-0001`).
  - `verifyToken` — string **acak tak-tertebak**, khusus QR/URL verify.
- **QR encode**: `/verify/<verifyToken>` (bukan ID sequential — supaya tidak
  bisa dienumerasi `0001, 0002, ...`).
- **Halaman verify**: **publik, tanpa login**. Siapa pun scan pakai app QR biasa
  → tampil **foto + nama + jurusan + angkatan + "✓ Alumni Terverifikasi"**.
  - **WA/email TIDAK ditampilkan** (tetap privat).
  - Info yang tampil = sama persis dengan yang tercetak di kartu → nol bocor
    tambahan.
  - Aman dari scraping massal karena token acak (hanya pemegang kartu bisa buka).
- **Trade-off diterima**: kalau alumni posting kartunya publik, token-nya
  terekspos → orang bisa buka verify **satu orang itu** (info yang toh sudah dia
  pajang). Kerugian minim, pilihannya sendiri.

## Rencana Build (saat dieksekusi)

Rekomendasi urutan (dari grilling), **belum dijalankan**:

1. **Fase Kartu-1** (fondasi + kartu, tanpa login):
   - Tambah `alumniId` + `verifyToken` ke model Alumni; assign saat approve +
     backfill alumni verified yang sudah ada.
   - Tampilkan ID di admin.
   - Halaman verify publik `/verify/[token]` (foto+nama+jurusan+angkatan+✓).
   - Halaman kartu ber-QR yang **admin bisa download (PNG)** → kirim ke alumni
     via WA. Sudah siap dipakai event tanpa menunggu login.
2. **Fase Kartu-2** (bareng login alumni): alumni **self-download** kartu dari
   dashboard-nya. Kartu & verify sama, cuma jadi self-service.

Login alumni sendiri = fase lanjut terpisah (lihat `riset-alumni.md` §8.2 —
email magic-link).
