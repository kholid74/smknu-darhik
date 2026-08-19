import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { randomBytes } from 'node:crypto';

// Duplikat kecil dari src/lib/alumni-id (src chain pakai import.meta.env, tak jalan di tsx).
const newVerifyToken = () => randomBytes(24).toString('base64url');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  // Alumni verified yang belum punya verifyToken (data lama sebelum kolom ada).
  const rows = await db.alumni.findMany({ where: { verified: true, verifyToken: null }, select: { id: true } });
  let done = 0;
  for (const r of rows) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await db.alumni.update({ where: { id: r.id }, data: { verifyToken: newVerifyToken() } });
        done++;
        break;
      } catch (e: any) {
        if (e?.code !== 'P2002') throw e; // bentrok unik -> token baru
      }
    }
  }
  console.log(`Backfill verifyToken: ${done}/${rows.length} alumni verified`);
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => { db.$disconnect(); pool.end(); });
