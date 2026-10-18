# Schema dan constraint — target T01

**Pembaruan Neon 17 Oktober 2026:** migrasi schema dan cleanup empat periode yang disetujui sudah berhasil setelah backup teruji. Master dan audit lama tetap; deployment belum dilakukan. [Catatan pelaksanaan](13-catatan-migrasi-neon.md).

Status: **T01–T04 selesai lokal 17 Oktober 2026; schema sudah diterapkan pada Neon; aplikasi belum dirilis**. [Prisma](../../prisma/schema.prisma), [migration](../../prisma/migrations/20261017090000_dynamic_election_types/migration.sql), [17 uji SQL](../../src/lib/voting/dynamic-types-db.test.ts), [uji runtime Prisma](../../src/lib/voting/dynamic-voting.test.ts), [ADR 0003](adr/0003-jenis-pemilihan-dinamis.md), [API](04-api.md), [operasional](07-operasional.md). Student/Teacher dan master sekolah tidak diganti. Parser dan rekonsiliasi snapshot v2 sudah dipakai lokal.

## Model dan kamus field

Konvensi tabel/kolom existing dipertahankan. Semua UUID pemilu v4; waktu timestamptz(3) UTC. String input di-trim sebelum validasi; kode tidak diubah case secara diam-diam. Enum `VotingOrganization` diganti varchar(32) pada **seluruh** kolom organization, termasuk CandidateMember dan Ballot. Enum baru `CandidateMode` hanya `SINGLE | OPTIONAL_VICE`; CandidatePosition tetap `CHAIR | VICE_CHAIR`.

| Model/field | Tipe, kewajiban dan aturan |
| --- | --- |
| ElectionType.code | PK varchar(32), regex `^[A-Z][A-Z0-9_]{1,31}$`, immutable; kode duplikat ditolak |
| name | varchar(120), 1–120 karakter |
| logoUrl | varchar(1024) nullable; Media image sekolah/R2 yang valid; tanpa URL pihak ketiga |
| candidateMode | CandidateMode wajib |
| chairLabel | varchar(80), 1–80 karakter |
| viceChairLabel | varchar(80) nullable; SINGLE wajib null; OPTIONAL_VICE wajib 1–80 karakter |
| active | boolean wajib, default true di DB; input CRUD eksplisit |
| sortOrder | integer 0–9999; urutan master, tidak harus unik |
| revision | integer >=0 default 0; setiap perubahan efektif naik satu |
| createdAt | timestamptz(3), default now; immutable |
| ElectionPeriod.contestsRevision | integer >=0 default 0, guard optimistic untuk susunan; create berikut contest awal tetap revision 0 |
| ElectionContest | PK `(periodId, organization)` existing, FK period RESTRICT dan organization → ElectionType.code RESTRICT untuk update/delete |
| nameSnapshot, logoUrlSnapshot | nama/logo disalin saat pemasangan; batas dan nullability mengikuti master |
| candidateModeSnapshot | CandidateMode; bukan lookup master saat menampilkan periode |
| chairLabelSnapshot, viceChairLabelSnapshot | batas/aturan nullability sesuai mode snapshot |
| sortOrder (contest) | integer 1–20; urutan kontigu 1..N dalam satu periode |

Master aktif tidak membatasi contest yang sudah terpasang. Snapshot dipilih server, tidak pernah diterima sebagai input CRUD periode. Pada reorder, field snapshot retained tidak berubah. Tidak ada refresh otomatis atau endpoint refresh pada paket ini. Snapshot semua contest terkunci setelah SCHEDULED; susunan hanya berubah di DRAFT. Delete master terpakai ditolak; nonaktifkan untuk mencegah pemasangan baru.

## Relasi, uniqueness dan index

