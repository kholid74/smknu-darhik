# UI, dampak file dan urutan implementasi

**Pembaruan T11, 18 Oktober:** endpoint hasil internal dan status publikasi401/429 diterapkan. Regresi232tes lulus (satu penanda tes DB dilewati dan dijalankan terpisah), PostgreSQL lokal lintas koneksi6/6, browser37skenario, Prisma validate/generate dan build lulus. Penerimaan R2/Vercel/perangkat tetap belum selesai. [Bukti T11](06-pengujian.md#bukti-dan-gerbang-rilis).

**Pembaruan upload 18 Oktober:** T10 sudah diimplementasikan dan diuji lokal (228 tes, 37 skenario browser, build lulus). Verifikasi object R2/hosted belum selesai karena konfigurasi R2 lokal belum tersedia. [Bukti dan batas](../image-upload-webp-study.md#implementasi-t10-dan-bukti-terbaru).

**Pembaruan Neon 17 Oktober 2026:** migrasi schema dan cleanup empat periode yang disetujui sudah berhasil setelah backup teruji. Master dan audit lama tetap; deployment belum dilakukan. [Catatan pelaksanaan](13-catatan-migrasi-neon.md).

Status: **T01–T09 selesai lokal; form mode/foto calon, penutupan tanpa turnout penuh dan hasil publik selesai; CTA dashboard selesai; upload dan rilis masih T10–T12.** [Task T00–T12](12-task-implementasi-jenis-dinamis.md), [API](04-api.md), [schema](03-schema.md). Buat periode, pilihan jenis pada form calon, portal dan tabel partisipasi memakai jenis periode. Menu/popup CRUD master, MediaPicker logo dan reorder/edit susunan DRAFT sudah tersedia. Form calon mengikuti mode/jabatan snapshot, dengan foto besar pada portal siswa/guru.

## Halaman dan perilaku target

| Route | Perilaku dan komponen yang dipakai |
| --- | --- |
| `/admin/e-voting/jenis` (baru) | CRUD master jenis: tabel/pencarian/pagination dashboard; nama/logo/mode/jabatan/urutan/aktif. Tambah form, edit popup, toggle aktif, konfirmasi hapus; TYPE_IN_USE mengarahkan nonaktifkan. Code readonly sesudah create; tampilkan error stale dan muat ulang |
| `/admin/e-voting` | CTA Panduan dan Jenis pemilihan; form periode memilih/urut jenis aktif. Default UI menawarkan lima seed bila tersedia, tetap tampilkan pilihan eksplisit; tidak mengasumsikan seluruh master aktif wajib |
| `/admin/e-voting/{id}` | Tampilkan N surat suara/jenis dan urutan snapshot. Edit susunan DRAFT via PUT khusus; setelah dijadwalkan readonly. Checklist menghitung kandidat/roster/PIN/hak dinamis |
| `/admin/e-voting/{id}/calon` | Pilihan jenis dari contest periode; SINGLE hanya ketua/Pradana, OPTIONAL_VICE checkbox/toggle wakil opsional. Search Student menampilkan suggestion nama/NISN/kelas dari DB, menyimpan ID terpilih; teks yang diubah lagi menghapus selectedId. Jangan submit nama bebas |
| `/admin/e-voting/{id}/pemilih` dan `/pin` | Pertahankan route existing pengelolaan roster/PIN; siswa/guru dipilih eksplisit, N hak per voter; check-all hanya target valid dan batch25. Slip dengan URL portal absolut realm yang benar |
| `/admin/e-voting/{id}/partisipasi` | Kolom dari metadata contest terurut; pertahankan badge T00 hijau+✓ Sudah memilih/netral+○ Belum memilih, sama SSR/Muat berikutnya. Pagination existing; tanpa waktu/kandidat pilihan |
| `/admin/e-voting/{id}` aksi Tutup | Setelah dibuka dapat tutup walau siswa absen/parsial; tampilkan lengkap/parsial/belum mulai dan jumlah suara perjenis tanpa kandidat. Popup konsekuensi permanen, alasan bila lebih awal, password caller; tidak menunggu turnout100% |
| `/admin/e-voting/panduan` | Perbarui langkah jenis→periode→calon→pemilih→PIN→jadwal→monitor→tutup→publikasi; bedakan tutup/publish/archive |
| `/siswa/masuk`, `/pemilih/masuk` | NISN+PIN dan kode guru+PIN tetap; login menuju dashboard masing-masing. Pesan scheduled sebelum buka membedakan jadwal mendatang vs tidak ada periode |
| `/siswa`, `/pemilih` | N jenis/progress dari periode, lanjut ke pending pertama, Coming Soon siswa noninteraktif; tombol mulai/perpanjang/logout memakai komponen tombol existing |
| `/{siswa|pemilih}/e-voting/{slug}/pilih` dan `/pilih/{organization}` | Route/string organization tetap; guard contest/session/realm. Foto calon jadi area utama; urutan UI dari contest, server menerima pending mana pun; konfirmasi final dan disable submit sampai selesai |
| `/siswa/selesai`, `/pemilih/selesai` | Generik, sesi sudah dicabut; tidak memuat nama/pilihan sebelumnya. Tombol kembali ke masuk untuk pengguna berikutnya |
| `/e-voting/{slug}/hasil` | Gate CLOSED/ARCHIVED+publishedAt. Header periode/logo, statistik orang selesai/parsial/belum, surat suara dan bagian tiap jenis dengan foto dominan, perolehan/total/persentase. Tidak ada voter/Student ID atau breakdown siswa/guru |

Route roster/PIN aktual dipertahankan pada T05; label menu tetap **Kelola pemilih**, bukan mengganti URL yang sudah dipakai. Nama route baru di atas untuk jenis; hindari membuat alias/redirect yang tidak diperlukan. [Routing Astro](https://docs.astro.build/en/guides/routing/).

## Foto, infografis, tombol dan aksesibilitas

Foto awal target tinggi260–320px desktop menyesuaikan mobile; tunggal satu portrait, berwakil dua setara. Nama/jabatan/nomor jelas, dimensi stabil/aspect-ratio agar tidak CLS, fallback inisial dengan ukuran sama. Foto opsional; bukan alasan menolak calon valid. Reuse thumbnail responsif, sizes/srcset dan loading sesuai letak; jangan fetch semua original1800px. Crop wajah harus diperiksa pada aset representatif.

T06 tersedia lokal: form calon hanya menawarkan wakil pada OPTIONAL_VICE melalui checkbox. Menonaktifkan wakil/memilih SINGLE membersihkan ID, foto dan suggestion yang tertunda. Pemilihan Student tetap melalui master; edit mempertahankan snapshot identitas anggota lama, hanya Student baru mengambil nama/kelas terkini. Form/action tampil sesuai izin dan sebelum pembukaan; server memeriksa waktu DB setelah lock. PATCH/DELETE membandingkan expected termasuk foto; admin tanpa izin media tetap mempertahankan foto lama saat mengedit data calon. Kartu portal memakai thumbnail responsif, portrait tinggi260–320px dengan crop ke atas, fallback setara dan radio/konfirmasi existing. T08 memakai komponen portrait yang sama untuk hasil publik dan ballot.

T07 tersedia lokal pada detail periode: ringkasan lengkap/parsial/belum mulai ditampilkan sebelum konfirmasi, baik penutupan dini maupun setelah deadline. Panitia berizin tutup tidak wajib memiliki izin rincian pemilih. Tidak menuntut semua selesai; roster tetap dan hak tersisa berakhir tanpa ballot tambahan. Alasan dini10–500 karakter dan password wajib; password dibersihkan setelah batal/gagal, tombol mencegah submit ganda dan aktif setelah token keamanan siap. Sebelum pembukaan atau tanpa izin, form tidak ditawarkan; ringkasan gagal dimuat menahan aksi sampai reload. Snapshot, revoke sesi dan audit satu transaksi; tidak auto-publish. Panduan dashboard telah mengikuti alur ini.

T08 tersedia lokal: halaman hasil memakai font/token portal, navigasi logo dari snapshot, ringkasan jumlah orang dan surat suara terpisah, donut3segmen serta bar calon. CandidatePortraits dipakai bersama ballot siswa/guru dan hasil publik; foto opsional/fallback tetap setara dengan srcset/thumbnail. Calon urut nomor, visi/misi memakai details native, seri setara dan nol tanpa peraih tertinggi. Semua hasil/navigasi/detail bekerja tanpa JavaScript; hanya tombol Cetak hasil memakai script kecil. CSS cetak menampilkan visi/misi tertutup, menyembunyikan navigasi/tombol, dan menjaga kartu agar tidak terpotong di tengah. Gate resmi tetap pada layanan getPublishedResult; halaman gagal tidak merender kandidat.

Infografis memakai CSS/SVG ringan tanpa chart library/hydration framework baru. Overall menghitung orang; setiap jenis menghitung ballot; label denominator eksplisit. Persentase calon dari votesCast, nol menampilkan0% tanpa NaN/Infinity. Seri semua pemimpin diberi Perolehan tertinggi; jika semua nol tidak beri label pemenang. Bar dilengkapi teks/angka, tidak bergantung warna atau animasi. Susunan hasil memakai snapshot, bukan master terbaru.

T09 tersedia lokal: komponen ResultsAccess menonjolkan **Lihat hasil voting (tab baru)** pada daftar/detail untuk CLOSED/ARCHIVED+publishedAt; `target="_blank" rel="noopener noreferrer"` juga diterapkan pada langkah Hasil resmi. Status dan tanggal publikasi WIB terlihat tanpa JavaScript. Sebelum publikasi tidak ada link publik; CLOSED belum terbit menawarkan Publikasikan hasil hanya bagi akun evoting.publikasi. Tautan daftar menuju form di atas detail; tombol form aktif setelah CSRF siap, meminta password/konfirmasi, menahan submit ganda dan membersihkan password setelah batal/gagal. DRAFT/SCHEDULED dan ARCHIVED belum terbit tidak menawarkan aksi publikasi. List hanya menambah publishedAt, tanpa mengambil snapshot/tally. Endpoint hasil internal saat T09 masih target kontrak; kini diterapkan T11 pada API berizin, tanpa menambah halaman pratinjau UI baru.

Modal reuse ConfirmDialog/confirmAction dan pola master jurusan/kelas; focus trap/return focus, Escape/cancel, loading dan error terlihat. Label bantuan tidak menggeser garis input, tombol konsisten. Gunakan live region untuk hasil async, radio keyboard dan fokus halaman setelah navigasi. Semua teks user di-escape. [Komponen](https://docs.astro.build/en/basics/astro-components/), [styling](https://docs.astro.build/en/guides/styling/).

T10 lokal memakai prepareUpload + receiveUpload bersama untuk admin/alumni. MediaPicker/UploadWidget memilih photo/logo eksplisit; form mitra/jenis logo memakai lossless, FileUpload document dan alumni photo tetap. Warning indexing terlihat dan URL dipertahankan. Delete media menolak referensi master/contest/calon/snapshot; row lock Media SHARE pada pemasangan foto/logo dan UPDATE pada delete. Kegagalan pembersihan R2 tak terpakai memberi pesan operator. Aset lama tidak diubah. Tidak ada konversi browser/dependency baru.

## Semua tempat perubahan harus mencapai

| Area | Dampak implementasi T02–T11 |
| --- | --- |
| Prisma/migration | schema, client generate, migrasi SQL baru, enum→FK varchar, trigger/deferred constraints, seed lima terpisah dari demo; jangan edit migrasi historis |
| `src/lib/voting` | Inventaris ORGANIZATIONS/VOTING_ORGANIZATIONS, seluruh equality/aggregate empat, vote-input, ballot-pages, setup/periods/candidates/candidate-input/voters/student-auth/student-dashboard-model/student-status/student-session/votes/participation/period-close/result-snapshot/test-cleanup/PIN dan semua caller. Tambah service master jenis memakai pola transaksi repo |
| HTTP/middleware | API types/contests, periods/create/detail, kandidat expected foto, dashboard/status/vote/partisipasi/close/results/publish; middleware capabilities untuk route statis `/types` dan UI `/jenis`, body/CSRF/envelope existing. Hindari `[periodId]` menelan route statis |
| Admin/portal/public | Form periode, calon, pemilih/PIN, partisipasi, close, hasil, navigasi dan panduan. Semua selector/header memakai contest snapshot, tidak enum master |
| Upload T10 | `src/lib/r2.ts`, admin/alumni upload, MediaPicker/UploadWidget/FileUpload, form alumni dan caller lain hasil pencarian; metadata berdasarkan buffer output. Audit juga delete media dan referensi snapshot; tidak mengubah izin pemilu untuk upload |
| Test/fixture | Unit yang mock enum/jumlah empat, SQL integration, auth/session/concurrency, API fixtures, `scripts/ui-fixture` dan `scripts/ui-smoke-test.mjs`; matriks1/5/6, mode calon, early close parsial, snapshot/archive dan batas3sesi |
| Operasi/docs | Panduan dashboard, env template bila benar-benar perlu (target tidak menambah secret), runbook backup/cleanup/migrasi/rollback dan bukti smoke Vercel. Tidak menyalin URL DB atau data siswa ke fixture |

Inventaris ini adalah daftar dampak, bukan izin membangun abstraksi baru atau merombak CMS. Saat mulai tiap task, `rg` seluruh caller dahulu dan perbarui bersama. Pertahankan helper/pola yang sudah ada; target master jenis/hasil tidak membutuhkan komponen React, queue, service worker, akun siswa atau library grafik.

## Urutan rilis

T02 schema/DB terisolasi → T03 master+membership → T04 mekanisme dinamis → T05 UI jenis/periode → T06 calon → T07 early close → T08 hasil → T09 CTA. T10 upload dapat dikerjakan terpisah setelah kontrak, tetapi semua caller harus cocok saat rilis. T11 uji gabungan, T12 cleanup/migrasi Neon dan deploy paket kompatibel dalam maintenance. Jangan deploy client enum empat di atas schema dinamis.

Kriteria selesai per task ada pada backlog. Badge T00 telah diuji lokal sebelumnya; T01 tidak mengklaim CRUD/lima surat suara/tutup parsial/WebP/hasil baru sudah berjalan.
