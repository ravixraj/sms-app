import { zValidator as validate } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { ZodType } from "zod";
import { HTTP, HttpStatus } from "./http";

export const zValidator = <
  T extends ZodType,
  Target extends keyof ValidationTargets,
>(
  target: Target,
  schema: T,
) =>
  validate(target, schema, (result, c) => {
    if (result.success) return;
    const issue = result.error.issues[0];
    const path = issue?.path.join(".");
    const message = issue?.message ?? "Invalid request data";
    return c.json(
      HTTP.failure(path ? `${path}: ${message}` : message),
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  });
