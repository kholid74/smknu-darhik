# E-Voting SMKDH: audit dan rencana implementasi

Status: **usulan, belum diimplementasikan**. Audit lokal 10 Oktober 2026 pada commit `8a35abf`. Lingkup mengikuti [repo_audit.md](../../repo_audit.md); perubahan hanya dokumentasi di direktori ini. Tidak ada koneksi ke database produksi, perubahan schema aplikasi, migrasi, atau deploy.

## Kesimpulan

Aplikasi Astro yang ada cukup untuk modul ini. Pertahankan adapter Vercel, Prisma/PostgreSQL, komponen Astro, serta akun dan kapabilitas internal untuk panitia. Keputusan autentikasi MVP sudah final: NISN + PIN pemilu tercetak membuka dashboard Portal Siswa dengan sesi khusus pemilu, bukan akun siswa permanen. Master `Student` persisten terpisah dari kredensial per periode. Tidak perlu Next.js, React, Redis, atau layanan pemilu baru untuk versi awal.

Fondasi keamanan belum cukup untuk langsung membuka pemilihan: origin check dimatikan, cookie admin tidak memakai `Secure`, belum ada rate limiter lintas instance, dan jalur HTML publik satu origin perlu pemeriksaan XSS. Pemisahan tabel partisipasi dan surat suara menghilangkan tautan langsung pada model, **bukan jaminan anonimitas terhadap pemilik database, operator aplikasi, atau pembaca WAL/log**.

## Dokumen

| Dokumen | Isi |
| --- | --- |
| [Audit repository](01-audit.md) | Fakta, bukti file, kesenjangan dan batas pemeriksaan |
| [Istilah domain](CONTEXT.md) | Istilah yang dipakai konsisten dalam rancangan |
| [ADR 0001](adr/0001-integrasi-dan-batas-kerahasiaan.md) | Arsitektur, alternatif, batas kepercayaan |
| [ADR 0002 — keputusan final autentikasi](adr/0002-autentikasi-portal-siswa-mvp.md) | Portal Siswa, scope PIN pemilu, master Student independen; disetujui untuk desain |
| [Desain teknis](02-desain.md) | Lifecycle, sesi, PIN, RBAC, transaksi, keamanan |
| [Proposal Prisma](03-schema.md) | Model, relasi, constraint SQL dan invariant |
| [Kontrak API](04-api.md) | Route, otorisasi, input/output, error dan retry |
| [UI dan rencana file](05-implementasi.md) | Halaman, komponen, perubahan file, urutan tugas |
| [Pengujian](06-pengujian.md) | Skenario, invariant, kriteria penerimaan |
| [Operasional](07-operasional.md) | Deploy, migrasi, backup, rollback dan hari pemilihan |

## Kebutuhan yang sudah tetap

- Empat organisasi: OSIS, Dewan Ambalan, IPNU, IPPNU. **Semua siswa terdaftar mendapat empat hak pilih**, tanpa filter gender atau organisasi.
- Satu pasangan ketua/wakil per organisasi, per siswa, per periode. Pilihan final setelah tersimpan; tidak ada pengubahan atau pencabutan suara.
- Jadwal buka/tutup bersama. Hasil kandidat tidak boleh tersedia lewat aplikasi sebelum penutupan resmi.
- NISN dan PIN unik per periode, dibuat/dicetak administrator berizin dan dibagikan individual; tidak ada registrasi mandiri, pembuatan password permanen atau alur reset password siswa.
- Login yang masih memiliki hak pilih selalu menuju dashboard `/siswa`; E-Voting hanya dapat diakses selama periode valid. Layanan masa depan berupa kartu Coming Soon non-interaktif, tanpa akses personal/akademik melalui PIN pemilu.
- Setelah empat suara tersimpan, cabut sesi dan tampilkan layar selesai. Pemilih parsial dapat masuk lagi memakai PIN valid yang sama selama periode masih dibuka.
- Master `Student` persisten tidak menyimpan PIN/password/sesi; snapshot pemilih, kredensial dan sesi terbatas periode. Akun permanen di luar MVP.
- Roster periode disinkronkan dari master siswa berdasarkan tahun ajaran kelas; data siswa diimpor satu kali ke master, tidak diimpor ulang ke setiap pemilihan.
- Pasangan calon hanya memakai `Student` master, dengan satu CHAIR dan satu VICE_CHAIR dari siswa berbeda. Nama/kelas snapshot dan foto opsional per anggota; visi/misi dan nomor ballot ada pada pasangan. Jumlah pasangan fleksibel, tetapi satu siswa tidak dapat ditugaskan dua kali pada organisasi/periode yang sama. Perubahan kandidat diaudit dan terkunci setelah pembukaan; Ballot tetap anonim. Riwayat pencalonan dapat dicari lewat studentId, tanpa riwayat jabatan/masa kerja di MVP.
- Tiga Chromebook bersama disediakan saat pemilihan. Maksimal tiga akun siswa aktif bersamaan, satu siswa per Chromebook; siswa bergantian memakai perangkat. Tidak ada mode perangkat pribadi serentak untuk MVP. Sesi terputus dapat dilanjutkan tanpa kehilangan suara yang sudah tersimpan.
- Riwayat dan identitas periode mendukung pemilihan tahun berikutnya.

