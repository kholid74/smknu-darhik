# Usulan alur pemilih guru

Guru dikonfirmasi ikut memilih OSIS, Dewan Ambalan, IPNU, dan IPPNU pada 16 Oktober 2026. Bagian berikut adalah rekomendasi desain; implementasi pemilih saat ini masih khusus Student.

| Bagian | Siswa | Guru (usulan) |
| --- | --- | --- |
| Sumber identitas | Master Student | Master Teacher, dipilih panitia; tidak otomatis mencakup seluruh staf |
| Login | NISN + PIN periode | Kode pemilih guru yang dibuat sistem + PIN periode |
| Hak suara | Satu per organisasi | Disarankan satu per organisasi dengan bobot sama |
| Kredensial | Dibuat dan dicetak panitia | Dibuat dan dicetak panitia; tidak memerlukan akun admin |
| Sesi | Khusus pemilihan, idle 5 menit/absolut 15 menit | Aturan sama, termasuk logout dan pencabutan setelah suara keempat |

Alur guru: panitia memilih Teacher yang berhak sebelum pembukaan → pratinjau/sinkronisasi daftar guru → cetak kode dan PIN → guru masuk ke portal pemilih → pilih empat organisasi → layar selesai. Pilihan parsial dapat dilanjutkan dengan kredensial valid yang sama. Akun login guru pada dashboard internal tidak otomatis menjadi hak suara atau dipakai sebagai sesi voting di Chromebook bersama.

Gunakan kode guru pada slip, bukan NISN buatan. Master Teacher saat ini tidak memiliki NIP/nomor identitas wajib, dan tautan Account bersifat opsional. Karena itu kode pemilih per periode lebih sederhana daripada mewajibkan seluruh guru membuat akun permanen.

ElectionVoter perlu diperluas dengan jenis pemilih dan referensi Student atau Teacher yang eksklusif (tepat satu), kode login, snapshot identitas, serta uniqueness per orang/periode. Student dan Teacher tetap master terpisah. Jangan membuat guru sebagai Student, mengubah FK Student menjadi ID guru, atau menghapus pemeriksaan NISN pada alur siswa.

Ledger partisipasi, transaksi vote, dan Ballot anonim tetap dipakai bersama. Hak suara guru tidak memberikan izin melihat hasil, mengelola pemilih, atau menerbitkan PIN. Guru yang sekaligus panitia menjalankan tindakan admin melalui sesi internal yang terpisah. Hasil disarankan digabung per kandidat tanpa breakdown siswa/guru agar kelompok kecil tidak mempersempit kerahasiaan.

Readiness, cetak PIN, laporan partisipasi, sesi, batas jumlah pemilih, rekonsiliasi dan tutup lebih awal harus menghitung siswa dan guru. Batas MVP saat ini 99 pemilih adalah batas gabungan, sehingga jumlah total perlu diperiksa sebelum sinkronisasi. Tutup lebih awal hanya ketika setiap pemilih dari kedua kelompok selesai empat suara.

Membership pemilih membeku saat dibuka. Jika pemilihan aktif sudah dimulai, jangan menyisipkan guru ke daftar tersebut; selesaikan prosedur periode lama dan siapkan periode baru sesuai keputusan sekolah. Tidak memindahkan atau mengulang suara yang sudah masuk secara otomatis.

Sebelum implementasi guru, panitia perlu menetapkan daftar guru yang berhak dan mengesahkan bobot sama serta hasil gabungan. Tautan masuk guru dan perubahan label Portal Pemilih perlu ditambahkan sambil mempertahankan autentikasi/layanan Portal Siswa yang sudah disetujui.
