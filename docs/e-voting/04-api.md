# Kontrak API dan mutasi form

Status: kontrak pemilu dengan tambahan pemilih guru yang disetujui 16 Oktober 2026. Semua handler dinamis (`prerender = false`). Base pemilu bersama `/api/e-voting`, dashboard siswa `/api/siswa/dashboard`, dashboard guru `/api/pemilih/dashboard`, panitia `/api/admin/e-voting`, master siswa `/api/admin/students`. `[periodId]` adalah UUID, bukan slug. Organisasi hanya `OSIS`, `DEWAN_AMBALAN`, `IPNU`, `IPPNU`. Bagian rencana yang belum tersedia tetap memerlukan verifikasi terhadap handler aktual.

## Tambahan kontrak guru

- POST sesi siswa tetap tepat `{nisn,pin}`. Guru memakai endpoint yang sama dengan tepat `{voterType:"TEACHER",code,pin}`; kode `GURU-` + 12 digit heksadesimal dinormalisasi ke huruf besar. Tidak menerima teacherId, accountId atau NISN buatan. Respons guru menuju `/pemilih` atau `/pemilih/selesai`, tanpa identitas. Limiter lima percobaan/15 menit memakai namespace teacher-login terpisah dari student-login.
- GET `/api/pemilih/dashboard` hanya menerima sesi guru aktif. Struktur sama dengan dashboard siswa, href E-Voting memakai `/pemilih/e-voting/<slug>/pilih`; tidak memuat kartu personal/akademik. Sesi guru ditolak pada API siswa dan sebaliknya. Status/activity/votes/logout bersama tetap memeriksa periode, scope, CSRF dan masa sesi. Suara keempat guru mengembalikan redirect `/pemilih/selesai`.
- POST `/api/admin/e-voting/[periodId]/voters/teachers` menerima tepat `{teacherIds:[...]}`: 1–99 ID master unik, setiap ID string 1–128 karakter alfanumerik, underscore atau minus. Izin `evoting.lihat` + `evoting.pemilih`; origin dan CSRF wajib. Sukses `200 {data:{added,alreadyPresent,total}}`. Tidak perlu izin pengelolaan master untuk memilihnya. Tidak menerima nama bebas atau otomatis seluruh staf. Server membaca master ulang, mengunci periode, memeriksa waktu DB dan total gabungan maksimal 99, lalu membuat roster, empat eligibility dan audit atomik. Duplikat yang sudah ada tidak ditambahkan ulang. `400 INVALID_INPUT`, `404 TEACHER_NOT_FOUND`/`NOT_FOUND`, `409 ROSTER_LIMIT`/`INVALID_STATE`; kegagalan DB/audit membatalkan transaksi dan memberi 503.
- GET roster menambahkan `teacherId`, `voterType`, `loginCode`; `nisn` nullable. Detail partisipasi menambahkan voterType/loginCode, dengan izin partisipasi + pemilih. Tetap tanpa hash/PIN/pilihan kandidat. Untuk DELETE guru, body tepat `{expectedSnapshot:{loginCode,name,className:"Guru"}}`; siswa tetap memakai snapshot NISN/nama/kelas. PATCH sinkronisasi/koreksi NISN hanya siswa. Identitas pemilik dan kode guru tidak dapat diganti.
- PIN issue/reset/print memakai target voterId yang sama untuk kedua jenis. Slip guru memuat kode dan URL lengkap Portal Pemilih. Kesiapan, batas 99, partisipasi, close dan denominator hasil menghitung gabungan. Snapshot hasil tidak menambahkan voterType atau breakdown kelompok.

Rincian: [pemilih guru](09-usulan-pemilih-guru.md). Kontrak siswa berikut tetap berlaku khusus siswa; endpoint bersama berlaku bagi kedua jenis melalui sesi yang sudah diverifikasi.

## Aturan bersama

Persiapan mengikuti [aturan DRAFT dan pilihan siswa](10-daftar-pemilih-dan-draft.md): DRAFT tetap dapat dikelola meski tanggal lama lewat; SCHEDULED terkunci saat opensAt. Penyimpanan jadwal baru/schedule tetap mewajibkan opensAt di masa depan. Penambahan siswa tidak lagi menerima body kosong untuk seluruh master.

