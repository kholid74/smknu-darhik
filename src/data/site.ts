export const site = {
  name: 'SMKS NU Darul Hikam',
  shortName: 'SMKS NU DH',
  tagline: 'Terampil, Beriman, Siap Kerja',
  location: 'Karanggeneng, Lamongan',
  address: 'Jl. Sultan Hasanuddin No.44, Tracal, Kec. Karanggeneng, Kab. Lamongan, Jawa Timur 62254',
  phone: '0822 2782 5878',
  email: 'smknudarulhikam@gmail.com',
  wa: '082227825878',
  founded: '2010', // dummy
  accreditation: 'A', // dummy
};

export const nav = {
  main: [
    { label: 'Beranda', href: '/' },
    {
      label: 'Profil',
      children: [
        { label: 'Tentang Sekolah', href: '/profil' },
        { label: 'Visi & Misi', href: '/profil#visi' },
        { label: 'Struktur Sekolah', href: '/struktur' },
        { label: 'Guru & Staf', href: '/guru' },
      ],
    },
    {
      label: 'Akademik',
      children: [
        { label: 'Program Keahlian', href: '/jurusan' },
        { label: 'PKL / Magang', href: '/pkl' },
        { label: 'Ekstrakurikuler', href: '/ekskul' },
        { label: 'Fasilitas', href: '/fasilitas' },
      ],
    },
    {
      label: 'Informasi',
      children: [
        { label: 'Berita & Kegiatan', href: '/berita' },
        { label: 'Galeri Foto', href: '/galeri' },
        { label: 'FAQ', href: '/faq' },
        { label: 'Download', href: '/download' },
        { label: 'Alumni', href: '/alumni' },
      ],
    },
    { label: 'PPDB', href: '/ppdb' },
    { label: 'Kontak', href: '/kontak' },
  ],
  footer: [
    { label: 'Beranda', href: '/' },
    { label: 'Profil', href: '/profil' },
    { label: 'Program Keahlian', href: '/jurusan' },
    { label: 'PPDB', href: '/ppdb' },
    { label: 'Kontak', href: '/kontak' },
  ],
};

export const jurusan = [
  {
    name: 'Perbankan Syariah',
    slug: 'perbankan-syariah',
    icon: 'account_balance',
    color: 'green',
    description: 'Belajar dasar-dasar perbankan sesuai prinsip syariah — akad-akad keuangan Islam, produk perbankan, dan layanan nasabah. Lulus siap kerja di bank syariah, BMT, atau koperasi.',
    kompetensi: [
      'Akad-akad dalam keuangan syariah (mudharabah, murabahah, dll)',
      'Produk dan layanan perbankan syariah',
      'Dasar akuntansi dan administrasi keuangan',
      'Pelayanan nasabah dan etika kerja Islami',
    ],
    karir: ['Staf Bank Syariah', 'Karyawan BMT / Koperasi', 'Admin Keuangan', 'Wirausaha'],
  },
  {
    name: 'DKV (Desain Komunikasi Visual)',
    slug: 'dkv',
    icon: 'palette',
    color: 'gold',
    description: 'Belajar desain grafis, ilustrasi, fotografi, videografi, dan animasi — bekal untuk berkarya di industri kreatif digital yang terus berkembang.',
    kompetensi: [
      'Desain grafis dan ilustrasi digital',
      'Fotografi dan videografi',
      'Editing video dan motion graphic',
      'Produksi konten digital dan media sosial',
    ],
    karir: ['Desainer Grafis', 'Illustrator', 'Content Creator', 'Fotografer / Videografer'],
  },
];

export const dummyNote = '[data perlu dikonfirmasi ke sekolah]';
export const stockPhotoNote = 'stock foto — akan diganti foto asli';

