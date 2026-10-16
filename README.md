# SMKDH
Website sekolah SMKS NU Darul Hikam, dashboard pengelolaan konten dan data siswa, serta Portal Siswa untuk pemilihan empat organisasi.

## Menjalankan lokal
Node.js >=22.12, npm, PostgreSQL Neon untuk lingkungan aplikasi. Salin .env.example menjadi .env dan isi konfigurasi yang diperlukan.
```sh
npm install
npx prisma generate
npx astro dev --background
npx astro dev status
npx astro dev logs
npx astro dev stop
```
Jangan memasukkan .env, PIN atau file master siswa ke Git. Migrasi database dijalankan secara eksplisit terhadap target yang telah ditentukan; menjalankan build tidak melakukan migrasi.
```sh
npx prisma migrate deploy
npm test
npm run build
```

## Konfigurasi
DATABASE_URL dan JWT_SECRET diperlukan aplikasi. Modul pemilihan memakai tiga secret independen minimal 32 byte: VOTING_CSRF_SECRET, VOTING_PIN_SECRET, VOTING_RATE_SECRET. Konfigurasi media R2 dan email mengikuti .env.example.
Admin menggunakan Account/RBAC. Siswa memakai NISN + PIN per periode tanpa registrasi mandiri atau password permanen.

## UI dan perjalanan admin
Dashboard memakai komponen Astro, Plus Jakarta Sans dengan fallback system-ui, dan token di src/styles/portal-tokens.css. Tabel besar tetap query server; tabel kecil memakai enhancement tanpa framework tambahan.
- [Audit UI/UX](docs/ui-ux-audit.md)
- [Blueprint](docs/ui-ux-blueprint.md)
- [Komponen](docs/component-system.md)
- [Keputusan data table](docs/data-table-evaluation.md)
- [Perjalanan voting siswa](docs/student-voting-journey.md)
- [Rencana dan hasil pemeriksaan](docs/ui-ux-implementation-plan.md)
- [Master siswa dan impor CSV](docs/data-siswa.md)
- [Audit performa dan rencana perbaikan](docs/performance-audit.md)

Aset logo, hero, dan foto kepala sekolah memakai varian statis terkompresi di `public/assets`; PNG asli tetap disimpan. Jalankan `npm run assets:optimize` untuk meregenerasi hasil dengan pemeriksaan ukuran/kualitas dasar. Berkas hasil ikut disimpan di Git sehingga build dan kunjungan halaman tidak memerlukan transformasi tambahan. Naikkan versi nama berkas ketika mengganti aset yang sudah diterbitkan; lihat laporan performa untuk ukuran dan hasil verifikasinya.

Font aplikasi disajikan lokal dari `public/fonts` melalui `FontHead`; lisensi font disertakan. Jalankan `npm run assets:fonts` dengan internet ketika meregenerasi font/katalog ikon, lalu simpan hasilnya di Git. Beranda memakai subset ikon; admin dan halaman CMS dengan nama di luar katalog memakai font lengkap yang lebih ringan untuk menjaga nama ikon bebas. Build tidak mengunduh font. Detail ukuran, batasan, dan validasi ada pada laporan performa.

Video DHTV dan peta beranda dimuat setelah tombol ditekan; tautan alternatif tetap tersedia tanpa JavaScript. Pengumuman teks tampil pada panel mengambang yang dapat ditutup agar tidak menggeser halaman. Beranda memakai data pengumuman dari query yang sama dengan spotlight; halaman lain mengambil `/api/announce`. Pesan expired disembunyikan dan localStorage hanya menyimpan kombinasi ID yang sudah ditutup.

Kartu gambar CMS memakai `CmsImage` dan varian WebP dari endpoint R2 yang sudah ada, dengan `srcset/sizes` dan ukuran terbatas. Original tetap untuk detail/unduh. URL R2 eksternal hanya dipetakan bila sesuai `R2_PUBLIC_URL`; URL pihak ketiga lain tetap utuh. Query beranda yang independen berjalan paralel dan memilih field kartu; `Server-Timing` menyediakan durasi pembacaan untuk pemeriksaan setelah deploy.