- JSON success `{ "data": ... }`; JSON error `{ "error": { "code": "...", "message": "pesan aman" } }`. Tidak ada stack trace, raw Prisma error, NISN, PIN atau kandidat pilihan dalam error.
- POST JSON wajib `Content-Type: application/json` dan `X-CSRF-Token`. Form URL-encoded memakai `_csrf`; parsing hanya field kontrak, tolak key tak dikenal. Tidak ada mutasi GET atau method override.
- Maksimal body normal 16 KiB; impor 64 KiB. Terapkan sebelum membaca body penuh pada adapter/handler yang diuji, jangan hanya percaya `Content-Length`. Print request maksimal 25 target. Pagination cursor opaque, page size maksimum 100.
- Cookie dan CSRF seperti [desain](02-desain.md). Semua response, termasuk 4xx/5xx, `private, no-store`, no-referrer. Tidak ada response kandidat pilihan setelah submit atau ID ballot sebagai receipt.
- `400 INVALID_INPUT`, `401 UNAUTHENTICATED` (login: `INVALID_CREDENTIALS` generik), `403 FORBIDDEN`/`CSRF_INVALID`, `404 NOT_FOUND`, `405 METHOD_NOT_ALLOWED` + Allow, `409` konflik domain, `413 BODY_TOO_LARGE`, `415 UNSUPPORTED_MEDIA_TYPE`, `429 RATE_LIMITED` + Retry-After, `503 TEMPORARILY_UNAVAILABLE`.
- Hanya detail periode/candidate yang sudah diizinkan yang diekspos; ownership di server, bukan dari request body. Route/action tak dikenal ditolak. Auth API tidak redirect ke HTML login.
- Form Astro memanggil service yang sama; sukses mutasi biasa menggunakan 303 redirect. Print adalah pengecualian: POST langsung membalas HTML sensitif satu kali. Tidak perlu internal HTTP fetch dari server ke API sendiri.

## Siswa

Allowlist sesi `ELECTION_VOTING` hanya mencakup dashboard dan endpoint pemilu di bawah (kecuali hasil terbit yang publik). Guard memeriksa scope, periode, credentialEnabled, idle/absolute expiry dan jendela waktu pada semua request terlindungi. Sesi yang hilang/expired mendapat 401; sesi yang masih terverifikasi tetapi periodenya tak lagi valid ditolak 409 `ELECTION_NOT_OPEN` serta dicabut. Halaman mengarahkan ke login netral; tidak membuka data akademik lewat cookie yang kebetulan ada. Login menerima periode eksplisit; tidak fallback ke PIN periode lain atau password Account. Tidak ada API student registration, password create/reset, ubah PIN atau master Student untuk siswa.

