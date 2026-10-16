# Pemilih guru: keputusan dan implementasi

Disetujui melalui instruksi implementasi 16 Oktober 2026. Guru memilih **OSIS, Dewan Ambalan, IPNU, dan IPPNU**, masing-masing satu suara dengan bobot sama seperti siswa. Hasil digabung per kandidat tanpa breakdown siswa/guru. Nama file dipertahankan agar tautan usulan sebelumnya tetap valid.

| Bagian | Siswa | Guru |
| --- | --- | --- |
| Sumber | Student master sesuai tahun ajaran kelas, dipilih panitia secara eksplisit | Teacher master, dipilih panitia secara eksplisit |
| Login | NISN 10 digit + PIN periode | Kode `GURU-` + 12 karakter heksadesimal + PIN periode |
| Portal | `/siswa/masuk?periode=<slug>` menuju `/siswa` | `/pemilih/masuk?periode=<slug>` menuju `/pemilih` |
| Hak suara | Empat organisasi, sekali per organisasi | Empat organisasi, sekali per organisasi, bobot sama |
| Sesi | Idle 5 menit, absolut 15 menit, satu sesi per pemilih | Sama; sesi voting terpisah dari akun internal |
| Batas | Maksimal **99 pemilih gabungan** siswa dan guru pada periode | Termasuk dalam batas yang sama |

## Alur panitia

1. Siapkan master guru di `/admin/guru`. Guru tidak wajib memiliki Account, NIP, atau akun permanen. Jangan membuat guru sebagai Student atau memakai NISN buatan.
2. Dalam DRAFT, atau SCHEDULED sebelum `opensAt`, buka **Kelola Pemilih → Pemilih dari master guru**. Cari nama pada tabel, centang guru yang berhak, pilih **Pratinjau guru terpilih**, periksa nama dan jumlah gabungan, kemudian **Tambahkan pemilih guru** dan setujui popup. Tidak ada guru yang otomatis dicentang atau ditambahkan. DRAFT dengan tanggal lewat tetap bisa disiapkan; jadwal harus diperbaiki sebelum schedule sesuai [aturan terbaru](10-daftar-pemilih-dan-draft.md).
3. Server membaca ulang ID dari Teacher master, mengunci periode, memeriksa waktu DB/batas 99, membuat snapshot nama, kode guru dan empat hak pilih, serta audit dalam satu transaksi. ID tidak valid ditolak seluruhnya. Sinkronisasi ulang tidak menduplikasi guru, mengubah kode, atau menulis ulang snapshot yang sudah terdaftar.
4. Terbitkan PIN melalui menu PIN yang sama; satu batch maksimal 25 pemilih. Slip guru mencantumkan kode guru, PIN dan URL lengkap `/pemilih/masuk?periode=<slug>` pada host lingkungan cetak. Slip siswa tetap memuat NISN dan URL Portal Siswa. Hash/PIN siswa lama tidak berubah karena penambahan fitur guru.
5. Periksa kesiapan dan jadwalkan setelah daftar siswa **dan guru** lengkap. Daftar membeku ketika SCHEDULED mencapai waktu pembukaan. Panitia tidak dapat menyisipkan guru ke pemilihan yang sudah dibuka; gunakan periode baru sesuai keputusan sekolah tanpa memindahkan suara.

Penghapusan dari roster hanya sebelum buka, tidak menghapus Teacher master. Guru yang masih direferensikan periode tidak dapat dihapus dari master; dashboard memberi pesan alasannya. Untuk memperbaiki snapshot guru sebelum buka, hapus dari roster lalu tambahkan ulang dari master dan terbitkan PIN baru. Koreksi NISN dua pemeriksa tetap khusus siswa.

## Alur pemilih dan keamanan

Guru membuka Portal Pemilih, memasukkan kode dan PIN, lalu masuk dashboard untuk memilih empat organisasi. Pilihan parsial dapat dilanjutkan dengan kode/PIN valid yang sama selama periode dibuka. Login ulang mengganti sesi voting lama. Suara keempat mencabut sesi secara atomik dan menuju `/pemilih/selesai`; logout dan kedaluwarsa mengembalikan ke halaman masuk guru. Portal guru tidak menampilkan kartu layanan pribadi siswa.

Cookie voting tidak memberi principal/kapabilitas admin. Teacher.accountId opsional tidak digunakan untuk autentikasi voting. Guru yang juga panitia memakai sesi internal untuk tindakan admin. Sesi guru tidak membuka `/siswa` atau `/api/siswa/dashboard`, begitu juga sebaliknya; keduanya menggunakan API vote/status/activity/logout bersama yang memeriksa periode dari sesi. Layanan pribadi/akademik di luar MVP tetap ditolak.

