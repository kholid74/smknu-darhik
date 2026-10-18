# E-Voting SMKDH

**Pembaruan T11, 18 Oktober:** endpoint hasil internal dan status publikasi401/429 diterapkan. Regresi232tes lulus (satu penanda tes DB dilewati dan dijalankan terpisah), PostgreSQL lokal lintas koneksi6/6, browser37skenario, Prisma validate/generate dan build lulus. Penerimaan R2/Vercel/perangkat tetap belum selesai. [Bukti T11](06-pengujian.md#bukti-dan-gerbang-rilis).

**Pembaruan upload 18 Oktober:** T10 sudah diimplementasikan dan diuji lokal (228 tes, 37 skenario browser, build lulus). Verifikasi object R2/hosted belum selesai karena konfigurasi R2 lokal belum tersedia. [Bukti dan batas](../image-upload-webp-study.md#implementasi-t10-dan-bukti-terbaru).

**Pembaruan Neon 17 Oktober 2026:** migrasi schema dan cleanup empat periode yang disetujui sudah berhasil setelah backup teruji. Master dan audit lama tetap; deployment belum dilakukan. [Catatan pelaksanaan](13-catatan-migrasi-neon.md).

Status 17 Oktober 2026: **T01–T09 selesai lokal; T10–T11 dan deployment T12 belum selesai; bagian migrasi DB sudah dilakukan.** Hak pilih, portal, transaksi, sesi dan rekap sudah dinamis pada fixture baru. [Status task](12-task-implementasi-jenis-dinamis.md) membedakan fitur teruji dari rancangan. Jangan menjalankan rilis sebagian terhadap Neon.

## Keputusan yang menjadi acuan

- Master jenis dapat dikelola melalui CRUD, dengan nama/logo/mode/label jabatan/urutan/aktif. Periode memilih1–20 jenis eksplisit; default awal lima: OSIS, PRADANA PUTRA, PRADANA PUTRI, IPNU, IPPNU. Dewan Ambalan digantikan dua Pradana, bukan sekadar rename satu surat suara. Tidak mengganti enum empat menjadi enum lima.
- Snapshot jenis diambil saat pemasangan pada periode; edit master tidak mengubahnya. Susunan dikunci saat SCHEDULED. Mode SINGLE tepat satu CHAIR; OPTIONAL_VICE ketua dan wakil opsional. Anggota dari Student ID, snapshot nama/kelas/foto, bukan teks bebas; duplikat perjenis/perperiode ditolak. Calon/roster beku saat buka.
- Student persisten independen dari ElectionVoter/PIN/sesi; guru dipilih dari Teacher master terpisah. Pemilih dipilih eksplisit, tidak wajib seluruh siswa; total gabungan1–99. Setiap pemilih mendapat satu hak pada tiap jenis periode dengan bobot sama tanpa filter gender/breakdown kelompok.
- Siswa NISN+PIN tercetak menuju `/siswa`; guru kode GURU+PIN menuju `/pemilih`. Tidak ada self-registration/password/reset akun permanen. PIN scope ELECTION_VOTING tidak membuka layanan personal/akademik/admin, Coming Soon noninteraktif.
- Tiga Chromebook bersama, maksimum3sesi global dan1/voter; idle5menit/absolut15 atau deadline. Lengkap hanya saat tepat seluruh N hak dipakai lalu sesi dicabut; parsial dapat resume PIN valid. Tidak ada pemungutan offline/transfer suara.
- Ballot tetap anonim tanpa relasi pemilih atau timestamp. Partisipasi hanya status perjenis; tidak mencatat calon. Transaksi atomik dan rekonsiliasi tetap wajib; DB owner/WAL berada dalam batas kepercayaan, bukan anonimitas terhadap operator.
- Setelah buka dapat ditutup meski absen/parsial atau nol suara dengan roster valid. Lebih awal perlu alasan/password/konfirmasi/audit; tidak perlu turnout100%. Penutupan permanen dan publikasi terpisah. Hasil kandidat hanya setelah close, publik hanya setelah publish. Seri/nol tidak menetapkan pemenang.
- Hasil target memakai snapshotv2 dinamis, foto besar dan infografis ringan. Media sekolah/R2 digunakan; konversi WebP server tersedia lokal pada T10; object R2/hosted belum diverifikasi.
- Periode isTest boleh dihapus lewat dashboard termasuk sesudah publish/archive, dengan superadmin+izin, pratinjau, konfirmasi slug, password dan audit. Master sekolah/jenis/CMS/media/akun serta seluruh audit tetap disimpan. Sampel legacy di luar klasifikasi uji mengikuti izin/manifest/backup/maintenance khusus; periode resmi tidak dapat dihapus lewat hapus-uji.

## Dokumen aktif

| Dokumen | Isi |
| --- | --- |
| [CONTEXT](CONTEXT.md) | Istilah dan batas domain |
| [ADR0003](adr/0003-jenis-pemilihan-dinamis.md) | Keputusan jenis dinamis, snapshot dan penutupan parsial; acuan terbaru |
| [Desain](02-desain.md) | Lifecycle, lock, sesi, keamanan dan transaksi |
| [Schema](03-schema.md) | Field/range/FK/index/deferred constraints/guard, snapshotv2 dan retensi |
| [API](04-api.md) | Kontrak target dan endpoint existing yang dipertahankan |
| [OpenAPI](contracts/e-voting-v2.openapi.json) | Struktur delta21operasi/35schema, belum handler implementasi |
| [Pemeriksa kontrak](contracts/check.mjs) | Contoh positif/negatif dan invariant kontrak; bukan tes runtime |
| [UI dan dampak file](05-implementasi.md) | Route/caller/fixture dan rilis kompatibel |
| [Pengujian](06-pengujian.md) | Matriks1/5/6, concurrency, security, UI dan migration |
| [Operasional](07-operasional.md) | Cleanup sampel exact, maintenance, rollback dan pelaksanaan |
| [Usulan11](11-usulan-jenis-pemilihan-dan-hasil.md) | Asal kebutuhan lima jenis/foto/hasil/WebP/badge |
| [Task12](12-task-implementasi-jenis-dinamis.md) | Urutan/dependensi/kriteria T00–T12 |
| [Catatan migrasi Neon](13-catatan-migrasi-neon.md) | Backup/manifest empat sampel, migrasi berhasil, data master tetap dan batas deployment |
| [Kajian WebP](../image-upload-webp-study.md) | Temuan jalur upload dan pengukuran lokal, batas benchmark |

Pemeriksaan kontrak: `node docs/e-voting/contracts/check.mjs` (66 contoh). Backend T03: `node node_modules/tsx/dist/cli.mjs --test src/lib/voting/election-types-api.test.ts`; schema T02: `node node_modules/tsx/dist/cli.mjs --test src/lib/voting/dynamic-types-db.test.ts`. DB test memakai PGlite tanpa .env/Neon. T04: `node node_modules/tsx/dist/cli.mjs --test src/lib/voting/dynamic-voting.test.ts`. Suite penuh232tes lulus dengan1penanda tes PostgreSQL dilewati; run PostgreSQL terpisah6/6 lulus,37skenario browser dan build lulus. Simulator kini memakai lima jenis/schema terkini; kelima skenario diuji tanpa env/Neon. UI T05 memakai [halaman Jenis Pemilihan](../../src/pages/admin/e-voting/jenis.astro) dan [picker bersama](../../src/components/voting/ContestPicker.astro). T06 menyelesaikan form mode/jabatan snapshot, expected foto pada edit/hapus, snapshot anggota stabil dan kartu portrait responsif siswa/guru. T07 menyelesaikan penutupan setelah dibuka tanpa turnout penuh, alasan dini, konfirmasi/password dan audit atomik. T08 menambahkan foto besar, ringkasan orang/surat suara, donut, bar, seri/nol dan cetak pada hasil publik. T09 menambahkan CTA hasil di daftar/detail dengan tab baru aman dan status/aksi publikasi sesuai izin. Implementasi T10 lokal tersedia; T11 lokal kini lulus; berikutnya verifikasi R2/hosted/perangkat dan persiapan deployment.

## Catatan historis dan aturan prioritas

[Audit awal](01-audit.md) pada commit8a35abf adalah bukti waktu audit, bukan daftar bug yang semuanya masih aktif. [ADR0001](adr/0001-integrasi-dan-batas-kerahasiaan.md) tetap mengatur integrasi/batas kerahasiaan; [ADR0002](adr/0002-autentikasi-portal-siswa-mvp.md) tetap mengatur autentikasi MVP, sementara angka empat/early-close lama digantikan ADR0003. [Uji/hapus sampel](08-pembersihan-data-uji.md), [guru](09-usulan-pemilih-guru.md), [roster terpilih dan DRAFT](10-daftar-pemilih-dan-draft.md) mencatat implementasi sebelumnya; aturan konflik tentang jumlah jenis atau turnout mengikuti dokumen aktif T01.

Gerbang persetujuan pada [repo_audit.md](../../repo_audit.md) sudah dipenuhi. Implementasi dilanjutkan bertahap sesuai task yang diotorisasi; migrasi Neon telah didahulukan atas permintaan pengguna dengan manifest yang disetujui; sisa rilis tetap mengikuti T11–T12, tanpa meminta persetujuan ulang untuk scope yang sama.
