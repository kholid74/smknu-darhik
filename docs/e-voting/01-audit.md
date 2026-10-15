# Audit repository lokal

Tanggal: 10 Oktober 2026. Dasar: commit `8a35abf`, working tree awal hanya memiliki `repo_audit.md` yang belum dilacak. Kategori: **terbukti** berarti terlihat di source; **risiko** merupakan implikasi desain; **belum diverifikasi** memerlukan runtime atau akses operasional.

Catatan pembaruan desain: [keputusan autentikasi final](adr/0002-autentikasi-portal-siswa-mvp.md) menambahkan proposal master Student persisten dan dashboard Portal Siswa dengan PIN khusus periode. Keduanya belum ada di aplikasi; temuan audit source di bawah tetap merupakan fakta awal, bukan klaim fitur sudah diimplementasikan.

## Runtime dan deployment

| Area | Bukti | Temuan dan implikasi |
| --- | --- | --- |
| Versi | [package.json](../../package.json), [package-lock.json](../../package-lock.json) | Astro rentang `^7.1.3`, terkunci `7.1.3`; Prisma/client `7.9.0`; Tailwind `4.3.3`; Node minimum `22.12.0`. Node shell audit `24.21.0`, bukan bukti versi produksi |
| Rendering | [astro.config.mjs](../../astro.config.mjs), `src/pages/**` | `output: 'static'`, tetapi mayoritas route secara eksplisit `prerender = false`, termasuk homepage, admin, berita dan alumni. `profil`, `struktur`, `kontak`, `ppdb` tidak menyatakan opt-out. Jangan menganggap seluruh website statis |
| Adapter | Konfigurasi dan lockfile | `@astrojs/vercel` `11.0.3` benar-benar dikonfigurasi. Adapter Node `11.0.2` terpasang sebagai dependency tetapi tidak aktif. Tidak ditemukan konfigurasi CI/deploy khusus yang dilacak |
| Deployment aktual | Belum diakses | Region, domain resmi, limit function/connections, cron, firewall, log retention, backup/PITR, deployment protection, dan database grants belum diketahui |
| Origin | `astro.config.mjs` | `security: { checkOrigin: false }`; kode middleware tidak menggantinya dengan validasi CSRF. Wajib tangani sebelum mutasi pemilu |
| Environment | [src/lib/env.ts](../../src/lib/env.ts) | Membaca `process.env` lalu mapping statis `import.meta.env`. Secret baru perlu dimasukkan pada mapping ini dan dipakai server saja; jangan memakai awalan `PUBLIC_` untuk secret |

