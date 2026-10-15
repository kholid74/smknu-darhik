# Audit CMS halaman publik dan navigasi admin

Status: audit dan proposal. Dokumen ini belum mengubah Prisma schema atau database.

## Ringkasan menu admin

Sidebar admin sekarang mengelompokkan menu menjadi **Modul**, **Konten Website**, **Data Sekolah**, **Prestasi & Alumni**, **Media**, **Pengaturan**, dan menu personal **Guru**. Akses item tetap mengikuti kapabilitas RBAC yang sudah ada. Absensi tampil sebagai label non-interaktif “Segera hadir”; belum ada route atau fitur absensi.

## Audit konten publik

| Area | Kondisi sekarang | Sumber data yang ada | Rekomendasi |
|---|---|---|---|
| Header dan menu mobile | Label, URL, dropdown, dan tombol PPDB ditulis di `src/data/site.ts` dan komponen | Tidak ada tabel navigasi | Pindahkan label/urutan/visibilitas ke `NavigationItem`; biarkan renderer dan daftar route tetap di kode |
| Footer | Menu, deskripsi sekolah, tautan sosial, serta beberapa kontak ditulis di komponen | `Setting` sudah punya nama, alamat, telepon, email, WhatsApp, dan sosial; footer belum menggunakannya seluruhnya | Gunakan `Setting` untuk profil dan kontak; render menu footer dari grup navigasi footer |
| Beranda | Pengumuman, artikel, dan prestasi sudah dibaca dari DB. Hero, CTA, statistik, sambutan kepala sekolah, alasan memilih, DHTV, jam/alamat/kontak lokasi masih hardcoded | `Announcement`, `Article`, `Achievement`, `Setting` | Jadikan section beranda dapat diurutkan/diaktifkan; data daftar tetap di model masing-masing |
| Profil dan struktur | Narasi, visi/misi, sambutan, struktur, dan sebagian identitas masih berupa markup/data lokal | `Page` ada dan dikelola admin, tetapi halaman publik belum membacanya | Hubungkan halaman publik ke halaman CMS dengan slug stabil; isi rich text dibatasi pada konten yang memang perlu diedit |
| PPDB, PKL, kontak | Instruksi, CTA, jadwal, angka/fakta, dan sebagian kontak masih ditulis dalam halaman | `Partner` dan `Setting` tersedia untuk sebagian data | Simpan teks operasional yang sering berubah di section; jangan simpan layout/HTML bebas |
| Halaman daftar konten | Data inti sudah DB-backed: artikel, jurusan, guru, fasilitas, ekskul, mitra, prestasi, FAQ, galeri, download, alumni, pengumuman | Model konten masing-masing | Pertahankan model terstruktur. Judul/teks pembuka/CTA per halaman dapat dipindahkan bertahap ke CMS |
| Judul dan SEO | Beberapa title/description masih literal dalam tiap route | `Page.metaDesc`, `Setting.metaDefaultTitle`, `Setting.metaDefaultDesc` | Pakai metadata halaman yang tersimpan, dengan fallback default dari `Setting` |

Rute publik yang diperiksa meliputi beranda, profil, struktur, jurusan, guru, fasilitas, ekstrakurikuler, prestasi, FAQ, galeri, berita, download, kontak, PKL, PPDB, alumni, dan hasil E-Voting. Halaman hasil E-Voting adalah bagian aplikasi pemilihan dan sebaiknya tidak dikelola sebagai konten CMS umum.

Build saat ini mem-prerender profil, struktur, kontak, dan PPDB sebagai HTML statis. Jika konten halaman itu kelak dibaca langsung dari database, pilih salah satu mekanisme pembaruan yang eksplisit: render on-demand untuk halaman CMS, atau rebuild/redeploy setelah publish. Untuk admin yang mengharapkan perubahan langsung, on-demand lebih sesuai; pastikan konfigurasi output dan adapter mendukungnya.

## Usulan struktur database

Pertahankan tabel entitas yang sudah ada. Jangan membuat satu tabel “semua konten” yang menduplikasi artikel, guru, jurusan, dan seterusnya.

