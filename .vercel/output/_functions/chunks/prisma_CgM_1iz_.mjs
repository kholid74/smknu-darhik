import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
//#region src/lib/prisma.ts
var adapter = new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL }));
var globalForPrisma = globalThis;
var db = globalForPrisma.prisma || new PrismaClient({ adapter });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
//#endregion
export { db as t };
