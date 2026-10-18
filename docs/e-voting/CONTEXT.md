# Domain E-Voting SMKDH

**Pembaruan T11, 18 Oktober:** endpoint hasil internal dan status publikasi401/429 diterapkan. Regresi232tes lulus (satu penanda tes DB dilewati dan dijalankan terpisah), PostgreSQL lokal lintas koneksi6/6, browser37skenario, Prisma validate/generate dan build lulus. Penerimaan R2/Vercel/perangkat tetap belum selesai. [Bukti T11](06-pengujian.md#bukti-dan-gerbang-rilis).

**Pembaruan upload 18 Oktober:** T10 sudah diimplementasikan dan diuji lokal (228 tes, 37 skenario browser, build lulus). Verifikasi object R2/hosted belum selesai karena konfigurasi R2 lokal belum tersedia. [Bukti dan batas](../image-upload-webp-study.md#implementasi-t10-dan-bukti-terbaru).

**Pembaruan Neon 17 Oktober 2026:** migrasi schema dan cleanup empat periode yang disetujui sudah berhasil setelah backup teruji. Master dan audit lama tetap; deployment belum dilakukan. [Catatan pelaksanaan](13-catatan-migrasi-neon.md).

Status: **target rancangan T01, 16 Oktober 2026; runtime belum dimigrasi**. [ADR 0003](adr/0003-jenis-pemilihan-dinamis.md) menggantikan batas empat jenis. Progres aktual ada pada [task](12-task-implementasi-jenis-dinamis.md).

| Istilah | Makna dan batas |
| --- | --- |
| Student / siswa | Master persisten dengan NISN/kelas, tanpa PIN, password atau akun permanen; tidak otomatis menjadi pemilih |
| Guru pemilih | Teacher master yang dipilih eksplisit; bukan Student buatan dan tidak memakai akun/password guru untuk voting |
| ElectionType / jenis pemilihan | Master kategori berkode stabil, nama, logo, label jabatan, mode calon, urutan dan status aktif; CRUD panitia |
| organization | Nama field/kolom/segmen route existing untuk **kode jenis**, bukan enum atau bukti membership organisasi |
| ElectionContest / jenis periode | Pemasangan satu jenis pada satu periode beserta snapshot metadata; key `(periodId, organization)` |
| Periode | Penyelenggaraan berjadwal dengan 1–20 contest, roster sendiri dan snapshot hasil; bukan sekadar tahun |
| Susunan jenis | Daftar kode berurutan pada DRAFT; dikunci saat SCHEDULED. Bukan seluruh master aktif |
| Snapshot jenis | Nama/logo/jabatan/mode disalin saat pemasangan; edit master dan reorder tidak mengubahnya |
| Kandidat / CandidatePair | Satu pilihan bernomor pada contest. SINGLE: tepat satu CHAIR; OPTIONAL_VICE: CHAIR dan wakil opsional. Anggota Student berbeda, dipilih lewat studentId, bukan nama bebas |
| CandidateMember | Posisi CHAIR/VICE_CHAIR yang menyimpan Student ID, nama/kelas snapshot dan foto opsional. Riwayat pencalonan dapat dicari via studentId; masa jabatan tetap di luar MVP |
| Pemilih terdaftar | ElectionVoter dengan tepat satu Student atau Teacher; total gabungan 1–99 ketika dijadwalkan/ditutup. Identitas snapshot, PIN dan sesi hanya periode |
| Hak pilih | Satu kesempatan final per pemilih per contest periode. Default baru lima hak, tetapi jumlah ditentukan periode |
| Partisipasi | Boolean penggunaan hak per jenis, tanpa kandidat/waktu suara. Semua hak true = lengkap; sebagian true = parsial; nol true = belum mulai |
| Ballot / surat suara | UUID acak, periode, kode jenis dan CandidatePair saja. Tidak punya voterId, studentId, sessionId, identitas atau timestamp suara |
| Selesai memilih | Tepat seluruh hak periode terpakai; sesi dicabut dan layar selesai generik. Suara parsial tetap sah dan dapat dilanjutkan dengan PIN yang sama selama buka |
| Penutupan resmi | Panitia mengakhiri pemilihan yang telah dibuka, merekonsiliasi, membekukan hasil dan mencabut sesi; turnout 100% tidak diwajibkan |
| Penutupan dini | Sebelum deadline dengan early=true, alasan, password, konfirmasi dan audit. Tidak dapat dibuka kembali atau otomatis menerbitkan hasil |
| Publikasi | Membuka snapshot resmi CLOSED/ARCHIVED bagi publik setelah aksi berizin; berbeda dari penutupan |
| Perolehan tertinggi | Tampilan agregat, bukan penetapan pemenang oleh aplikasi. Seri tetap seri; nol suara tidak menandai pemenang |

## Identitas, waktu dan perangkat

Siswa login NISN + PIN tercetak ke `/siswa`; guru memakai kode `GURU-` + 12 heksadesimal dan PIN ke `/pemilih`. Tidak ada self-registration/password/recovery permanen. Scope ELECTION_VOTING tidak membuka layanan pribadi, akademik atau admin. Coming Soon noninteraktif tetap.

Maksimum tiga sesi pemilih bersama pada tiga Chromebook. Satu sesi aktif per pemilih, lima menit idle dan 15 menit absolut atau deadline. Waktu DB setelah lock adalah otoritas; tanggal WIB hanya tampilan. Logout/expiry/suara terakhir membersihkan UI dan cookie, termasuk Back/pageshow.

Siswa dipilih dari master kelas tahun ajaran yang sama; guru dipilih eksplisit. Tidak ada import roster kedua atau filter gender. PIN nonaktif tetap denominator. Slate calon dan roster membeku saat pembukaan; susunan jenis membeku lebih awal saat dijadwalkan. DRAFT bertanggal lama tetap dapat disiapkan, lalu jadwal diperbaiki sebelum schedule.

## Sampel dan riwayat

Izin pengguna membolehkan pembersihan data **pemilihan sampel** bila perlu untuk migrasi. Tidak termasuk Student/Teacher, kelas/jurusan, akun/izin, CMS/media atau audit yang dipertahankan. Runtime cleanup existing tetap dibatasi periode uji yang belum dipublikasikan; pembersihan sampel lain bukan endpoint bypass dan mengikuti prosedur migrator T12. [Operasional](07-operasional.md).

T01–T09 selesai lokal: konfigurasi, hak pilih siswa/guru, portal, sesi, suara, partisipasi dan snapshot v2 mengikuti contest periode. Sesi dicabut tepat setelah N suara; batas tiga sesi global memakai advisory lock login. Form buat periode memilih jenis eksplisit; master baru tidak otomatis dipasang. Menu Jenis Pemilihan memiliki CRUD/popup/logo/aktif; susunan DRAFT dapat dipilih dan diurutkan. Form calon memakai mode/jabatan snapshot dan kartu portrait besar. Edit foto/visi tidak merefresh nama/kelas Student yang sama; edit/hapus memeriksa expected termasuk foto. T07 menutup periode yang sudah dibuka tanpa turnout penuh, dengan alasan dini10–500, reauth/limiter dan konfirmasi. Suara parsial tetap sah, absen tetap pada roster, snapshot/sesi/audit atomik dan publikasi terpisah. T08 menampilkan hasil publik berfoto/berlogo, donut orang dan bar perjenis dari snapshot resmi, termasuk seri/nol dan cetak. Jumlah orang berpartisipasi=lengkap+parsial; total surat suara=sum votesCast, dengan denominator persentase masing-masing. Gate CLOSED/ARCHIVED+publishedAt tetap wajib. CTA hasil dashboard selesai pada T09, dengan tab baru aman dan gate publikasi. Upload dan rilis Neon tetap T10–T12. Schema Neon sudah dimigrasi sesuai permintaan pengguna; deployment aplikasi belum.
