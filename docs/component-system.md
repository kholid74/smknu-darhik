# Sistem komponen
Komponen Astro berada di src/components/ui. Komponen memakai token portal, HTML semantik dan slot; tidak membawa runtime framework.

| Komponen | Kontrak/pemakaian |
|---|---|
| PageHeader | title, description, slot actions |
| Breadcrumbs | items label/href; dipasang layout |
| StatusBadge | status/tone, label; status tetap teks |
| FormField | label, for, hint/error, slot kontrol |
| FormSection | title, description, slot field/action |
| Feedback | id, tone, live region; isi dinamis textContent |
| EmptyState | title, description, slot tindakan |
| LoadingState | label, role=status |
| ConfirmDialog | id/title/message/confirmLabel/danger; showModal, cancel, returnValue |
| Pagination | page/pageCount/total/size/url; mempertahankan query |
| DataTable | id/label/mode/filterColumn; slot toolbar/table/footer |
| RowActions | details/summary native berlabel; slot tombol/form |
| Icon | SVG lokal untuk navigasi dashboard agar layout tetap terbaca saat font ikon eksternal gagal |

## State dan kepemilikan
State pencarian/filter/pagination bukan state bisnis. Pilihan bulk PIN tetap dimiliki handler PIN dan maksimal 25; pencarian tabel tidak mengubah pilihan tersembunyi. Selection tidak disimpan ke storage.
Client tables: data-table.ts mengendalikan row.hidden, sort teks/angka dan page size. Server tables: kontrol GET dan Pagination, tanpa sort/filter lokal atas subset data.
Dialog edit tetap berbeda dari konfirmasi hapus. Form besar/editor memakai halaman; kelas memakai dialog; form tambah siswa tetap toggle. Actions menggunakan endpoint dan otorisasi lama.
Menu RowActions terbuka di dalam alur baris sehingga tidak terpotong container tabel. Fixture komponen berada di scripts/ui-fixture, tidak menjadi route aplikasi.
