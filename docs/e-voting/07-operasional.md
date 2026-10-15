# Checklist deployment, migrasi, backup dan rollback

Status: rencana untuk fase implementasi; **tidak ada command di dokumen ini yang dijalankan oleh audit**. Tetapkan penanggung jawab sekolah, operator deploy/database, pengelola PIN dan saksi penutupan. Jangan menempatkan secret, roster atau lembar PIN di issue, repo, chat, R2 publik, atau artefak CI.

## Sebelum implementasi dan staging

- [ ] Jadikan ADR 0002 keputusan autentikasi final: NISN + PIN tercetak, login ke dashboard Portal Siswa, sesi khusus ELECTION_VOTING, tanpa registrasi mandiri atau password permanen/recovery siswa. Jangan meminta siswa membuat akun atau mengganti PIN sendiri.
- [ ] Registrar mengesahkan sumber resmi dan roster sebelum periode dibuka; koreksi NISN dilakukan dua pemeriksa dengan Student ID tetap. Tidak ada pencocokan otomatis berdasarkan nama. Setelah dibuka, koreksi identitas hanya untuk voter yang belum memilih, dengan PIN baru; voter yang telah memilih tidak dikoreksi.
- [ ] Ikuti keputusan lifecycle, publikasi, seri/calon tunggal, turnout tanpa quorum, pemisahan prosedural dua orang, retensi dan populasi kurang dari 100 pada [README](README.md). Roster/calon membeku saat periode dibuka.
- [ ] Verifikasi runtime production, region aplikasi/Neon, connection pool, batas function, TLS/domain canonical, trusted proxy header, origin allowlist dan cache/CDN bypass.
- [ ] Inventaris credential DB yang dipakai runtime; pisahkan role owner/migrator dari non-owner aplikasi. Uji grants yang dibutuhkan tanpa membuka UPDATE/DELETE ballot.
- [ ] Periksa status migrasi aktual dan schema drift menggunakan clone/staging sebelum membuat migration. Repo memiliki 19 migrasi, tetapi audit tidak memeriksa mana yang sudah diterapkan di produksi.
- [ ] Sediakan database staging tersendiri dan secrets nonproduksi. Preview deployment tidak boleh menunjuk database/PIN produksi; akses preview dibatasi.
- [ ] Tetapkan log policy di hosting, DB, APM dan proxy: disable body/cookie/bind-parameter capture untuk auth/voting/print, redaksi error, retensi dan akses operator. Tidak cukup menghapus `console.log` source.
- [ ] Buktikan backup/PITR tersedia sesuai paket sebenarnya. Tentukan RPO dan RTO yang dapat dipenuhi; target integritas adalah tidak kehilangan suara yang sudah dikonfirmasi. Jangan menjanjikan RPO nol bila fasilitas recovery tidak mendukungnya.

## Migrasi additive

Gunakan CLI Prisma **7.9.0 dari lockfile** setelah dependency diinstal. Alur CLI mengacu [migrate dev](../../.agents/skills/prisma-cli/references/migrate-dev.md) dan [migrate deploy](../../.agents/skills/prisma-cli/references/migrate-deploy.md) yang tersedia di repo; bukan API ORM 8 dari dokumentasi web terkini.

1. Pada database dev/shadow **disposable**, validasi schema proposal yang telah digabung, generate client, buat migrasi `--create-only`. Review master Student tanpa credential, FK studentId restriktif, unique student-per-period dan PIN fingerprint, enum scope sesi, CHECK, index parsial, trigger, grants dan larangan cascade ke ballot/master.
2. Jalankan migrasi dari kosong dan dari clone schema existing; verifikasi tidak ada drop/rename/backfill destruktif tabel website. Jalankan suite integrasi dengan runtime role terbatas.
3. Pastikan default UUID acak v4, UTC/timestamptz dan PrismaNeon mendukung transaksi/lock yang direncanakan. Ukur timeout serta mapping error nyata.
4. Staging menggunakan `migrate deploy`, kemudian client generate/build dan smoke. Tidak memakai `db push`, reset database, atau seed demo untuk produksi.

Command referensi setelah URL database dev/staging sudah dipastikan oleh operator:

```text
npm ci
npx prisma validate
npx prisma generate
npx prisma migrate dev --name e_voting --create-only
```

Command produksi nanti (melalui job migrasi tunggal dengan credential migrator, bukan saat request atau cold start):

```text
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
npm run build
```

`migrate status` tidak membuktikan tidak ada drift; bandingkan schema/DDL pada staging clone. Jangan mengedit migration lama atau memanggil `migrate resolve` untuk menyembunyikan kegagalan tanpa pemeriksaan SQL yang benar-benar telah berjalan. URL migrator disuplai ke environment job; runtime tetap memakai credential terbatas. Hindari fallback localhost pada job produksi.

## Deployment dan gerbang buka

