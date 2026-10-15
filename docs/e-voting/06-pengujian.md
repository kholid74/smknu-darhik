# Strategi pengujian dan kriteria penerimaan

Status: rencana test, **bukan laporan test yang sudah lulus**. Tidak ada dependency lokal pada audit ini; test/build/browser/database tidak dijalankan. Gunakan `node:test` + `node:assert/strict` yang sudah menjadi pola repo; unit test saja tidak membuktikan transaksi benar.

## Lingkungan dan fixture

Pin `tsx` di devDependencies saat implementasi. Pisahkan `npm test` untuk unit dari `test:integration` dan `test:http`, agar unit tidak memerlukan secret/database. Gunakan PostgreSQL disposable dengan versi mayor yang sesuai produksi; jangan mengganti concurrency test dengan SQLite atau mock Prisma. Ulangi suite transaksi kritis pada Neon staging melalui **PrismaNeon yang sama dengan runtime**, tidak hanya PrismaPg.

Fixture deterministik/sintetis: dua periode (tahun berbeda), empat organisasi tiap periode, dua kandidat per organisasi, tiga siswa termasuk NISN berawalan nol, akun internal superadmin/staf/guru/siswa, grant dan revoke khusus, serta alumni session. Satu kontes tambahan pada fixture terpisah menguji calon tunggal/hasil nol. Tidak ada NISN asli, PIN aktif atau salinan produksi dalam repo/log CI.

Tambahkan master Student tanpa roster, satu Student yang direferensikan dua periode dengan PIN berbeda, dan sesi yang scope-nya tidak cocok untuk uji guard. PIN unik di dalam periode diuji dengan RNG test yang sengaja menghasilkan collision; tidak memakai random chance sebagai bukti. Fixture tidak membuat akun/password permanen siswa atau endpoint akademik dummy.

Integration setup wajib menolak connection string di luar database test yang ditentukan, bukan menjalankan truncate terhadap `DATABASE_URL` umum. Cleanup hanya database/schema test khusus. Fixture rollback terpisah tidak boleh membatalkan bukti concurrency sebelum assertion pada koneksi independen. Jangan mengganti jam mesin produksi; test boundary memakai waktu/fixture terkontrol dan sinkronisasi lock/barrier.

## Matriks kasus wajib

