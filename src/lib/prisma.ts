import pkg from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { requireEnv } from './env';

const { PrismaClient } = pkg as any;

// PrismaNeon takes a Neon PoolConfig — passing a `neon()` HTTP client instead
// leaves the pool without a connection string and it silently falls back to
// localhost. DATABASE_URL must be a Neon URL (*.neon.tech).
const adapter = new PrismaNeon({ connectionString: requireEnv('DATABASE_URL') });

const globalForPrisma = globalThis as unknown as { prisma: any };
export const db = globalForPrisma.prisma || new PrismaClient({ adapter });
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