| Method/path | Input | Gate | Success dan konflik |
| --- | --- | --- | --- |
| GET `/api/e-voting/[periodId]/session` | Tidak ada | Public; terbatas limiter | `200 {csrfToken, phase}`; buat preauth nonce cookie. Tidak mengembalikan data siswa |
| POST `/api/e-voting/[periodId]/session` | `{nisn, pin}` | CSRF preauth, lima percobaan per NISN/periode dalam 15 menit, periode sedang buka, hash valid dalam roster periode | `200 {complete:false, redirectTo:"/siswa",csrfToken}` + cookie sesi ELECTION_VOTING; bila lengkap `200 {complete:true, redirectTo:"/siswa/selesai"}` + clear cookie, tanpa sesi baru. `409 ELECTION_NOT_OPEN`, `401 INVALID_CREDENTIALS`, `429 RATE_LIMITED` |
| GET `/api/siswa/dashboard` | Tidak ada | Sesi ELECTION_VOTING aktif, periode valid diturunkan dari sesi | `200 {data:{scope,period,participation,complete,nextOrganization,services},csrfToken}`; dashboard ringkas tanpa master/profile/NISN/PIN/nilai; tidak memperpanjang idle |
| POST `/api/e-voting/logout` | `{}` | Origin sama + CSRF terikat sesi atau nonce preauth yang sah | `204`, revoke sesi di DB dan clear cookie dengan atribut yang sama |
| GET `/api/e-voting/[periodId]/status` | Tidak ada | Sesi aktif periode tersebut | `200` empat boolean dan phase; tidak memperpanjang idle secara otomatis. `401` bila sesi selesai/dicabut/expired |
| POST `/api/e-voting/[periodId]/activity` | `{}` | Sesi aktif, Origin sama, CSRF terikat sesi, maks. 60 request/menit/sesi | `200 {idleExpiresAt, absoluteExpiresAt, csrfToken}`; hanya dipanggil interaksi eksplisit, tidak polling. `429 RATE_LIMITED` |
| POST `/api/e-voting/[periodId]/votes` | `{organization, candidateId}` | Sesi ELECTION_VOTING + CSRF + predicate jadwal dalam transaksi; maks. 60 request/menit/sesi | `201 {organization, recorded:true, complete, nextOrganization}`; jika complete tambahkan `redirectTo:"/siswa/selesai"`, revoke sesi atomik dan clear cookie. `409 ALREADY_VOTED` atau `ELECTION_NOT_OPEN`; `400 INVALID_CANDIDATE` untuk kandidat salah scope; `429 RATE_LIMITED` |
| GET `/api/e-voting/[periodId]/results` | Tidak ada | CLOSED/ARCHIVED dan publishedAt ada | `200` snapshot agregat; sebelum publikasi `404 NOT_FOUND`, tidak pernah early tally |

Halaman `/siswa/e-voting/[slug]/pilih/[organization]` merender daftar kandidat lewat query server dengan sesi, scope organisasi dan eligibility. Login dari deep link tetap menuju `/siswa`, lalu kartu E-Voting melanjutkan organisasi yang belum selesai; `returnTo` bebas tidak diterima. Tidak perlu API candidate list tersendiri untuk versi awal. Urutan UI tetap OSIS → Dewan Ambalan → IPNU → IPPNU, tetapi server boleh menerima organisasi belum selesai mana pun; tidak boleh bergantung pada urutan browser untuk keamanan.

`services` pada dashboard adalah allowlist presentasi: satu `{id:"e-voting",status:"available",href:"/siswa/e-voting/<slug>/pilih"}` untuk periode sesi, dan kartu masa depan `{id,label,status:"coming_soon"}` tanpa href/action/endpoint. Kartu tidak meminta data personal. Adanya entri kartu bukan grant server. Route layanan masa depan belum dibuat (404); uji guard memastikan sesi pemilu mendapat 403 ketika diminta scope layanan personal/akademik lain. Hasil terbit tetap publik melalui `/e-voting/[slug]/hasil`, di luar sesi dan jadwal pemungutan.

Contoh status (tanpa NISN, nama calon pilihan atau waktu pengiriman):

```json
{
  "data": {
    "phase": "OPEN",
    "participation": {
      "OSIS": true,
      "DEWAN_AMBALAN": false,
      "IPNU": false,
      "IPPNU": false
    },
    "complete": false,
    "nextOrganization": "DEWAN_AMBALAN",
    "idleExpiresAt": "2026-10-20T01:05:00.000Z",
    "absoluteExpiresAt": "2026-10-20T01:15:00.000Z"
  }
}
```

Tanggal contoh bukan jadwal sekolah yang ditetapkan. `nextOrganization` null jika lengkap. POST vote yang timeout: UI menyatakan “status pengiriman belum diketahui”, revalidasi status; jika `401`, login ulang. Jangan menyatakan gagal sebelum mengecek kemungkinan commit. Submit duplikat selalu `409 ALREADY_VOTED`, tidak menyatakan kandidat yang dipilih pada request duplikat adalah kandidat tersimpan. Suara keempat mencabut sesi, sehingga response hilang diselesaikan lewat login ulang dan pesan selesai generik.

## Panitia: daftar dan konfigurasi

