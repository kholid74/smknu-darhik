import pkg from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaPg } from '@prisma/adapter-pg';
import { requireEnv, env } from './env';
import { assertSimulationTarget, assertSimulationOwnership } from './simulation-guard';

const { PrismaClient } = pkg as any;

// PrismaNeon takes a Neon PoolConfig — passing a `neon()` HTTP client instead
// leaves the pool without a connection string and it silently falls back to
// localhost. DATABASE_URL must be a Neon URL (*.neon.tech).
const simulation=env('SMKDH_SIMULATION')==='1';
const simulationUrl=simulation?requireEnv('SIMULATION_DATABASE_URL'):undefined;
if(simulation)assertSimulationTarget(simulationUrl,{...process.env,SMKDH_SIMULATION:'1',NODE_ENV:import.meta.env.PROD?'production':process.env.NODE_ENV});
const adapter = simulation ? new PrismaPg({connectionString:simulationUrl!}) : new PrismaNeon({ connectionString: requireEnv('DATABASE_URL') });

const globalForPrisma = globalThis as unknown as { prisma: any };
export const db = globalForPrisma.prisma || new PrismaClient({ adapter });
if(simulation){
  const [{database,owner}]=await db.$queryRaw`SELECT current_database() AS database, (SELECT owner FROM "_SMKDHSimulation" LIMIT 1) AS owner`;
  assertSimulationOwnership(database,owner);
}
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
