# Operasional dan transisi jenis dinamis

**Pembaruan T11, 18 Oktober:** endpoint hasil internal dan status publikasi401/429 diterapkan. Regresi232tes lulus (satu penanda tes DB dilewati dan dijalankan terpisah), PostgreSQL lokal lintas koneksi6/6, browser37skenario, Prisma validate/generate dan build lulus. Penerimaan R2/Vercel/perangkat tetap belum selesai. [Bukti T11](06-pengujian.md#bukti-dan-gerbang-rilis).

**Pembaruan upload 18 Oktober:** T10 sudah diimplementasikan dan diuji lokal (228 tes, 37 skenario browser, build lulus). Verifikasi object R2/hosted belum selesai karena konfigurasi R2 lokal belum tersedia. [Bukti dan batas](../image-upload-webp-study.md#implementasi-t10-dan-bukti-terbaru).

**Pembaruan Neon 17 Oktober 2026:** migrasi schema dan cleanup empat periode yang disetujui sudah berhasil setelah backup teruji. Master dan audit lama tetap; deployment belum dilakukan. [Catatan pelaksanaan](13-catatan-migrasi-neon.md).

Status 17 Oktober 2026: **T01–T09 selesai lokal; schema Neon sudah dimigrasi, deployment belum**. Pengguna mendahulukan migrasi DB; upload T10, pengujian T11 dan deployment/hosted verification T12 tetap tersisa. [Task](12-task-implementasi-jenis-dinamis.md), [schema](03-schema.md), [pengujian](06-pengujian.md).

## Status dan izin yang sudah tersedia

Baseline yang sudah dideploy masih empat jenis dan syarat early-close lama. Branch lokal T04 sudah mendukung hak/sesi/suara/rekap dinamis; T07 lokal telah mengganti syarat turnout penuh dengan keputusan panitia dan alasan dini. Badge T00 belum commit/deploy. Catatan migrasi historis terdapat pada [dukungan guru](09-usulan-pemilih-guru.md), [DRAFT/pemilih](10-daftar-pemilih-dan-draft.md) dan [cleanup runtime](08-pembersihan-data-uji.md); aturan jenis/penutupan lama dalam dokumen historis digantikan ADR0003.

Pengguna mengizinkan menghapus **data pemilihan sampel jika menghambat migrasi**, termasuk riwayat sampel, dan izin itu tetap berlaku. Ini tidak mengizinkan reset database, hapus Student/Teacher/kelas/jurusan/akun/izin/CMS/Media atau audit yang dipertahankan. Tidak meminta persetujuan ulang untuk scope yang sama; bila inventaris menemukan data bukan sampel, hentikan langkah yang bergantung padanya dan laporkan ketidaksesuaian, bukan memasukkannya diam-diam ke cleanup.

## Persiapan T02/T11

T03–T04 menambah konfigurasi serta hak/sesi/suara/partisipasi/snapshot dinamis tanpa secret baru atau migration/seed Neon. Menu/popup CRUD master, logo MediaPicker dan susunan DRAFT sudah tersedia pada T05; form mode/jabatan snapshot dan kartu portrait selesai pada T06. Edit/hapus calon memerlukan expected termasuk foto; penguncian pembukaan tetap di server. Penutupan tanpa turnout penuh tersedia lokal pada T07; sebelum deadline wajib alasan10–500 dan password/konfirmasi. Ringkasan menampilkan lengkap/parsial/belum mulai, tetapi angka final diperiksa server setelah lock. Jangan menghapus pemilih absen atau membuat suara pengganti. Gagal rekonsiliasi tetap membatalkan penutupan; periksa teknis tanpa mengubah ledger. Tidak ada DDL/secret baru khusus T07. Password salah401, limiter429; bila respons terputus, reload status sebelum mencoba kembali. Publikasi tetap aksi terpisah. Uji Prisma Client, adapter pg resmi, SQL dan middleware memakai PGlite. Transport satu koneksi/savepoint tidak membuktikan row lock lintas koneksi, isolation level atau privilege Neon.

T08 lokal: hasil publik CLOSED/ARCHIVED+publishedAt memuat snapshot resmi berfoto/logo, ringkasan orang dan surat suara, donut/bar dan cetak. Visi/misi dapat dibuka tanpa JavaScript; Cetak hasil atau menu cetak browser menghasilkan laporan dengan seluruh detail. Periksa hasil seri/nol, logo/crop pada aset resmi dan angka denominator sebelum rilis. Thumbnail memakai jalur existing dan cache gambar; tidak ada normalisasi upload WebP baru sampai T10. API/HTML hasil tetap private, no-store; tidak ada hasil kandidat sebelum gate publikasi. Endpoint hasil internal kini diterapkan T11, berizin lihat+hasil setelah CLOSED/ARCHIVED dan sebelum publikasi, dalam format JSON. CTA dashboard selesai pada T09. Tidak ada DDL/secret baru untuk T08.

T09 lokal: tombol utama Lihat hasil voting (tab baru) berada pada daftar dan bagian atas detail, hanya untuk CLOSED/ARCHIVED yang sudah dipublikasikan. Dashboard tetap terbuka. Sebelum publikasi, status menggantikan link publik; hanya akun evoting.publikasi pada CLOSED belum terbit mendapat aksi publikasi. Form berada di atas detail dan meminta password/konfirmasi; batal/gagal membersihkan password. Bila sesi keamanan belum siap, tombol tidak aktif. Aksi publish tetap memakai API, reauth, CSRF/Origin, limiter dan audit existing; tidak ada publikasi otomatis atau DDL/secret baru.

Artifact yang sudah tersedia: [migration](../../prisma/migrations/20261017090000_dynamic_election_types/migration.sql), [cleanup offline](../../scripts/sql/evoting-sample-cleanup.sql), [uji PGlite](../../src/lib/voting/dynamic-types-db.test.ts). Migration mensyaratkan tabel domain pemilihan kosong dan tidak menghapus data sendiri. Ia juga membuat lima master; jangan menjalankan seed CMS/demo untuk mengisi jenis. Historical migration tidak diubah.

PGlite telah menguji urutan baseline→backup→cleanup published samples→migration, penolakan sisa periode di luar manifest, serta restore schema/data lama dari backup. Ini bukan restore Neon, pengujian konkurensi lintas koneksi atau bukti least-privilege pada hosting. Client Prisma sudah digenerate untuk schema baru. Neon kini memakai schema baru dan query baca adapter aplikasi sudah lulus; pengujian seluruh flow/hosted serta rilis aplikasi tetap belum selesai. Simulator dan suite layanan penutupan sudah memakai schema baru pada T04. Hanya dua suite regresi migrasi historis (teacher/cleanup) yang tetap pada baseline 16 Oktober; schema/runtime baru diuji terpisah.

1. Rekam commit, branch, target DB (nama/host disamarkan), versi PostgreSQL/Prisma, daftar migrasi lokal/remote, triggers/functions/FK/index/grants dan owner. Jangan mencetak DATABASE_URL/password/PIN atau isi master siswa ke log. Tidak memakai secret contoh dalam dokumen/fixture.
2. Gunakan PostgreSQL terisolasi untuk rehearsal schema+data sintetis1/5/6. Tes perubahan FK/deferred order/mode/rights/append-only, dump master dan rowcount sebelum/sesudah cleanup, serta restore. Runtime lama dan schema baru tidak kompatibel: pilih maintenance satu paket, bukan migrasi terpisah lalu menjalankan kode enum lama.
3. Cocokkan migrasi aktual sebelum deploy. Catatan operasional sebelumnya menemukan riwayat remote `20260817005759_init`, `20260817104407_add_reviewed`, `20260817210605_add_action_status` yang belum tersedia lokal; verifikasi ulang dan pulihkan arsip bila masih mismatch. Jangan menyatakan drift bersih atau memakai resolve/reset paksa untuk melewatinya.
4. Backup teruji/PITR checkpoint, akses restore dan RTO/RPO ditetapkan bersama operator. Restore ke clone, verifikasi CMS/master serta semua suara acknowledged sebelum cutover. DB bersama tidak boleh dikembalikan ke masa lalu secara buta.
5. Pastikan env existing lengkap: DB Neon, admin JWT/session, PIN pepper/fingerprint, R2 dan origin/base URL sesuai deployment. Nama secret mengikuti env template repo; tidak menambah secret atau memberi votingPIN akses Account. Verifikasi izin DB runtime nonowner dan tanpa DDL/Ballot UPDATE/DELETE/TRUNCATE/audit UPDATE/DELETE; jangan menganggap URL owner sekarang sudah least-privilege.

## Manifest cleanup sampel dan batas penghapusan

T12 harus menyiapkan manifest reviewable dari inventaris aktual: exact period UUID+slug, state/isTest/publishedAt, jumlah masing-masing child, versi snapshot, alasan klasifikasi sampel dan backup checkpoint. Jangan menggunakan filter semua periode/academicYear/nama mengandung demo sebagai otorisasi. Data berubah dari manifest => abort seluruh transaksi dan inventaris ulang.

| Boleh dihapus untuk setiap target exact | Harus tetap |
| --- | --- |
| VotingSession target, CandidateMember/Pair target, VoterParticipation target, Ballot sampel target, ElectionVoter+PIN target, ElectionContest target, ElectionPeriod+resultSnapshot target | Student, Teacher, SchoolClass, Department, Account/role/override, CMS, Media/R2, periode di luar manifest, semua VotingAuditEvent lama dan audit cleanup baru |

Rate bucket tidak mempunyai FK period universal; jangan membersihkan semua bucket sebagai efek cleanup. Kredensial aktif dicabut dengan penghapusan sesi/voter target. Referensi audit period UUID sengaja tetap meski parent terhapus; actor Account FK restriktif tidak dilepas. Master ElectionType legacy hanya dibuang bila tidak punya referensi dan memang perlu untuk transisi; tidak menambah sampel baru di Neon.

Runtime `/test-cleanup` tetap hanya isTest dan belum dipublikasi dengan popup+password+previewVersion. Jika target sesuai syarat, reuse jalur tersebut dalam rehearsal. Sampel published/legacy di luar aturan runtime **tidak** diberi bypass endpoint; pembersihan yang sudah diotorisasi dilakukan migrator offline berikut, bukan mengubah klasifikasi/isTest agar lolos guard.

### Memakai artifact cleanup offline pada T12

File SQL bukan command mandiri atau fungsi yang dipasang pada database. Migrator menyiapkan dua temporary table dalam **satu koneksi/transaksi**, mengisi hanya target dari manifest yang sudah diverifikasi, lalu mengeksekusi file pada koneksi yang sama. Bentuk persiapannya:

```sql
BEGIN;
CREATE TEMP TABLE "_EvotingCleanupManifest" (
  "periodId" uuid PRIMARY KEY, slug text, "previewVersion" text
) ON COMMIT DROP;
CREATE TEMP TABLE "_EvotingCleanupContext" (
  "actorAccountId" text, reason text, confirmation text
) ON COMMIT DROP;
-- Isi dengan parameter terikat: exact UUID, exact slug, version hasil preview yang direview.
-- Context: akun superadmin aktif, alasan 10–500 karakter,
-- confirmation tepat 'HAPUS SAMPEL UNTUK JENIS DINAMIS'.
-- Jalankan scripts/sql/evoting-sample-cleanup.sql pada koneksi ini.
-- Verifikasi manifest/master/audit/guard, lalu COMMIT; jika gagal ROLLBACK.
```

File memerlukan table owner/migrator, lock tabel domain, manifest nonkosong dan versi preview yang masih cocok. Hanya enam guard legacy yang menghalangi delete, ditambah guard contest jika schema baru, disimpan via pg_get_triggerdef lalu dilepas/dibangun lagi secara transaksional. Guard lain, terutama audit append-only dan FK aktor, tetap aktif. Published samples boleh hanya karena exact manifest di jalur migrator yang sudah diotorisasi; tidak ada bypass runtime baru. Jangan menambahkan auto-select seluruh periode untuk mengisi manifest.

Jika statement sesudah penghapusan ballot atau pemasangan kembali trigger gagal, rollback mengembalikan rows, audit baru dan definisi guard. Hal ini diuji melalui fault injection sintetis. Script tidak menghapus Media/R2, Student/Teacher/kelas/jurusan/Account, CMS, rate buckets atau audit lama. Rilis dengan data di luar manifest tetap ditolak oleh preflight migration.

## Urutan maintenance T12

1. Pastikan T11 lulus dan artifact baru siap. Aktifkan maintenance untuk seluruh writer pemilu (API, SSR action, job); blok traffic baru dan drain transaksi lama. Website CMS dapat tetap baca; admin writer lain juga dijeda bila backup/cutover membutuhkannya. Slot serverless lama harus dicegah menulis schema baru. Rekam checkpoint backup dan manifest final; hitungan target di-lock diverifikasi lagi.
2. Migrator khusus owner/DDL, bukan runtime, mengambil lock yang sudah direhearsal. Cleanup satu transaksi dengan exact manifest. Tulis audit cleanup **sebelum** parent dihapus agar guard audit existing-period sah; detail berisi target/count/reason/manifest digest aman, tidak PIN/nama/pilihan. Audit append-only/FK actor tetap aktif.
3. Untuk sampel yang memerlukan penghapusan Ballot/period beku, inventaris guard spesifik pada dependency graph: trigger reject Ballot change, freeze calon/roster/participation/period/contest dan FK restrict. Simpan definisi asli. Dalam transaksi maintenance, drop/recreate **hanya objek yang terinventaris** dan constraint terkait yang menghalangi penghapusan authorized target; DELETE berparameter dengan period exact dan urut children→parent. Jika guard dipasang ulang gagal, rollback seluruh transaksi. Jangan `DISABLE TRIGGER ALL`, `session_replication_role`, TRUNCATE, runtime GUC flag, permanen SECURITY DEFINER bypass atau `DROP ... CASCADE`.
4. Terapkan migration SQL baru yang sudah direhearsal: master ElectionType+revision; seed lima; convert enum organization di semua dependency menjadi varchar(32), bangun FK ke master/contest dan index/deferred order; tambah snapshots/contestsRevision/mode serta guard dinamis. Transisi schema dan cleanup dapat dalam satu transaksi maintenance yang direview bila dependency menuntutnya; tidak menyebutnya additive-only. Historical migrations tidak diedit. [ALTER TABLE PostgreSQL](https://www.postgresql.org/docs/current/sql-altertable.html).
5. Pastikan guard/index/FK/grants lengkap kembali sebelum commit/traffic. Validasi orphan, tepat N hak, uniqueness/order/mode, Ballot anonim dan audit lama tidak berkurang; master/CMS/media rowcount/checksum sama kecuali perubahan lain yang tercatat. Kegagalan salah satu check membatalkan release. T02 harus menghasilkan SQL exact yang bisa direview; T01 tidak menyajikan pseudocode ini sebagai migration siap eksekusi.
6. Verifikasi tidak ada snapshot v1/data nonsampel tersisa sebelum merilis parser v2-only. Bila ada, stop, pertahankan data dan perlukan backfill/reader kompatibel yang diuji. Jangan menyamakan v1 Dewan Ambalan dengan dua Pradana atau menyalin suaranya.
7. Deploy artifact schema-compatible, generate Prisma Client pada build sesuai pipeline; periksa commit deployment aktual, logs dan env tanpa membocorkan secret. Smoke create masterjenis6+DRAFT+calon+selected roster+PIN/login/status/vote/close/publish pada environment sintetis. Pada produksi gunakan periode uji terpisah yang sah dan tidak mengubah periode resmi; bersihkan dengan jalur aman. Buka traffic setelah checklist lulus.

Definisi trigger/fungsi restored diperbandingkan dengan target yang disetujui, termasuk append-only audit, audit period INSERT guard dan cleanup runtime. Jika maintainer tidak dapat membuktikan scope drop/recreate aman, jangan menjalankan partial cleanup lalu melanjutkan. [Lock PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html). Tidak ada langkah di atas telah dijalankan pada Neon oleh T01.

## Upload T10 dan verifikasi yang tertunda

Lengkapi R2_ENDPOINT/R2_ACCESS_KEY/R2_SECRET_KEY serta bucket/public URL sesuai environment melalui secret store/.env, tanpa mencetak nilainya. Lokal belum menyediakan tiga credential utama sehingga probe berhenti sebelum membuat object. Sesudah tersedia, verifikasi PutObject Content-Type=image/webp dan ukuran sesuai metadata/Media, GET thumbnail miss/cache hit serta hapus hanya object probe sendiri. Uji dua realm upload via aplikasi; ukur cold start, memori, multipart mendekati batas hosting dan kualitas foto resmi. Tidak perlu migrasi Neon tambahan.

Pilih Foto untuk foto dan Logo untuk lossless; dokumen melalui FileUpload. File asli disimpan operator terpisah bila diperlukan. SVG/animasi ditolak; jangan rename untuk melewati validasi. Warning indexing berarti object mungkin sudah tersimpan tetapi belum terdaftar Media: simpan URL dan minta pemeriksaan, jangan upload berulang. Media referensi pemilihan/historis tidak dapat dihapus. Bila entri tak terpakai terhapus tetapi pembersihan R2 gagal, periksa object yatim; jangan menghapus aset berreferensi atau bucket massal.

## Verifikasi T11 lokal dan pekerjaan rilis

Endpoint GET /api/admin/e-voting/{periodId}/results memerlukan evoting.lihat+evoting.hasil. Sebelum close409 tanpa tally; setelah close/archive200 snapshot tersanitasi, tanpa perlu publishedAt. Ini API JSON, bukan halaman pratinjau baru. Publish tetap langkah terpisah berizin+reauth+CSRF; password salah401, limiter429, body400/413/415. Tidak mempublikasikan atau merekayasa suara untuk menguji API pada Neon.

PostgreSQL17.11 portabel lokal menjalankan6skenario lintas koneksi: kapasitas3/4login, final-vote ganda, kedua urutan vote/close dan kedua urutan attach-logo/delete-media. Barrier memakai trigger/advisory lock pada DB sintetis khusus, tanpa mengganti timeout/lock produksi. Server dihentikan setelah tes. Jalankan scripts/test-voting-postgres.mjs dengan PG_TEST_BIN menunjuk bin PostgreSQL lokal; runner membuat cluster/data/password di artifacts/ui-qa, hanya loopback, database smkdh_voting_t11_only, dan tidak membaca .env. Jangan arahkan tes destruktif ke Neon.

Sebelum rilis hosted, lengkapi env R2 dan verifikasi upload/multipart/cold start/memori/aset resmi, runtime DB nonowner, tiga Chromebook guest/kiosk beserta Back/logout/koneksi putus, serta versi artifact Vercel yang sesuai. Tiga arsip migrasi historis masih perlu dipulihkan. DB Neon sudah dimigrasi; jangan menganggap kode Vercel lama kompatibel atau menandai seluruh T12 selesai.

## Hari pemilihan

1. Kelola Jenis: nama/logo/jabatan/mode resmi. Buat periode dengan1–20 jenis; awal OSIS,PRADANA PUTRA,PRADANA PUTRI,IPNU,IPPNU. Koreksi master sebelum memasangnya; edit master tidak memperbarui snapshot periode existing. Setelah schedule susunan tidak bisa diedit.
2. Tambah calon dari Student master, cek suggestion/autofill/nomor/visi/misi/foto. SINGLE tanpa wakil; lainnya wakil opsional. Pilih siswa sesuai tahun ajaran kelas dan guru eksplisit, gabungan <=99; tidak ada import kedua/perlu seluruh siswa.
3. Registrar mengesahkan roster; akun panitia individual berizin, cetak PIN maksimal25/batch dengan saksi dua petugas menurut prosedur. URL slip harus domain pemilih, bukan localhost/preview. Print sekali: slip hilang perlu reset/reissue sah yang membatalkan PIN lama. Jangan membacakan PIN massal/logging.
4. Schedule setelah checklist siap. Mulai waktu buka slate/roster beku; masterjenis boleh diedit tetapi tak berpengaruh pada periode. Panitia memakai perangkat terpisah. Tiga Chromebook dalam mode guest/kiosk, password saving mati, satu pemilih/perangkat dan maksimal3sesi global. Pastikan logout/selesai/expiry layar netral sebelum giliran berikutnya; Back/tablama tidak menampilkan akun sebelumnya.
5. Pemilih parsial login ulang PIN valid yang sama untuk resume; selesai cabut sesi. Saat koreksi NISN pemilih belum memilih, dua pemeriksa sesuai alur existing, Student ID tetap, PIN/sesi dicabut dan dicetak baru; bukan edit identitas setelah memberi suara. Gangguan koneksi cek status terlebih dulu karena timeout mungkin sudah commit.
6. Monitor hanya partisipasi; belum/parsial boleh didampingi tanpa melihat pilihan. Tidak ada tally kandidat sebelum close, termasuk saat semua selesai. PIN disabled tetap denominator dan tidak menghapus hak/suara.
7. Sesudah opensAt panitia boleh close walau absen/parsial. Sebelum deadline, alasan10–500+early opt-in+password+konfirmasi konsekuensi. Rekonsiliasi wajib, nol suara sah dengan roster nonkosong. Close permanen, jadwal asli tetap; publikasi terpisah. Dua saksi adalah prosedur, tidak diklaim aplikasi membuktikan kehadiran mereka.
8. Periksa hasil internal/rekonsiliasi, setujui berita acara lalu publish. CTA Lihat hasil voting membuka tabbaru. Seri/nol ditangani kebijakan sekolah; aplikasi tidak menetapkan pemenang/quorum. Archive setelah proses resmi; jangan hapus periode nyata untuk mengulang hasil.

## Insiden, rollback dan retensi

Gangguan: catat waktu, blok write baru bila integritas diragukan, amankan bukti tanpa PII/PIN. Snapshot/count mismatch tidak diselesaikan dengan reset participation atau insert/delete ballot manual. Perpanjangan sekali<=60menit dengan alasan/password/audit; jika belum pulih, berhenti pada tenggat dan keputusan sekolah. Periode CLOSED tak dibuka lagi; pemilihan ulang periode baru untuk semua tanpa transfer suara/kertas tercampur.

| Kondisi | Pemulihan |
| --- | --- |
| Belum maintenance/migration | Batalkan release, runtime lama tetap |
| Transaksi migration/cleanup gagal | Rollback transaksi, verifikasi target/master/audit/guard; jangan lanjut partial atau migrate reset |
| Schema baru sudah commit, belum suara nyata | Runtime lama belum tentu kompatibel; fix-forward artifact kompatibel atau restore clone schema+data+code yang cocok lalu cutover terencana |
| Sudah ada suara acknowledged | Freeze bila perlu, utamakan fix-forward. Restore/PITR harus memuat semua suara yang sudah diakui; jika mungkin hilang laporkan panitia, jangan meminta hanya siswa tertentu mengulang |

Backup berisi PII dan potensi korelasi WAL: akses terbatas/retensi tercatat. DB owner/operator tetap pihak tepercaya, bukan anonimitas kriptografis terhadap admin. Setelah sanggah30hari bersihkan PIN hash/fingerprint+sesi, roster/audit1tahun dan aggregate lintas tahun sesuai kebijakan sekolah; penghapusan PII/ledger saat retensi perlu prosedur khusus, tidak membypass append-only lewat API. Media referenced snapshot tidak dihapus. Master Student/Teacher independen dan mengikuti retensi sekolah sendiri.
