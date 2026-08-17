import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  await db.setting.upsert({ where: { id: 'main' }, update: {}, create: { id: 'main', siteName: 'SMKS NU Darul Hikam', siteShortName: 'SMKS NU DH', tagline: 'Terampil, Beriman, Siap Kerja', address: 'Jl. Sultan Hasanuddin No.44, Tracal, Karanggeneng, Lamongan 62254', phone: '0822 2782 5878', email: 'smknudarulhikam@gmail.com', wa: '6282227825878', instagram: 'smknudarulhikam', facebook: 'smknudarulhikam', tiktok: 'smknudh_karanggeneng', youtube: '@dhtvsmkdh9648' } });
  // Akun superadmin bootstrap (realm Internal). Ganti password setelah login pertama.
  const superEmail = 'admin@smksnudarhik.local';
  const existingSuper = await db.account.findUnique({ where: { email: superEmail } });
  if (!existingSuper) {
    await db.account.create({
      data: {
        email: superEmail,
        username: 'admin',
        passwordHash: await bcrypt.hash('admin123', 10),
        active: true,
        roles: { create: [{ role: 'superadmin' }] },
      },
    });
  }
  await db.department.createMany({ data: [
    { slug: 'perbankan-syariah', name: 'Perbankan Syariah', icon: 'account_balance', description: 'Belajar dasar-dasar perbankan sesuai prinsip syariah.', kompetensi: JSON.stringify(['Akad keuangan syariah','Produk perbankan syariah','Akuntansi dasar','Layanan nasabah']), karir: JSON.stringify(['Staf Bank Syariah','BMT/Koperasi','Admin Keuangan','Wirausaha']), order: 1 },
    { slug: 'dkv', name: 'DKV (Desain Komunikasi Visual)', icon: 'palette', description: 'Belajar desain grafis, ilustrasi, fotografi, videografi, dan animasi.', kompetensi: JSON.stringify(['Desain grafis','Ilustrasi digital','Fotografi & videografi','Motion graphic']), karir: JSON.stringify(['Desainer Grafis','Illustrator','Content Creator','Fotografer/Videografer']), order: 2 }
  ], skipDuplicates: true });
  await db.teacher.createMany({ data: [
    { name: 'Hadi Santoso, S.E.,M.Pd.', position: 'Kepala Sekolah', level: 'Kepala Sekolah', order: 1 },
    { name: 'Dra. Siti ..., M.Pd', position: 'Waka Kurikulum', level: 'Waka', order: 1 },
    { name: 'Drs. Budi ...', position: 'Waka Kesiswaan', level: 'Waka', order: 2 }
  ], skipDuplicates: true });
  console.log('Seed done');
}

main().catch(e => { console.error(e.message); process.exit(0); }).finally(() => { db.$disconnect(); pool.end(); });