## Keputusan desain yang disepakati

Keputusan berikut telah dikonfirmasi pengguna dan menjadi dasar seluruh dokumen rencana. Ini bukan izin implementasi kode.

Keputusan: operator database pihak tepercaya; roster disahkan registrar dan membership beku saat periode dibuka; koreksi NISN dari sumber resmi memerlukan dua pemeriksa serta mempertahankan Student ID. Koreksi identitas voter yang belum memberi suara tetap dapat dilakukan dengan PIN baru; setelah memilih, NISN tidak diubah. Penambahan roster hanya sebelum buka.

Jadwal dapat diperpanjang satu kali maksimal 60 menit oleh ketua/pengelola pemilu yang bukan pengelola PIN. Alasan, aktor dan waktu diaudit; close resmi tidak dapat dibatalkan. Gangguan setelah perpanjangan dihentikan pada tenggat dan didokumentasikan; sekolah dapat memutuskan periode baru untuk semua pemilih, tanpa suara kertas tercampur atau transfer suara.

Calon tunggal diperbolehkan setelah alternatif resmi ditarik/dieliminasi dan dicatat. Seri tetap seri menurut kebijakan tertulis sekolah; aplikasi mencatat turnout tanpa quorum dan tidak menentukan pemenang. Pengunduran diri calon setelah buka tidak mengubah ballot/slate; pemilihan ulang memakai periode baru bagi semua pemilih.

Penutupan resmi setelah deadline memerlukan rekonsiliasi; publikasi agregat per organisasi dilakukan terpisah setelah tutup dan persetujuan, tanpa breakdown kelompok. Akun panitia individual dan saksi dua orang untuk penerbitan PIN, penutupan serta publikasi merupakan prosedur, bukan enforcement aplikasi; wildcard superadmin tetap dapat melewatinya dan penggunaan darurat wajib diaudit.

Sesi: 5 menit idle, 15 menit absolut. Jumlah pemilih kurang dari 100. Pelaksanaan memakai tiga Chromebook bersama, maksimal tiga akun siswa aktif bersamaan dan satu akun pada setiap perangkat. Uji tiga sesi bersamaan serta pergantian siswa yang aman pada perangkat yang sama; tidak perlu menguji akses serentak seluruh pemilih. Setelah masa sanggah 30 hari hapus PIN/sesi; roster/audit disimpan setahun, hasil agregat lintas periode, master Student independen mengikuti kebijakan retensi sekolah.

Rincian teknis ada di dokumen desain, schema, API, pengujian, dan operasional berikut. Kesepakatan desain ini tetap tidak memberi izin implementasi kode.

## Verifikasi audit

Source, lockfile, 19 direktori migrasi, konfigurasi, pola route/admin, dan tiga file unit test diperiksa pada audit awal. Setelah seluruh keputusan dikonfirmasi, 11 dokumen diperiksa: 51 tautan lokal valid. Revisi kandidat ditinjau lintas tujuh dokumen terkait: 18 tautan lokal valid, kontrak nama-bebas sudah dihapus dan relasi Ballot tetap anonim. Kode aplikasi tidak diubah. Build, test aplikasi, validasi Prisma, migrasi aktual, dan uji browser belum dijalankan dalam pekerjaan dokumentasi ini. Proposal schema belum dikompilasi oleh Prisma; validasi dan integrasi adapter Neon adalah pekerjaan implementasi, bukan dianggap selesai oleh audit. Referensi eksternal ditautkan dekat keputusan yang menggunakannya.

**Gerbang implementasi:** `repo_audit.md` meminta “Stop and request approval before starting implementation.” Dokumen ini merupakan bahan persetujuan; jangan mengubah kode aplikasi atau menjalankan migrasi sebelum persetujuan tersebut.

## Pembersihan hasil testing ? 15 Oktober 2026

[Panduan Hapus data uji](08-pembersihan-data-uji.md) menjelaskan migrasi klasifikasi dua sampel awal, batas superadmin, popup berlapis, password login, data yang dibersihkan dan audit yang dipertahankan. Fitur ini telah diotorisasi operator setelah implementasi awal; gerbang persetujuan dokumentasi historis di atas tidak membatalkan instruksi implementasi berikutnya.