Master siswa terpisah dari periode: `GET /api/admin/students` (cursor/limit, ringkasan id/NISN/nama/kelas), `POST /api/admin/students` (`{nisn,name,className}`, 201), dan `PATCH /api/admin/students/[studentId]` (field tersebut + expected old values, 200). Semua memerlukan akun internal aktif + `student.kelola`, CSRF untuk mutasi, validasi NISN/string, audit dan conflict 409 pada NISN duplikat/stale. Tidak ada hard-delete master dalam MVP. Mutasi master tidak membuat PIN/Account/hak pilih, tidak mengubah snapshot ElectionVoter, dan tidak membutuhkan periode aktif. Endpoint ini menolak sesi pemilu tanpa memandang studentId target.

Semua route berikut butuh akun aktif, `evoting.lihat`, dan kapabilitas tambahan dalam tabel. Data viewer hanya mendapat field non-PII, bukan `include` seluruh relasi. Kapabilitas hasil tetap tunduk pada gate state, termasuk superadmin.

| Method/path (sesudah base panitia) | Input | Izin tambahan | Output/ketentuan |
| --- | --- | --- | --- |
| GET `/periods` | cursor, limit | — | `200` daftar periode tanpa snapshot/roster |
| POST `/periods` | name ≤120, slug ≤64, academicYear ≤20, opensAt, closesAt, isTest? boolean (default false) | kelola | `201` DRAFT dengan empat contest otomatis; slug duplikat `409`; klasifikasi uji tidak dapat diedit |
| GET `/[periodId]` | — | — | `200` konfigurasi, phase dan kandidat dengan snapshot anggota; tidak ada PIN/roster/tally |
| PATCH `/[periodId]` | name, academicYear, opensAt, closesAt, expected configuration values | kelola | DRAFT atau sebelum opensAt; setelah dibuka hanya extension satu kali; optimistic conditional update; `409 STALE_CONFIG`/`INVALID_STATE` |
| GET `/[periodId]/students/search` | `q` (nama/NISN/kelas), `limit` ≤20 | pemilih | `200` pilihan master `{studentId,name,nisn,className}`; tanpa PIN/kredensial. Header `X-CSRF-Token` memberi token mutasi singkat untuk akun aktif |
| POST `/[periodId]/candidates` | `{organization,ballotNumber,chair:{studentId,photoUrl?},viceChair?:null atau {studentId,photoUrl?},vision,mission}` | kelola + pemilih | `201`; DRAFT atau sebelum opensAt. Server mengambil snapshot dari Student; studentId berbeda dan belum ditugaskan di organisasi/periode, nomor ballot unik. `400 INVALID_STUDENT`/`409 DUPLICATE_CANDIDATE` |
| PATCH `/[periodId]/candidates/[candidateId]` | payload pair di atas + `expected:{ballotNumber,chairStudentId,viceChairStudentId,vision,mission}` | kelola + pemilih | `200`; DRAFT atau sebelum opensAt, perubahan satu/dua anggota atomik; audit satu transaksi; menolak ID tidak valid/duplikat/stale |
| DELETE `/[periodId]/candidates/[candidateId]` | expected old values | kelola | `204`; DRAFT atau SCHEDULED sebelum opensAt, jika masih ada calon valid lain untuk organisasi dan tanpa ballot; audit tetap wajib |
| POST `/[periodId]/schedule` | `{}` | kelola | `200 SCHEDULED`; roster resmi, empat contest/roster/PIN lengkap. Roster dapat diedit sebelum buka lalu dibekukan atomik saat dibuka. `409 NOT_READY`/`ANOTHER_SCHEDULED_PERIOD` |
| POST `/[periodId]/extend` | `{reasonCode,adminPassword}` | `evoting.perpanjang` | Satu kali maksimal 60 menit sebelum close; ketua pemilu terpilih harus berbeda dari pengelola PIN menurut prosedur. Aplikasi mencatat aktor/alasan, tetapi tidak mengesahkan pemisahan dua peran. `409 EXTENSION_UNAVAILABLE` setelah dipakai atau periode ditutup |
| POST `/[periodId]/archive` | `{}` | kelola | `200 ARCHIVED`; hanya CLOSED, snapshot tetap sama |

