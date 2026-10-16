# Audit performa dan rencana perbaikan website

Tanggal audit: 16 Oktober 2026. Status: tahap 1–4 diimplementasikan dan diverifikasi lokal; cache CDN/R2 dan PageSpeed setelah perubahan masih memerlukan deployment.

## Kesimpulan

Prioritas terbesar adalah memperkecil gambar, membatasi font ikon, dan memuat YouTube/Maps setelah interaksi. Beranda mengunduh sekitar 5 MB pada laporan PageSpeed. CSS aplikasi sendiri hanya sekitar 10 KB saat ditransfer; sebagian besar JavaScript yang tercatat berasal dari embed pihak ketiga.

Plus Jakarta Sans tetap dipakai. Perubahan yang diusulkan berfokus pada pengiriman aset dan waktu pemuatan. Tidak diperlukan perubahan schema, migrasi database, Redis, atau framework frontend baru untuk tahap awal.

## Hasil implementasi tahap 1

Varian statis sudah dibuat dan dipasang pada halaman publik, admin, siswa/pemilih, serta alumni. PNG asli tetap utuh. Logo menggunakan WebP lossless; foto menggunakan WebP kualitas 80. Browser memilih varian hero 480/768/947 px dan foto kepala sekolah 240/440 px lewat `srcset/sizes`. Hero default dan spotlight diberi prioritas tinggi; foto di bawah fold tetap lazy. Favicon PNG 32×32 dipisahkan dari logo.

| Aset yang dipakai | Ukuran hasil |
| --- | ---: |
| Logo lossless 113×113 | 19.248 B |
| Hero 480 / 768 / 947 px | 28.034 / 49.212 / 62.400 B |
| Kepala sekolah 240 / 440 px | 4.876 / 9.112 B |
| Favicon 32×32 | 3.070 B |

Total logo + varian hero terbesar + varian kepala sekolah terbesar: **90.760 B**, turun sekitar **95,7%** dari 2.128.624 B. Browser hanya meminta varian yang dipilih, bukan menjumlahkan semua ukuran. Generator kartu alumni tetap membaca sumber PNG di server dan sudah mengompresnya sebelum di-embed; browser tidak mengunduh PNG aslinya melalui alur tersebut. Slip PIN tidak memakai logo.

Regenerasi dengan `npm run assets:optimize` memakai Sharp yang sudah tersedia. Berkas hasil disimpan di Git; tidak ada transformasi tambahan pada request pengunjung. Saat mengubah gambar yang sudah diterbitkan, naikkan versi nama hasil dan perbarui referensinya. Generator memeriksa format, dimensi, rasio, budget ukuran, transparansi, kesamaan piksel logo lossless pada latar putih, serta keutuhan sumber.

Verifikasi lokal: generator lulus, build produksi lulus, dan 13 skenario QA browser lulus. Skenario baru memuat halaman beranda asli dengan CMS sintetis kosong pada desktop/mobile DPR 1/2, memeriksa varian yang terpilih, ukuran logo, favicon, decoding gambar, overflow, dan foto halaman profil. Perbandingan visual gambar asli/hasil serta screenshot desktop/mobile diperiksa. Font dan iframe eksternal diblokir pada QA agar hasil deterministik; snapshot bukan validasi font produksi. Cabang spotlight hanya diperiksa lewat build, belum diuji dengan data CMS nyata.

Tidak ada perubahan database atau deployment pada tahap ini.

## Hasil implementasi tahap 2

[FontHead](../src/components/ui/FontHead.astro) sekarang menjadi sumber deklarasi font bagi layout publik, admin, portal siswa/pemilih, alumni, halaman login/verifikasi, dan tampilan kartu alumni. Plus Jakarta Sans tetap dipakai dengan weight 400–800, WOFF2 Latin lokal, preload, `font-display: swap`, dan fallback sistem yang sudah tersedia. Stylesheet/preconnect Google Fonts pada layout aplikasi dihapus. Tidak ada pengunduhan font saat build atau request server.

| Aset font lokal | Ukuran | Pemakaian |
| --- | ---: | --- |
| Plus Jakarta Sans variable Latin | 27.348 B | Teks aplikasi; satu file untuk weight 400–800 |
| Material Symbols subset, 157 nama | 16.592 B | Ikon tetap dan nama CMS yang ada dalam katalog |
| Material Symbols lengkap, axis tetap weight 500/FILL 0 | 354.348 B | Admin/preview nama bebas dan fallback CMS di luar katalog |

Beranda biasa memuat font teks + ikon total **43.940 B**. Font ikon subset berkurang sekitar **98,5%** terhadap transfer ikon sekitar 1,14 MB pada baseline. Font lengkap tidak dimuat di beranda biasa. Portal siswa/pemilih tidak mendeklarasikan font ikon karena memakai ikon SVG/HTML.

