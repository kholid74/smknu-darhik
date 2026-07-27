import { createClient } from '@libsql/client';

const url = `file:${process.cwd()}/dev.db`;
const db = createClient({ url });

async function main() {
  // ─── Settings ───
  await db.execute(`INSERT OR REPLACE INTO Setting (id, siteName, siteShortName, tagline, address, phone, email, wa, instagram, facebook, tiktok, youtube) VALUES ('main', 'SMKS NU Darul Hikam', 'SMKS NU DH', 'Terampil, Beriman, Siap Kerja', 'Jl. Sultan Hasanuddin No.44, Tracal, Karanggeneng, Lamongan 62254', '0822 2782 5878', 'smknudarulhikam@gmail.com', '6282227825878', 'smknudarulhikam', 'smknudarulhikam', 'smknudh_karanggeneng', '@dhtvsmkdh9648')`);

  // ─── Admin ───
  await db.execute(`INSERT OR IGNORE INTO Admin (id, username, password, role) VALUES ('admin1', 'admin', '$2b$10$placeholder', 'superadmin')`);

  // ─── Department ───
  await db.execute(`INSERT OR IGNORE INTO Department (id, slug, name, icon, description, kompetensi, karir, \"order\") VALUES ('dept1', 'perbankan-syariah', 'Perbankan Syariah', 'account_balance', 'Belajar dasar-dasar perbankan sesuai prinsip syariah.', '["Akad keuangan syariah","Produk perbankan syariah","Akuntansi dasar","Layanan nasabah"]', '["Staf Bank Syariah","BMT / Koperasi","Admin Keuangan","Wirausaha"]', 1)`);
  await db.execute(`INSERT OR IGNORE INTO Department (id, slug, name, icon, description, kompetensi, karir, \"order\") VALUES ('dept2', 'dkv', 'DKV (Desain Komunikasi Visual)', 'palette', 'Belajar desain grafis, ilustrasi, fotografi, videografi, dan animasi.', '["Desain grafis","Ilustrasi digital","Fotografi & videografi","Motion graphic"]', '["Desainer Grafis","Illustrator","Content Creator","Fotografer/Videografer"]', 2)`);

  // ─── Teacher ───
  await db.execute(`INSERT OR IGNORE INTO Teacher (id, name, position, level, \"order\") VALUES ('t1', 'Hadi Santoso, S.E.,M.Pd.', 'Kepala Sekolah', 'Kepala Sekolah', 1)`);
  await db.execute(`INSERT OR IGNORE INTO Teacher (id, name, position, level, \"order\") VALUES ('t2', 'Dra. Siti ..., M.Pd', 'Waka Kurikulum', 'Waka', 1)`);
  await db.execute(`INSERT OR IGNORE INTO Teacher (id, name, position, level, \"order\") VALUES ('t3', 'Drs. Budi ...', 'Waka Kesiswaan', 'Waka', 2)`);

  console.log('✅ Seed selesai');
}

main().catch(console.error);