| ID | Skenario dan cara | Assertion |
| --- | --- | --- |
| V01 | 20 request paralel voter/org sama, setengah memilih calon A, setengah B; koneksi DB independen dan barrier sebelum conditional update | Tepat satu commit; satu participation true; satu ballot. Semua lain konflik, tidak ada ballot kedua |
| V02 | Dua organisasi voter sama dikirim bersamaan | Dua suara sah, organisasi lain belum terisi; tidak deadlock permanen |
| V03 | Banyak siswa berbeda memilih organisasi sama | Masing-masing satu ballot, tidak serialized melalui update periode; total sesuai ledger |
| V04 | Kandidat organisasi/periode lain, UUID invalid, voterId buatan di body | 400/scope denied, tidak ada perubahan dua tabel |
| V05 | Inject kegagalan sesudah participation update sebelum ballot insert | Seluruh transaksi rollback: false dan nol ballot |
| V06 | Inject kegagalan setelah insert sebelum commit; timeout request setelah commit | Precommit rollback; postcommit status tetap true. Retry tidak menambah suara |
| V07 | Menyelesaikan dua organisasi, putus koneksi, login ulang | Status dua selesai, dua belum; tidak ada candidate choice yang dikembalikan |
| V08 | Suara keempat sukses tetapi response hilang | Sesi dicabut; login ulang menyatakan selesai generik tanpa sesi baru atau suara baru |
| V09 | Ulangi submit organisasi terisi dengan candidateId berbeda | `ALREADY_VOTED`, pilihan lama tidak berubah dan tidak terungkap |
| V10 | PIN reset/disable/login kedua berlomba dengan vote | Lock menentukan urutan: commit sah sebelum revoke atau vote ditolak sesudahnya; status tidak pernah di-reset |
| V11 | Waktu tepat opensAt dan closesAt; request menunggu lock melewati deadline | opensAt diterima; closesAt ditolak; cek clock setelah lock, bukan jam request/browser |
| V12 | Vote lolos sebelum deadline, close mengambil exclusive lock sesudah deadline | Close menunggu vote commit, snapshot menyertakannya; tidak ada vote commit yang hilang dari snapshot |
| V13 | Close paralel dua panitia, atau close diulang | Satu snapshot immutable, audit transisi satu kali, pemanggilan ulang aman |
| V14 | Ubah manual fixture agar ledger/ballot tidak seimbang | Close gagal dan hasil tetap tersembunyi; tidak auto-repair suara |
| V15 | Insert ballot candidate lintas scope, participation lintas periode, true → false, UPDATE/DELETE ballot sebagai runtime role | FK/trigger/privilege menolak; tes benar-benar memakai role runtime non-owner |
| V16 | Tahun berikutnya memakai Student/NISN sama, PIN periode berbeda | Master direuse, kredensial baru terpisah, PIN/sesi periode lama tidak diterima pada periode baru; empat hak baru, data lama tidak berubah |
| V17 | Dua panitia schedule periode berbeda serentak | Partial unique index menjamin hanya satu SCHEDULED |
| V18 | Edit roster/calon dan pembukaan periode bersamaan | Lock menentukan urutan; semua perubahan sebelum buka tercakup, sesudah buka ditolak tanpa snapshot parsial |
| V19 | Reader dashboard di tengah sejumlah transaksi | Snapshot ringkasan konsisten (gunakan satu query atau transaksi read snapshot); tidak ada total campuran |
| V20 | Perpanjang sekali, 60 menit, dua kali, setelah close, atau akses tanpa `evoting.perpanjang` | Satu perpanjangan maksimal 60 menit; request kedua/close ditolak; audit aktor/alasan tercatat. Saksi dan pemisahan dari pengelola PIN diverifikasi lewat prosedur operasional, karena aplikasi tidak menegakkannya |
| C01 | Buat/edit pasangan dengan studentId malformed atau tidak ada dalam master | Validasi/FK menolak request; tidak ada pair/member/audit parsial |
| C02 | Student sama dipilih dua kali dalam satu pair atau pada pair lain di organisasi/periode sama | Ditolak sebagai pasangan tidak valid/`DUPLICATE_CANDIDATE`; pasangan lain pada organisasi berbeda tetap dapat memakai Student yang sama |
| C03 | Pair hanya punya chair, hanya vice-chair, posisi ganda, atau satu Student untuk dua posisi | Commit CRUD/open ditolak; setiap pair tersimpan/opened selalu tepat dua posisi dan Student berbeda |
| C04 | Ubah nama/kelas master Student setelah pasangan disimpan dan election diarsipkan | CandidateMember/result snapshot tetap sama; riwayat candidate dapat dicari melalui studentId dan mengembalikan snapshot historis |
| C05 | Edit anggota/visi/foto/nomor tepat sebelum opensAt bersamaan dengan request pembukaan | Lock menentukan satu hasil: perubahan yang commit sebelum buka masuk seluruhnya dan diaudit; bila waktu buka menang, edit ditolak tanpa perubahan parsial |
| C06 | CRUD pasangan (termasuk penghapusan) dan audit gagal di tengah transaksi | Pair/member dan audit seluruhnya rollback; tidak ada perubahan kandidat tanpa event audit |
| A01 | Cross realm: admin/alumni cookie dipakai sebagai siswa dan sebaliknya; Account nonaktif; revoke baru | 401/403 tepat, tidak percaya role JWT lama, mahasiswa internal tidak otomatis eligible |
| A02 | PIN salah/tidak dikenal/credential disabled | Pesan generik sama, dummy bcrypt; no enumeration dari bentuk respons; limiter sebelum hash |
| A03 | Login serentak oleh seluruh pemilih (<100), limiter lintas instance dan IP bersama | Suara/session isolation benar; NAT sekolah tetap dapat dilayani pada batas disahkan |
| A04 | Limiter DB unavailable, spoof X-Forwarded-For | Fail closed; spoof tidak mengganti IP tepercaya; tidak fallback memory |
| A05 | Idle 5 menit/absolute 15 menit, jam browser dimundurkan, status polling, dua login untuk voter sama | Server menolak sesi expired, polling tidak memperpanjang idle; login baru mengganti sesi lama dan sesi terdahulu ditolak |
| A06 | GET mencoba logout/vote/print/reset, CSRF missing/invalid/expired/wrong realm, Origin asing/null | Tidak ada mutasi; 405/403; request valid tetap bekerja melalui proxy staging |
| A07 | Request terlalu besar termasuk chunked tanpa Content-Length, method/type invalid, unknown fields | Batas ukuran dan parsing ditegakkan sebelum pekerjaan mahal |
| A08 | Cetak awal, penerbitan ulang oleh admin, stale form replay, response cetak hilang | Hash + fingerprint HMAC saja, tanpa plaintext di DB; form lama ditolak; PIN lama tidak berlaku dan sesi dicabut tanpa mengubah master/partisipasi |
| A09 | Sinkronisasi master beda tahun ajaran, siswa sudah ada di roster, NISN bentrok, jumlah proyeksi lebih dari 99, periode tepat dibuka | Hanya kelas dengan tahun ajaran periode yang dipilih; yang sudah ada tidak diduplikasi; collision/limit/state menolak transaksi utuh; empat eligibility per siswa baru; snapshot lama tetap |
| A12 | Sinkronisasi batch 52 siswa pada Neon dengan delay jaringan normal dan terburuk yang disetujui | Semua 52 voter dan 208 eligibility tercatat bersama satu audit, atau seluruh transaksi rollback; tidak terkena timeout transaksi interaktif |
| A10 | Koreksi NISN dari sumber resmi dengan dua pemeriksa, sebelum buka dan untuk voter belum memilih setelah buka | Student ID tetap, old PIN/sesi dicabut, PIN baru wajib; tidak ada name-match otomatis; membership roster tetap beku; voter yang sudah memilih tidak dapat dikoreksi |
| A11 | Reauth password akun lain/salah, grant/revoke override via akun management | Reauth terikat caller; limiter/CSRF/audit bekerja; revoke langsung memblok panitia |
| R01 | Setiap role meminta hasil sebelum deadline, setelah deadline sebelum close, lewat HTML/API | Tidak ada tally di body/hidden data/JSON/DOM, bahkan superadmin; query hasil belum dijalankan |
| R02 | CLOSED belum publish; lalu publish; lalu archive | Panitia berizin bisa baca setelah close; publik baru sesudah publish; snapshot tetap |
| R03 | Kandidat nol, kontes nol suara, calon tunggal yang disetujui, hasil seri, siswa parsial | Semua kandidat tampil; seri eksplisit; turnout tanpa quorum; tidak membuat pemenang otomatis |
| R04 | Enumerasi route, trailing slash, encoded path, HEAD/OPTIONS/method tak didukung | Tidak bypass guard, tidak expose PII atau cache body sensitif |
| P01 | Tangkap log aplikasi/DB/APM/error saat login, vote, failure | Tidak ada NISN/PIN/token/password/candidate body/ballot-voter correlation yang ditulis aplikasi |
| P02 | Inspect schema dan respons semua endpoint | Ballot tidak memiliki identitas/waktu; participation tidak memiliki kandidat; tidak ada export suara mentah |
| P03 | Audit insert sengaja dibuat gagal pada admin mutation | Konfigurasi/reset/close tidak commit tanpa audit |
| P04 | Stored XSS dari artikel, usulan, FAQ, nama/kelas master calon, visi/misi dan URL foto | Script tidak dapat berjalan pada origin sekolah dan mengirim vote; uji data lama maupun baru |
| S01 | Login baru/parsial dari form atau deep link dengan PIN valid | Scope ELECTION_VOTING, redirect `/siswa`; dashboard dahulu sebelum ballot, tidak mengikuti returnTo arbitrary |
| S02 | Master Student ada tetapi tidak terdaftar atau belum punya PIN; coba registrasi/lupa-password/create-password | Login gagal generik; tidak ada Student/Account/credential dibuat oleh login; endpoint self-service 404/405 tanpa mutasi |
| S03 | Cookie PIN dipakai untuk `/api/admin/students`, profil/nilai/akademik atau scope layanan masa depan | Master admin menolak 401; route belum dibuat 404; unit guard menolak scope nonpemilu 403, tidak bergantung kartu disabled |
| S04 | Sesi sah untuk periode A membuka dashboard/ballot/status/activity periode B atau setelah deadline | Scope dan period server checked; 401 bila expired, 409 + revokasi jika periode tidak valid pada sesi terverifikasi; tidak ada data personal |
| S05 | Empat suara selesai, kemudian akses dashboard, Back, restore tab atau login ulang dalam periode valid | Revoke atomik, layar `/siswa/selesai` tanpa identitas; dashboard lama tidak dapat dipakai. Login ulang lengkap tanpa sesi baru |
| S06 | Dashboard Coming Soon: inspect DOM, keyboard, click dan network | Tidak ada href/button/handler/tabindex aksi maupun request data layanan; label Coming Soon terbaca, tidak menjadi grant |
| S07 | Dua petugas menerbitkan PIN, login concurrent, dan reissue membuat PIN lama tak berlaku | Audit mencatat operator/saksi; uniqueness per periode dan revokasi sesi benar |
| S08 | Close/archive/revoke PIN/cleanup sesi/hapus roster DRAFT | Student tetap ada, tidak memiliki password/PIN; snapshot/ballot historis tidak ikut terhapus; FK menolak delete master yang dipakai |
| S09 | Siswa master tidak punya kelas atau kelasnya untuk tahun ajaran lain | Siswa tidak masuk preview roster periode; registrar membetulkan relasi kelas/tahun ajaran sebelum sinkronisasi |