Nama ikon CMS tetap bebas: `/fasilitas` dan `/jurusan` meneruskan nama dari hasil query yang sudah ada ke layout. Jika ada nama di luar [katalog subset](../src/data/font-icons.json), halaman memilih font lengkap lokal. Admin memakai font lengkap agar `IconPicker` dan nama yang diketik tetap berfungsi. Tradeoff: halaman dengan nama di luar subset memakai 354 KB untuk ikon, sehingga budget publik ≤30 KB berlaku untuk halaman yang seluruh ikonnya tercakup subset. Font lengkap ini tetap lebih kecil daripada font variable sebelumnya. Tidak ada tambahan query database atau pemotongan diam-diam nama CMS.

Axis ikon dibatasi pada yang dipakai; slot satu em menjaga dimensi saat font dimuat dan `font-display: block` menghindari kilatan nama ligature. Lisensi SIL OFL Plus Jakarta Sans dan Apache Material Symbols disertakan di `public/fonts`.

Regenerasi manual dengan `npm run assets:fonts` memerlukan internet. Skrip membaca nama statis/skrip/picker pada source, memvalidasinya terhadap codepoints resmi, lalu mengunduh font dari Google Fonts beserta lisensi upstream. Hasil font dan katalog harus disimpan bersama di Git; saat menambah ikon statis, regenerasi katalog/font. Untuk memperbarui font yang telah diterbitkan, naikkan versi nama berkas pada skrip dan FontHead. Build/deploy tetap dapat memakai berkas hasil tanpa mengakses Google Fonts.

Verifikasi: build produksi dan **14 skenario QA browser lulus**. QA memeriksa semua 157 nama membentuk satu glyph, file font lokal dimuat, subset memenuhi budget 30 KB, beranda tidak memuat font lengkap, fallback bekerja pada halaman fasilitas asli dengan ikon sintetis di luar katalog, dan pencarian/pemilihan/nama bebas pada IconPicker tetap bekerja. Tidak ada request Google Fonts dari layout pada rute QA; screenshot desktop/mobile kini menggunakan font lokal asli. Font di iframe pihak ketiga tetap di luar pengaturan ini dan ditangani pada tahap embed.

Thumbnail CMS, query/cache, PageSpeed produksi, dan uji perangkat nyata belum dikerjakan.

## Hasil implementasi tahap 3

[ClickToLoadEmbed](../src/components/ui/ClickToLoadEmbed.astro) menggantikan iframe langsung di section DHTV dan lokasi beranda. Pratinjau memakai logo lokal dan SVG; tidak meminta thumbnail, SDK, player, atau peta dari pihak ketiga. Iframe baru dibuat setelah tombol **Putar video** / **Tampilkan peta** diaktifkan. Video menggunakan ID yang sama melalui `youtube-nocookie.com`; Maps menggunakan sumber peta sebelumnya. Request embed sekitar 1,48 MB pada baseline kini ditunda sampai aktivasi; angka ini bukan pengukuran ulang PageSpeed.

Tombol native mendukung keyboard dan baru diaktifkan setelah listener siap. Fokus berpindah ke iframe yang memiliki judul. Rasio video 16:9 dan tinggi peta 300/380 px tetap saat placeholder diganti. Tautan langsung ke YouTube/Google Maps selalu tersedia, termasuk tanpa JavaScript atau ketika embed gagal. Tidak ada SDK/dependency baru atau transformasi gambar runtime.

[AnnounceBar](../src/components/AnnounceBar.astro) menjadi panel pemberitahuan tetap di bawah kiri. Ini menggantikan ribbon yang menambah tinggi di atas navigasi: panel tidak mengambil ruang pada alur layout, sehingga muncul/rotasi/hilangnya tidak mendorong halaman. Pada mobile panel berada di atas tombol WhatsApp; pesan panjang memiliki area scroll dan tombol tutup tetap terlihat. Panel bisa menutupi sebagian isi sementara sampai ditutup, sebagai tradeoff untuk menghindari pergeseran dan ruang kosong permanen di halaman statis.

Beranda merender pengumuman teks menggunakan hasil query `anns` yang sudah tersedia, tanpa fetch `/api/announce` kedua. Halaman lain tetap mengambil API setelah load; tidak ada query tambahan pada server render atau perubahan halaman statis menjadi SSR. API tetap `no-store` dan menambahkan field `expiresAt`. Normalisasi data SSR/API/klien disatukan pada [helper pengumuman](../src/lib/announcements.ts): pesan kedaluwarsa/invalid dibuang, teks tidak diperlakukan sebagai HTML, dan link hanya menerima HTTP(S)/relatif yang aman.

Rotasi tetap setiap enam detik dan berhenti sementara saat hover/fokus atau tab tidak terlihat. Pesan kedaluwarsa disaring dengan timer lokal. Status ditutup tetap disimpan per kombinasi ID; pengumuman baru tampil kembali. Pemeriksaan sebelum paint mencegah panel SSR yang sudah ditutup berkedip. Jika localStorage diblokir, panel tetap tampil dan tombol tutup tetap bekerja; status tutup tidak dapat dipertahankan saat reload. Pengumuman SSR pertama dan link alternatif embed tetap dapat dibaca tanpa JavaScript.

