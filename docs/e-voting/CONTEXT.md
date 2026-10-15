# Domain E-Voting SMKDH

Istilah pemilihan empat organisasi sekolah dalam satu periode.

## Bahasa domain

**Siswa**: Identitas siswa sekolah yang tetap ada lintas periode pemilihan; keberadaannya tidak berarti memiliki akun login permanen atau hak pilih pada setiap periode.

**Portal Siswa MVP**: Dashboard setelah autentikasi PIN pemilu, berisi akses E-Voting periode tersebut dan informasi Coming Soon untuk layanan yang belum tersedia.

**PIN pemilu**: Kredensial unik dalam satu periode yang diterbitkan dan dicetak panitia untuk seorang pemilih; bukan password akun siswa permanen.

**Penerbitan ulang PIN**: Penggantian PIN oleh panitia berizin, misalnya karena slip hilang, tanpa mengubah suara yang telah masuk.
_Hindari_: Reset password siswa.

**Periode pemilihan**: Satu penyelenggaraan pemilihan dengan jadwal bersama dan daftar pemilih tersendiri, misalnya periode tahun ajaran 2026/2027.
_Hindari_: Tahun sebagai satu-satunya identitas pemilihan.

**Organisasi**: Salah satu dari OSIS, Dewan Ambalan, IPNU, atau IPPNU yang dipilih setiap siswa terdaftar.

**Pasangan calon**: Satu pilihan pada satu organisasi/periode yang memiliki tepat satu ketua dan satu wakil; keduanya adalah Student berbeda yang dipilih dari master persistent.
_Hindari_: Nama bebas yang tidak terhubung ke Student master.

**Anggota pasangan calon**: Student yang ditugaskan pada posisi `CHAIR` atau `VICE_CHAIR` di CandidatePair. `studentId` dipertahankan untuk riwayat pencalonan, sedangkan nama dan kelas disimpan sebagai snapshot historis; perubahan data master tidak menulis ulang snapshot.

**Pemilih terdaftar**: Siswa yang tercantum pada daftar suatu periode dan memiliki empat hak pilih. Daftar periode sekolah disinkronkan dari Student master yang terhubung ke kelas dengan tahun ajaran yang sama; Student lain tidak otomatis menjadi pemilih.

**Hak pilih**: Kesempatan seorang pemilih untuk mengirim satu suara final pada satu organisasi dalam satu periode.

**Partisipasi**: Status penggunaan hak pilih; menunjukkan organisasi mana yang sudah diselesaikan tanpa mengungkap pasangan pilihan.

**Surat suara**: Pilihan final untuk satu pasangan calon pada satu organisasi dan periode.

**Selesai memilih**: Kondisi ketika keempat hak pilih sudah digunakan. Suara yang sudah dikirim tetap sah meskipun pemilih belum selesai semuanya.

**Batas waktu pemungutan**: Saat setelahnya tidak ada pengiriman suara baru yang diterima, berdasarkan jadwal bersama.

**Penutupan resmi**: Pengesahan akhir oleh panitia sesudah batas waktu pemungutan dan pemeriksaan jumlah partisipasi serta surat suara.
_Hindari_: Publikasi untuk menyebut penutupan.

**Publikasi hasil**: Pembukaan hasil agregat yang telah ditutup resmi agar dapat dilihat publik.

**Panitia**: Pemilik akun internal yang diberi izin menyelenggarakan bagian tertentu dari pemilihan.

## Periode uji dan penghapusan sampel

Periode uji adalah penyelenggaraan dengan isTest=true sejak dibuat; berbeda dari periode biasa dan tidak dapat dikonversi lewat edit. Dua sampel awal diklasifikasikan lewat migrasi UUID+slug sesuai konfirmasi operator. Penghapusan sampel adalah pembersihan atomik semua data turunan periode uji yang belum dipublikasikan, dengan superadmin, dua popup, konfirmasi slug dan password login. Student master dan audit append-only tetap tersimpan. Ini bukan arsip atau reset pemilihan resmi. [Panduan](08-pembersihan-data-uji.md).
