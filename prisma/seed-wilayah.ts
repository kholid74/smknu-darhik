import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const BASE = 'https://emsifa.github.io/api-wilayah-indonesia/api';

// UPPERCASE -> Title Case, jaga singkatan pendek
const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bDki\b/, 'DKI');

async function main() {
  const existing = await db.regency.count();
  if (existing > 0) {
    console.log(`Skip: sudah ada ${existing} kabupaten/kota.`);
    return;
  }

  const provinces: { id: string; name: string }[] = await fetch(`${BASE}/provinces.json`).then((r) => r.json());
  await db.province.createMany({ data: provinces.map((p) => ({ id: p.id, name: titleCase(p.name) })) });
  console.log(`Provinsi: ${provinces.length}`);

  let total = 0;
  for (const p of provinces) {
    const regs: { id: string; province_id: string; name: string }[] = await fetch(`${BASE}/regencies/${p.id}.json`).then((r) => r.json());
    await db.regency.createMany({ data: regs.map((r) => ({ id: r.id, provinceId: r.province_id, name: titleCase(r.name) })) });
    total += regs.length;
  }
  console.log(`Kabupaten/Kota: ${total}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => { db.$disconnect(); pool.end(); });
