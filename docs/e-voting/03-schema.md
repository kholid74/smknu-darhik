# Proposal Prisma dan invariant database

Status: fondasi schema dan migration additive sudah diterapkan di `prisma/schema.prisma` dan `prisma/migrations/20261011090000_e_voting_foundation`; `prisma validate`, `format`, dan `generate` lulus. Constraint SQL belum diuji pada PostgreSQL dan layanan/route belum diterapkan. Generator/provider yang ada dipertahankan. Perubahan tidak mengubah Alumni menjadi Student atau menjadikan role siswa internal sebagai daftar pemilih.

## Model yang diusulkan

`Student` adalah master persisten tanpa kredensial; `ElectionVoter` adalah snapshot dan kredensial siswa pada satu periode. Satu Student dapat memiliki banyak ElectionVoter dan CandidateMember lintas tahun. PIN tetap di ElectionVoter untuk MVP, bukan pada Student atau Account; belum perlu tabel akun permanen. `VoterParticipation` tidak memiliki candidateId. `Ballot` tidak memiliki studentId, voterId atau sessionId. Tidak ada relasi balik terselubung melalui receipt, transaction ID aplikasi, batch vote, atau timestamp.

```prisma
enum ElectionState {
  DRAFT
  SCHEDULED
  CLOSED
  ARCHIVED
}

enum VotingOrganization {
  OSIS
  DEWAN_AMBALAN
  IPNU
  IPPNU
}

enum CandidatePosition {
  CHAIR
  VICE_CHAIR
}

enum VotingSessionScope {
  ELECTION_VOTING
}

model Student {
  id        String          @id @default(uuid()) @db.Uuid
  nisn      String          @unique @db.VarChar(10)
  name      String          @db.VarChar(120)
  className String          @db.VarChar(40)
  voters               ElectionVoter[]
  candidateMemberships CandidateMember[]
}

model ElectionPeriod {
  id             String        @id @default(uuid()) @db.Uuid
  slug           String        @unique @db.VarChar(64)
  name           String        @db.VarChar(120)
  academicYear   String        @db.VarChar(20)
  state          ElectionState @default(DRAFT)
  opensAt        DateTime       @db.Timestamptz(3)
  closesAt       DateTime       @db.Timestamptz(3)
  extensionUsedAt DateTime?      @db.Timestamptz(3)
  closedAt       DateTime?      @db.Timestamptz(3)
  publishedAt    DateTime?      @db.Timestamptz(3)
  resultSnapshot Json?
  createdAt      DateTime       @default(now()) @db.Timestamptz(3)
  contests       ElectionContest[]
  voters         ElectionVoter[]
  auditEvents    VotingAuditEvent[]
}

model ElectionContest {
  periodId      String             @db.Uuid
  organization  VotingOrganization
  period        ElectionPeriod     @relation(fields: [periodId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  candidates    CandidatePair[]
  participation VoterParticipation[]

  @@id([periodId, organization])
}

model CandidatePair {
  id            String             @id @default(uuid()) @db.Uuid
  periodId      String             @db.Uuid
  organization  VotingOrganization
  ballotNumber  Int
  vision        String             @db.VarChar(2000)
  mission       String             @db.VarChar(2000)
  contest       ElectionContest    @relation(fields: [periodId, organization], references: [periodId, organization], onDelete: Restrict, onUpdate: Restrict)
  members       CandidateMember[]
  ballots       Ballot[]

  @@unique([periodId, organization, ballotNumber])
  @@unique([id, periodId, organization])
}

model CandidateMember {
  candidatePairId String             @db.Uuid
  periodId        String             @db.Uuid
  organization    VotingOrganization
  studentId       String             @db.Uuid
  position        CandidatePosition
  nameSnapshot    String             @db.VarChar(120)
  classSnapshot   String             @db.VarChar(40)
  photoUrl        String?            @db.VarChar(1024)
  pair            CandidatePair      @relation(fields: [candidatePairId, periodId, organization], references: [id, periodId, organization], onDelete: Restrict, onUpdate: Restrict)
  student         Student            @relation(fields: [studentId], references: [id], onDelete: Restrict, onUpdate: Restrict)

  @@id([candidatePairId, position])
  @@unique([periodId, organization, studentId])
  @@index([studentId, periodId])
}

model ElectionVoter {
  id                String             @id @default(uuid()) @db.Uuid
  studentId         String             @db.Uuid
  periodId          String             @db.Uuid
  nisn              String             @db.VarChar(10)
  name              String             @db.VarChar(120)
  className         String             @db.VarChar(40)
  credentialEnabled Boolean            @default(true)
  pinHash           String?            @db.VarChar(60)
  pinFingerprint    String?            @db.Char(64)
  pinVersion        Int                @default(0)
  period            ElectionPeriod     @relation(fields: [periodId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  student           Student            @relation(fields: [studentId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  participation     VoterParticipation[]
  session           VotingSession?

  @@unique([periodId, nisn])
  @@unique([periodId, studentId])
  @@unique([periodId, pinFingerprint])
  @@index([studentId])
  @@unique([id, periodId])
  @@index([periodId, className])
}

model VoterParticipation {
  voterId      String             @db.Uuid
  periodId     String             @db.Uuid
  organization VotingOrganization
  hasVoted     Boolean            @default(false)
  voter        ElectionVoter      @relation(fields: [voterId, periodId], references: [id, periodId], onDelete: Restrict, onUpdate: Restrict)
  contest      ElectionContest    @relation(fields: [periodId, organization], references: [periodId, organization], onDelete: Restrict, onUpdate: Restrict)

  @@id([voterId, organization])
  @@index([periodId, organization, hasVoted])
}

model Ballot {
  id           String             @id @default(uuid()) @db.Uuid
  periodId     String             @db.Uuid
  organization VotingOrganization
  candidateId  String             @db.Uuid
  candidate    CandidatePair      @relation(fields: [candidateId, periodId, organization], references: [id, periodId, organization], onDelete: Restrict, onUpdate: Restrict)

  @@index([periodId, organization, candidateId])
}

model VotingSession {
  id         String        @id @default(uuid()) @db.Uuid
  scope      VotingSessionScope @default(ELECTION_VOTING)
  voterId    String        @unique @db.Uuid
  tokenHash  String        @unique @db.Char(64)
  createdAt  DateTime      @default(now()) @db.Timestamptz(3)
  lastSeenAt DateTime      @db.Timestamptz(3)
  expiresAt  DateTime      @db.Timestamptz(3)
  voter      ElectionVoter @relation(fields: [voterId], references: [id], onDelete: Cascade, onUpdate: Restrict)

  @@index([expiresAt])
}

model VotingRateBucket {
  key       String   @id @db.Char(64)
  attempts  Int      @default(0)
  expiresAt DateTime @db.Timestamptz(3)

  @@index([expiresAt])
}

model VotingAuditEvent {
  id             String          @id @default(uuid()) @db.Uuid
  periodId       String?         @db.Uuid
  actorAccountId String?
  event          String          @db.VarChar(64)
  targetId       String?         @db.VarChar(64)
  reasonCode     String?         @db.VarChar(64)
  detail         Json?
  createdAt      DateTime         @default(now()) @db.Timestamptz(3)
  period         ElectionPeriod? @relation(fields: [periodId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  actor          Account?        @relation(fields: [actorAccountId], references: [id], onDelete: Restrict, onUpdate: Restrict)

  @@index([periodId, createdAt])
  @@index([actorAccountId, createdAt])
}
```