| Bagian | Ketentuan wajib |
| --- | --- |
| ElectionType | index `(active, sortOrder, code)`; FK pemakaian RESTRICT. Tidak cascade ke periode |
| ElectionContest | unique `(periodId, sortOrder)` **DEFERRABLE INITIALLY DEFERRED** agar tukar urutan atomik; index organization untuk lookup penggunaan master |
| CandidatePair | FK `(periodId, organization)` → contest; unique `(periodId, organization, ballotNumber)`; unique `(id, periodId, organization)` sebagai target FK member/ballot; ballotNumber 1..2147483647; vision/mission 1–2000 karakter |
| CandidateMember | PK `(candidatePairId, position)`; FK `(candidatePairId, periodId, organization)` → pair; Student FK RESTRICT; unique `(periodId, organization, studentId)` lintas pasangan; index studentId untuk riwayat pencalonan |
| Snapshot anggota | nameSnapshot varchar(120)/classSnapshot varchar(40) existing disalin dari Student ketika anggota ditambahkan atau studentId diganti; edit foto/visi/misi anggota yang sama mempertahankan snapshot. photoUrl opsional Media image, <=1024. Tidak menerima nama/kelas bebas |
| Komposisi | SINGLE tepat satu CHAIR tanpa VICE_CHAIR; OPTIONAL_VICE tepat satu CHAIR dan nol/satu VICE_CHAIR. Student berbeda dijamin uniqueness; constraint trigger deferred memeriksa keadaan akhir pair/member |
| ElectionVoter | Tepat satu Student atau Teacher sesuai voterType; FK master RESTRICT; unique period+studentId, period+teacherId, period+login identifier; total gabungan <=99. Kode guru `GURU-` +12 heksadesimal unik per periode; Student memakai NISN 10 angka. Tidak membuat Student dari guru |
| VoterParticipation | PK voterId+organization; composite FK voterId+periodId → voter dan periodId+organization → contest; tepat himpunan N contest periode per voter pada akhir transaksi |
| Ballot | Hanya id UUIDv4, periodId, organization, candidateId; FK composite ke contest dan candidate pair yang sama. Index `(periodId, organization, candidateId)`. Tanpa voterId/memberId/studentId/sessionId, timestamp, receipt atau nomor urut suara |
| Sesi/PIN | VotingSession voterId unik, tokenHash unik; scope hanya ELECTION_VOTING. PIN hash dan HMAC fingerprint null bersama/terisi bersama; unique periodId+pinFingerprint; versi >=0. Tidak memindahkan kredensial ke Student/Teacher |
| Jadwal | opensAt < closesAt; partial unique index state SCHEDULED; isTest/slug immutable. DRAFT/SCHEDULED belum punya closedAt/publishedAt/snapshot; CLOSED/ARCHIVED harus closedAt+snapshot; publishedAt >=closedAt |
| Audit | VotingAuditEvent.periodId nullable tanpa FK penghapusan periode; guard INSERT memeriksa periode existing jika nonnull. actorAccountId CUID FK Account RESTRICT; audit append-only. Master events periodId=null,targetId=code |