1. **`Setting` (yang sudah ada)** menjadi sumber profil situs: nama, tagline, alamat, kontak, sosial, dan SEO default. Untuk kebutuhan berikutnya, tambahkan hanya field yang dipakai, misalnya jam operasional dan deskripsi footer. Logo tetap menggunakan media library yang sudah ada.
2. **`NavigationItem` (baru)** menyimpan menu publik, bukan sidebar admin:

   | Field | Tujuan |
   |---|---|
   | `id` | ID stabil |
   | `menu` | `MAIN` atau `FOOTER` |
   | `parentId` | relasi ke item induk untuk dropdown |
   | `label` | teks yang ditampilkan |
   | `href` | path internal atau URL eksternal |
   | `order` | urutan di dalam menu/induk |
   | `active` | tampil atau disembunyikan |
   | `openInNewTab` | perilaku tautan eksternal |

   Validasi admin harus membatasi path internal ke rute yang didukung; menu tidak boleh membuat route baru secara dinamis. Relasi induk sebaiknya dibatasi satu tingkat agar cocok dengan UI sekarang.

3. **`SiteSection` (baru)** menyimpan konten section yang memang perlu diedit tanpa mengubah layout:

   | Field | Tujuan |
   |---|---|
   | `id` | ID stabil |
   | `pageKey` | kunci tetap seperti `home`, `profil`, `ppdb`, `pkl`, `contact` |
   | `sectionKey` | identitas section unik pada halaman, misalnya `hero` atau `principal-message` |
   | `type` | jenis section dari enum terbatas, bukan nama komponen bebas |
   | `title`, `body` | teks utama opsional |
   | `data` | JSON terstruktur untuk field khusus section, tervalidasi menurut `type` |
   | `order` | urutan tampil |
   | `enabled` | tampil atau sembunyikan section |
   | `updatedAt` | waktu perubahan |

   Beri unique constraint pada `(pageKey, sectionKey)` dan index `(pageKey, enabled, order)`. Gunakan type terbatas seperti `HERO`, `TEXT`, `QUOTE`, `CTA`, `FEATURE_LIST`, `CONTACT_INFO`, `VIDEO_PROMO`, dan `ENTITY_LIST`. `ENTITY_LIST` hanya menyimpan jenis entitas dan opsi tampilan; datanya tetap dibaca dari model asal. Jangan menaruh HTML mentah atau salinan artikel/prestasi di JSON.

`Page` tetap cocok untuk halaman informatif berbasis isi panjang, tetapi tidak perlu dipaksakan menjadi page builder. Untuk route tetap seperti PPDB dan kontak, `SiteSection` menyediakan teks terstruktur sementara komponen Astro mengontrol markup, validasi, dan aksesibilitas.

## Alur pembaruan yang disarankan

Admin membuka **Konten Website → Navigasi** atau **Konten Website → Halaman Beranda/Profil/PPDB**. Form hanya menampilkan field yang sesuai jenis section. Perubahan divalidasi, disimpan sebagai draft/published bila kebutuhan review sudah disepakati, lalu langsung dibaca pada render server. Untuk tahap awal yang lebih kecil, simpan satu versi aktif dan catat `updatedAt`; revision history dan preview draft dapat ditambahkan ketika workflow editorial diperlukan.

Untuk rollout, migrasi bertahap: (1) tambahkan tabel dan seed salinan dari `site.ts`/markup saat ini, (2) ubah renderer agar membaca DB dengan fallback ke nilai lama, (3) pindahkan admin form dan uji tampilan semua breakpoint, (4) hapus fallback hanya setelah data seed diverifikasi. Ini menjaga halaman publik tetap tersedia jika seed atau data CMS belum lengkap.

## Batas dan risiko

- Pengubahan navigasi perlu validasi URL, nesting, dan label; item yang menunjuk route yang tidak ada harus ditolak atau ditandai sebelum publish.
- Section jangan bisa memilih komponen atau script dari input admin. JSON harus divalidasi dengan schema per `type` dan teks kaya harus disanitasi.
- Konten yang menyatakan angka, akreditasi, periode PPDB, kontak, dan jam operasional perlu pemilik data yang jelas; audit kode menemukan beberapa nilai dummy/perlu konfirmasi.
- Usulan ini belum dimigrasikan ke Neon dan belum ada halaman admin CMS baru. Sidebar yang dirapikan hanya perubahan navigasi UI.
