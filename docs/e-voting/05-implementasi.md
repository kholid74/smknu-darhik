# Inventaris UI dan rencana implementasi

Status: implementasi berlangsung. Fondasi schema/migration, admin periode/kandidat/roster/PIN, dan master Student sudah diterapkan. Admin dapat menjadwalkan periode DRAFT setelah validasi empat kontes berkandidat lengkap, roster 1–99, PIN aktif, dan empat eligibility per pemilih; perubahan state dan audit atomik. Perpanjangan satu kali menambah 60 menit sebelum tenggat, dengan izin `evoting.perpanjang`, autentikasi ulang, kode alasan, dan audit atomik. Sebelum periode dibuka, roster dapat disinkronkan dari Student master atau pemilih dapat dihapus bila belum memilih. Selama periode berlangsung, koreksi NISN saja diperbolehkan untuk pemilih yang belum memilih, dengan dua akun admin berbeda yang memiliki izin roster/master dan autentikasi ulang; koreksi mencabut PIN/sesi dan perubahan tercatat di audit. PIN baru dapat diterbitkan untuk roster yang dikoreksi sebelum periode berakhir. Sesudah deadline, atau lebih awal setelah seluruh pemilih terdaftar menyelesaikan empat suara, admin berkapabilitas `evoting.tutup` dapat autentikasi ulang, merekonsiliasi ledger/ballot, menyimpan snapshot hasil, mencabut sesi dan mengaudit penutupan dalam satu transaksi. Penutupan lebih awal membutuhkan opt-in eksplisit; validasi roster lengkap dilakukan server sebelum tally, termasuk PIN nonaktif. Jadwal asli dipertahankan, waktu aktual/alasan diaudit, dan publikasi tetap terpisah. Admin `evoting.publikasi` dapat menerbitkan snapshot periode CLOSED dengan autentikasi ulang dan audit atomik; operasi idempoten. Endpoint publik dan halaman `/e-voting/[slug]/hasil` hanya membaca serta menampilkan snapshot tervalidasi setelah periode ditutup dan dipublikasikan. Laporan partisipasi admin menyajikan agregat serta status siswa hanya dengan izin gabungan `evoting.partisipasi` dan `evoting.pemilih`. Periode CLOSED dapat diarsipkan dengan audit atomik dan aksi idempoten. Login NISN+PIN per periode, middleware sesi terbatas, API logout/activity/status, dashboard tanpa PII, dan kartu Coming Soon inert sudah tersedia. Ballot memuat snapshot kandidat, mengirim suara melalui transaksi anonymous ballot + ledger atomik, mengembalikan status umum tanpa kandidat terpilih, dan mencabut sesi pada suara keempat; login/dashboard/progress/vote flow serta layar selesai sudah tersedia. Timer idle browser, smoke test UI dan uji migrasi/cleanup pada PostgreSQL dalam memori sudah tersedia. Pengujian transaksi empat suara menyeluruh masih memerlukan lingkungan integrasi. Semua halaman/API pemilu on-demand.

## Halaman dan komponen