FK yang sudah ada tidak boleh hilang ketika mengubah tipe organization. Primary key/unique tetap menjaga tenant periode/jenis; tidak mengganti relasi dengan JSON. Constraint lintas baris membutuhkan trigger + lock service, bukan CHECK yang melakukan query tabel lain. [Dokumentasi PostgreSQL constraint trigger](https://www.postgresql.org/docs/current/trigger-definition.html).

## Guard dan transaksi yang harus dibawa ke migrasi

Nama existing di bawah sudah dicocokkan dengan migrasi repo pada T02; inventaris schema Neon sudah cocok dengan target setelah migrasi; role/grants runtime nonowner masih wajib diverifikasi. Guard contest memakai `evoting_protect_contest`/`ElectionContest_protect_snapshot`; validasi himpunan memakai `evoting_validate_period_shape`/constraint trigger deferred. Jangan mengedit migrasi historis. Prisma hanya merepresentasikan unique order; sifat DEFERRABLE tetap berasal dari migration SQL dan tidak boleh diganti index immediate lewat db push.

| Guard | Perubahan/ketentuan target |
| --- | --- |
| `evoting_validate_candidate_pair_id` | Ganti logika komposisi mengikuti candidateModeSnapshot; deferred memeriksa pair yang masih ada saat commit |
| `evoting_lock_candidate_before_open` | Pair/member DRAFT boleh, SCHEDULED hanya sebelum opensAt; lock periode FOR UPDATE dan waktu DB sesudah lock; sesudah buka ditolak |
| `evoting_participation_monotonic` | Tolak perubahan key dan true→false. Delete false hanya saat mutasi roster sebelum buka atau melepas contest DRAFT yang sah; jangan membuka delete sesudah close |
| `evoting_protect_voter_identity` | Tetap melindungi Student/Teacher reference dan snapshot; koreksi NISN existing yang belum memilih mengikuti dua pemeriksa dan pencabutan PIN/sesi |
| Guard contest baru | Tolak snapshot update; hanya sortOrder dapat berubah di DRAFT. Insert/delete hanya DRAFT di bawah lock periode; ada candidate/ballot/true participation menolak pelepasan |
| Validasi himpunan baru | Deferred constraint trigger pada period/contest/voter/participation memeriksa 1–20 jenis, urutan kontigu dan tepat N hak tiap voter saat commit. Menunda validasi selama compound create/replace/roster; tidak membolehkan keadaan akhir tanpa contest. Periode yang sudah dihapus lewat cleanup sah tidak diperiksa lagi |
| `evoting_reject_ballot_change` | UPDATE/DELETE tetap ditolak runtime; larangan TRUNCATE/grant tetap. Tidak ada perubahan izin demi migrasi harian |
| `evoting_protect_period_identity` | Pertahankan state/identity/freeze/snapshot immutable; tambahkan contestsRevision hanya untuk penggantian DRAFT, larang close sebelum opensAt. Hapus syarat turnout penuh, bukan rekonsiliasi |
| Audit insert/existing period + append-only | Audit master dengan periodId null valid. Event close/CRUD dan mutasi satu transaksi; insert cleanup sebelum parent dihapus, audit UUID periode tetap tersimpan |
| `evoting_test_cleanup_allowed`, `evoting_delete_test_period` | Exact satu periode isTest, termasuk published/archived sesuai keputusan18Oktober dan migrasi20261018090000. Superadmin/izin/konfirmasi/versi tetap diperiksa; DELETE berurutan dan atomik, master/audit tetap tersimpan |

Semua operasi periode memakai lock urut periode → voter → sesi. Vote memakai FOR SHARE pada periode; mutasi administrasi/close FOR UPDATE. CRUD master hanya lock master, sementara penggantian contest lock periode lalu master terurut code; master tidak mengambil lock periode. Hindari deadlock dan validasi berdasarkan clock sebelum menunggu lock. Lihat [desain](02-desain.md).

Constraint deferred row hak/voter memeriksa himpunan pemilih yang berubah; event periode/contest memeriksa seluruh roster dengan agregat JOIN. Ini menghindari pemeriksaan ulang seluruh roster untuk setiap hak pada batch 99×20, tanpa melewati validasi pemilih yang tidak mendapat event ketika jenis baru dipasang. Tidak memakai flag transaksi untuk mematikan constraint.

Revisi stale ditolak sebelum no-op. No-op revision cocok tidak menambah audit/revision. Penggantian contest membuat/menghapus participation false atomik bersama audit, tanpa mengubah PIN atau snapshot identitas. Jika salah satu bagian gagal, rollback seluruhnya.

## Snapshot hasil versi 2

Sumber struktur ketat adalah schema `ResultSnapshot` pada [OpenAPI](contracts/e-voting-v2.openapi.json). Bentuk:

```text
{ version:2, eligibleVoters, notStarted, partial, complete, contests:[
  { organization, name, logoUrl, candidateMode, chairLabel, viceChairLabel,
    sortOrder, votesCast, candidates:[
      { candidateId, ballotNumber, vision, mission,
        chair:{name,className,photoUrl}, viceChair:null|{name,className,photoUrl}, votes }
    ] }
] }
```

Tidak ada studentId/NISN/teacherId/voter/sesi/timestamp per suara/breakdown kelompok di snapshot publik. CandidateMember.studentId tetap dapat dicari internal untuk riwayat, tanpa officeholder/masa jabatan MVP. Snapshot menyalin metadata contest dan snapshot anggota, tidak membaca Student/master jenis terbaru. Foto/logo memakai key immutable; alur media wajib menjaga referensi snapshot.

Validator semantik wajib setelah validasi struktur:

- N=1..20; organization unik, sortOrder tepat 1..N, kandidat ID/nomor unik per contest, minimal satu kandidat valid dan mode/anggota cocok.
- eligibleVoters=1..99; notStarted+partial+complete=eligibleVoters. N=1 mensyaratkan partial=0.
- Per jenis: jumlah candidate votes = votesCast = jumlah participation true <=eligibleVoters. Semua kandidat termasuk nol tetap ada.
- Total ballot=sum(votesCast); `complete*N + partial <= total <= complete*N + partial*(N-1)`. Periksa pula setiap votesCast >=complete dan <=complete+partial. Tidak cukup hanya memvalidasi total.
- Snapshot harus cocok dengan hitungan ledger/ballot pada transaksi close. Tidak ada foreign key pemilih-ke-ballot untuk membuktikan tautan individual; anonimitas dan rekonsiliasi aggregate tetap terpisah.

Nol ballot sah dengan roster nonkosong; seluruhnya notStarted. Persentase dihitung untuk tampilan, bukan disimpan sebagai sumber kebenaran. Seri tetap seri; tidak ada winner otomatis. Versi 1 sampel boleh dibersihkan; runtime v2-only baru dirilis bila tidak ada snapshot legacy tersisa. Jangan menafsirkan versi 1 sebagai lima jenis atau menghapus data di luar manifest.

## Transisi dan retensi

Urutan migrasi T02/T12: inventaris enum/FK/trigger/function/index → backup → maintenance writer → cleanup exact sampel → buat master/seed lima → ubah kolom enum menjadi varchar secara eksplisit → bangun ulang FK/check/trigger dinamis → verifikasi. Jangan `DROP ... CASCADE`; daftar dependency harus eksplisit. Bila data nonsampel ditemukan, hentikan transisi dan rancang backfill/compatibility; tidak memaksa cleanup semua tabel.

Migration T02 menolak semua data pemilihan yang masih tersisa dengan `EVOTING_MIGRATION_REQUIRES_EMPTY_ELECTION_DATA`; tidak menghapus sampel otomatis atau menafsirkan snapshot v1. Audit lama boleh tetap ada. Seed lima ada di migration yang sama, bukan menjalankan seed CMS/demo. Cleanup offline terpisah hanya memakai manifest exact dan memulihkan definisi trigger dalam transaksi. Rollback memakai backup/restore schema+data+code yang sesuai; rehearsal PGlite telah diuji, restore Neon belum.

Seed: OSIS/IPNU/IPPNU mode OPTIONAL_VICE dengan label Ketua/Wakil Ketua; PRADANA_PUTRA/PRADANA_PUTRI mode SINGLE dengan label Pradana Putra/Pradana Putri, viceChairLabel null; logo null sampai aset resmi dipilih. sortOrder awal 1..5. Kode DEWAN_AMBALAN tidak dipasang pada periode baru; hanya hapus master legacy setelah seluruh referensinya bersih. Tidak membuat periode, voter atau akun demo di Neon.

Tidak ada cascade dari periode ke Student/Teacher/SchoolClass/Department/Account/CMS/Media. Setelah masa sanggah 30 hari hapus PIN hash/fingerprint dan sesi; roster/audit satu tahun, aggregate lintas tahun. Penghapusan PII/ledger setelah retensi memerlukan prosedur offline tersendiri agar tidak merusak snapshot/constraint; bukan delete runtime biasa. Master sekolah mengikuti kebijakan terpisah. Runtime role nonowner/grants harus diverifikasi pada T12, bukan diasumsikan sudah terpasang.
