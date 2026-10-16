# Persiapan DRAFT dan pemilihan siswa

Disetujui 16 Oktober 2026. Master siswa adalah sumber identitas, bukan daftar orang yang otomatis wajib ikut seluruh pemilihan. Panitia menentukan siswa yang berhak pada tiap periode melalui pilihan eksplisit. Guru tetap dipilih dari Teacher master sebagaimana [keputusan guru](09-usulan-pemilih-guru.md).

## Aturan persiapan

| Status | Konfigurasi, calon dan roster | Penerbitan PIN |
| --- | --- | --- |
| DRAFT, termasuk jika jadwal awal lewat | Tetap dapat disiapkan | Dapat diterbitkan/reset dengan kontrol yang sama |
| SCHEDULED sebelum opensAt | Dapat disiapkan | Dapat diterbitkan/reset |
| SCHEDULED sejak opensAt | Membership dan calon terkunci; koreksi NISN siswa terkontrol tetap terpisah | Reset/issue koreksi mengikuti ketentuan lama |
| CLOSED / ARCHIVED | Terkunci | Tidak tersedia |

DRAFT belum pernah membuka voting. Tanggal yang lewat tidak boleh membuat draft tidak dapat dipulihkan. Saat menyimpan jadwal baru atau menjadwalkan, opensAt tetap wajib di masa depan dan closesAt harus sesudahnya. SCHEDULED yang sudah dibuka tidak dapat dipindah jadwal untuk membuka kembali roster. Jadwal, state, PIN, siswa dan suara yang sudah ada tidak diubah otomatis oleh perbaikan ini.

UI, service dan trigger memakai aturan yang sama. Kelola Pemilih menampilkan alasan ketika terkunci dan petunjuk memperbaiki jadwal draft. Schedule/login/vote tetap memeriksa state SCHEDULED dan waktu DB; DRAFT yang tanggalnya lewat tidak menerima login maupun suara.

## Alur siswa

1. Buka Kelola Pemilih pada DRAFT atau SCHEDULED sebelum pembukaan.
2. Daftar calon pemilih siswa bersumber dari Student yang terhubung ke SchoolClass dengan tahun ajaran sama dengan periode. Cari nama/NISN atau filter kelas.
3. Centang siswa yang berhak; jumlah terpilih ditampilkan. Pilihan bertahan saat berpindah halaman. **Pilih semua** bersifat eksplisit dan mencakup semua siswa belum terdaftar pada seluruh halaman, termasuk di luar filter pencarian. Tidak ada pemilihan acak berdasarkan angka.
4. Pilih **Pratinjau siswa terpilih**. Periksa nama, jumlah yang akan ditambahkan, dan total gabungan siswa+guru. Proyeksi di atas 99 tidak dapat dikirim.
5. Pilih **Tambahkan pemilih siswa**, periksa popup konfirmasi, lalu server memvalidasi ulang master/tahun ajaran/jadwal/kapasitas dalam transaksi sebelum menambahkan.

Siswa yang sudah terdaftar tidak dicentang ulang dan tidak diduplikasi. Daftar pilihan adalah tambahan, bukan penggantian roster. Mengosongkan pilihan atau memakai filter tidak menghapus pemilih lama. Untuk mengurangi jumlah, gunakan Hapus dari roster pada daftar terdaftar selama masih dapat diedit; master Student tetap tersimpan. Tidak ada pengurangan roster otomatis untuk memenuhi batas 99 atau syarat early close.

## API dan transaksi

`POST /api/admin/e-voting/[periodId]/voters` menerima tepat `{studentIds:[...]}`: 1–99 UUID Student unik, tidak menerima nama bebas, className, target jumlah, `all:true`, atau body kosong. UUID dinormalisasi ke huruf kecil. Request lama `{}` ditolak 400 agar tidak diam-diam memasukkan seluruh siswa. Frontend dan API perlu dipakai pada versi yang sama.

Izin tetap `evoting.lihat` + `evoting.pemilih`, origin sama dan CSRF. Pemilihan dari master tidak memberi izin mengubah master. Server mengunci periode, membaca waktu DB, memvalidasi seluruh ID masih memenuhi tahun ajaran, mempertahankan roster lama, memeriksa konflik NISN dan kapasitas gabungan, lalu membuat snapshot, empat eligibility per siswa dan audit atomik. Audit tidak memuat dump nama/NISN atau PIN. Pengulangan ID yang sudah terdaftar tidak menggandakan data.

Sukses `200 {data:{academicYear,selected,added,alreadyPresent,total}}`. Error: `400 INVALID_INPUT`, `403 CSRF_REJECTED`/izin ditolak, `404 NOT_FOUND` atau `STUDENT_NOT_ELIGIBLE` untuk ID tidak ada/berbeda tahun ajaran, `409 INVALID_STATE`, `ROSTER_LIMIT`, `NISN_ALREADY_ROSTERED`; body/media invalid mengikuti 413/415 dan kegagalan DB/audit memberi 503 tanpa commit sebagian.

GET `voters/master-preview` tetap menjadi ringkasan sumber master; menambah `students:[{id,nisn,name,className,alreadyPresent}]`. Angka proyeksinya adalah jika seluruh sumber ditambahkan, bukan keputusan eligibility atau instruksi menambahkan seluruh siswa. UI utama menampilkan pratinjau pilihan secara lokal dan server selalu memvalidasi ulang saat POST.

Semua peserta terdaftar tetap mendapat empat hak dengan bobot sama. PIN, dashboard, anonim Ballot, hasil gabungan dan early close memakai roster terpilih. Student yang tidak dipilih tidak memiliki credential/eligibility pada periode dan tidak bisa login meski ada di master.

## Migrasi dan verifikasi

`20261016120000_draft_setup_editability` mengganti tiga fungsi trigger melalui migrasi baru yang atomik: calon, identitas/membership voter dan penghapusan participation false. Tidak mengubah schema kolom atau data. Ownership/kode immutable, participation true tidak bisa dibalik/dihapus, Ballot immutable dan pengecualian cleanup uji tetap dipertahankan. Jangan mengedit checksum migrasi lama.

Migrasikan sebelum menggunakan UI/service baru. Runtime lama tetap kompatibel dengan data tetapi masih menyembunyikan aksi DRAFT yang terlambat; rollback runtime akan mengembalikan keterbatasan tersebut. Rollback aturan database dapat dilakukan lewat migrasi maju yang memulihkan definisi fungsi sebelumnya; tidak memerlukan penghapusan roster atau suara.

Regresi otomatis mencakup jadwal draft lewat dan penjadwalan ulang, batas opensAt SCHEDULED, PIN draft, calon/roster/participation pada PostgreSQL lokal, pilihan subset, ID invalid/duplikat/tahun ajaran salah, batas 99 gabungan, CSRF/izin, dan browser untuk tabel kosong draft, pilihan lintas halaman, pilih semua, pratinjau, konfirmasi dan penjelasan halaman terkunci. Tidak menambahkan atau menghapus pemilih nyata saat pengujian.

Verifikasi 16 Oktober 2026: 134 tes lulus, 12 skenario QA browser lulus tanpa exception JavaScript, build berhasil. Migrasi sudah diterapkan ke Neon; pembacaan ulang mengonfirmasi tiga definisi fungsi baru dan kedua periode DRAFT dapat dikelola. Jumlah terdaftar yang terbaca adalah 0 dan 52; tidak ada mutasi daftar/jadwal oleh pekerjaan ini. Gladi perangkat fisik belum dilakukan; status commit/push dan deployment mengikuti riwayat Git serta pipeline.