| Path halaman | Pengguna dan isi | Komponen/layout |
| --- | --- | --- |
| `/siswa/masuk` | Login NISN/PIN; query `periode=<slug>` opsional untuk memilih periode yang sedang dibuka, pesan generik; tidak ada daftar/lupa password | `src/pages/siswa/masuk.astro`, form berlabel |
| `/siswa` | Tujuan login parsial/awal; dashboard dengan E-Voting periode sesi dan kartu Coming Soon non-interaktif | `StudentPortalLayout.astro`; guard ELECTION_VOTING dan periode aktif |
| `/siswa/e-voting/[slug]/pilih` | Empat status, lanjut organisasi belum selesai | `src/pages/siswa/e-voting/[slug]/pilih/index.astro`; protected, implemented |
| `/siswa/e-voting/[slug]/pilih/[organization]` | Pasangan dengan snapshot anggota/foto opsional/visi-misi; satu radio; konfirmasi sebelum final | `src/pages/siswa/e-voting/[slug]/pilih/[organization].astro`; protected, implemented |
| `/siswa/selesai` | Layar selesai setelah revokasi, pesan generik tanpa identitas/pilihan, “Pemilih berikutnya” menuju `/siswa/masuk` | `src/pages/siswa/selesai.astro`; netral, dapat dibuka tanpa sesi, implemented |
| `/e-voting/[slug]/hasil` | Hasil terbit per organisasi, persentase dan status seri | Server-rendered snapshot terbit, tidak memerlukan sesi PIN; implemented |
| `/pemilih/masuk` | Kode guru + PIN periode, query periode opsional, link menuju login siswa | VoterLogin bersama; payload login tetap dipisah jenis |
| `/pemilih` | Dashboard guru tanpa kartu layanan pribadi siswa | View bersama Portal Siswa, guard jenis sesi |
| `/pemilih/e-voting/[slug]/pilih` dan `/pemilih/e-voting/[slug]/pilih/[organization]` | Empat organisasi, kandidat/konfirmasi/transaksi bersama | Root route menangani redirect/error; view dipakai bersama |
| `/pemilih/selesai` | Layar netral dan tombol Pemilih berikutnya ke login guru | Tidak memerlukan sesi |
| `/admin/siswa` | Master Student persisten, daftar/cari/create/koreksi eksplisit; tanpa PIN/password, tanpa hard-delete | AdminLayout; `student.kelola`, tidak bergantung periode aktif; implemented |
| `/admin/e-voting` | Daftar periode + buat baru, empat organisasi dibuat otomatis | AdminLayout; implemented |
| `/admin/e-voting/panduan` | Panduan satu halaman: master siswa, periode, calon, sinkronisasi pemilih, cetak PIN, jadwal, pelaksanaan, tutup/publikasi dan kendala umum; tautan dari daftar serta detail periode | AdminLayout; `evoting.lihat`, on-demand; implemented |
| `/admin/e-voting/[id]` | Detail/edit nama, tahun ajaran, jadwal dengan stale guard; jadwalkan DRAFT setelah readiness check; tutup setelah deadline atau seluruh pemilih selesai empat suara (konfirmasi + password); arsipkan CLOSED | AdminLayout; konfigurasi, schedule, close, dan archive implemented |
| `/admin/e-voting/[id]/partisipasi` | Total belum mulai/parsial/lengkap dan partisipasi per organisasi; daftar status roster hanya dengan izin tambahan | `evoting.partisipasi`, daftar juga `evoting.pemilih`; implemented |
| `/admin/e-voting/[id]/calon` | Jumlah pasangan dinamis per organisasi; pilih ketua dan wakil opsional dari Student berbeda melalui pencarian (nama/NISN/kelas), atur posisi, nomor, visi/misi dan foto opsional per anggota | AdminLayout; `evoting.kelola` + `evoting.pemilih`; MediaPicker hanya bila juga punya media.kelola |
| `/admin/e-voting/[id]/pemilih` | Pilih subset siswa dari master tahun ajaran, cari/filter kelas, checkbox/pilih semua, pratinjau nama/jumlah, konfirmasi dan tambahan eksplisit. DRAFT tetap dapat disiapkan jika tanggal lewat; SCHEDULED membeku saat buka. Penghapusan eksplisit; koreksi NISN terkontrol saat berlangsung tetap khusus siswa | AdminLayout; pemilihan butuh `evoting.pemilih`, koreksi juga `student.kelola`; tanpa impor kedua atau penggantian roster otomatis |
| `/admin/e-voting/[id]/pin` | Pilih maksimal 25 target untuk issue/reset, autentikasi ulang, alasan reset, slip print-only | `evoting.pin` + `evoting.pemilih`; implemented |
| `/admin/e-voting/[id]/partisipasi` | Total, parsial/lengkap, status siswa hanya dengan izin tambahan | AdminLayout; tabel, tanpa chart library untuk versi awal |
| `/admin/e-voting/[id]/hasil` | Snapshot setelah close, cetak agregat dan publikasi berizin | AdminLayout; tidak memuat tally lebih awal dalam hidden DOM |

StudentPortalLayout menggunakan stylesheet/warna existing, logo lokal, system-font fallback; tidak membawa navigasi publik, WhatsApp, pengumuman, script analytics, atau editor konten. Layout juga dapat dipakai untuk hasil publik, dengan guard route terpisah; tidak perlu VotingLayout kedua. Radio memakai fieldset/legend, teks kandidat nyata bukan foto saja, label fokus jelas, tombol konfirmasi menyebut finalitas pilihan. Tampilkan organisasi aktif dan progress tanpa mengungkap pilihan lalu. Kesalahan jaringan memakai live region dan tombol cek status; jangan memaksa refresh yang mengirim ulang POST. Mobile/zoom/keyboard wajib dapat dipakai. Dialog konfirmasi mengembalikan focus ke kontrol pemilih ketika dibatalkan.

