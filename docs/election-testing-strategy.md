# Strategi simulasi pemilihan
Reset pemilihan resmi dilarang oleh trigger immutable ballots dan audit append-only. Untuk mengulang seluruh dataset tersedia PostgreSQL localhost terpisah bernama smkdh_election_simulation dengan tooling CLI. Keputusan operator berikutnya menambahkan [pembersihan satu periode uji](e-voting/08-pembersihan-data-uji.md) melalui superadmin, ringkasan, konfirmasi slug dan password. Ini tidak menyediakan reset database resmi atau endpoint pembuat data QA pada deployment.

## Guard
Tooling menolak NODE_ENV=production, VERCEL atau URL non-localhost, database dengan nama berbeda, dan marker ownership yang tidak cocok. Tidak membaca DATABASE_URL resmi. Runtime mode simulasi memerlukan SMKDH_SIMULATION=1 dan URL khusus yang lolos guard; deploy produksi menolak mode ini.
Seed menolak database yang sudah mengandung schema tanpa marker. Reset memeriksa marker dan konfirmasi --confirm=smkdh_election_simulation sebelum membuat ulang schema milik simulator. Trigger pemilihan diterapkan ulang melalui migration yang sama. Tidak mengubah grants database resmi.

## Alur
1. docker compose -f compose.simulation.yml up -d
2. npm run qa:seed
3. npm run qa:dev
4. Buka admin/siswa menggunakan credential sintetis yang dicetak seed.
5. npm run qa:reset -- --confirm=smkdh_election_simulation

Scenario empty (periode draft tanpa roster), ready (siswa belum memilih), partial (dua organisasi selesai), completed (empat organisasi selesai), expired (periode lewat tenggat). Expired-session: tunggu idle expiration/periksa cookie fixture guard; network-error: offline browser ketika submit, kemudian online dan periksa status. Already-voted: ulang POST organisasi yang sama pada DB simulasi.
Seed/reset tidak pernah memakai file master siswa resmi. Password/PIN simulasi tidak boleh digunakan untuk pemilihan resmi.

## Verifikasi
Unit tests guard env/URL/ownership/confirmation dan tes sesi yang ada dipertahankan. Tes migrasi/cleanup PostgreSQL dalam memori memakai PGlite tanpa koneksi Neon/Docker. Fixture simulator tidak memberi izin hapus ballot periode biasa; pengecualian DELETE hanya berlaku untuk periode uji dalam transaksi cleanup yang diverifikasi. Pengujian konkurensi jaringan dan perjalanan empat suara menyeluruh tetap memerlukan lingkungan integrasi.

## QA komponen tanpa database
npm run qa:ui membangun scripts/ui-fixture sebagai situs statis terpisah. Tidak ada route QA yang disertakan pada aplikasi. Server HTTP test memakai port loopback sementara dan dihentikan setelah tes, bersama Chrome headless. Delapan skenario komponen admin dan dua skenario sesi siswa memeriksa DOM, dialog, pencarian/filter/sort/pagination, drawer keyboard, overflow tablet, verifikasi cleanup dua tahap dengan API mock, pembaruan CSRF, logout dan expiry. Respons activity/logout pada fixture siswa dimock; ini tidak membuktikan transaksi ballot end-to-end. Screenshot 1366×768 dan 390×844 serta results.json disimpan di artifacts/ui-qa yang diabaikan Git.
Saat browser gagal menjangkau font eksternal, fallback font dan SVG shell tetap berfungsi; font eksternal memang diblokir pada smoke test ini.

## Catatan operasional simulator
Perintah qa:seed/qa:reset adalah opt-in eksplisit dan menggunakan target localhost bawaan, atau SIMULATION_DATABASE_URL yang lolos guard. DATABASE_URL resmi tidak dibaca. Reset memutar semua secret dan kredensial fixture; hentikan server simulasi sebelum reset lalu jalankan qa:dev kembali. Runtime juga memverifikasi marker kepemilikan sebelum melayani query aplikasi dalam mode simulasi.
