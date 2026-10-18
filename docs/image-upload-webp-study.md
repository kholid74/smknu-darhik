# Kajian konversi gambar WebP sebelum upload ke R2

Tanggal kajian: 16 Oktober 2026. **Pembaruan 18 Oktober: implementasi T10 dan tes lokal selesai; verifikasi R2/hosted belum selesai.** Bagian kajian di bawah merekam baseline sebelum perubahan.

## Implementasi T10 dan bukti terbaru

[prepareUpload](../src/lib/upload-file.ts), [R2](../src/lib/r2.ts), [admin](../src/pages/api/upload.ts) dan [alumni](../src/pages/api/alumni/upload.ts) kini menormalisasi JPG/PNG/WebP statis menjadi WebP85: auto-orient, <=1800px tanpa enlarge, tanpa EXIF, batas40MP/5MiB. Logo eksplisit memakai lossless+alpha. UUID key, ekstensi, Content-Type, Media.mimeType/size dan respons mengikuti output; nama original tetap. SVG/GIF/APNG/WebP animasi ditolak, gambar rusak422 tanpa raw fallback. Dokumen allowlist PDF/Office/ZIP/RAR berdasarkan signature kontainer tetap byte-identik, attachment/nosniff. Ini bukan parser isi Office atau malware scanner.

MediaPicker logo jenis/mitra, opsi jenis UploadWidget, FileUpload dan profil alumni sudah sesuai. Origin same-origin wajib; alumni tidak boleh memilih folder/purpose. Pembacaan multipart dibatasi5MiB+64KiB termasuk tanpa Content-Length. Storage error503 aman; indexing gagal memberi URL+warning/idnull, tanpa klaim sudah tercatat. Penghapusan media yang dirujuk jenis/contest/calon/snapshot ditolak; row lock Media melindungi pemasangan logo/foto melawan delete. Jika pembersihan object tak terpakai gagal setelah entri dihapus, operator perlu memeriksa object yatim. Tidak mengubah aset lama massal, schema DB atau thumbnail on-demand.

**228/228 tes serial**, **37 skenario browser**, build produksi dan pemeriksaan kontrak/dokumen lulus. SQL/Prisma memakai PGlite; perintah S3 nyata diintersep dalam tes. Cakupan metadata/key, EXIF, pixel/alpha lossless, dokumen identik, byte/pixel limits, format, realm/izin dicabut/origin, error storage/indexing dan referensi historis. Screenshot mobile serta foto publik source/output diperiksa; bukan foto calon resmi.

Pengukuran ulang [skrip benchmark](../scripts/benchmark-upload.mjs), Windows/Node24.21/Sharp0.35.3, median3run setelah warmup:

| Sampel | Input | JPEG85 lama | Output T10 | Encode median | CPU median |
| --- | ---: | ---: | ---: | ---: | ---: |
| Portrait JPEG | 45674 B | 24986 B | 12686 B | 22,7ms | 16ms |
| Hero JPEG | 208464 B | 119323 B | 72650 B | 66,9ms | 63ms |
| Logo PNG lossless | 969729 B | Tidak sebanding: JPEG membuang alpha | 22964 B | 18,7ms | 16ms |
| Noise PNG sintetis | 4809586 B | 1115766 B | 1203096 B | 235,9ms | 219ms |

Foto sampel39,1–49,2% lebih kecil dari JPEG85 lama; noise justru7,8% lebih besar. Kualitas80 menghasilkan9950/61908byte pada portrait/hero; default tetap85 untuk foto besar. RSS maksimum proses sekitar135MiB pada rangkaian benchmark, bukan peak terisolasi perinput atau batas concurrency. Proses lokal baru memerlukan59,6ms untuk import helper + encode pertama; tidak mencakup seluruh bootstrap Node/SDK/server dan bukan cold start Vercel. Angka kualitas antarcodec bukan bukti mutu setara.

Uji R2 nyata dicoba tetapi tertahan: konfigurasi lokal R2_ENDPOINT/R2_ACCESS_KEY/R2_SECRET_KEY belum tersedia, **0 object terunggah**. MIME/ukuran diuji terhadap PutObjectCommand, belum object nyata. Latensi R2/end-to-end, cold start Vercel, batas multipart hosting, peak concurrency dan mutu foto resmi tetap penerimaan T10/T12. Thumbnail miss/cache browser tetap mengikuti regresi T08–T10; tidak menganggap benchmark encoding sebagai latency hosted. Artifact pengukuran di `artifacts/ui-qa/upload`, tanpa data Neon.

## Kondisi baseline sebelum T10

[uploadToR2](../src/lib/r2.ts) sudah menjalankan Sharp sebelum `PutObject` R2. Gambar di-resize maksimal 1800 × 1800 dengan rasio tetap dan tanpa pembesaran. Jika metadata menyatakan ada alpha, hasilnya WebP kualitas 85; gambar lain menjadi JPEG progresif kualitas 85. Bila decoding/kompresi gagal, helper saat ini menyimpan byte awal. Tidak semua PNG berarti foto transparan, tetapi keputusan kode sekarang mengikuti keberadaan kanal alpha, bukan isi visual atau kegunaan gambar.