Kartu Coming Soon berupa elemen non-interaktif (misalnya section/article dengan teks status), bukan link mati atau tombol yang menavigasi. Tidak punya href/handler/tabindex aksi dan tidak mengambil data personal. Dashboard hanya menampilkan periode dan progres, bukan profil/master/nilai siswa. Logout eksplisit, idle warning, no-store, clear on expiry dan revalidasi pageshow berlaku dari dashboard sampai layar ballot. Sesudah suara keempat, revokasi lalu layar selesai; Back tidak boleh memulihkan dashboard bersesi. Tidak membuat route registrasi/password/recovery atau halaman layanan masa depan. Login pemilih belum lengkap selalu menuju dashboard terlebih dahulu, termasuk akses langsung deep link; pemilih lengkap menuju layar selesai tanpa sesi baru. Tidak mengizinkan returnTo arbitrary.

Selector mencari Student master dan menampilkan nama, NISN serta kelas; form hanya mengirim `studentId`, bukan nama/kelas. Form meminta satu CHAIR dan VICE_CHAIR opsional (boleh null) dan menolak studentId sama atau sudah ditugaskan dalam organisasi/periode. Server membuat snapshot nama/kelas dari master. Foto individual opsional dapat memakai MediaPicker/R2 sekolah yang memang publik, tanpa upload roster/PIN. Panitia tanpa `media.kelola` memakai foto yang sudah disediakan atau tanpa foto; jangan memberi akses media hanya karena memiliki `evoting.kelola`. Visi/misi plain text, bukan Tiptap HTML.

## Perubahan file existing

| File | Perubahan yang diperlukan dan pemanggil terdampak |
| --- | --- |
| `prisma/schema.prisma` | Tambahkan Student persisten, studentId pada ElectionVoter, scope sesi ELECTION_VOTING dan fingerprint PIN unik per periode, model/enum lain serta relasi balik Account |
| `prisma/migrations/<timestamp>_e_voting/migration.sql` | Additive DDL + CHECK/partial index/trigger/grants terverifikasi; tidak edit migrasi sebelumnya |
| `prisma.config.ts` | Pastikan URL migration credential eksplisit dan tidak fallback localhost di deployment; pisahkan runtime vs migrator lewat environment job, tidak print URL |
| `src/lib/prisma.ts` | Pertahankan Neon; buktikan transaksi dan pool/timeouts; hilangkan `any` yang menghalangi tipe model/service baru secara minimal, jangan ganti adapter tanpa bukti |
| `src/lib/env.ts` | Tambah secret PIN/CSRF/rate dan switch operasional pemilu server-only; validasi hanya ketika fitur dipakai agar halaman publik tidak gagal akibat konfigurasi pemilu belum ada |
| `src/lib/rbac.ts` | Kapabilitas pemilu dan `student.kelola` untuk master, tanpa grant otomatis staf/guru/siswa; sesi PIN tidak mendapat principal internal; engine can tetap |
| `src/lib/rbac.test.ts` | Default deny pemilu, explicit grant, revoke mengalahkan wildcard termasuk superadmin |
| `src/lib/auth.ts` | Secure cookie admin dan kontrak token internal (issuer/audience/kind), helper reauth akun aktif; audit semua caller `signToken`, `verifyToken`, `authCookie`, `getSession` sebelum edit |
| `src/lib/alumni-auth.ts` | Hanya jika pengetatan kontrak token memerlukan penyesuaian: audience/kind terpisah, tes regresi; jangan pakai sesi alumni untuk siswa |
| `src/middleware.ts` | Allowlist `/siswa` dan `/api/siswa/dashboard` + API vote, scope/time guard; pengecualian eksplisit login/selesai/logout/hasil publik. Guard `/admin/siswa`/`/api/admin/students` dan admin pemilu; layanan masa depan default deny |
| `src/env.d.ts` | Typed locals `votingSession` berisi scope ELECTION_VOTING, voterId, studentId, periodId; tidak membuat boolean generic studentAuthenticated atau menyimpan PIN/pilihan |
| `src/layouts/AdminLayout.astro` | Menu E-Voting tersaring can, tidak mengubah menu existing atau menampilkan tally di dashboard utama |
| `src/pages/admin/login.astro`, `src/pages/admin/logout.astro` | Rate limit admin, CSRF login/logout, Secure cookie; jika logout menjadi POST, ubah pemanggil link/modal di AdminLayout juga |
| `src/pages/admin/pengguna/[id].astro`, `src/pages/admin/pengguna/delete.astro` | CSRF + audit perubahan role/override/aktif yang memengaruhi panitia; account/role/override/audit yang satu operasi harus atomik; capability hints; pastikan account deletion/audit FK tidak bertentangan |
| `src/pages/admin/pengguna/index.astro` | Sesuaikan form delete/CSRF jika caller mengirim mutasi akun; tidak cukup hanya mengubah endpoint |
| `astro.config.mjs` | Review pengaktifan kembali checkOrigin dan regression seluruh form; custom CSRF/origin guards tetap diperlukan sesuai kontrak |
| `src/pages/admin/artikel/[id].astro`, `src/pages/admin/usulan/[id].astro`, `src/pages/admin/artikel/review.astro` | Telusuri semua penulis HTML artikel; sanitasi allowlist sebelum publish dan migrasi/sanitasi konten existing sesuai hasil audit XSS |
| `src/pages/berita/[slug].astro`, `src/pages/admin/faq/[id].astro`, `src/pages/faq.astro` | Tutup jalur render HTML tak aman; FAQ pilih text rendering bila HTML tidak diperlukan. Tes regresi konten lama |
| `package.json`, `package-lock.json` | Pin tsx sebagai dev dependency, script unit/integration deterministik. Sanitizer yang teruji hanya bila mempertahankan rich HTML membutuhkannya; bukan regex sanitizer buatan |

