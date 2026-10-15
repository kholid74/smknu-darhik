# Evaluasi data table
Keputusan: tabel HTML Astro + enhancement TypeScript kecil; query server dan SortTh tetap digunakan untuk dataset besar.

| Kriteria | TanStack Table | Grid.js | HTML Astro + enhancement |
|---|---|---|---|
| Bundle | Core headless tambahan, UI sendiri | Runtime render grid dan plugin tambahan | Tanpa dependency baru |
| Integrasi | Model state/core + renderer Astro/JS | Render/mapping tabel dan action lama | Mempertahankan DOM/form yang ada |
| Aksesibilitas | Markup/fokus menjadi tanggung jawab aplikasi | Perlu validasi keyboard renderer/plugin | th/scope, region, label dan button native |
| Server | Manual pagination/filter/sort | Server config di plugin | GET/query/SortTh yang sudah ada |
| Search/sort | Lengkap | Plugin | Sederhana lokal; kompleks tetap server |
| Selection/bulk | Model selection built-in | Perlu integrasi | Handler PIN yang ada tetap pemilik |
| Responsive | CSS sendiri | CSS/theme | Region overflow + token bersama |
| Maintainability | Bagus jika kebutuhan grid kompleks tumbuh | Renderer tambahan harus diselaraskan | Sesuai jumlah data dan arsitektur sekarang |

Ukuran byte paket belum diukur; tidak mengutip angka bundle yang tidak diverifikasi. Pilihan didasarkan pada biaya migrasi markup/action, ketiadaan framework client, dan batas roster <100.
Gunakan enhancement lokal pada roster/PIN/kelas dan daftar konten kecil. Siswa dan daftar besar CMS tetap server. Partisipasi tetap cursor server; toolbar menandai bahwa filter lokal hanya atas baris yang telah dimuat bila memakai load-more.
Advanced table tidak dipasang pada kartu periode, grafik atau grid media.

Sumber: [TanStack headless](https://tanstack.com/table/v8/docs/introduction), [Grid.js server](https://gridjs.io/docs/server-side/), [Astro components](https://docs.astro.build/en/basics/astro-components/), [Astro styles](https://docs.astro.build/en/guides/styling/).
