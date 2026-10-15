# Audit UI/UX SMKDH
Tanggal: 15 Oktober 2026. Baseline: 2fafc47. Sumber arahan: dashboard_audit.md.
Audit sumber dilakukan sebelum implementasi; temuan di bawah berasal dari markup, query, dan handler, bukan dari rekaman browser.

## Inventaris
| Modul/rute | Pola awal | Perbaikan |
|---|---|---|
| /admin | KPI, grafik alumni/konten, pintasan | Header dan pintasan modul sesuai izin |
| artikel, alumni, prestasi, fasilitas, faq, testimoni, kontribusi | Filter GET, pagination server, SortTh | Pertahankan query server; toolbar dan tabel konsisten |
| jurusan, guru, mitra, ekskul, halaman, pengumuman, download, galeri | Tabel seluruh hasil, sort server | Wrapper tabel lokal untuk dataset kecil |
| pengguna | Filter akun, tabel, form hapus | Dialog bersama; action tetap sesuai izin |
| kelas | Form tambah, tabel, dialog edit | Header, filter lokal, dialog konfirmasi |
| siswa | Form tersembunyi, impor pratinjau, pagination server 10 | Toolbar server, pilihan ukuran halaman, sort server |
| media | Grid media, upload, batas 60 | Shell baru; grid dipertahankan |
| profil-saya, usulan | Profil/form/editor, tabel usulan | Shell/form bersama, tabel usulan lokal |
| pengaturan | Form sekolah | Gaya form bersama |
| e-voting | Daftar periode dan halaman calon/pemilih/PIN/partisipasi | Panduan langkah, kesiapan, tabel dan feedback |
| /admin/*/[id], alumni/kartu/[id] | Editor lengkap, media picker | Halaman khusus dipertahankan; kontrol dan breadcrumb konsisten |
| /admin/login, logout, */delete, artikel/review, clone, alumni/verify, feature | Login atau action HTTP | Tidak diubah kontrak/action-nya |
| /siswa/masuk | Form hanya periode belum tutup, tombol bergantung phase | Jadwal WIB, status jelas, font bersama |
| /siswa | Kartu pemilihan dan kartu layanan | Pemilihan dominan, Coming Soon sekunder |
| /siswa/e-voting/[slug]/pilih | Kartu empat organisasi | Kemajuan dan status partisipasi |
| /siswa/e-voting/[slug]/pilih/[organization] | Radio kandidat, dialog, retry/status | Kemajuan, foto fallback, indikator pilihan, CSRF terbaru |
| /siswa/selesai | Layar umum selesai | Identitas visual bersama, aksi siswa berikutnya |

## Temuan
| ID | Prioritas | Bukti / file | Rekomendasi |
|---|---|---|---|
| UI-01 | Tinggi | AdminLayout: input width:100% juga berlaku checkbox; belum ada pemisahan tipe input | Gaya checkbox/radio khusus |
| UI-02 | Tinggi | Modal logout/delete berupa div, onclick dan tidak trap fokus | dialog native, cancel aman, fokus kembali |
| UI-03 | Tinggi | Halaman siswa Arial; admin Plus Jakarta Sans | Satu token/font dengan fallback lokal |
| UI-04 | Tinggi | Siswa 10 per halaman; roster/PIN seluruh hasil; partisipasi load-more 50 | Pola toolbar/pagination per mode data |
| UI-05 | Tinggi | Halaman kandidat memakai csrfToken saat render, sementara perpanjang sesi memperbarui body.dataset.csrf | Kirim token terbaru dari layout |
| UI-06 | Tinggi | StudentPortalLayout hanya cek bfcache; halaman kandidat tidak punya portal-feedback | Feedback layout dan kedaluwarsa aktif di semua halaman |
| UI-07 | Sedang | Header/breadcrumb/action tersebar inline di semua modul | Komponen header/breadcrumb bersama |
| UI-08 | Sedang | /admin statistik dan pintasan tidak memfilter capability efektif | Pintasan sesuai izin middleware |
| UI-09 | Sedang | Konfigurasi periode hanya jumlah calon; NOT_READY generik | Preflight read-only mengikuti validasi server |
| UI-10 | Sedang | Tabel sederhana tidak punya pencarian/count/empty hasil filter | Enhancement HTML dengan opt-in |
| UI-11 | Sedang | Table th mirip td; dialog/form/padding bervariasi | Token netral, header tabel berbeda, kontrol 44px |
| UI-12 | Sedang | Mobile AdminLayout memaksa semua grid inline menjadi satu kolom | Breakpoint khusus; kartu dan overflow tabel |
| UI-13 | Tinggi | Trigger Ballot_immutable dan audit append-only: reset resmi tidak aman | Database localhost khusus dengan marker ownership |
| UI-14 | Sedang | README masih starter Astro | Panduan lokal, docs dan QA terisolasi |

## Batas audit
Login admin dan pemilihan nyata tidak dijalankan terhadap master siswa resmi. Regression backend diuji dengan fixture sintetis; hasil browser dan simulasi DB dicatat pada rencana implementasi.
