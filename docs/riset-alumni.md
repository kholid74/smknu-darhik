# Riset Section Alumni — SMKS NU Darul Hikam

---

## BAGIAN 1 — Benchmark & Pola Umum

### 1.1 Pola Umum di Website Sekolah

| Level | Struktur Umum | Contoh |
|---|---|---|
| **SMK/SMA** | Halaman statis: daftar alumni sukses + form kontak | Grid foto + nama + pekerjaan |
| **Universitas** | Portal dedicated: direktori, login, tracer study | alumni.ui.ac.id |

**Kesimpulan:** Mayoritas SMK belum punya sistem alumni — ini peluang pembeda.

### 1.2 Sekolah vs Universitas

| Aspek | SMK | Universitas |
|---|---|---|
| Jumlah alumni | Ratusan | Puluhan ribu |
| Tujuan utama | Branding + bukti lulusan kerja | Networking + donasi |
| Fitur login | Jarang | Wajib |
| Budget | Minim | Ada tim khusus |

### 1.3 Fitur Benchmark Nyata

**Fitur umum (sekolah):** Testimoni alumni, foto+nama+pekerjaan, statistik sederhana

**Fitur universitas besar:** Login alumni, job board, mentorship, donasi online

**Fitur platform profesional:** Skill endorsement, premium membership

---

## BAGIAN 2 — Struktur Section

### 2.1 Alumni Landing Page
- **Tujuan:** First impression — bukti lulusan sukses
- **Konten:** Statistik + 3 success stories + CTA daftar alumni
- **Flow:** Landing → scroll cerita → "Lihat Semua Alumni" → direktori

### 2.2 Direktori Alumni
- **Tujuan:** Browse semua alumni dengan filter
- **Konten:** Grid: foto, nama, angkatan, jurusan, pekerjaan
- **Flow:** Filter jurusan/angkatan → klik nama → detail

### 2.3 Cerita Alumni (Success Stories)
- **Tujuan:** Inspirasi calon siswa + kebanggaan alumni
- **Konten:** Artikel panjang: perjalanan karir, tips, pesan
- **Flow:** Baca → tertarik → daftar PPDB / daftar sebagai alumni

### 2.4 Form Daftar Alumni
- **Tujuan:** Kumpulkan data alumni secara mandiri
- **Konten:** Nama, tahun lulus, jurusan, pekerjaan, cerita singkat
- **Flow:** Isi → submit → admin verifikasi → tampil

### 2.5 Statistik Alumni
- **Tujuan:** Social proof PPDB
- **Konten:** % kerja/kuliah/wirausaha, sebaran industri

---

## BAGIAN 3 — Daftar Fitur (Prioritas)

### Core Features (MVP)

| Fitur | Value Alumni | Value Sekolah | Kompleksitas |
|---|---|---|---|
| Direktori alumni (admin input) | Bisa dilihat public | Bukti lulusan sukses | Low |
| Success stories (3-5) | Kebanggaan | Branding kuat | Low |
| Form pendaftaran alumni | Mudah daftar sendiri | Data masuk otomatis | Medium |
| Statistik ringan | — | Social proof PPDB | Low |
| Filter/search direktori | UX lebih baik | — | Low |

### Nice to Have

| Fitur | Kompleksitas |
|---|---|
| Verifikasi mandiri (admin approve) | Low |
| Testimoni video/text | Low |
| Export CSV | Low |
| Alumni featured di homepage | Low |

### Ultimate Features

| Fitur | Kompleksitas |
|---|---|
| Login alumni (akun pribadi) | High |
| Update profil mandiri | Medium |
| Job board / BKK online | High |
| Mentoring adik kelas | High |
| Donasi / infak alumni | Medium |

---

## BAGIAN 4 — Content Strategy

### 4.1 Success Story Alumni

**Judul contoh:** "Dari Tracal ke Jakarta: Rina, Alumni DKV yang Jadi Creative Director"

**Struktur:**
1. Lead: 1-2 kalimat hook
2. Cerita: 3-4 paragraf (masa sekolah, tantangan, breakthrough)
3. Pesan: quote untuk adik kelas
4. Data: nama, angkatan, jurusan, pekerjaan, instansi

**Visual:** Foto portrait + foto tempat kerja

### 4.2 Alumni Spotlight

**Judul contoh:** "Alumni Perbankan Syariah di Bank Syariah Indonesia"

**Format:** Card horizontal — foto kiri, teks kanan, 1 paragraf

### 4.3 Testimoni

**Format:** Carousel 3 card — foto + quote 2-3 kalimat + nama/angkatan/jurusan

### 4.4 Statistik Alumni

**Visual:** Angka besar + icon + bar chart — "85% bekerja sesuai jurusan", "10% kuliah", "5% wirausaha"

---

## BAGIAN 5 — User Type & Use Case

### 5.1 Alumni
- **Yang dicari:** Kebanggaan, nostalgia, networking
- **Pain point:** Tidak tahu cara terhubung kembali
- **Fitur:** Form daftar, direktori, success story

### 5.2 Siswa Aktif
- **Yang dicari:** Inspirasi karir, gambaran setelah lulus
- **Pain point:** Tidak tahu prospek setelah lulus
- **Fitur:** Success stories, statistik karir, tips alumni