Login siswa menerima tepat `{nisn,pin}`. Login guru pada endpoint sesi yang sama menerima tepat `{voterType:"TEACHER",code,pin}`. Kode dinormalisasi ke huruf besar; kode bukan rahasia pengganti PIN. Limiter login lima percobaan per identitas/periode/15 menit memakai namespace terpisah. CSRF, origin, dummy bcrypt, hash bcrypt cost 12, reset/revokasi dan pengecekan ulang kredensial di dalam transaksi berlaku untuk kedua jenis.

## Database dan kontrak

Migrasi `20261016100000_teacher_election_voters` menambahkan `ElectionVoterType`, `voterType` default STUDENT, `teacherId` dan `loginCode`, serta membuat studentId/nisn nullable. CHECK memastikan tepat satu identitas: siswa dengan Student+NISN atau guru dengan Teacher+kode. Unique `(periodId,teacherId)` dan `(periodId,loginCode)` mencegah duplikasi; FK Restrict menjaga master. Trigger melarang penggantian pemilik/kode dan INSERT/DELETE roster setelah pembukaan, dengan pengecualian cleanup periode uji yang sudah diotorisasi.

`className` pada snapshot guru berisi label kelompok `Guru`, bukan kelas Student buatan. Nama/kode snapshot tidak berubah ketika Teacher master disunting. Ballot tetap hanya menyimpan id, periodId, organization dan candidateId; tidak ada teacherId, voterType atau tautan ke pemilih.

`POST /api/admin/e-voting/[periodId]/voters/teachers` menerima tepat `{teacherIds:[...]}` (1–99 ID unik) dengan `evoting.lihat` + `evoting.pemilih`, origin dan CSRF. Sukses `200 {data:{added,alreadyPresent,total}}`; `400 INVALID_INPUT`, `404 TEACHER_NOT_FOUND`/`NOT_FOUND`, `409 ROSTER_LIMIT`/`INVALID_STATE`, atau `503 TEMPORARILY_UNAVAILABLE`. Pratinjau menggunakan daftar master yang dirender server; server selalu memvalidasi ulang saat commit.

GET roster/partisipasi terperinci menambah voterType/loginCode dan nisn nullable. Penghapusan guru memakai `{expectedSnapshot:{loginCode,name,className}}`; snapshot siswa tetap `{nisn,name,className}`. Dashboard guru tersedia melalui `GET /api/pemilih/dashboard`, tanpa PII atau layanan akademik.

Readiness, PIN, partisipasi, denominator hasil, rekonsiliasi dan penutupan menghitung kedua jenis. Tutup lebih awal mensyaratkan **semua pemilih**, termasuk guru dan PIN nonaktif, selesai empat suara. Hasil resmi tidak memecah kelompok kecil.

## Verifikasi dan peluncuran

Pengujian mencakup migrasi tanpa mengubah PIN siswa, CHECK/FK/unique, snapshot saat master berubah, penguncian roster, cleanup yang mempertahankan kedua master, batas gabungan, login dan resume guru, penolakan vote ganda, pencabutan sesi keempat, isolasi portal/admin, hasil gabungan dan browser login/logout/perpanjangan/selesai. Data uji sintetis; tidak memasukkan guru atau memberikan suara uji pada Neon.

Verifikasi 16 Oktober 2026: 128 pengujian lulus, 11 skenario QA browser lulus, `prisma validate`/generate dan build berhasil. Migrasi berhasil diterapkan ke Neon; pembacaan ulang mengonfirmasi tiga kolom baru, CHECK identitas, trigger aktif, dan nol pemilih guru. Belum menguji pemungutan suara nyata atau concurrency pada Neon, cetak fisik maupun tiga Chromebook sekolah. Status commit/push dan deployment mengikuti riwayat Git serta pipeline; verifikasi ini tidak mencakup deployment.

Jalankan migrasi sebelum menjalankan versi aplikasi ini, lalu gunakan versi aplikasi yang mendukung guru sebelum menambahkan guru pada periode. Runtime lama mengasumsikan seluruh voter adalah siswa. Jangan rollback ke runtime lama setelah guru ditambahkan; lakukan perbaikan maju. Jangan menghapus teacherId/kode atau suara sah untuk memaksa rollback. Ikuti [runbook operasional](07-operasional.md) dan gladi bersih tiga Chromebook sebelum pemilihan nyata.
