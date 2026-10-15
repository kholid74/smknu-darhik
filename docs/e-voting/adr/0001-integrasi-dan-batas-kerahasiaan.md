---
status: proposed
---

# Integrasi Astro dengan ledger partisipasi dan surat suara terpisah

Status: disepakati sebagai dasar desain. Pertahankan aplikasi Astro/Vercel dan PostgreSQL, gunakan akun internal individual untuk panitia, serta sesi server terpisah untuk siswa. Simpan partisipasi dan ballot atomik dalam database sama tanpa identifier penghubung di ballot. Operator database tetap pihak tepercaya; model tidak menjamin anonimitas terhadap pemilik DB, operator aplikasi, WAL atau log. Prosedur saksi dua orang untuk issue PIN, close dan publish bersifat operasional, bukan enforcement aplikasi.

## Alternatif dan alasan

Keputusan autentikasi diperjelas oleh [ADR 0002](0002-autentikasi-portal-siswa-mvp.md): login PIN menuju dashboard Portal Siswa, dengan master Student persisten dan scope sesi khusus pemilu. Ini tidak mengubah batas kerahasiaan surat suara pada ADR ini.

| Alternatif | Penilaian |
| --- | --- |
| Tambah kandidat pilihan pada baris pemilih | Sederhana tetapi langsung melanggar kerahasiaan pilihan; ditolak |
| Empat suara dikirim sekali sekaligus | Menyulitkan kelanjutan parsial dan memaksa pengulangan pilihan belum terkirim; pilih satu transaksi per organisasi |
| Memakai Account/sesi admin bagi siswa | Mencampur izin internal, PIN dan sesi perangkat bersama; ditolak |
| Dua database tanpa protokol transaksi terdistribusi | Memisahkan akses tetapi dapat menghasilkan hak pilih habis tanpa surat suara atau sebaliknya; tidak dipilih |
| Layanan baru/framework baru/Redis | Belum diperlukan oleh kebutuhan yang ada; limiter PostgreSQL cukup untuk diuji pada skala sekolah |
| Enkripsi suara dengan kunci yang juga tersedia di server aplikasi | Tidak melindungi dari operator server dan tidak menyelesaikan korelasi transaksi; jangan dipasarkan sebagai anonimitas kuat |
| Protokol pemilu kriptografis, trustee terpisah, mixing/verifiability | Relevan jika DB operator masuk adversary; memerlukan desain khusus dan review independen, bukan tambahan kecil ke rencana ini |

## Konsekuensi dan batas kepercayaan

Tidak ada `voterId`, NISN, session ID, IP, user agent, waktu pengiriman, receipt per suara, atau urutan auto-increment di `Ballot`. Identifier surat suara berupa UUID acak v4; tidak memakai CUID, UUIDv7, atau sequence yang membawa urutan waktu. Ledger partisipasi hanya menyimpan boolean per organisasi, tanpa `castAt` atau kandidat.

Hal itu mengurangi tautan pada query biasa, tetapi **tidak menjadikan sistem tak dapat ditautkan**:

- Transaksi yang sama memperbarui partisipasi dan membuat ballot. Transaction ID/MVCC (`xmin`), WAL, logical replication, urutan insert/physical tuple, dan snapshot bertahap dapat menghubungkannya meski tidak ada timestamp aplikasi.
- Log query/bind parameter, tracing/APM, request body, error lengkap, dan waktu akses siswa dapat menghubungkan identitas dengan kandidat. Polling tabel oleh orang berakses DB dapat menyingkap suara baru satu per satu.
- Menghapus timestamp, memakai UUID acak, menunda dashboard, atau mengenkripsi backup tidak menghapus korelasi tersebut. Backup/PITR menyimpan jejak historisnya.
- Database menyimpan pilihan dalam bentuk biasa. Hasil sebelum tutup disembunyikan dari **API/UI semua role**, termasuk superadmin, tetapi pemilik database dapat menghitungnya langsung.
- Setelah hasil dipublikasikan, kontes dengan sangat sedikit pemilih atau hasil bulat bisa membuat pilihan individu dapat ditebak. Jangan menyediakan breakdown kelas, gender, waktu, atau kelompok kecil.
- Pemegang PIN dapat menyamar sebagai siswa. Distribusi individual, pengawasan identitas dan pengamanan kertas adalah bagian dari kontrol; protokol ini tidak membuktikan bebas paksaan atau jual beli suara.

Mitigasi operasional: role DB aplikasi bukan owner, hak minimum per tabel, pembatasan operator, larangan observasi ballot saat pemungutan, akses break-glass tercatat, log tanpa parameter sensitif, tidak ada ekspor ballot per baris, dan backup terenkripsi dengan akses terbatas. Ini merupakan pengurangan risiko, bukan bukti kriptografis.

Jika sekolah mensyaratkan pengelola DB tidak dapat melihat hasil sebelum tutup atau mengaitkan suara, **jangan menyetujui desain ini sebagai pemenuhan syarat tersebut**. Revisi arsitektur sebelum implementasi. Rincian keputusan yang perlu disetujui ada pada [README](../README.md).