Helper digunakan oleh [upload admin](../src/pages/api/upload.ts) dan [upload alumni](../src/pages/api/alumni/upload.ts). Pemilih gambar, UploadWidget, FileUpload dan foto profil alumni memakai jalur tersebut. Jalur admin juga menerima dokumen non-gambar; perubahan tidak boleh mengonversi PDF/DOC/XLS menjadi gambar. Batas input aplikasi saat ini 5 MiB; konversi di server terjadi sesudah file dikirim ke aplikasi, jadi tidak mengurangi transfer awal pengguna → aplikasi atau menyelesaikan batas payload deployment.

[Endpoint thumbnail](../src/lib/image-response.ts) terpisah: varian `?w=` sudah WebP kualitas 70, diproses saat cache miss dan memiliki cache immutable bila sukses. Mengubah master upload menjadi WebP tidak otomatis menghapus fetch R2/resize pada miss varian ini.

Ada inkonsistensi metadata yang perlu masuk implementasi: kedua route upload mencatat `Media.mimeType` dan `Media.size` dari file input, walaupun URL R2 dapat berisi hasil yang format/ukurannya berbeda. `filename` memang menyimpan nama original. Metadata baru seharusnya mencatat MIME dan ukuran **hasil tersimpan**, sehingga UI dan pengukuran kompresi tidak menampilkan angka input sebagai ukuran hasil.

## Pilihan lokasi konversi

| Pendekatan | Kelebihan | Kekurangan | Penilaian |
| --- | --- | --- | --- |
| Server sebelum R2, menggunakan Sharp | Satu aturan untuk admin/alumni; kualitas, orientasi, ukuran dan MIME dapat divalidasi; tidak menambah encoding pada perangkat pengguna; sudah sesuai arsitektur repo | File asli tetap melewati jaringan pengguna → server; encoding menggunakan CPU/memori dan waktu function; perlu uji cold start dan file besar | **Direkomendasikan sebagai awal** |
| Browser sebelum kirim ke API | Dapat mengurangi bytes upload dan request awal; progres optimasi bisa terlihat sebelum upload | Encoding/decode membebani perangkat, hasil antarbrowser perlu diperiksa, canvas dapat fallback PNG, perlu fallback/error/progres/cancel; server tetap harus memvalidasi | Pertimbangkan jika bandwidth upload terbukti menjadi bottleneck |
| Browser + server | Dapat mengurangi upload sambil menjaga validasi terpusat | Dua proses lossy berurutan berisiko menurunkan detail; lebih banyak waktu/kode dan pengujian; tidak otomatis lebih cepat | Tunda sampai ada bukti perlu |

Browser modern dapat menawarkan `canvas.toBlob(..., 'image/webp', quality)`, tetapi format yang tidak didukung dapat menghasilkan PNG. Karena itu ekstensi/MIME tidak boleh sekadar diganti; hasil `Blob.type` harus diperiksa. [MDN toBlob](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob).

