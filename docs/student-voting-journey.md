# Perjalanan siswa
Login NISN + PIN → dashboard → organisasi → kandidat → dialog konfirmasi → transaksi → organisasi berikutnya → layar selesai.
Form memakai POST dan tombol submit awalnya disabled sampai handler JavaScript siap, sehingga PIN/pilihan tidak masuk ke query URL ketika script tertunda.
Dashboard menonjolkan pemilihan. Kartu layanan masa depan non-interaktif. Informasi sesi/keluar selalu tersedia.

## Kandidat
Ketua dan wakil berbeda, nama/kelas snapshot, foto individual/fallback, nomor urut, visi/misi readable. Radio tetap native dan fokus-visible; label pilihan berubah ketika dipilih. Konfirmasi menyebut pasangan hanya sebelum pengiriman dan menjelaskan suara final.
Progress menampilkan jumlah organisasi selesai, tidak mengungkap pilihan terdahulu.

## Error dan perangkat bersama
Token CSRF terbaru dibaca dari layout setelah perpanjangan sesi. Error koneksi memeriksa status partisipasi sebelum mengirim ulang. Jika status belum pasti, tampilkan petunjuk periksa status dan hindari retry otomatis.
Kedaluwarsa menghapus tampilan privat dan mengarahkan ke login; explicit logout tetap POST + CSRF. bfcache diperiksa ulang. Tidak menggunakan localStorage/sessionStorage untuk identitas, PIN, sesi atau pilihan.
Setelah empat suara, backend mencabut sesi dan mengarahkan ke layar selesai. Siswa berikutnya menuju login bersih. Login tidak menerima PIN di luar waktu pemilihan.