Singkatan izin pada tabel berarti `evoting.<nama>`. Pencarian Student memakai izin baca master terbatas `evoting.pemilih`; kombinasi izin ini dengan `evoting.kelola` diperlukan untuk CRUD calon karena anggota mengandung PII. Tidak ada DELETE periode. Slug tidak diubah setelah create agar tautan/kertas tidak rusak. Konflik optimistic memakai field allowlist yang dibandingkan di dalam lock, bukan timestamp pada ballot.

`viceChair` boleh dihilangkan atau null untuk calon tanpa wakil. Objek wakil kosong/ID tidak valid tetap ditolak. `expected.viceChairStudentId` wajib null jika sebelumnya tanpa wakil, atau UUID anggota sebelumnya; perubahan susunan tetap memakai stale guard. Server mengabaikan nama/kelas dari request karena field itu tidak diterima, lalu menyalin snapshot dari Student terpilih. Jumlah pasangan dinamis tanpa batas tetap selain minimal satu calon valid (ketua wajib, wakil opsional) per organisasi saat pembukaan. Create/edit/delete dicatat di `VotingAuditEvent` bersama mutasi; perubahan candidate ditolak setelah `opensAt`, termasuk race dengan transaksi pembukaan. Foto per anggota opsional dan memakai aset media sekolah yang valid/diizinkan.

## Panitia: pemilih dan kredensial

| Method/path | Input | Izin tambahan | Output/ketentuan |
| --- | --- | --- | --- |
| GET `/[periodId]/voters` | cursor, limit, className? | pemilih | `200` roster terbatas: id, NISN, name, className, credentialEnabled, pinIssued boolean, pinVersion; tidak ada pinHash |
| GET `/[periodId]/voters/master-preview` | — | pemilih | `200 {data:{academicYear,eligibleCount,currentCount,alreadyPresent,additions,projectedCount,canSync,students:[{id,nisn,name,className,alreadyPresent}]}}`; ringkasan sumber tahun ajaran, proyeksi jika seluruh sumber dipilih; DRAFT atau SCHEDULED sebelum buka |
| POST `/[periodId]/voters` | Tepat `{studentIds:[...]}`, 1–99 UUID unik | pemilih | `200 {data:{academicYear,selected,added,alreadyPresent,total}}`; hanya siswa terpilih yang memenuhi tahun ajaran, tambahan atomik tanpa mengganti existing, batas gabungan 99; DRAFT atau SCHEDULED sebelum buka. Body `{}` ditolak 400, ID tidak ada/tahun ajaran berbeda 404 STUDENT_NOT_ELIGIBLE |
| PATCH `/[periodId]/voters/[voterId]` | Sebelum buka: `{syncFromMaster:true,expectedSnapshot}`. Saat berlangsung: `{syncFromMaster:true,expectedSnapshot,adminPassword,reviewerAccountId,reviewerPassword}` | pemilih + student.kelola; pemeriksa kedua juga harus punya kedua kapabilitas | Sebelum buka, sinkronkan snapshot dari master. Saat berlangsung, hanya NISN yang boleh berubah, Student ID tetap, nama/kelas harus tetap cocok, pemilih belum memilih, dua akun aktif berbeda autentikasi ulang; cabut PIN/sesi dan wajib issue PIN baru. Tidak setelah pemilih memilih |
| DELETE `/[periodId]/voters/[voterId]` | expected old values | pemilih | `204`, sebelum buka, belum ada partisipasi true; hapus participation false |
| POST `/[periodId]/credentials` | `{voterId,enabled,reasonCode,adminPassword}` | pin + pemilih | `200`, autentikasi ulang; revoke sesi saat disable. Tidak menghapus status atau mengubah denominator |
| POST `/[periodId]/pins` | `{targets:[{voterId,pinVersion}], mode:"issue" atau "reset", reasonCode?, adminPassword}` | pin + pemilih | `200 text/html` slip cetak sekali, bukan JSON; CSRF, auth ulang, limit 25 dan 5 batch/15 menit/akun. Issue sebelum buka, atau untuk roster yang ditandai koreksi NISN selama periode berlangsung; reset sampai tutup untuk pemilih belum lengkap. `409 STALE_CREDENTIALS`/`COMPLETED_VOTER`, `429 RATE_LIMITED` |

