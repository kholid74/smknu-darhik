# ADR 0003 — Jenis pemilihan dinamis dan penutupan parsial

**Pembaruan T11, 18 Oktober:** endpoint hasil internal dan status publikasi401/429 diterapkan. Regresi232tes lulus (satu penanda tes DB dilewati dan dijalankan terpisah), PostgreSQL lokal lintas koneksi6/6, browser37skenario, Prisma validate/generate dan build lulus. Penerimaan R2/Vercel/perangkat tetap belum selesai. [Bukti T11](../06-pengujian.md#bukti-dan-gerbang-rilis).

**Pembaruan upload 18 Oktober:** T10 sudah diimplementasikan dan diuji lokal (228 tes, 37 skenario browser, build lulus). Verifikasi object R2/hosted belum selesai karena konfigurasi R2 lokal belum tersedia. [Bukti dan batas](../../image-upload-webp-study.md#implementasi-t10-dan-bukti-terbaru).

**Pembaruan Neon 17 Oktober 2026:** migrasi schema dan cleanup empat periode yang disetujui sudah berhasil setelah backup teruji. Master dan audit lama tetap; deployment belum dilakukan. [Catatan pelaksanaan](../13-catatan-migrasi-neon.md).

Tanggal keputusan: 16 Oktober 2026. Status 17 Oktober: **T01–T09 ditetapkan/diuji lokal; form mode/foto calon, penutupan tanpa turnout penuh dan hasil publik selesai; CTA dashboard selesai; upload dan rilis T10–T12 belum selesai.** Ketentuan empat organisasi/turnout penuh lama digantikan pada target desain; perubahan aturan turnout di layanan/UI telah diuji lokal pada T07. [ADR 0002](0002-autentikasi-portal-siswa-mvp.md) dan [ADR 0001](0001-integrasi-dan-batas-kerahasiaan.md) tetap mengatur autentikasi/batas anonimitas.

## Konteks

Pengguna meminta CRUD jenis, logo organisasi, Pradana Putra dan Pradana Putri sebagai dua surat suara terpisah, penutupan dengan pemilih absen, foto besar dan hasil berinfografis. Data pemilihan existing dinyatakan sampel dan boleh dibersihkan jika menghambat migrasi. Student/Teacher/kelas/akun/CMS/media tidak termasuk izin pembersihan.

## Keputusan

1. Tambah `ElectionType` dengan `code` immutable sebagai PK varchar(32). Pertahankan nama kolom, field API dan route `organization` untuk kode tersebut; ganti tipe enum tetap menjadi varchar + FK. Tidak menambah UUID contest yang menduplikasi key `(periodId, organization)` existing. Nama model DB/kolom dan envelope API mengikuti konvensi repo; tidak merename seluruh database atau mengganti envelope ke standar layanan lain.
2. Jenis awal: OSIS, PRADANA_PUTRA, PRADANA_PUTRI, IPNU, IPPNU. Master tidak terbatas lima nilai. Periode memilih eksplisit 1–20 jenis; batas 20 adalah batas input/kompleksitas UI, bukan daftar kategori. Jenis keenam dapat ditambahkan melalui CRUD tanpa deploy. Semua 1–99 pemilih gabungan siswa/guru mendapat satu hak per jenis periode, tanpa filter gender.
3. `ElectionContest` menyimpan snapshot nama/logo/jabatan/mode ketika jenis pertama kali dipasang. Snapshot retained tidak direfresh oleh edit master atau reorder. Susunan jenis hanya dapat diubah di DRAFT, terkunci setelah dijadwalkan. Tidak ada auto-refresh tersembunyi; kebutuhan refresh snapshot eksplisit di luar paket ini. Kandidat/roster tetap dapat diedit di SCHEDULED sebelum opensAt sesuai aturan existing.
4. Mode `SINGLE` berarti satu CHAIR dan tidak ada wakil. `OPTIONAL_VICE` berarti satu CHAIR dan nol/satu VICE_CHAIR. CandidatePair/Member tetap memakai Student master dan snapshot historis. Mode Pradana adalah SINGLE; ketiga jenis lainnya OPTIONAL_VICE. Nama jabatan hanya label; CandidatePosition tidak bertambah berdasarkan jenis.
5. CRUD master memakai `revision`; penggantian susunan memakai `contestsRevision` pada periode. Mutasi meminta expectedRevision dan memeriksa setelah lock, bukan timestamp klien. Jenis terpakai tidak dapat dihapus; deactivation hanya memengaruhi pemilihan untuk pemasangan baru. Snapshot/periode existing tetap sah walaupun master nonaktif.
6. Sesi selesai ketika tepat seluruh hak periode dipakai, bukan saat empat/lima suara global. Roster, login, status, progress, DB guard, vote, rekap dan snapshot menggunakan daftar contest yang sama. Surat suara tetap anonim dan partisipasi tidak menyimpan kandidat. Tiga sesi bersama, idle lima menit, absolut 15 menit, PIN per periode dan Coming Soon tetap.
7. Penutupan periode yang telah dibuka tidak membutuhkan turnout penuh. Sebelum deadline perlu opt-in early, alasan 10–500 karakter, reauth admin, izin, CSRF, lock dan rekonsiliasi; publikasi tetap terpisah. Nol ballot dengan roster nonkosong sah; tidak ada quorum atau ballot otomatis untuk absen. Retry close tidak menghitung ulang snapshot.
8. Snapshot hasil baru versi 2 mencakup metadata jenis dan jumlah contest dinamis. Agregat dibatasi ketat dan tidak membawa identitas pemilih. Parser versi 1 boleh dihapus hanya setelah verifikasi tidak ada snapshot versi 1 tersisa; bila ada data di luar inventaris sampel, jangan menghapusnya atau merilis parser v2-only.
9. Logo/foto menggunakan media R2 yang tersedia, dengan key immutable dan pemeriksaan referensi sebelum penghapusan. Upload foto WebP85/lossless-logo merupakan T10, tidak diperlukan untuk mengubah hak pilih. Tidak ada konversi browser/chart besar/queue baru.

## Konsekuensi dan alternatif

Menambah dua enum ditolak karena tidak memenuhi CRUD. JSON tanpa FK ditolak karena calon/ballot dapat merujuk jenis yang tidak dipasang. Merename semua field ke typeId atau mengganti framework ditolak karena menambah perpindahan data tanpa manfaat untuk kebutuhan ini.

Biaya yang diterima: satu migrasi schema dan pembaruan semua asumsi jumlah tetap. T02–T09 harus dirilis sebagai paket kompatibel, bukan membiarkan runtime empat jenis menghadapi schema baru. Edit master tidak memperbarui label draft existing: koreksi master sebaiknya dilakukan sebelum pemasangan; revisi metadata periode memerlukan perubahan eksplisit terpisah, bukan efek CRUD master.

Cleanup sampel hanya melalui prosedur migrator yang scope-nya exact UUID+slug, setelah maintenance/backup; audit tetap append-only. Tidak menambah API hapus periode biasa atau membypass trigger runtime. Rollback code saja mungkin tidak kompatibel; rencana restore schema/data + code wajib pada T12.

## Acuan kontrak

- [Desain dan locking](../02-desain.md)
- [Schema, constraint dan transisi](../03-schema.md)
- [OpenAPI sumber kontrak](../contracts/e-voting-v2.openapi.json) dan [penjelasan API](../04-api.md)
- [Task T00–T12](../12-task-implementasi-jenis-dinamis.md)

T01 hanya dokumentasi/kontrak. Bukti SQL/Prisma/trigger/concurrency aktual merupakan penerimaan T02/T04/T11, bukan klaim ADR ini.
