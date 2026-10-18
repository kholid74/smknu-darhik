# Task implementasi jenis pemilihan dinamis dan penyempurnaan hasil

**Pembaruan T11, 18 Oktober:** endpoint hasil internal dan status publikasi401/429 diterapkan. Regresi232tes lulus (satu penanda tes DB dilewati dan dijalankan terpisah), PostgreSQL lokal lintas koneksi6/6, browser37skenario, Prisma validate/generate dan build lulus. Penerimaan R2/Vercel/perangkat tetap belum selesai. [Bukti T11](06-pengujian.md#bukti-dan-gerbang-rilis).

**Pembaruan upload 18 Oktober:** T10 sudah diimplementasikan dan diuji lokal (228 tes, 37 skenario browser, build lulus). Verifikasi object R2/hosted belum selesai karena konfigurasi R2 lokal belum tersedia. [Bukti dan batas](../image-upload-webp-study.md#implementasi-t10-dan-bukti-terbaru).

**Pembaruan Neon 17 Oktober 2026:** migrasi schema dan cleanup empat periode yang disetujui sudah berhasil setelah backup teruji. Master dan audit lama tetap; deployment belum dilakukan. [Catatan pelaksanaan](13-catatan-migrasi-neon.md).

Tanggal: 16 Oktober 2026. Sumber kebutuhan: [usulan #11](11-usulan-jenis-pemilihan-dan-hasil.md), klarifikasi lima surat suara dan izin pengguna untuk membersihkan data pemilihan sampel bila diperlukan. Ini adalah daftar pekerjaan, bukan catatan bahwa seluruh fitur sudah diimplementasikan.

## Penilaian kesiapan

**T01–T09 selesai lokal; implementasi T10–T11 dan regresi lokal tersedia; penerimaan R2/hosted/perangkat serta deployment masih tertunda.** Konfigurasi, hak pilih, portal, sesi, transaksi, partisipasi dan snapshot v2 sudah dinamis serta teruji. UI master/susunan DRAFT, mode/foto calon dan hasil publik berfoto/infografis tersedia; penutupan tanpa turnout penuh tersedia dengan alasan dini dan konfirmasi; konfigurasi awal tetap OSIS, PRADANA PUTRA, PRADANA PUTRI, IPNU, IPPNU, hak semua jenis periode untuk setiap pemilih, penutupan tanpa turnout penuh serta publikasi resmi terpisah.

**Schema Neon sudah dimigrasi atas permintaan pengguna, mendahului T10–T11.** Empat periode sampel termasuk DRAFT osis-2026 dihapus sesuai persetujuan khusus setelah backup/restore teruji. Lima master tersedia dan query baca Prisma Neon lulus; master sekolah/audit tetap. T10–T11 dan deployment/hosted verification T12 tetap belum selesai. Runtime lama yang belum dirilis ulang dapat gagal pada fitur e-voting; jangan memakai pemilihan hosted resmi sebelum artifact kompatibel terpasang dan diverifikasi. Bukti task T00–T09 di bawah tetap historis, sebelum operasi Neon ini.

Pilihan awal untuk perincian: kode jenis unik dan immutable sebagai key, enum organisasi diganti referensi master, mode calon tunggal atau ketua dengan wakil opsional, snapshot periode beku, logo memakai MediaPicker/R2, alasan wajib untuk penutupan lebih awal, foto WebP85 di server dan logo lossless melalui jalur yang eksplisit. Kualitas/crop foto diverifikasi pada UI; tidak memerlukan keputusan framework/library baru.

## Daftar task

| ID | Task | Dependensi | Status |
| --- | --- | --- | --- |
| T00 | Badge status memilih/belum memilih | — | **Selesai lokal**; belum commit/push/deploy |
| T01 | Finalkan schema, API, snapshot dan dokumen teknis | — | **Selesai lokal**; kontrak/dokumen, belum commit |
| T02 | Schema, migrasi lokal dan lima master awal | T01 | **Selesai lokal 17 Oktober**; Prisma/SQL dan uji PGlite; schema/seed kini diterapkan Neon |
| T03 | Backend CRUD jenis dan konfigurasi jenis periode | T02 | **Selesai lokal 17 Oktober**; endpoint/SQL/audit teruji lokal; schema Neon siap, mutasi hosted belum diuji |
| T04 | Hak pilih, transaksi suara, sesi dan rekap dinamis | T02–T03 | **Selesai lokal 17 Oktober**; Prisma/SQL, endpoint dan browser teruji |
| T05 | UI master jenis dan pemilihan jenis pada DRAFT | T03–T04 | **Selesai lokal 17 Oktober**; master/popup/logo dan urutan DRAFT teruji |
| T06 | Form calon dinamis dan foto sebagai fokus kartu | T03–T05 | **Selesai lokal 17 Oktober**; mode/snapshot/foto, edit/hapus stale dan browser teruji |
| T07 | Penutupan dini tanpa seluruh pemilih selesai | T04 | **Selesai lokal 17 Oktober**; alasan/reauth, rekonsiliasi, rollback dan browser teruji |
| T08 | Hasil publik dengan foto dan infografis ringan | T04, T06–T07 | **Selesai lokal 17 Oktober**; snapshot/foto, denominator, seri/nol, no-JS/cetak dan browser teruji |
| T09 | CTA hasil pada daftar/detail periode, tab baru | T08 | **Selesai lokal 17 Oktober**; gate/status/izin, tab baru dan form publikasi teruji |
| T10 | Normalisasi upload WebP dan metadata hasil | Kontrak upload pada T01 | **Implementasi/tes lokal selesai 18 Oktober**; object R2 dan penerimaan hosted tertunda konfigurasi |
| T11 | Pengujian gabungan dan dokumentasi final | T05–T10 | **Implementasi/regresi lokal selesai 18 Oktober**;232tes+6race PG+37browser, penerimaan hosted/perangkat tertunda |
| T12 | Pembersihan sampel, migrasi Neon dan verifikasi deployment | T11, migrasi DB didahulukan pengguna | **Sebagian**: backup/cleanup/migrasi/read Neon selesai; deployment/hosted verification belum |

### T00 — Badge partisipasi: selesai lokal

- [x] Hijau + ✓ Sudah memilih, netral + ○ Belum memilih; ikon dekoratif dan label teks.
- [x] HTML awal dan baris Muat berikutnya memakai definisi status yang sama.
- [x] CSS juga berlaku untuk sel yang dibuat JavaScript; tidak ada pilihan kandidat/waktu suara pada laporan.
- [x] Build dan 20 skenario QA browser lulus dengan data sintetis; screenshot desktop/mobile diperiksa.

Jangan mengulang implementasi ini. T04 telah mengintegrasikan kolom dinamis dengan badge yang ada. Belum ada pengujian data Neon atau deployment untuk badge.

### T01 — Perincian teknis sebelum implementasi schema

- [x] Tetapkan field, panjang/kewajiban input, kode immutable, uniqueness, FK, index, mode calon, urutan dan aturan penghapusan `ElectionType`/`ElectionContest`.
- [x] Tetapkan kapan snapshot jenis diambil dan dibekukan; perubahan master tidak mengubah periode yang sudah dipasang. Susunan jenis hanya dapat diubah saat DRAFT, terkunci setelah dijadwalkan.
- [x] Definisikan kontrak CRUD, perubahan jenis periode, penutupan dengan alasan, serta response status/progress/hasil yang mengikuti jenis periode; pertahankan format respons dan pola autentikasi/CSRF repo.
- [x] Tentukan kontrak snapshot baru tanpa validator yang mewajibkan empat jenis; nilai publik hanya agregat dan data calon yang diizinkan. Data sampel boleh dibersihkan, sehingga dukungan parser sampel lama bukan syarat bila semua snapshot terkait memang dihapus.
- [x] Finalkan langkah penanganan trigger append-only dan aturan keanggotaan beku; tidak ada bypass permanen.
- [x] Catat perubahan arsitektur dalam ADR, lalu selaraskan `CONTEXT.md`, `02-desain.md`, `03-schema.md`, `04-api.md`, `05-implementasi.md`, `06-pengujian.md`, `07-operasional.md` dan README, dengan pemisahan jelas rancangan/status aplikasi.

**Selesai ketika:** kontrak dan DDL dapat dijadikan acuan implementasi yang tidak saling bertentangan. Belum mengeksekusi perubahan pada Neon.

Bukti T01: `node docs/e-voting/contracts/check.mjs` lulus untuk 21 operasi, 35 schema dan 60 contoh positif/negatif, termasuk snapshot 1/5/6 jenis dan nol suara. Pemeriksaan 13 dokumen menemukan 99 tautan lokal/anchor valid; tidak ada konflik pada kontrak aktif. Referensi empat jenis dalam audit/ADR lama/08–10 adalah baseline historis dan ditandai prioritas penggantinya di README. Ini validasi kontrak, bukan tes aplikasi, SQL/Prisma, migrasi atau deployment. Detail DDL final yang dapat dieksekusi dan uji trigger menjadi T02.

### T02 — Migrasi lokal dan master awal

- [x] Tambahkan master jenis serta field snapshot/urutan pada contest; hilangkan pembatasan enum pada relasi organisasi sesuai desain T01.
- [x] Pertahankan relasi calon/partisipasi/ballot yang memastikan jenis tersebut benar-benar milik periode, nomor ballot unik, dan satu siswa tidak terdaftar dua kali dalam jenis/periode.
- [x] Reuse CandidatePair/CandidateMember, Student/Teacher master, dan Ballot anonim; tidak menambahkan identitas pemilih pada Ballot.
- [x] Seed lima master awal. PRADANA PUTRA/PUTRI mode tunggal; OSIS/IPNU/IPPNU memiliki wakil opsional. Logo dapat diisi melalui media; tidak memakai logo rekaan atau menggantungkan seed pada URL pihak ketiga.
- [x] Buat prosedur pembersihan sampel yang terukur untuk pelaksanaan T12; buktikan pada database lokal terisolasi bahwa master dan audit yang dipertahankan tidak ikut terhapus.
- [x] Validasi Prisma, generate Client, dan jalankan uji constraint/trigger pada DB terisolasi.

**Selesai ketika:** schema dan migrasi teruji lokal, lima master tersedia pada fixture/seed yang sesuai, dan proteksi DB tetap berlaku. Jangan rilis bagian ini sendirian ke aplikasi yang masih mengharuskan empat organisasi.

Bukti T02 (17 Oktober): [schema Prisma](../../prisma/schema.prisma), [migration SQL](../../prisma/migrations/20261017090000_dynamic_election_types/migration.sql), [cleanup offline](../../scripts/sql/evoting-sample-cleanup.sql), [17 uji SQL](../../src/lib/voting/dynamic-types-db.test.ts). Prisma format/validate/generate dan build lulus. Suite regresi awal serial lulus 160 pengujian; suite SQL final 17/17 lulus setelah tambahan kasus freeze/state dan batas 99×20. Cleanup sampel published dengan ballot/sesi, stale manifest, rollback setelah child terhapus, master/audit tetap dan restore backup diuji pada PGlite. Validasi deferred 1.980 hak dioptimalkan dari sekitar 64 detik menjadi 0,8–1,6 detik pada dua run lokal; bukan estimasi Neon. Belum ada koneksi/migrasi Neon dari uji SQL ini, deployment, atau uji lock lintas koneksi.

Jembatan enum empat pada T02 telah dihapus oleh T04. Simulator dan suite layanan close kini memakai schema baru. Dua suite migrasi historis teacher/cleanup tetap mempertahankan baseline 16 Oktober untuk menguji riwayatnya; suite schema serta layanan Prisma baru menguji model terkini. Tidak ada migrasi historis yang diedit.

### T03 — Backend master dan jenis per periode

- [x] Tambah list/create/update/activate/deactivate/delete master dengan kapabilitas pengelolaan pemilihan, validasi input, Origin/CSRF dan audit.
- [x] Tolak kode duplikat, perubahan kode setelah dibuat, logo tidak sah, mode tidak sah, serta hapus jenis yang telah dipakai periode; nonaktif tidak mengubah hak pilih periode yang sudah ada.
- [x] Tambah konfigurasi daftar jenis/urutan saat membuat atau mengedit DRAFT; daftar tidak kosong dan tidak duplikat.
- [x] Bila roster sudah tersedia, tambahkan/hapus baris hak pilih yang belum dipakai secara atomik. Jenis berisi calon tidak dapat dilepas sebelum calon dibersihkan lewat alur sah.
- [x] Penambahan master baru tidak otomatis menyisipkan jenis pada periode yang sudah dibuat. Tolak perubahan susunan setelah dijadwalkan.

**Selesai ketika:** jenis baru dan periode dengan kombinasi berbeda dapat dikelola lewat API tanpa mengubah kode/deploy untuk setiap jenis berikutnya; permintaan tidak berizin atau stale tidak mengubah data.

Bukti T03: [service](../../src/lib/voting/election-types.ts), [validator](../../src/lib/voting/election-type-input.ts), [uji endpoint/SQL](../../src/lib/voting/election-types-api.test.ts). GET/POST types, PATCH/DELETE types/code, POST periods dan GET/PUT period/contests sudah berjalan pada fixture schema baru. GET detail menambah metadata snapshot/revision; token, izin, Origin dan respons JSON 401/403 memakai middleware nyata. Audit gagal membatalkan data dan hak; revisi stale/no-op, active/inactive, FK/logo Media, payload OpenAPI dan roster siswa/guru diuji.

Suite serial penuh **179/179 lulus**; pemeriksaan akhir validator+API **17/17 lulus** sesudah koreksi URI media relatif dan tambahan pemeriksaan calon terakhir SCHEDULED. QA browser **21 skenario lulus**, termasuk 101 jenis dalam dua halaman, label escaped, pilihan eksplisit serta daftar kosong/gagal. Build produksi lulus; checker kontrak kini 64 contoh. Uji bersamaan memakai transport PGlite yang diserialisasi; bukan bukti locking/deadlock PostgreSQL lintas koneksi (tetap T11).

Caller form buat periode kini mengambil semua halaman jenis aktif, default lima terpilih jika tersedia, dan mengirim daftar eksplisit sesuai urutan tampil. CRUD master melalui UI, pengurutan/edit susunan pada dashboard dan panduan lengkap tetap T05. Calon terakhir boleh dihapus di DRAFT agar jenis dapat dilepas; SCHEDULED sebelum buka tetap menyisakan satu. Tidak ada migrasi/perubahan data Neon, commit/push atau deployment T03.

### T04 — Mekanisme pemilihan dinamis

- [x] Inventaris ulang seluruh daftar/angka empat pada aplikasi, raw SQL, validator, trigger, migrasi baru, seed dan fixture. Jangan sekadar mengganti menjadi lima; migrasi historis yang sudah diterapkan tidak diedit.
- [x] Sesuaikan kesiapan jadwal, roster siswa/guru dan hak pilih mengikuti jenis pada periode, termasuk DRAFT dengan roster yang sudah dibuat.
- [x] Sesuaikan login, dashboard, ballot, progress, status API, middleware, pilihan berikutnya dan resume; cabut sesi setelah semua hak periode selesai.
- [x] Sesuaikan agregat lengkap/sebagian/belum, kolom tabel partisipasi dan pagination mengikuti jenis periode; pertahankan badge T00.
- [x] Terapkan validasi kandidat/jenis/periode, pencegahan suara ganda, transaksi partisipasi + ballot, rekonsiliasi dan snapshot dinamis. Jenis master yang tidak dipasang pada periode tidak boleh dipilih.
- [x] Pertahankan sesi idle/absolut, logout, batas tiga sesi bersama, PIN khusus periode, anonimitas Ballot dan larangan tally kandidat sebelum tutup.

**Selesai ketika:** periode satu jenis selesai setelah satu suara, lima setelah lima, dan jenis keenam yang dibuat lewat CRUD bekerja tanpa edit kode. Resume parsial dan penolakan duplikasi tetap benar.

Bukti T04: [helper himpunan/progress](../../src/lib/voting/contests.ts), [10 uji Prisma/SQL/endpoint](../../src/lib/voting/dynamic-voting.test.ts), [5 skenario simulator](../../src/lib/simulation-seed.test.ts), [rekonsiliasi close](../../src/lib/voting/period-close.test.ts), [validator snapshot](../../src/lib/voting/result-snapshot.ts). Login siswa/guru, resume, status/portal/ballot, hak roster, reset PIN, kesiapan jadwal, vote atomik dan rekap memakai jenis periode. Batas tiga sesi global diperiksa di bawah advisory lock; reautentikasi mengganti sesi sendiri. Mode SINGLE ditolak server jika diberi wakil; form calon minimal sudah memuat jenis periode, pengaturan mode/foto lengkap tetap T06.

Suite penuh **195/195 lulus**, browser **22 skenario lulus**, build produksi dan checker kontrak lulus. Kasus 1/5/6 jenis memeriksa snapshot master tetap, metadata/jabatan/urutan, siswa+guru, partial resume, final revoke, PIN reset 4/5 vs 5/5, penolakan perangkat keempat, expiry/logout, rollback Ballot gagal, CSRF/realm/cookie akhir dan publikasi terpisah. Payload Dashboard/Status/Participation/VoteRecorded/PublicResults sesuai OpenAPI. Browser memeriksa progress/dashboard/ballot 1/5/6, keyboard, teks escaped dan completion mobile; screenshot diperiksa. Simulator menjalankan script sebenarnya pada SQL terisolasi dan tidak menulis env/slip; seed memakai transaksi baru setelah migration yang memiliki COMMIT sendiri.

Transport PGlite memakai satu koneksi/savepoint dan pg adapter resmi; tidak membuktikan lock/deadlock antar koneksi, isolation level nyata, jaringan Neon atau tiga perangkat fisik. Uji tersebut tetap T11–T12. Early-close masih mensyaratkan seluruh hak selesai sampai T07; UI master, susunan DRAFT dan panduan lengkap tetap T05. Tidak ada koneksi/migrasi/cleanup Neon, commit/push atau deployment.

### T05 — UI master dan konfigurasi periode

- [x] Tambah menu Jenis pemilihan pada kelompok E-Voting, menggunakan pola tabel/pencarian/pagination dashboard.
- [x] Tambah form baru, popup edit, aktif/nonaktif, serta popup konfirmasi hapus dengan feedback jika jenis sudah dipakai.
- [x] Gunakan MediaPicker untuk logo; tampilkan nama, logo, mode/jabatan, urutan dan status aktif.
- [x] Pada form periode, tampilkan pilihan jenis dan urutan yang jelas; tampilkan jumlah surat suara berdasarkan pilihan, lalu keadaan terkunci setelah dijadwalkan.
- [x] Perbarui panduan dashboard, checklist kesiapan dan pesan error agar tidak menyebut empat organisasi.

**Selesai ketika:** panitia menyiapkan periode lima jenis dari dashboard dan dapat menyiapkan periode lain dengan jumlah berbeda tanpa injeksi DB.

Bukti T05: [halaman master](../../src/pages/admin/e-voting/jenis.astro), [picker bersama](../../src/components/voting/ContestPicker.astro), [navigasi](../../src/layouts/AdminLayout.astro), [browser](../../scripts/ui-smoke-test.mjs). Menu Jenis Pemilihan memuat seluruh halaman master lalu memakai pencarian/filter/pagination dashboard default 10; tambah/edit popup, kode readonly, mode/jabatan, MediaPicker logo, aktif/nonaktif dan confirm-delete tersedia sesuai izin. Logo tabel memakai thumbnail; nama media dirender lewat DOM sehingga tidak ditafsirkan sebagai HTML. Menu aktif memilih prefix terpanjang agar Pemilihan/Jenis tidak sama-sama disorot.

Buat periode dan edit DRAFT memakai komponen yang sama untuk 1–20 jenis dan urutan naik/turun. Snapshot retained, termasuk jenis nonaktif, tetap digunakan; master baru tidak otomatis disisipkan. Simpan memakai expectedRevision; stale/state terkunci menghentikan pengiriman ulang. Jenis berisi calon ditolak dengan petunjuk membersihkan calon melalui jalur sah. SCHEDULED hanya menampilkan susunan readonly. Panduan dashboard sudah mencakup master→pilih/urut→freeze.

Build produksi dan **25 skenario browser lulus**, termasuk create/edit/toggle/delete, cancel, viewer, logo, stale, TYPE_IN_USE/CONTEST_HAS_CANDIDATES, payload urutan/revision, batas 0/20/21 serta master berubah/nonaktif. Screenshot popup mobile diperiksa. Browser memakai API stub loopback; mutasi/constraint/audit nyata tetap diuji T03–T04 pada SQL/Prisma. Suite regresi T04 terakhir 195/195 lulus. Belum ada migrasi/cleanup Neon, commit/push atau deploy. Pada titik ini berikutnya adalah T06, yang diselesaikan di bawah.

### T06 — Calon dan foto besar

- [x] Form calon memakai jenis periode, label jabatan dan mode dari snapshot; Pradana tunggal tidak menawarkan wakil, sedangkan jenis lain mengikuti mode wakil opsional.
- [x] Pertahankan seleksi Student master, studentId, snapshot nama/kelas, uniqueness, nomor urut, visi/misi dan foto anggota opsional. Perubahan calon diaudit dan tetap terkunci setelah pembukaan.
- [x] Tampilkan portrait dominan di bagian atas kartu: satu foto untuk tunggal, dua sejajar bila ada wakil, nomor/nama jelas dan fallback setara.
- [x] Reuse thumbnail responsif, dimensi stabil, dan kebijakan loading yang sesuai posisi gambar. Pastikan crop wajah, pemilihan radio, keyboard dan popup konfirmasi tetap benar.

**Selesai ketika:** calon tunggal/berwakil/foto kosong bekerja pada portal siswa dan guru, mobile/Chromebook, tanpa merusak konfirmasi atau transaksi suara.

Bukti T06: [form calon](../../src/pages/admin/e-voting/[id]/calon.astro), [kartu pemilihan](../../src/pages/siswa/e-voting/[slug]/pilih/[organization].astro), [layanan](../../src/lib/voting/candidates.ts), [uji Prisma/SQL](../../src/lib/voting/dynamic-voting.test.ts), [API](../../src/lib/voting/election-types-api.test.ts) dan [browser](../../scripts/ui-smoke-test.mjs). Label/mode berasal dari snapshot periode; SINGLE menyembunyikan wakil dan OPTIONAL_VICE memakai checkbox. ID/foto/suggestion tertunda dibersihkan saat wakil dinonaktifkan. Edit/hapus membandingkan expected termasuk kedua foto; perubahan metadata/foto mempertahankan nama/kelas anggota yang sama. Anggota baru mengambil snapshot master terkini. Foto lama dipertahankan pada akun yang tidak memiliki izin media.

Kartu siswa/guru menampilkan portrait tunggal atau dua sejajar tinggi260–320px, fallback setara, thumbnail srcset/sizes, gambar awal eager/high dan sisanya lazy. Radio native, keyboard, konfirmasi, payload suara dan Ballot anonim dipertahankan. Crop ke atas diperiksa pada portrait sekolah publik existing; foto calon resmi tetap perlu pemeriksaan petugas.

Suite penuh **199/199**, **27 skenario browser**, build produksi, checker kontrak dan pemeriksaan dokumen lulus. Browser ukuran1366/390/320px tanpa overflow/error JS; API mutasi loopback, sedangkan persistence/constraint/audit/rollback memakai SQL/Prisma terisolasi. Bukan bukti tiga Chromebook fisik, locking lintas koneksi, Neon atau kualitas foto calon resmi; verifikasi itu tetap T11–T12. Belum migrasi/cleanup Neon, commit/push atau deploy. Pada titik ini berikutnya adalah T07, yang diselesaikan di bawah.

### T07 — Penutupan dengan pemilih absen/parsial

- [x] Hapus syarat seluruh pemilih selesai pada UI dan server; tampilkan jumlah lengkap, parsial dan belum mulai sebelum penutupan.
- [x] Minta alasan saat tutup lebih awal, password admin dan popup tentang berakhirnya hak pilih tersisa; sebelum jadwal buka tetap ditolak.
- [x] Pertahankan lock, waktu DB, reautentikasi, limiter, CSRF/izin, rekonsiliasi, snapshot, pencabutan sesi dan audit dalam transaksi atomik.
- [x] Catat tindakan panitia/alasan/waktu aktual tanpa mengubah jadwal asli. Retry penutupan tetap idempoten; publikasi tetap langkah terpisah.
- [x] Pemilih absen tetap pada roster; tidak ada ballot otomatis. Suara parsial tetap sah; nol suara dan seri tidak menghasilkan pemenang buatan.

**Selesai ketika:** panitia dapat menutup tanpa turnout penuh, sedangkan balapan close/vote, mismatch atau audit gagal tetap ditangani dengan benar dan tidak membocorkan hasil sebelum publikasi.

Bukti T07: [layanan](../../src/lib/voting/period-close.ts), [validator](../../src/lib/voting/period-input.ts), [endpoint](../../src/pages/api/admin/e-voting/[periodId]/close.ts), [detail periode](../../src/pages/admin/e-voting/[id]/index.astro), [panduan dashboard](../../src/pages/admin/e-voting/panduan.astro), [uji SQL/rollback](../../src/lib/voting/period-close.test.ts), [Prisma/middleware/API](../../src/lib/voting/dynamic-voting.test.ts) dan [browser](../../scripts/ui-smoke-test.mjs). Periode yang telah dibuka dapat ditutup tanpa semua pemilih selesai. UI menampilkan ringkasan lengkap/parsial/belum mulai, alasan dini10–500, password dan popup tentang berakhirnya hak tersisa. Form tidak ditawarkan sebelum buka/tanpa izin dan menahan aksi jika ringkasan/token belum siap. Password dihapus setelah batal/gagal; submit ganda dicegah.

Server memvalidasi alasan, reauth/limiter dan izin/CSRF/Origin; waktu DB setelah lock menentukan COMMITTEE_EARLY_CLOSE atau DEADLINE_REACHED. Alasan early=true tetap wajib bila request melewati deadline. Jadwal asli/roster/suara parsial dipertahankan; tidak membentuk ballot absen. Snapshot/revoke sesi/audit atomik; gagal salah satu atau rekonsiliasi membatalkan penutupan. CLOSED/ARCHIVED retry tidak mengulang tally/audit; hasil tetap tertutup sampai publikasi resmi terpisah. Password salah401 dan limiter429; invalid JSON400, content-type415, oversized413, error storage503 aman.

Suite penuh **212/212**, **29 skenario browser**, build produksi, checker kontrak **66 contoh** dan pemeriksaan dokumen lulus. Kasus gabungan siswa/guru, lengkap/parsial/absen/PIN nonaktif/nol, reason bounds, body/izin/reauth/CSRF, mismatch hak/ledger, rollback snapshot/revoke/audit, retry dan urutan vote→close / close→vote lulus. Snapshot/mobile diperiksa tanpa overflow/error JS. Transport SQL memakai satu koneksi/savepoint; dua urutan deterministik tidak membuktikan blocking/deadlock lintas koneksi atau tiga Chromebook fisik. Verifikasi itu tetap T11–T12. Belum migrasi/cleanup Neon, commit/push atau deploy. Pada titik ini berikutnya adalah T08, yang diselesaikan di bawah.

### T08 — Hasil publik dan infografis

- [x] Render metadata dan jumlah jenis dinamis dari snapshot resmi; nama/logo/foto riwayat tidak bergantung pada master terkini.
- [x] Tambah ringkasan keseluruhan dan donut partisipasi orang; pisahkan jumlah orang berpartisipasi dari jumlah surat suara.
- [x] Tambah navigasi organisasi berlogo, foto dominan tiap calon, angka/persentase serta batang perolehan per jenis; visi/misi menjadi detail yang dapat dibuka.
- [x] Tampilkan seri/nol suara secara benar dan tetap gunakan istilah Perolehan tertinggi. Urutan kandidat berdasarkan nomor ballot.
- [x] Gunakan SVG/CSS ringan dan angka/legenda aksesibel, tanpa library chart besar. Seluruh hasil tetap terbaca tanpa JavaScript; siapkan tampilan cetak.
- [x] Pastikan CLOSED/ARCHIVED + publishedAt tetap wajib, bukan hanya mengetahui slug. Tidak ada NISN/PIN/pilihan individual atau breakdown siswa/guru pada payload publik.

**Selesai ketika:** jumlah, denominator dan snapshot benar untuk satu/lima/enam jenis, publikasi terkunci benar, tampilan mobile/cetak terbaca dan foto tidak memperburuk pengiriman aset tanpa pengukuran.

Bukti T08: [halaman hasil](../../src/pages/e-voting/[slug]/hasil.astro), [portrait bersama](../../src/components/voting/CandidatePortraits.astro), [layanan publikasi](../../src/lib/voting/public-results.ts), [uji middleware/API/Prisma](../../src/lib/voting/dynamic-voting.test.ts), [fixture1/5/6](../../scripts/ui-fixture/src/results.ts) dan [browser](../../scripts/ui-smoke-test.mjs). Logo/nama/jabatan/foto dan urutan berasal dari snapshot resmi. Ringkasan memisahkan orang berpartisipasi (lengkap+parsial) dari total surat suara (sum perjenis); donut lengkap/parsial/belum dan bar calon memiliki angka/denominator eksplisit. Seri setara, nol0,0% tanpa peraih tertinggi; calon urut nomor, visi/misi dalam details native.

Foto memakai komponen yang sama dengan ballot siswa/guru: portrait dominan tunggal/dua sejajar, fallback setara, srcset/thumbnail dan loading sesuai posisi. Font/token portal dipakai ulang. Semua data/navigasi/detail tersedia tanpa JavaScript, script hanya tombol cetak; CSS print membuka seluruh visi/misi dan PDF fixture berhasil dibuat. Gate CLOSED/ARCHIVED+publishedAt tetap; sebelum terbit/tutup404 melalui API, snapshot invalid/storage503 aman. Read hasil tidak menghitung Ballot/membaca master terkini dan tidak mengungkap NISN/PIN/identitas/kelompok pemilih.

Suite penuh **213/213**, **32 skenario browser**, build produksi, kontrak66contoh dan pemeriksaan dokumen lulus. Browser1366/390/320px, DPR1/2, snapshot historis/escaped, seri/nol, mode tunggal/berwakil/foto kosong, keyboard/no-JS/cetak diuji; screenshot diperiksa. Portrait PNG contoh262445byte menjadi respons thumbnailw480 **7846byte** (~97,0% lebih kecil); cache tetap aktif, handler lokal teramati121ms pada run ini. QA menghasilkan results-media.json dan results-print.pdf di artifacts/ui-qa, tanpa data Neon. Ini bukan benchmark hosted atau mutu foto calon resmi; verifikasi R2/Vercel/aset nyata tetap T10–T12. Endpoint hasil internal tetap target kontrak; T08 menyelesaikan hasil publik. Belum migrasi/cleanup Neon, commit/push atau deploy. T09 CTA hasil dashboard diselesaikan di bawah.

### T09 — Tombol hasil yang menonjol

- [x] Tambah CTA utama Lihat hasil voting pada daftar dan detail periode sesudah publikasi.
- [x] Buka tab baru melalui anchor dengan target dan rel yang aman; berikan keterangan tab baru.
- [x] Sebelum publikasi tampilkan status yang jelas; Publikasikan hasil hanya menjadi aksi aktif bagi panitia berizin pada state yang sah.

**Selesai ketika:** panitia dapat menemukan dan membuka hasil tanpa meninggalkan dashboard, tanpa link aktif yang menuju hasil belum tersedia atau bypass izin.

Bukti T09: komponen ResultsAccess dipakai daftar/detail. Query daftar menambah publishedAt tanpa snapshot/tally, CTA utama/label tab baru/target/rel aman dan langkah Hasil resmi memakai gate yang sama. Status sebelum terbit jelas; hanya CLOSED belum terbit + izin publikasi menawarkan aksi/form di atas detail. Form menunggu CSRF, meminta password/konfirmasi, mencegah submit ganda dan membersihkan password saat batal/gagal. Suite penuh **214/214**, **35 skenario browser**, build produksi, kontrak66contoh dan pemeriksaan dokumen lulus. Enter membuka tab hasil baru sambil mempertahankan dashboard; screenshot desktop/mobile diperiksa. SQL/API asli menguji metadata daftar, izin terkini/CSRF/reauth/state dan publikasi idempoten dengan satu audit. Browser mutasi memakai stub lokal; tidak membuktikan Neon/hosted/Chromebook. Endpoint hasil internal tetap target kontrak untuk T11; kode status publish existing409 untuk reauth/rate masih perlu diselaraskan pada T11. Belum migrasi/cleanup Neon, commit/push atau deploy. Berikutnya T10 upload WebP.

### T10 — Upload WebP

- [x] Terapkan kontrak helper URL + MIME + ukuran hasil dan perbarui semua caller: upload admin dan alumni serta indeks Media. Nama original tetap terpisah dari format tersimpan.
- [x] Normalisasi foto raster statis ke WebP85 di server, auto-orient, resize terkontrol dan tanpa pembesaran. Validasi byte/dimensi/file rusak; jangan menganggap seluruh gambar alpha adalah logo.
- [x] Tetapkan jalur logo lossless yang eksplisit; pertahankan alpha. Dokumen non-gambar tetap utuh. SVG/animasi ditangani secara eksplisit agar tidak diam-diam berubah menjadi raster/frame pertama.
- [x] Pertahankan pembacaan aset lama dan key baru yang unik. Tidak batch-reencode seluruh R2, tidak menambah konversi browser atau pre-generation semua ukuran tanpa bukti perlu.
- [ ] Ukur bytes/encoding/upload keseluruhan, kualitas wajah/teks/alpha, cold start dan miss/hit thumbnail. Bandingkan opsi kualitas 80 sebelum menurunkan default.

**Selesai ketika:** metadata sesuai object R2 dan kedua jalur upload lulus, foto terlihat baik pada ukuran headline, dokumen tidak berubah dan biaya encoding serverless terukur. Rujukan: [kajian WebP](../image-upload-webp-study.md).

Bukti lokal T10: WebP85/auto-orient/40MP, logo lossless, output metadata/UUID key, dokumen byte-identik, validasi signature/bounds, warning indexing, client explicit purpose dan guard delete referensi tersedia. **228/228 tes**, **37 skenario browser**, build, kontrak66contoh dan pemeriksaan dokumen lulus. [Hasil ukur lokal dan batas](../image-upload-webp-study.md#implementasi-t10-dan-bukti-terbaru): foto39–49% lebih kecil dari JPEG85 lama, noise bisa lebih besar; quality80 dibandingkan dan default85 dipertahankan. Tes R2 nyata tidak dapat dimulai karena R2_ENDPOINT/R2_ACCESS_KEY/R2_SECRET_KEY lokal belum tersedia, 0 object dibuat. Encoding/CPU/RSS/cold process lokal dan thumbnail/browser diuji; object R2/end-to-end/cold start/multipart/concurrency Vercel tetap belum terukur. T10 tidak dianggap selesai untuk penerimaan hosted. Berikutnya T11 dapat mengintegrasikan kode lokal sambil menunggu konfigurasi. Tidak mengubah Neon, commit/push atau deploy pada T10.

### T11 — Pengujian gabungan dan dokumentasi final

- [x] Per task menyertakan test perilaku relevan; jangan menunda seluruh pengujian sampai paket akhir. Di sini jalankan perjalanan gabungan dan rekonsiliasi lintas modul.
- [x] Uji periode satu/lima/enam jenis, jenis nonaktif/duplikat, susunan DRAFT dengan roster, snapshot sesudah edit master, calon tidak sah, suara ganda dan request lintas periode.
- [x] Uji tiga sesi/pergantian browser sintetis, expiry, logout, suara terakhir, resume parsial, balapan vote/close dan rollback kegagalan audit.
- [x] Uji tidak hadir/parsial/nol suara/seri, tutup dini, publish terpisah, hasil belum publik, RBAC/CSRF serta payload publik anonim.
- [x] Selesaikan endpoint hasil internal dan selaraskan status HTTP publish INVALID_REAUTH/RATE_LIMITED menjadi401/429 beserta tes/caller/kontrak.
- [x] Uji UI master, popup/confirm-delete, foto, hasil, partisipasi/pagination, keyboard/mobile, upload dan error dengan data sintetis.
- [x] Jalankan validate/generate Prisma, unit/integrasi DB terisolasi, QA browser dan build. Selesaikan panduan admin/operasional serta catat batas performa yang belum terukur.

- [ ] Selesaikan penerimaan T10 object R2/hosting dan verifikasi tiga Chromebook fisik pada environment representatif.

**Selesai ketika:** paket aplikasi + schema dapat dirilis sebagai satu perubahan yang konsisten dan seluruh pemeriksaan wajib lulus. Tidak memakai database Neon produksi sebagai tempat pengujian destruktif.

Bukti lokal T11: endpoint hasil internal, batas state/izin/no-tally, snapshot aman serta401/429/400/413/415 publikasi teruji. **232tes lulus +1penanda DB skipped** pada suite umum; run PostgreSQL17.11 terpisah **6/6** lintas koneksi lulus (4login/3sesi, double-final-vote, dua urutan vote/close, dua urutan logo-attach/delete). **37browser**, Prisma validate/generate, build, kontrak66contoh dan pemeriksaan dokumen lulus. [Rincian dan batas](06-pengujian.md#bukti-dan-gerbang-rilis). Server PG lokal dihentikan; tidak ada mutasi Neon/R2, commit/push atau deploy pada T11. Hosted/R2/runtime-grants/Chromebook tetap belum diverifikasi.

### T12 — Rilis Neon dan verifikasi lingkungan

- [x] Inventarisasi target periode sampel dan hentikan pemakaian pemilihan uji saat maintenance; backup/simpan bukti jumlah master dan data penting sebelum perubahan.
- [x] Bersihkan hanya data pemilihan sampel yang diperlukan melalui migrasi/prosedur terkontrol yang telah teruji. Pertahankan Student, Teacher, kelas/jurusan, akun/izin, CMS/media serta seluruh audit lama dan audit cleanup baru sesuai runbook T01. Izin pembersihan sampel sudah diberikan pengguna; jangan meminta izin yang sama kembali untuk scope tersebut.
- [x] Terapkan migrasi schema dan seed lima master jenis; tidak membuat data siswa/guru dummy. Dilakukan 17 Oktober atas permintaan pengguna setelah T09.
- [ ] Deploy aplikasi yang kompatibel; T10–T11 dan verifikasi hosted belum selesai.
- [ ] Verifikasi master sebelum/sesudah, FK/trigger kembali aktif, lima master, CRUD/konfigurasi dan periode uji baru. Jangan merekayasa suara atau mempublikasikan data uji sebagai hasil resmi.
- [ ] Commit/push paket yang konsisten, verifikasi build/deployment dan lakukan smoke test lingkungan. Sebelum mendorong branch yang memicu auto-deploy, pastikan urutan schema/aplikasi sudah aman; jangan mendorong rilis setengah migrasi.
- [ ] Siapkan rollback schema + aplikasi/restore backup bila perlu. Deploy ulang kode lama saja belum tentu kompatibel dengan schema/snapshot dinamis.

**Selesai ketika:** deployment dan Neon menggunakan versi kompatibel, data master tetap utuh, fitur terverifikasi di lingkungan tujuan dan status pekerjaan dicatat. Eksekusi rilis bukan bagian dari permintaan membuat daftar task ini.

Bukti bagian DB: [catatan migrasi Neon](13-catatan-migrasi-neon.md). Backup public37tabel dipulihkan lokal dengan hash identik, cleanup exact4UUID, master/CMS tetap, audit149→153. Migrasi 20261017090000 tercatat selesai; katalog target dan baca Prisma Neon lulus. Prisma status up to date; tiga arsip historis tetap belum tersedia lokal. T12 tidak ditandai selesai karena deployment/konkurensi/Chromebook/grants belum diverifikasi.

## Urutan dan batas rilis

Jalur utama: **T01 → T02 → T03 → T04 → T05 → T06 → T07 → T08 → T09 → T11 → T12**. T10 dapat dikerjakan setelah kontraknya selesai di T01 dan digabung sebelum T11; statusnya tetap terpisah agar optimasi upload tidak mengaburkan integritas pemilihan.

T02–T09 bukan daftar deployment independen: perubahan enum/relasi dan runtime jenis dinamis harus dirilis dalam satu paket yang konsisten. Tidak ada runtime baru yang masih mengandalkan enum empat organisasi sementara DB sudah berisi lima/enam jenis. Membuat master jenis baru pada aplikasi yang sudah dinamis berikutnya tidak memerlukan migrasi/deploy lagi.

Bagian yang belum diperlukan: penyimpanan original kedua di R2, konversi browser, Redis/queue, framework frontend baru, chart besar, filter gender, riwayat masa jabatan dan migrasi suara sampel ke periode baru.
