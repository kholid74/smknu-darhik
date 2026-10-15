---
status: accepted
---

# Autentikasi Portal Siswa MVP khusus pemilu

Keputusan final pengguna: NISN + PIN pemilu unik yang dibuat dan dicetak administrator berizin membuka dashboard Portal Siswa. PIN dan sesi hanya berlaku untuk satu periode dan layanan pemilu; master Student tetap persisten tanpa kredensial pemilu. Status accepted mencatat keputusan autentikasi. Keputusan operasional lain yang disepakati dirangkum pada [README](../README.md). Persetujuan desain ini **bukan izin implementasi aplikasi**.

## Kontrak MVP

1. Tidak ada registrasi mandiri, aktivasi akun oleh siswa, password permanen, lupa/reset password, atau perubahan PIN oleh siswa. Siswa tidak dibuat menjadi `Account` internal.
2. Panitia mengimpor master siswa dan mendaftarkan pemilih per periode. `Student` hidup lintas tahun; `ElectionVoter` menyimpan snapshot, PIN hash dan status kredensial periode. NISN saja atau keberadaan Student tidak memberikan akses.
3. PIN acak unik di dalam periode, dicetak individual, tidak disimpan plaintext. Penerbitan ulang PIN oleh panitia untuk kertas hilang/gagal cetak tetap merupakan tindakan admin terkontrol, bukan alur reset password siswa.
4. Login memeriksa NISN, PIN dan periode aktif. Pemilih yang belum lengkap masuk ke `/siswa`, termasuk ketika datang dari deep link atau melanjutkan sesi parsial. Dashboard menyediakan kartu E-Voting aktif dan kartu layanan masa depan bertuliskan Coming Soon yang tidak dapat diklik/fokus sebagai aksi.
5. Scope sesi eksplisit `ELECTION_VOTING`; akses dibatasi dashboard ringkas, status/sesi dan pemungutan pada periode yang sama. Tidak memberi akses profil pribadi, nilai, akademik, master siswa, layanan masa depan atau API internal. Semua path layanan di luar allowlist ditolak di server, bukan sekadar tombol disembunyikan.
6. Login/dashboard/halaman pemungutan/API status/activity/vote memeriksa scope dan periode valid: SCHEDULED dengan `opensAt <= waktu DB < closesAt`, serta credential enabled dan sesi belum kedaluwarsa. Informasi jadwal/login netral, logout, layar selesai dan hasil agregat yang sudah dipublikasikan dapat tersedia di luar jendela ini tanpa memberikan akses layanan personal.
7. Sesi pendek, idle dan absolute expiry, cookie aman, logout eksplisit, satu sesi aktif per pemilih/periode, no-store dan pembersihan layar berlaku juga pada dashboard. Suara keempat mencabut sesi dalam transaksi lalu menuju `/siswa/selesai`; layar tidak berisi identitas/pilihan. Login ulang pemilih lengkap saat periode valid hanya mengonfirmasi selesai tanpa sesi baru.
8. PIN yang sama tetap dapat dipakai untuk melanjutkan suara parsial selama valid. Tahun berikutnya membuat kredensial baru, tidak menghidupkan kembali sesi/PIN lama. Tidak ada promosi otomatis sesi pemilu menjadi sesi portal permanen.

## Konsekuensi

Label Portal Siswa menyatakan pintu masuk UI, bukan autentikasi umum untuk semua layanan sekolah. Akun siswa permanen dan autentikasi layanan akademik memerlukan keputusan terpisah di masa depan; tidak dibuat tabel password, recovery token, endpoint registrasi, atau layanan akademik dalam MVP.

Master Student ditambahkan pada proposal, menggantikan keputusan awal menunda master lintas tahun. Snapshot periode tetap dibekukan agar koreksi master tidak mengubah roster/riwayat pemilu. Kredensial tetap berada di ElectionVoter agar tidak menambah tabel autentikasi umum yang belum dibutuhkan.

Batas kerahasiaan ballot terhadap operator database pada [ADR 0001](0001-integrasi-dan-batas-kerahasiaan.md) tetap berlaku. Detail implementasi yang diusulkan ada di [desain](../02-desain.md), [schema](../03-schema.md), [API](../04-api.md) dan [UI](../05-implementasi.md).