Verifikasi: **17 skenario QA browser**, **2 unit test pengumuman**, dan build produksi lulus. QA tambahan memeriksa nol request embed sebelum aktivasi bahkan setelah scroll, aktivasi Enter pada desktop/mobile, satu iframe per tombol, fokus, ukuran stage tetap, fallback tanpa JavaScript, tidak ada fetch pengumuman kedua di beranda, pause/rotasi/dismiss/reload, pengumuman baru/panjang/kedaluwarsa, link berbahaya, localStorage diblokir, serta respons kosong/error. Posisi `main` tetap sebelum/sesudah perubahan panel. Screenshot pratinjau embed dan pengumuman mobile telah ditinjau.

Batas validasi: QA memblokir request pihak ketiga setelah aktivasi; pemutaran video dan peta Google secara langsung belum diuji. Total CLS/PageSpeed produksi belum diukur ulang. Data uji sintetis tidak masuk Neon dan tidak ada migrasi/deployment.

## Hasil implementasi tahap 4

[CmsImage](../src/components/ui/CmsImage.astro) dan [helper URL](../src/lib/image-url.ts) menyatukan thumbnail kartu beranda, berita, galeri, guru, fasilitas, prestasi, jurusan, ekskul, alumni publik dan logo mitra PKL. Browser memilih varian lewat `srcset/sizes`; gambar kartu tetap lazy dan memakai decoding async. Tidak ada transformasi baru untuk logo statis tahap 1. Spotlight CMS yang menjadi LCP tetap menggunakan original sampai latency varian R2 dapat diukur pada deployment; detail artikel, unduhan, dan tautan gambar penuh galeri juga mempertahankan original.

Helper mengenali `/api/image/`, URL absolut pada origin yang sama, dan public media base yang sesuai `R2_PUBLIC_URL`. Query yang sudah ada dan hash dipertahankan, termasuk penggantian satu parameter `w`. Host/prefix yang menyerupai media base serta URL pihak ketiga tidak diproksikan. Karena penyimpanan tetap R2 yang sama, tidak diperlukan migrasi data/DB atau env wajib baru.

[Endpoint image](../src/pages/api/image/[...key].astro) menggunakan Sharp yang sudah tersedia dengan WebP kualitas 70 dan tanpa pembesaran. Lebar yang diterima dikelompokkan ke **96, 200, 300, 480, 500, 600, 768, 960, 1200, 1600, 2000 px**, termasuk ukuran lama yang masih dipakai admin/portal. Lebar valid di antaranya diarahkan 307 ke ukuran di atasnya sebelum membaca R2; ukuran malformed, negatif, atau di atas 2000 ditolak 400. Tanpa `w` atau `w=0` tetap mengembalikan original. Cache sukses tetap satu tahun immutable; 400/404, redirect kanonis, dan fallback ketika transformasi gagal memakai `no-store` agar original yang gagal diproses tidak mengisi cache thumbnail permanen. Parameter tambahan belum dibuang dari cache key; ukuran piksel dibatasi, bukan jumlah seluruh kombinasi URL.

Beranda sekarang memulai pembacaan pengumuman, tiga artikel, dan prestasi featured melalui `Promise.all`. Query pengisi prestasi tetap menunggu hasil featured dan mengecualikan ID yang sudah terpilih. Beranda/list berita memakai `select` sehingga konten artikel lengkap tidak dibaca untuk kartu. Field pengumuman dan prestasi beranda juga dibatasi sesuai tampilan. Ini menghilangkan serialisasi pembacaan independen, tanpa mengubah jumlah hak suara atau transaksi pemilihan.

Header `Server-Timing` beranda mencatat `announcements`, `news`, `achievements`, serta `achievement_fill` bila perlu. Middleware menambahkan `app` pada HTML: waktu sampai respons tersedia di middleware, **bukan** seluruh streaming/render, TTFB jaringan, atau profil Neon. Nilainya hanya durasi/nama aktivitas; tidak mencatat SQL, siswa, PIN, atau credential. Durasi query yang paralel tidak boleh dijumlahkan sebagai waktu halaman.

[Kebijakan cache](../src/lib/page-cache.ts) dijalankan di luar guard otorisasi, sehingga redirect/penolakan dini juga diberi kebijakan privat. Kebijakan yang dipasang:

| Respons | Browser / CDN lain | Vercel CDN |
| --- | --- | --- |
| GET/HEAD 200 HTML anonim, URL persis `/fasilitas`, `/guru`, `/galeri`, `/prestasi`, `/jurusan`, `/faq`, tanpa query | `public, max-age=0, must-revalidate`; CDN lain `no-store` | `public, s-maxage=60, must-revalidate` |
| Halaman tersebut dengan query/preview, cookie/Authorization/Range, Set-Cookie atau cookie Astro tertunda, Vary, error/non-200, metode tulis, atau kebijakan privat sebelumnya | `private, no-store` | `no-store` |
| Beranda, berita/list/detail, admin/login, siswa, pemilih, alumni, verifikasi, e-voting, API selain image | `private, no-store` | `no-store` |
| Image R2 sukses | Cache immutable yang sudah tersedia | Mengikuti header image |

