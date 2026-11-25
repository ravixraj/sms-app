import { relations } from "#db/schema";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { defineMiddleware } from "hono/factory";
import type { AuthEnv } from "./auth";

export const createDb = (databaseUrl: string) => {
  const sql = neon(databaseUrl);
  return drizzle({ client: sql, relations });
};

export type Db = ReturnType<typeof createDb>;

export const dbMiddleware = defineMiddleware<AuthEnv>(async (c, next) => {
  c.set("db", createDb(c.env.DATABASE_URL));
  await next();
});