### 5.3 Calon Siswa / Orang Tua
- **Yang dicari:** Bukti lulusan sukses
- **Pain point:** Ragu sekolah desa tidak menjamin masa depan
- **Fitur:** Statistik, success stories, foto alumni di homepage

### 5.4 Pihak Sekolah
- **Yang dicari:** Data alumni untuk akreditasi, tracer study
- **Pain point:** Data tersebar di WhatsApp/Excel
- **Fitur:** Direktori, form pendaftaran, export

---

## BAGIAN 6 — Strategi Engagement

### 6.1 Agar Alumni Mau Daftar

| Insentif | Detail |
|---|---|
| Emosional | "Namamu dikenang" — tampil di website |
| Sosial | Dilihat teman seangkatan |
| Praktis | Database BKK, info lowongan (nanti) |
| UX | Form singkat (1 menit), mobile-friendly |

**CTA:** "Pernah belajar di sini? Daftarkan dirimu, jadi inspirasi adik kelasmu."

### 6.2 Agar Alumni Mau Update Data

| Strategi | Detail |
|---|---|
| Event-based | Blast WA tiap reuni/selebrasi |
| Gamification | "120 alumni terdaftar. Jangan ketinggalan!" |
| Social proof | Counter "X alumni update profil tahun ini" |

### 6.3 Agar Alumni Mau Berkontribusi

| Kontribusi | Cara |
|---|---|
| Sharing pengalaman | Form "Ceritakan Kisahmu" |
| Mentoring | Alumni jadi narasumber (nanti) |
| Lowongan | Share info dari tempat kerja → BKK |

---

## BAGIAN 7 — Rekomendasi Implementasi

### Level 1 — Simple (Sekarang)

```
/admin/alumni — CRUD oleh admin
/alumni — halaman publik direktori + filter

Model: Alumni → id, nama, angkatan, jurusan, pekerjaan, instansi, foto, cerita, verified
```

**Fitur:**
- Admin input data alumni
- Direktori grid publik + filter jurusan/angkatan
- 3 alumni featured di homepage
- Statistik ringan dihitung otomatis
- Form pendaftaran (admin verifikasi)
- **Kompleksitas:** ~2 jam (CRUD pattern sudah ada)

### Level 2 — Medium (Fase 4-5)

- Alumni daftar sendiri + upload foto
- Admin approve/reject
- Export CSV
- Success story format artikel panjang
- Testimoni carousel di homepage

### Level 3 — Advanced (Fase 7+)

- Login alumni (OTP WhatsApp)
- Update profil mandiri
- Dashboard statistik alumni
- Job board / BKK
- Tracer study otomatis

---

## BAGIAN 8 — Keputusan & Roadmap (implementasi aktual)

### 8.1 Yang sudah dibangun (Fase 1)

- **Model `Alumni`**: nama, angkatan (Int, tahun lulus), jurusan, status (Bekerja/Kuliah/Wirausaha/Lainnya), pekerjaan, instansi, cerita, `wa` (privat, admin-only), photoUrl, `verified` gate.
- **`/alumni/daftar`** — form publik pendaftaran mandiri. **Tanpa upload foto.** Honeypot + checkbox consent wajib. Jurusan dropdown (Department live + Multimedia + Lainnya). Angkatan dropdown 2010→tahun berjalan. Submit → `verified=false` → state "terima kasih, menunggu verifikasi".
- **`/alumni`** — landing: CTA daftar + direktori (verified-only, filter jurusan/angkatan, **pagination 24/hal**) + statistik **auto-gated ≥30 verified** (hindari persen menyesatkan pada N kecil).
- **`/admin/alumni`** — antrian verifikasi, approve 1-klik, edit (pasang foto/koreksi), hapus. WA tidak pernah tampil publik.
- Long-form success story = **reuse `Article`** (kategori Alumni), bukan sistem baru.

### 8.2 Ditunda ke Fase Lanjut (Level 3 — Login Alumni)

**Keputusan:** upload foto oleh alumni + kontribusi mandiri **BUKAN** ditempel ke form publik. Rumahnya = **dashboard login alumni**.

**Alasan** (concern upload publik anonim):
- Endpoint upload tanpa auth = vektor abuse (bot/troll jejalkan file ke R2).
- Konten tak pantas → beban moderasi admin per gambar.
- Polusi Media Library + biaya storage junk.
- EXIF/GPS privasi.

**Login menyelesaikan semuanya**: hanya alumni terverifikasi bisa upload (auth), tiap aksi terikat akun (akuntabilitas), self-service (hilang bottleneck admin), kontribusi lain (update pekerjaan/cerita, share lowongan→BKK) natural di satu tempat.

**Cakupan Fase Lanjut:**
- **Login alumni via email magic-link** (keputusan: lebih murah dari WA OTP — SMTP/Resend ~gratis vs gateway WA berbayar per pesan). **Email + WA dikumpulkan** di form sekarang → email = jangkar login, WA = kontak/recovery. Tak perlu ubah skema saat bangun login.
- Upload foto self-service (authenticated → aman, semua concern di atas gugur).
- Edit profil mandiri, dashboard, job board/BKK, tracer study otomatis.

**Sementara (Fase 1):** foto dipasang admin saat approve (alumni kirim via WA). Nol permukaan abuse.

**Catatan implementasi login (saat dibangun):** email jadi kunci unik → tangani duplikat + verifikasi kepemilikan via magic-link. Alumni tanpa email pakai jalur admin (WA).
