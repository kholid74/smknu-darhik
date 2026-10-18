# Kontrak API — target T01

**Pembaruan T11, 18 Oktober:** endpoint hasil internal dan status publikasi401/429 diterapkan. Regresi232tes lulus (satu penanda tes DB dilewati dan dijalankan terpisah), PostgreSQL lokal lintas koneksi6/6, browser37skenario, Prisma validate/generate dan build lulus. Penerimaan R2/Vercel/perangkat tetap belum selesai. [Bukti T11](06-pengujian.md#bukti-dan-gerbang-rilis).

**Pembaruan upload 18 Oktober:** T10 sudah diimplementasikan dan diuji lokal (228 tes, 37 skenario browser, build lulus). Verifikasi object R2/hosted belum selesai karena konfigurasi R2 lokal belum tersedia. [Bukti dan batas](../image-upload-webp-study.md#implementasi-t10-dan-bukti-terbaru).

**Pembaruan Neon 17 Oktober 2026:** migrasi schema dan cleanup empat periode yang disetujui sudah berhasil setelah backup teruji. Master dan audit lama tetap; deployment belum dilakukan. [Catatan pelaksanaan](13-catatan-migrasi-neon.md).

Status 17 Oktober 2026: **T03 backend konfigurasi dan T04 hak pilih/sesi/suara/rekap dinamis selesai lokal.** [OpenAPI 3.1](contracts/e-voting-v2.openapi.json) memuat 21 operasi target. Master/create/susunan serta Dashboard, VotingStatus, ParticipationSummary, VoteRecorded dan PublicResults sudah diperiksa terhadap respons aktual pada fixture SQL/Prisma. Kontrak edit/hapus calon lengkap sudah diterapkan T06; penutupan tanpa turnout penuh beserta alasan sudah diterapkan T07. [Schema](03-schema.md), [desain](02-desain.md). Schema sudah dimigrasikan ke Neon; aplikasi belum dirilis.

## Aturan bersama

- Sukses JSON `{data:...}`, gagal `{error:{code}}`; tidak mengganti envelope repo. Dashboard khusus tetap `{data:...,csrfToken}`. Upload/cetak memiliki format terpisah di bawah.
- Internal memakai cookie `smkdh_token`, akun aktif dan izin DB terbaru. Semua endpoint panitia membutuhkan `evoting.lihat` serta izin tindakan. Sesi PIN tidak sah untuk admin, alumni atau upload.
- Mutasi memerlukan Origin same-origin dan `X-CSRF-Token` terikat akun/sesi; token GET admin berumur lima menit. Login memakai nonce preauth dan CSRF yang sama polanya dengan runtime; vote token 15 menit dibatasi umur sesi. Tidak menerima actorId dari body.
- JSON maksimum 16KiB, content-type application/json, unknown field ditolak. UUID v4 untuk ID pemilu; code organization uppercase regex schema. Semua string teks di-trim; password/PIN/token tidak di-trim/di-log. URL media diverifikasi server, bukan sekadar regex URL.
- `400 INVALID_INPUT`, `401 UNAUTHORIZED`/sesi tidak aktif, `403 FORBIDDEN`/`CSRF_REJECTED` (candidate existing memakai `CSRF_INVALID`), `404 NOT_FOUND`, `409` konflik state/stale/integritas, `413 BODY_TOO_LARGE`, `415 UNSUPPORTED_MEDIA_TYPE`, `429 RATE_LIMITED`, `503 TEMPORARILY_UNAVAILABLE`. Jangan meneruskan object Prisma, pesan SQL atau parameter sensitif ke klien/log.
- Semua respons pemilihan, termasuk hasil publik, `Cache-Control: private, no-store` sesuai middleware. Tidak mengaktifkan cache roster/status/tally. Read dengan retry terbatas boleh; jangan retry mutasi yang commit-nya tidak diketahui. Setelah vote timeout, cek status/login ulang; duplikat `409 ALREADY_VOTED` tidak mengungkap calon tersimpan.

## Master jenis dan susunan periode

Base panitia: `/api/admin/e-voting`. Semua detail field/range/required terdapat pada schema OpenAPI, tanpa free-text class/name untuk calon.

Implementasi T03: [service](../../src/lib/voting/election-types.ts), [validator](../../src/lib/voting/election-type-input.ts), [uji middleware/endpoint/SQL](../../src/lib/voting/election-types-api.test.ts). Origin/CSRF dan izin terkini wajib; GET master/susunan memberi token mutasi. POST memberi Location, DELETE tanpa body respons. Master active/nonaktif melalui PATCH; tidak ada endpoint tambahan yang menduplikasi tindakan itu. Semua target pada tabel berikut sudah diuji lokal, bukan sudah tersedia di Neon.

| Method/path | Izin tambahan | Kontrak/perilaku |
| --- | --- | --- |
| GET `/types` | — | q nama/kode <=120, active optional boolean, cursor opaque, limit default20 max100; sortOrder lalu code. `{data:{data:[ElectionType],nextCursor}}`; header X-CSRF-Token |
| POST `/types` | kelola | code,name,logoUrl,candidateMode,chairLabel,viceChairLabel,active,sortOrder eksplisit; `201 {data:ElectionType}` revision0 |
| PATCH `/types/{code}` | kelola | expectedRevision dan >=1 field mutable; merge lalu validasi mode/label; `200`. code tidak dapat dikirim/diganti |
| DELETE `/types/{code}` | kelola | `{expectedRevision}`; `204` jika belum pernah dipakai. Ulang setelah hilang404 |
| POST `/periods` | kelola | name,slug,academicYear,opensAt,closesAt,**organizations** ordered1–20 unik, isTest optional defaultfalse; `201 {data:PeriodConfig}`. DRAFT dan contestsRevision0; API tidak memilih default tersembunyi |
| GET `/{periodId}/contests` | — | `{data:{contests:[Contest],contestsRevision}}` metadata snapshot ordered; header token; tanpa PII |
| PUT `/{periodId}/contests` | kelola | `{organizations:[code...],expectedRevision}` mengganti susunan DRAFT atomik; respons sama GET. Setelah SCHEDULED409 |

Singkatan izin berarti `evoting.<nama>`. Master inactive tidak dapat dipasang baru; retained inactive boleh tetap/reorder. Setiap pemasangan baru mengambil snapshot master di bawah lock. Retained snapshot tidak direfresh; perubahan master hanya berlaku untuk pemasangan baru. Tidak ada endpoint refresh. Lepas contest berisi calon409 `CONTEST_HAS_CANDIDATES`; hapus calon lebih dulu lewat alur sah. Ada hak true/ballot pada DRAFT409 `RECONCILIATION_FAILED`.

Kode konflik: `DUPLICATE_TYPE`, `TYPE_IN_USE`, `STALE_CONFIG`, `INVALID_STATE`, `TYPE_INACTIVE`, `CONTEST_HAS_CANDIDATES`, `RECONCILIATION_FAILED`. Kode tidak dikenal pada input master/periode400 `INVALID_ORGANIZATION`. Revision stale409 bahkan bila payload no-op; no-op cocok200 tanpa increment/audit. Snapshot/type membership dan hak false+audit commit bersama. FK restrict mencegah race master delete dengan attach.

Logo baru harus cocok dengan baris Media kind=image dan origin/path sekolah atau R2 yang diizinkan; kegagalan400 `INVALID_LOGO`. URL relatif `/api/image/<key>` sah, sehingga schema MediaUrl memakai URI-reference (bukan URI absolut saja). Tidak menerima data/javascript URL atau prefix domain tiruan. Perubahan master tanpa mengganti logo tidak memaksa refresh snapshot. Penghapusan master tidak menghapus file Media/R2; proteksi semua alur hapus aset terpakai tetap penerimaan T10. Query list menerima cursor kanonis, filter literal nama/kode, limit1–100 dan menolak query ambigu/unknown dengan400 INVALID_INPUT/INVALID_CURSOR.

GET `/periods` tetap daftar periode existing tanpa snapshot/PII. GET `/{periodId}` menambahkan contests+contestsRevision pada detail/config existing. PATCH `/{periodId}` tetap name/academicYear/jadwal + expected configuration values existing; **tidak menerima organizations/snapshot**. Susunan diubah lewat PUT khusus. Slug/isTest immutable. Schedule `POST /{periodId}/schedule {}` kelola: roster1–99, Ncontest/calon/PIN/hak tepat dan jadwal siap; `409 NOT_READY`/`ANOTHER_SCHEDULED_PERIOD`. Kandidat/roster SCHEDULED masih dapat disiapkan sebelum buka, tetapi susunan sudah terkunci.

POST `/{periodId}/extend {reasonCode,adminPassword}` perpanjang: satu kali <=60 menit; tidak mengubah slate/jenis atau membuka CLOSED. POST `/{periodId}/archive {}` kelola: hanya CLOSED→ARCHIVED, retry idempoten; tidak mengubah snapshot.

## Calon, Student dan media

| Method/path | Izin tambahan | Ketentuan |
| --- | --- | --- |
| GET `/{periodId}/students/search?q=...&limit=20` | pemilih | Pilihan Student `{id,name,nisn,className}` (id terpilih dikirim sebagai studentId), header token; ketik teks memunculkan suggestion DB, hanya studentId terpilih dapat disimpan |
| POST `/{periodId}/candidates` | kelola+pemilih | `{organization,ballotNumber,chair:{studentId,photoUrl?},viceChair?:null|{studentId,photoUrl?},vision,mission}`; `201 {data:{candidateId}}` existing |
| PATCH `/{periodId}/candidates/{candidateId}` | kelola+pemilih | Payload penuh di atas + expected; organization immutable untuk pair; `200 {data:{updated:true}}` existing |
| DELETE `/{periodId}/candidates/{candidateId}` | kelola+pemilih | `{expected}`; 204. DRAFT boleh sementara tanpa calon; SCHEDULED sebelum buka harus tersisa >=1 valid; setelah buka ditolak |

Expected membandingkan `ballotNumber,chairStudentId,viceChairStudentId,chairPhotoUrl,viceChairPhotoUrl,vision,mission`; vice/photo kosong bernilai null. **Dua field foto serta body expected saat DELETE sudah diterapkan pada T06** bersama validator/form agar perubahan serentak tidak saling menimpa. Validasi input/API, SQL/Prisma, snapshot dan audit diuji lokal. Student sama/duplikat lintas pair pada contest/periode409 `DUPLICATE_CANDIDATE`; ID Student tidak valid400 `INVALID_STUDENT`; nomor ganda409 `DUPLICATE_CANDIDATE` mengikuti mapping existing; stale409 `STALE_CANDIDATE`.

SINGLE menolak wakil, OPTIONAL_VICE menerima nol/satu; objek wakil kosong invalid. Server menyalin nama/kelas hanya ketika anggota ditambahkan/Student ID diganti. Edit metadata/foto dengan Student sama mempertahankan snapshot; perubahan Student master tidak merombak riwayat. photoUrl boleh null untuk menghapus foto; omission pada full replace dianggap null. Mode dari contest snapshot, bukan master terkini. Kandidat/anggota/audit satu transaksi dan beku sesudah buka termasuk race.

Master siswa dan import Excel/CSV tetap di menu `/admin/siswa`, memakai Student/SchoolClass/Department existing. Tidak ada import roster pemilu kedua, akun permanen atau relasi akun siswa baru. Izin `student.kelola` tidak otomatis memberi kelola pemilihan.

### Kontrak upload T10

Route tetap sama; implementasi sekarang endpoint .ts. Origin wajib sama dengan request URL. Multipart dibaca dengan cap5MiB+64KiB sebelum parse, file maksimal5MiB; duplicate/unknown fields ditolak400. Folder yang didukung: uploads, artikel, testimoni, alumni, guru, e-voting, ekskul, galeri, downloads, fasilitas, prestasi, mitra, jurusan, pengumuman. Default assetKind mengikuti signature file; ekstensi dan kontainer harus sesuai allowlist. Dokumen PDF/DOC/DOCX/XLS/XLSX/PPT/PPTX/ZIP/RAR hanya diperiksa signature kontainer, bukan isi atau malware. Office lama memakai OLE, OOXML memakai ZIP; disajikan attachment/nosniff.

Reuse `/api/upload` (media.kelola internal) dan `/api/alumni/upload` (sesi alumni terpisah, foto saja). Kontrak ini sudah diterapkan lokal pada T10; penerimaan hosted belum selesai. Tidak memperluas izin PIN atau mendesain ulang autentikasi upload. Pemeriksaan same-origin/izin existing tetap harus lulus; boundary upload diverifikasi pada T10.

Multipart admin: file wajib, folder opsional sesuai allowlist server, `assetKind` opsional `photo|logo|document`. Default image→photo/nonimage→document menjaga caller lama; alumni hanya photo/folder dipaksa alumni, tidak menerima pemilihan folder/logo/document. Server memeriksa tipe file aktual dan allowlist; SVG/animasi tidak masuk jalur raster baru, ditolak415 bila belum ada jalur aman yang terpisah. Jangan fallback menyimpan image korup sebagai raw original.

Input limit existing5MiB tetap, decode raster maksimal40 juta pixel; rotate EXIF, buang metadata EXIF, resize <=1800×1800 tanpa enlarge. Photo→WebP85, logo eksplisit→WebP lossless dengan alpha. File dokumen yang diizinkan tetap byte asli. MIME output/ekstensi/object Content-Type/Media.size mengikuti **hasil konversi**, Media.filename tetap nama input. Helper `uploadToR2` mengembalikan `{url,mimeType,size,kind}`; semua caller harus diperbarui. Tidak mengubah gambar lama massal atau transform thumbnail on-demand.

Respons admin tetap flat `{url,id,kind}` ditambah `{mimeType,size}`; alumni tetap `{url}` ditambah metadata tersebut. `id` admin tetap nullable bila indexing gagal sesuai perilaku lama; tampilkan kegagalan indexing secara aman, jangan mengaku Media tercatat. Error upload tetap format route existing `{error:string}` dengan pesan aman; 400 file kosong/jenis input,413 ukuran,415 tipe tak didukung,422 decode,503 storage. Tidak memakai envelope pemilu pada upload. Ukuran efektif hosting bisa lebih rendah dari5MiB; uji multipart Vercel pada T10/T12. [Kajian WebP](../image-upload-webp-study.md).

## Pemilih, PIN dan login (pola existing dipertahankan)

| Endpoint | Izin/input utama | Perilaku |
| --- | --- | --- |
| GET `/{periodId}/voters/master-preview` | pemilih | Tahun ajaran, kandidat sumber, additions/projectedCount; bukan auto-include semua siswa |
| GET/POST `/{periodId}/voters` | pemilih; POST tepat `{studentIds:[1..99 UUID unik]}` | Tambah hanya Student terpilih yang sesuai kelas/tahun ajaran; response academicYear/selected/added/alreadyPresent/total existing; batas gabungan99; invalid404 STUDENT_NOT_ELIGIBLE |
| POST `/{periodId}/voters/teachers` | pemilih; `{teacherIds:[1..99 ID unik]}` | Guru dipilih Teacher master melalui pratinjau roster yang ada; Teacher ID string existing <=128 alnum/_/-; kode GURU terpisah |
| PATCH `/{periodId}/voters/{voterId}` | pemilih+student.kelola | syncFromMaster+expectedSnapshot; setelah buka hanya koreksi NISN sebelum memilih, tambah adminPassword/reviewerAccountId/reviewerPassword, dua akun aktif berbeda; cabut PIN/sesi |
| DELETE `/{periodId}/voters/{voterId}` | pemilih + expected existing | Hanya sebelum buka dan belum memilih; hapus hak false tanpa menghapus master |
| POST `/{periodId}/credentials` | pin+pemilih; voterId/enabled/reasonCode/adminPassword | Reauth caller; disable mencabut sesi, tidak mengurangi denominator |
| POST `/{periodId}/pins` | pin+pemilih; targets voterId/pinVersion, mode issue/reset, reasonCode?,adminPassword | 25 maksimal/batch, 5 batch/15menit; **text/html** slip cetak sekali dengan base URL portal siswa/guru lengkap, tidak menyimpan plaintext; check-all dan stale version tetap |

Membership siswa/guru hanya sebelum buka (DRAFT boleh tanggal lama); tiap voter mendapat tepat N participation false. PIN issue/reset tidak membuat hak tambahan. Sesi lengkap tidak bisa direset; reset mencabut PIN/sesi lama tanpa mengubah suara. Masa berlaku hanya periode, bukan login akun internal/portal akademik.

GET `/api/e-voting/{periodId}/session` bootstrap nonce preauth; POST siswa `{nisn,pin}`, guru `{voterType:"TEACHER",code,pin}`. Generic credential error, limiter5/15menit; hasil login menuju dashboard realm, yang sudah lengkap ke layar selesai tanpa sesi baru. Satu sesi/voter, maksimum tiga sesi global, idle5menit/absolut15 atau deadline. T04 menegakkan batas global dengan advisory lock login; perangkat keempat mendapat409 SESSION_CAPACITY, sedangkan reautentikasi pemilih yang sama mengganti sesi lamanya. Logout existing `/api/e-voting/logout`; POST activity periode hanya aksi eksplisit, bukan polling. Tidak membuat self-register/password/reset siswa.

## Dashboard, status, suara dan partisipasi dinamis

GET `/api/siswa/dashboard` dan `/api/pemilih/dashboard` tetap `{data,csrfToken}` dengan csrfToken di root. data mempertahankan scope,period,participation,complete,nextOrganization,services; menambahkan `contests` metadata snapshot. period tetap punya id/name/slug/**opensAt**/closesAt. Kartu Coming Soon tanpa href/action; layanan pribadi tidak tersedia untuk sesi PIN.

GET `/api/e-voting/{periodId}/status` tetap `{data:{phase:"OPEN",participation,complete,nextOrganization,idleExpiresAt,absoluteExpiresAt}}`, ditambah contests. participation dictionary key harus tepat contest periode, nextOrganization pertama false menurut sortOrder; null hanya lengkap. Hak hilang/ekstra409 RECONCILIATION_FAILED. Hasil/angka tetap bukan sumber grant.

POST `/api/e-voting/{periodId}/votes {organization,candidateId}`201 `{data:{recorded:true,complete,nextOrganization,redirectTo?}}`; vote terakhir menambah redirect realm/selesai dan mencabut sesi atomik. Tanpa calon/ballot ID di respons. Vote boleh ke jenis pending mana pun; urutan UI bukan kontrol keamanan. Tidak menambah API daftar kandidat: SSR route pilih memakai sesi dan contest periode.

GET `/{periodId}/participation` izin partisipasi: `{data:{period,eligible,notStarted,partial,complete,contests,byOrganization}}`. **byOrganization tetap array** `{organization,eligible,voted,pending}`, bukan dictionary baru. N dari contest; complete=k=N, partial=0<k<N, belum=k0. N1 partial0.

GET `/{periodId}/participation/voters` partisipasi+pemilih: `{data:{data:[{voterType,loginCode,nisn,name,className,participation}],nextCursor,contests}}`; cursor existing UUID opaque, limit default50 max100. Kolom dibangun dari contests, bukan hardcode. Status tidak membawa kandidat/waktu pengiriman; tanpa izin pemilih hanya agregat. Tidak ada breakdown tally siswa/guru.

## Penutupan dan hasil

Implementasi T07 diuji melalui middleware, endpoint dan Prisma/SQL terisolasi. Password maksimum256 karakter tetap tidak di-trim; password salah401 `INVALID_REAUTH`, limiter429 `RATE_LIMITED`, malformed JSON400, body>16KiB413, content-type salah415. UI menampilkan ringkasan lengkap/parsial/belum mulai, meminta alasan hanya jika dini, mengonfirmasi berakhirnya hak tersisa, lalu membersihkan password saat batal/gagal.

POST `/{periodId}/close` tutup: `{adminPassword,early?:boolean,reason?:string}`. early defaultfalse; bila early=true **reason trimmed10–500 wajib walau request tiba sesudah deadline**. Jika early=false reason boleh dihilangkan; jika ada tetap divalidasi. Saat now<closesAt perlu early=true; sebelum opensAt409 BEFORE_DEADLINE. Tidak ada EARLY_CLOSE_INCOMPLETE akibat pemilih absen. Roster kosong/hak tidak lengkap/ballot mismatch409 RECONCILIATION_FAILED. Nol ballot sah dengan roster valid.

Setelah lock periode dan waktu DB, audit reasonCode COMMITTEE_EARLY_CLOSE jika masih sebelum deadline, DEADLINE_REACHED jika sudah lewat; simpan reason bila ada, jadwal asli dan closedAt aktual. Jika early=true tiba terlambat tetap close normal dengan reason tersimpan. Rekonsiliasi+snapshotv2+CLOSED+revoke sesi+audit commit bersama. Retry CLOSED/ARCHIVED setelah seluruh pemeriksaan auth/CSRF/reauth memberi200 `{data:{state,closedAt}}` tanpa menghitung/mengubah snapshot atau audit lagi. Password tidak masuk audit. Tidak auto-publish/reopen.

GET `/{periodId}/results` hasil: **diterapkan T11**200 `{data:ResultSnapshot}` sesudah CLOSED/ARCHIVED; sebelumnya409 RESULTS_NOT_AVAILABLE tanpa query tally. POST `/{periodId}/publish {adminPassword}` publikasi: CLOSED saja,200 `{data:{publishedAt}}`, idempoten bila terbit; tidak ada unpublish. Hasil publik GET `/api/e-voting/{periodId}/results` tetap `{data:{period:{slug,name,academicYear,closedAt,publishedAt},result}}` dan halaman `/e-voting/{slug}/hasil`; harus CLOSED/ARCHIVED+publishedAt, selain itu404. Tidak ada raw ballot export/PII pemilih/hasil kandidat sebelum gate, termasuk superadmin.

T08 memakai layanan snapshot yang sama untuk HTML hasil dan API publik. Hasil CLOSED/ARCHIVED yang belum dipublikasikan tetap404, snapshot rusak/storage gagal503 aman. Read publik tidak menghitung Ballot atau membaca master Student/Teacher/jenis. Middleware menolak segmen ID tidak valid dengan403 sebelum handler; UUID sah yang tidak ditemukan404. Respons HTML dan JSON pemilihan tetap private, no-store. T08 menyelesaikan penyajian publik; endpoint internal diselesaikan T11, dengan izin lihat+hasil terkini dan state+snapshot dibaca atomik dalam satu statement. Snapshot rusak/storage gagal503 aman; tanpa query Ballot/master.

Snapshot v2 berisi metadata jenis dan foto/nama/kelas snapshot calon, tanpa studentId; query riwayat calon internal tetap melalui CandidateMember.studentId. Denominator infografis: lengkap/eligible untuk orang selesai, votesCast/eligible untuk perjenis, suara kandidat/votesCast dengan nol-safe. Label Perolehan tertinggi bukan keputusan pemenang; seri/nol eksplisit.

T09: GET `/api/admin/e-voting/periods` menambahkan metadata nullable `publishedAt` pada setiap baris; field lainnya dipertahankan. Tidak mengambil resultSnapshot atau tally. Daftar/detail memakai metadata status+publishedAt untuk CTA publik, bukan endpoint hasil internal. POST publish existing tetap memerlukan izin terkini/Origin/CSRF/password; UI hanya menawarkannya pada CLOSED belum terbit. Regresi API membuktikan izin dicabut ditolak, password salah tidak menerbitkan hasil dan publikasi ulang tidak menggandakan audit. T11 menyelaraskan INVALID_REAUTH401 dan RATE_LIMITED429. Body rusak/unknown400, oversized413 dan content-type tidak didukung415, sebelum reauth atau mutasi. UI tetap memakai error.code dan sudah diuji ulang dengan401/429.

## Cleanup dan kompatibilitas

GET/POST `/{periodId}/test-cleanup` existing tetap superadmin+lihat+kelola+hapus-uji, password dan previewVersion/confirmation; hanya isTest belum terbit. [Kontrak historis yang tetap berlaku](08-pembersihan-data-uji.md). Izin pengguna menghapus sampel untuk migrasi dilaksanakan terpisah oleh migrator offline dengan manifest; tidak memperluas endpoint ini.

Tidak mengandalkan client lama mengenal enum baru. Rilis schema/runtime/form/validator sebagai paket pada maintenance. Snapshot parser v2-only hanya jika inventaris memastikan seluruh v1 sampel sudah bersih; data lain menghentikan cleanup. Endpoint yang menambah field harus memperbarui semua caller/fixture T04–T11. [Operasional](07-operasional.md).