- [ ] Tutup semua blocker audit: CSRF/origin, akun/role panitia, Secure cookie admin, rate limiter durable, XSS jalur konten bersama, serta regresi alumni/public.
- [ ] Tambahkan `VOTING_PIN_SECRET`, `VOTING_CSRF_SECRET`, `VOTING_RATE_SECRET`, origin resmi dan switch server `VOTING_ENABLED` (default off). Secret hanya server, cukup acak, tidak dicetak di build/log. Import modul pemilu tidak boleh menggagalkan website ketika switch off.
- [ ] Switch off menolak login/mutasi baru dan memberikan halaman pemeliharaan; bukan perubahan state pemilihan atau mekanisme otomatis memperpanjang waktu. Requests yang sudah masuk transaksi bisa tetap commit; inspeksi sebelum mengambil tindakan operasional.
- [ ] Ambil backup konsisten sebelum migration dan catat deployment/DDL hash. Terapkan migration additive lalu deploy aplikasi dengan feature off. Jalankan smoke internal, kemudian aktifkan pada gladi staging dahulu.
- [ ] Jangan menjalankan `prisma/seed-pg.ts` di produksi: berisi akun/demo credential contoh. Inventaris akun aktif dan pastikan password bootstrap/demo tidak dapat dipakai. Berikan grant panitia individual dan cek revoke.
- [ ] Verifikasi HTTPS cookie, headers no-store/error, exact origin di proxy, tidak ada CDN caching personalized content, tidak ada analytics/session replay pada bilik/cetak.
- [ ] Siapkan/reuse master Student persisten melalui admin dan pastikan setiap siswa memiliki kelas dengan tahun ajaran yang benar. Buat periode nyata DRAFT, pratinjau lalu sinkronkan pemilih dari master; pastikan jumlah sesuai (maksimal 99), tiap voter terkait Student, dan ada empat partisipasi false. Perbaiki kelas/tahun ajaran di master jika jumlah tidak cocok; jangan impor roster kedua atau seed produksi.
- [ ] Uji PIN unik per periode, cetak/distribusi individual dan penerbitan ulang oleh admin untuk slip hilang, tanpa plaintext permanen. Dua petugas menyaksikan dan mencatat setiap batch issue/reissue; prosedur ini tidak ditegakkan otomatis oleh aplikasi. Slip mencantumkan periode, WIB dan `/siswa/masuk?periode=<slug>`; jelaskan akses hanya pemilu, bukan nilai/profil pribadi. Jadwalkan setelah data siap.
- [ ] Smoke login → dashboard `/siswa` → E-Voting; Coming Soon tanpa aksi/link/API, tidak ada signup/password/reset. Uji scope PIN pada layanan lain, jendela periode pada dashboard/deep link/API, logout/expiry dan suara keempat → revoke → `/siswa/selesai`.
- [ ] Uji beban dan website publik bersamaan, final acceptance, restore rehearsal dan mekanisme bantuan siswa. Baru izinkan jadwal nyata dibuka.

Jika dev server diperlukan selama implementasi, ikuti `AGENTS.md`: `astro dev --background`, dengan `astro dev status`, `astro dev logs`, `astro dev stop`. Audit dokumentasi tidak menyalakan server.

## Backup dan pemulihan

Backup harus mencakup **satu snapshot konsisten database**: master Student, periode/calon/roster dengan studentId, kredensial ter-hash/fingerprint, partisipasi/ballot/sesi/audit. Jangan membackup ledger dan ballot secara terpisah dengan waktu berlainan. Simpan backup terenkripsi, akses minimum, retention tertulis dan restoration target terpisah. Secret PIN pepper/konfigurasi dipulihkan lewat backup secret manager terpisah; tidak dimasukkan ke dump yang bisa dibaca pihak yang sama secara bebas. Cleanup kredensial per periode tidak menghapus master Student; retensi PII master dikelola terpisah dan tidak diperpanjang tanpa kebijakan hanya karena portal mungkin punya layanan baru kelak.

Sebelum pemilihan, latih restore ke database baru dan rekonsiliasi empat kontes: jumlah ballot = partisipasi true, jumlah per kandidat menjumlah tepat, snapshot closed konsisten. Pastikan tidak mengirim email alumni atau menulis media publik saat menjalankan clone. Batalkan semua sesi siswa hasil restore sebelum layanan dipakai lagi. Bukti restore adalah catatan waktu, coverage data, counts dan siapa yang memverifikasi, tanpa rincian suara individu.

Jika kegagalan terjadi selama voting:

