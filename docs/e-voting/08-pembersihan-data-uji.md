# Pembersihan periode uji

Keputusan operator 15 Oktober 2026: dua periode awal (`osis-2026` dan `pem-osis-2026`, UUID spesifik pada migrasi) merupakan sampel pengujian. Migrasi hanya menandai keduanya sebagai data uji dan mencatat klasifikasinya; tidak menghapus periode atau data turunannya.

## Alur admin

1. Login sebagai **superadmin** aktif dengan izin `evoting.lihat`, `evoting.kelola`, dan `evoting.hapus-uji` yang tidak dicabut.
2. Buka **Pemilihan → Konfigurasi** pada periode berlabel **Data uji**.
3. Klik **Hapus periode uji**, periksa nama, slug, dan jumlah data pada popup pertama.
4. Klik **Lanjutkan verifikasi**. Ketik tepat `HAPUS <slug-periode>` dan password akun yang sedang login.
5. Klik **Hapus permanen**. Sukses mengembalikan admin ke daftar periode dengan pesan konfirmasi.

Password salah tidak menghapus data dan dikosongkan dari form. Verifikasi memakai bcrypt dan limiter autentikasi ulang yang sudah ada: maksimal lima percobaan per 15 menit per akun, termasuk tindakan lain yang memakai limiter sama. Jika koneksi terputus, periksa kembali daftar periode sebelum mengulang.

## Data dan batas akses

Keputusan operator 18 Oktober 2026: seluruh periode dengan `ElectionPeriod.isTest=true` dapat dihapus, termasuk sesudah hasil dipublikasikan dan sesudah diarsipkan. Pilihan **Periode uji** ditentukan saat membuat periode. API edit menolak field klasifikasi dan trigger menolak perubahan nilainya. Periode biasa tidak dapat diubah menjadi uji. Backfill dua sampel lama memakai pasangan UUID+slug yang dikonfirmasi operator, bukan pencocokan nama. Perubahan guard dilakukan melalui migrasi `20261018090000_published_test_cleanup`; migrasi tidak menghapus atau menandai ulang data.

Cleanup menghapus `VotingSession`, `Ballot`, `VoterParticipation`, `CandidateMember`, `CandidatePair`, `ElectionVoter` beserta hash/fingerprint PIN, `ElectionContest`, lalu periode beserta snapshot hasilnya. Tautan hasil publik menjadi404 setelah penghapusan. **Student, Teacher, SchoolClass, Department, Account, master ElectionType, periode lain, dan file media bersama tetap tersimpan.** Bucket limiter global tetap mengikuti expiry agar pembersihan tidak menghapus pembatas percobaan password.

Audit lama tetap append-only dengan `periodId` asli. Event baru `TEST_PERIOD_DELETED` menyimpan aktor, metadata periode dan jumlah data, tanpa identitas pemilih, PIN/password atau pilihan individual. FK audit ke periode diganti validasi saat INSERT agar histori tetap dapat merujuk UUID periode yang sudah dihapus; FK aktor dan proteksi audit master tetap berlaku.

## API dan transaksi

`GET /api/admin/e-voting/[periodId]/test-cleanup` mengembalikan `{data:{id,slug,name,state,isTest,publishedAt,contests,candidates,members,voters,pins,participation,ballots,sessions,auditEvents,version,...}}` dan header `X-CSRF-Token`. Tidak ada rincian siswa, PIN atau pilihan.

`POST` pada path sama menerima tepat `{confirmation,previewVersion,adminPassword}`. Konfirmasi harus `HAPUS <slug>`, versi 32 karakter hex, password 1–256 karakter. Wajib origin sama dan CSRF terikat sesi admin. Sukses `204`; gagal `400 INVALID_INPUT`, `401 INVALID_REAUTH`, `403 FORBIDDEN/CSRF_REJECTED`, `404 NOT_FOUND`, `409 TEST_CLEANUP_NOT_ALLOWED/CONFIRMATION_MISMATCH/STALE_CLEANUP_PREVIEW`, `413 BODY_TOO_LARGE`, `415 UNSUPPORTED_MEDIA_TYPE`, `429 RATE_LIMITED`, atau `503 TEMPORARILY_UNAVAILABLE`. Response `private, no-store`.

Password diperiksa sebelum transaksi/lock. Fungsi `evoting_delete_test_period` mengunci periode `FOR UPDATE`, memeriksa ulang aktor/role/revoke, klasifikasi uji, konfirmasi, dan versi ringkasan. Status/publikasi tidak membatasi data uji, tetapi tetap tercakup dalam versi dan audit; perubahan close/publish/archive membatalkan pratinjau lama. Popup memperingatkan jika hasil sudah dipublikasikan atau periode diarsipkan. Vote/login juga mengunci periode; transaksi yang lebih dahulu berlangsung diselesaikan sebelum cleanup, lalu perubahan data membatalkan preview lama.

Pengecualian trigger berlaku hanya untuk DELETE pada UUID periode uji dan transaksi cleanup yang sama. Tidak ada `DISABLE TRIGGER`, perubahan `session_replication_role`, cascade umum atau perubahan grants. UPDATE ballot, DELETE biasa, penurunan status partisipasi dan perubahan calon setelah buka tetap ditolak. Kegagalan apa pun membatalkan seluruh penghapusan dan event audit baru.

## Verifikasi

PGlite (dependensi development) menjalankan migrasi pada PostgreSQL dalam memori, tanpa `.env`, Docker atau koneksi Neon. Suite historis mempertahankan aturan lama untuk verifikasi migrasi terdahulu. Suite dinamis memakai seluruh migrasi terkini dan menguji cleanup CLOSED terbit serta ARCHIVED terbit/belum terbit melalui middleware/API nyata. Tes mencakup master/periode lain/audit tetap ada, klasifikasi tidak bisa diubah, penolakan periode biasa/aktor tak sah, konteks palsu, CSRF, password, konfirmasi salah, preview stale, limiter dan rollback setelah ballot dihapus. Tidak ada penghapusan periode Neon sebagai bagian tes.

Browser memakai komponen popup yang sama dengan API sintetis: batal tahap pertama, slug salah, password ditolak dan dikosongkan, serta preview berubah. Tes ini tidak menghapus data Neon. Reset seluruh dataset tetap hanya tersedia melalui simulator localhost; fitur ini menghapus satu periode uji yang telah diotorisasi.

## Hasil verifikasi 15 Oktober 2026

91 tes dan 10 skenario browser fixture lulus; Prisma validate/generate dan build lulus. Migrasi telah diterapkan ke Neon. Perbandingan sebelum/sesudah menunjukkan 52 Student, 52 ElectionVoter, 8 Ballot, 8 pasangan, 16 anggota calon, 208 hak suara, 5 kelas dan 2 jurusan tetap sama; kedua periode masih tersimpan dan kini bertanda Data uji. Tidak ada penghapusan sampel nyata selama implementasi. Kegagalan jaringan/konkurensi multi-koneksi serta perjalanan empat suara menyeluruh belum diuji end-to-end.