P01/P02 tidak membuktikan anonimitas terhadap WAL/DB owner; batas [ADR](adr/0001-integrasi-dan-batas-kerahasiaan.md) tetap berlaku meskipun semua test lulus. Jangan menambahkan audit per vote untuk membantu debugging test produksi.

## Pengujian browser di Chromebook

Gladi bersih manual wajib pada perangkat sekolah yang nyata. Gunakan browser automation tambahan hanya bila setup proyek membutuhkannya; tidak wajib menambah framework e2e baru untuk merencanakan pekerjaan ini.

1. Siswa A login ke dashboard Portal Siswa, cek Coming Soon tidak interaktif, masuk E-Voting dan pilih satu organisasi. Matikan Wi-Fi sebelum/durante/setelah pengiriman. Pulihkan dan pastikan status benar sebelum mengizinkan ulang; autentikasi ulang dengan PIN sama harus lewat dashboard. Uji offline lebih lama dari idle dan absolute expiry.
2. Selesaikan empat organisasi, lalu siswa B memakai browser Chromebook yang sama. Back/forward, refresh, restore tab, duplicate tab, tab lama, bfcache, dan reboot tidak boleh membuat B melihat identitas atau mengirim atas sesi A. Konten calon umum boleh ada, pilihan/identitas A harus bersih.
3. A meninggalkan bilik di tengah sesi: peringatan idle dapat diakses, layar dibersihkan saat timeout termasuk offline. Panitia memastikan layar netral sebelum B masuk; cookie masih hidup selama idle merupakan risiko operasional yang harus ditangani.
4. Uji hanya keyboard, pembaca layar sederhana, zoom 200%, layar Chromebook kecil, slow network. Radio, konfirmasi, status/error dan logout memiliki nama/focus yang jelas.
5. Cetak 25 slip pada printer panitia; cek pemotongan halaman, nol depan NISN/PIN, keterbacaan, privasi spool, tidak ada header URL berisi kredensial. Uji batal cetak dan reissue.

