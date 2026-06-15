// Drizzle client over the Cloudflare D1 binding. Use this for template-owned
// queries (settings, admin reads, and new booking-domain tables). Modules keep
// their own ports — see schema.ts boundary note.
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Db = ReturnType<typeof getDb>;
export * as schema from "./schema";