Route baru dinamis harus menggunakan `prerender = false` pada konfigurasi ini; tidak perlu mengganti mode seluruh website. Ini sesuai [panduan routing Astro](https://docs.astro.build/en/guides/routing/). Default proteksi bawaan dan cakupan pemeriksaan tetap perlu dicocokkan dengan versi terkunci; lihat [konfigurasi keamanan Astro](https://docs.astro.build/en/reference/configuration-reference/#securitycheckorigin).

## Routes, komponen, style

Ada 93 file di `src/pages` pada snapshot audit. Halaman publik berada di root, berita detail di `berita/[slug].astro`, admin di `/admin`, API di `/api`, alumni di `/alumni` dan kartu publik di `/verify/[token]`.

- [BaseLayout](../../src/layouts/BaseLayout.astro) mengimpor header/footer/menu/pengumuman/WhatsApp dan `global.css`; banyak bagian tidak diperlukan di bilik suara.
- [AdminLayout](../../src/layouts/AdminLayout.astro) menyediakan sidebar kelompok, tabel/card/button, flash, modal hapus, drawer dan filter menu menggunakan `can(locals.principal, cap)`. Style admin berupa CSS global di layout; jangan mengasumsikan utility Tailwind public otomatis masuk.
- [global.css](../../src/styles/global.css) menggunakan Tailwind v4 melalui Vite, warna hijau/emas, focus-visible, reduced-motion. Reuse token dan pola aksesibilitas untuk layout siswa minimal.
- `.astro` adalah komponen utama; tidak ada integrasi React/Vue/Svelte yang dikonfigurasi. `TiptapEditor`, `MediaPicker`, `UploadWidget`, `FileUpload`, `ChartCard`, `SortTh` sudah ada. Chart tidak diperlukan untuk partisipasi awal; tabel/ringkasan cukup.
- Form admin umumnya diproses dengan `Astro.request.formData()` di frontmatter lalu redirect. `[id].astro` memakai `new` sebagai sentinel create. API JSON memakai `APIRoute` (`api/media.ts`); ada juga endpoint `.astro`.
- `src/data/site.ts` menyediakan data branding/navigation; belum ada content collection atau i18n yang perlu diperluas.

Gunakan komponen Astro dan script kecil sesuai [panduan komponen](https://docs.astro.build/en/basics/astro-components/); style layout baru mengikuti [panduan styling](https://docs.astro.build/en/guides/styling/).

## Prisma dan migrasi

| Area | Fakta source | Implikasi |
| --- | --- | --- |
| Schema | [prisma/schema.prisma](../../prisma/schema.prisma): provider PostgreSQL, generator `prisma-client-js` | Tidak ada Student, NISN, Election, Candidate, Ballot, atau ledger partisipasi |
| Client runtime | [src/lib/prisma.ts](../../src/lib/prisma.ts) | `PrismaNeon` dengan `DATABASE_URL`, singleton dev; client dan import di-cast `any`. Tidak ada bukti adapter SQLite dipakai aplikasi aktif |
| CLI | [prisma.config.ts](../../prisma.config.ts) | URL dari environment dengan fallback PostgreSQL localhost. Migrasi di `prisma/migrations`; seed aktif `tsx prisma/seed-pg.ts` |
| Riwayat | 19 direktori migration SQL; [migration_lock.toml](../../prisma/migrations/migration_lock.toml) | PostgreSQL sejak initial migration; migrasi RBAC memindahkan Admin ke Account, kemudian menghapus Admin. Tidak boleh rewrite migrasi lama |
| Seed | [seed-pg.ts](../../prisma/seed-pg.ts) | Adapter `PrismaPg`, bootstrap akun/dataset demo, kredensial contoh dapat diketahui dari source. Bukan workflow provisioning produksi |
| Artefak lama | [seed.ts](../../prisma/seed.ts) | Masih menggunakan libsql `dev.db` dan tabel Admin lama. Jangan dipakai sebagai acuan atau dijalankan untuk e-voting |
| Workflow | package scripts | `postinstall` menjalankan generate; build hanya `astro build`, bukan migrate deploy. Tidak ada job migration/backup yang ditemukan |

Tidak dilakukan introspection atau pembacaan `_prisma_migrations` database. Konsistensi schema-versus-database, hak akses runtime, timezone server, kemampuan transaksi Neon dan restore **belum terbukti**.

## Autentikasi dan otorisasi

- [auth.ts](../../src/lib/auth.ts): password bcrypt cost 10, JWT HS256 berlaku 24 jam, cookie `smkdh_token`; `JWT_SECRET` wajib. Akun aktif diperiksa saat login dan saat mengambil principal.
- [rbac.ts](../../src/lib/rbac.ts): empat role `superadmin`, `staf`, `guru`, `siswa`; multi-role + grant/revoke per akun; revoke mengalahkan grant/wildcard. `superadmin` memiliki `*`. Role siswa internal belum berarti basis data siswa atau hak pilih.
- [middleware.ts](../../src/middleware.ts): membaca principal terbaru dari DB untuk `/admin` dan API yang dipetakan. Segment admin yang belum ada di `ROUTE_CAP` hanya memerlukan login; `API_CAP` hanya mencakup `/api/upload`, `/api/media`. Route e-voting baru harus diproteksi eksplisit, termasuk semua method/subpath.
- [pengguna/[id].astro](../../src/pages/admin/pengguna/[id].astro): UI role dan override sudah tersedia; capability menerima string bebas. Dapat memberi izin panitia melalui override tanpa role baru. Beberapa halaman lama masih memakai role dari JWT; modul baru harus memakai principal DB.
- [admin/login.astro](../../src/pages/admin/login.astro): cookie tidak mengatur `secure`, tidak terlihat rate limiting atau token CSRF. Logout lama memakai route GET. Akun panitia akan mewarisi risiko ini jika tidak diperbaiki.
- [alumni-auth.ts](../../src/lib/alumni-auth.ts): realm terpisah, magic-link acak 32 byte di-hash SHA-256, konsumsi token dengan update bersyarat, cookie `smkdh_alumni`, JWT 30 hari memakai secret yang sama. Cooldown email per alumni tidak menggantikan limiter login lintas instance dan tidak cocok untuk Chromebook.
- `verifyToken` internal tidak memeriksa `kind`/audience; karena secret juga dipakai alumni, isolasi realm sebagian bergantung pada lookup Account. Belum terbukti ada jalur eskalasi; tambahkan tes lintas realm dan kontrak issuer/audience sebelum memperluas autentikasi.

## Testing dan utilitas

Tiga file test: [rbac.test.ts](../../src/lib/rbac.test.ts), [alumni-token.test.ts](../../src/lib/alumni-token.test.ts), [qr.test.ts](../../src/lib/qr.test.ts). Pola `node:test` + `node:assert/strict`; script `npm test` memanggil `npx tsx --test`. `tsx` tidak dideklarasikan langsung dan tidak ditemukan entry top-level lockfile; reproducibility runner perlu diperbaiki saat implementasi. Tidak ditemukan suite integrasi database, HTTP, browser, load test, atau CI yang dilacak.

Reusable: bcrypt, `node:crypto`, `jose`, principal/can, `env`, `db`, pola status token, brand assets, komponen Astro. `hashToken` alumni merupakan preseden token acak, bukan PIN pendek; SHA-256 saja tidak cukup untuk PIN. `qr.ts` tidak dibutuhkan: PIN dicetak sebagai teks. Upload R2 dan `/api/image` bersifat publik; **jangan menyimpan roster, PIN, atau hasil privat di sana**.

## Risiko sebelum produksi

| Prioritas | Temuan/risiko | Tindakan yang direncanakan |
| --- | --- | --- |
| Blocker | Belum ada transaksi, uniqueness dan ledger suara | Model additive, constraint, satu service vote atomik dan tes concurrency PostgreSQL |
| Blocker | Origin check off; admin auth belum cukup kuat untuk panitia | Proteksi CSRF/origin pada mutasi pemilu dan jalur akun/role panitia; Secure cookie, limiter admin, tes regresi |
| Blocker | HTML artikel (`berita/[slug].astro`) dan jawaban FAQ (`faq.astro`) memakai `set:html`; sanitizer tidak ditemukan pada penelusuran source | Audit/sanitasi allowlist input lama dan baru; uji stored XSS lintas situs satu origin. HttpOnly tidak mencegah script mengirim vote dari browser korban |
| Blocker | Jadwal, penutupan dan rahasia hasil belum punya gate server | Predicate DB-time, lock penutupan, gate sebelum query agregasi, snapshot hasil |
| Tinggi | Aplikasi publik dan pemilu berbagi origin, proses serverless dan database | Batas beban/pool/timeouts; hardening content/account routes; halaman voting tanpa script pihak ketiga |
| Tinggi | PIN dibagikan panitia dan Chromebook dipakai bersama | Cetak satu kali, reset terkontrol, revokasi sesi, clear UI/cache, prosedur distribusi |
| Tinggi | DBA/WAL/log dapat mengorelasikan surat suara | Catat batas anonimitas, batasi grants/logging/backups; minta penerimaan eksplisit terhadap threat model |
| Tinggi | DB client `any`, seed demo, belum ada integration tests | Scope penggunaan client bertipe di modul; jangan menjalankan seed produksi; verifikasi dari database disposable |
| Belum diketahui | Kapasitas produksi, deployment secrets, PITR dan konfigurasi CDN/log | Verifikasi staging/operasional, jangan menyimpulkan aman dari dependency yang terpasang |

Audit ini tidak membuktikan eksploitasi pada produksi dan bukan penetration test menyeluruh. Risiko HTML satu origin tetap relevan walaupun UI voting memakai layout dan cookie berbeda.