## Beban, regresi dan penerimaan

Populasi pemilih `N` kurang dari 100. Pelaksanaan memakai tiga Chromebook bersama, satu siswa per perangkat dan maksimal tiga akun aktif bersamaan. Staging menguji tiga sesi/login/vote yang tumpang tindih, pergantian siswa bergantian pada perangkat yang sama, kebersihan browser, dan trafik website publik; jangan mengasumsikan seluruh `N` pemilih online serentak. Ukur p95/p99, rejection, cold start, koneksi Neon dan waktu bcrypt. Target awal p95 submit <2 detik tanpa melanggar invariant, tidak ada 5xx pada beban yang disetujui, dan batas timeout memberi pesan pulih yang jelas. Angka final ditetapkan setelah kapasitas Vercel/Neon diketahui, bukan diklaim terbukti pada audit.

Regresi wajib: unit RBAC/token/QR existing, admin login/logout dan revoke, alumni magic-link/portal, rendering berita/FAQ, upload media, homepage dan build adapter Vercel. Tes keamanan shared helper harus mencakup caller lama yang berubah.

Release hanya diterima jika:

- Semua 4 organisasi × N siswa dapat diwakili tanpa suara ganda; seluruh race/failure tests kritis lulus pada PostgreSQL dan Neon staging.
- Seluruh keputusan autentikasi final teruji: tanpa self-registration/password/recovery, master independen, PIN unik terikat periode, dashboard setelah login, Coming Soon inert, penolakan layanan personal/akademik dan revokasi setelah lengkap.
- Roster freeze, reset PIN dan pencabutan sesi terbukti tidak menghapus partisipasi/ballot.
- Setiap pasangan memiliki Student yang valid dan snapshot historis stabil; assignments unik per organisasi/periode; semua perubahan kandidat diaudit serta ditolak setelah opensAt.
- Tally tidak bocor sebelum close, dan publikasi terpisah benar-benar digate server.
- Semua boundary auth/CSRF/rate/body/SQL constraints dan privasi log diuji, bukan hanya atribut UI.
- Restore backup/PITR diuji; ledger, ballot dan snapshot konsisten sesudah pemulihan, sesi lama dibatalkan.
- Gladi Chromebook, distribusi PIN, identitas panitia, RPO/RTO serta penerimaan batas kerahasiaan ditandatangani pemilik operasional.

Laporan implementasi nanti harus mencatat command, versi runtime/adapter, database test, jumlah tes dan hasil aktual. Proposal audit ini tidak boleh disalin menjadi bukti kelulusan.