WebP mendukung lossy/lossless dan alpha. Ukuran pada studi format umum tidak menjamin setiap berkas lebih kecil. [Dokumentasi WebP](https://developers.google.com/speed/webp). Sharp menyediakan kontrol kualitas, lossless dan effort; effort lebih tinggi meningkatkan pekerjaan encoding. [Sharp WebP](https://sharp.pixelplumbing.com/api-output/#webp).

## Pengukuran lokal

Windows, Node v24.21.0, Sharp 0.35.3. Resize sama dengan kode sekarang; default effort WebP 4. Satu warmup dan median tiga encoding berurutan untuk tiap pilihan. Tidak ada request R2, perubahan DB, server Vercel, encoding browser atau pengukuran kualitas visual setara. Dua input JPEG dibuat dari foto publik repo menggunakan JPEG95 sebagai simulasi upload, bukan foto calon/master resmi.

| Input | Pipeline sekarang: bytes / median | WebP85: bytes / median | WebP80: bytes / median |
| --- | ---: | ---: | ---: |
| Hero PNG berkanal alpha, 947 × 1115 | WebP85: 72.912 B / 75,2 ms | 72.912 B / 76,8 ms | 62.400 B / 74,5 ms |
| Hero JPEG sintetis, 947 × 1115 | JPEG85: 119.323 B / 18,6 ms | 72.650 B / 67,5 ms | 61.908 B / 64,0 ms |
| Portrait JPEG sintetis, 478 × 561 | JPEG85: 24.986 B / 5,9 ms | 12.686 B / 20,1 ms | 9.950 B / 19,3 ms |
| Logo PNG, 113 × 113 | WebP85: 5.896 B / 5,2 ms | 5.896 B / 4,4 ms | 5.304 B / 4,3 ms |

Pada dua JPEG sampel, WebP85 mengurangi bytes sekitar **39,1% / 49,2%** dibanding hasil JPEG85 pipeline sekarang, dengan waktu encoding sekitar **3,6× / 3,4×**. Tambahan waktu absolut sekitar 49 / 14 ms pada mesin ini. Angka kualitas 85 antarcodec bukan bukti kualitas visual setara; belum ada penilaian SSIM atau uji foto calon asli. Hasil juga tidak mewakili foto kamera resolusi tinggi, file mendekati batas ukuran atau concurrency serverless.

Logo yang sama dengan **WebP lossless** menghasilkan 19.248 B / 16,1 ms. Lebih besar daripada lossy 85, tetapi mempertahankan detail; logo statis aplikasi memang sudah memakai hasil lossless tersebut. Foto, tulisan kecil dan logo tidak semestinya dipaksa memakai satu kebijakan kualitas tanpa pemeriksaan visual.

Skrip dan hasil pengukuran lokal: `artifacts/ui-qa/webp-upload-study.mjs` / `.json`, diabaikan Git. File asli di repo tidak diubah.

## Rekomendasi implementasi minimum

1. Pertahankan konversi di server; normalisasi foto raster statis menjadi WebP sebelum R2 dengan Sharp yang sudah dipakai. Mulai kualitas 85 untuk foto calon yang akan tampil besar; bandingkan kualitas 80 sebelum memilih default akhir. Jangan menganggap quality 85 setara antarformat atau menambahkan library konversi browser.
2. Orientasikan foto berdasarkan EXIF sebelum resize/encode, pertahankan rasio dan alpha, tanpa pembesaran. Sharp memiliki `autoOrient()` untuk orientasi EXIF. [Sharp autoOrient](https://sharp.pixelplumbing.com/api-operation/#autoOrient). Validasi byte gambar sebenarnya, batas ukuran/dimensi, dan tangani gambar rusak sebagai error yang jelas pada jalur gambar, bukan diam-diam menyimpan file besar yang gagal dikompres.
3. Simpan key unik berekstensi `.webp` dan `Content-Type: image/webp` untuk hasil WebP. Ubah helper agar mengembalikan URL, MIME dan ukuran hasil; perbarui **kedua** route dan seluruh caller yang memakai kontrak URL lama. Nama original tetap menjadi nama pustaka, terpisah dari format output. Berkas lama tetap dapat dibaca; jangan batch-reencode seluruh R2 sebagai bagian perubahan ini.
4. Logo membutuhkan kebijakan tersendiri: lossless atau pertahankan format yang sesuai; jangan menyimpulkan semua gambar alpha adalah logo. Dokumen tetap sebagai berkas, dan format animasi/SVG memerlukan keputusan eksplisit agar tidak diam-diam menjadi frame pertama/gambar raster. Tahap awal cukup membatasi pipeline foto pada raster statis yang didukung.
5. Setelah upload, gunakan `srcset/sizes` dan varian thumbnail yang sesuai tampilan. Jika miss thumbnail terbukti menjadi hambatan, ukur pre-generation beberapa ukuran saat upload dengan tambahan encoding, storage dan operasi R2 yang diperlukan; jangan membuat semua varian tanpa bukti.

Asumsi yang disarankan: file asli beresolusi penuh tetap disimpan oleh operator di luar aplikasi bila diperlukan untuk cetak/arsip. Pipeline saat ini memang mengganti sumber dengan hasil kompresi, bukan menyimpan original dan versi web bersama. Menyimpan keduanya merupakan kebutuhan arsip berbeda dengan biaya/storage tambahan, bukan syarat mempercepat halaman web.

## Kriteria sebelum mengaktifkan

- Ukur input/output bytes dan waktu encode dengan foto landscape, portrait berorientasi EXIF, alpha, logo kecil, WebP yang sudah terkompresi, gambar rusak, non-gambar dan file mendekati batas input. Uji kesesuaian MIME/ekstensi/media metadata, original non-gambar utuh, serta error R2 tanpa referensi media palsu.
- Tinjau wajah, teks, warna, crop dan alpha pada foto besar kartu/hasil di mobile/Chromebook. Jangan menyetujui kualitas hanya berdasarkan ukuran file.
- Ukur waktu keseluruhan upload serta CPU/memori/cold start pada preview Vercel. Uji upload admin dan alumni; jangan memakai transaksi pemilihan sebagai tempat encoding atau membuat session timeout baru.
- Bandingkan cold/warm thumbnail dan transfer halaman. Tujuannya satu biaya kompresi saat admin upload untuk penghematan pembacaan berikutnya, bukan janji skor PageSpeed tertentu.

Pada saat kajian awal, rekomendasi belum mengubah aplikasi; implementasi 18 Oktober dicatat di atas. Pipeline server dipilih berdasarkan struktur saat ini dan pengukuran lokal; performa serverless, bandwidth upload dan kualitas visual masih perlu verifikasi saat implementasi.