export const articles = [
  {
    slug: 'juara-lks-kabupaten-2026',
    title: 'Siswa SMKS NU Darul Hikam Raih Juara 1 LKS Kabupaten Lamongan 2026',
    excerpt: 'Tim Akuntansi berhasil meraih juara pertama dalam Lomba Kompetensi Siswa tingkat kabupaten, membuktikan kualitas pendidikan kejuruan kami.',
    date: '15 Juli 2026',
    category: 'Prestasi',
    img: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&q=80',
    body: `<p>Prestasi membanggakan kembali ditorehkan oleh siswa SMKS NU Darul Hikam. Tim Akuntansi dari jurusan Perbankan Syariah berhasil meraih <strong>Juara 1 dalam Lomba Kompetensi Siswa (LKS) tingkat Kabupaten Lamongan 2026</strong>.</p>
<p>Lomba yang diadakan di SMKN 1 Lamongan ini diikuti oleh puluhan peserta dari berbagai SMK se-Kabupaten Lamongan. Tim kami unggul dalam kategori Akuntansi & Keuangan setelah melalui tiga tahap penjurian yang ketat.</p>
<p>"Alhamdulillah, ini hasil kerja keras dan bimbingan para guru yang luar biasa. Kami tidak menyangka bisa meraih juara pertama," ujar ketua tim dengan penuh syukur.</p>
<p>Kepala Sekolah, Hadi Santoso, M.Pd, menyampaikan apresiasinya. "Ini bukti bahwa sekolah di desa pun bisa bersaing dan berprestasi. Kami akan terus mendukung siswa untuk mengembangkan potensinya."</p>
<p>Kemenangan ini menjadi modal berharga bagi tim untuk melaju ke tingkat provinsi. Selamat kepada para juara!</p>`,
  },
  {
    slug: 'maulid-nabi-1448-h',
    title: 'Peringatan Maulid Nabi Muhammad SAW 1448 H di SMKS NU Darul Hikam',
    excerpt: 'Seluruh siswa dan guru mengikuti peringatan Maulid Nabi dengan khidmat, diisi pembacaan shalawat dan tausiyah.',
    date: '5 Juli 2026',
    category: 'Keagamaan',
    img: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=1200&q=80',
    body: `<p>Seluruh keluarga besar SMKS NU Darul Hikam menggelar peringatan Maulid Nabi Muhammad SAW 1448 H dengan penuh khidmat. Acara yang berlangsung di halaman sekolah ini dihadiri oleh seluruh siswa, guru, staf, serta warga sekitar.</p>
<p>Kegiatan diawali dengan pembacaan shalawat bersama yang dipimpin oleh grup hadrah siswa, dilanjutkan dengan pembacaan ayat suci Al-Qur'an oleh siswi terbaik.</p>
<p>Tausiyah utama disampaikan oleh KH. Ahmad Mustofa yang menekankan pentingnya meneladani akhlak Rasulullah SAW dalam kehidupan sehari-hari — terutama bagi generasi muda yang sedang menempuh pendidikan.</p>
<p>"Ilmu tanpa akhlak itu kosong. Rasulullah diutus untuk menyempurnakan akhlak. Maka jadilah siswa yang tidak hanya pintar, tapi juga berakhlak mulia," pesan beliau.</p>
<p>Acara ditutup dengan doa bersama dan ramah tamah. Kegiatan seperti ini rutin diadakan sebagai bagian dari pembinaan karakter Islami siswa.</p>`,
  },
  {
    slug: 'workshop-desain-grafis-2026',
    title: 'Workshop Desain Grafis: Desain Poster Profesional dengan Canva & Figma',
    excerpt: 'Siswa jurusan Multimedia mengikuti workshop intensif bersama praktisi industri kreatif dari Surabaya.',
    date: '28 Juni 2026',
    category: 'Akademik',
    img: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&q=80',
    body: `<p>Siswa jurusan Multimedia mengikuti workshop desain grafis intensif selama dua hari. Workshop ini menghadirkan praktisi industri kreatif dari Surabaya yang berbagi pengalaman dan teknik terkini.</p>
<p>Materi yang dibahas meliputi prinsip dasar desain, tipografi, komposisi warna, hingga hands-on menggunakan Canva dan Figma — dua tools yang saat ini banyak digunakan di industri.</p>
<p>"Kami ingin siswa tidak hanya belajar teori, tapi langsung praktik dan menghasilkan karya yang bisa masuk portfolio," jelas pemateri.</p>
<p>Setiap peserta berhasil membuat poster profesional mereka sendiri. Hasil karya terbaik dipamerkan di mading sekolah dan media sosial.</p>`,
  },
  {
    slug: 'pkl-2026',
    title: 'Praktik Kerja Lapangan (PKL) 2026: 45 Siswa Diterjunkan ke Dunia Industri',
    excerpt: 'Siswa kelas XI memulai program PKL di berbagai mitra — bank syariah, studio kreatif, koperasi, dan UMKM.',
    date: '20 Juni 2026',
    category: 'Akademik',
    img: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200&q=80',
    body: `<p>Sebanyak 45 siswa kelas XI SMKS NU Darul Hikam resmi memulai program Praktik Kerja Lapangan (PKL) tahun 2026. Para siswa diterjunkan ke berbagai mitra industri yang tersebar di Kabupaten Lamongan dan sekitarnya.</p>
<p>Siswa jurusan Perbankan Syariah menjalani PKL di bank syariah dan BMT, sementara siswa Multimedia ditempatkan di studio kreatif, percetakan, dan agensi digital.</p>
<p>"Program PKL ini memberikan pengalaman nyata kepada siswa tentang dunia kerja. Mereka belajar disiplin, tanggung jawab, dan menerapkan ilmu yang sudah dipelajari di sekolah," jelas Wakil Kepala Sekolah Bidang Humas & Industri.</p>
<p>Program PKL berlangsung selama 3 bulan dengan monitoring berkala dari guru pembimbing.</p>`,
  },
  {
    slug: 'jambore-cabang-2026',
    title: 'Pramuka SMKS NU Darul Hikam Ikuti Jambore Cabang Lamongan',
    excerpt: 'Regu pramuka kami mengikuti Jambore Cabang dengan semangat tinggi, membawa pulang pengalaman berharga.',
    date: '10 Juni 2026',
    category: 'Ekstrakurikuler',
    img: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&q=80',
    body: `<p>Regu pramuka SMKS NU Darul Hikam mengikuti Jambore Cabang Lamongan yang diadakan di Bumi Perkemahan Sukorame. Kegiatan ini diikuti oleh puluhan gugus depan dari berbagai sekolah di Kabupaten Lamongan.</p>
<p>Selama tiga hari, para peserta mengikuti berbagai kegiatan — mulai dari pioneering, wide games, pentas seni, hingga lomba kepramukaan. Regu kami tampil penuh semangat di setiap kegiatan.</p>
<p>"Pramuka mengajarkan kemandirian, kerja sama, dan cinta alam. Nilai-nilai ini sejalan dengan karakter yang kami tanamkan di sekolah," ujar pembina pramuka.</p>
<p>Meski belum membawa pulang piala utama, para siswa mendapatkan pengalaman berharga dan koneksi dengan sesama pramuka dari berbagai sekolah.</p>`,
  },
  {
    slug: 'ppdb-2026-dibuka',
    title: 'PPDB 2026 Dibuka! Ini 5 Alasan Memilih SMKS NU Darul Hikam',
    excerpt: 'Pendaftaran peserta didik baru tahun ajaran 2026/2027 resmi dibuka. Simak keunggulan sekolah kami.',
    date: '1 Mei 2026',
    category: 'PPDB',
    img: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1200&q=80',
    body: `<p>Kabar gembira! Pendaftaran Peserta Didik Baru (PPDB) SMKS NU Darul Hikam tahun ajaran 2026/2027 secara resmi telah dibuka. Berikut 5 alasan kenapa kamu harus memilih kami:</p>
<ol>
<li><strong>Pendidikan kejuruan berkualitas</strong> — Dua jurusan unggulan: Perbankan Syariah dan Multimedia, dengan kurikulum yang disesuaikan kebutuhan industri.</li>
<li><strong>Lingkungan Islami</strong> — Pembiasaan nilai-nilai Aswaja dalam keseharian: shalat berjamaah, ngaji, dan kegiatan keagamaan rutin.</li>
<li><strong>Biaya terjangkau</strong> — Pendidikan berkualitas tanpa harus ke kota. Biaya hidup di desa lebih ringan.</li>
<li><strong>Fasilitas memadai</strong> — Lab komputer, studio multimedia, mini bank praktik, musholla, dan perpustakaan.</li>
<li><strong>Jaringan alumni luas</strong> — Bagian dari keluarga besar NU, alumni tersebar dan saling mendukung.</li>
</ol>
<p>Tunggu apa lagi? Segera daftarkan dirimu dan raih masa depan cerah bersama kami!</p>`,
  },
];