1. Matikan penerimaan baru, amankan database/log/backup dengan akses terbatas, catat waktu insiden. Jangan otomatis menganggap request timeout gagal commit.
2. Tentukan titik recovery terakhir yang menyertakan **semua suara yang sudah acknowledged**. Dengan PITR, pulihkan clone sampai titik konsisten dan rekonsiliasi sebelum cutover.
3. Jika ada suara yang mungkin hilang setelah ack, jangan melanjutkan seolah tidak terjadi apa-apa atau meminta hanya siswa tertentu mengulang: anonimitas membuat pemulihan pilihan per siswa tidak tersedia. Eskalasi ke panitia untuk keputusan prosedural (termasuk kemungkinan pemilihan baru), setelah menjaga bukti dan menjelaskan kehilangan data.
4. Perpanjangan yang disetujui hanya satu kali, maksimal 60 menit oleh ketua/pengelola pemilu yang bukan pengelola PIN, dengan audit dan berita acara. Jika gangguan masih berlangsung setelah itu, hentikan saat tenggat, dokumentasikan dan minta keputusan sekolah; periode tertutup tidak dibuka ulang. Pemilihan ulang memakai periode baru untuk seluruh pemilih.

## Rollback

| Situasi | Tindakan aman |
| --- | --- |
| Migration belum diterapkan | Batalkan release, tetap gunakan aplikasi lama |
| Migration additive sudah berhasil, belum ada voting nyata | Rollback binary/deployment kompatibel dan feature off; biarkan tabel additive, jangan drop terburu-buru |
| Ada suara nyata tersimpan | Freeze penerimaan baru; rollback aplikasi hanya jika tidak menghapus data dan tidak membuka jalur bypass. Pertahankan schema, ballot/ledger/audit; utamakan fix-forward |
| Migration gagal parsial | Periksa DDL/status dan transaksi yang selesai, restore rehearsal atau corrective migration ter-review; jangan `migrate reset` produksi |
| Korupsi/kehilangan database | Recovery ke clone sesuai prosedur backup; tidak restore website+voting ke snapshot lama secara buta |

Rollback database bersama dapat menghapus update website, alumni dan akun selain suara. Sebab itu restore harus ke target terpisah, diperiksa, lalu cutover terencana. Menurunkan versi kode tidak mengembalikan pilihan yang hilang; penutupan/publikasi bukan toggle yang dibatalkan dengan rollback.

## Hari pemilihan dan penutupan

- [ ] Panitia memakai perangkat terpisah dari Chromebook siswa. PIN tidak dibacakan atau ditampilkan massal. Verifikasi identitas saat pembagian; kertas bekas/reset dimusnahkan dengan prosedur sekolah.
- [ ] Sediakan tiga Chromebook bersama dengan satu akun siswa per perangkat (maksimal tiga siswa login bersamaan). Siswa maju bergantian ke perangkat yang tersedia; sebelum perangkat dipakai siswa berikutnya, pastikan siswa sebelumnya logout atau sesi sudah berakhir, layar kembali netral, dan tab lama tidak dapat menampilkan identitas atau pilihan sebelumnya. Password saving dimatikan. Tidak ada mode perangkat pribadi pada MVP.
- [ ] Untuk pemilih parsial, gunakan NISN dan PIN valid yang sama selama periode masih terbuka; masuk lagi ke dashboard dan lanjutkan organisasi tersisa. Slip hilang ditangani panitia berizin dengan reissue + revokasi sesi, bukan password-reset/self-registration. Sesudah lengkap pastikan layar selesai dan dashboard lama tak aktif.
- [ ] Pantau hanya kesehatan layanan, limiter, antrean, errors tersanitasi dan partisipasi agregat; jangan membuka query live candidate tally selama pemungutan.
- [ ] Deadline berlaku sesuai jadwal/perpanjangan yang tercatat dan menolak suara baru tanpa cron. Panitia menunggu transaksi yang sedang commit, lalu menutup resmi dengan saksi dan rekonsiliasi. Jika selisih, jangan publish atau mengedit ballot manual.
- [ ] Arsipkan snapshot hasil, berita acara penutupan, total peserta/parsial/lengkap, hasil seri bila ada, waktu tutup dan pihak pengesah; bukan dump pilihan per siswa.
- [ ] Publish agregat per organisasi secara terpisah setelah tutup resmi dengan saksi; catat dua petugas yang menyaksikan penutupan/publikasi. Setelah masa sanggah 30 hari, bersihkan PIN dan sesi; simpan roster/audit satu tahun dan hasil agregat lintas periode. Pembersihan tidak mengubah ballot/ledger; master Student mengikuti kebijakan retensi terpisah.
- [ ] Tahun berikutnya: reuse master Student yang sudah dikoreksi, buat periode/roster/PIN baru dan sesi baru. Jangan truncate master/riwayat, menyalin PIN lama atau menggunakan kembali periode CLOSED/ARCHIVED. Tidak mempromosikan PIN/sesi pemilu menjadi akun permanen atau akses personal/akademik.

Semua checklist tetap terbuka sampai ada bukti operasional. Infrastruktur/secret produksi tidak diperiksa selama audit ini; dokumen tidak merupakan persetujuan deploy.