Tambahkan relasi balik berikut pada **model Account yang sudah ada**, bukan membuat Account baru:

```prisma
votingAuditEvents VotingAuditEvent[]
```

`Account.id` saat ini string CUID tanpa native UUID; `actorAccountId` sengaja tetap String biasa. Semua UUID pemilu harus acak v4; pastikan semantik default Prisma terkunci saat validasi, dan gunakan `crypto.randomUUID()` eksplisit saat insert ballot. Jangan ganti menjadi UUID yang dapat diurutkan berdasarkan waktu.

## Constraint SQL tambahan wajib

Prisma schema tidak merepresentasikan seluruh kebijakan berikut. Migration SQL additive harus menyertakannya; tes dengan database nyata, bukan hanya `prisma validate`.

| Constraint/policy | Implementasi yang direncanakan |
| --- | --- |
| Master independen | Student.nisn unik global, Student tanpa pinHash/passwordHash/role/session; FK Student → ElectionVoter restriktif, tidak cascade dari periode/roster ke master |
| Eligibility per siswa | Unique `(periodId, studentId)` selain `(periodId, nisn)`; koreksi NISN tidak dapat membuat hak pilih kedua untuk Student yang sama |
| CandidateMember FK/uniqueness | Candidate pair FK mencakup pair/period/organization; Student FK restrict; unique `(periodId, organization, studentId)` mencegah assignment ganda lintas pasangan; primary key `(candidatePairId, position)` membatasi satu anggota per posisi |
| Pasangan lengkap | `CHAIR` dan `VICE_CHAIR` wajib tepat satu masing-masing dan studentId berbeda. Deferred constraint trigger/service memvalidasi dua baris setelah transaksi CRUD, juga saat periode dibuka; tidak cukup mengandalkan dua unique index |
| Candidate history/snapshot | `nameSnapshot` dan `classSnapshot` disalin dari Student oleh server saat penetapan anggota; update master tidak mengubah snapshot. Index `CandidateMember.studentId` mendukung pencarian riwayat calon. Tidak ada model masa jabatan/officeholder |
| Candidate edits | Seluruh mutasi pair/member/audit satu transaksi; hanya sebelum opensAt. Trigger/service dengan lock periode menolak perubahan saat/selepas buka, dan candidate set tervalidasi sebelum membuka |
| PIN unik per periode | Unique `(periodId, pinFingerprint)`; NULL sebelum diterbitkan. CHECK pinHash dan fingerprint sama-sama NULL atau sama-sama terisi; service memastikan fingerprint HMAC dan regenerasi collision |
| Scope sesi | Enum hanya ELECTION_VOTING; periode didapat lewat voter FK, tidak dari parameter browser. Guard scope/time juga berlaku pada dashboard, tidak ada session Student umum |
| Jadwal valid | CHECK `opensAt < closesAt`; `extensionUsedAt` nullable menandai satu-satunya perpanjangan; perubahan `closesAt` menyimpan nilai sebelum/sesudah, aktor dan alasan di audit |
| Bentuk NISN, nomor calon, versi | CHECK NISN regex `^[0-9]{10}$`, ballotNumber > 0, pinVersion ≥ 0, attempts ≥ 0 |
| Satu periode terjadwal | Partial unique index pada state untuk baris `state = 'SCHEDULED'`; periode lama harus ditutup sebelum menjadwalkan berikutnya |
| State dan snapshot konsisten | DRAFT/SCHEDULED: closedAt, publishedAt, resultSnapshot SQL NULL; CLOSED/ARCHIVED: closedAt dan snapshot non-null; publishedAt hanya boleh setelah closedAt |
| Deadline penutupan | CHECK closedAt null atau closedAt ≥ closesAt; service memeriksa waktu DB |
| Empat organisasi dan empat hak per voter | Create period membuat empat contest; sinkronisasi master membuat empat participation atomik. Gate schedule menghitung seluruh kelengkapan di bawah lock periode |
| Surat suara tak berubah | Runtime role: INSERT/SELECT yang diperlukan, tanpa UPDATE/DELETE/TRUNCATE atas Ballot. Trigger menolak UPDATE/DELETE untuk defense in depth; runtime bukan owner dan tidak punya DDL |
| Partisipasi monoton | Trigger menolak perubahan key dan true → false; DELETE hanya sebelum schedule dan ketika false, lewat service DRAFT yang mengunci periode |
| Kandidat/roster/jadwal beku | Membership roster/calon/jadwal beku saat dibuka; exception koreksi NISN hanya untuk voter belum memilih dengan dua pemeriksa, Student ID tetap dan reissue PIN. Perpanjangan sekali maksimal 60 menit dicatat di extensionUsedAt dan audit. Perubahan kredensial dibatasi kolomnya dan tidak mengubah hak pilih |
| Hasil immutable | Setelah CLOSED, snapshot, jadwal, kandidat dan roster tidak dapat berubah; hanya publikasi sekali, archive dan cleanup sesi yang diizinkan |
| Audit append-only | Runtime dapat insert/read, tidak update/delete; FK Restrict mencegah Account panitia dihapus selama masih dirujuk audit. Nonaktifkan akun selama retensi |

