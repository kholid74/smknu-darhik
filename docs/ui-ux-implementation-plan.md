# Rencana implementasi UI/UX
Baseline 2fafc47. Semua implementasi diotorisasi permintaan pengguna 15 Oktober 2026. Dokumen desain dibuat sebelum perubahan aplikasi.

| Prioritas | Pekerjaan | Berkas/dependensi | Acceptance | Risiko regresi |
|---|---|---|---|---|
| P0 quick win | Token, kontrol checkbox, focus/overflow | portal-tokens.css, admin.css, layouts | Checkbox kecil; font konsisten; 44px controls | CSS inline lama |
| P0 | Dialog delete/logout native | ConfirmDialog, AdminLayout | Escape/cancel/fokus; POST action sama | form.submit bypass validasi sengaja untuk form hapus existing |
| P1 | Komponen halaman/form/table/feedback | components/ui, lib/ui | Slot dan identifier lama tetap bekerja | handler target DOM |
| P1 | Tabel kecil CMS/kelas/roster/PIN | DataTable, data-table.ts | Search/filter/sort/page-size/default10/count | Bulk PIN lintas halaman |
| P1 | Student master server controls | siswa/index, students.ts | Query terjaga, sorting/size bounded | Parameter invalid |
| P1 | Dashboard dan panduan setup periode | admin/index, e-voting/[id]/index, readiness.ts | Langkah sesuai izin; status real readiness | Tidak menggantikan validasi transaksi |
| P1 | Student journey | StudentPortalLayout, siswa/** | Dominant election, progress, selection, expired feedback | Token/session expiry |
| P1 | Seed/reset lokal | scripts, simulation guard, compose, prisma.ts | URL/ownership/production ditolak, data sintetis | Guard runtime dan reset |
| P2 | Dokumentasi/QA | tujuh dokumen, README, unit tests | Build/unit lulus; batas browser dilaporkan | Jangan mengklaim pengujian live yang tidak dilakukan |

## QA regression
69 tes baseline: auth realm/RBAC/input/CSRF/PIN/sesi/projection anonimitas/import. Tambahan: filter/sort/paging, readiness, guard simulator.
Target regresi browser: keyboard delete/cancel/logout; drawer mobile; checkbox PIN maksimum25 lintas pagination; master siswa query server; calon edit/cancel; vote partial/retry/4th completion; session expiry; viewport 390×844, 768×1024, 1366×768. Cakupan yang benar-benar dijalankan dicatat di bawah.
Tidak ada migrasi schema bisnis dan tidak ada reset database resmi. Validasi security/transaction/trigger tidak dilonggarkan.

## Status
Implementasi selesai pada 15 Oktober 2026: shell admin dan portal memakai token bersama; header, tabel, pagination, dialog dan feedback diseragamkan; panduan kesiapan periode mengikuti validasi penjadwalan yang sama. Form calon tetap berfungsi tanpa izin pustaka media. Form pembuatan periode dan tautan kelola calon mengikuti capability pengguna.

Hasil verifikasi:
- `npm test`: 79/79 lulus, termasuk regresi backend yang sudah ada serta pengujian state tabel, batas parameter, kesiapan periode, dan guard simulator.
- `npm run build`: lulus. Peringatan chunk di atas 500 kB masih ada; tidak menambahkan framework/dependensi UI.
- `npm run qa:ui`: 9/9 skenario lulus, tanpa exception JavaScript. Meliputi pagination default10, pencarian/empty, filter/ukuran halaman, sorting/seleksi lintas halaman, dialog cancel/confirm, drawer dengan Escape, overflow tablet, pembaruan CSRF/logout, dan penghapusan layar privat saat sesi kedaluwarsa.
- Screenshot desktop 1366×768 dan mobile 390×844 ditinjau; viewport tablet 768×1024 diperiksa melalui DOM. Hasil lokal ada di `artifacts/ui-qa/` (diabaikan Git).
- Tidak ada dev server yang tersisa setelah pemeriksaan.

Batas verifikasi: fixture browser memakai data sintetis dan mock activity/logout, sehingga bukan bukti CRUD dengan database atau transaksi empat suara end-to-end. Seed/reset dan skenario partial/completed/expired pada PostgreSQL lokal belum dijalankan karena Docker daemon tidak tersedia. Pencarian partisipasi hanya mencakup baris yang sudah dimuat; kontrol muat berikutnya tetap tersedia. Database Neon, master siswa resmi, dan schema bisnis tidak diubah. Tidak ada route QA dalam build aplikasi.

## Tambahan: pembersihan sampel yang diotorisasi operator

Permintaan berikutnya menambah fitur Hapus data uji, klasifikasi isTest, migrasi 20261015140000_test_period_cleanup, proteksi penghapusan bersyarat, audit yang mempertahankan UUID periode lama, dan dua popup dengan password. Pernyataan tanpa migrasi/perubahan Neon pada status redesign di atas hanya berlaku pada fase redesign awal. Validasi terbaru: 91 tes (termasuk PostgreSQL dalam memori), 10 skenario browser fixture dan build lulus. Pembersihan aktual tetap menunggu tindakan operator di UI; tidak dijalankan otomatis oleh migrasi. [Detail](e-voting/08-pembersihan-data-uji.md).

Migrasi cleanup sudah diterapkan ke Neon dan diverifikasi tanpa menghapus data. Kedua periode sampel, 52 siswa/pemilih dan 8 suara masih tersimpan. Penghapusan nyata menunggu konfirmasi/password operator melalui UI.
