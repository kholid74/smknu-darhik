# Catatan pelaksanaan migrasi Neon

17 Oktober 2026, 23.20–23.22 WIB. Pengguna meminta migrasi Neon didahulukan sebelum T10–T11 dan secara eksplisit menyetujui penghapusan DRAFT `osis-2026` bersama tiga periode uji lainnya. **Migrasi DB berhasil; deployment aplikasi dan T12 secara keseluruhan belum selesai.** [Status task](12-task-implementasi-jenis-dinamis.md), [operasional](07-operasional.md).

## Cadangan dan prasyarat

- PostgreSQL Neon 17.11. Sebanyak 25 checksum migrasi yang tersedia cocok, termasuk normalisasi akhir baris Windows/Linux. Schema pemilihan sebelum perubahan cocok dengan baseline PGlite: kolom, constraints, trigger dan seluruh fungsi `evoting_*`.
- Tiga arsip SQL historis belum ada di repo: `20260817005759_init`, `20260817104407_add_reviewed`, `20260817210605_add_action_status`. Riwayat remote tersebut dipertahankan; tidak menjalankan reset, resolve, menghapus riwayat atau membuat file pengganti rekaan. Kekurangan arsip ini tetap outstanding, walaupun Prisma melaporkan tidak ada migrasi lokal tertunda.
- Cadangan konsisten seluruh **37 tabel schema public**, DDL, data dan metadata pemilik/ACL dibuat memakai `pg_dump` custom format dan exported snapshot. Alat PostgreSQL 17.11 berasal dari [distribusi binary EDB](https://www.enterprisedb.com/download-postgresql-binaries).
- Archive berhasil dibaca `pg_restore` dan dipulihkan pada PGlite lokal; hash isi seluruh 37 tabel cocok. Replay lokal mengecualikan pemilik/ACL agar tidak membutuhkan role Neon, sedangkan metadata tersebut tetap ada dalam archive. Ini bukan uji restore pada clone Neon atau bukti PITR/role runtime.
- Backup: `artifacts/neon-migration/before-dynamic-types.dump`, 140423 byte; SHA-256 `1de4900cb4d24dcbaac5a8fa525c1c061fffe4d04f013d4d66a7cb089c822666`. Manifest, laporan hash, SQL restore dan log berada dalam direktori yang sama. Folder diabaikan Git; backup berisi data sensitif dan tidak boleh dipublikasikan.

## Manifest yang disetujui

| ID periode | Slug | State sebelum hapus | isTest | Surat suara |
| --- | --- | --- | --- | --- |
| `9f19d4a9-2b7a-4c30-b3d8-a63596e42053` | `demo-2026` | CLOSED, published | true | 24 |
| `a00be464-fd80-45fb-ae97-b7c5a7356ebc` | `pem-osis-smks-2026` | DRAFT | true | 0 |
| `a12a1a17-733b-4780-818f-f0a1b70ff0c0` | `pem-osis-2026-demo` | CLOSED, published | true | 20 |
| `c35def09-574d-4138-84a3-62e8d27f77f8` | `osis-2026` | DRAFT | false | 0 |

Periode terakhir memiliki 52 pemilih dan satu calon; status isTest=false tidak dianggap izin hapus otomatis. Pengguna ditanya khusus dan menjawab **hapus**. Persetujuan ini hanya berlaku pada empat UUID di atas.

## Pembersihan dan migrasi

[Cleanup offline](../../scripts/sql/evoting-sample-cleanup.sql) dijalankan dalam satu transaksi dengan manifest UUID/slug/previewVersion, actor superadmin aktif, alasan persetujuan dan backup, lock tabel, serta pemeriksaan hash sebelum/sesudah. Seluruh 11 trigger awal kembali identik sebelum commit. Tidak memasang bypass/grant permanen atau mengubah batas API hapus-uji.

| Data sampel | Dihapus |
| --- | --- |
| ElectionPeriod | 4 |
| ElectionContest | 16 |
| CandidatePair / CandidateMember | 15 / 16 |
| ElectionVoter | 63 |
| VoterParticipation | 252 |
| Ballot | 44 |
| VotingSession | 0 |

**149 audit lama tetap utuh** berdasarkan hash; empat `MIGRATION_SAMPLE_DELETED` ditambahkan sehingga total 153. Hash seluruh 28 tabel lain tidak berubah pada cleanup, termasuk master, akun, CMS, media, rate bucket dan riwayat migrasi. Tidak menghapus object R2.

Kemudian Prisma `migrate deploy` menerapkan [20261017090000_dynamic_election_types](../../prisma/migrations/20261017090000_dynamic_election_types/migration.sql), selesai **23.20.23 WIB**. Baris migrasi baru mempunyai finished_at dan checksum yang cocok; jumlah riwayat remote menjadi 29. Tidak mengedit migrasi lama. Log deploy/status menyatakan berhasil/up to date; wrapper PowerShell melaporkan exit1 karena keluaran stderr native, sehingga keberhasilan juga dibuktikan langsung melalui katalog dan riwayat DB.

## Verifikasi setelah migrasi

- Kolom, constraint, trigger dan fungsi scope pemilihan cocok dengan hasil SQL target pada PGlite. Enum VotingOrganization sudah dihapus, CandidateMode tersedia, relasi organisasi memakai master jenis.
- Lima master tersedia: OSIS, PRADANA_PUTRA, PRADANA_PUTRI, IPNU, IPPNU. Pradana mode SINGLE; tiga jenis lainnya OPTIONAL_VICE. Tidak membuat periode atau pemilih dummy.
- Query baca memakai generated Prisma Client dan adapter Neon aplikasi berhasil untuk ElectionType, metadata/contest periode, dan jumlah master. Jumlah periode saat selesai **0**; panitia perlu membuat periode baru.
- **52 Student, 7 Teacher, 5 SchoolClass, 2 Department, 5 Account, 16 Media**, serta seluruh tabel CMS/master lainnya tetap sesuai hash sebelum migrasi. Audit lama tetap identik; tidak hanya membandingkan jumlah.
- `prisma validate` dan `prisma generate` berhasil. Tidak menjalankan pemungutan suara nyata atau tes destruktif pada master Neon.

## Pekerjaan yang tetap tersisa

T10 upload WebP, T11 pengujian gabungan/endpoint hasil internal/status HTTP publikasi, pemulihan tiga arsip migrasi historis, role runtime nonowner, commit/push, deployment aplikasi yang kompatibel dan smoke test hosted/Chromebook belum selesai. Tidak mengklaim migrasi DB sebagai selesainya seluruh rilis.

**Vercel belum diperbarui pada langkah ini.** Runtime lama yang mengasumsikan empat enum/hasil v1 dapat gagal pada fitur e-voting terhadap schema baru. Jangan membuat periode resmi atau memakai pemungutan suara hosted sebelum artifact yang kompatibel terpasang dan diverifikasi. Rollback kode lama saja tidak memulihkan schema atau sampel yang dihapus; gunakan cadangan dan prosedur pemulihan yang sesuai.