Contoh index yang harus ada pada SQL migrasi:

```sql
CREATE UNIQUE INDEX "ElectionPeriod_one_scheduled"
ON "ElectionPeriod" ("state")
WHERE "state" = 'SCHEDULED';
```

Penambahan CHECK/trigger yang membaca lintas baris tidak menggantikan urutan lock pada service. Uji deadlock antara edit DRAFT, schedule, submit, reset, logout dan close. Jadwalkan hanya setelah seluruh import/cetak selesai.

## Apa yang dijamin, dan apa yang tidak

- Primary key partisipasi dan update conditional mencegah penggunaan hak pilih dua kali dalam jalur transaksi resmi. Composite FK memastikan voter/contest/candidate tidak tertukar periode atau organisasi.
- Tidak ada FK yang membuktikan ballot tertentu milik partisipasi tertentu, karena tautan itu sengaja ditiadakan. Kesetaraan jumlah lintas dua tabel bergantung pada transaksi resmi dan rekonsiliasi; jangan mengklaim unique index saja menjamin semua integritas ini.
- Runtime yang dibajak atau operator DB berprivilege dapat menyisipkan ballot di luar service atau menonaktifkan trigger. Least privilege mengurangi dampak tetapi tidak membuktikan sistem tahan administrator jahat. Batas ini ada di [ADR](adr/0001-integrasi-dan-batas-kerahasiaan.md).
- UUID ballot, row order, MVCC dan waktu sesi tetap dapat dikorelasikan oleh operator. Sesi menyimpan waktu karena expiry membutuhkannya; retensi singkat mengurangi jejak, bukan menghapus historinya di backup.