Cache HTML Vercel dibatasi 60 detik masa fresh pada `/fasilitas`, `/guru`, `/galeri`, `/prestasi`, `/jurusan`, `/faq`; browser selalu revalidasi. Beranda, berita, portal, e-voting, API selain gambar, preview/query, error, dan respons bersesi tetap `private, no-store` di origin. Untuk memeriksa edit CMS segera, gunakan `?preview=1` pada URL publik; TTL CDN bukan batas keras keterlambatan karena revalidasi bisa berlangsung setelah expiry. Lihat [kebijakan cache dan verifikasi deployment](docs/performance-audit.md#hasil-implementasi-tahap-4).

## Pemilihan
[Dokumentasi E-Voting](docs/e-voting/README.md) mencakup desain, API, schema, pengujian dan operasional.
Route utama: /admin/e-voting, /admin/siswa, /admin/kelas, /siswa/masuk, /siswa.
Kesiapan periode ditampilkan sebagai panduan; validasi akhir tetap dilakukan server dalam transaksi. Ballot anonim tetap immutable dan audit append-only.

Periode **Data uji** memiliki aksi **Hapus data uji** pada konfigurasi untuk superadmin: ringkasan → konfirmasi slug → password login. Penghapusan periode dan data turunannya atomik; master siswa dan audit tetap tersimpan. Periode biasa dan hasil yang sudah dipublikasikan tidak dapat dihapus. Lihat [panduan pembersihan data uji](docs/e-voting/08-pembersihan-data-uji.md).

## Simulasi lokal yang terisolasi
Memerlukan Docker atau PostgreSQL localhost khusus. Tooling tidak membaca DATABASE_URL aplikasi sebagai target seed/reset.
```sh
docker compose -f compose.simulation.yml up -d
npm run qa:seed
npm run qa:dev
```
Server simulasi memakai port 4322. Seed mencetak akun admin, NISN dan PIN sintetis. Data hanya masuk database smkdh_election_simulation pada localhost. File .env.simulation dibuat lokal dan diabaikan Git.
Scenario: ready (default), empty, partial, completed, expired. Contoh seed baru: npm run qa:seed -- --scenario=partial.
Untuk mengulang scenario: hentikan server simulasi, reset, lalu jalankan ulang qa:dev agar secret baru dimuat.
```sh
npx astro dev stop
npm run qa:reset -- --confirm=smkdh_election_simulation --scenario=partial
npm run qa:dev
```
Reset memerlukan marker kepemilikan dan konfirmasi nama database. Mode simulasi ditolak dalam production/Vercel dan tidak menyediakan endpoint reset.
Lihat [strategi dan skenario QA](docs/election-testing-strategy.md).

## Pemeriksaan browser tanpa database
```sh
npm run qa:ui
```
Perintah membangun fixture sintetis di scripts/ui-fixture, memakai server HTTP sementara pada loopback dan Chrome headless, lalu menghentikannya. Tidak ada route fixture pada aplikasi produksi. Default browser Windows: Chrome; set UI_QA_BROWSER bila executable berada di lokasi lain.
Screenshot desktop/mobile dan hasil JSON berada di artifacts/ui-qa (diabaikan Git). Font eksternal diblokir pada tes; font lokal asli, glyph subset, fallback ikon CMS, dan gambar responsif diperiksa. Pengujian ini memverifikasi komponen dan sesi UI dengan respons API sintetis, bukan transaksi ballot end-to-end.

## Deploy
Astro memakai adapter Vercel. Atur environment/secrets di platform, jalankan migrasi yang telah direview terhadap database tujuan, lalu build/deploy. Jangan mengaktifkan SMKDH_SIMULATION di deployment. Fitur pembersihan sampel memerlukan migrasi `20261015140000_test_period_cleanup` dan Prisma Client terbaru. Migrasi menandai dua sampel yang dikonfirmasi operator; penghapusan baru dilakukan lewat verifikasi admin.