Allowlist tidak memuat personalisasi, preview, status periode, atau deadline pengumuman. Panel pengumuman pada halaman yang di-cache tetap mengambil API fresh; spotlight beranda dan publish/unpublish berita tidak memakai shared HTML cache. Halaman statis lain dan cache aset tidak diubah.

**Kesegaran operasional:** 60 detik adalah masa fresh, bukan jaminan batas keras usia konten. Vercel mendokumentasikan penyajian respons stale saat revalidasi berjalan setelah `s-maxage` habis. Edit/hapus pada enam halaman CMS dapat terlihat terlambat sampai revalidasi selesai; jangan menaruh data dengan deadline atau data sensitif pada allowlist ini. Preview/periksa edit segera dengan `?preview=1` (atau query unik), yang tidak disimpan bersama. Cookie sendiri bukan jaminan bypass edge ketika HTML anonim sudah HIT; tidak ada konten berbasis sesi pada URL allowlist. Jika nanti halaman menjadi personal, keluarkan dari allowlist dan bersihkan cache/deploy sebelum merilis personalisasi. Prioritas `Vercel-CDN-Cache-Control` mengizinkan cache Vercel sementara CDN lain tetap `no-store`. [Aturan header Vercel](https://vercel.com/docs/caching/cache-control-headers), [syarat cache CDN](https://vercel.com/docs/caching/cdn-cache).

**Hasil lokal:** 19 skenario browser lulus, termasuk kartu CMS pada sepuluh halaman pada mobile DPR 1/2, original galeri, decoding, dan overflow. Handler gambar asli digunakan dengan data CMS sintetis dan foto lokal yang sudah tersedia, tanpa R2/Neon. Sampel awal 600 px: **30.010 B**, render cold lokal **113,7 ms**; browser cold **117,3 ms**, kunjungan kedua **2,1 ms / 0 B transfer** dan tidak memanggil transformasi lagi. Ini bukan pengukuran cold/warm R2, CDN, atau PageSpeed. Hasil run terakhir tersimpan di `artifacts/ui-qa/cms-thumbnail-cache.json` (diabaikan Git). Fixture menolak pembacaan beranda yang kembali serial dan kartu artikel yang tidak memakai `select`.

Tes URL/handler/cache mencakup query/hash, origin dan R2 eksternal, lebar invalid/kanonis, WebP/tanpa pembesaran, byte original, fallback/error tanpa cache, allowlist dan prefix lookalike, preview, status error, metode, Authorization/Cookie/Set-Cookie/Vary serta isolasi API/portal. Middleware asli juga diuji dengan cookie Astro yang belum diserialisasi, redirect empat realm, dan header timing. Unit/integrasi sintetis dan build produksi lulus; tidak ada DB produksi yang diubah.

**Sebelum rollout:** pada preview deployment yang sama, ukur URL thumbnail baru (MISS lalu HIT) dengan cache browser normal; periksa `x-vercel-cache`, `Age`, bytes dan region. Untuk HTML, periksa keenam URL tanpa query, lalu `?preview=1`, error, portal/login/API dan expiry setelah 60 detik. Ubah satu konten CMS sintetis, bandingkan preview langsung dan hasil revalidasi URL normal; pastikan artikel unpublish/pengumuman expired tetap fresh. Catat `Server-Timing`/TTFB minimal tiga kali per kondisi. Jangan menyimpulkan performa database atau menetapkan batas stale produksi dari fixture lokal. Shared CDN HIT/expiry, cold start R2/Neon, spotlight LCP, dan skor PageSpeed masih menunggu verifikasi deployment pada tahap 5.

## Baseline dan metode

Laporan sumber: [PageSpeed desktop](https://pagespeed.web.dev/analysis/https-smksnu-darhik-demo-kalsara-id/ksfm0o20xh?form_factor=desktop) dan [mobile pada laporan yang sama](https://pagespeed.web.dev/analysis/https-smksnu-darhik-demo-kalsara-id/ksfm0o20xh?form_factor=mobile). Data Lighthouse desktop dan mobile berhasil diekstrak dari laporan tersimpan, bukan dari menjalankan ulang PageSpeed. Lighthouse 13.5.0; pengambilan data sekitar 15 Oktober 2026 pukul 23.57 WIB.

| Metrik | Desktop | Mobile |
| --- | ---: | ---: |
| Performance | 69 | 49 |
| First Contentful Paint | 1,6 s | 8,0 s |
| Largest Contentful Paint | 3,2 s | 16,8 s |
| Total Blocking Time | 170 ms | 330 ms |
| Cumulative Layout Shift | 0,055 | 0,070 |
| Speed Index | 1,9 s | 8,0 s |
| Total transfer | 5.059 KiB | 5.035 KiB |
| Potensi penghematan gambar | 2.271 KiB | 1.967 KiB |
| Potensi pengurangan render blocking | 1.080 ms | 7.160 ms |

Angka awal 1,6 s / 3,2 s adalah metrik desktop. Mobile memiliki hambatan jauh lebih besar. Estimasi penghematan antar-insight saling berinteraksi dan tidak boleh dijumlahkan sebagai prediksi kenaikan skor.

Pemeriksaan tambahan:

- Membaca source layout, komponen publik, query CMS, upload R2, endpoint thumbnail, dan konfigurasi Astro/Vercel.
- Mengambil HTTP publik untuk `/`, `/fasilitas`, `/berita`, `/faq`, `/guru`, `/galeri`, `/profil`, dan `/api/announce`.
- Mengamati Chrome headless pada viewport 1366×768 dan 390×844, browser cache dimatikan, tanpa scroll, tanpa pembatasan CPU/jaringan. Viewport mobile memakai user agent desktop; pengamatan ini untuk diagnosis elemen/request, bukan pengganti emulasi mobile Lighthouse.
- Mencoba konversi aset lokal dengan Sharp di memori serta mengambil satu contoh thumbnail dan subset font publik. Tidak mengubah aset aplikasi atau data produksi.

Data mentah lokal berada di `artifacts/ui-qa/performance-2026-10-16/` dan diabaikan Git: laporan Lighthouse kedua perangkat, ringkasan, HTTP, network browser, screenshot, analisis PNG, dan alat audit sementara. Ringkasan dalam dokumen ini tetap tersedia tanpa artefak tersebut.

## Temuan baseline dan rekomendasi awal

Bagian ini mencatat kondisi sebelum implementasi. Status perubahan yang sudah selesai terdapat pada hasil tahap 1–3 di atas.

### P1 — Gambar statis sangat besar; logo didominasi chunk tambahan PNG

Lokasi: [Header](../src/components/Header.astro), [Footer](../src/components/Footer.astro), [BaseLayout](../src/layouts/BaseLayout.astro), dan [beranda](../src/pages/index.astro).

| Aset | Ukuran asli | Hasil percobaan | Keterangan |
| --- | ---: | ---: | --- |
| Logo 113×113 | 969.729 B | WebP lossless 19.248 B | PNG hasil re-encode 40.651 B; WebP kualitas 80 pada lebar 80 menjadi 4.104 B |
| Hero 947×1115 | 896.450 B | WebP kualitas 80: 28.034–62.400 B | Lebar percobaan 480, 768, 947 |
| Kepala sekolah 478×561 | 262.445 B | WebP kualitas 80: 4.876–9.112 B | Lebar percobaan 240 dan 440 |

PNG logo memiliki chunk `caBX` berukuran 934.814 B, sekitar 96% dari berkas. Logo tampil 40×40 CSS pixel. Beban ini terkonfirmasi di PageSpeed dan browser produksi. Gambar di header/footer berbagi URL sehingga tidak dihitung dua kali sebagai dua unduhan gambar. Browser audit juga meminta URL logo sebagai favicon; permintaan favicon tambahan ini tidak dijumlahkan ke baseline PageSpeed.

Ketiga aset ini bersama-sama berukuran 2.128.624 B. Percobaan logo lossless + hero lebar 947 + kepala sekolah lebar 440 menghasilkan 90.760 B, pengurangan sekitar 95,7% untuk ketiga berkas. Ini estimasi payload, bukan jaminan kualitas visual atau skor.

Rencana:

1. Simpan sumber asli; hasilkan varian WebP statis saat build/persiapan aset, dengan nama berkas berversi. Gunakan logo lossless terlebih dahulu dan favicon kecil tersendiri.
2. Pasang `srcset`, `sizes`, dimensi/aspect ratio yang benar, dan pertahankan transparansi. Sediakan hero beberapa lebar tanpa memperbesar sumber di atas 947 px.
3. Perbarui seluruh pemakai logo, termasuk layout admin/portal dan slip cetak yang ditemukan saat implementasi; pertahankan alternatif teks dan ukuran tampilannya.
4. Periksa crop, transparansi, ketajaman logo, dan foto pada DPR 1/2. Pilih kualitas akhir setelah pemeriksaan visual.

Astro menyajikan berkas `public/` apa adanya dan `<img>` biasa tidak memproses gambar. Gunakan pipeline aset yang menghasilkan file statis; jangan sampai optimasi aset tetap justru menambah transformasi server pada setiap kunjungan. [Dokumentasi gambar Astro](https://docs.astro.build/en/guides/images/).

### P1 — Font ikon sekitar 1,14 MB untuk sedikit ikon

[BaseLayout](../src/layouts/BaseLayout.astro) meminta Material Symbols dengan rentang weight 100–700 dan FILL 0–1. Network tree PageSpeed mencatat transfer font sekitar 1.138.185 B; browser audit mengonfirmasi ukuran sebanding. Plus Jakarta Sans sendiri sekitar 28 KB.

Percobaan memakai 18 nama ikon pada HTML beranda, weight 500 dan FILL 0 menghasilkan WOFF2 sebesar **4.144 B**. Percobaan ini membuktikan besarnya peluang, tetapi 18 ikon beranda belum mencakup semua halaman maupun ikon dinamis CMS.

Rencana:

- Batasi ikon dan axis ke yang dipakai. Untuk ikon tetap, komponen [Icon SVG yang sudah tersedia](../src/components/ui/Icon.astro) bisa digunakan jika pemetaannya sesuai; tidak perlu memasang library ikon baru.
- Inventaris ikon pada halaman publik, layout, dan nilai CMS. `IconPicker` juga menerima nama bebas: subset harus memasukkan nama yang benar-benar dirender atau menyediakan fallback yang jelas. Jangan memakai daftar beranda saja secara global.
- Pertahankan Plus Jakarta Sans dan weight yang digunakan. Hilangkan request stylesheet Google dari jalur kritis dengan WOFF2 lokal beserta lisensi dan `@font-face`, bila hasil pengukuran tahap ini masih menunjukkan penundaan font.
- Untuk teks, pertahankan `font-display: swap`; cocokkan metrik fallback bila pergantian font masih menggeser layout. Untuk icon font, gunakan slot dimensi tetap dan kebijakan display yang mencegah nama ligature tampil sebagai teks. Jika semua ikon suatu layout sudah SVG, hapus font ikon dari layout tersebut.

`preconnect` dan `display=swap` sudah ada. Menambah keduanya lagi tidak menyelesaikan masalah. Pembatasan `icon_names` dan axis merupakan mekanisme resmi Google Fonts. [Panduan Material Symbols](https://developers.google.com/fonts/docs/material_symbols).

### P1 — Embed YouTube dan Maps tetap diunduh meskipun lazy

Lokasi: [beranda](../src/pages/index.astro), section DHTV dan peta.

| Pihak ketiga | Transfer desktop | Main thread desktop | Transfer mobile | Main thread mobile |
| --- | ---: | ---: | ---: | ---: |
| YouTube | 1.001.027 B | 495 ms | 990.303 B | 598 ms |
| Google Maps | 478.991 B | 267 ms | 470.819 B | 312 ms |

Angka berasal dari insight pihak ketiga PageSpeed. Main-thread time bukan TBT dan tidak boleh langsung dikurangkan dari TBT. Pada browser desktop, kedua iframe mulai meminta dokumen tanpa scroll; lazy loading native tidak menjamin tidak ada unduhan sebelum interaksi.

Rencana: tampilkan preview ringan dan tombol **Putar video** / **Tampilkan peta**; buat iframe setelah klik. Pertahankan rasio, akses keyboard, judul iframe, dan link langsung untuk fallback. Gunakan preview video yang ada, tanpa memuat SDK. Pastikan tidak ada request player/Maps sebelum klik. [Panduan facade Lighthouse](https://developer.chrome.com/docs/lighthouse/performance/third-party-facades).

Insight cache 14 KiB pada desktop berasal dari Maps/Doubleclick. Insight font display 10 ms menunjuk Roboto milik embed. Kedua angka ini bukan alasan mengganti font utama atau memaksakan header cache ke resource pihak ketiga yang tidak dikendalikan aplikasi.

### P1 — Prioritas LCP dan jalur CSS/font perlu dibenahi sesuai perangkat

PageSpeed mengidentifikasi hero sebagai LCP desktop dan `<h1>` sebagai LCP mobile; pengamatan browser mendukung keduanya. Hero sudah `loading="eager"` dan ditemukan pada HTML awal. Yang belum ada adalah `fetchpriority="high"`.

Tiga stylesheet memblokir render: CSS aplikasi serta dua stylesheet Google Fonts. CSS aplikasi ditransfer sekitar 10 KB dengan Brotli, sehingga menghapus desain atau menulis ulang Tailwind bukan prioritas.

Rencana:

- Berikan prioritas tinggi pada hero yang benar-benar dirender, mencakup hero bawaan dan cabang spotlight CMS. Jangan memuat dua cabang sekaligus.
- Pertahankan eager untuk LCP; tetap lazy untuk gambar di bawah fold. Jangan memberi high priority pada semua gambar.
- Terapkan hasil optimasi font di atas agar judul mobile bisa tampil lebih cepat. Preload hanya aset kritis yang terbukti terlambat; hindari preload hero alternatif yang tidak dipakai.
- Ukur ulang setelah perubahan. Breakdown insight berasal dari trace, sedangkan nilai metrik utama memakai simulasi Lighthouse; jangan menjumlahkan angka kedua jenis pengukuran untuk menjelaskan 16,8 s.

Analisis LCP harus memisahkan waktu respons, penemuan resource, transfer, dan render; mengecilkan satu gambar saja tidak menjamin semua penundaan hilang. [Panduan optimasi LCP](https://web.dev/articles/optimize-lcp).

### P2 — Thumbnail CMS belum konsisten dipakai

Lokasi: [beranda](../src/pages/index.astro), [berita](../src/pages/berita.astro), [galeri](../src/pages/galeri.astro), [guru](../src/pages/guru.astro), [endpoint image](../src/pages/api/image/[...key].astro), [upload R2](../src/lib/r2.ts).

Artikel beranda meminta gambar asli 308.725 B. Endpoint yang sudah tersedia, untuk berkas yang sama dengan `?w=600`, menghasilkan WebP 68.838 B. `/fasilitas` dan `/prestasi` sudah memakai thumbnail; berita/galeri/foto guru belum konsisten. Helper yang ada hanya bekerja untuk URL relatif `/api/image/`, sehingga URL R2 eksternal perlu ditangani sesuai jalur yang didukung.

Upload baru sudah dikompresi Sharp maksimal 1800 px. Endpoint image sudah memasang cache satu tahun dan browser produksi melihat CDN `HIT` untuk gambar artikel asli. Perbaikan utama adalah menggunakan ukuran yang tepat, bukan menambahkan ulang kompresi/cache yang sudah ada.

Rencana: gunakan satu pola thumbnail yang mengikuti konvensi repo, kelompok ukuran terbatas, `srcset/sizes`, dan thumbnail pada kartu. Original tetap untuk tampilan penuh/unduh. Uji URL dengan query yang sudah ada serta URL eksternal. Uji cold/warm variant karena cache miss mengambil original dari R2 lalu menjalankan Sharp; satu contoh miss memerlukan sekitar 3,7 s dari klien audit. Jangan menandai gambar LCP CMS selesai dioptimasi sebelum latency varian diuji.

### P2 — Query SSR dan cache HTML publik perlu pengukuran terpisah

[Beranda](../src/pages/index.astro) memakai `prerender=false`, walaupun konfigurasi Astro menggunakan output static. Terdapat tiga query berurutan yang independen, lalu satu query pengisi prestasi bila diperlukan. Ini bukan N+1, tetapi serialisasi menambah waktu tunggu. Query artikel list mengambil record lengkap termasuk konten yang tidak ditampilkan pada kartu.

HTTP biasa menunjukkan HTML `x-vercel-cache: MISS` dan `age: 0` pada sampel beranda serta halaman publik lain. Tiga probe beranda lanjutan menerima header setelah 1,15–1,88 s; Chrome pada jalur lain menerima byte awal sekitar 85–135 ms. Variasi ini belum membuktikan lokasi bottleneck, Neon cold start, atau kekurangan pool.

Rencana:

1. Paralelkan tiga pembacaan independen; pertahankan ketergantungan query pengisi. Ambil hanya field kartu dengan `select` pada beranda dan list berita.
2. Ukur waktu query, server render, cache miss/hit, dan region Vercel terhadap Neon tanpa mencatat data siswa/PIN. Jangan mengubah pool atau index sebelum query lambat terbukti.
3. Pertimbangkan CDN cache HTML hanya pada allowlist GET/HEAD halaman CMS anonim yang identik untuk semua pengunjung. Awali TTL singkat, misalnya 60 s; browser tetap revalidasi. Tentukan batas keterlambatan publish/unpublish dan pengumuman kedaluwarsa sebelum mengaktifkannya.
4. Preview admin melewati cache; respons dengan personalisasi/`Set-Cookie` tidak masuk cache bersama. Portal, login, PIN, ballot, partisipasi, status periode dan semua API sesi tetap `private, no-store`. Jangan memberi aturan cache wildcard untuk seluruh `/api` atau halaman e-voting.
5. Uji hit normal dengan cache browser diaktifkan, perubahan CMS, expiry, dan respons error. Mode `Network.setCacheDisabled` pada audit bukan alat validasi hit browser normal. [Aturan cache Vercel](https://vercel.com/docs/caching/cache-control-headers).

### P2 — Banner pengumuman muncul terlambat dan menggeser konten

[AnnounceBar](../src/components/AnnounceBar.astro) awalnya hidden, mengambil [API pengumuman](../src/pages/api/announce.ts) ber-header `no-store`, lalu menambahkan tinggi di atas header. Browser desktop mencatat shift konten utama sekitar 0,038 setelah pengumuman dimuat. PageSpeed juga mengatribusikan shift pada konten utama serta pergantian font.

Rencana: pada halaman SSR, render pengumuman aktif pada respons awal dengan menggunakan hasil query yang relevan; hindari fetch tambahan yang mengubah tinggi setelah paint. Pada halaman statis, sediakan ruang banner yang stabil bila fetch tetap digunakan. Pertahankan rotasi, dismiss, serta pengumuman baru yang muncul kembali; uji pesan panjang dan pembungkusan mobile. Jika API diberi TTL pendek, batasi pada expiry terdekat dan kebijakan kesegaran, bukan cache panjang tanpa invalidasi.

### P3 — Risiko pertumbuhan data dan cakupan dashboard

Galeri membaca seluruh record lalu memfilter album di aplikasi dan merender semua kartu. Terapkan pagination/filter server ketika jumlah foto meningkat, dengan ukuran halaman yang jelas. List guru/prestasi juga perlu dipantau; jangan menambah pagination pada data kecil tanpa kebutuhan.

Build lokal memiliki chunk chart sekitar 779 KB dan editor sekitar 378 KB sebelum kompresi. Keduanya tidak terlihat pada network beranda. Audit dashboard terautentikasi dilakukan terpisah: periksa pemuatan hanya pada route yang membutuhkan chart/editor, pagination tabel, serta request berulang. Jangan menganggap chunk admin sebagai penyebab skor beranda.

## Urutan implementasi dan kriteria selesai

Tahap 1–4 selesai secara lokal; tahap 5 memerlukan pengukuran deployment, termasuk validasi CDN pada tahap 4.

| Tahap | Pekerjaan | Validasi sebelum lanjut |
| --- | --- | --- |
| 1 — selesai lokal | Optimasi logo/favicon, hero, kepala sekolah; markup responsive dan prioritas hero | Ketiga gambar total 90.760 B; generator, build, QA browser, dan perbandingan visual lulus; spotlight masih perlu verifikasi CMS nyata |
| 2 — selesai lokal | Subset ikon, fallback nama CMS bebas, dan font teks lokal | Ikon biasa 16.592 B; fallback khusus/admin 354.348 B; tidak ada font aplikasi 1,14 MB atau stylesheet Google; semua 157 glyph, CMS dan picker lulus QA |
| 3 — selesai lokal | YouTube/Maps setelah klik, panel pengumuman tetap, reuse data beranda | Nol request embed sebelum aktivasi; keyboard/no-JS/fokus/ukuran stage lulus; posisi halaman tetap saat panel berubah; 17 skenario browser dan 2 unit test lulus |
| 4 — selesai lokal | Thumbnail CMS konsisten, query paralel/select, cache HTML allowlist dan Server-Timing | 19 skenario browser, unit/integrasi sintetis dan build lulus; warm browser tanpa render ulang; CDN/R2/TTFB produksi belum diukur |
| 5 | Ulangi audit halaman publik representatif dan ukur dashboard terpisah | Laporan sebelum/sesudah pada deployment dan kondisi yang sama; sisa bottleneck menghasilkan task berdasarkan bukti |

Berikutnya tahap 5: verifikasi preview/deployment dan audit ulang dengan kondisi yang sama dengan baseline, termasuk cache MISS/HIT/expiry dan timing SSR. Tidak diperlukan pengubahan konten sekolah atau alur pemilihan.

Budget awal beranda sebelum interaksi: total transfer ≤500 KB, hero terpilih ≤80 KB, logo lossless ≤20 KB, favicon ≤5 KB, gambar kepala sekolah ≤15 KB. CSS aplikasi terkompresi dijaga ≤20 KB. Budget mencakup resource yang benar-benar diminta sebelum interaksi; gambar lazy tetap dapat dimuat lebih awal oleh browser.

Target lab awal: desktop ≥90, mobile ≥85; LCP ≤2,5 s, FCP ≤1,8 s, TBT ≤200 ms, CLS ≤0,1 dengan sasaran internal ≤0,05. Target ini harus divalidasi, bukan janji skor. Untuk data pengguna nyata, ambang LCP dinilai pada persentil 75; satu run lab tidak membuktikan kelulusan Core Web Vitals. [Penjelasan lab dan field LCP](https://web.dev/articles/optimize-lcp).

## Verifikasi dan pengoperasian

1. Simpan laporan PageSpeed saat ini sebagai baseline. Catat URL deployment, commit, perangkat, Lighthouse, throttling dan status cache pada pengukuran berikutnya.
2. Setelah tiap tahap, jalankan setidaknya tiga run desktop dan tiga mobile dengan kondisi yang sama; bandingkan median serta rentangnya. Jangan membandingkan waktu Chrome tanpa throttling langsung dengan skor simulasi PageSpeed.
3. Periksa beranda dengan hero default dan spotlight, pengumuman aktif/kosong/dismissed/pesan panjang, kartu berita dengan gambar besar, menu mobile, video dan peta. Periksa `/fasilitas`, `/berita` dan detailnya, `/faq`, `/guru`, `/galeri`, `/jurusan`, `/prestasi`, `/profil`.
4. Jalankan build dan QA UI setelah perubahan aplikasi. Untuk perubahan cache/query, tambah pengujian perilaku yang relevan: isolasi sesi, expiry/publish CMS, serta cache miss/hit. Fixture QA memblokir font eksternal tetapi memuat dan memvalidasi WOFF2 lokal; tetap periksa font pada deployment sebenarnya.
5. Uji pada Chromebook dan perangkat mobile nyata. Audit ini belum mengukur perjalanan dashboard/portal terautentikasi atau transaksi voting saat tiga Chromebook digunakan bersama.
6. Rollout melalui deployment preview, lalu produksi setelah validasi. Rollback dengan deployment sebelumnya. Aset berversi menghindari cache lama; tidak ada migrasi DB pada tahap 1–4.

Keterbatasan: belum ada profiling Neon/cold start, cache CDN MISS/HIT/expiry nyata, load test atau pengukuran CrUX/RUM. Commit deployment persis belum diverifikasi. Implementasi tahap 1–4 mengubah aset/font/komponen, query/timing dan kebijakan cache aplikasi serta tooling QA lokal; deployment dan database produksi belum diubah. Skor PageSpeed setelah implementasi belum tersedia karena perubahan belum dideploy.
