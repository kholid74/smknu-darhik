import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed-pg.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://smkdh:smkdh_dev@localhost:5432/smkdh_cms",
  },
});