Perubahan hardening perlu menelusuri seluruh caller aktual saat implementasi. Daftar ini menamai jalur yang sudah teridentifikasi, bukan klaim semua jalur XSS/account sudah diaudit tuntas. Pengaktifan checkOrigin global harus memeriksa juga form alumni dan API upload agar tidak mematahkan fitur lama. Token kontrak baru boleh memaksa login ulang admin; koordinasikan deploy, jangan menerbitkan secret fallback demi kompatibilitas.

## File service dan test baru

| File | Tanggung jawab |
| --- | --- |
| `src/lib/voting/elections.ts`, `candidates.ts` | Validasi periode/roster/lifecycle dan kandidat Student-linked dengan snapshot/audit atomik |
| `src/lib/voting/voters.ts`, `master-roster.ts` | Roster listing, preview dan sinkronisasi master per tahun ajaran, batas <100, snapshot dan audit satu transaksi |
| `src/lib/students.ts`, `students-input.ts` | Master Student admin-only, validasi NISN/create/koreksi/audit; tanpa PIN/password. Data siswa diimpor satu kali ke master, lalu dipakai roster periode |
| `src/lib/students.test.ts` | Validasi NISN, batas field, dan snapshot optimistic edit |
| `src/lib/voting/pins.ts`, `pin-input.ts`, `pin-slips.ts` | PIN acak 10 digit, HMAC pepper/fingerprint, bcrypt, reauth/rate-limit, optimistic lock, audit/revoke dan HTML no-store |
| `src/lib/voting/student-auth.ts`, `student-session.ts`, `src/pages/api/e-voting/[periodId]/session.ts` | Login per periode, revalidasi lock saat membuat sesi, token hash dan cookie scoped; helper policy guard |
| `src/middleware.ts`, `src/env.d.ts` | Guard sesi hashed-token, credential, expiry, periode aktif, completion, dan allowlist scope untuk route siswa |
| `src/lib/voting/student-session-actions.ts`, `src/pages/api/e-voting/[periodId]/activity.ts`, `src/pages/api/e-voting/logout.ts` | Perpanjangan idle eksplisit dan logout/revokasi dengan lock order periode → voter → sesi |
| `src/lib/voting/votes.ts`, `ballot-pages.ts`, `student-status.ts`, `vote-input.ts` | Submit anonim dalam transaksi, render kandidat/progress dari snapshot, validasi scope dan respons status tanpa pilihan |
| `src/lib/voting/security.ts`, `admin-http.ts` | Origin, CSRF HMAC pre-auth/admin, body limit, respons aman; limiter durable memakai `VotingRateBucket` |
| `src/lib/voting/elections.test.ts`, `auth.test.ts`, `security.test.ts`, `candidates.test.ts` | Fungsi murni/state/input/token; colocated dengan pola existing |
| `tests/e-voting.integration.test.ts` | Database PostgreSQL disposable, transaksi/concurrency/constraint/reconciliation; script terpisah unit |
| `tests/e-voting.http.test.ts` | Cookie/CSRF/RBAC/body limits/route leakage menggunakan server staging lokal |
| `tests/fixtures/e-voting.ts` | Data sintetis empat organisasi, minimal dua siswa dan dua periode, candidates lintas scope; tidak seed produksi |
| `src/layouts/StudentPortalLayout.astro`, `src/pages/siswa/index.astro`, `src/pages/api/siswa/dashboard.ts` | Shell dashboard siswa, ringkasan partisipasi tanpa PII, tindakan logout/perpanjangan eksplisit |
| `src/lib/voting/student-dashboard.ts`, `student-dashboard-model.ts` | Baca dashboard terscope periode dan bentuk allowlist layanan/status partisipasi |
| `src/components/voting/StudentServiceCards.astro` | Satu kartu E-Voting periode aktif dan kartu Coming Soon tanpa aksi/data personal |
| `src/components/voting/StudentCandidatePicker.astro` | Pencarian Student master dengan tampilan nama/NISN/kelas; hanya mengirim studentId |
| `src/components/voting/VotingProgress.astro`, `CandidatePairCard.astro`, `src/lib/voting/pin-slips.ts` | Komponen kecil yang benar-benar dipakai lintas halaman |