## Bentuk snapshot hasil

`resultSnapshot` adalah objek versi 1, tervalidasi ketat sebelum tersimpan; bukan dump ORM. Memuat `version`, `eligibleVoters`, `notStarted`, `partial`, `complete`, serta empat `contests` berisi organization, `votesCast`, dan daftar pasangan `{candidateId, ballotNumber, vision, mission, chair:{name,className,photoUrl}, viceChair:{name,className,photoUrl}, votes}`. Semua kandidat, termasuk nol, dimuat. Label dan foto kandidat disalin dari CandidateMember snapshot agar hasil arsip tidak berubah ketika master Student diperbarui. Snapshot publik tidak memuat studentId; riwayat internal dicari melalui FK dan index CandidateMember.studentId. Tidak memuat voter, sesi, timestamp per suara, atau breakdown pemilih.

Snapshot dibuat sekali di transaksi close. Sum candidate votes = votesCast = count partisipasi true untuk organisasi itu. `notStarted + partial + complete = eligibleVoters`; jumlah partisipasi seluruh organisasi berada antara complete × 4 dan eligibleVoters × 4. Presentase dihitung untuk tampilan dengan pembulatan, bukan sumber hitungan.

Ballot tetap menyimpan hanya UUID ballot, periodId, organization dan candidateId pasangan. CandidateMember menghubungkan calon ke Student untuk administrasi/riwayat, tetapi Ballot tidak menyimpan studentId maupun memberId dan transaksi vote tidak menambah relasi pemilih-ke-calon. Semua lock, conditional update partisipasi, insert ballot atomik, idempotensi penolakan, close lock dan rekonsiliasi yang disepakati tetap berlaku.

## Migrasi dan retensi

Master Student diisi dari sumber resmi dan disahkan registrar; jangan mengambil Account ber-role siswa atau Alumni secara otomatis atau mencocokkan otomatis berdasarkan nama. Pemilih periode diambil dari Student yang terhubung ke SchoolClass pada tahun ajaran periode; Student tanpa kelas terhubung dikecualikan. Sinkronisasi sebelum buka hanya menambah Student yang belum ada, tidak membuat/mengubah Student, dan mempertahankan snapshot roster yang sudah ada. Koreksi NISN perlu dua pemeriksa, mempertahankan studentId, dan tidak boleh dilakukan setelah siswa memberi suara. Sebelum buka atau untuk pemilih belum memilih setelah buka, sinkronisasi snapshot eksplisit mencabut hash/fingerprint/sesi dan memerlukan PIN baru. Tidak ada endpoint penggantian studentId pada roster. Pemeriksa kedua adalah prosedur operasional; field/audit mencatat saksi tetapi aplikasi tidak membuktikan kehadiran dua orang.

Penutupan, pencabutan PIN, cleanup sesi atau penghapusan roster sebelum buka tidak menghapus master. Setelah masa sanggah 30 hari, hash/fingerprint PIN dan sesi dibersihkan; roster/audit disimpan satu tahun dan hasil agregat lintas periode. Pembersihan kredensial tidak boleh mengubah snapshot, ledger atau ballot setelah close. Penghapusan PII master adalah kebijakan terpisah. Akun permanen, reset password, data akademik dan relasi Account?Student tidak ditambahkan dalam MVP.

Migrasi awal hanya membuat enum/tabel/index/constraint/trigger serta relasi Account balik pada client; tidak ada backfill wajib pada data website. Tidak menjalankan seed demo untuk membuat periode produksi. Fixture sintetis berada di test terpisah.

Hapus sesi kedaluwarsa dan bucket limiter lewat cleanup berkala. Tidak ada cascade dari periode/candidate/voter ke ballot. Setelah masa retensi disahkan, penghapusan PII/ledger memerlukan prosedur offline terpisah beserta penyesuaian trigger/constraint yang direview; jangan menambahkan tombol hapus permanen sebelum kebijakan tersebut ada. Snapshot aggregate dan periode tahunan dapat dipertahankan tanpa menyimpan PIN mentah (yang memang tidak pernah disimpan).
