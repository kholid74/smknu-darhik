# Master siswa dan format impor

## Master kelas

Kelas unik berdasarkan tahun ajaran, nama kelas, dan jurusan. Jurusan merujuk ke master `Department`; kelas dikelola di `/admin/kelas`. Relasi siswa ke kelas bersifat opsional saat transisi agar data lama tetap terbaca. Siswa baru wajib memilih kelas master, sedangkan snapshot kelas pada roster dan hasil pemilihan lama tidak ikut berubah.

## Format file impor

Template awal tersedia di `/templates/import-siswa.csv` dan dapat dibuka dengan Excel. Urutan header yang wajib:

```text
NISN,Nama Lengkap,Tahun Ajaran,Kelas,Jurusan
```

Semua kolom wajib diisi. NISN harus terdiri dari 10 digit dan unik di file serta master siswa. Tahun ajaran memakai format `YYYY/YYYY` (misalnya `2026/2027`). Tahun ajaran dan nama kelas harus cocok dengan master kelas; kode jurusan dicocokkan terhadap nama atau slug jurusan. Alias `LPS` dikenali sebagai Perbankan Syariah dan `DKV` sebagai DKV. File tidak boleh berisi PIN atau kredensial pemilihan.

## Alur impor

Impor tersedia di **Admin → Siswa**. Unduh template, isi data, lalu unggah file CSV. Halaman menampilkan pratinjau beserta kesalahan per baris sebelum admin mengonfirmasi penyimpanan. Server mengulang validasi saat konfirmasi dan menyimpan satu batch secara transaksional; jika ada NISN duplikat atau data kelas tidak lagi cocok, seluruh batch ditolak.

Batas unggahan adalah 256 KiB dan 500 baris siswa per batch. Setiap baris sukses dicatat pada audit siswa sebagai `CREATED`.