Jangan membuat generic repository/service framework baru, package bersama, atau exporter sebelum ada kebutuhan. Fungsi audit dapat tetap lokal di elections/auth; ekstraksi helper hanya jika implementasi benar-benar berulang.

## File route baru

Halaman pada tabel UI dipetakan satu-satu di `src/pages` dengan `.astro` (root folder memakai `index.astro`). Dynamic parameter halaman siswa `[slug]`, halaman admin `[id]`. Seluruh handler JSON di bawah memakai `.ts` dengan export method `APIRoute`, sesuai kontrak [API](04-api.md):

```text
src/pages/api/siswa/dashboard.ts GET (scope ELECTION_VOTING)
src/pages/api/admin/students/index.ts GET, POST
src/pages/api/admin/students/[studentId].ts PATCH
src/pages/api/e-voting/
  logout.ts
  [periodId]/session.ts          GET, POST
  [periodId]/status.ts           GET
  [periodId]/activity.ts         POST
  [periodId]/votes.ts            POST
  [periodId]/results.ts          GET
src/pages/api/admin/e-voting/
  periods.ts                    GET, POST
  [periodId]/index.ts            GET, PATCH
  [periodId]/students/search.ts GET (Student master, evoting.pemilih)
src/pages/api/admin/students/
  index.ts                      GET, POST
  [studentId].ts                PATCH
  [periodId]/candidates/index.ts POST
  [periodId]/candidates/[candidateId].ts PATCH, DELETE
  [periodId]/voters/index.ts     GET, POST
  [periodId]/voters/master-preview.ts GET
  [periodId]/voters/[voterId].ts  PATCH, DELETE
  [periodId]/credentials.ts      POST
  [periodId]/pins.ts             POST (HTML)
  [periodId]/extend.ts           POST (sekali, maksimal 60 menit)
  [periodId]/schedule.ts         POST
  [periodId]/archive.ts          POST
  [periodId]/participation/index.ts GET
  [periodId]/participation/voters.ts GET
  [periodId]/close.ts            POST
  [periodId]/results.ts          GET
  [periodId]/publish.ts          POST
```

Jangan menggandakan mutasi di frontmatter dan API; frontmatter hanya adaptor layanan yang sama bila HTML form dipilih. Semua edge slash/path encoded/method tetap diperiksa pada suite HTTP.

## Urutan pekerjaan dan dependensi

Pembaruan 16 Oktober 2026: persetujuan implementasi sudah diberikan; daftar T0–T9 berikut adalah urutan rencana awal, bukan permintaan persetujuan ulang. Implementasi guru mengikuti [keputusan final](09-usulan-pemilih-guru.md), dengan master Teacher dan sesi voting terpisah dari Account.