`credentials` menerima `adminPassword` juga untuk reautentikasi, tidak pernah mencatatnya. Autentikasi ulang dicocokkan dengan **akun session**, bukan identifier dari body; limiter admin berlaku. PIN hanya dibuat untuk DRAFT/SCHEDULED sebelum deadline; siswa yang lengkap tidak di-reset. Pemberian `evoting.pin` untuk anggota panitia diasumsikan juga diberikan `evoting.pemilih` agar dapat memilih target; handler tetap mengecek keduanya untuk print/credential endpoints yang menyingkap roster.

Tidak ada endpoint impor TSV roster. Pengunggahan spreadsheet siswa hanya dilakukan pada menu master siswa; untuk periode pemilihan, roster dibentuk dari master berdasarkan tahun ajaran.

Data saksi dua orang untuk penerbitan PIN, penutupan dan publikasi merupakan catatan prosedural yang diverifikasi panitia di luar aplikasi. Aplikasi mengaudit aktor yang login, tetapi tidak membuktikan saksi hadir atau mencegah superadmin menjalankan aksi sendirian.

## Panitia: partisipasi dan hasil

| Method/path | Input | Izin tambahan | Output/ketentuan |
| --- | --- | --- | --- |
| GET `/[periodId]/participation` | — | partisipasi | `200 {eligible,notStarted,partial,complete,byOrganization}` dari ledger; tanpa kandidat |
| GET `/[periodId]/participation/voters` | cursor/limit | partisipasi + pemilih | `200` daftar status empat organisasi per siswa, tanpa waktu suara/pilihan; hanya untuk pendampingan |
| POST `/[periodId]/close` | `{adminPassword, early?: boolean}` | tutup | `200 {state,closedAt}`; early default false. Setelah deadline atau lebih awal dengan seluruh pemilih selesai empat suara; transaksi lock/reconciliation/snapshot. Respons hanya state/waktu, tanpa tally |
| GET `/[periodId]/results` | — | hasil | `200` snapshot setelah CLOSED/ARCHIVED; sebelumnya `409 RESULTS_NOT_AVAILABLE`, tanpa melakukan query tally |
| POST `/[periodId]/publish` | `{adminPassword}` | publikasi | `200 {publishedAt}`; CLOSED saja, idempotent setelah sudah terbit; tidak ada unpublish atau edit hasil versi awal |

Tidak ada export ballot mentah, endpoint kandidat dengan field votes sebelum tutup, maupun drilldown pilihan siswa. Ekspor hasil awal cukup melalui halaman cetak agregat setelah gate yang sama; tidak perlu endpoint CSV tambahan. Operasi close yang diulang pada CLOSED mengembalikan state tersimpan, bukan menghitung atau mengganti hasil. Selisih ledger/ballot menghasilkan `409 RECONCILIATION_FAILED`; detail sensitif tidak masuk respons/log publik.

Sebelum deadline tanpa `early: true`, atau periode belum dibuka: `409 BEFORE_DEADLINE`. Opt-in lebih awal dengan roster kosong/ada pemilih belum selesai: `409 EARLY_CLOSE_INCOMPLETE`; pemeriksaan mendahului query tally kandidat. PIN nonaktif tetap dihitung. Password akun caller, limiter, izin `evoting.tutup`, Origin dan CSRF tetap wajib. Unknown field/nonboolean `early` ditolak `400 INVALID_INPUT`. Form early yang tiba sesudah deadline mengikuti penutupan normal. `closesAt` tetap, audit menyimpan alasan dan waktu aktual; publikasi terpisah.

## API pembersihan sampel ? implementasi 15 Oktober 2026

GET dan POST /api/admin/e-voting/[periodId]/test-cleanup hanya untuk superadmin aktif dengan evoting.lihat, evoting.kelola, evoting.hapus-uji yang tidak dicabut. GET memberi jumlah data, versi preview dan CSRF; POST menerima tepat {confirmation,previewVersion,adminPassword} dan sukses 204. Reautentikasi dan rate limit wajib; nama/slug serta versi diverifikasi ulang di server. Periode biasa atau hasil terpublikasi mendapat 409. [Kontrak lengkap dan kode error](08-pembersihan-data-uji.md).
