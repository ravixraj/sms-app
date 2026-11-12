import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { relations } from "./schema";

export const createDb = (databaseUrl: string) => {
  const sql = neon(databaseUrl);
  return drizzle({ client: sql, relations });
};

/**
 * Reads the PostgreSQL error code from an error or any error in its cause
 * chain. Drizzle wraps driver errors, so the code is not always on the
 * outermost object.
 */
export const getPgErrorCode = (error: unknown): string | undefined => {
  let current = error;

  for (let depth = 0; depth < 5; depth++) {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    const { code, cause } = current as { code?: unknown; cause?: unknown };

    if (typeof code === "string") {
      return code;
    }

    current = cause;
  }

  return undefined;
};