| ID | Pekerjaan | Bergantung pada | Bukti selesai |
| --- | --- | --- | --- |
| T0 | Bekukan keputusan autentikasi dan operasional yang disepakati pada README/ADR 0002 | Izin implementasi terpisah, belum diberikan | Rencana siap ditinjau; tidak mengubah keputusan MVP |
| T1 | Baseline reproducible; install terkunci, runner test, hardening admin/origin/XSS relevan | T0 | Test existing dan regresi realm/form lulus; kredensial demo tidak aktif di produksi |
| T2 | Student master independen + proposal pemilu menjadi migration additive, fixture dan constraints Neon | T0, T1 | validate/generate, fresh migration/upgrade clone, unique PIN/roster, scope sesi dan grants runtime teruji |
| T3 | Service vote atomik + schedule/close lock, concurrency/reconciliation tests | T2 | Double submit, failure injection, deadline/close race lulus sebelum UI vote |
| T4 | Sesi, CSRF, durable limiter, PIN issue/reset/print | T2 | Login/reset/rate race, no plaintext, print hilang, expiry lulus |
| T5 | Admin periode/calon/roster/PIN + navigasi capability | T3, T4 | Roster/slate freeze saat dibuka, extension limit dan scoped access lulus, gladi cetak |
| T6 | Portal Siswa: login → dashboard → E-Voting; Coming Soon inert; progress/confirm/reconnect/logout/selesai | T3, T4 | Scope/time guard, tidak ada akses akademik, empat suara mencabut sesi, parsial lanjut via dashboard, Chromebook aman |
| T7 | Partisipasi/close/snapshot/publikasi/arsip | T3, T5 | Tidak ada tally sebelum CLOSED, publikasi gate, total rekonsiliasi benar |
| T8 | Uji beban, browser manual, restore, deployment rehearsal | T1–T7 | Seluruh acceptance pada dokumen tes dan checklist operasional disahkan |
| T9 | Deploy additive terkontrol dan pemilihan nyata | T8 | Checklist go/no-go; izin deploy saat akan dilaksanakan |

Operasional pemilihan menetapkan tiga Chromebook bersama dan maksimal tiga sesi pemilih aktif bersamaan; profil beban staging mengikuti tiga perangkat itu, sementara kapasitas Vercel/Neon tetap perlu diverifikasi. Implementasi bertahap tetap harus selesai sampai kontrol keamanan dan uji integritas lulus; jangan membuka fitur siswa setelah T6 bila T7/T8 belum selesai.

## Implementasi cleanup sampel ? 15 Oktober 2026

Komponen TestPeriodCleanup pada konfigurasi periode uji memakai dua dialog native: ringkasan lalu konfirmasi HAPUS <slug> dan password. API test-cleanup menggunakan limiter/reauthentication admin yang sama, gate superadmin, CSRF dan versi snapshot. Stored function menjalankan cleanup atomik tanpa menonaktifkan trigger umum. Semua migrasi dan perilaku cleanup diuji pada PGlite; browser menggunakan respons API sintetis. [Panduan penggunaan](08-pembersihan-data-uji.md).

## Implementasi pemilih guru

Revisi berikutnya memperbaiki DRAFT dengan jadwal lewat dan menambah tabel pilihan siswa eksplisit, jumlah terpilih, cari/filter kelas, pilih semua serta preview/konfirmasi. Payload siswa kini `{studentIds:[...]}`, tanpa bulk implicit. Ketika terkunci, alasan ditampilkan. Rincian [pemilih dan DRAFT](10-daftar-pemilih-dan-draft.md).

Kelola Pemilih menambahkan tabel master Teacher dengan pencarian dan pilihan eksplisit, pratinjau nama/jumlah gabungan, popup konfirmasi dan POST voters/teachers. Perubahan pilihan membatalkan pratinjau. Daftar terdaftar, PIN dan partisipasi memakai label NISN / kode guru serta Kelas / kelompok. Sync/koreksi NISN hanya siswa. Sebelum buka guru dapat dihapus dari roster lalu ditambahkan ulang untuk memperbaiki snapshot, tanpa menghapus master.

Model/identity/auth/PIN/middleware/dashboard dan hasil memakai kedua jenis. Portal guru dan siswa berbagi view/layanan vote; tidak ada implementasi transaksi kedua atau hak admin dari PIN. Header no-store, timer, logout dan revalidasi browser mengikuti portal sesi. Guru master yang masih direferensikan tidak dapat dihapus dan mendapat pesan jelas. Rincian [keputusan, API dan rollout](09-usulan-pemilih-guru.md).
