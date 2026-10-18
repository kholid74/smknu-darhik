# Desain teknis — target jenis pemilihan dinamis

**Pembaruan T11, 18 Oktober:** endpoint hasil internal dan status publikasi401/429 diterapkan. Regresi232tes lulus (satu penanda tes DB dilewati dan dijalankan terpisah), PostgreSQL lokal lintas koneksi6/6, browser37skenario, Prisma validate/generate dan build lulus. Penerimaan R2/Vercel/perangkat tetap belum selesai. [Bukti T11](06-pengujian.md#bukti-dan-gerbang-rilis).

**Pembaruan upload 18 Oktober:** T10 sudah diimplementasikan dan diuji lokal (228 tes, 37 skenario browser, build lulus). Verifikasi object R2/hosted belum selesai karena konfigurasi R2 lokal belum tersedia. [Bukti dan batas](../image-upload-webp-study.md#implementasi-t10-dan-bukti-terbaru).

**Pembaruan Neon 17 Oktober 2026:** migrasi schema dan cleanup empat periode yang disetujui sudah berhasil setelah backup teruji. Master dan audit lama tetap; deployment belum dilakukan. [Catatan pelaksanaan](13-catatan-migrasi-neon.md).

Status: **T01–T09 selesai dan diuji lokal 17 Oktober; form mode/foto calon, penutupan tanpa turnout penuh dan hasil publik berfoto/infografis selesai; CTA dashboard selesai; upload dan rilis masih T10–T12.** Hak pilih, portal, sesi, transaksi dan snapshot v2 sudah dinamis. [ADR 0003](adr/0003-jenis-pemilihan-dinamis.md), [schema](03-schema.md), [OpenAPI](contracts/e-voting-v2.openapi.json). Migrasi Neon sudah diterapkan; deployment aplikasi belum.

## Integrasi dan invariant yang dipertahankan

Astro on-demand + Vercel, Prisma 7.9 dari lockfile dan PostgreSQL/Neon tetap. Service transaksi ada di `src/lib/voting`; HTTP/form memanggil service yang sama, bukan HTTP internal. SQL lock berparameter; transaksi singkat tanpa R2/email/Sharp di dalamnya. Tidak ada framework, Redis, queue, akun siswa permanen atau offline ballot queue baru.

Student master persisten terpisah dari ElectionVoter/PIN/sesi. Teacher dipilih terpisah tanpa NISN buatan. Semua pemilih terdaftar menerima satu hak pada setiap contest periode dengan bobot sama; tidak ada pembagian berdasarkan gender atau siswa/guru. Batas gabungan 99 tetap. Ballot anonim tanpa relasi pemilih, sementara participation tidak menyimpan calon. [Batas kepercayaan operator](adr/0001-integrasi-dan-batas-kerahasiaan.md) tetap: model ini tidak membuktikan anonimitas terhadap DB owner/WAL.

## Jenis, snapshot dan edit serentak

`ElectionType.code` unik/immutable; `organization` pada API/DB menjadi kode master varchar. Jenis baru tidak membutuhkan enum/deploy. Tiap periode wajib memilih 1–20 kode eksplisit; default UI menawarkan OSIS, PRADANA_PUTRA, PRADANA_PUTRI, IPNU, IPPNU, tidak otomatis seluruh master aktif. API tidak mengisi daftar yang hilang dengan default diam-diam.

Snapshot nama/logo/mode/jabatan diambil sekali saat jenis ditambahkan, oleh server dari row master yang terkunci. Snapshot tidak berubah oleh edit/deaktivasi master maupun reorder. Retained contest mempertahankan snapshot dan calon/hak yang ada. Tidak ada endpoint auto-refresh snapshot pada paket ini. Master baru/nonaktif tidak otomatis menambah/mengurangi hak periode.

Mutasi master menggunakan `revision`, mutasi susunan memakai `ElectionPeriod.contestsRevision`; integer awal 0. Expected revision wajib pada update/delete/replace. Update sukses yang mengubah nilai menaikkan revision satu dan audit atomik; no-op dengan revision cocok tidak menaikkan revision/audit. Revision stale selalu 409, termasuk no-op. DELETE yang diulang pada resource yang sudah hilang menghasilkan 404, tanpa efek tambahan.

`PUT /periodId/contests` mengganti daftar terurut dalam satu transaksi: lock periode FOR UPDATE, cek DRAFT dan expectedRevision, lock seluruh master yang diperlukan dalam urutan code sebelum mutasi child. Jenis baru harus aktif. Retained nonaktif masih boleh dipertahankan/reorder; inactive tidak dapat ditambahkan baru. Snapshot retained tidak dibaca ulang dari master. Pelepasan jenis berisi calon ditolak; pelepasan dengan participation true/ballot adalah konflik integritas. Hak false pada jenis dilepas dihapus, hak false untuk jenis baru dibuat untuk setiap roster existing. PIN/snapshot identitas tidak berubah; semua perubahan dan audit commit bersama. Tidak ada pemasangan jenis ke periode terjadwal.

Master update/delete hanya mengunci row master dan menulis audit periodId=null, tidak mengunci/mengubah seluruh periode pemakainya. Delete ditolak FK jika pernah dipakai; nonaktifkan sebagai pengganti. File foto/logo yang masih direferensikan metadata periode/anggota/snapshot hasil tidak boleh dihapus melalui alur media aplikasi.

## Lifecycle dan kesiapan

| Kondisi | Perilaku |
| --- | --- |
| DRAFT, walau tanggal awal lewat | Jadwal/slate/roster/PIN/susunan jenis dapat disiapkan; tidak menerima login/suara |
| SCHEDULED sebelum opensAt | Susunan/snapshot jenis tetap; calon dan roster masih dapat dilengkapi sebelum buka, PIN boleh diterbitkan/reset |
| SCHEDULED dalam opensAt ≤ now < closesAt | Login/vote; slate dan roster beku, partisipasi saja bagi monitor |
| SCHEDULED sesudah deadline | Tidak menerima suara; menunggu penutupan resmi, tally publik tetap tertutup |
| CLOSED | Snapshot immutable, publikasi terpisah, tidak dapat dibuka kembali |
| ARCHIVED | Read-only; hasil publik hanya jika pernah diterbitkan |

Schedule mengunci advisory lock yang sudah ada lalu periode FOR UPDATE; waktu DB dibaca sesudah lock. Wajib jadwal valid/mulai masa depan, 1–20 contest unik dengan urutan 1..N, minimal satu calon valid masing-masing, roster 1–99, setiap voter mempunyai tepat himpunan N participation false yang sesuai dan PIN awal aktif. Minimum satu calon dan komposisi diperiksa kembali setelah perubahan slate; tidak membuat wakil kosong. Satu periode SCHEDULED pada satu waktu tetap ditegakkan index parsial.

Nomor ballot unik per contest, Student tidak ganda dalam contest/periode, nama/kelas disalin server saat pendaftaran anggota. SINGLE tidak menerima VICE_CHAIR; OPTIONAL_VICE menerima nol/satu wakil Student berbeda. Setelah opensAt seluruh mutasi calon ditolak termasuk race. Master Student berubah tidak mengubah snapshot historis.

Perpanjangan tetap satu kali maksimum 60 menit dengan alasan, password dan audit; tidak mengubah susunan jenis atau menghidupkan periode CLOSED. Jadwal asli closesAt tetap saat tutup dini; closedAt menyimpan waktu aktual. Saksi dua orang/pemisahan pengelola PIN tetap prosedural; superadmin bukan bukti dua petugas hadir.

## Otorisasi dan media

Semua panitia perlu `evoting.lihat` plus kapabilitas tindakan. Master/susunan jenis: `evoting.kelola`. Calon: kelola+pemilih; roster: pemilih; PIN: pin+pemilih; close: tutup; hasil internal: hasil; publish: publikasi. Menjalankan CRUD jenis tidak memberi `media.kelola`; pemilih logo dapat memilih aset existing yang memang boleh dibaca atau tanpa logo. Hak upload tetap terpisah. Realm siswa/guru/alumni/internal tidak saling menggantikan.

Nama/visi/misi plain text dan output escaped; URL foto/logo harus menunjuk pustaka Media berjenis image dari base sekolah/R2 yang diizinkan, maksimum 1024. Tidak menerima URL arbitrary, data/javascript URL, nama/kelas calon bebas, pinHash atau actorId dari request. Pemilihan media bukan izin mempublikasikan roster/PIN.

## Sesi dan Chromebook

PIN sepuluh digit dibuat CSPRNG, bcrypt + pepper domain terpisah dan fingerprint HMAC unik per periode; plaintext hanya pada slip cetak satu kali, maksimum 25 per batch. Issue/reset memerlukan password caller, limiter dan audit; reset mencabut sesi dan PIN lama, tidak mengubah suara. Siswa/guru parsial memakai PIN valid yang sama untuk resume. Tidak ada reset mandiri atau permanent Account baru.

Token sesi acak 32 byte disimpan hash, satu sesi per voter dan maksimal tiga sesi pemilih global aktif. Login bersamaan memakai advisory lock existing; cek ulang kredensial/waktu/scope setelah lock. Idle lima menit, absolut 15 menit atau closesAt; aktivitas eksplisit memperpanjang idle, polling tidak. Lengkap hanya jika N≥1 dan tepat himpunan participation contest periode semuanya true. Hak hilang/ekstra tidak disamarkan sebagai selesai; tolak sebagai RECONCILIATION_FAILED dan tidak beri akses voting sampai diperbaiki.

Siswa baru/parsial menuju `/siswa`, guru `/pemilih`; yang lengkap menuju layar selesai generik tanpa sesi baru. PIN scope ELECTION_VOTING tidak membuka profil/nilai/admin/layanan masa depan. Coming Soon tanpa aksi/href/fetch. Guard memeriksa periode/scope/realm/credential/time pada dashboard, deep link, status dan vote.

Cookie voting produksi __Host, HttpOnly, Secure, Path=/, SameSite=Strict; nama dev terpisah. Semua HTML/API/print pemilu termasuk hasil menggunakan private, no-store sesuai middleware sekarang; no-referrer, noindex untuk area sesi, nosniff dan framing DENY untuk portal. Tidak menyimpan identitas/pilihan pada localStorage/IndexedDB/service worker. Logout, expiry, suara terakhir dan pageshow/back membersihkan/revalidasi UI. Guest/kiosk Chromebook dan penonaktifan penyimpanan password tetap prosedur perangkat. [OWASP sesi](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

## Transaksi vote dan rekap

1. Validasi JSON/CSRF/rate limit. Voter berasal dari sesi, period dari route harus sama. Masuk ReadCommitted transaction, maxWait awal 2s/timeout 5s untuk dikalibrasi.
2. Lock periode FOR SHARE → voter FOR UPDATE → sesi; baca waktu DB setelah lock. Semua login/reset/activity/logout mengikuti urutan periode → voter → sesi. Tiga pemilih berbeda tidak diserialisasi lewat UPDATE periode.
3. Validasi SCHEDULED dalam jendela waktu, credential/session aktif, candidate dan contest cocok, serta himpunan hak tepat. Jangan mengandalkan urutan browser atau master.active untuk mencabut hak yang telah dipasang.
4. Conditional update satu participation false→true; bila sudah true tolak ALREADY_VOTED. Insert satu Ballot UUIDv4 tanpa timestamp/receipt/identitas. Insert gagal harus me-rollback participation.
5. Baca N status sesuai urutan contest periode. Jika seluruhnya true cabut sesi, jika belum perpanjang idle terikat absolut/deadline. Commit sebelum response, tanpa candidateId atau ballotId.

Timeout dengan commit tidak diketahui: revalidasi status/login ulang, bukan retry buta. Duplikasi tidak mengungkap calon tersimpan. Retry hanya untuk deadlock/konflik yang diketahui rollback, terbatas dan dengan jitter; transaksi mutation tidak diulang karena response hilang. Tidak ada audit per vote yang menghubungkan siswa/waktu/calon.

Rekap memakai satu read snapshot RepeatableRead: N dari contest, tiap voter tepat N hak, complete bila k=N, partial bila 0<k<N, notStarted bila k=0. Untuk N=1 partial wajib nol. Denominator mencakup PIN nonaktif. Detail voter butuh partisipasi+pemilih; tanpa izin pemilih hanya agregat. Tidak menampilkan kandidat/waktu suara atau breakdown siswa/guru.

## Close, hasil dan publikasi

Reauth/limiter sebelum transaksi singkat. Lock periode FOR UPDATE menunggu vote yang sudah memegang FOR SHARE, lalu baca waktu DB. Wajib SCHEDULED dan now≥opensAt; bila now<closesAt wajib early=true dan reason trimmed 10–500. Input early=true selalu mewajibkan reason, termasuk jika request tiba sesudah deadline. Tidak perlu semua voter lengkap. Roster kosong, himpunan hak tidak cocok atau ledger/ballot mismatch tetap ditolak; nol ballot dengan roster sah boleh.

Hitung semua kandidat termasuk nol, cocokkan per contest: sum candidate votes = Ballot count = participation true ≤ eligible. Buat snapshot v2 sekali, set CLOSED/closedAt, cabut semua sesi periode dan insert PERIOD_CLOSED bersama detail agregat. reasonCode COMMITTEE_EARLY_CLOSE atau DEADLINE_REACHED; detail menyimpan alasan aman, jadwal asli, waktu aktual dan agregat. Kegagalan audit/snapshot membatalkan semua. CLOSED/ARCHIVED yang di-close lagi mengembalikan state/waktu tanpa tally/audit baru. Tidak menghapus pemilih absen, membentuk abstain ballot atau menghilangkan suara parsial.

Publish hanya CLOSED dengan `evoting.publikasi`, password, CSRF dan audit; idempoten bila sudah terbit. Archive boleh setelah CLOSED, tetapi publikasi baru dilakukan sebelum archive. Hasil internal baru tersedia sesudah CLOSED/ARCHIVED dengan izin hasil; publik harus publishedAt. Sebelum gate, endpoint tidak membaca/menghitung tally. snapshot immutable termasuk foto/logo; render berbasis snapshot, bukan Student/ElectionType terkini. Seri/nol tidak menetapkan pemenang; hanya Perolehan tertinggi. [Snapshot v2](03-schema.md#snapshot-hasil-versi-2).

## Batas keamanan dan operasional

Origin/CSRF, permission revoke dari DB, limiter durable Postgres, reauth caller dan body limits tetap. Jangan log body login/vote, NISN/PIN/token/password atau SQL parameter yang mengkorelasikan pemilih. Rate bucket satu menit vote/activity 60; login lima percobaan/15 menit namespace terpisah guru/siswa; admin reauth lima/15 menit; cetak lima batch/15 menit. Penyetelan pool/index berdasarkan pengukuran, bukan menambahkan cache status.

Runtime role idealnya nonowner dengan grants terbatas; repo/hosting harus diverifikasi, bukan diasumsikan sudah demikian. Ballot UPDATE/DELETE/TRUNCATE dan audit UPDATE/DELETE dilarang runtime. Cleanup uji yang sudah ada tetap ketat; pembersihan sampel migrasi hanya migrator offline dengan manifest dan scope exact. [Operasional](07-operasional.md), [pengujian](06-pengujian.md). Tidak mengubah migrasi historis atau menjalankan seed dummy pada Neon.
