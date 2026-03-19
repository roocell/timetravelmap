import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const LOCAL_SUPABASE_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:55432/postgres?schema=timetravelmap";

export function createPrismaAdapter(connectionString?: string) {
  const url =
    connectionString ??
    process.env.DATABASE_URL ??
    (process.env.NODE_ENV !== "production" ? LOCAL_SUPABASE_DATABASE_URL : undefined);

  if (!url) {
    throw new Error("Missing DATABASE_URL for Prisma.");
  }

  const pool = new Pool({
    connectionString: url
  });

  return new PrismaPg(pool);
}
