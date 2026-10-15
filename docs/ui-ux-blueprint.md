# Blueprint UI/UX
Arahan implementasi diberikan melalui permintaan pengguna 15 Oktober 2026.

## Arah desain
Identitas hijau SMKDH, sidebar hijau gelap, konten netral abu muda, kartu putih dan garis tipis. Plus Jakarta Sans dipertahankan dan digunakan pada Portal Siswa dengan system-ui fallback. Tidak ada framework UI baru.
Ikon navigasi shell memakai SVG lokal; ikon konten lama tetap menggunakan Material Symbols. Test browser memblokir font eksternal untuk menguji fallback secara deterministik.

## Hirarki
Admin: breadcrumb → judul/deskripsi/aksi → filter → tabel/form → pagination/feedback. Sidebar mengikuti capability efektif; Coming Soon tidak interaktif.
Siswa: identitas sekolah → satu tugas utama → kemajuan → tindakan utama → petunjuk privasi. Tidak menampilkan pilihan kandidat yang sudah dikirim.

## Token
Sumber: src/styles/portal-tokens.css. Font 12/14/16/24/32 px, jarak 4/8/12/16/24/32 px, kontrol minimum 44px, radius 8/12/16px. Success hijau, warning amber, danger merah, info biru. Semua focus-visible tetap terlihat; prefers-reduced-motion mematikan animasi.

## Responsif dan aksesibilitas
Desktop/Chromebook 1366×768: sidebar 248px, konten maksimum 1440px. Tablet/mobile: drawer dengan Escape, fokus kembali dan overlay; konten tidak terpotong, tabel mempunyai region scroll berlabel. Native dialog menangani fokus. Loading tidak menghapus data yang sudah terlihat. Pesan error dibaca live region. Warna selalu disertai teks.
